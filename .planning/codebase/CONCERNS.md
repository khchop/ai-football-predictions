# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

### Large Files Requiring Refactoring

**`src/lib/db/queries.ts` (2048 lines)**
- Issue: File exceeds 1000+ lines, making it difficult to maintain and navigate
- Impact: Complex to understand, test, and modify individual query functions
- Fix approach: Split into multiple files by domain (competitions, matches, models, predictions, content)
- Priority: High

**`src/lib/football/match-analysis.ts` (740 lines)**
- Issue: Contains multiple responsibilities (odds validation, prediction fetching, injury fetching, data extraction)
- Impact: Hard to test individual functions, high cognitive load
- Fix approach: Extract odds validation, extraction logic, and API wrappers into separate modules
- Priority: Medium

**`src/lib/content/queries.ts` (691 lines)**
- Issue: Large content query file with complex joins
- Impact: Difficult to modify content-related queries
- Fix approach: Split by query type (previews, roundups, reports)
- Priority: Medium

**`src/app/matches/[id]/page.tsx` (522 lines)**
- Issue: Page component too large, handles data fetching, UI rendering, and error states
- Impact: Hard to read and modify
- Fix approach: Extract data fetching to separate hooks, UI components to separate files
- Priority: Medium

### Type Safety Issues

**Widespread `as` Type Assertions (100+ occurrences)**
- Files: `src/lib/content/generator.ts`, `src/lib/football/match-analysis.ts`, various components
- Issue: Code uses unsafe type assertions instead of proper type guards or validation
- Examples:
  - `matchData.analysis?.homeWinPct as number | undefined`
  - `return { response: [], results: 0 } as unknown as APIFootballResponse`
  - `(aVal as number) - (bVal as number)`
- Impact: Runtime errors possible if types don't match expectations
- Fix approach: Use proper type guards, Zod validation, or explicit type conversions
- Priority: High

**`any` Type Usage**
- Found approximately 102 occurrences of `any`, `as any`, or `as unknown`
- Location: Components, API routes, validation logic
- Impact: Defeats TypeScript's type checking benefits
- Fix approach: Replace with specific types or unknown with proper handling
- Priority: High

### Legacy Code

**`src/lib/db/queries.ts:11-12`**
- Issue: Commented legacy betting constant still present
- Code: `// Legacy betting system constant (unused, kept for model_balances table compatibility)` and `const LEGACY_STARTING_BALANCE = 1000;`
- Impact: Confusing for new developers, dead code
- Fix approach: Remove if truly unused, or document why kept
- Priority: Low

### Inconsistent Error Handling Patterns

**Mixed Console and Logger Usage**
- Files: Various API routes (`src/app/api/admin/*/route.ts`)
- Issue: Some error handlers use `console.error()`, others use structured logging
- Examples:
  - `src/app/api/admin/trigger-roundups/route.ts:106` - uses `console.error`
  - `src/app/api/admin/rescore/route.ts:71` - console usage
- Impact: Inconsistent log output, harder to debug
- Fix approach: Standardize on structured logging via `loggers` throughout
- Priority: Medium

## Known Bugs and Issues

### Potential Silent Failures

**API Error Swallowing**
- File: `src/lib/football/api-client.ts:160-163`
- Code:
  ```typescript
  } catch (error) {
    log.error({ fixtureId, error }, 'Error fetching prediction');
    return null;
  }
  ```
- Issue: API errors are caught and logged but return null silently
- Impact: Callers may not distinguish between "no data" and "API error"
- Fix approach: Create typed error return or throw specific exceptions
- Priority: High

**Cache Null Sentinel Issues**
- File: `src/lib/cache/redis.ts`
- Issue: Uses `CACHE_NULL_SENTINEL` string to distinguish cached null from cache miss
- Risk: If cached value equals sentinel string exactly, incorrect behavior
- Fix approach: Use more robust serialization (JSON with metadata) or Redis specific features
- Priority: Low

### Race Conditions

**Redis Connection Singleton**
- File: `src/lib/cache/redis.ts:25-77`
- Issue: Redis client is lazily initialized but cached globally
- Risk: In serverless/edge environments, connection may be reused incorrectly
- Impact: Potential memory leaks or stale connections
- Fix approach: Implement proper connection pooling or per-request connections
- Priority: Medium

**Queue Connection Tracking**
- File: `src/lib/queue/index.ts:35-37`
- Issue: `connection` and `connectionHealthy` are module-level singletons
- Risk: In development hot-reload, state may persist incorrectly
- Impact: Queue operations may fail silently
- Fix approach: Implement connection health checks before each operation
- Priority: Medium

## Security Considerations

### CORS Configuration

**File: `src/middleware.ts:92-110`**
- Risk: `isAllowedOrigin` checks against `NEXT_PUBLIC_BASE_URL` which could be misconfigured
- Current: Only allows same-origin and configured base URL
- Improvement: Add explicit allowlist for known domains, especially for production
- Priority: Medium

### Admin Route Authentication

**File: `src/app/api/admin/trigger-roundups/route.ts:18-21`**
- Risk: Simple secret check in query parameter
- Code: `if (process.env.CRON_SECRET !== secret)`
- Concern: Secret exposed in URLs (may be logged by proxies, browsers)
- Fix approach: Use header-based authentication (`X-Cron-Secret`) as done in cron routes
- Priority: High

**File: `src/lib/auth/cron-auth.ts`**
- Positive: Properly implemented header-based authentication for cron routes
- Note: Admin routes should follow same pattern
- Priority: Medium

### XSS Potential

**dangerouslySetInnerHTML Usage**
- Files: `src/app/blog/[slug]/page.tsx`, `src/app/layout.tsx`, various schema components
- Usage: `dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}`
- Concern: While currently safe (JSON.stringify escapes properly), pattern is fragile
- Mitigation: Ensure schema data is always validated before rendering
- Priority: Low (currently safe but needs awareness)

### Environment Variable Exposure

**Server-Only Env Vars**
- Files: Multiple (`src/lib/football/api-client.ts`, `src/lib/llm/providers/together.ts`, etc.)
- Concern: API keys accessed via `process.env` throughout codebase
- Current: Properly handled by Next.js (server components only)
- Risk: If code moves to client components accidentally, keys could leak
- Fix approach: Add linting rule to prevent `process.env` in client code
- Priority: Medium

## Performance Bottlenecks

### Large Query Files

**`src/lib/db/queries.ts`**
- Issue: 2048 lines of queries without clear organization
- Performance: Complex queries may not be optimized
- Fix approach: Add query performance monitoring, optimize with proper indexes
- Priority: Medium

### Redis Health Check Cooldown

**File: `src/lib/cache/redis.ts:82-111`**
- Issue: Health checks use adaptive cooldown (5-30 seconds)
- Risk: In degraded state, 5-second cooldown may still be too slow for recovery detection
- Impact: Temporary Redis failures may take several seconds to recover
- Fix approach: Consider exponential backoff for health checks during degraded state
- Priority: Low

### Content Generation Concurrency

**File: `src/lib/queue/workers/content.worker.ts:90`**
- Setting: `concurrency: 1`
- Impact: Only one content generation at a time, may be slow
- Current: Intentionally set to avoid rate limits
- Consideration: Could increase with better rate limiting per provider
- Priority: Low

## Dependency Risks

### Outdated or Risky Dependencies

**Note: Package versions from package.json analysis**
- `next: ^16.1.4` - Very new version (Next.js 16 just released), potential instability
- `react: 19.2.3` - React 19 is very new, may have compatibility issues
- `drizzle-orm: ^0.45.1` - Major version 0.x, API may change
- `express: ^5.2.1` - Express 5 is new (beta/RC), breaking changes from v4

**Risk Assessment:**
- Priority: Monitor for updates and breaking changes
- Fix approach: Pin to specific versions, test thoroughly on updates
- Priority: Medium

### Missing Lockfile Analysis

**Concern:** Unable to verify lockfile presence
- Impact: Different environments may use different dependency versions
- Fix approach: Ensure `package-lock.json` or `yarn.lock` is committed
- Priority: High

## Code Quality Issues

### Missing Test Coverage

**Test Framework Status: NOT CONFIGURED**
- No test framework detected (no `jest.config.ts`, `vitest.config.ts`, or test files)
- Impact: No automated testing, regressions may go undetected
- Fix approach: Configure Vitest (recommended for Next.js), add unit and integration tests
- Priority: High

### TODO/FIXME Markers Found

**Files with pending work:**
- `src/lib/queue/scheduler.ts` - Various scheduling logic may need review
- Multiple API routes - Comments suggest areas for improvement
- Priority: Medium

### Inconsistent Import Patterns

**Observation:** Some files use `import { x } from 'module'` while others use different patterns
- Impact: Minor, but reduces code readability
- Fix approach: Enforce import order via ESLint
- Priority: Low

## Missing Features / Incomplete Implementations

### OpenAI/Anthropic Providers Stubbed

**File: `.env.example`**
- Issue: OpenAI and Anthropic API keys are commented out
- `src/lib/llm/providers/` - Only Together AI provider fully implemented
- Impact: Premium models not available without implementation
- Fix approach: Implement OpenAI and Anthropic providers following Together AI pattern
- Priority: Low (feature gap, not bug)

### No Rate Limit Visualization

**Concern:** Budget control exists (`DAILY_BUDGET`) but no UI to monitor usage
- Impact: Administrators cannot easily see current spending
- Fix approach: Add admin dashboard showing daily/weekly usage
- Priority: Medium

## Deprecated Patterns

### p-limit Usage Without Cleanup

**File: `src/lib/football/match-analysis.ts:27`**
- Code: `import pLimit from 'p-limit'`
- Usage: May not properly clean up limiters after use
- Impact: Resource leaks in long-running processes
- Fix approach: Ensure p-limit instances are properly managed
- Priority: Low

## Fragile Areas

### Circuit Breaker Implementation

**File: `src/lib/utils/circuit-breaker.ts`**
- Concern: Complex state machine for failure handling
- Risk: May not handle all edge cases properly
- Fix approach: Add comprehensive tests, consider using established library
- Priority: Medium

### Match Content Generation

**File: `src/lib/content/match-content.ts`**
- Issue: Multiple database calls within single function
- Risk: Incomplete transactions if failure occurs mid-process
- Fix approach: Wrap in transactions, implement idempotency
- Priority: High

## Scalability Limitations

### Single Redis Instance

**Architecture:** Redis used for both caching and queues
- Risk: Cache eviction may impact queue performance
- Impact: Under high load, cache and queues compete for resources
- Fix approach: Consider separate Redis instances for cache and queues
- Priority: Low (early-stage application)

### No Horizontal Scaling Preparation

**Current:** Application designed for single instance
- Risk: Not prepared for deployment to multiple replicas
- Fix approach: Implement distributed locking, ensure idempotent operations
- Priority: Low (not yet needed)

## Documentation Gaps

### Missing Inline Documentation

**Files needing docs:**
- `src/lib/db/queries.ts` - Complex queries need comments
- `src/lib/football/match-analysis.ts` - Extraction logic unclear
- Various worker files - Job processing logic undocumented
- Priority: Medium

### No Architecture Documentation

**Missing:**
- High-level system architecture diagram
- Data flow documentation
- Deployment guide
- Priority: Medium

---

*Concerns audit: 2026-01-27*
