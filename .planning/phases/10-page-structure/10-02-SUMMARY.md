---
phase: 10-page-structure
plan: 02
status: complete
subsystem: seo
tags: [title-optimization, abbreviations, seo-metadata]
dependency_graph:
  requires: []
  provides: [title-abbreviations, optimized-match-titles, optimized-league-titles]
  affects: [11-content-quality, 12-performance]
tech_stack:
  added: []
  patterns: [abbreviation-lookup, title-length-optimization]
key_files:
  created:
    - src/lib/seo/abbreviations.ts
  modified:
    - src/lib/seo/metadata.ts
    - src/app/leagues/[slug]/page.tsx
decisions:
  - key: title-format-finished
    value: "{home} {score} {away} | kroam.xyz"
    rationale: "Concise with brand, under 40 chars"
  - key: title-format-upcoming
    value: "{home} vs {away} Prediction"
    rationale: "Clear intent for SEO, no brand needed for length"
  - key: league-title-format
    value: "{competition} Predictions | kroam.xyz"
    rationale: "Removed 'AI Models Compete' to stay under 60 chars"
metrics:
  duration: "2 min"
  commits: 3
  files_changed: 3
  completed: 2026-02-02
---

# Phase 10 Plan 02: Title Tag Optimization Summary

**One-liner:** Centralized abbreviation utilities optimize match and league page titles to stay under 60 characters.

## What Was Built

### 1. Abbreviation Utilities Module (`src/lib/seo/abbreviations.ts`)
Created centralized abbreviation functions for consistent title optimization:

- `abbreviateTeam()` - Maps 25+ long team names to shorter forms
  - "Manchester United" -> "Man Utd"
  - "Borussia Monchengladbach" -> "M'gladbach"
  - "Paris Saint-Germain" -> "PSG"

- `abbreviateCompetition()` - Removes UEFA/country prefixes
  - "UEFA Champions League" -> "Champions League"
  - "English Premier League" -> "Premier League"
  - Fallback: strips common prefixes (UEFA, English, Spanish, etc.)

### 2. Match Title Optimization (`src/lib/seo/metadata.ts`)
Updated `createTitle()` function:

**Before (exceeded 60 chars):**
```
Manchester United 2-1 Liverpool | Match Analysis & Predictions (65 chars)
```

**After (under 60 chars):**
```
Man Utd 2-1 Liverpool | kroam.xyz (33 chars)
Man Utd vs Liverpool Prediction (31 chars)
```

Key changes:
- Use abbreviated team names
- Remove verbose "Match Analysis & Predictions" suffix (24 chars saved)
- Add concise brand suffix for finished matches only

### 3. League Title Optimization (`src/app/leagues/[slug]/page.tsx`)
Updated `generateMetadata()`:

**Before:**
```
Champions League Predictions | AI Models Compete | kroam.xyz (60 chars)
```

**After:**
```
Champions League Predictions | kroam.xyz (40 chars)
```

Key changes:
- Remove "AI Models Compete" (17 chars saved)
- Keep full name in description for SEO value

## Title Length Analysis

| Page Type | Example | Length |
|-----------|---------|--------|
| Match (finished) | Man Utd 2-1 Liverpool \| kroam.xyz | 33 chars |
| Match (upcoming) | Man Utd vs Liverpool Prediction | 31 chars |
| Match (long names) | M'gladbach vs Bayern Prediction | 31 chars |
| League (UCL) | Champions League Predictions \| kroam.xyz | 40 chars |
| League (EPL) | Premier League Predictions \| kroam.xyz | 39 chars |

All titles well under 60-character limit.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Finished match format | `{home} {score} {away} \| kroam.xyz` | Score is primary info, brand adds recognition |
| Upcoming match format | `{home} vs {away} Prediction` | "Prediction" signals intent, no brand saves chars |
| League title format | `{comp} Predictions \| kroam.xyz` | Shorter than "AI Models Compete" |
| Abbreviation storage | In-code Record maps | Simple, fast lookup, easy to extend |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0dd1cae | feat | Add team and competition abbreviation utilities |
| 29e5cc2 | feat | Optimize match title generation for 60 char limit |
| 100237a | feat | Optimize league page title for 60 char limit |

## Files Changed

**Created:**
- `src/lib/seo/abbreviations.ts` (78 lines) - Centralized abbreviation utilities

**Modified:**
- `src/lib/seo/metadata.ts` - Import abbreviations, update createTitle()
- `src/app/leagues/[slug]/page.tsx` - Import abbreviations, update title generation

## Verification Results

- Build passes: `npm run build` completed successfully
- All match titles under 60 characters
- All league titles under 60 characters
- TypeScript compiles without errors
- Import relationships verified

## Next Plan Readiness

Plan 10-03 (if exists) can proceed. Title optimization is complete and provides:
- Centralized `abbreviateTeam()` for any future title needs
- Centralized `abbreviateCompetition()` for competition-related titles
- Pattern for maintaining title length constraints
