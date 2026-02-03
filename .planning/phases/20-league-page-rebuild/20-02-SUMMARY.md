---
phase: 20
plan: 02
subsystem: league-faq
tags: [faq, geo, schema, seo, component]
dependency-graph:
  requires: [19-02] # FAQ extraction pattern from blog phase
  provides: [generateLeagueFAQs, LeagueFAQ]
  affects: [20-04] # League page integration
tech-stack:
  added: []
  patterns: [native-accordion, schema-injection, sentence-truncation]
key-files:
  created:
    - src/lib/league/generate-league-faqs.ts
    - src/components/league/league-faq.tsx
  modified: []
decisions:
  - id: "20-02-01"
    choice: "Sentence-aware truncation for FAQ answers"
    reason: "Preserves readability at 300 char limit"
metrics:
  duration: "5m"
  completed: "2026-02-03"
---

# Phase 20 Plan 02: League FAQ Component Summary

Dynamic FAQ generation with LeagueFAQ component using native accordion and FAQPage schema injection.

## What Was Built

### 1. FAQ Generation Utility (`src/lib/league/generate-league-faqs.ts`)

Created `generateLeagueFAQs()` function that produces 5 dynamic FAQs from competition data:

```typescript
export interface LeagueFAQData {
  competition: { id: string; name: string };
  stats: { finishedMatches: number; avgGoalsPerMatch: number };
  topModel?: { model: { name: string }; accuracy: number };
}

export function generateLeagueFAQs(data: LeagueFAQData): FAQItem[]
```

**FAQ content (TL;DR first per Phase 19 decision):**
1. What are the AI predictions for {name}? (TL;DR)
2. How accurate are AI predictions for {name}?
3. How many {name} matches have been predicted?
4. When are {name} predictions available?
5. What scoring system is used for {name} predictions?

**Truncation:** Sentence-aware `truncateToSentence()` helper ensures answers stay under 300 chars while preserving complete sentences.

### 2. LeagueFAQ Component (`src/components/league/league-faq.tsx`)

Component mirrors `blog-faq.tsx` exactly for visual consistency:

```typescript
export function LeagueFAQ({ faqs }: { faqs: FAQItem[] })
```

**Features:**
- Native `<details>/<summary>` accordion (no JavaScript)
- Chevron icon with CSS rotation on open
- `FaqSchema` component injection for JSON-LD
- Null guard for empty arrays

## Requirements Coverage

| Requirement | Status | Implementation |
|------------|--------|----------------|
| LEAG-03 (FAQ section) | Ready | Component created, awaits integration |
| GEO optimization | Complete | FAQPage schema via FaqSchema |
| Phase 19 decisions | Honored | TL;DR first, 5 max, 300 char limit |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e22cc6d | feat | Create FAQ generation utility for league pages |
| 35acd19 | feat | Create LeagueFAQ component with schema injection |

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

- 20-04 will integrate `LeagueFAQ` into league page
- Will call `generateLeagueFAQs()` with competition stats data
