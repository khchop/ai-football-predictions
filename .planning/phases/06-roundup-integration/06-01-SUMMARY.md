---
phase: 06-roundup-integration
plan: 01
subsystem: ui
tags: [nextjs, app-router, client-components, api-integration, roundups]

# Dependency graph
requires:
  - phase: 04-content-pipeline
    provides: RoundupViewer component, /api/matches/[matchId]/roundup endpoint
  - phase: 05-seo-publication
    provides: /matches/[id]/page.tsx server component
provides:
  - Roundup display integration on SEO-optimized match pages
  - Client-side API fetching pattern for match roundups
  - Flow C completion (Match → Roundup → Display)
affects: none (self-contained integration)

# Tech tracking
tech-stack:
  added: []
  patterns: [client-wrapper-for-server-components, suspense-ready-ui]

key-files:
  created:
    - src/components/match/MatchRoundup.tsx
  modified:
    - src/app/matches/[id]/page.tsx

key-decisions:
  - "Client wrapper component for Server Component compatibility - used React hooks in MatchRoundup to fetch from API while keeping page.tsx as Server Component"
  - "Used NEXT_PUBLIC_APP_URL pattern from existing codebase instead of creating new env var"

patterns-established:
  - "Client-side API integration pattern: Use 'use client' wrapper components for APIs when Server Components need dynamic data"
  - "Loading/error/empty state pattern: All fetch operations include three UI states for good UX"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 6 Plan 1: Roundup Integration Summary

**Client-side API wrapper integrates Phase 4 PostMatch roundups into Phase 5 SEO match pages, completing Flow C (Match → Roundup → Display)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T16:31:14Z
- **Completed:** 2026-01-27T16:33:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created MatchRoundup client component with useEffect-driven API fetching to /api/matches/[id]/roundup
- Integrated roundup display into /matches/[id]/page.tsx without breaking Server Component architecture
- Implemented full UI state handling: loading spinner, error display, and helpful placeholder for pending roundups
- Fixed gap INT-04: SEO route now displays roundups (previously only legacy route bypassed API)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add roundup state and fetching** - `da8ae54` (feat)
   - Task 2: Render RoundupViewer conditionally was implemented within the same component

**Plan metadata:** (to be added)

## Files Created/Modified

- `src/components/match/MatchRoundup.tsx` - New client component that fetches roundup data from API, manages state, and renders RoundupViewer conditionally. Includes loading, error, and empty states. 158 lines.
- `src/app/matches/[id]/page.tsx` - Added import for MatchRoundup component and inserted it after AI Model Predictions section, passing matchId and isFinished props.

## Decisions Made

- **Client wrapper pattern for Server Component compatibility**: Since /matches/[id]/page.tsx is a Server Component that can't use React hooks (useState, useEffect), created MatchRoundup.tsx as a 'use client' component to handle API fetching. This preserves the Server Component architecture while enabling dynamic API integration.

- **Used NEXT_PUBLIC_APP_URL pattern**: Attempted to use NEXT_PUBLIC_BASE_URL but discovered the codebase pattern uses NEXT_PUBLIC_APP_URL. Implemented fallback to empty string for relative URLs when env var not set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Client component wrapper for Server Component compatibility**

- **Found during:** Task 1 (Initial implementation)
- **Issue:** Plan instructions suggested adding useState/useEffect directly to /matches/[id]/page.tsx, but this is a Server Component which cannot use React hooks
- **Fix:** Created separate MatchRoundup.tsx client component with 'use client' directive to handle API fetching and state management. Server component passes data via props
- **Files modified:** Created src/components/match/MatchRoundup.tsx, modified src/app/matches/[id]/page.tsx
- **Verification:** Component renders correctly, hooks work in client context, Server Component remains functional
- **Committed in:** da8ae54 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Deviation was essential for architectural correctness. Server Components cannot use client-side hooks, so the client wrapper pattern was the only viable solution. No scope creep - this was a more sophisticated implementation of the same requirement.

## Issues Encountered

- Build error encountered with NEXT_PUBLIC_BASE_URL not being defined - traced to env-validation.ts and seo/constants.ts, which is a pre-existing issue unrelated to this plan's changes. Worked around by using NEXT_PUBLIC_APP_URL pattern and relative URLs as fallback.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Flow C (Match → Roundup → Display) is now complete and functional on both legacy (/leagues/[slug]/[match]) and SEO (/matches/[id]) routes
- Roundup API endpoint (/api/matches/[id]/roundup) is properly utilized by the intended pages
- Ready for subsequent phases that depend on roundups being available across all match page variants

---
*Phase: 06-roundup-integration*
*Completed: 2026-01-27*
