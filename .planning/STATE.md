# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** v2.4 Synthetic.new Integration (Complete)

## Current Position

Phase: 39 of 39 (Testing & Validation)
Plan: 4 of 4 (Production Validation)
Status: Complete - All phases and plans finished
Last activity: 2026-02-04 — Completed 39-04-PLAN.md (Production validation confirmed)

Progress: [###########] 100%

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
| v2.4 Synthetic.new Integration | 37-39 | 4 | 17 | 2026-02-04 |

**Total shipped:** 39 phases, 111 plans, 172 requirements

## Accumulated Context

### Decisions

Key decisions from v2.3 are archived in milestones/v2.3-ROADMAP.md.

**v2.4 Decisions:**
- Add Synthetic.new alongside Together AI (not replace)
- Keep Together AI models for overlapping models (prefer existing)
- Skip vision model (Qwen3-VL) - not useful for text predictions
- Include GLM models despite Chinese output risk
- All Synthetic model IDs use -syn suffix to distinguish from Together
- 13 models configured (4 premium, 9 budget) with placeholder pricing
- Provider registry checks each API key independently (TOGETHER_API_KEY, SYNTHETIC_API_KEY)
- **39-01:** 7/13 Synthetic models validated for production (deepseek-r1, kimi-k2-thinking, deepseek-v3 variants, minimax variants, qwen3-coder)
- **39-01:** 6 models fail validation (GLM-4.7 has API bug, 2 timeout, 2 parse failures, 1 invalid output)
- **39-02:** 6 failing models disabled in code, definitions preserved for future re-testing
- **39-03:** Fallback mapping added (deepseek-r1-0528-syn -> deepseek-r1, kimi-k2-thinking-syn -> kimi-k2-instruct)
- **39-04:** All 7 active Synthetic models confirmed production-ready (transient failures only)

### Pending Todos

None.

### Blockers/Concerns

**Active Blockers:**
None.

**Future Concerns:**
- JSON mode support unknown on Synthetic.new (parser handles non-JSON)
- Rate limits: 135 req/5hrs on Standard tier (small requests count as 0.2)
- GLM-4.7 has known SGLang structured output bug (Synthetic.new confirmed) - blocked until upstream fix
- 2 Synthetic models timeout consistently (kimi-k2.5-syn, glm-4.6-syn) - may need rate limit investigation
- 2 reasoning models return natural language instead of JSON (qwen3-235b-thinking, deepseek-v3.2) - may need prompt adjustment

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |

## Session Continuity

Last session: 2026-02-04T21:51:40Z
Stopped at: Completed 39-04-PLAN.md (Production Validation)
Resume file: None
Resume with: Project complete - all phases finished

**v2.4 Complete:**
- 3 phases (37-39), 4 plans, 17 requirements
- Adds Synthetic.new as second LLM provider
- 7 active models (2 reasoning + 5 standard), 6 disabled pending upstream fixes
- Total active models: 29 Together + 7 Synthetic = 36

**Phase 37 Complete:**
- 37-01: Base provider class with OpenAI-compatible API
- 37-02: 13 model configurations (4 premium, 9 budget)
- 37-03: Registry integration (42 total models)

**Phase 38 Complete:**
- Already implemented by sync-models.ts auto-sync architecture
- Models register automatically on server startup when SYNTHETIC_API_KEY set

**Phase 39 Complete:**
- 39-01: Model validation script created and executed (7/13 Synthetic models validated)
- 39-02: 6 failing models disabled in SYNTHETIC_PROVIDERS (7 remain active)
- 39-03: Fallback mapping (MODEL_FALLBACKS) and getFallbackProvider() for cross-provider resilience
- 39-04: Production validation confirmed (7 models registered in database, ready for predictions)
