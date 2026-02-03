---
phase: 21-leaderboard-page-rebuild
plan: 02
subsystem: leaderboard
tags: [faq, seo, schema, geo, dynamic-content]

dependency-graph:
  requires: [21-01] # Time period filtering for FAQ context
  provides: [dynamic-faq-generation, faqpage-schema, trend-explanation]
  affects: [21-03] # Stats and final integration

tech-stack:
  added: []
  patterns: [dynamic-faq-generation, native-accordion]

key-files:
  created:
    - src/lib/leaderboard/generate-leaderboard-faqs.ts
  modified:
    - src/app/leaderboard/page.tsx

decisions:
  - FAQPage schema rendered inside LeaderboardContent (has access to dynamic data)
  - BreadcrumbList schema kept in page wrapper (outside Suspense)
  - Native details/summary for accordion (no JavaScript, accessible by default)
  - FAQ content uses live stats (model count, predictions, top model, accuracy)
  - Trend indicator explanation included in FAQ (references 21-01 feature)

metrics:
  duration: 2m19s
  completed: 2026-02-03
---

# Phase 21 Plan 02: SEO Enhancement Summary

**One-liner:** Dynamic FAQ generator with live leaderboard stats and FAQPage schema for search engine rich snippets.

## What Was Built

### 1. Dynamic FAQ Generator (generate-leaderboard-faqs.ts)
- Created `src/lib/leaderboard/generate-leaderboard-faqs.ts`
- Follows existing pattern from `src/lib/league/generate-league-faqs.ts`
- Generates 5 FAQs optimized for GEO (Generative Engine Optimization)
- TL;DR question always first (AI search citation priority)
- 300-character answer truncation with sentence-aware boundaries

### 2. FAQ Content (Dynamic)
Five FAQ questions covering:
1. **Ranking methodology** - Kicktipp scoring system explanation with live model/prediction counts
2. **Best performing model** - Dynamic top model name, avg points, accuracy
3. **Trend indicators** - Explanation of new arrows feature from 21-01
4. **Time filtering** - Weekly/monthly/all-time filter explanation
5. **Update frequency** - Real-time updates, ISO week/month resets

### 3. FAQPage Schema Integration
- Removed static `leaderboardFaqs` array
- Removed `FaqSchema` component import
- FAQPage schema generated dynamically in `LeaderboardContent`
- Schema includes proper `@context` and `@type` declarations

### 4. Accordion UI (Native)
- Uses native `<details>/<summary>` HTML elements
- No JavaScript required for expand/collapse
- ChevronDown icon with rotation animation on open
- Accessible by default (keyboard navigable)

## Verification Results

- TypeScript compilation: Pass (no errors in leaderboard files)
- Next.js build: Pass (leaderboard page renders)
- FAQ generator exports: `generateLeaderboardFAQs`
- Schema type: FAQPage with 5 Question/Answer pairs

## Deviations from Plan

None - plan executed exactly as written.

## Key Code Patterns

```typescript
// Dynamic FAQ generation with live stats
const faqs = generateLeaderboardFAQs({
  totalModels: leaderboard.length,
  totalPredictions: leaderboard.reduce((sum, e) => sum + e.totalPredictions, 0),
  topModel: leaderboard[0] ? {
    name: leaderboard[0].displayName,
    avgPoints: leaderboard[0].avgPoints,
    accuracy: leaderboard[0].accuracy,
  } : null,
  timePeriod,
});
```

```html
<!-- Native accordion pattern -->
<details className="group">
  <summary className="list-none flex items-center justify-between">
    {faq.question}
    <ChevronDown className="group-open:rotate-180 transition-transform" />
  </summary>
  <p>{faq.answer}</p>
</details>
```

## Files Changed

| File | Change |
|------|--------|
| src/lib/leaderboard/generate-leaderboard-faqs.ts | Created - FAQ generator |
| src/app/leaderboard/page.tsx | Modified - Dynamic FAQs + schema |

## Next Phase Readiness

Plan 21-03 (Stats Enhancement) can proceed:
- FAQ section complete
- Schema integration pattern established
- Page structure ready for additional stats components
