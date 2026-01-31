# Codebase Structure

**Analysis Date:** 2026-01-31

## Directory Layout

```
bettingsoccer/
├── src/
│   ├── app/                          # Next.js App Router (pages + API routes)
│   │   ├── layout.tsx                # Root layout, metadata, schemas
│   │   ├── page.tsx                  # Homepage (/ route)
│   │   ├── error.tsx                 # Global error boundary
│   │   ├── global-error.tsx          # Fatal error page
│   │   ├── robots.ts                 # robots.txt generation
│   │   ├── sitemap.ts                # sitemap.xml generation
│   │   ├── middleware.ts             # CORS, security headers
│   │   ├── api/                      # REST API endpoints
│   │   │   ├── health/route.ts       # Health check
│   │   │   ├── matches/              # Match data endpoints
│   │   │   ├── stats/                # Statistics and leaderboard endpoints
│   │   │   ├── admin/                # Admin-only endpoints (queue status, rescore, etc.)
│   │   │   └── cron/                 # Periodic job triggers
│   │   ├── matches/                  # Match pages
│   │   ├── leagues/                  # League hub pages
│   │   ├── blog/                     # Blog post pages
│   │   ├── leaderboard/              # Leaderboard pages
│   │   ├── models/                   # Model detail pages
│   │   ├── admin/                    # Admin dashboard
│   │   └── about/                    # Static pages
│   ├── components/                   # React components
│   │   ├── ui/                       # Primitive UI components (Radix-based)
│   │   ├── match/                    # Match-specific components
│   │   ├── leaderboard/              # Leaderboard-specific components
│   │   ├── admin/                    # Admin-specific components
│   │   ├── competition/              # Competition-specific components
│   │   ├── *.tsx                     # Feature components (card, badge, filter, etc.)
│   │   └── analytics.tsx             # Umami analytics integration
│   ├── lib/                          # Core logic and utilities
│   │   ├── db/                       # Database layer
│   │   │   ├── index.ts              # Database connection singleton
│   │   │   ├── schema.ts             # Drizzle ORM schema definitions
│   │   │   ├── queries.ts            # Core database queries (2000+ lines)
│   │   │   ├── queries/              # Query modules
│   │   │   │   └── stats.ts          # Leaderboard aggregations
│   │   │   ├── schema/               # Schema modules
│   │   │   │   └── stats.ts          # Stats table definitions
│   │   │   └── sync-models.ts        # Utility to sync model list
│   │   ├── queue/                    # Job queue system (BullMQ)
│   │   │   ├── index.ts              # Queue setup and job type definitions
│   │   │   ├── setup.ts              # Redis connection, queue initialization
│   │   │   ├── scheduler.ts          # Job scheduling logic (T-6h to T+kickoff)
│   │   │   ├── types.ts              # Job payload type definitions
│   │   │   ├── dead-letter.ts        # Dead-letter queue handling
│   │   │   ├── catch-up.ts           # Catch-up logic for missed jobs
│   │   │   └── workers/              # Job worker implementations
│   │   │       ├── predictions.worker.ts
│   │   │       ├── scoring.worker.ts
│   │   │       ├── content.worker.ts
│   │   │       ├── backfill.worker.ts
│   │   │       └── odds.worker.ts
│   │   ├── llm/                      # LLM provider integration
│   │   │   ├── index.ts              # Provider registry and helpers
│   │   │   ├── prompt.ts             # Prompt building and parsing
│   │   │   ├── budget.ts             # Cost tracking
│   │   │   └── providers/            # LLM provider implementations
│   │   │       ├── base.ts           # Base provider class
│   │   │       └── together.ts       # Together AI (35 models)
│   │   ├── football/                 # Football data and API
│   │   │   ├── api-client.ts         # API-Football wrapper
│   │   │   ├── api-football.ts       # Detailed API-Football client
│   │   │   ├── competitions.ts       # Competition data
│   │   │   ├── match-analysis.ts     # Match context building
│   │   │   ├── prompt-builder.ts     # LLM prompt construction
│   │   │   ├── lineups.ts            # Lineup parsing
│   │   │   ├── h2h.ts                # Head-to-head statistics
│   │   │   ├── standings.ts          # League standings
│   │   │   └── team-statistics.ts    # Team stats aggregation
│   │   ├── content/                  # Content generation
│   │   │   ├── generator.ts          # Main content generation
│   │   │   ├── together-client.ts    # Together AI client for content
│   │   │   ├── prompts.ts            # Content generation prompts
│   │   │   ├── queries.ts            # Blog post queries
│   │   │   ├── match-content.ts      # Match content utilities
│   │   │   ├── deduplication.ts      # Prevent duplicate blog posts
│   │   │   └── config.ts             # Content generation config
│   │   ├── cache/                    # Redis caching layer
│   │   │   └── redis.ts              # withCache() helper
│   │   ├── logger/                   # Pino structured logging
│   │   │   ├── modules.ts            # Named logger exports
│   │   │   └── *.ts                  # Logger configuration
│   │   ├── services/                 # Business logic services
│   │   │   └── points-calculator.ts  # Kicktipp scoring logic
│   │   ├── utils/                    # Utility functions
│   │   │   ├── api-client.ts         # HTTP client with circuit breaker
│   │   │   ├── circuit-breaker.ts    # Circuit breaker implementation
│   │   │   ├── rate-limiter.ts       # Redis-based rate limiting
│   │   │   ├── scoring.ts            # Score-related utilities
│   │   │   ├── admin-auth.ts         # Admin auth checking
│   │   │   ├── stats-auth.ts         # Stats API auth
│   │   │   ├── error-sanitizer.ts    # Error message sanitization
│   │   │   ├── date.ts               # Date parsing/formatting
│   │   │   ├── retry-config.ts       # Retry strategies
│   │   │   ├── retry-helpers.ts      # Retry utilities
│   │   │   ├── env-validation.ts     # Environment variable validation
│   │   │   ├── slugify.ts            # URL slug generation
│   │   │   ├── indexnow.ts           # IndexNow search indexing
│   │   │   ├── upset.ts              # Upset calculation
│   │   │   └── *.ts                  # Other utilities
│   │   ├── validation/               # Input validation
│   │   │   ├── schemas.ts            # Zod validation schemas
│   │   │   └── middleware.ts         # Validation middleware
│   │   ├── seo/                      # SEO utilities
│   │   │   └── *.ts                  # Schema generation, canonicals
│   │   ├── table/                    # Table data processing
│   │   ├── auth/                     # Authentication utilities
│   │   ├── api/                      # API client utilities
│   │   ├── env.ts                    # Centralized env config
│   │   └── utils.ts                  # Top-level utility export
│   └── types/                        # TypeScript types and interfaces
│       └── index.ts                  # Central type exports
├── scripts/                          # One-off scripts
│   ├── migrate-betting-system.ts
│   ├── migrate-predictions.ts
│   ├── migrate-hotfix.ts
│   ├── sync-models.ts
│   ├── clean-predictions.ts
│   └── regenerate-post-match-content.ts
├── drizzle/                          # Drizzle ORM metadata
│   └── meta/                         # Migration metadata
├── migrations/                       # Database migrations (auto-generated)
├── public/                           # Static assets
│   ├── favicon.ico
│   └── ...
├── .env.local                        # Environment variables (not committed)
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind CSS config
├── postcss.config.js                 # PostCSS config
├── next.config.ts                    # Next.js config
└── .planning/                        # Planning and documentation
    └── codebase/                     # Architecture documentation
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router - defines all routes (pages and API)
- Contains: Page components (SSR), API handlers, error boundaries
- Key files: `layout.tsx` (root), `page.tsx` (homepage), `api/**/*.ts` (endpoints)

**src/components/:**
- Purpose: Reusable React components
- Contains: UI primitives, feature-specific components, layout components
- Pattern: Feature-based organization (`match/`, `admin/`, etc.)
- Key files: `ui/` (Radix-based primitives), `*-card.tsx`, `*-table.tsx`

**src/lib/db/:**
- Purpose: Data persistence layer
- Contains: Drizzle schema, typed queries, database connection
- Key files: `schema.ts` (entity definitions), `queries.ts` (2000+ lines of data access)
- Pattern: Single `getDb()` export, all queries cached at caller

**src/lib/queue/:**
- Purpose: Asynchronous job processing
- Contains: BullMQ queue setup, job schedulers, worker implementations
- Key files: `scheduler.ts` (timing logic), `workers/*.ts` (job handlers)
- Pattern: Time-based scheduling relative to match kickoff

**src/lib/llm/:**
- Purpose: LLM provider abstraction
- Contains: Provider implementations, prompt builders, cost tracking
- Key files: `index.ts` (registry), `providers/together.ts` (35 models)
- Pattern: Pluggable providers, batch predictions

**src/lib/football/:**
- Purpose: Football data integration
- Contains: API-Football client, match analysis, prompt building
- Key files: `api-client.ts` (wrapper), `match-analysis.ts` (context)
- Pattern: Fetches match data → builds LLM prompts

**src/lib/content/:**
- Purpose: Blog post generation
- Contains: Content generator, prompts, deduplication
- Key files: `generator.ts` (main logic), `prompts.ts` (LLM prompts)
- Pattern: Takes match results → generates markdown blog post

**src/lib/cache/:**
- Purpose: Redis caching layer
- Contains: withCache() helper with TTL and invalidation
- Key files: `redis.ts` (main caching utility)
- Pattern: Wraps async queries, fires-and-forgets invalidation

**src/lib/utils/:**
- Purpose: Cross-cutting utilities
- Contains: HTTP client, rate limiter, circuit breaker, validation
- Key files: `api-client.ts`, `rate-limiter.ts`, `circuit-breaker.ts`
- Pattern: Reusable utilities exported individually

**src/types/:**
- Purpose: Central TypeScript type definitions
- Contains: Interfaces for data shapes, API responses, component props
- Key files: `index.ts` (re-exports from schema, custom types)
- Pattern: Domain-driven types (MatchWithPredictions, PredictionWithModel, etc.)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout (metadata, schemas, navigation)
- `src/app/page.tsx`: Homepage
- `src/app/api/matches/route.ts`: Main match list API
- `src/lib/queue/index.ts`: Queue setup (runs on server start)
- `src/middleware.ts`: Global middleware (CORS, body size)

**Configuration:**
- `.env.local`: Database URL, API keys, base URL
- `tsconfig.json`: TypeScript compiler options
- `next.config.ts`: Next.js build and runtime config
- `tailwind.config.ts`: Tailwind design tokens
- `src/lib/env.ts`: Runtime environment validation

**Core Logic:**
- `src/lib/db/queries.ts`: Central query hub (2000+ lines, all data access)
- `src/lib/queue/scheduler.ts`: Job timing and priority system
- `src/lib/queue/workers/predictions.worker.ts`: LLM prediction generation
- `src/lib/queue/workers/scoring.worker.ts`: Kicktipp point calculation
- `src/lib/services/points-calculator.ts`: Scoring algorithm

**Testing & Validation:**
- `src/lib/validation/schemas.ts`: Zod schemas for API requests
- `src/lib/validation/middleware.ts`: Request validation middleware

**Utilities:**
- `src/lib/utils/api-client.ts`: HTTP client (circuit breaker, retries)
- `src/lib/utils/rate-limiter.ts`: Redis-based rate limiting
- `src/lib/utils/admin-auth.ts`: Admin password checking
- `src/lib/utils/error-sanitizer.ts`: Error response sanitization

## Naming Conventions

**Files:**
- Page components: `*.tsx` in `src/app/` (e.g., `page.tsx`, `error.tsx`)
- API routes: `route.ts` in `src/app/api/*`
- Components: `kebab-case.tsx` in `src/components/` (e.g., `match-card.tsx`)
- Utilities: `kebab-case.ts` in `src/lib/utils/`
- Workers: `kebab-case.worker.ts` in `src/lib/queue/workers/` (e.g., `predictions.worker.ts`)
- Tests: `*.test.ts` or `*.spec.ts` (co-located with source)

**Variables & Functions:**
- camelCase for functions and variables
- SCREAMING_SNAKE_CASE for constants and enums
- PascalCase for React components and classes
- Prefixed private functions with underscore if needed (rarely)

**Types:**
- PascalCase for type/interface names (e.g., `MatchWithPredictions`)
- Prefix type imports: `import type { Match } from '@/lib/db/schema'`
- Use `New*` suffix for insert types: `NewMatch`, `NewBet`
- Use `*Payload` suffix for job payloads: `PredictMatchPayload`

## Where to Add New Code

**New API Endpoint:**
- File: `src/app/api/[feature]/route.ts`
- Pattern: Export `GET(request)` or `POST(request)` handlers
- Include: Rate limiting, validation, error handling
- Example: `src/app/api/matches/route.ts`

**New Database Query:**
- File: `src/lib/db/queries.ts` or `src/lib/db/queries/[domain].ts` if large
- Pattern: Async function returning typed data, wrapped in `withCache()` if needed
- Include: Error handling with `logQueryError()`, proper Drizzle operators
- Export: From `src/lib/db/queries.ts` for use in pages/workers

**New Component:**
- File: `src/components/[feature]/[name].tsx`
- Pattern: Default export, typed props, use Radix UI primitives in `ui/` dir
- Include: Accessible attributes (aria-*, role=)
- Example: `src/components/match/match-card.tsx`

**New Page:**
- File: `src/app/[route]/page.tsx`
- Pattern: Default export Server Component, async if fetching data
- Include: Proper metadata, error boundaries, Suspense boundaries
- Example: `src/app/matches/[id]/page.tsx`

**New Job Worker:**
- File: `src/lib/queue/workers/[job-name].worker.ts`
- Pattern: Export worker function: `async (job: Job<PayloadType>) => void`
- Include: Proper error handling, logging with job context
- Register: In `src/lib/queue/setup.ts` via `.process()`

**Shared Utility:**
- File: `src/lib/utils/[utility-name].ts`
- Pattern: Named exports (can have multiple per file)
- Include: Type annotations, JSDoc comments
- Example: `src/lib/utils/rate-limiter.ts`

**Football Integration:**
- File: `src/lib/football/[feature].ts`
- Pattern: Exports functions that call `src/lib/football/api-client.ts`
- Include: Error handling, retry logic via circuit breaker
- Example: `src/lib/football/match-analysis.ts`

**LLM Provider:**
- File: `src/lib/llm/providers/[provider-name].ts`
- Pattern: Class extending `LLMProvider` base
- Include: `predictMatch()` method, error recovery
- Register: In `src/lib/llm/index.ts` export

## Special Directories

**drizzle/:**
- Purpose: Drizzle ORM metadata for migrations
- Generated: Yes (auto-generated by `drizzle-kit`)
- Committed: Yes (contains migration history)
- Manual edits: No (managed by Drizzle)

**migrations/:**
- Purpose: Database migration files
- Generated: Yes (auto-generated by `drizzle-kit generate`)
- Committed: Yes (version control for schema changes)
- Manual edits: Rarely (only if fixing broken migrations)

**public/:**
- Purpose: Static assets served directly by Next.js
- Generated: No
- Committed: Yes
- Manual edits: Yes (add logos, favicons, robots.txt)

**scripts/:**
- Purpose: One-off maintenance scripts (run via `npm run [script]`)
- Generated: No
- Committed: Yes
- Usage: Data migrations, cleanup, sync utilities
- Examples: `migrate-betting-system.ts`, `sync-models.ts`

**.next/:**
- Purpose: Next.js build output
- Generated: Yes (created by `next build`)
- Committed: No (.gitignored)
- Manual edits: Never

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (.gitignored)
- Manual edits: Never

