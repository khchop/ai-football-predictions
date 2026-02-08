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
- 🚧 **v2.9 Provider Unification & Maximum Coverage** - Phases 59-66 (in progress)

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

### v2.9 Provider Unification & Maximum Coverage (In Progress)

**Milestone Goal:** Unify provider architecture with smart multi-provider routing (Synthetic -> Together -> OpenRouter), merge duplicate -syn model entries, re-activate 7 deprecated models via OpenRouter, and maximize model coverage to ~29 unique model IDs with multi-provider fallback chains.

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
- [ ] 60-01-PLAN.md -- Replace MODEL_FALLBACKS with MODEL_PROVIDER_ROUTES, extend callAPIWithFallback with multi-provider routing, update admin stats

#### Phase 61: Provider Attribution

**Goal:** System tracks which provider served each prediction request with admin dashboard visibility

**Depends on:** Phase 60

**Requirements:** ATTR-01, ATTR-02, ATTR-03, ATTR-04

**Success Criteria** (what must be TRUE):
1. Each prediction records which provider actually served the request in predictions table
2. Admin dashboard shows provider distribution for recent predictions
3. Fallback events logged with original provider and fallback provider
4. Provider attribution query confirms 100% of predictions have provider_used field populated

**Plans:** TBD

Plans:
- [ ] 61-01: TBD

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

**Plans:** TBD

Plans:
- [ ] 62-01: TBD

#### Phase 63: Model Consolidation Execution

**Goal:** 13 -syn models merged into base IDs, 6 Synthetic-only models renamed, all prediction history preserved

**Depends on:** Phase 62

**Requirements:** CONS-03, CONS-04, CONS-06, CONS-07

**Success Criteria** (what must be TRUE):
1. Foreign keys updated across all referencing tables (predictions, llm_model_stats, bets, model_balances)
2. Leaderboard aggregates recalculated after model consolidation match historical totals
3. Cache invalidation covers all model-keyed caches after migration
4. Post-migration validation confirms zero orphaned foreign keys and referential integrity intact
5. Before/after comparison report shows correct row counts and prediction preservation

**Plans:** TBD

Plans:
- [ ] 63-01: TBD

#### Phase 64: Model Re-Activation

**Goal:** 7 deprecated Together AI models re-activated via OpenRouter with validated output quality

**Depends on:** Phase 63

**Requirements:** REACT-01, REACT-02, REACT-03, REACT-04, REACT-05

**Success Criteria** (what must be TRUE):
1. 7 deprecated Together AI models re-activated with OpenRouter as primary provider
2. Re-activated models use correct OpenRouter model IDs verified against OpenRouter API
3. Re-activated models tested for valid JSON prediction output before going live
4. Dynamic model count (getActiveModelCount) reflects new consolidated count across SEO, content, and system prompts
5. Homepage and leaderboard display updated model count without manual intervention

**Plans:** TBD

Plans:
- [ ] 64-01: TBD

#### Phase 65: Cost Tracking & Budget Control

**Goal:** Cost tracking per provider with budget circuit breakers preventing cost overruns during fallback

**Depends on:** Phase 64

**Requirements:** COST-01, COST-02, COST-03, COST-04

**Success Criteria** (what must be TRUE):
1. Actual provider cost tracked per prediction including fallback costs
2. Budget circuit breaker pauses OpenRouter fallback when daily cost exceeds threshold
3. Cost comparison visible per provider in admin dashboard
4. Warning logged when fallback to more expensive provider is triggered
5. Daily cost report shows actual vs budgeted spend with provider breakdown

**Plans:** TBD

Plans:
- [ ] 65-01: TBD

#### Phase 66: Provider Health Monitoring

**Goal:** Per-provider health observability with regression alerts and latency tracking

**Depends on:** Phase 65

**Requirements:** HLTH-01, HLTH-02, HLTH-03, HLTH-04

**Success Criteria** (what must be TRUE):
1. Per-provider success rate tracked (not just per-model) and visible in admin dashboard
2. Provider latency tracked and visible with P50/P95/P99 percentiles
3. Provider health cards added to admin dashboard alongside model health cards
4. Regression alert when provider-wide success rate drops below 90% threshold
5. Fallback analytics dashboard shows provider routing paths and success rates

**Plans:** TBD

Plans:
- [ ] 66-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 59 -> 60 -> 61 -> 62 -> 63 -> 64 -> 65 -> 66

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
| 61. Provider Attribution | v2.9 | 0/TBD | Not started | - |
| 62. Migration Script Development | v2.9 | 0/TBD | Not started | - |
| 63. Model Consolidation Execution | v2.9 | 0/TBD | Not started | - |
| 64. Model Re-Activation | v2.9 | 0/TBD | Not started | - |
| 65. Cost Tracking & Budget Control | v2.9 | 0/TBD | Not started | - |
| 66. Provider Health Monitoring | v2.9 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-08 after phase 60 execution*
