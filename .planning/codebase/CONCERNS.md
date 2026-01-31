# Codebase Concerns

**Analysis Date:** 2026-01-31

## Tech Debt

**Large Monolithic Query Files:**
- Issue: `src/lib/db/queries.ts` is 2094 lines, making it difficult to maintain and test individual query functions
- Files: `src/lib/db/queries.ts`
- Impact: Harder to reason about query logic, increased merge conflict risk, slower IDE performance, difficult to test individual functions
- Fix approach: Split into logical modules: `src/lib/db/queries/matches.ts`, `src/lib/db/queries/predictions.ts`, `src/lib/db/queries/models.ts`, etc. Organize by domain rather than all queries in one file.

**Content Generation Module Complexity:**
- Issue: `src/lib/content/generator.ts` (992 lines) and `src/lib/content/match-content.ts` (484 lines) contain dense validation, deduplication, and generation logic intertwined
- Files: `src/lib/content/generator.ts`, `src/lib/content/match-content.ts`
- Impact: Difficult to debug deduplication issues, validation logic scattered across multiple files, content generation pipeline not clearly defined
- Fix approach: Extract deduplication logic to `src/lib/content/deduplication-service.ts`, extract validation to `src/lib/content/validators.ts`, create a clear pipeline interface in `src/lib/content/pipeline.ts`.

**Mixed Database Connection Handling:**
- Issue: Multiple calls to `getDb()` throughout codebase (130+ occurrences) instead of dependency injection or request-scoped instances
- Files: All files in `src/lib/**/*.ts` that call `getDb()`
- Impact: Difficult to test, hard to implement request-scoped connections for transaction support, makes database layer tightly coupled to all consumers
- Fix approach: Implement repository pattern or pass database instance as parameter to functions requiring it. Consider request-scoped context for Next.js handlers.

**Type Safety Gaps:**
- Issue: 117+ uses of `any` types and unsafe casts (`as any`, `as unknown`) in codebase
- Files: `src/app/api/admin/queues/[[...path]]/route.ts` (uses `any` for Express mock), multiple admin routes
- Impact: Loss of type safety, potential runtime errors, harder to refactor, IDE autocomplete unreliable in these areas
- Fix approach: Create proper Express adapter types, use strict TypeScript mode for new code, gradually migrate existing `any` uses to proper types.

**Missing Environment Variable Validation:**
- Issue: Critical env vars checked at runtime via `process.env.` calls scattered across codebase rather than validated at startup
- Files: `src/lib/env.ts` (partial validation), but many direct `process.env.CRON_SECRET`, `process.env.DATABASE_URL` calls in route handlers
- Impact: Failures can occur after app starts when processing first request requiring that env var, making deployment issues hard to catch
- Fix approach: Import environment vars through centralized `src/lib/env.ts` module that validates at import time. Make `env.ts` the single source of truth.

## Known Bugs

**Unsanitized Local Development Database Credentials:**
- Symptoms: `.env` file contains hardcoded local PostgreSQL credentials (postgres:postgres@localhost)
- Files: `.env`
- Trigger: Any commit that accidentally includes local `.env` values
- Workaround: Use `.env.example` for deployment, never commit real credentials. Current setup exposes local dev DB to git history risk.

**Migration File Naming Collision:**
- Symptoms: Two migration files with number prefix `003_` exist: `003_fix_tendency_constraint.sql` and `003_hotfix_restore_betting_tables.sql`
- Files: `migrations/003_fix_tendency_constraint.sql`, `migrations/003_hotfix_restore_betting_tables.sql`
- Trigger: Running migrations in unclear order could apply wrong schema changes
- Workaround: Rename hotfix file to `003b_` or `004_`, establish clear migration naming convention (YYYY_MM_DD_description.sql or sequential with clear purposes)

**Empty Stub Returns in Query Functions:**
- Symptoms: Multiple query functions return `null`, `[]`, or `{}` when data is not found or errors occur
- Files: `src/lib/db/queries.ts` (lines 432, 1171, 1288, 1343, 1353, 1567, 1974, 2061, 2090)
- Trigger: Missing error handling allows stale/empty data to propagate through application layers
- Workaround: Callers must check for null/empty and handle gracefully. Better to throw errors on critical queries and catch at middleware.

## Security Considerations

**Admin Authentication in Routes:**
- Risk: Admin routes (`src/app/api/admin/*`) use timing-safe comparison for `X-Admin-Password` header but password stored as env var (CRON_SECRET). If compromised, all admin endpoints exposed.
- Files: `src/app/api/admin/queues/[[...path]]/route.ts`, `src/app/api/admin/dlq/route.ts`, `src/app/api/admin/rescore/route.ts`
- Current mitigation: CRON_SECRET passed via environment; rate limiting in place (RATE_LIMIT_PRESETS.admin)
- Recommendations:
  1. Require both authentication header AND API key (defense in depth)
  2. Log all admin API access attempts (successful and failed)
  3. Consider IP allowlisting for admin routes
  4. Rotate CRON_SECRET regularly

**API Key Exposure Risk:**
- Risk: API_FOOTBALL_KEY logged in request logs via `log.info({ url: url.toString() })` which includes all query params
- Files: `src/lib/football/api-client.ts` line 39
- Current mitigation: None (keys could appear in logs)
- Recommendations: Sanitize URLs before logging (remove API keys), use structured logging with separate field for URL without keys

**External Service Dependency on redis/Redis Availability:**
- Risk: Circuit breaker and caching both depend on Redis. If Redis is unavailable, circuit breaker state lost and cache disabled, causing cascading failures
- Files: `src/lib/utils/circuit-breaker.ts`, `src/lib/cache/redis.ts`
- Current mitigation: Graceful fallback to in-memory state; fire-and-forget cache failures
- Recommendations: Implement persistent circuit breaker state (database), add alerts for Redis unavailability, document single points of failure

## Performance Bottlenecks

**Unoptimized Cron Job Patterns:**
- Problem: Multiple repeatable jobs run frequently without load-aware scheduling. Content worker has `concurrency: 1` but other workers may compete for resources.
- Files: `src/lib/queue/setup.ts`, `src/lib/queue/workers/content.worker.ts` (line 96)
- Cause: No adaptive rate limiting based on API limits or database load; jobs run on fixed schedules regardless of backlog
- Improvement path: Implement job priority queue, add exponential backoff for rate-limited APIs, monitor queue depth and adjust concurrency dynamically

**Database Connection Pool Not Configured for Peak Load:**
- Problem: Pool size defaults to min: 2, max: 10 connections. With 6+ concurrent workers and high traffic, pool exhaustion likely.
- Files: `src/lib/db/index.ts` lines 18-19
- Cause: Conservative defaults don't account for concurrent job workers + web requests
- Improvement path: Increase max pool size to 20+ for production, monitor pool utilization, implement connection pooling at Redis layer for queue operations

**Cache Invalidation Using Pattern Matching:**
- Problem: `cacheDeletePattern('db:leaderboard:*')` uses KEYS command which is O(N) and blocks Redis during full scan
- Files: `src/lib/cache/redis.ts` line 283-295, used in `invalidateMatchCaches` line 348
- Cause: After each match settlement, full pattern scan invalidates all leaderboard caches
- Improvement path: Use Redis SCAN instead of KEYS, batch invalidations, or use cache versioning (increment version number instead of deleting keys)

**Content Generation Waits for API Response Serially:**
- Problem: Multiple content sections (pre-match, betting, post-match) generated sequentially, each waiting for Together AI API
- Files: `src/lib/content/match-content.ts`, `src/lib/queue/workers/content.worker.ts`
- Cause: Non-blocking design means failures don't cascade but also means slow generation if APIs are slow
- Improvement path: Parallel generation with Promise.all() for independent sections; implement request batching for multiple matches

## Fragile Areas

**Large Page Component Files:**
- Files: `src/app/matches/[id]/page.tsx` (536 lines), `src/app/leagues/[slug]/[match]/page.tsx` (475 lines), `src/app/models/[id]/page.tsx` (384 lines)
- Why fragile: Mix of data fetching, rendering, and client-side interactivity in single file; hard to test; changes to one section can break others
- Safe modification: Extract data fetching to `src/lib/queries/*`, move UI components to `src/components/*`, keep pages thin as orchestrators
- Test coverage: Limited - primarily visual testing needed; recommend extracting pure components with unit tests

**Leaderboard Table Component:**
- Files: `src/components/leaderboard-table.tsx` (579 lines)
- Why fragile: Complex React table logic with sorting, filtering, pagination inline; TanStack React Table integration could be cleaner
- Safe modification: Create separate context for table state, extract column definitions to constant, ensure prop drilling doesn't get worse
- Test coverage: No unit tests visible; needs RTL tests for sorting/filtering logic

**Match Analysis Validation Function:**
- Files: `src/lib/content/generator.ts` lines 58-200 (validateLeagueRoundupOutput function)
- Why fragile: 140+ lines of validation logic with many nested allowlists and edge cases; easy to miss validation rules when adding new fields
- Safe modification: Convert allowlist arrays to constants or database records, add unit tests for each validation rule
- Test coverage: No test file visible for deduplication/validation module

**Queue Job Retry Logic:**
- Files: `src/lib/queue/workers/backfill.worker.ts` lines 92-106 (removing old jobs before queueing new ones)
- Why fragile: Manually removing jobs by hardcoded ID patterns; if job IDs change, old jobs won't be cleaned up
- Safe modification: Create centralized job ID generator, implement job replacement abstraction instead of manual removals
- Test coverage: No visible tests for backfill worker

## Scaling Limits

**API-Football Rate Limiting:**
- Current capacity: 100 requests/day on free tier; each match analysis needs ~5 API calls (fixture, odds, injuries, predictions, lineups)
- Limit: At 20+ matches/day, API calls exceed free tier limit; paid tier required
- Scaling path: Implement request batching where possible, cache more aggressively, monitor API usage per day, implement daily budget enforcement

**Redis Connection Pooling:**
- Current capacity: Single shared Redis connection for both caching and queues
- Limit: At high concurrency (many workers + requests), single connection may bottleneck; no connection pooling implemented
- Scaling path: Use Redis Cluster or Sentinel for high availability, separate connections for cache vs. queue operations, implement connection pooling at client level

**Database Write Bottleneck on Match Settlement:**
- Current capacity: Single `updatePredictions()` call updates potentially thousands of predictions when a match settles
- Limit: Bulk update becomes slow at scale (1000+ predictions per match), locks table briefly
- Scaling path: Batch writes in chunks, implement asynchronous settlement processing, add database write parallelization

**Worker Concurrency Limits:**
- Current capacity: Content worker concurrency: 1; Fixtures/Live workers: unclear
- Limit: With 100+ scheduled matches/day, single-threaded content generation becomes bottleneck
- Scaling path: Increase content worker concurrency with rate limit tracking, implement worker auto-scaling based on queue depth

## Dependencies at Risk

**Together AI as Sole LLM Provider:**
- Risk: All content generation and model descriptions depend on Together AI; no fallback provider configured
- Impact: If Together service goes down, all content generation stops (model reports, match roundups, previews)
- Migration plan: Implement provider abstraction (`src/lib/llm/providers/base.ts` partially done), add OpenAI fallback support, implement provider health checks and automatic failover

**API-Football Single Point of Failure:**
- Risk: All fixture data, odds, injuries, predictions come from one API provider
- Impact: No data refreshes if API-Football is down; circuit breaker prevents cascading failures but users see stale data
- Migration plan: Difficult to replace - API-Football is the standard in sports data APIs. Implement aggressive caching (24+ hour TTL for non-live data), cache warmup strategy

**PostgreSQL Schema Changes Require Migrations:**
- Risk: Drizzle ORM generates migrations; manual migrations exist but naming collision (003_) shows weak process
- Impact: Failed migrations could corrupt data or lock tables; rollback not automated
- Migration plan: Enforce migration naming convention (YYYYMMDD_description), implement automated rollback testing, document backup procedure before migrations

## Missing Critical Features

**No Request Transaction Support:**
- Problem: Some operations (like prediction scoring) should be atomic across multiple table updates, but current code executes multiple separate queries
- Blocks: Implementing race-condition-free settlement logic, ensuring consistency when multiple processes access same data
- Implementation: Implement transaction support at database layer, wrap critical operations in transaction contexts

**No Duplicate Content Prevention Across Restarts:**
- Problem: Deduplication logic in `src/lib/content/deduplication.ts` runs in-process; if app restarts during content generation, duplicate detection lost
- Blocks: Guaranteeing unique content across deployments, running multiple instances
- Implementation: Store deduplication hashes in database or Redis, check before insertion instead of in-memory only

**No Job Persistence After Queue Clear:**
- Problem: If Redis is cleared accidentally, all queued jobs lost; no backup queue state
- Blocks: Running multiple app instances with queue failover
- Implementation: Snapshot queue state periodically to database, implement queue recovery on startup

## Test Coverage Gaps

**Database Query Module:**
- What's not tested: 2094-line queries.ts file has no visible test file; complex query logic (aggregations, joins, filtering) untested
- Files: `src/lib/db/queries.ts`
- Risk: Queries returning wrong data won't be caught; schema changes break queries silently
- Priority: High - implement unit tests for critical queries (getMatchById, upsertPrediction, getLeaderboard, etc.)

**Content Generation and Deduplication:**
- What's not tested: Content generator validation, deduplication logic, prompt building untested
- Files: `src/lib/content/generator.ts`, `src/lib/content/deduplication.ts`, `src/lib/content/prompts.ts`
- Risk: Generated content could have duplicates, validation rules could fail silently, prompts could have formatting issues
- Priority: High - implement tests for deduplication edge cases, prompt formatting, validation rules

**Worker Job Processing:**
- What's not tested: Queue workers (fixtures, live-score, content, backfill) have no visible tests
- Files: `src/lib/queue/workers/*.ts`
- Risk: Job processing logic could fail in production without early detection; error handling untested
- Priority: High - create mock queue and test job success/failure paths

**API Client Error Handling:**
- What's not tested: API retry logic, circuit breaker, rate limit detection untested
- Files: `src/lib/utils/api-client.ts`, `src/lib/utils/circuit-breaker.ts`
- Risk: Retry logic could fail under specific error conditions, circuit breaker state transitions untested
- Priority: Medium - implement integration tests for API resilience patterns

**Page Components:**
- What's not tested: Large page components (matches, leaderboard, models) have no visible test files
- Files: `src/app/matches/[id]/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/models/[id]/page.tsx`
- Risk: UI rendering bugs, data fetching failures won't be caught
- Priority: Medium - extract pure components and unit test, add visual regression tests

---

*Concerns audit: 2026-01-31*
