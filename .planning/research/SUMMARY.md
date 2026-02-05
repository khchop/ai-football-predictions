# Project Research Summary

**Project:** AI Football Predictions Platform v2.5
**Domain:** Model Reliability & Dynamic Counts for Multi-LLM System
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

v2.5 Model Reliability & Dynamic Counts is a **refactoring milestone**, not a feature build. The platform already has 36 LLM models with auto-disable logic, multi-strategy JSON parsing, and fallback infrastructure. The goal is to leverage existing capabilities to fix 6 failing models and replace hardcoded "35 models" text with dynamic counts.

**Key insight:** The recommended approach requires **ZERO new dependencies**. All infrastructure already exists: `MODEL_FALLBACKS` map is defined, `getProviderStats()` returns counts, and `callAPI()` accepts custom prompts. The challenge is integration without breaking 29 working Together AI models.

**Critical risks:**
1. **Breaking working models** - Model-specific prompts must use exact ID matching with fallback to base prompts (prevents Pitfall 3)
2. **Fallback loops** - Cycle detection and max depth limits prevent infinite retries that consume all workers (prevents Pitfall 2)
3. **Cost explosion** - Fallback from cheap Synthetic ($0.40/1M) to expensive Together premium ($3.00/1M) multiplies costs 7.5x without budget guards (prevents Pitfall 1)

## Key Findings

### Recommended Stack (from STACK.md)

**No new dependencies required.** This is a refactoring milestone leveraging existing infrastructure.

**Core technologies (unchanged):**
- **TypeScript 5.x** — Discriminated unions handle prompt mapping with compile-time safety
- **Next.js 16** — Server Components call `getProviderStats()` for dynamic counts
- **PostgreSQL 15.x** — `models.autoDisabled` tracks health (schema already exists)
- **BullMQ 5.x** — Prediction worker modified, not replaced

**What NOT to add:**
- LangChain/PromptLayer (10MB+ bundle for simple string mapping)
- LiteLLM/Portkey gateway (adds 50-200ms latency per call)
- TensorFlow.js (prompt selection is deterministic, no ML needed)

**Implementation patterns:**
1. **Prompt selection** — TypeScript discriminated union maps model ID → prompt variant (<2ms overhead)
2. **Fallback chain** — 15-line try-catch wrapper with cycle detection and depth limits
3. **Dynamic counts** — Existing `getProviderStats()` function, just use it consistently

**Performance:**
- Prompt selection: <2ms per prediction (0.01% of 30s LLM call)
- Fallback overhead: 0ms if primary succeeds (95% of cases), +30s if fallback used (4%)
- Dynamic count query: <1ms per page render (trivial array length)

### Expected Features (from FEATURES.md)

**Must have (table stakes):**
- **Model-specific prompt templates** — Different models require different prompting styles (GLM needs English enforcement, thinking models need tag suppression)
- **Automatic fallback chain** — Primary failures should retry with alternative providers transparently
- **Structured output enforcement** — JSON responses must be valid (current issue: DeepSeek V3.2, Qwen3-235B-Thinking return natural language)
- **Dynamic model count display** — UI should reflect actual active models, not hardcoded 35 (critical issue: 6 models disabled = 30 active, but metadata says 35)
- **Model-specific timeouts** — Thinking models need 60s, fast models 15-30s (current: universal 30s causes Kimi K2.5, GLM timeouts)

**Should have (competitive):**
- **Model performance leaderboard** — Add reliability tab to existing leaderboard (uptime %, parse success %, latency)
- **Model warmup/cooldown** — Gradually reintroduce disabled models with reduced traffic (circuit breaker half-open state)
- **Model health monitoring API** — Endpoint returning per-model success rates, latency, last failure time

**Explicitly defer (v2.6+):**
- Adaptive prompt optimization (requires telemetry infrastructure)
- Cost-aware routing (requires cost tracking first)
- A/B testing framework (premature for current scale)
- Predictive circuit breaking (ML complexity not justified yet)

### Architecture Approach (from ARCHITECTURE.md)

**Integration strategy: Minimal invasive changes.** Add thin layers around existing abstractions, don't rewrite core logic.

**Major components:**

1. **Prompt Selector** (`src/lib/llm/prompt-selector.ts` NEW)
   - Responsibility: Map model ID → appropriate prompt variant
   - Pattern: Compositional (shared components + model-specific overrides)
   - Integration: Called before `callAPI()` in predictions worker
   - Prevents: Pitfall 6 (prompt template sprawl via composition over duplication)

2. **Fallback Orchestrator** (`src/lib/llm/fallback.ts` NEW)
   - Responsibility: Wrap `callAPI()` with try-catch + fallback logic
   - Pattern: Returns tuple `[response, actualProvider]` for transparency
   - Integration: Replaces direct `callAPI()` in worker
   - Prevents: Pitfall 2 (cycle detection), Pitfall 4 (re-checks disabled status)

3. **Active Count Query** (enhance existing `getProviderStats()`)
   - Responsibility: Single source of truth for model counts
   - Pattern: Stateless computation, no database query overhead
   - Integration: Replace 15+ hardcoded "35 models" references
   - Prevents: Pitfall 5 (stale cache inconsistency)

**Build order:**
1. Phase 1: Prompt Selection (3-4 hours) — Independent, can start immediately
2. Phase 2: Fallback Orchestration (6-8 hours) — Depends on Phase 1 (needs prompt selector for fallback models)
3. Phase 3: Dynamic Counts (2-3 hours) — Independent, can be parallel
4. Phase 4: Validation (2-3 hours) — Depends on 1-3

**Total effort:** 13-18 hours over 3-4 days

**Success criteria:**
- 29 working Together models maintain >95% success rate (don't break existing)
- 6 disabled Synthetic models re-enabled with >90% success rate
- Model counts consistent across all pages (0 discrepancies)
- Fallback frequency <5% (most models work without fallback)

### Critical Pitfalls (from PITFALLS.md)

1. **Fallback Chain Cost Explosion (Pitfall 1)**
   - Risk: Fallback from $0.40/1M Synthetic to $3.00/1M Together premium = 7.5x cost multiplier
   - Prevention: Add budget guards, log cost impact, circuit breaker if daily spend exceeds threshold
   - Detection: Monitor Together AI spend per hour, alert if >2x baseline

2. **Fallback Loop of Death (Pitfall 2)**
   - Risk: Model A → fallback to Model B → B also fails → fallback to A → infinite loop consumes workers
   - Prevention: Cycle detection at startup (fail-fast), track `attemptedModels: Set<string>`, max depth limit of 3
   - Detection: Worker CPU at 100%, same match stuck pending for hours, log shows model ID appearing multiple times

3. **Silent Prompt Override Breaking Working Models (Pitfall 3)**
   - Risk: Model-specific prompt logic bug applies to wrong models, breaks 29 working Together AI models
   - Prevention: Exact ID matching only (`modelId === 'exact-id'` not `includes()`), fallback to base prompt, integration test all 36 models
   - Detection: Working models suddenly disabled, parse errors in previously reliable models

4. **Race Condition Between Auto-Disable and Fallback (Pitfall 4)**
   - Risk: Model fails 5 times → auto-disabled → but fallback job already queued → runs after disable → database inconsistency
   - Prevention: Re-check disabled status immediately before API call, not just at job start
   - Detection: Models with `consecutiveFailures > 5` in database

5. **Stale Model Count Cache Inconsistency (Pitfall 5)**
   - Risk: Homepage shows "35 models", leaderboard "36 models", match page "30 models" - users see different counts
   - Prevention: Single source of truth (`getActiveModelCount()`), atomic cache invalidation on model state change
   - Detection: Different counts across pages, count doesn't update after model recovery

## Implications for Roadmap

Based on research, this milestone decomposes into 3 sequential phases plus validation:

### Phase 1: Model-Specific Prompt Selection

**Rationale:** Foundation layer — must fix structured output before fallbacks work. If fallback to broken model, fallback still fails.

**Delivers:**
- `src/lib/llm/prompt-selector.ts` with compositional prompt architecture
- Model-specific variants: GLM English enforcement, thinking tag suppression, Kimi structured output emphasis
- Integration with predictions worker

**Addresses features:**
- Model-specific prompt templates (table stakes from FEATURES.md)
- Structured output enforcement (table stakes from FEATURES.md)

**Avoids pitfalls:**
- Pitfall 3: Exact ID matching with fallback to base prompt (don't break working models)
- Pitfall 6: Compositional prompts (shared components + overrides, not full duplication)

**Estimated effort:** 3-4 hours

**Research needs:** None (patterns well-documented, straightforward implementation)

### Phase 2: Fallback Chain Orchestration

**Rationale:** Reliability layer — builds on prompt selection. Synthetic models now return valid JSON (Phase 1), fallback provides redundancy when Synthetic infrastructure fails.

**Delivers:**
- `src/lib/llm/fallback.ts` with cycle detection and depth limits
- Fallback mapping validation at startup (no cycles)
- Enhanced `recordModelSuccess()` to track fallback usage

**Uses stack elements:**
- Existing `MODEL_FALLBACKS` map (already defined in v2.4)
- Existing `getFallbackProvider()` function (already exists)
- BullMQ worker modifications (existing pipeline)

**Implements architecture:**
- Fallback Orchestrator component with transparency pattern (returns tuple `[response, provider]`)

**Avoids pitfalls:**
- Pitfall 1: Cost guards (log warning if fallback >2x more expensive)
- Pitfall 2: Cycle detection graph validation at startup + max depth 3
- Pitfall 4: Re-check disabled status before fallback execution
- Pitfall 11: Track fallback metadata (`originalModelId`, `fallbackModelId`)

**Estimated effort:** 6-8 hours

**Research needs:** None (standard fallback patterns, test cross-provider API compatibility)

### Phase 3: Dynamic Model Counts

**Rationale:** Independent of other phases — can happen in parallel. Fixes user-facing inconsistency (hardcoded "35 models" vs actual 30 active).

**Delivers:**
- Replace 15+ hardcoded "35 models" references with `getProviderStats().active`
- Cache invalidation on model recovery
- Consistent counts across homepage, leaderboard, match pages, system prompts, content generation

**Addresses features:**
- Dynamic model count display (table stakes from FEATURES.md)

**Avoids pitfalls:**
- Pitfall 5: Single source of truth (`getActiveModelCount()`)
- Pitfall 8: Cache invalidation in recovery worker

**Estimated effort:** 2-3 hours

**Research needs:** None (find/replace with query, validate consistency)

### Phase 4: Validation & Rollout

**Rationale:** Risk mitigation — comprehensive testing before enabling fallbacks for all models. Gradual rollout prevents breaking production.

**Delivers:**
- Integration tests for all 36 models
- Validation script confirming custom prompts work
- Fallback chain testing (force failures, verify fallback)
- Monitoring queries for fallback frequency
- Gradual rollout plan (2 models → 4 models → all models)

**Estimated effort:** 2-3 hours

**Research needs:** None (standard testing practices)

### Phase Ordering Rationale

**Sequential dependencies:**
- Prompt selection BEFORE fallback (fallback to broken model still fails)
- Fallback BEFORE validation (need implementation to test)

**Parallel work:**
- Dynamic counts independent (can happen anytime)

**Why this grouping:**
- Phase 1+2 form "reliability core" (prompts + fallbacks)
- Phase 3 is "user-facing consistency" (separate concern)
- Phase 4 is "quality gate" (validates everything)

**How this avoids pitfalls:**
- Gradual rollout (Phase 4) catches integration issues before full deployment
- Prompt selection first (Phase 1) ensures fallbacks have valid targets
- Dynamic counts separate (Phase 3) prevents coupling with reliability changes

### Research Flags

**No phases need deeper research.** All patterns well-documented:
- Prompt selection: Standard TypeScript pattern (discriminated unions)
- Fallback chains: Industry-standard pattern (Portkey, LangChain, Statsig)
- Dynamic counts: Simple refactoring (find/replace)

**If complexity increases:**
- Phase 2 might need API compatibility research if cross-provider fallback shows issues
- Phase 3 might need cache strategy research if invalidation causes performance issues

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Based on direct codebase analysis, all infrastructure exists |
| Features | **HIGH** | 6 disabled models with documented failure modes, clear requirements |
| Architecture | **HIGH** | Integration strategy preserves existing abstractions, minimal invasive changes |
| Pitfalls | **HIGH** | Derived from codebase analysis (15+ hardcoded references found, 6 model failures documented) |

**Overall confidence:** HIGH

### Gaps to Address

**Validated during Phase 2 (Fallback Implementation):**
- Cross-provider API compatibility (Together AI vs Synthetic parameter differences)
- Cost multipliers for each fallback route (need to validate pricing)

**Validated during Phase 4 (Testing):**
- Whether custom prompts actually fix GLM, Kimi, Qwen failures (test-driven validation)
- Fallback frequency in production (may be higher or lower than 5% estimate)

**Not blocking, but monitor:**
- Whether 60s timeout is sufficient for Kimi K2.5, GLM 4.6 (may need 90s)
- Whether model-specific prompts need per-competition variants (defer to v2.6 unless accuracy drops)

## Sources

### Primary (HIGH confidence)

**Existing codebase:**
- `src/lib/llm/index.ts` — MODEL_FALLBACKS (line 24), getProviderStats() (line 115), getActiveProviders() (line 68)
- `src/lib/llm/prompt.ts` — SYSTEM_PROMPT, BATCH_SYSTEM_PROMPT templates, JSON parser with tag stripping
- `src/lib/llm/providers/base.ts` — callAPI() method (line 203), timeout configuration (line 194)
- `src/lib/llm/providers/synthetic.ts` — 6 disabled models with documented failure modes
- `src/lib/queue/workers/predictions.worker.ts` — Prediction pipeline integration points

**2026 Research (model-specific prompts):**
- [DeepSeek Prompt Engineering Guide: Master R1 & V3 Models](https://passhulk.com/blog/deepseek-prompt-engineering-guide-master-r1-v3-models-2025/) — Empty system prompts best for R1, suppress thinking tags
- [Use ChatGPT, Claude, DeepSeek, Kimi, Gemini, Grok, GLM at one place](https://datascienceinyourpocket.com/2026/01/03/use-chatgpt-claude-deepseek-kimi-gemini-grok-glm-at-one-place-for-free/) — GLM 4.6 multi-step agent planning, Chinese model needs English enforcement

**2026 Research (fallback chains):**
- [Provider fallbacks: Ensuring LLM availability (Statsig)](https://www.statsig.com/perspectives/providerfallbacksllmavailability) — Fallback trigger patterns, monitoring
- [Multi-provider LLM orchestration (DEV Community)](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) — Multi-tier chains, load balancing

### Secondary (MEDIUM confidence)

**Prompt engineering:**
- [Prompt Engineering Guide 2026 | AnalyticsVidhya](https://www.analyticsvidhya.com/blog/2026/01/master-prompt-engineering/)
- [The Ultimate Guide to Prompt Engineering in 2026 | Lakera](https://www.lakera.ai/blog/prompt-engineering-guide)

**Structured output:**
- [The guide to structured outputs and function calling with LLMs | Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Reliable JSON-Only Responses with DeepInfra LLMs | DeepInfra](https://deepinfra.com/blog/deepinfra-json-only-responses)

**Circuit breaker pattern:**
- [Circuit Breaker Pattern - Azure Architecture Center | Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Building a Circuit Breaker for LLM Services in Laravel](https://andyhinkle.com/blog/building-a-circuit-breaker-for-llm-services-in-laravel)

**Anti-patterns:**
- [Patterns and Anti-Patterns for Building with LLMs | Medium](https://medium.com/marvelous-mlops/patterns-and-anti-patterns-for-building-with-llms-42ea9c2ddc90)
- [Retries, fallbacks, and circuit breakers in LLM apps | Portkey](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/)

### Tertiary (LOW confidence)

- [LiteLLM: A Unified LLM API Gateway (Medium)](https://medium.com/@mrutyunjaya.mohapatra/litellm-a-unified-llm-api-gateway-for-enterprise-ai-de23e29e9e68) — Gateway patterns (rejected, Python-only)
- [Top 5 LLM Gateways in 2025 (Maxim.ai)](https://www.getmaxim.ai/articles/top-5-llm-gateways-in-2025-the-definitive-guide-for-production-ai-applications/) — Bifrost 11µs overhead (rejected, adds dependency)

---

**Research completed:** 2026-02-05
**Ready for roadmap:** Yes

**Next step:** Orchestrator should proceed to requirements definition, structuring milestone into 4 phases as recommended above.
