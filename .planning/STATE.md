# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** v2.6 SEO/GEO Site Health

## Current Position

Phase: 45 — Sitemap & Internal Linking
Plan: 3 of 3 complete
Status: Phase complete
Last activity: 2026-02-06 — Completed 45-03-PLAN.md (Match-to-Model Cross-Links)

Progress: [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 22% (phase 45 complete)

## Milestone History

| Milestone | Phases | Plans | Requirements | Shipped |
|-----------|--------|-------|--------------|---------|
| v1.0 Bug Fix Stabilization | 1-4 | 14 | 18 | 2026-02-01 |
| v1.1 Stats Accuracy & SEO | 5-8 | 10 | 19 | 2026-02-02 |
| v1.2 Technical SEO Fixes | 9-12 | 9 | 13 | 2026-02-02 |
| v1.3 Match Page Refresh | 13-16 | 13 | 18 | 2026-02-02 |
| v2.0 UI/UX Overhaul | 17-23 | 28 | 33 | 2026-02-03 |
| v2.1 Match Page Simplification | 24-25 | 3 | 9 | 2026-02-03 |
| v2.2 Match Page Rewrite | 26-30 | 17 | 21 | 2026-02-04 |
| v2.3 Content Pipeline & SEO | 31-36 | 13 | 24 | 2026-02-04 |
| v2.4 Synthetic.new Integration | 37-39 | 7 | 17 | 2026-02-05 |
| v2.5 Model Reliability | 40-43 | 11 | 36 | 2026-02-05 |

**Total shipped:** 44 phases, 128 plans, 219 requirements

## Accumulated Context

### Decisions

All decisions archived in milestone files. See `.planning/milestones/` for history.

**Phase 44 (v2.6):**
- 44-01: Removed all hreflang tags - no i18n subdomain support
- 44-01: Match pages use /leagues/{slug}/{match} as canonical (not /matches/{id})
- 44-01: Root layout provides only metadataBase, no cascading canonical
- 44-02: Consolidated all redirects in middleware for single-hop resolution
- 44-02: Use x-forwarded-proto header for HTTP detection in Edge Runtime
- 44-02: Return 410 Gone (not 404) for permanently removed /matches/UUID
- 44-02: Cache redirect responses for 1 year (max-age=31536000)
- 44-03: PPR over ISR - removed explicit revalidate exports for cacheComponents compatibility
- 44-03: Models page uses dynamic metadata (generateMetadata) to include accurate model count
- 44-03: Competition grouping by category (European, Domestic, International)

**Phase 45 (v2.6):**
- 45-01: getInternalUrl validates league slugs via getCompetitionById to enforce canonical short-form
- 45-01: Sitemap lastmod uses MAX(updatedAt) from database rather than static today date
- 45-01: Include all 17 leagues in sitemap (removed club-only filter)
- 45-01: Models sitemap filters to active: true only
- 45-02: Cross-linking widgets placed after "Performance by League", before "Related Models"
- 45-02: RecentPredictionsWidget shows 10 most recent predictions ordered by kickoff DESC
- 45-02: LeaguesCoveredWidget orders leagues by prediction count DESC
- 45-02: Widgets return null for graceful degradation when no data exists
- 45-02: All cross-linking uses HoverPrefetchLink for SEO-optimized prefetching
- 45-03: Widget queries predictions independently (not reusing page query) for modularity
- 45-03: Color-code points (green/yellow) for finished matches to highlight top performers
- 45-03: Use 3-column responsive grid layout for better space utilization

### Pending Todos

None.

### Blockers/Concerns

None — Phase 45 complete, all 3 internal linking patterns established.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |
| 011 | Fix predictBatch type error breaking production build | 2026-02-05 | 8625f5d | [011-fix-predictbatch-type-error](./quick/011-fix-predictbatch-type-error/) |
| 012 | Fix circular dependency build error in LLM module | 2026-02-05 | 70ba190 | [012-fix-circular-dep-build-error](./quick/012-fix-circular-dep-build-error/) |
| 013 | Break circular dependency in base.ts imports | 2026-02-05 | 5322a19 | [013-break-circular-dep-base-imports-index](./quick/013-break-circular-dep-base-imports-index/) |

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 45-03-PLAN.md (Match-to-Model Cross-Links)
Resume file: None

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled)
- 219 requirements validated (v1.0-v2.5 + 11 from Phase 44)

---
*Last updated: 2026-02-06 after Phase 45 complete*
