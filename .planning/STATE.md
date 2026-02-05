# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** Phase 42 - Dynamic Model Counts

## Current Position

Phase: 42 of 43 (Dynamic Model Counts)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-05 - Completed 42-02-PLAN.md (replace hardcoded references)

Progress: [██████████████████████████████████████████░░] 98%

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
| **v2.5 Model Reliability (in progress)** | **40-43** | **8 (TBD)** | **36** | **-** |

**Total shipped:** 39 phases, 117 plans, 172 requirements

## Accumulated Context

### Decisions

Recent decisions affecting v2.5:

- Model-specific prompts over LangChain/LiteLLM (avoids 10MB+ bundle, 50-200ms latency)
- Fallback chains with cycle detection and max depth 3 (prevents worker exhaustion)
- Dynamic model counts via getProviderStats() single source of truth (eliminates hardcoded references)
- Enum-based configuration for compile-time validation (40-01: PromptVariant, ResponseHandler)
- Combo variants over multi-variant arrays (40-01: simpler model configuration)
- Response handlers as pure functions (40-01: string -> string pipeline)
- Optional promptConfig property on provider classes (40-02: subclasses only override when needed)
- Unified content extraction before response handler (40-02: single return path handles all response formats)
- Model-specific timeouts: 90s for large reasoning models, 60s for medium, 45s for JSON-strict (40-02)
- Boolean usedFallback tracking only (41-01: modelId stores original model, flag tracks internal fallback usage)
- Module load time validation for MODEL_FALLBACKS (41-01: fail-fast on invalid configuration)
- No retries on original model for fallbacks (41-02: first failure triggers immediate Together AI fallback)
- Max fallback depth 1 with structural enforcement (41-02: Together models have no fallbacks, no cycle detection needed)
- Cost warning threshold at 2x original cost (41-03: amber badges for expensive fallbacks in admin dashboard)
- Per-model fallback rate calculated from predictions table (41-03: aggregates usedFallback boolean per modelId)
- Kimi K2.5-syn maps to kimi-k2-instruct (41-04: same fallback target as K2-thinking)
- GLM/MiniMax/Qwen3 Coder have no fallbacks (41-04: documented provider limitation, not implementation gap)
- 60s cache TTL for model count (42-01: aligned with CACHE_TTL.STATS for consistency)
- Batch invalidation after recoverDisabledModels() (42-01: single invalidation after loop, not per-model)
- Optional activeModels parameter with fallback to 35 (42-02: backwards compatibility for incremental updates)

### Pending Todos

None.

### Blockers/Concerns

**Known Issues for v2.5:**
- Phase 40: COMPLETE - Infrastructure ready, needs integration testing to validate prompt fixes
- Phase 41: COMPLETE - All 4 plans shipped (infrastructure, orchestration, admin visibility, gap closure)
- Phase 41: Cross-provider API compatibility (Together AI vs Synthetic parameter differences) needs validation
- Phase 41: Fallback timeout behavior needs testing (does Together AI inherit model-specific timeout?)
- Phase 42: Plans 01-02 complete - cache infrastructure and hardcoded reference replacement done
- Phase 43: Timeout validation needed - Qwen3 Thinking at 90s, others at 60s/45s

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |

## Session Continuity

Last session: 2026-02-05
Stopped at: Completed 42-02-PLAN.md (replace hardcoded references)
Resume file: None (ready for plan 03)

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled with configurations)
- 172 requirements validated (v1.0-v2.4)
- 36 new requirements for v2.5
- 42 phases complete, 1 phase remaining in v2.5
- Phase 42: Plans 01-02 complete - dynamic model count infrastructure and UI integration done
- 3 fallback mappings validated: deepseek-r1-0528-syn, kimi-k2-thinking-syn, kimi-k2.5-syn

---
*Last updated: 2026-02-05 after 42-02-PLAN.md execution complete*
