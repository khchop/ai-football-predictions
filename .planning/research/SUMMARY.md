# v2.8 Model Coverage Research Summary

**Project:** BettingSoccer - 100% LLM Prediction Coverage
**Milestone:** v2.8 - Model Coverage
**Domain:** Multi-model LLM reliability for structured JSON predictions
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

Achieving 100% prediction coverage across 42 diverse LLMs (29 Together AI + 13 Synthetic.new, ranging from 3B to 671B parameters, spanning 8 model families) is a **diagnostic and configuration challenge**, not a capability gap. The existing infrastructure (4 prompt variants, 3 response handlers, multi-strategy JSON parser, per-model timeouts, fallback chains) is architecturally sound and follows 2026 best practices for structured LLM outputs.

The core problem is **visibility, not tooling**. Nine models are already configured with appropriate prompt variants and response handlers based on empirical testing (DeepSeek R1 reasoning models, GLM Chinese models, Kimi thinking models), but 33 models remain unconfigured with BASE defaults. Research shows these failures cluster into 6 categories: timeouts (reasoning models need 60-90s), thinking tag leakage (DeepSeek R1, Qwen3-Thinking), language mixing (GLM models default to Chinese), JSON wrapper text (DeepSeek V3.2 adds explanations), small model limitations (3B models struggle with JSON), and empty/API errors.

The recommended approach is **diagnose-first, fix-by-category, validate-continuously**: build diagnostic infrastructure with golden test fixtures, run all 42 models to categorize failures, apply targeted fixes in batches by failure type, and validate with regression tests. The critical risk is "whack-a-mole" prompt tuning where fixing Model A breaks Model B — prevented by immutable base prompts (all fixes via variants), regression test harnesses, and staged rollout protocols. Budget discipline is essential: reasoning models consume 5-10x tokens, fallback chains double costs, and timeouts >60s risk pipeline delays.

## Key Findings

### Recommended Stack

Current stack is **sufficient** — zero new runtime dependencies needed. Research confirms that Zod v4.3.6 for structured validation, Vitest v4.0.18 for testing, Pino v10.2.1 for structured logging, and the existing multi-strategy parser (4 fallback strategies) represent industry best practices for TypeScript LLM systems in 2026.

**Core technologies already in place:**
- **Zod v4.3.6**: Runtime schema validation — TypeScript-native, `.safeParse()` for error handling, industry standard for LLM outputs
- **Vitest v4.0.18**: Model testing with 60s timeout, concurrency control (p-limit) — prevents rate limiting during parallel testing
- **Pino v10.2.1**: Structured logging with module-specific instances — `loggers.llm`, `loggers.predictionsWorker` capture model errors
- **Multi-strategy parser**: 4-strategy fallback (direct JSON → markdown extraction → regex fallback → coercion) — handles 95%+ edge cases
- **PromptConfig system**: Per-model configuration (variant + handler + timeout) — existing architecture supports all needed customization

**Small additions recommended (dev tools, not runtime dependencies):**
1. **Single-model diagnostic script** (`scripts/test-single-model.ts`) — interactive debugging with raw response visibility (1 hour effort)
2. **Database metrics table** (`llm_model_stats`) — per-model success rates, failure breakdown by type, P95 latency tracking (2-3 hours)
3. **Error categorization** in existing Pino logs — add `errorType` field for structured filtering (30 minutes)

Total implementation effort: ~4 hours for enhanced observability. No production dependencies, no framework additions, no third-party observability platforms needed.

### Expected Features

**Must have (table stakes):**
- **Per-model success rate tracking** — database aggregation, can't optimize without measurement
- **Failure categorization** — timeout vs parse vs empty vs API errors require different fixes
- **Raw response logging** — need actual output to debug parsing failures
- **Model-specific configuration override** — already exists (PromptConfig), needs systematic application to all 42 models
- **Test fixture per model** — extend Vitest suite with snapshots for repeatability
- **Prompt variant effectiveness tracking** — track which variant works for which model family
- **Response handler effectiveness tracking** — some handlers may hurt certain models

**Should have (competitive):**
- **Model health dashboard** — single page, 42 cards, color-coded health (aggregation queries + UI)
- **Regression detection** — alert when previously-working model starts failing (success rate time series)
- **Cost-adjusted reliability scoring** — "best model" = reliability / cost, not just reliability
- **Automatic prompt variant discovery** — test all 4 variants on first failure, rank by success (batch testing + heuristics)

**Defer (v2+):**
- **Real-time model testing in production** — separate test harness, run on-demand or scheduled
- **Failure pattern clustering** — group similar failures (all 3B models fail same way) — NLP/similarity analysis
- **Batch prediction consistency check** — detect when model returns different results for same input (hash + compare)

### Architecture Approach

The architecture extends existing Phase 40 infrastructure (provider/prompt/handler system) with systematic diagnostics and targeted fixes. Core principle: **diagnose all 42 models → categorize failures → apply targeted fixes in batches → validate with test fixtures**.

**Major components:**

1. **Diagnostic Infrastructure** — Golden test fixtures (5 representative matches covering clear favorite, upset, draw, special characters), diagnostic runner (`runDiagnostics()` function), failure categorization (9 categories: timeout, parse error, thinking tags, markdown wrapped, non-English, empty response, rate limit, score out of range, invalid JSON), and report generation with fix recommendations

2. **Category-Based Fix System** — Failure categories map to specific fixes: timeout → increase `timeoutMs` (60-90s), thinking tags → `THINKING_STRIPPED` variant + `STRIP_THINKING_TAGS` handler, language mixing → `ENGLISH_ENFORCED` variant, markdown wrapped → `EXTRACT_JSON` handler, JSON with explanations → `JSON_STRICT` variant, unfixable models → fallback chains

3. **Validation and Monitoring** — Regression test suite (test all working models on every config change), Zod schema validation (add to all parsing functions, catch schema mismatches), production validation protocol (dev → staging → prod canary → prod soak → 3-day stability), model metrics tracking (database table with daily rollup: success rate, failure breakdown, P95 latency, fallback usage)

**Integration with existing systems:**
- PromptConfig system unchanged (variants/handlers/timeouts sufficient)
- Multi-strategy parser enhanced with strategy tracking (log which strategy succeeded per model)
- Error classification refined (map existing `ErrorType` enum to diagnostic `FailureCategory`)
- Fallback mapping expanded data-driven (diagnostics identify Synthetic → Together fallback candidates)

### Critical Pitfalls

1. **Whack-a-Mole Prompt Tuning (Oscillation Trap)** — Fixing Model A breaks Model B, coverage oscillates instead of increasing. **Prevention:** Immutable base prompts (never modify SYSTEM_PROMPT/BATCH_SYSTEM_PROMPT), regression test harness runs on every change, staged rollout protocol (1 model → 5 random → all 42), change log discipline (track config in `.planning/model-status.json`)

2. **Aggressive Timeout Escalation (Cost Spiral)** — Increasing timeouts creates cascading budget/pipeline problems. Reasoning models at 90s consume 10x tokens, block prediction jobs, exhaust daily budget by 3pm. **Prevention:** Timeout ceiling (60s hard cap, 90s for premium only), success rate monitoring by timeout tier (prove 60s→90s improves success >20%), token budget per model (calculate cost before deploying change), pipeline timing validation (total time < 10 min or matches miss kickoff)

3. **Fighting Unfixable Models (Sunk Cost Fallacy)** — Spending days on 3B model that can't do JSON, deprecated models, genuinely unstable APIs. **Prevention:** Objective "unfixable" criteria (5 fix attempts + success rate <50% → give up), give-up protocol (document attempts, mark inactive, quarterly re-test), coverage target adjustment (100% of viable models, not 100% of registered)

4. **JSON Mode False Security (Schema vs Syntax)** — `response_format: json_object` guarantees parseable JSON but not correct schema. Models invent fields (`home_goals` vs `homeScore`), return strings instead of numbers, nest structure unexpectedly. **Prevention:** Zod schema validation on ALL LLM responses (not just API endpoints), schema enforcement in prompts (explicit JSON structure in instructions), graceful coercion with logging (try snake_case, nested variants before rejecting)

5. **Dev-Prod Environment Divergence** — Models work in dev (sequential, unlimited quota) but fail in prod (parallel, rate limits, networked Redis, BullMQ delays, Turbopack builds). **Prevention:** Production-like staging environment (docker-compose with prod budgets, parallelism, data size), production validation protocol (dev → staging → prod canary → soak → 3-day stability), stop trusting dev as validation

## Implications for Roadmap

Based on research, suggested phase structure follows **protect → diagnose → fix → validate** order. Don't start with fixes — start with protection against making things worse.

### Phase 1: Foundations (Regression Protection)
**Rationale:** Cannot safely fix models without regression detection. Current risk: changing config for Model A breaks previously-working Model B, total coverage oscillates instead of increasing.
**Delivers:** Regression test suite (Vitest tests for all currently-working models), Zod schema validation (added to all parsing functions), production-like staging environment (docker-compose mimicking prod parallelism/budget/data)
**Addresses:** Whack-a-mole pitfall (most critical), dev-prod divergence pitfall
**Tech:** Vitest (existing), Zod (existing), docker-compose (new)
**Duration:** 3-4 days
**Research needed:** None — standard testing patterns

### Phase 2: Diagnostic Infrastructure
**Rationale:** Need visibility into which models fail and why before attempting fixes. Without diagnostics, fixes are guesswork.
**Delivers:** Golden test fixtures (5 representative matches), diagnostic runner (`runDiagnostics()` function), failure categorization logic (9 categories), diagnostic report with fix recommendations per model
**Output:** `.planning/diagnostics/REPORT-2026-02-07.md` showing X passing, Y failing, failures grouped by category
**Addresses:** Diagnostic blindness, current 33 unconfigured models
**Tech:** Existing LLMProvider interface, Vitest for test harness
**Duration:** 2-3 days
**Research needed:** None — implementation only

### Phase 3: Category Fixes - Timeouts
**Rationale:** Timeouts are fastest to fix (config change only), high impact (reasoning models need 60-90s). Diagnostic report identifies candidates.
**Delivers:** Timeout adjustments for failing models (based on diagnostic results), timeout ceiling enforcement (60s hard cap, 90s premium only), success rate monitoring by timeout tier
**Fixes:** DeepSeek R1 variants, Qwen3-Thinking, Kimi K2-Thinking (if not already configured)
**Addresses:** Timeout escalation pitfall (budget discipline)
**Tech:** PromptConfig.timeoutMs (existing)
**Duration:** 1 day
**Research needed:** None — config-only changes

### Phase 4: Category Fixes - Thinking Tags
**Rationale:** Thinking tags break JSON parsing completely. High priority after timeouts. Diagnostic report identifies which models leak tags.
**Delivers:** `THINKING_STRIPPED` variant + `STRIP_THINKING_TAGS` handler applied to reasoning models outputting `<think>`, `<thinking>`, `<reasoning>` tags
**Fixes:** Any unconfigured DeepSeek/Qwen/Kimi reasoning variants
**Addresses:** Thinking tag leakage failure mode
**Tech:** PromptVariant.THINKING_STRIPPED, ResponseHandler.STRIP_THINKING_TAGS (existing)
**Duration:** 1 day
**Research needed:** None — existing handlers proven

### Phase 5: Category Fixes - Language Enforcement
**Rationale:** GLM models default to Chinese, breaking JSON key parsing. Diagnostic report identifies language mixing.
**Delivers:** `ENGLISH_ENFORCED` variant applied to Chinese-language-default models (GLM family)
**Fixes:** GLM-4.6, GLM-4.7 (if not already configured), any other Chinese models
**Addresses:** Language mixing failure mode
**Tech:** PromptVariant.ENGLISH_ENFORCED (existing)
**Duration:** 1 day
**Research needed:** None — prompt-only fix

### Phase 6: Category Fixes - JSON Extraction
**Rationale:** Some models wrap JSON in markdown or add explanations despite `json_object` mode. Diagnostic report identifies wrappers.
**Delivers:** `EXTRACT_JSON` handler applied to models wrapping output, optionally `JSON_STRICT` variant for prevention
**Fixes:** DeepSeek V3.2, GPT-OSS-120B (if not already configured), any models with markdown blocks
**Addresses:** Markdown wrapper failure mode
**Tech:** ResponseHandler.EXTRACT_JSON, PromptVariant.JSON_STRICT (existing)
**Duration:** 1 day
**Research needed:** None — handler proven effective

### Phase 7: Observability Enhancement
**Rationale:** Long-term maintenance requires per-model metrics, not just diagnostic runs. Track success rates over time for regression detection.
**Delivers:** Database metrics table (`llm_model_stats`: success rate, failure breakdown by type, P95 latency, fallback usage), admin endpoint `/api/admin/model-stats?model_id=X&days=7`, error type categorization in Pino logs
**Addresses:** Monitoring gaps, regression detection, budget tracking (fallback costs)
**Tech:** PostgreSQL (existing), Drizzle ORM (existing), Pino (existing)
**Duration:** 2-3 days
**Research needed:** None — database design straightforward

### Phase 8: Fallback Chain Expansion (Optional)
**Rationale:** For models that fail all fixes (Phases 3-6), add Synthetic → Together fallbacks if equivalent exists.
**Delivers:** Additional MODEL_FALLBACKS mappings (data-driven from diagnostic results), fallback cost tracking (cost per prediction with fallback), fallback usage metrics
**Addresses:** Unfixable model mitigation
**Tech:** getFallbackProvider() (existing)
**Duration:** 1-2 days
**Research needed:** None — pattern already implemented (3 existing fallbacks)

### Phase 9: Comprehensive Validation
**Rationale:** Final validation ensures no regressions, documents remaining failures, sets baseline for ongoing monitoring.
**Delivers:** Final diagnostic run (all 42 models), before/after comparison report, documentation for remaining failures (severity + mitigation), monitoring dashboard integration (coverage % in admin panel)
**Success criteria:** 95%+ models pass (40/42), remaining failures documented with acceptance criteria
**Tech:** All existing components
**Duration:** 1-2 days
**Research needed:** None — validation only

### Phase Ordering Rationale

- **Foundations first (Phase 1)** — Regression tests prevent oscillating coverage during fixes. Without protection, fixes may break working models.
- **Diagnostics before fixes (Phase 2)** — Cannot target fixes without knowing failure categories. Diagnostics turn guesswork into data-driven decisions.
- **Category-based fix sequence (Phases 3-6)** — Ordered by impact and ease: timeouts (config-only, high impact) → thinking tags (high priority, breaks parsing) → language (prompt-only) → extraction (defensive).
- **Observability after fixes (Phase 7)** — Diagnostics provide one-time snapshots, observability tracks trends over time for regression detection.
- **Fallbacks as last resort (Phase 8)** — Only for truly unfixable models. Most models should succeed with proper config.
- **Comprehensive validation last (Phase 9)** — Validates all phases together, sets production baseline, confirms no regressions.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **All phases** — No deep research needed. Patterns are established (Zod validation, Vitest testing, diagnostic fixtures), stack is proven, fixes are config-based.

**Execution notes:**
- Phase 1 requires production-like staging environment (docker-compose setup) — 1-day overhead
- Phase 2 diagnostic run will reveal actual failure distribution (may adjust Phase 3-6 priorities)
- Phase 7 database schema should include fallback tracking from day 1 (avoid migration later)
- If diagnostics show >10 models unfixable, revisit coverage target (95% may be realistic ceiling)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Zod/Vitest/Pino verified 2026 best practices, multi-strategy parser proven in production, no gaps identified |
| **Features** | HIGH | Diagnostic infrastructure follows standard testing patterns (golden fixtures, categorization, report generation), no novel approaches needed |
| **Architecture** | HIGH | Extends existing Phase 40 infrastructure (PromptConfig system), integration points clear, no rewrites required |
| **Pitfalls** | HIGH | Whack-a-mole oscillation confirmed in production data, timeout escalation/budget spirals documented in research, dev-prod divergence matches quick-013 experience |

**Overall confidence:** HIGH

Research is grounded in existing codebase (9 models already configured with variants/handlers), verified against 2026 LLM best practices (Zod for structured outputs, multi-strategy parsing, per-model timeouts), and informed by production experience (Phase 40 implementation, quick-013 turbopack issues, budget tracking in place).

### Gaps to Address

**During diagnostic run (Phase 2):**
- **Actual failure distribution unknown** — 33 unconfigured models may fail in unexpected ways. Diagnostic run will reveal if new failure categories exist beyond 9 identified. If so, may need additional response handler or prompt variant (unlikely based on research — current 4 variants cover known patterns).
- **Small model viability (3B-7B)** — Research suggests small models struggle with JSON, but no empirical data for specific models (Gemma 3B, Llama 3.2 3B). Diagnostic run will determine if these should be marked unfixable or need special config. Budget constraint may favor disabling if success rate <70%.
- **Synthetic.new API behavior** — 13 models on Synthetic.new provider with limited documentation. Unknown if API quirks differ from Together AI. Diagnostic run will reveal Synthetic-specific issues (if any).

**During observability phase (Phase 7):**
- **Fallback cost impact** — Currently tracked in logs (COST-01 warning) but not aggregated. Database metrics will quantify actual budget impact of fallback chains. If fallback rate >30%, may need cost ceiling enforcement (reject fallback if >3x original model cost).
- **Production rate limits** — Dev testing won't reveal provider rate limits at scale (42 models, 100+ predictions/day). May need throttling or batch size adjustments discovered in production validation.

**Post-validation (Phase 9):**
- **Acceptance criteria for <100% coverage** — If 2-3 models remain unfixable after all phases, need documented decision: disable permanently, keep trying quarterly, or accept failed predictions (depends on leaderboard impact). Stakeholder decision required.

## Sources

### High Confidence (Existing Codebase)
- `src/lib/llm/providers/base.ts` — Provider architecture, `callAPIWithFallback()`, retry logic
- `src/lib/llm/prompt-variants.ts` — 4 existing variants (BASE, ENGLISH_ENFORCED, JSON_STRICT, THINKING_STRIPPED)
- `src/lib/llm/response-handlers.ts` — 3 existing handlers (DEFAULT, EXTRACT_JSON, STRIP_THINKING_TAGS)
- `src/lib/llm/prompt.ts` — Multi-strategy JSON parser (4 fallback strategies)
- `.planning/phases/40-model-specific-prompt-selection/40-RESEARCH.md` — Phase 40 architecture documentation
- `.planning/phases/41-fallback-orchestrator/41-RESEARCH.md` — Fallback chain implementation

### High Confidence (Web Research - Structured Outputs)
- [Zod TypeScript-first schema validation](https://github.com/colinhacks/zod) — Industry standard for LLM outputs
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) — `json_object` vs `json_schema` modes
- [DeepSeek JSON Mode](https://api-docs.deepseek.com/guides/json_mode) — Official docs, thinking tag warnings
- [vLLM Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs/) — Multi-provider JSON mode support
- [Together.ai JSON Mode](https://docs.together.ai/docs/json-mode) — Provider-specific implementation

### High Confidence (Web Research - LLM Testing)
- [LLM Testing in 2026: Top Methods](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) — Golden datasets, test fixtures
- [Pragmatic guide to LLM evals](https://newsletter.pragmaticengineer.com/p/evals) — Production validation protocols
- [Testing LLMs in Production](https://www.leewayhertz.com/how-to-test-llms-in-production/) — Dev-prod divergence patterns
- [Golden Datasets for GenAI Testing](https://www.techment.com/blogs/golden-datasets-for-genai-testing/) — Test fixture design

### High Confidence (Web Research - Production Reliability)
- [Multi-provider LLM orchestration](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) — Fallback chains, rate limiting
- [LLM Tool-Calling in Production](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8) — Timeout escalation risks
- [LLM Failure Modes](https://medium.com/@adnanmasood/a-field-guide-to-llm-failure-modes-5ffaeeb08e80) — Categorization patterns
- [Budget limits and alerts](https://portkey.ai/blog/budget-limits-and-alerts-in-llm-apps/) — Cost tracking strategies

### Medium Confidence (Model Family Patterns)
- [Chinese Open-Source LLMs Overview](https://intuitionlabs.ai/articles/chinese-open-source-llms-2025) — GLM language defaults, MiniMax architecture
- [DeepSeek R1 thinking tags issue](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/575) — Confirmed thinking tag + JSON mode conflict
- [Kimi K2 Thinking Model](https://recodechinaai.substack.com/p/kimi-k2-thinking-the-46m-model-shifting) — Reasoning capabilities
- [Small Language Models Guide](https://www.datacamp.com/blog/top-small-language-models) — 3B-7B model limitations

---

*Research completed: 2026-02-07*
*Ready for roadmap: yes*
*Next step: Define milestone requirements with roadmapper agent*
