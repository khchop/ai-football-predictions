---
phase: 20-league-page-rebuild
plan: 01
completed: 2026-02-03
duration: 3m
subsystem: seo
tags: [seo, schema, metadata, structured-data]
requires:
  - 19 (Blog Page Rebuild - established SEO patterns)
provides:
  - Enhanced SportsOrganization schema builder
  - Dynamic metadata with stats integration
  - OG images with real match data
affects:
  - 20-04 (League page integration will use this foundation)
tech-stack:
  added: []
  patterns:
    - "Dynamic metadata fetching in generateMetadata"
    - "Enhanced schema builders with stats integration"
key-files:
  created: []
  modified:
    - src/lib/seo/schema/competition.ts
    - src/app/leagues/[slug]/page.tsx
decisions:
  - "getCountryFromCompetitionId maps IDs to countries for areaServed"
  - "Stats fallback to static description when finishedMatches is 0"
metrics:
  tasks: 3/3
  commits: 3
---

# Phase 20 Plan 01: SEO Metadata & Schema Enhancement Summary

Enhanced SportsOrganization schema with areaServed, description from stats; dynamic metadata with match counts in titles/descriptions; OG images use real finishedMatches/scheduledMatches.

## What Was Built

### Task 1: Enhanced SportsOrganization Schema Builder
- Created `EnhancedCompetitionData` interface with optional stats
- Added `getCountryFromCompetitionId()` helper mapping competition IDs to countries/regions
- Created `buildEnhancedCompetitionSchema()` returning SportsOrganization with:
  - `sport: "Football"`
  - `areaServed`: country derived from competition ID (e.g., "England" for EPL)
  - `description`: dynamic with match count or static fallback
- Preserved `buildCompetitionSchema()` for backward compatibility

### Task 2: Dynamic generateMetadata
- Fetch competition stats in generateMetadata
- Title format changed: `{shortName} AI Predictions | 35 Models | kroam.xyz`
- Dynamic description includes match count and avg goals when available
- OG image URL uses real `finishedMatches` and `scheduledMatches` instead of zeros
- Expanded keywords array with competition-specific variations

### Task 3: Wire Enhanced Schema to Page
- Fetch stats in LeaguePage component
- Use `buildEnhancedCompetitionSchema()` for JSON-LD
- Schema @graph combines enhanced competition schema with breadcrumbs

## Commits

| Hash | Description |
|------|-------------|
| bae4538 | feat(20-01): enhance SportsOrganization schema builder |
| ab6324f | feat(20-01): enhance generateMetadata with dynamic stats |
| 21c4c1a | feat(20-01): wire enhanced schema to league page component |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. TypeScript compiles without errors (excluding pre-existing test file issues)
2. Build succeeds
3. Schema builder exports both `buildCompetitionSchema` and `buildEnhancedCompetitionSchema`
4. Page uses enhanced schema with areaServed and description properties

## Success Criteria Met

- [x] LEAG-01 (SEO metadata): Title includes "35 Models", description dynamic with stats
- [x] LEAG-02 (Structured data): SportsOrganization enhanced with areaServed, description
- [x] OG images receive real stats (finishedMatches, scheduledMatches) instead of zeros
- [x] Backward compatibility maintained (existing buildCompetitionSchema unchanged)

## Next Phase Readiness

Ready for Plan 20-02 (FAQ Component). The enhanced schema foundation enables:
- FAQ schema can be added to the @graph in Plan 04 integration
- Stats data pattern established for other league page components
