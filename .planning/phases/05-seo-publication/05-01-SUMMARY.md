---
phase: 05-seo-publication
plan: '01'
subsystem: seo
tags: [seo, metadata, open-graph, json-ld, schema-org, nextjs]

# Dependency graph
requires:
  - phase: 04-content-pipeline
    provides: Match pages and roundup content for schema injection
provides:
  - SEO utility layer with 7 utility files
  - Metadata builders for all match states
  - JSON-LD schema builders (SportsEvent, Article, Graph)
  - OG image templates for upcoming/live/finished states
affects:
  - phase: 05-02 (Match page SEO integration)
  - phase: 05-03 (Leaderboard SEO)
  - phase: 05-04 (Sitemap generation)

# Tech tracking
tech-stack:
  added: [schema-dts]
  patterns:
    - Next.js 16 Metadata API for SEO tags
    - JSON-LD @graph pattern for combining multiple schemas
    - Template-based OG image generation
    - State-specific metadata (upcoming/live/finished)

key-files:
  created:
    - src/lib/seo/constants.ts - BASE_URL, MatchStatus, OG_IMAGE_SIZE
    - src/lib/seo/types.ts - MatchSeoData interface, type exports
    - src/lib/seo/metadata.ts - Metadata builders (title, description, full metadata)
    - src/lib/seo/schema/sports-event.ts - SportsEvent JSON-LD builder
    - src/lib/seo/schema/article.ts - NewsArticle JSON-LD builder
    - src/lib/seo/schema/graph.ts - @graph combiner with sanitizeJsonLd
    - src/lib/seo/og/templates.ts - OG template configs for 3 states

key-decisions:
  - Used schema-dts for type-safe JSON-LD construction
  - Implemented state-specific descriptions (upcoming/live/finished)
  - Used @id linking pattern for schema entity references

patterns-established:
  - Pattern: Metadata builder functions with MatchSeoData interface
  - Pattern: JSON-LD schema builders with @graph composition
  - Pattern: Template-based OG image configuration

# Metrics
duration: 25 min
completed: 2026-01-27
---

# Phase 5 Plan 1: SEO Utility Layer Summary

**SEO utility layer with metadata builders, JSON-LD schema builders, and OG image templates for dynamic match pages**

## Performance

- **Duration:** 25 min
- **Started:** 2026-01-27T14:32:35Z
- **Completed:** 2026-01-27T14:57:50Z
- **Tasks:** 4/4 complete
- **Files modified:** 8

## Accomplishments

- Created SEO constants (BASE_URL, MatchStatus enum, OG_IMAGE_SIZE) with environment validation
- Implemented MatchSeoData interface mapping database matches to SEO requirements
- Built metadata builders for dynamic titles/descriptions with state-specific content
- Created SportsEvent JSON-LD schema with @id linking for teams
- Built NewsArticle schema for match pages
- Combined all schemas in @graph structure for Google Rich Results
- Implemented OG template configuration for upcoming/live/finished states

## Task Commits

1. **Task 1: Create SEO constants and types** - `5556f3c` (feat)
2. **Task 2: Create metadata builders** - `fc19dc7` (feat)
3. **Task 3: Create JSON-LD schema builders** - `09945bd` (feat)
4. **Task 4: Create OG image templates** - `6d89732` (feat)

**Plan metadata:** Next commit (docs)

## Files Created/Modified

- `src/lib/seo/constants.ts` - SEO constants (BASE_URL, MatchStatus, OG_IMAGE_SIZE)
- `src/lib/seo/types.ts` - MatchSeoData interface and type exports
- `src/lib/seo/metadata.ts` - Metadata builders (createTitle, createDescription, buildMatchMetadata)
- `src/lib/seo/schema/sports-event.ts` - SportsEvent JSON-LD builder
- `src/lib/seo/schema/article.ts` - NewsArticle JSON-LD builder  
- `src/lib/seo/schema/graph.ts` - @graph combiner with sanitizeJsonLd
- `src/lib/seo/og/templates.ts` - OG template configs for upcoming/live/finished
- `package.json` - Added schema-dts dependency

## Decisions Made

- **schema-dts for type-safe JSON-LD:** Chose schema-dts for TypeScript support when building JSON-LD structures, enabling compile-time validation of schema.org types
- **State-specific metadata:** Implemented separate title/description logic for upcoming/live/finished states to provide contextually relevant SEO content
- **@id linking pattern:** Used schema.org @id references for team entities, allowing Google to connect SportsEvent to the referenced teams

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEO utility layer complete and ready for plan 05-02
- All utilities accept MatchSeoData interface which maps from database Match type
- Metadata builders handle all 3 match states with appropriate titles/descriptions
- Schema builders produce @graph with SportsEvent + Article + Organization
- OG templates defined for all match states with appropriate styling

---

*Phase: 05-seo-publication*
*Completed: 2026-01-27*