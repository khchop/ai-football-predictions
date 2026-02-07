---
phase: quick-026
plan: 01
subsystem: content-display
tags: [content, match-page, preview, deduplication, coalesce]
dependency-graph:
  requires: []
  provides:
    - "Conditional roundup write preserves model-performance postMatchContent"
    - "COALESCE priority reversed: postMatchContent preferred over roundup narrative"
    - "Content API exposes matchPreviews data for upcoming matches"
    - "MatchNarrative renders structured preview sections"
    - "Duplicate PredictingModelsWidget removed from match page"
  affects: []
tech-stack:
  added: []
  patterns:
    - "CASE WHEN conditional upsert to prevent data overwrite"
    - "dangerouslySetInnerHTML for HTML content rendering with regex detection"
    - "Parallel Promise.all for API data fetching"
key-files:
  created: []
  modified:
    - src/lib/content/generator.ts
    - src/lib/db/queries.ts
    - src/app/api/matches/[id]/content/route.ts
    - src/components/match/match-narrative.tsx
    - src/app/leagues/[slug]/[match]/page.tsx
decisions:
  - "Conditional CASE WHEN guard: roundup only writes postMatchContent when column is NULL, preserving scoring worker's model-performance report"
  - "COALESCE priority reversed: postMatchContent (model perf data) preferred over roundup narrative (generic summary)"
  - "HTML detection via regex for post-match content: roundup writes HTML, scoring worker writes plain text"
metrics:
  duration: "3m"
  completed: "2026-02-07"
---

# Quick 026: Fix Match Report Overwrite & Duplicates Summary

Conditional roundup upsert with reversed COALESCE priority, structured preview rendering, and duplicate widget removal.

## What Was Done

### Task 1: Fix post-match content overwrite and COALESCE priority
**Commit:** `6b26baf`

**Problem:** The `generatePostMatchRoundup` function unconditionally wrote its HTML to `matchContent.postMatchContent`, overwriting the richer model-performance report already written by the scoring worker. The `getMatchContentUnified` query then compounded this by preferring the roundup narrative via COALESCE order.

**Fix:**
- **generator.ts:** Changed the `onConflictDoUpdate` set clause to use `CASE WHEN postMatchContent IS NULL THEN roundupHtml ELSE postMatchContent END`, so the roundup only fills the column when empty
- **queries.ts:** Reversed COALESCE from `COALESCE(matchRoundups.narrative, matchContent.postMatchContent)` to `COALESCE(matchContent.postMatchContent, matchRoundups.narrative)`, preferring the model-performance focused content
- Updated JSDoc and inline comments to reflect new priority logic

### Task 2: Expose match preview data and remove duplicate predictions widget
**Commit:** `7c5d66d`

**Problem:** Upcoming matches showed "Analysis pending" despite having rich preview data in the `matchPreviews` table. The match page also rendered `PredictingModelsWidget` twice (once standalone, once inside `MatchLayout`).

**Fix:**
- **Content API route:** Added parallel fetch of `getMatchPreview` alongside `getMatchContentUnified`, returning structured preview fields (introduction, teamFormAnalysis, headToHead, keyPlayers, tacticalAnalysis, prediction, bettingInsights)
- **MatchNarrative component:** Complete rewrite of rendering logic:
  - Finished matches: renders postMatchContent with HTML detection (dangerouslySetInnerHTML for HTML, plain text otherwise)
  - Upcoming/Live: renders structured preview sections with h3 headings, conditional rendering for nullable fields
  - Fallback: plain preMatchContent text, then "Analysis pending" placeholder
- **Match page:** Removed duplicate `PredictingModelsWidget` Suspense block, plus unused `Suspense`, `Skeleton`, and `PredictingModelsWidget` imports

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Fix post-match content overwrite and COALESCE priority | `6b26baf` | generator.ts, queries.ts |
| 2 | Expose match preview data and remove duplicate widget | `7c5d66d` | route.ts, match-narrative.tsx, page.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. Build compiles without errors (pre-existing TS error in scripts/generate-golden-fixtures.ts is unrelated)
2. No `PredictingModelsWidget` references in match page.tsx
3. COALESCE shows `matchContent.postMatchContent` before `matchRoundups.narrative`
4. Conditional `IS NULL` guard present in generator.ts
5. `getMatchPreview` imported and used in content API route

## Self-Check: PASSED
