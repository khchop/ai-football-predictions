---
phase: 44-foundation-redirects-canonicals-index-pages
plan: 02
subsystem: routing
tags: [middleware, redirects, seo, crawl-budget, edge-runtime]

# Dependency graph
requires:
  - phase: 44-01
    provides: Canonical URLs and hreflang cleanup
provides:
  - Single-hop 301 redirects for www and HTTP
  - 410 Gone responses for removed /matches/UUID paths
  - League slug redirects in middleware (single-hop with www/http)
  - Consolidated redirect logic in Edge Runtime
affects: [44-03, 44-04, 44-05, all future routing changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Single-hop redirect resolution in middleware
    - Edge Runtime x-forwarded-proto detection
    - Cache-Control headers on permanent redirects

key-files:
  created: []
  modified:
    - src/middleware.ts
    - next.config.ts

key-decisions:
  - "Consolidated all redirects in middleware for single-hop resolution"
  - "Use x-forwarded-proto header for HTTP detection in Edge Runtime"
  - "Return 410 Gone (not 404) for permanently removed /matches/UUID"
  - "Cache redirect responses for 1 year (max-age=31536000)"

patterns-established:
  - "Redirect detection in single pass (www + http + league slug)"
  - "Canonical URL computation before redirect (prevents chains)"
  - "CORS logic preserved and applied only to API routes"

# Metrics
duration: 2m 19s
completed: 2026-02-06
---

# Phase 44 Plan 02: Redirect Consolidation Summary

**Single-hop 301 redirects with 410 Gone handling in Edge Runtime middleware, eliminating redirect chains that waste crawl budget and link equity**

## Performance

- **Duration:** 2 min 19 sec
- **Started:** 2026-02-06T08:41:06Z
- **Completed:** 2026-02-06T08:43:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Consolidated all redirect logic in middleware for single-hop resolution
- Added 410 Gone responses for permanently removed /matches/UUID paths
- Eliminated redirect chains by computing canonical URLs before redirecting
- Preserved CORS and body-size logic for API routes
- Added cache headers to redirect responses (1 year TTL)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite middleware with redirect logic and 410 Gone** - `d9fe717` (feat)
2. **Task 2: Remove league slug redirects from next.config.ts** - `41c85bf` (refactor)

## Files Created/Modified
- `src/middleware.ts` - Added www/http redirect detection, league slug redirects, 410 Gone handling, single-hop canonical URL computation
- `next.config.ts` - Removed league slug redirects (now handled in middleware)

## Decisions Made

**1. Consolidated all redirects in middleware**
- Rationale: Enables single-hop resolution for www + http + league slug scenarios
- Example: www.kroam.xyz/leagues/premier-league → https://kroam.xyz/leagues/epl (one hop)
- Alternative rejected: Keep redirects() in next.config.ts (causes chains)

**2. Use x-forwarded-proto header for HTTP detection**
- Rationale: Edge Runtime may not reliably detect protocol from url.protocol
- Implementation: Check `x-forwarded-proto` header first, fallback to url.protocol

**3. Return 410 Gone (not 404) for /matches/UUID**
- Rationale: 410 signals "permanently removed" to search engines
- SEO impact: Faster removal from index than 404
- Implementation: Check pathname.startsWith('/matches/') before any redirect logic

**4. Cache redirect responses for 1 year**
- Rationale: 301 redirects are permanent, safe to cache long-term
- Implementation: `Cache-Control: public, max-age=31536000` on redirect responses
- Benefit: Reduces server load, faster redirects for repeat visitors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks executed successfully, build passed with expected warnings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 44-03 (league index page) and 44-04 (robots.txt cleanup).

Key capabilities now available:
- All redirect scenarios resolve in single hop
- Permanently removed paths return 410 Gone
- CORS preserved for API routes
- Matcher covers all routes except static assets

No blockers or concerns.

## Self-Check: PASSED

All files exist:
- src/middleware.ts ✓
- next.config.ts ✓

All commits exist:
- d9fe717 ✓
- 41c85bf ✓

---
*Phase: 44-foundation-redirects-canonicals-index-pages*
*Completed: 2026-02-06*
