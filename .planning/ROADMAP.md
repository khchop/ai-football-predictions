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
- ✅ **v3.0 Club/Team Pages** - Phases 67-71 (shipped 2026-02-12)
- 🚧 **v3.1 Model Lifecycle & Discord Alerts** - Phases 72-74 (in progress)

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

<details>
<summary>✅ v2.9 Provider Unification & Maximum Coverage (Phases 59-62 + quick-040/041) - SHIPPED 2026-02-11</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/v2.9-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.0 Club/Team Pages (Phases 67-71) - SHIPPED 2026-02-12</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

### 🚧 v3.1 Model Lifecycle & Discord Alerts (In Progress)

**Milestone Goal:** Replace 18 models with 20 new/updated models, add archival system with leaderboard toggle, and build Discord webhook notifications for persistent model errors.

#### Phase 72: Model Configuration & Archive Schema ✅

**Goal**: Configure 20 active OpenRouter models with correct IDs/pricing and add database archive infrastructure

**Depends on**: Phase 71

**Requirements**: MDL-01, MDL-02, MDL-03, MDL-04, MDL-05, ARCH-01

**Success Criteria** (what must be TRUE):
  1. System defines exactly 20 active models with correct OpenRouter model IDs, pricing, and prompt variants
  2. New models (GLM-5, DeepSeek V3.2, DeepSeek R1-0528, MiniMax M2.1, Devstral 2, Qwen3 30B A3B, GPT-OSS-20B, Step 3.5 Flash, Mistral Small 3.2 24B, Gemma 3 27B, Nemotron 3 Nano 30B A3B, Trinity Large Preview, Phi-4, Llama 4 Scout, Gemma 3 12B) are defined with appropriate timeouts
  3. GLM-4.7 route registration bug is fixed (model appears in MODEL_PROVIDER_ROUTES)
  4. Models table has `archived` boolean column (default false) with migration applied
  5. Model validation passes at module load time without errors

**Plans**: 2 plans

Plans:
- [x] 72-01-PLAN.md -- Archive schema + new model provider definitions
- [x] 72-02-PLAN.md -- Finalize 20-model configuration (routes, arrays, validation)

#### Phase 73: Archive System Integration ✅

**Goal**: Archived models are excluded from pipeline and leaderboards with user-controlled toggle

**Depends on**: Phase 72

**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-07, ARCH-08

**Success Criteria** (what must be TRUE):
  1. Archived models are excluded from prediction pipeline (workers skip them)
  2. Archived models are excluded from `getActiveModelCount()` dynamic count
  3. Leaderboard shows "Show archived models" toggle switch (off by default)
  4. When toggle is off, archived models do not appear in leaderboard rankings
  5. When toggle is on, archived models appear with visual indicator (grayed out or badge)
  6. Team page leaderboards respect the archived filter setting
  7. Competition leaderboards respect the archived filter setting

**Plans**: 2 plans

Plans:
- [x] 73-01-PLAN.md -- Backend pipeline/query exclusion of archived models
- [x] 73-02-PLAN.md -- Frontend leaderboard toggle and archived visual indicators

#### Phase 74: Discord Alert Service

**Goal**: Discord webhook sends rich embeds for model auto-disable and regression events

**Depends on**: Phase 72 (independent of Phase 73)

**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05

**Success Criteria** (what must be TRUE):
  1. Discord webhook URL is configurable via `DISCORD_WEBHOOK_URL` environment variable
  2. Discord service sends rich embeds with model name, error details, timestamps when called
  3. Alert fires when a model is auto-disabled (5+ consecutive model-specific failures)
  4. Alert fires during daily regression check when a model drops more than 10% success rate
  5. Alerts include actionable context: error type, failure count, last success time, suggested action

**Plans**: TBD

Plans:
- [ ] 74-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 72 → 73 → 74

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
| 71. AI Content & FAQ Generation | v3.0 | 2/2 | Complete | 2026-02-12 |
| 72. Model Configuration & Archive Schema | v3.1 | 2/2 | Complete | 2026-02-12 |
| 73. Archive System Integration | v3.1 | 2/2 | Complete | 2026-02-13 |
| 74. Discord Alert Service | v3.1 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-13 after Phase 73 execution*
