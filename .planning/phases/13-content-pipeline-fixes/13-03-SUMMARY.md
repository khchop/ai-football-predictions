---
phase: 13-content-pipeline-fixes
plan: 03
subsystem: content-rendering
tags: [react, match-content, progressive-disclosure, state-logic]

dependency-graph:
  requires:
    - 13-01 # Unified content query (getMatchContentUnified)
    - 13-02 # ReadMoreText component
  provides:
    - State-aware MatchContentSection with proper content visibility
    - ReadMoreText integration for post-match truncation
  affects:
    - 13-04 # Mobile layout optimization (depends on working content)
    - 13-05 # Content backfill verification

tech-stack:
  unchanged: true
  patterns:
    - Match state determines content visibility
    - Server Component with conditional rendering
    - Progressive disclosure via ReadMoreText

key-files:
  modified:
    - src/components/match/MatchContent.tsx
    - src/app/leagues/[slug]/[match]/page.tsx

decisions:
  - id: match-status-nullable
    choice: Handle null matchStatus as 'scheduled' default
    reason: Database schema allows null status, graceful degradation

metrics:
  duration: ~2 min
  completed: 2026-02-02
---

# Phase 13 Plan 03: Match Content State Logic Summary

**One-liner:** MatchContentSection now shows content based on match status - pre-match for scheduled, betting+post-match for live/finished, with ReadMoreText truncation.

## What Was Done

### Task 1: Update MatchContentSection with state logic and ReadMoreText
- Added `matchStatus` prop to `MatchContentSectionProps` interface (accepts `'scheduled' | 'live' | 'finished' | string | null`)
- Imported `ReadMoreText` component from `@/components/match/ReadMoreText`
- Implemented state-based visibility logic:
  - `showPreMatch`: Only for `scheduled` status + content exists
  - `showBetting`: Only for `live` or `finished` status + content exists
  - `showPostMatch`: Only for `finished` status + content exists
- Replaced plain `<p>` with `<ReadMoreText>` for post-match section (6 line preview, 600 char threshold)
- Updated divider logic to only show between visible sections
- Component returns `null` when no applicable content for current match state
- Handled nullable `matchStatus` with fallback to `'scheduled'` behavior

### Task 2: Update match page to pass matchStatus prop
- Updated `<MatchContentSection matchId={matchData.id} />` to include `matchStatus={matchData.status}`
- `matchData.status` comes from existing `getMatchBySlug` query result
- No new data fetching required

## Commits

| Hash | Message |
|------|---------|
| 8952be2 | feat(13-03): add match state logic and ReadMoreText to MatchContentSection |

## Files Changed

| File | Change |
|------|--------|
| src/components/match/MatchContent.tsx | Added matchStatus prop, state-based visibility logic, ReadMoreText integration |
| src/app/leagues/[slug]/[match]/page.tsx | Pass matchStatus prop to MatchContentSection |

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Nullable matchStatus handling | Default to 'scheduled' behavior when null | Database schema allows null status; maintains backward compatibility |
| ReadMoreText previewLines | 6 lines | Matches 13-02 decision (~150-200 words before truncation) |

## Deviations from Plan

**[Rule 1 - Bug] Fixed nullable matchStatus type**
- **Found during:** Task 2 verification
- **Issue:** `matchData.status` can be `string | null` per schema, but prop only accepted `string`
- **Fix:** Extended interface to accept `null`, added null coalescing to default to 'scheduled'
- **Files modified:** src/components/match/MatchContent.tsx
- **Commit:** 8952be2

## Verification

- [x] Build passes: `npm run build` completes successfully
- [x] MatchContentSection accepts matchStatus prop
- [x] Pre-match content logic: shows only for scheduled matches
- [x] Betting content logic: shows for live/finished matches
- [x] Post-match content logic: shows only for finished matches
- [x] ReadMoreText integration: post-match uses progressive disclosure
- [x] Empty state handling: component hides when no applicable content

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- 13-04: Mobile layout can now rely on correct content rendering
- 13-05: Content backfill verification can test all content states
