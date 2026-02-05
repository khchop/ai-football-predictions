---
phase: 42-dynamic-model-counts
plan: 02
subsystem: seo
tags: [seo, metadata, dynamic-content, model-count]

# Dependency graph
requires:
  - phase: 42-01
    provides: getOverallStats().activeModels with cached model count
provides:
  - Dynamic model count in all SEO metadata (titles, descriptions)
  - Dynamic model count in page content (about page, FAQs)
  - Dynamic model count in JSON-LD schema
affects: [43-timeout-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional activeModels parameter with fallback to 35 for backwards compatibility"
    - "Async generateMetadata functions fetching stats"
    - "Parallel Promise.all for stats fetch alongside other page data"

key-files:
  created: []
  modified:
    - src/lib/seo/metadata.ts
    - src/lib/seo/schema/competition.ts
    - src/app/matches/page.tsx
    - src/app/leaderboard/page.tsx
    - src/app/about/page.tsx
    - src/app/blog/page.tsx
    - src/app/blog/[slug]/page.tsx
    - src/app/leagues/[slug]/page.tsx
    - src/app/leagues/[slug]/[match]/page.tsx
    - src/lib/league/generate-league-faqs.ts
    - src/lib/content/match-content.ts
    - src/components/MatchPageSchema.tsx

key-decisions:
  - "Optional activeModels parameter with fallback to 35 for backwards compatibility"
  - "Static metadata converted to async generateMetadata functions"
  - "All pages fetch stats via getOverallStats() which has 60s cache"

patterns-established:
  - "Dynamic model count pattern: fetch getOverallStats(), use stats.activeModels"
  - "Function signatures accept optional activeModels to support callers that haven't updated yet"

# Metrics
duration: 12min
completed: 2026-02-05
---

# Phase 42 Plan 02: Replace Hardcoded Model Count References Summary

**All "35 models" hardcoded references replaced with dynamic getOverallStats().activeModels across SEO metadata, page content, and JSON-LD schema**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-05T18:30:00Z
- **Completed:** 2026-02-05T18:42:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- All SEO metadata functions accept optional `activeModels` parameter
- All page files use async `generateMetadata()` with dynamic count
- About page component fetches and displays dynamic model count
- League FAQ generation uses dynamic count
- Match content FAQ prompts use dynamic count
- MatchPageSchema JSON-LD uses dynamic count
- Zero hardcoded "35 models" references remain in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SEO metadata files with dynamic counts** - `767cb11` (feat)
2. **Task 2: Update page files with dynamic counts** - `b22d5bb` (feat)
3. **Task 3: Update content generation with dynamic counts** - `918f4a2` (feat)

## Files Created/Modified

- `src/lib/seo/metadata.ts` - createDescription, buildMatchMetadata, generateLeaderboardMetadata, generateCompetitionMetadata accept activeModels
- `src/lib/seo/schema/competition.ts` - buildEnhancedCompetitionSchema accepts activeModels in data object
- `src/app/matches/page.tsx` - async generateMetadata fetches activeModels
- `src/app/leaderboard/page.tsx` - async generateMetadata uses dynamic count in title
- `src/app/about/page.tsx` - async page component fetches and displays dynamic count
- `src/app/blog/page.tsx` - async generateMetadata uses dynamic count
- `src/app/blog/[slug]/page.tsx` - OG descriptions use dynamic count
- `src/app/leagues/[slug]/page.tsx` - title, description, FAQs, schema all use dynamic count
- `src/app/leagues/[slug]/[match]/page.tsx` - passes activeModels to MatchPageSchema
- `src/lib/league/generate-league-faqs.ts` - accepts and uses activeModels parameter
- `src/lib/content/match-content.ts` - fetches activeModels for FAQ generation prompts
- `src/components/MatchPageSchema.tsx` - accepts and uses activeModels for schema description

## Decisions Made

- Optional activeModels parameter with fallback to 35 for backwards compatibility (allows incremental caller updates)
- Static metadata objects converted to async generateMetadata functions (required for dynamic data)
- All stats fetches use existing getOverallStats() which has 60s cache (avoids new cache keys)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All pages now display consistent, dynamic model count
- Count updates automatically when models are enabled/disabled (via cache invalidation from 42-01)
- Ready for Phase 43: timeout validation testing

---
*Phase: 42-dynamic-model-counts*
*Completed: 2026-02-05*
