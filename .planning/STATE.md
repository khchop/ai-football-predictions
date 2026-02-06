# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** v2.6 SEO/GEO Site Health

## Current Position

Phase: 47 — Structured Data Validation
Plan: 1/3 in progress
Status: Plan 47-01 complete
Last activity: 2026-02-06 — Completed 47-01-PLAN.md (root schema single source of truth)

Progress: [███████████████████████████░░░░░░░░░░░░░░░░░░░] 60% (phase 47 plan 1 of 44-48 complete)

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
- 45-04: Build-time audit validates sitemap URLs (no UUIDs, no long-form slugs) before deployment
- 45-04: Pass 1 (sitemap URL validation) only runs if AUDIT_BASE_URL set (optional for CI)
- 45-04: Pass 2 validates database completeness (models, matches, blog posts, 17 leagues)
- 45-04: Pass 3 structural link analysis ensures 3+ link sources per page type
- 45-04: Build fails on FAIL (UUID URLs, bad slugs, missing data), succeeds on warnings

**Phase 46 (v2.6):**
- 46-01: Centralized metadata builders (buildMatchTitle, buildLeagueTitle, buildModelTitle, buildGenericTitle + 4 description builders)
- 46-01: Title suffix drops " | Kroam" when >60 chars instead of abbreviating entity names
- 46-01: enforceDescriptionLength() pads short descriptions to 100-160 char range
- 46-01: Updated MAX_META_DESCRIPTION_LENGTH from 155 to 160, added MIN_DESCRIPTION_LENGTH = 100
- 46-01: Updated branding from 'BettingSoccer'/'kroam.xyz' to 'Kroam' across all site metadata
- 46-01: Updated model count from 29/35 to 42 in all metadata strings
- 46-01: All pages have og:image URLs wired to /api/og/* routes
- 46-01: Standardized H1 tags ("{League} Predictions", "{Model} Football Predictions")
- 46-02: All OG images use dark navy/charcoal gradient (#1a1a2e → #0f3460) with light text
- 46-02: Updated branding from "kroam.xyz" to "Kroam.xyz" across all OG images
- 46-02: Created generic fallback OG route (/api/og/generic) with query param customization
- 46-02: Match pages under /leagues/[slug]/[match] have dynamic opengraph-image.tsx
- 46-02: Replaced purple badge (rgba(168, 85, 247, 0.4)) with blue badge (rgba(96, 165, 250, 0.2))
- 46-03: Use SportsOrganization for leagues (more semantic than Thing)
- 46-03: Use SoftwareApplication for AI models (signals computational tools)
- 46-03: OG tag completeness warnings (not failures) in Pass 4
- 46-03: Sample 50 URLs when >50 total for faster audit runs (AUDIT_SAMPLE env var)
- 46-03: CollectionPage -> ItemList -> ListItem three-tier hierarchy for index pages
- 46-03: Build-time HTML validation using cheerio to catch meta tag regressions

**Phase 47 (v2.6):**
- 47-01: Root schema module (ORGANIZATION_ID, WEBSITE_ID constants) provides single source of truth
- 47-01: Root layout consolidated from 3 separate JSON-LD scripts to 1 @graph (Organization + WebSite + SoftwareApplication)
- 47-01: Match pages reference root Organization/WebSite via @id (no duplication, 7 entities → 5 entities)
- 47-01: Organization logo as ImageObject (not string) for Google Article publisher.logo validation
- 47-01: Legacy graph.ts uses ORGANIZATION_ID reference instead of inline duplicate with old "bettingsoccer.com" branding

### Pending Todos

None.

### Blockers/Concerns

None — Phase 47-01 complete. Root schema single source of truth established. Ready for 47-02 (SportsEvent/Article validation with build-time audit extension).

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
Stopped at: Completed 47-01-PLAN.md — root schema single source of truth established
Resume file: None

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled)
- 237 requirements validated (v1.0-v2.5 + 11 from Phase 44 + 10 from Phase 45 + 8 from Phase 46)

---
*Last updated: 2026-02-06 after Phase 46 verified*
