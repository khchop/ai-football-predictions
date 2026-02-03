---
phase: 28
plan: 01
subsystem: match-display
tags: [react, context, api-routes, state-aware]
dependency-graph:
  requires:
    - 26-01 (MatchDataProvider context foundation)
  provides:
    - MatchNarrative component for state-aware narrative display
    - /api/matches/[id]/content endpoint for narrative fetching
  affects:
    - 28-02+ (predictions table and other content sections)
    - 29+ (page integration phases)
tech-stack:
  added: []
  patterns:
    - Context consumption with useMatch() hook
    - Client-side data fetching with useEffect/useState
    - State-aware conditional rendering
key-files:
  created:
    - src/components/match/match-narrative.tsx
    - src/app/api/matches/[id]/content/route.ts
  modified: []
decisions:
  - NAR-001: Use client-side fetch for narrative content (keeps component simple, context provides matchState)
  - NAR-002: Unified heading logic (live + upcoming both show "Match Preview", finished shows "Match Report")
metrics:
  duration: ~2 minutes
  completed: 2026-02-03
---

# Phase 28 Plan 01: MatchNarrative Component Summary

State-aware narrative display component using MatchDataProvider context, with dedicated API endpoint for content fetching.

## What Was Built

### MatchNarrative Component (`src/components/match/match-narrative.tsx`)

Client component that:
- Consumes match data via `useMatch()` hook from MatchDataProvider
- Fetches narrative content from `/api/matches/[id]/content` endpoint
- Displays appropriate narrative based on `matchState`:
  - **Upcoming/Live**: preMatchContent with "Match Preview" heading
  - **Finished**: postMatchContent with "Match Report" heading
- Shows loading skeleton during fetch
- Shows placeholder message ("Analysis pending - check back closer to kickoff") when no content

### Content API Route (`src/app/api/matches/[id]/content/route.ts`)

API endpoint that:
- Uses existing `getMatchContentUnified()` query from lib/db/queries
- Returns `{ preMatchContent, postMatchContent }` JSON
- Returns null values (not 404) when content doesn't exist
- Handles errors gracefully with 500 response

## Key Design Decisions

1. **Client-side fetch pattern**: Component fetches its own content rather than receiving via props. This keeps the component self-contained and works with the context architecture.

2. **Same styling, different headings**: Per user context, pre-match and post-match narratives use identical visual styling. Only the heading changes ("Match Preview" vs "Match Report").

3. **Live shows pre-match**: During live matches, the pre-match narrative remains visible (user decision from 28-CONTEXT.md).

4. **Graceful degradation**: Missing content shows a user-friendly placeholder rather than hiding the section entirely.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| c24a914 | feat | Add MatchNarrative component |
| 67476b8 | feat | Add content API route for match narratives |

## Verification Results

- [x] MatchNarrative component exists at `src/components/match/match-narrative.tsx`
- [x] Component uses `useMatch()` hook for context consumption
- [x] API route exists at `src/app/api/matches/[id]/content/route.ts`
- [x] TypeScript compiles without errors (in new files)
- [x] Component exports `MatchNarrative` function
- [x] State-specific headings implemented

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 28-02 (PredictionsTable with sortable columns) - MatchNarrative can be used alongside other content sections.

---

*Phase 28-content-sections | Plan 01 | Completed 2026-02-03*
