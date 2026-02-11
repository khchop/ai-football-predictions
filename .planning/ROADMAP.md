# Roadmap: AI Football Predictions Platform

## Milestones

- ✅ **v1.0 Bug Fix Stabilization** - Phases 1-4 (shipped 2026-02-01)
- ✅ **v1.1 Stats Accuracy & SEO** - Phases 5-8 (shipped 2026-02-02)
- ✅ **v1.2 Technical SEO Fixes** - Phases 9-12 (shipped 2026-02-02)
- ✅ **v1.3 Match Page Refresh** - Phases 13-16 (shipped 2026-02-02)
- ✅ **v2.0 UI/UX Overhaul** - Phases 17-23 (shipped 2026-02-03)
- ✅ **v2.1 Match Page Simplification** - Phases 24-25 (shipped 2026-02-03)
- ✅ **v2.2 Match Page Rewrite** - Phases 26-30 (shipped 2026-02-04)
- ✅ **v2.3 Content Pipeline & SEO** - Phases 31-36 (shipped 2026-02-04)
- ✅ **v2.4 Synthetic.new Integration** - Phases 37-39 (shipped 2026-02-05)
- ✅ **v2.5 Model Reliability & Dynamic Counts** - Phases 40-43 (shipped 2026-02-05)
- ✅ **v2.6 SEO/GEO Site Health** - Phases 44-48 (shipped 2026-02-06)
- ✅ **v2.7 Pipeline Reliability & Retroactive Backfill** - Phases 49-52 (shipped 2026-02-07)
- ✅ **v2.8 Model Coverage** - Phases 53-58 (shipped 2026-02-08)
- ✅ **v2.9 Provider Unification & Maximum Coverage** - Phases 59-62 + quick-040/041 (shipped 2026-02-11)
- 🚧 **v3.0 Club/Team Pages** - Phases 67-71 (in progress)

## Phases

<details>
<summary>✅ v1.0 Bug Fix Stabilization (Phases 1-4) - SHIPPED 2026-02-01</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.1 Stats Accuracy & SEO (Phases 5-8) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.2 Technical SEO Fixes (Phases 9-12) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.3 Match Page Refresh (Phases 13-16) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.0 UI/UX Overhaul (Phases 17-23) - SHIPPED 2026-02-03</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.1 Match Page Simplification (Phases 24-25) - SHIPPED 2026-02-03</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.2 Match Page Rewrite (Phases 26-30) - SHIPPED 2026-02-04</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.3 Content Pipeline & SEO (Phases 31-36) - SHIPPED 2026-02-04</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.4 Synthetic.new Integration (Phases 37-39) - SHIPPED 2026-02-05</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.5 Model Reliability & Dynamic Counts (Phases 40-43) - SHIPPED 2026-02-05</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.6 SEO/GEO Site Health (Phases 44-48) - SHIPPED 2026-02-06</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.7 Pipeline Reliability & Retroactive Backfill (Phases 49-52) - SHIPPED 2026-02-07</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.8 Model Coverage (Phases 53-58) - SHIPPED 2026-02-08</summary>

See `.planning/MILESTONES.md` for full details.

</details>

### v2.9 Provider Unification & Maximum Coverage (Complete)

**Milestone Goal:** Unify provider architecture with smart multi-provider routing, merge duplicate -syn model entries, and maximize model coverage. Phases 59-62 built the infrastructure; quick-040 removed Synthetic providers and quick-041 removed Together AI, moving all 42 models to OpenRouter as the single provider. Phases 63-66 were superseded by these quick tasks.

#### Phase 59: Provider Integration Foundations

**Goal:** OpenRouter provider class operational with configuration and validation infrastructure

**Depends on:** Phase 58 (v2.8 complete)

**Requirements:** PROV-01, PROV-02, PROV-03, PROV-04, PROV-05

**Success Criteria** (what must be TRUE):
1. OpenRouterProvider class extends OpenAICompatibleProvider with correct endpoint and authentication
2. Provider sends required HTTP-Referer and X-Title headers per OpenRouter API spec
3. OpenRouter providers are conditionally included in registry when API key is configured
4. Provider handles OpenRouter model ID format correctly (e.g., deepseek/deepseek-r1)
5. Validation script confirms no duplicate model IDs across all providers

**Plans:** 1 plan

Plans:
- [x] 59-01-PLAN.md -- OpenRouterProvider class, registry integration, and model ID validation script

#### Phase 60: Multi-Provider Routing

**Goal:** Provider routing system supports 3-tier fallback chains with cycle detection and max depth enforcement

**Depends on:** Phase 59

**Requirements:** ROUT-01, ROUT-02, ROUT-03, ROUT-04, ROUT-05, ROUT-06

**Success Criteria** (what must be TRUE):
1. Each model has an ordered provider priority list configurable per model
2. Provider routing tries providers in priority order, failing over to next on error
3. Cycle detection prevents infinite fallback loops across providers
4. Max fallback depth enforced (3 providers max per prediction attempt)
5. Existing MODEL_FALLBACKS map replaced with unified provider priority routing system

**Plans:** 1 plan

Plans:
- [x] 60-01-PLAN.md -- Replace MODEL_FALLBACKS with MODEL_PROVIDER_ROUTES, extend callAPIWithFallback with multi-provider routing, update admin stats

#### Phase 61: Provider Attribution

**Goal:** System tracks which provider served each prediction request with admin dashboard visibility

**Depends on:** Phase 60

**Requirements:** ATTR-01, ATTR-02, ATTR-03, ATTR-04

**Success Criteria** (what must be TRUE):
1. Each prediction records which provider actually served the request in predictions table
2. Admin dashboard shows provider distribution for recent predictions
3. Fallback events logged with original provider and fallback provider
4. Provider attribution query confirms 100% of predictions have provider_used field populated

**Plans:** 2 plans

Plans:
- [x] 61-01-PLAN.md -- Schema migration, Drizzle schema update, and worker attribution persistence
- [x] 61-02-PLAN.md -- Admin API extension and dashboard provider distribution UI

#### Phase 62: Migration Script Development

**Goal:** Battle-tested migration script with comprehensive validation and rollback capability

**Depends on:** Phase 61

**Requirements:** CONS-01, CONS-02, CONS-05, CONS-08

**Success Criteria** (what must be TRUE):
1. Pre-migration validation detects conflicts (matches predicted by both old/new model IDs)
2. Deduplication logic resolves duplicate predictions with deterministic precedence rules
3. Migration script is idempotent and includes pre/post validation (row count checksums, referential integrity)
4. Rollback script tested and verified on staging data
5. Dry-run mode shows exactly what changes would be made without committing

**Plans:** 1 plan

Plans:
- [x] 62-01-PLAN.md -- Forward migration script with dedup/validation/dry-run + rollback script

#### Phases 63-66: Superseded by Quick Tasks

Phases 63 (Model Consolidation Execution), 64 (Model Re-Activation), 65 (Cost Tracking), and 66 (Provider Health Monitoring) were superseded by quick-040 (remove Synthetic providers) and quick-041 (remove Together AI, move all models to OpenRouter). The multi-provider architecture was simplified to a single OpenRouter provider, eliminating the need for consolidation migrations, re-activation, and multi-provider cost/health tracking.

### v3.0 Club/Team Pages (In Progress)

**Milestone Goal:** Add dedicated team pages for every club across all 17 leagues with per-club model leaderboards, upcoming/recent match predictions, AI-generated club analysis, and full SEO optimization.

#### Phase 67: Foundation & Data Layer

**Goal:** Team name normalization, query infrastructure, and caching strategy established

**Depends on:** v2.9 complete

**Requirements:** PAGE-03

**Success Criteria** (what must be TRUE):
1. Team mapping file resolves URL slugs to canonical database team names for all 200+ teams
2. Team mapping handles aliases correctly (e.g., "Man City" vs "Manchester City")
3. Team stats query aggregates W/D/L record, goals scored/conceded using batch operations (max 3-4 DB queries per page)
4. Database indexes exist on homeTeam and awayTeam columns for query performance
5. Cache invalidation targets specific teams on match completion without thundering herd

**Plans:** 2 plans

Plans:
- [ ] 67-01-PLAN.md -- Team name mapping file (teams.ts) with DB-audited entries + B-tree indexes on homeTeam/awayTeam columns
- [ ] 67-02-PLAN.md -- Team stats batch queries (CASE WHEN aggregation) + targeted team cache invalidation

#### Phase 68: Routes, SEO & Basic Pages

**Goal:** Team pages are accessible, indexable, and properly structured for search engines

**Depends on:** Phase 67

**Requirements:** PAGE-01, PAGE-02, PAGE-04, SEO-01, SEO-02, SEO-03

**Success Criteria** (what must be TRUE):
1. User can navigate to any team page via /teams/[slug] URL
2. User can browse all clubs on /teams index page with league grouping
3. Team pages include Schema.org SportsTeam structured data with breadcrumbs
4. Team pages have proper meta tags, canonical URLs, and OG images
5. Only teams with 5+ finished matches appear in sitemap to avoid thin content penalties

**Plans:** 2 plans

Plans:
- [ ] 68-01-PLAN.md -- SEO infrastructure: metadata helpers, SportsTeam schema, breadcrumbs, OG image route, teams sitemap with quality filter
- [ ] 68-02-PLAN.md -- Team pages: /teams/[slug] detail page with full SEO, /teams index page with league grouping

#### Phase 69: UI Components & Match Display

**Goal:** Team pages display comprehensive stats, leaderboards, and match history

**Depends on:** Phase 68

**Requirements:** STAT-01, STAT-02, STAT-03, STAT-04, MTCH-01, MTCH-02, MTCH-03

**Success Criteria** (what must be TRUE):
1. User can see per-club model leaderboard showing which AI models predict best for specific club
2. User can filter club leaderboard by time period (all-time, season, monthly, weekly)
3. User can view club statistics including W/D/L record, goals scored/conceded, and averages
4. User can see upcoming match predictions with model prediction distribution
5. User can see recent match results with scores and visual form indicator (W/D/L timeline)

**Plans:** 2 plans

Plans:
- [x] 69-01-PLAN.md -- Team leaderboard with time filter, enhanced stats overview, form indicator components
- [x] 69-02-PLAN.md -- Upcoming/recent match display with prediction distribution, accuracy trend chart

#### Phase 70: Navigation & Cross-Linking

**Goal:** Team pages are discoverable from league and match pages with proper internal linking

**Depends on:** Phase 69

**Requirements:** NAV-01, NAV-02

**Success Criteria** (what must be TRUE):
1. User can click team names on league pages to navigate to team pages
2. User can click team badges/names on match detail pages to navigate to team pages
3. Breadcrumbs reflect proper hierarchy (Home > Teams > Club Name)
4. Team pages include internal links to related content (league page, recent matches)

**Plans:** 2 plans

Plans:
- [x] 70-01-PLAN.md -- Clickable team links in league standings, team page league cross-link, opponent links in team match lists
- [x] 70-02-PLAN.md -- Clickable team links in match detail hero and match card components

#### Phase 71: AI Content & FAQ Generation

**Goal:** Team pages include unique AI-generated insights and dynamic FAQs

**Depends on:** Phase 70

**Requirements:** SEO-04, SEO-05

**Success Criteria** (what must be TRUE):
1. Team pages display AI-generated club analysis highlighting form patterns and model prediction trends
2. Team pages include 5-7 club-specific FAQ questions with FAQPage schema markup
3. AI content generation uses rate-limited queue to prevent Together AI API limits
4. FAQ content is dynamically enriched with actual team stats and recent match data
5. Generated content is cached in database with 24h refresh cycle

**Plans:** TBD

Plans:
- [ ] 71-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 59 -> 60 -> 61 -> 62 -> (63-66 superseded) -> 67 -> 68 -> 69 -> 70 -> 71

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Resilience | v1.0 | 4/4 | Complete | 2026-02-01 |
| 2. Pipeline Reliability | v1.0 | 4/4 | Complete | 2026-02-01 |
| 3. Scoring Accuracy | v1.0 | 3/3 | Complete | 2026-02-01 |
| 4. Frontend Stability | v1.0 | 4/3 | Complete | 2026-02-01 |
| 5. Stats Correction | v1.1 | 3/3 | Complete | 2026-02-02 |
| 6. Historical Migration | v1.1 | 3/3 | Complete | 2026-02-02 |
| 7. SEO Structured Data | v1.1 | 2/2 | Complete | 2026-02-02 |
| 8. UX Transparency | v1.1 | 2/2 | Complete | 2026-02-02 |
| 9. Critical Errors | v1.2 | 3/3 | Complete | 2026-02-02 |
| 10. Redirects & Meta | v1.2 | 2/2 | Complete | 2026-02-02 |
| 11. Indexability | v1.2 | 2/2 | Complete | 2026-02-02 |
| 12. Internal Linking | v1.2 | 2/2 | Complete | 2026-02-02 |
| 13. Content Integration | v1.3 | 4/4 | Complete | 2026-02-02 |
| 14. Mobile UX | v1.3 | 4/4 | Complete | 2026-02-02 |
| 15. Performance | v1.3 | 3/3 | Complete | 2026-02-02 |
| 16. AI Search | v1.3 | 2/2 | Complete | 2026-02-02 |
| 17. Design System | v2.0 | 4/4 | Complete | 2026-02-03 |
| 18. Match Pages | v2.0 | 5/5 | Complete | 2026-02-03 |
| 19. Blog Pages | v2.0 | 4/4 | Complete | 2026-02-03 |
| 20. League Pages | v2.0 | 4/4 | Complete | 2026-02-03 |
| 21. Leaderboard | v2.0 | 3/3 | Complete | 2026-02-03 |
| 22. Navigation | v2.0 | 5/5 | Complete | 2026-02-03 |
| 23. Performance | v2.0 | 3/3 | Complete | 2026-02-03 |
| 24. Layout Simplification | v2.1 | 2/2 | Complete | 2026-02-03 |
| 25. Content Cleanup | v2.1 | 1/1 | Complete | 2026-02-03 |
| 26. Context Architecture | v2.2 | 3/3 | Complete | 2026-02-04 |
| 27. Hero Component | v2.2 | 2/2 | Complete | 2026-02-04 |
| 28. State-Aware Content | v2.2 | 4/4 | Complete | 2026-02-04 |
| 29. AI-Generated FAQ | v2.2 | 3/3 | Complete | 2026-02-04 |
| 30. Cleanup | v2.2 | 2/2 | Complete | 2026-02-04 |
| 31. Error Handling | v2.3 | 3/3 | Complete | 2026-02-04 |
| 32. HTML Sanitization | v2.3 | 2/2 | Complete | 2026-02-04 |
| 33. Pipeline Hardening | v2.3 | 3/3 | Complete | 2026-02-04 |
| 34. SEO/GEO Optimization | v2.3 | 3/3 | Complete | 2026-02-04 |
| 35. Blog Generation | v2.3 | 2/2 | Complete | 2026-02-04 |
| 36. Validation | v2.3 | 1/1 | Complete | 2026-02-04 |
| 37. Provider Infrastructure | v2.4 | 3/3 | Complete | 2026-02-05 |
| 38. Model Configuration | v2.4 | 2/2 | Complete | 2026-02-05 |
| 39. Testing & Validation | v2.4 | 2/2 | Complete | 2026-02-05 |
| 40. Model-Specific Prompt Selection | v2.5 | 2/2 | Complete | 2026-02-05 |
| 41. Together AI Fallbacks | v2.5 | 4/4 | Complete | 2026-02-05 |
| 42. Dynamic Model Counts | v2.5 | 2/2 | Complete | 2026-02-05 |
| 43. Testing & Validation | v2.5 | 3/3 | Complete | 2026-02-05 |
| 44. Foundation -- Redirects, Canonicals & Index Pages | v2.6 | 3/3 | Complete | 2026-02-06 |
| 45. Sitemap & Internal Linking | v2.6 | 4/4 | Complete | 2026-02-06 |
| 46. Content Tags & Meta Optimization | v2.6 | 3/3 | Complete | 2026-02-06 |
| 47. Structured Data Validation | v2.6 | 4/4 | Complete | 2026-02-06 |
| 48. Performance & Verification | v2.6 | 3/3 | Complete | 2026-02-06 |
| 49. Pipeline Scheduling Fixes | v2.7 | 2/2 | Complete | 2026-02-06 |
| 50. Settlement Investigation & Recovery | v2.7 | 2/2 | Complete | 2026-02-06 |
| 51. Retroactive Backfill Script | v2.7 | 2/2 | Complete | 2026-02-06 |
| 52. Monitoring & Observability | v2.7 | 3/3 | Complete | 2026-02-07 |
| 53. Regression Protection | v2.8 | 2/2 | Complete | 2026-02-07 |
| 54. Diagnostic Infrastructure | v2.8 | 2/2 | Complete | 2026-02-08 |
| 55. Category Fixes - Timeouts & Tags | v2.8 | 2/2 | Complete | 2026-02-08 |
| 56. Category Fixes - Language & JSON | v2.8 | 2/2 | Complete | 2026-02-08 |
| 57. Category Fixes - Fallbacks & Validation | v2.8 | 2/2 | Complete | 2026-02-08 |
| 58. Observability & Monitoring | v2.8 | 3/3 | Complete | 2026-02-08 |
| 59. Provider Integration Foundations | v2.9 | 1/1 | Complete | 2026-02-08 |
| 60. Multi-Provider Routing | v2.9 | 1/1 | Complete | 2026-02-08 |
| 61. Provider Attribution | v2.9 | 2/2 | Complete | 2026-02-08 |
| 62. Migration Script Development | v2.9 | 1/1 | Complete | 2026-02-08 |
| 63-66. Superseded by quick-040/041 | v2.9 | - | Superseded | 2026-02-11 |
| 67. Foundation & Data Layer | v3.0 | 2/2 | Complete | 2026-02-11 |
| 68. Routes, SEO & Basic Pages | v3.0 | 2/2 | Complete | 2026-02-11 |
| 69. UI Components & Match Display | v3.0 | 2/2 | Complete | 2026-02-11 |
| 70. Navigation & Cross-Linking | v3.0 | 2/2 | Complete | 2026-02-11 |
| 71. AI Content & FAQ Generation | v3.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-11 — v2.9 complete (phases 63-66 superseded by quick-040/041), v3.0 phases 67-70 complete*
