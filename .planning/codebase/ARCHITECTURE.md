# Architecture

**Analysis Date:** 2026-01-31

## Pattern Overview

**Overall:** Event-driven, multi-layered Next.js application with asynchronous job queue architecture.

**Key Characteristics:**
- Separates concerns between web layer (Next.js), background jobs (BullMQ), and data layer (PostgreSQL)
- Time-coordinated job scheduling relative to football match kickoff times
- Queue-first approach: all predictions and analysis run async via workers
- Cache layer for hot data (Redis)
- Modular service layer for domain-specific logic

## Layers

**Web Layer:**
- Purpose: Server-side rendered pages and API endpoints
- Location: `src/app/`
- Contains: Next.js pages (SSR), API routes (REST endpoints), middleware
- Depends on: Service layer, DB queries, cache
- Used by: Browser clients, external API consumers

**Job Queue Layer:**
- Purpose: Asynchronous background job processing with timing guarantees
- Location: `src/lib/queue/`
- Contains: Job schedulers, worker definitions, queue setup, dead-letter handling
- Depends on: Redis (BullMQ), DB queries, service layer
- Used by: Scheduled jobs, cron triggers, manual API calls

**Service Layer:**
- Purpose: Domain-specific business logic and integrations
- Location: `src/lib/` (modular: `football/`, `llm/`, `content/`, `cache/`, etc.)
- Contains: Football API client, LLM providers, content generation, scoring logic
- Depends on: External APIs, utilities, validation
- Used by: Job workers, API routes, components

**Data Layer:**
- Purpose: Database schema and query operations
- Location: `src/lib/db/`
- Contains: Drizzle schema definitions, parameterized queries, migrations
- Depends on: PostgreSQL
- Used by: All other layers via `getDb()` singleton

**Presentation Layer:**
- Purpose: React components for UI rendering
- Location: `src/components/`
- Contains: UI primitives, feature components, layout components
- Depends on: Data queries, utility functions
- Used by: Pages in `src/app/`

## Data Flow

**Match Lifecycle Flow (Core Business Logic):**

1. **Fetch Fixtures (T-6h to T-48h before kickoff)**
   - Job: `fetchFixtures` via cron or manual trigger
   - Calls: `src/lib/football/api-client.ts` → API-Football
   - Stores: Matches in `matches` table with `status: 'scheduled'`
   - Next: Scheduler queues analysis jobs

2. **Analyze Match (T-6h)**
   - Job: `analyzeMatch` (T-6h before kickoff)
   - Calls: `src/lib/football/match-analysis.ts` → team stats, H2H, form
   - Calls: `src/lib/football/standings.ts` → current league positions
   - Stores: Analysis in `matchAnalysis` table
   - Next: Scheduler queues odds refresh job

3. **Refresh Odds (T-2h)**
   - Job: `refreshOdds` (T-2h before kickoff)
   - Calls: `src/lib/football/api-client.ts` → API-Football odds
   - Stores: Quota scores in `matches.quota{Home,Draw,Away}` (2-6 points)
   - Next: Scheduler queues lineups job

4. **Fetch Lineups (T-60m)**
   - Job: `fetchLineups` (T-60m before kickoff)
   - Calls: `src/lib/football/lineups.ts` → API-Football lineups
   - Stores: Lineup info in `matchAnalysis` table
   - Next: Scheduler queues predictions job

5. **Predict Match (T-30m, T-5m retry)**
   - Job: `predictMatch` (T-30m, can retry at T-5m)
   - Calls: `src/lib/llm/index.ts` → Get active providers (filters auto-disabled)
   - Calls: `src/lib/llm/providers/together.ts` → Together AI API (35 models)
   - Calls: `src/lib/llm/prompt.ts` → Build match context prompt
   - Parses: LLM JSON response (score predictions: home/away with confidence)
   - Stores: Predictions in `predictions` table + `bets` table (for historical tracking)
   - Handles: JSON parse failures with automatic retries, model auto-disable on 3+ failures
   - Next: Scheduler queues live monitoring job

6. **Monitor Live (Kickoff + every 60s while live)**
   - Job: `monitorLive` (starts at kickoff, repeats every 60s)
   - Calls: `src/lib/football/api-client.ts` → API-Football live scores
   - Updates: `matches.status`, `matches.matchMinute`, `matches.homeScore`, `matches.awayScore`
   - Stops: When match status = 'finished'
   - Next: Scheduler queues settlement job

7. **Settle Match (When match finishes)**
   - Job: `settleMatch` (auto-triggered when status = 'finished')
   - Calls: `src/lib/services/points-calculator.ts` → Calculate Kicktipp points for each prediction
   - Calculates:
     - Exact score: 10 points
     - Correct result tendency: quota points (2-6 based on rarity)
     - Streak tracking and model updates
   - Stores: Points in `predictions.points`, updates `models.currentStreak*`
   - Next: Scheduler queues roundup job

8. **Generate Roundup (After settlement)**
   - Job: `generateContent` with type='generate-roundup'
   - Calls: `src/lib/content/generator.ts` → Content generation via Together AI
   - Prompts LLM with match results and model predictions
   - Stores: Blog post in `blogPosts` + `matchRoundups` tables
   - Publishes: New blog post visible at `/blog/[slug]`

**Query/Read Flow (Web Layer):**

1. **Homepage request** → `/api/matches?type=upcoming`
   - Route: `src/app/api/matches/route.ts`
   - Rate limited: 60 req/min per IP
   - Calls: `src/lib/db/queries.ts` → `getUpcomingMatches()` + `getOverallStats()`
   - Cached: 60s via Redis
   - Returns: Upcoming matches with all predictions

2. **Leaderboard request** → `/api/stats/leaderboard`
   - Route: `src/app/api/stats/leaderboard/route.ts`
   - Calls: `src/lib/db/queries/stats.ts` → `getLeaderboard()` (complex aggregation)
   - Cached: 5min via Redis
   - Returns: Model rankings by points, win rate, accuracy

3. **Match detail request** → `/matches/[id]`
   - Page: `src/app/matches/[id]/page.tsx` (Server Component)
   - Calls: `src/lib/db/queries.ts` → `getMatchWithPredictions()`
   - Renders: Match card, all model predictions, live score updates
   - Cache busting: Uses `dynamic = 'force-dynamic'` if match in-progress

**State Management:**

- **In-Memory:** Job state via Redis (BullMQ)
- **Database:** PostgreSQL stores all persistent state (matches, predictions, models, blog posts)
- **Cache Layer:** Redis with TTL-based invalidation
  - Active competitions: 24h TTL
  - Leaderboard stats: 5min TTL
  - Match predictions: 60s TTL
  - Cache invalidation: Fire-and-forget on mutations (logged if fail)

## Key Abstractions

**Match (Entity):**
- Purpose: Represents a single football match with live score tracking
- Examples: `src/lib/db/schema.ts` lines 16-49
- Pattern: Row in `matches` table with fields for teams, kickoff, score, status, metadata
- Lifecycle: Created at fetch → Updated through live monitoring → Settled with points

**Prediction (Entity):**
- Purpose: One model's score prediction for one match
- Examples: `src/lib/db/schema.ts`, related type `PredictionWithModel` in `src/types/index.ts`
- Pattern: 1:1 mapping of (Model, Match, Prediction) stored in `predictions` table
- Scoring: Kicktipp system (exact score 10pts, correct result 2-6pts based on odds quota)

**LLMProvider (Service):**
- Purpose: Abstraction over different LLM APIs and model implementations
- Examples: `src/lib/llm/providers/base.ts`, `src/lib/llm/providers/together.ts`
- Pattern: Base class with `predictMatch()` method, implementations handle API calls
- Data: Each provider has id, tier, cost, rate limits, health tracking

**Queue Job (Event):**
- Purpose: Async work unit with payload and retry logic
- Examples: `src/lib/queue/types.ts` (all job payload interfaces)
- Pattern: Named job type (e.g., 'predict-match') with typed payload, routed to worker
- Execution: BullMQ ensures exactly-once delivery, auto-retries, dead-letter handling

**Query (Data Access):**
- Purpose: Named database queries with caching layer
- Examples: `src/lib/db/queries.ts` (2000+ lines of aggregations and filters)
- Pattern: Async function returning typed data, wrapped in `withCache()` for TTL caching
- Resilience: Fire-and-forget cache invalidation, DB errors handled and logged

## Entry Points

**Web Entry:**
- Location: `src/app/layout.tsx`
- Triggers: Browser requests to `/`
- Responsibilities: Root layout, metadata, schema.org JSON-LD, navigation, footer

**API Entry (REST):**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP requests to `/api/...`
- Pattern: GET/POST handlers with rate limiting, validation, error handling
- Middleware: `src/middleware.ts` adds CORS, body size checks before handlers

**Job Entry (Background):**
- Location: `src/lib/queue/scheduler.ts`, `src/lib/queue/workers/*.ts`
- Triggers: Time-based scheduling (relative to match kickoff) or manual API calls
- Pattern: Job types defined in `src/lib/queue/types.ts`, workers handle in `workers/` dir
- Execution: BullMQ dequeues → calls appropriate worker → stores result in DB

**Cron Entry (Periodic):**
- Location: `src/app/api/cron/*/route.ts`
- Triggers: External cron service (e.g., GitHub Actions, external cron)
- Pattern: GET handler that manually enqueues repeatable jobs
- Examples: `/api/cron/update-stats` → enqueues `fetchFixtures`, `/api/cron/generate-content` → enqueues content generation

## Error Handling

**Strategy:** Layered error handling with logging and circuit breakers

**Patterns:**

1. **API Client Layer** (`src/lib/utils/api-client.ts`)
   - Wraps HTTP calls with circuit breaker
   - Retries with exponential backoff (configurable per endpoint)
   - Logs all failures with context (URL, status, response body)
   - Throws typed errors for caller to handle

2. **LLM Provider Layer** (`src/lib/llm/providers/base.ts`)
   - JSON parse failures → retry with backlog tracking
   - API timeouts → exponential backoff (3 retries)
   - Auto-disable model after 3+ consecutive failures
   - Stores `consecutiveFailures`, `lastFailureAt`, `failureReason` in models table

3. **Queue Worker Layer** (`src/lib/queue/workers/*.ts`)
   - Job failures go to dead-letter queue if retries exhausted
   - Worker catches errors → logs with job context → throws for BullMQ retry
   - Dead-letter queue accessible via `/api/admin/dlq` for inspection

4. **Web Route Layer** (`src/app/api/*/route.ts`)
   - Try/catch wraps all logic
   - 400: Validation errors (sanitized)
   - 429: Rate limit exceeded
   - 500: Internal errors (sanitized, logged with request ID)
   - Returns: JSON error response with status

5. **Component Layer** (`src/app/*/error.tsx`)
   - Error boundary components catch React rendering errors
   - Display user-friendly error message
   - Log error context to Sentry

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino (JSON structured logging)
- Modules: `src/lib/logger/modules.ts` exports named loggers (db, queue, llm, api, etc.)
- Usage: `loggers.queue.info({jobId, matchId}, 'Prediction job started')`
- Output: Structured JSON to stdout (Sentry in production)

**Validation:**
- Framework: Zod schemas
- Location: `src/lib/validation/schemas.ts` for API request validation
- Middleware: `src/lib/validation/middleware.ts` wraps query/body parsing
- Usage: `validateQuery()` returns `{data, error}`, error is already formatted HTTP response

**Authentication:**
- Admin routes: `src/lib/utils/admin-auth.ts` checks `X-Admin-Password` header
- Stats API: `src/lib/utils/stats-auth.ts` allows public access with optional token
- Implementation: Middleware pattern, inline in route handlers

**Rate Limiting:**
- Framework: Redis-based counter with sliding window
- Location: `src/lib/utils/rate-limiter.ts`
- Presets: 60 req/min for public API, 30 req/min for expensive endpoints
- Headers: Returns `RateLimit-*` headers, `Retry-After` when exceeded
- Keying: IP address for public routes, token for authenticated

**Caching:**
- Framework: Redis with typed key builders
- Location: `src/lib/cache/redis.ts`
- Pattern: `withCache(key, ttl, async () => query())` wraps expensive queries
- Invalidation: Fire-and-forget `cacheDelete()` on mutations (errors logged, not thrown)

