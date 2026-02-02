---
phase: 13-content-pipeline-fixes
plan: 01
subsystem: database
tags: [drizzle, coalesce, sql, content-queries, matchContent, matchRoundups]

# Dependency graph
requires:
  - phase: 04-content-pipeline
    provides: matchContent and matchRoundups tables
provides:
  - getMatchContentUnified() query function with COALESCE logic
  - Updated getMatchContent() using unified query
  - UnifiedMatchContent TypeScript interface
affects: [14-mobile-layout, 16-ai-search]

# Tech tracking
tech-stack:
  added: []
  patterns: [COALESCE-based content merging, fallback query for roundup-only edge case]

key-files:
  created: []
  modified:
    - src/lib/db/queries.ts
    - src/lib/content/queries.ts

key-decisions:
  - "COALESCE prefers roundup narrative over short-form post-match content"
  - "Two-query fallback for roundup-only matches (edge case support)"
  - "Dynamic import in getMatchContent to avoid circular dependencies"

patterns-established:
  - "Unified content query: getMatchContentUnified() merges dual-table content"
  - "Content priority: matchRoundups.narrative > matchContent.postMatchContent"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 13 Plan 01: Unified Content Query Summary

**Unified query combining matchContent and matchRoundups tables with COALESCE prioritizing long-form roundup narratives for post-match display**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T16:47:30Z
- **Completed:** 2026-02-02T16:50:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `getMatchContentUnified()` query that merges content from both tables in single round-trip
- Post-match content now prefers full roundup narrative (1000+ words) over short matchContent summary
- Edge case handling for roundup-only matches (no matchContent row)
- Maintains backward compatibility with existing MatchContentSection component

## Task Commits

Each task was committed atomically:

1. **Task 1: Create getMatchContentUnified() query function** - `f6ea67c` (feat)
2. **Task 2: Update content/queries.ts to use unified query** - `386228a` (feat)

## Files Created/Modified
- `src/lib/db/queries.ts` - Added getMatchContentUnified() function with COALESCE logic, UnifiedMatchContent interface
- `src/lib/content/queries.ts` - Updated getMatchContent() to delegate to unified query

## Decisions Made
- **COALESCE order:** `COALESCE(matchRoundups.narrative, matchContent.postMatchContent)` - roundup always wins if present
- **Two-query approach:** First query joins matchContent LEFT JOIN matchRoundups; if no matchContent exists, second query checks roundup-only edge case
- **Dynamic import:** Used `await import()` in getMatchContent to avoid circular dependency between content/queries and db/queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed research patterns precisely.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Unified content query ready for use in mobile layout optimization (Phase 14)
- `hasFullRoundup` flag available for UI differentiation (e.g., "Full Match Report" label)
- Content queries now return consistent structure regardless of source table

---
*Phase: 13-content-pipeline-fixes*
*Completed: 2026-02-02*
