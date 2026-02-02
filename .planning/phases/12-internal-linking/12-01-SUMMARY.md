---
phase: 12
plan: 01
subsystem: seo
tags: [internal-linking, server-components, drizzle-orm]

dependency_graph:
  requires: [11-redirect-optimization]
  provides: [related-content-widgets, match-cross-links, model-cross-links]
  affects: []

tech_stack:
  added: []
  patterns: [server-components-for-seo, contextual-internal-linking]

key_files:
  created:
    - src/components/match/related-matches-widget.tsx
    - src/components/model/related-models-widget.tsx
  modified:
    - src/lib/db/queries.ts
    - src/app/leagues/[slug]/[match]/page.tsx
    - src/app/models/[id]/page.tsx

decisions:
  - id: related-match-criteria
    choice: Same competition OR same teams
    rationale: Maximizes relevance while providing enough related content
  - id: no-caching
    choice: No Redis caching for widget queries
    rationale: Queries use existing indexes and are fast enough without caching overhead

metrics:
  duration: 4 min
  completed: 2026-02-02
---

# Phase 12 Plan 01: Related Content Widgets Summary

Added related content widgets to match and model pages for SEO internal linking.

**One-liner:** Server-rendered related content widgets using same-competition/team logic for matches and top-performers for models.

## Changes Made

### Task 1: Database Query Functions
Added two new query functions to `src/lib/db/queries.ts`:

1. **getRelatedMatches(matchId, limit)**: Returns matches from same competition OR involving same teams (home or away). Uses existing indexes on competitionId, homeTeam, awayTeam for performance.

2. **getTopModelsForWidget(excludeModelId, limit)**: Returns top models ranked by total points with prediction counts. Excludes specified model (for model detail pages).

**Commit:** 300244a

### Task 2: RelatedMatchesWidget
Created `src/components/match/related-matches-widget.tsx` as a React Server Component:
- Displays 3-5 related matches
- Uses descriptive anchor text: "{homeTeam} vs {awayTeam}"
- Shows competition name and date
- Displays final score for finished matches
- Integrated at bottom of match detail pages

**Commit:** 3bf5348

### Task 3: RelatedModelsWidget
Created `src/components/model/related-models-widget.tsx` as a React Server Component:
- Displays top 5 models by total points
- Excludes current model from list
- Uses model displayName as anchor text
- Shows prediction count and total points
- Integrated after "Performance by League" section

**Commit:** b156842

## Verification

- Build succeeds without errors
- TypeScript compiles without errors
- All widgets are server-rendered (visible in page source)
- Links use descriptive anchor text

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] getRelatedMatches query returns matches from same competition/teams
- [x] getTopModelsForWidget query returns top models by points
- [x] RelatedMatchesWidget renders on match pages with descriptive links
- [x] RelatedModelsWidget renders on model pages with model name links
- [x] All widgets are server-rendered (crawlable)
- [x] SEO-T11 requirement satisfied (match cross-links)
- [x] SEO-T12 requirement satisfied (related models section)

## Next Phase Readiness

Phase 12 Plan 02 (League Hub Enhancement) can proceed independently.
