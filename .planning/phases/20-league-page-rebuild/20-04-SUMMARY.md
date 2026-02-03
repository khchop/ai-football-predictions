---
phase: 20-league-page-rebuild
plan: 04
subsystem: league-pages
tags: [faq, trends, schema, integration]

dependency-graph:
  requires: ["20-01", "20-02", "20-03"]
  provides: ["league-page-integration", "combined-schema-graph"]
  affects: ["21-leaderboard-page-rebuild"]

tech-stack:
  added: []
  patterns: ["combined-schema-graph", "parallel-data-fetching"]

key-files:
  created: []
  modified:
    - src/app/leagues/[slug]/page.tsx
    - src/app/leagues/[slug]/league-hub-content.tsx

decisions:
  - id: parallel-faq-generation
    choice: "Duplicate FAQ generation in page.tsx and league-hub-content.tsx"
    rationale: "page.tsx needs FAQs for schema, hub-content needs for rendering. Next.js request deduplication handles duplicate queries"

metrics:
  duration: "3 minutes"
  completed: "2026-02-03"
---

# Phase 20 Plan 04: League Page Integration Summary

## One-liner

Integrated FAQ section and trend chart into league page with combined @graph schema (SportsOrganization + BreadcrumbList + FAQPage).

## What Was Done

### Task 1: Integrate FAQ and Trends into LeagueHubContent
- Added imports for LeagueFAQ, LeagueTrendChart, generateLeagueFAQs, getLeagueTrends
- Extended Promise.all to fetch trends in parallel with existing 5 data sources (6 total)
- Added trend chart card in stats dashboard (right column, after CompetitionStats)
- Added LeagueFAQ section at bottom of LeagueInsights component
- Removed unused CompetitionBadge import

### Task 2: Add FAQPage Schema to Combined @graph
- Added generateFAQPageSchema and generateLeagueFAQs imports to page.tsx
- Added getTopModelsByCompetition to parallel fetch with stats
- Generated FAQs using same logic as LeagueHubContent for consistency
- Added faqSchema to @graph array (3 items total)
- Removed unused COMPETITIONS import

### Task 3: Final Verification
- Build succeeds with `npm run build`
- TypeScript check passes for league page files (pre-existing test file errors unrelated)
- Verified parallel fetching in both files (no await waterfall)

## Files Modified

| File | Changes |
|------|---------|
| `src/app/leagues/[slug]/page.tsx` | Added FAQ schema imports, parallel top model fetch, FAQPage in @graph |
| `src/app/leagues/[slug]/league-hub-content.tsx` | Added FAQ/trend imports, trend fetch, trend chart UI, FAQ section |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ce46fa8 | feat | Integrate FAQ and trends into league hub content |
| a419bca | feat | Add FAQPage schema to combined @graph |

## Technical Details

### Data Fetching Pattern (league-hub-content.tsx)
```typescript
const [topModels, stats, predictionSummary, nextMatch, matches, trends] = await Promise.all([
  getTopModelsByCompetition(competitionId, 5),
  getCompetitionStats(competitionId),
  getCompetitionPredictionSummary(competitionId),
  getNextMatchForCompetition(competitionId),
  getMatchesByCompetitionId(competitionId, 1),
  getLeagueTrends(competitionId, 8),
]);
```

### Combined Schema Pattern (page.tsx)
```typescript
const schema = {
  '@context': 'https://schema.org',
  '@graph': [competitionSchema, breadcrumbs, faqSchema],
};
```

### Type Mapping for FAQ Generation
The `topModels[0]` has `model.displayName` but `generateLeagueFAQs` expects `model.name`:
```typescript
topModel: topModel ? {
  model: { name: topModel.model.displayName },
  accuracy: topModel.accuracy,
} : undefined,
```

## LEAG Requirements Status

| ID | Requirement | Status |
|----|-------------|--------|
| LEAG-01 | Dynamic SEO metadata with stats | Complete (20-01) |
| LEAG-02 | Enhanced SportsOrganization schema | Complete (20-01) |
| LEAG-03 | FAQ section with FAQPage schema | Complete (20-02 + 20-04) |
| LEAG-04 | Stats dashboard complete | Complete (existing + 20-04 trends) |
| LEAG-05 | Historical trend visualization | Complete (20-03 + 20-04) |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 20 (League Page Rebuild) is complete. All 5 LEAG requirements satisfied.

Ready to proceed with Phase 21 (Leaderboard Page Rebuild).
