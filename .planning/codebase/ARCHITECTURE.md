# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Event-driven, queue-based architecture with Next.js 16 App Router for web UI and API routes

**Key Characteristics:**
- Server Components by default (async React components with direct DB access)
- REST API endpoints for external integrations and admin operations
- BullMQ job queues for async processing (predictions, content generation, settlement)
- Redis caching layer for expensive database queries and API-Football responses
- PostgreSQL with Drizzle ORM for persistent storage
- Separate Redis connections for caching (ioredis) and queues (ioredis) to avoid conflicts

## Layers

### Presentation Layer (Next.js App Router)

**Purpose:** Server-side rendered pages and API endpoints

**Location:** `src/app/`

**Contains:**
- Page routes (`page.tsx`) - Server Components that fetch data directly
- API routes (`api/`) - REST endpoints for programmatic access
- Layouts (`layout.tsx`) - Root layout with navigation and footer
- Error boundaries (`error.tsx`, `global-error.tsx`)

**Dependencies:**
- Uses `getDb()` from `@/lib/db` for direct database queries
- Uses `withCache()` from `@/lib/cache/redis` for caching
- Calls queue jobs via `@/lib/queue` for async operations

**Used by:**
- Browser requests to `/matches`, `/leaderboard`, `/leagues/*`
- External API clients calling `/api/*` endpoints
- Cron schedulers calling `/api/cron/*` endpoints

### API Layer (REST Endpoints)

**Purpose:** Programmatic access to data and admin operations

**Location:** `src/app/api/`

**Contains:**
- Public endpoints: `/api/matches`, `/api/leaderboard`, `/api/health`
- Admin endpoints: `/api/admin/*` (queue management, rescore, DLQ)
- Cron endpoints: `/api/cron/*` (scheduled tasks)
- OG image generation: `/api/og/*` (social share images)

**Key Patterns:**
```typescript
// src/app/api/matches/route.ts
export async function GET(request: NextRequest) {
  // 1. Rate limiting check
  const rateLimitResult = await checkRateLimit(`matches:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  if (!rateLimitResult.allowed) return new NextResponse(null, { status: 429 });

  // 2. Validate query params with Zod
  const { data: validatedQuery, error } = validateQuery(getMatchesQuerySchema, queryParams);
  if (error) return error;

  // 3. Fetch from database (optionally cached)
  const matches = await getUpcomingMatches(48);

  // 4. Return JSON response
  return NextResponse.json(
    { success: true, matches, count: matches.length },
    { headers: createRateLimitHeaders(rateLimitResult) }
  );
}
```

**Admin Endpoints Security:**
- Require `X-Admin-Password` header (checked with timing-safe comparison)
- Additional rate limiting via `RATE_LIMIT_PRESETS.admin`
- Queue dashboard at `/api/admin/queues/[[...path]]` using Bull Board

### Service Layer (Queue Workers)

**Purpose:** Async processing for long-running operations

**Location:** `src/lib/queue/workers/`

**Workers:**
- `predictions.worker.ts` - Generate LLM predictions for matches
- `fixtures.worker.ts` - Fetch upcoming fixtures from API-Football
- `analysis.worker.ts` - Fetch and store match analysis (odds, injuries, H2H)
- `odds.worker.ts` - Refresh betting odds
- `lineups.worker.ts` - Fetch team lineups before kickoff
- `live-score.worker.ts` - Monitor live match scores
- `scoring.worker.ts` - Calculate prediction scores after match finishes
- `content.worker.ts` - Generate AI content for SEO (blog posts, match previews)
- `backfill.worker.ts` - Historical data backfill operations
- `model-recovery.worker.ts` - Re-enable models after health checks
- `standings.worker.ts` - Update league standings

**Queue Names (from `src/lib/queue/index.ts`):**
```typescript
export const QUEUE_NAMES = {
  ANALYSIS: 'analysis-queue',
  PREDICTIONS: 'predictions-queue',
  LINEUPS: 'lineups-queue',
  ODDS: 'odds-queue',
  LIVE: 'live-queue',
  SETTLEMENT: 'settlement-queue',
  CONTENT: 'content-queue',
  FIXTURES: 'fixtures-queue',
  BACKFILL: 'backfill-queue',
  MODEL_RECOVERY: 'model-recovery-queue',
  STANDINGS: 'standings-queue',
};
```

**Job Configuration:**
- 5 retry attempts with exponential backoff (30s → 480s)
- Separate connection from cache Redis to avoid conflicts
- Queue-specific timeouts (10min for predictions, 5min for analysis)

### Data Access Layer (Drizzle ORM)

**Purpose:** Type-safe database operations

**Location:** `src/lib/db/`

**Files:**
- `index.ts` - Database connection pool and Drizzle instance (`getDb()`)
- `schema.ts` - All table definitions with indexes and constraints
- `queries.ts` - Reusable query functions (1700+ lines)

**Query Pattern with Caching:**
```typescript
// src/lib/db/queries.ts
export async function getActiveCompetitions(): Promise<Competition[]> {
  return withCache(
    cacheKeys.activeCompetitions(),
    CACHE_TTL.COMPETITIONS, // 5 minutes
    async () => {
      const db = getDb();
      return db.select().from(competitions).where(eq(competitions.active, true));
    }
  );
}
```

**Transaction Pattern (for betting system):**
```typescript
// Lock ordering: bets -> modelBalances (prevents deadlocks)
return db.transaction(async (tx) => {
  await tx.insert(bets).values(betsData);
  const balance = await tx.select().from(modelBalances)...
  await tx.update(modelBalances).set({
    currentBalance: sql`${modelBalances.currentBalance} - ${totalStake}`,
  })...
});
```

### Caching Layer (Redis)

**Purpose:** Reduce database load and cache API-Football responses

**Location:** `src/lib/cache/redis.ts`

**TTL Presets:**
```typescript
export const CACHE_TTL = {
  FIXTURES_LIVE: 30,      // Live match data (frequent updates)
  FIXTURES_SCHEDULED: 300, // Upcoming fixtures (5 min)
  STANDINGS: 14400,        // League standings (4 hours)
  PREDICTIONS: 86400,      // Pre-match data (24 hours)
  ODDS: 600,               // Betting odds (10 min)
  LEADERBOARD: 60,         // Leaderboard (1 min)
  MODELS: 300,             // Model list (5 min)
};
```

**Cache Key Pattern:**
```typescript
export const cacheKeys = {
  // API-Football
  fixtures: (date: string) => `api:fixtures:${date}`,
  odds: (fixtureId: number) => `api:odds:${fixtureId}`,
  
  // Database queries
  activeModels: () => 'db:models:active',
  leaderboard: (filters: string) => `db:leaderboard:${hashForCacheKey(filters)}`,
  
  // Invalidation
  async function invalidateMatchCaches(matchId: string) {
    await cacheDeletePattern('db:leaderboard:*');
    await cacheDelete(cacheKeys.overallStats());
    await cacheDelete(cacheKeys.matchPredictions(matchId));
  }
};
```

### External Integrations Layer

**Purpose:** API-Football data and LLM predictions

**Location:** `src/lib/football/` and `src/lib/llm/`

**API-Football (`src/lib/football/`):**
- `api-client.ts` - HTTP client with rate limiting (10 req/min)
- `api-football.ts` - Main API functions (fixtures, odds, injuries)
- `standings.ts` - League standings fetching and storage
- `match-analysis.ts` - Comprehensive match data aggregation
- `prompt-builder.ts` - LLM prompt construction

**LLM Providers (`src/lib/llm/`):**
- `providers/together.ts` - 35+ open-source models via Together AI
- `budget.ts` - Daily cost tracking and limits
- `prompt.ts` - Prediction prompt templates

**Key Integration Points:**
```typescript
// src/lib/llm/providers/together.ts
export class TogetherProvider {
  async predict(homeTeam: string, awayTeam: string, competition: string) {
    // Check daily budget
    const today = new Date().toISOString().split('T')[0];
    const usage = await getModelUsageToday(this.id);
    if (usage.totalCost > DAILY_BUDGET) {
      throw new Error('Daily budget exceeded');
    }

    // Call Together AI API
    const response = await fetch('https://api.together.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOGETHER_API_KEY}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    // Update usage and return prediction
    await updateModelUsage(this.id, today, tokens, cost);
    return parsePrediction(response);
  }
}
```

## Data Flow

### 1. Match Lifecycle (Complete Flow)

```
API-Football ──► fixtures.worker ──► upsertMatch ──► matches table
                                              │
                                              ▼
                     ◄──────────────────────────────────────◄
                    │                                       │
match───────────────┴──────────────────────────────────────┘
status change?                                             │
     │                                                     │
     ▼                                                     │
analysis.worker ──► fetch odds/injuries/H2H ──► match_analysis table
                                              │
                                              ▼
                               ◄───────────────────────────────◄
                              │                                │
lineups needed? ◄─────────────┴────────────────────────────────┘
     │                                                      │
     ▼                                                      │
lineups.worker ──► fetch lineups ──► match_analysis (updated)
     │
     ▼
predictions.worker ──► LLM calls (35 models) ──► predictions table
     │
     ▼
live-score.worker ──► poll API-Football ──► updateMatchResult
     │
     ▼
scoring.worker ──► calculate Kicktipp scores ──► updatePredictionScores
                ──► updateModelStreak
                ──► invalidateMatchCaches
```

### 2. API Request Flow

```
Browser ──► Next.js Route Handler
              │
              ├──► Middleware (CORS, body size check)
              │
              ├──► Rate Limiting (60 req/min for public, 10/min for admin)
              │
              ├──► Validation (Zod schemas)
              │
              ├──► Database Query (optionally cached)
              │   └──► withCache(key, ttl, fetchFn)
              │
              └──► JSON Response
```

### 3. Admin Operation Flow

```
Admin ──► POST /api/admin/rescore
         │
         ├──► Admin Auth (X-Admin-Password header)
         │
         ├──► Rate Limiting (10 req/min)
         │
         ├──► Query: getMatchesNeedingRescore()
         │
         └──► Queue: settlementQueue.add(JOB_TYPES.SETTLE_MATCH, { matchId })
                     │
                     └──► scoring.worker processes async
```

## State Management

**Server State:**
- Direct database queries in Server Components
- `Suspense` boundaries for async data loading
- No global client state library (React Context for local state only)

**Client State:**
- URL-based state (query parameters for filters)
- Local component state with `useState`/`useReducer`
- URL search params for match search (`/matches?q=manchester`)

## Error Handling

**Layers:**
1. **Middleware** - CORS validation, body size limits (`src/middleware.ts`)
2. **Validation** - Zod schema validation (`src/lib/validation/middleware.ts`)
3. **Rate Limiting** - Token bucket algorithm (`src/lib/utils/rate-limiter.ts`)
4. **Logging** - Structured Pino logging (`src/lib/logger/modules.ts`)
5. **Error Boundaries** - React error boundaries in pages

**Error Response Format:**
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'INTERNAL_ERROR',
    message: 'Human-readable message',
    details: [{ field: 'paramName', message: 'Specific error' }],
  }
}
```

## Cross-Cutting Concerns

**Logging:**
- Pino structured logging with named loggers per area
- `loggers.db`, `loggers.cache`, `loggers.queue`, `loggers.llm`
- Request context middleware for tracing

**Validation:**
- Zod for all input validation (query params, body, params)
- Centralized schemas in `src/lib/validation/schemas.ts`

**Rate Limiting:**
- Token bucket algorithm per endpoint category
- Configurable presets: `RATE_LIMIT_PRESETS.api`, `admin`, `cron`

**Authentication:**
- Admin routes require `X-Admin-Password` header
- Cron routes require `secret` query parameter
- No user authentication (public platform)

---

*Architecture analysis: 2026-01-27*
