# External Integrations

**Analysis Date:** 2026-01-31

## APIs & External Services

**Football Data:**
- API-Football (api-sports.io)
  - What it's used for: Match fixtures, lineups, statistics, competition standings, head-to-head data
  - SDK/Client: Custom client in `src/lib/football/api-football.ts` using native fetch
  - Auth: `API_FOOTBALL_KEY` environment variable (header: `x-apisports-key`)
  - Rate limit handling: 300ms delay between requests, configured retry logic in `src/lib/utils/retry-config.ts`
  - Base URL: `https://v3.football.api-sports.io`

**LLM Providers:**
- Together AI (Primary)
  - What it's used for: Match predictions, content generation, roundup analysis
  - SDK/Client: Custom OpenAI-compatible provider in `src/lib/llm/providers/together.ts`
  - Auth: `TOGETHER_API_KEY` environment variable (Authorization: Bearer)
  - Endpoint: `https://api.together.xyz/v1/chat/completions`
  - Models: 29 open-source models configured with JSON mode support
    - DeepSeek V3.1, DeepSeek R1
    - Moonshot, Claude, Llama 3.3, Mistral, Qwen
    - Models categorized by tier: free, ultra-budget, budget, premium
  - Cost tracking: Per-model pricing configured, budget control via `DAILY_BUDGET`
  - Budget enforcement: Model auto-disabling when budget exceeded (tracked in database)

**SEO & Indexing:**
- IndexNow
  - What it's used for: Notify search engines (Bing, Yandex) of URL updates
  - Implementation: `src/lib/utils/indexnow.ts`
  - Auth: `INDEXNOW_KEY` environment variable
  - Endpoints:
    - https://api.indexnow.org/indexnow
    - https://www.bing.com/indexnow
    - https://search.yandex.com/indexnow

## Data Storage

**Databases:**
- PostgreSQL (Primary data store)
  - Connection: Via `DATABASE_URL` environment variable
  - Client: `pg` v8.17.2 driver
  - ORM: Drizzle ORM v0.45.1
  - Connection pooling: Configurable pool (min: 2, max: 10)
  - Schema: `src/lib/db/schema.ts`
    - Tables: competitions, matches, models, modelUsage, matchAnalysis, leagueStandings, seasons, modelBalances, bets, predictions, autoDisabledModels
  - Migrations: Drizzle Kit migrations in `drizzle/` directory

**Caching:**
- Redis
  - Connection: Via `REDIS_URL` environment variable (optional)
  - Supports: Standard Redis URL or Upstash Redis REST API
  - Client: ioredis v5.9.2 with health checks and adaptive cooldown
  - Use cases:
    - Query result caching (matches, standings, statistics)
    - Cache warming on startup (frequently accessed data)
  - Graceful degradation: Application continues without Redis if URL not set
  - Health check: 30s interval when healthy, 5s when degraded

**Job Queue Storage:**
- Redis
  - Connection: Same `REDIS_URL` as caching (BullMQ requirement)
  - Queue library: BullMQ v5.34.3
  - Job types: `src/lib/queue/types.ts`
    - Repeatable: fetch-fixtures (6h), backfill-missing, check-disabled-models, update-standings
    - Per-match: analyze-match, refresh-odds, fetch-lineups, predict-match, monitor-live, settle-match, generate-roundup
    - Utility: catch-up scheduling
  - Queue UI: Bull Board (Express + API) for job monitoring

## Authentication & Identity

**Auth Provider:**
- Custom implementation via environment variables
- Mechanisms:
  - `CRON_SECRET` - Authentication for cron/scheduled task endpoints
    - Used in: `src/app/api/cron/*` routes
    - Validation: Header-based secret comparison
  - `ADMIN_PASSWORD` - Password protection for admin pages (if configured)
    - Used in: `src/app/admin/*` routes
  - No third-party auth provider integrated (Clerk, Auth0, Firebase not used)

## Monitoring & Observability

**Error Tracking:**
- GlitchTip (via Sentry SDK)
  - Implementation: @sentry/nextjs v10.36.0
  - DSN: `NEXT_PUBLIC_SENTRY_DSN` environment variable
  - Used in: Error boundaries (`src/app/error.tsx`, `src/app/global-error.tsx`)
  - Webpack plugin: Configured in `next.config.ts`
  - Note: Can alternatively use Sentry directly with `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

**Logs:**
- Pino structured logging (v10.2.1)
  - Implementation: `src/lib/logger/index.ts` with modules in `src/lib/logger/modules.ts`
  - Output: Pretty-printed JSON in development (pino-pretty), compact JSON in production
  - Log levels: Configurable via `LOG_LEVEL` environment variable
  - Format: ISO timestamps, service name, environment metadata
  - Modules: dedicated loggers for apiFootball, db, cache, queue, llm, instrumentation, etc.

**Metrics & Analytics:**
- Umami Analytics
  - Website: Hosted at https://umami.kroam.xyz
  - Website ID: 2e966abd-99fc-4363-8007-3737d99bc4c1
  - Implementation: Client-side script in `src/components/analytics.tsx`
  - Tracks: User visits, page views, events on public site

**Queue Monitoring:**
- Bull Board Web UI
  - Implementation: Express middleware in API route `src/app/api/admin/queues/[[...path]]/route.ts`
  - Accessible at: `/api/admin/queues`
  - Shows: Job status, queue metrics, dead-letter queue

## CI/CD & Deployment

**Hosting:**
- Coolify (recommended in .env.example)
  - Supports: PostgreSQL deployment, Redis deployment, Next.js app deployment
  - Container-friendly: Docker-ready application structure

**CI Pipeline:**
- GitHub Actions (inferred from directory structure, not configured in analyzed files)
- No explicit CI config found in codebase

**Database Migrations:**
- Drizzle Kit
  - Commands: `db:push`, `db:migrate`, `db:generate`
  - Migration files: `drizzle/` directory
  - Schema definition: `src/lib/db/schema.ts`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (must be set at startup)

**Critical optional env vars:**
- `API_FOOTBALL_KEY` - Required if using football data features
- `TOGETHER_API_KEY` - Required if using LLM prediction features
- `REDIS_URL` - Required for job queue and caching (will fail to start without it for queue operations)

**Feature-specific env vars:**
- `CRON_SECRET` - Enables scheduled task endpoints
- `INDEXNOW_KEY` - Enables SEO URL submission
- `NEXT_PUBLIC_SENTRY_DSN` - Enables GlitchTip error tracking
- `NEXT_PUBLIC_APP_URL` - Sets application URL for redirects and headers

**Development env vars:**
- `NODE_ENV` - Set to 'development' or 'production'
- `LOG_LEVEL` - Controls Pino logger verbosity
- `DB_POOL_MAX`, `DB_POOL_MIN` - Connection pool sizing

**Secrets location:**
- Environment variables stored in:
  - `.env.local` (development, not committed)
  - `.env.example` (template, committed)
  - Deployment platform (Coolify or other hosting)

## Webhooks & Callbacks

**Incoming:**
- Cron job endpoints: `src/app/api/cron/*`
  - `/api/cron/generate-content` - Trigger content generation
  - `/api/cron/update-stats` - Trigger stats updates
  - Secured with `CRON_SECRET` header validation

**Outgoing:**
- IndexNow URL pings (non-blocking, informational)
- Sentry/GlitchTip error reports (automatic, from error boundaries)
- No webhook subscriptions to external services detected

---

*Integration audit: 2026-01-31*
