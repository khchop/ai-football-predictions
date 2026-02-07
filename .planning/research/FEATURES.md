# Feature Landscape: LLM 100% Prediction Coverage

**Domain:** Multi-model LLM reliability for structured JSON output
**Researched:** 2026-02-07
**Context:** 42 models (29 Together AI + 13 Synthetic), 3B-671B parameters, 13+ organizations

## Executive Summary

Achieving 100% prediction coverage across 42 diverse LLMs requires **per-model diagnostic capabilities** rather than universal fixes. The existing system has strong foundation (prompt variants, response handlers, timeout configs, retry logic, fallback chains), but lacks **visibility into per-model failure patterns** and **structured remediation workflows**.

Research shows that the 2026 LLM observability landscape emphasizes per-model traces, real-time failure categorization, and multi-strategy parsing. The challenge is not "one prompt to rule them all" but "42 configurations validated with 42 diagnostic dashboards."

## Table Stakes

Features users expect. Missing = incomplete diagnostic capability.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Per-model success rate tracking** | Can't optimize what you don't measure | Low | Database column + aggregation query |
| **Raw response logging** | Need to see actual output to debug parsing failures | Low | Already captured in code, needs persistence |
| **Failure categorization** | Different errors need different fixes (timeout vs parse vs empty) | Medium | Enum + error type detection |
| **Prompt variant effectiveness tracking** | Need data to prove which variant works for which model | Medium | Track variant used + success/failure per model |
| **Response handler effectiveness tracking** | Some handlers may hurt performance on certain models | Medium | Track handler used + parse success rate |
| **Model-specific configuration override** | Some models need 90s timeout, others 15s | Low | Already exists (PromptConfig), needs UI exposure |
| **Test fixture per model** | Can't validate fixes without repeatable test cases | Low | Extend existing Vitest suite with snapshots |
| **Timeout failure detection** | Separate "model is slow" from "model is broken" | Low | Already detectable from error type |
| **Parse failure detection** | JSON extraction failed vs JSON was invalid | Low | Add parse strategy used to error context |
| **Empty response detection** | Model returned 200 but no content | Low | Already handled, needs explicit categorization |

## Differentiators

Features that set this system apart. Not expected, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic prompt variant discovery** | System tests all 4 variants on first failure, finds winner | High | Requires batch testing + heuristic ranking |
| **Response handler A/B testing** | Compare 3 handlers on same response, pick best | Medium | Parse with all handlers, compare valid JSON rate |
| **Model health dashboard** | Single page showing 42 models, color-coded health | Medium | UI + aggregation queries |
| **Failure pattern clustering** | Group similar failures (all 3B models fail same way) | High | Requires NLP/similarity analysis of errors |
| **Model family inheritance** | Configure all DeepSeek models at once, override individually | Medium | Hierarchical config system |
| **Synthetic response validation** | Detect when model returns valid JSON but nonsense predictions | Medium | Check score ranges, detect patterns like "0-0 every time" |
| **Regression detection** | Alert when previously-working model starts failing | Medium | Track success rate over time, alert on drops |
| **Cost-adjusted reliability scoring** | "Best model" = reliability / cost, not just reliability | Low | Simple calculation from existing data |
| **Batch prediction consistency check** | Detect when model returns different results for same input | Medium | Hash inputs, compare outputs across runs |
| **Model retirement recommendations** | Identify models that consistently fail despite tuning | Low | Threshold-based (e.g., <50% success over 100 runs) |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Universal prompt that works for all models** | Research shows model-specific configs are necessary | Maintain per-model config library, auto-select best |
| **Automatic model disabling** | Kills models during temporary provider outages | Manual disable with recommendation, not auto-disable |
| **Real-time model testing in production** | Production traffic shouldn't be test load | Separate test harness, run on-demand or scheduled |
| **Trying all 42 models per match** | 42x API costs, 42x timeout risk | Use cost-tier system, run premium models selectively |
| **Parsing with LLMs** | Using GPT-4 to fix broken JSON is expensive/slow | Multi-strategy parser with fallback hierarchy |
| **Retraining models** | You don't own the models, can't retrain | Prompt engineering + response handling only |
| **Model-specific code branches** | `if (model === 'deepseek-r1')` anti-pattern | Configuration-driven with PromptConfig system |
| **Ignoring cost in health metrics** | "This model works great!" (costs $10 per prediction) | Always show cost-adjusted metrics |
| **Version pinning without monitoring** | "DeepSeek V3.1 works" but V3.2 is broken | Version awareness + regression testing |
| **Building custom LLM router** | Reinventing LangChain/LiteLLM poorly | Use existing infra (fallback chains already exist) |

## Feature Dependencies

```
Core Infrastructure (EXISTS)
├── PromptConfig system (prompt variants + response handlers + timeouts)
├── Multi-strategy parser (JSON extraction with 3 fallback strategies)
├── Fallback chains (Together AI fallback for Synthetic models)
├── Retry logic (3x exponential backoff)
└── Vitest integration tests (all 42 models)

Per-Model Diagnostics (NEEDED FOR 100% COVERAGE)
├── Persistence layer
│   ├── prediction_attempts table (raw responses, errors, timing)
│   ├── model_health_stats table (aggregated success rates)
│   └── config_experiments table (variant/handler A/B test results)
├── Classification layer
│   ├── Error type detection (timeout, parse, empty, API error)
│   ├── Parse strategy tracking (which handler succeeded)
│   └── Response quality validation (valid JSON but bad predictions)
└── Visualization layer
    ├── Model health dashboard (42 cards, color-coded)
    ├── Model detail page (error log, raw responses, config history)
    └── Failure clustering view (group similar errors)

Automated Remediation (DIFFERENTIATOR)
├── Prompt variant discovery (test all 4, rank by success)
├── Response handler A/B testing (test all 3, pick winner)
└── Config recommendation system (suggest timeouts, handlers)
```

## MVP Recommendation

For milestone "Achieve 100% prediction coverage", prioritize:

### Phase 1: Visibility (Week 1)
1. **Persistence layer** - Log raw responses, errors, configs used
2. **Failure categorization** - Enum for timeout/parse/empty/API errors
3. **Model health dashboard** - Single page showing success rates per model
4. **Manual config testing** - CLI tool to test all variants on one model

### Phase 2: Diagnosis (Week 2)
5. **Model detail page** - Deep dive into one model's failures
6. **Raw response viewer** - See what model actually returned
7. **Config history** - Track what configs have been tried
8. **Failure filtering** - Show only timeouts, only parse errors, etc.

### Phase 3: Remediation (Week 3)
9. **Prompt variant effectiveness** - Which variant works for which model family
10. **Response handler effectiveness** - Which handler fixes which parse errors
11. **Timeout tuning recommendations** - Suggest timeout based on P95 latency
12. **Regression detection** - Alert when working model starts failing

Defer to post-MVP:
- **Automatic variant discovery** (High complexity, can be manual for 42 models)
- **Failure pattern clustering** (Nice-to-have, not blocking coverage)
- **Batch consistency checking** (Quality concern, not coverage blocker)
- **Cost-adjusted scoring** (Optimization, coverage first)

## Model Family Patterns (Research Findings)

### DeepSeek Family (8 models: 2 Together + 6 Synthetic)
**Common issues:**
- **Thinking tags in output** (R1, R1-0528): Models output `<think>...</think>` tags that break JSON parsing
- **JSON with explanations** (V3.2): Adds "Here's my prediction:" before JSON
- **Slow reasoning models** (R1 variants): Need 60s+ timeouts

**Remediation:**
- R1 variants: `THINKING_STRIPPED` variant + `STRIP_THINKING_TAGS` handler + 60s timeout
- V3.2: `JSON_STRICT` variant + `EXTRACT_JSON` handler + 45s timeout
- V3.1, V3-0324: Standard config works

**Sources:**
- [DeepSeek JSON Mode docs](https://api-docs.deepseek.com/guides/json_mode) - MEDIUM confidence (official docs)
- [Thinking tags + JSON mode conflict](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/575) - HIGH confidence (confirmed issue)

### Qwen Family (5 models: 4 Together + 1 Synthetic)
**Common issues:**
- **Thinking tags in reasoning models** (Qwen3-235B-Thinking): Similar to DeepSeek R1
- **Reliable for standard models** (Qwen2.5, Qwen3 non-thinking): Generally work with base config

**Remediation:**
- Thinking variants: `THINKING_STRIPPED` + `STRIP_THINKING_TAGS` + 90s timeout
- Standard variants: Base config (15s timeout sufficient)

**Sources:**
- [Qwen structured outputs](https://docs.vllm.ai/en/latest/features/structured_outputs/) - MEDIUM confidence
- Model family reputation in 2026 - LOW confidence (WebSearch only)

### GLM Family (2 models: Synthetic only)
**Common issues:**
- **Chinese language defaults**: Models prefer Chinese for reasoning
- **Inconsistent JSON formatting**: May add explanations in Chinese

**Remediation:**
- `ENGLISH_ENFORCED` variant (GLM-4.6)
- `ENGLISH_ENFORCED` + `EXTRACT_JSON` handler (GLM-4.7, more explanation-prone)
- 60s timeout for both

**Sources:**
- [Chinese LLM language defaults](https://intuitionlabs.ai/articles/chinese-open-source-llms-2025) - MEDIUM confidence
- [GLM architecture and capabilities](https://www.interconnects.ai/p/chinas-top-19-open-model-labs) - LOW confidence

### Llama Family (8 models: All Together AI)
**Common issues:**
- **Small models struggle with JSON** (3.2-3B, 3-8B-Lite): Limited instruction-following
- **Large models reliable** (3.1-405B, 4-Maverick, 3.3-70B): High JSON compliance
- **Timeout variation by size**: 3B needs 15s, 405B may need 30s

**Remediation:**
- Small models (<10B): May need `JSON_STRICT` variant to enforce format
- Large models (70B+): Standard config
- Monitor P95 latency, adjust timeouts per model

**Sources:**
- [Llama family structured outputs](https://docs.together.ai/docs/json-mode) - HIGH confidence (official Together AI docs)
- [Small models JSON limitations](https://www.datacamp.com/blog/top-small-language-models) - LOW confidence (general discussion)

### Kimi/Moonshot Family (3 models: 2 Together + 1 Synthetic)
**Common issues:**
- **K2-Thinking tags**: Similar to DeepSeek/Qwen reasoning models
- **K2.5 and K2-Instruct variants**: Generally reliable with standard config

**Remediation:**
- K2-Thinking: `THINKING_STRIPPED` + `STRIP_THINKING_TAGS` + 60s timeout
- K2.5, K2-Instruct: Base config

**Sources:**
- [Kimi K2 reasoning capabilities](https://recodechinaai.substack.com/p/kimi-k2-thinking-the-46m-model-shifting) - LOW confidence
- Synthetic.new model behavior - Not documented (LOW confidence)

### MiniMax Family (2 models: Synthetic only)
**Common issues:**
- **Limited documentation**: Behavior patterns not well-documented in 2026
- **MoE architecture**: May have variable latency (230B total, 10B active)

**Remediation:**
- Start with base config, monitor for failures
- Likely need 30-45s timeout due to size

**Sources:**
- [MiniMax MoE architecture](https://intuitionlabs.ai/articles/chinese-open-source-llms-2025) - LOW confidence

### Cogito Family (4 models: Together AI)
**Common issues:**
- **Limited community data**: Newer model family (2025-2026)
- **Llama-based**: Should follow similar patterns to Meta Llama

**Remediation:**
- Start with standard config
- Monitor for Llama-specific issues

**Sources:**
- Model provider descriptions - LOW confidence (no authoritative source)

### GPT-OSS Family (2 models: 1 Together + 1 Synthetic)
**Common issues:**
- **Synthetic 120B variant prone to explanations**: May wrap JSON in text
- **20B variant generally reliable**

**Remediation:**
- 120B: `JSON_STRICT` + `EXTRACT_JSON` + 45s timeout
- 20B: Base config

**Sources:**
- Configuration already in codebase - MEDIUM confidence (empirical)

## Known Failure Modes (2026 Research)

### 1. Thinking Tag Leakage
**Models affected:** DeepSeek R1/R1-0528, Qwen3-235B-Thinking, Kimi K2-Thinking
**Symptom:** Response contains `<think>reasoning process</think>{"prediction": "data"}`
**Root cause:** Reasoning models separate thinking from output, but `response_format: json_object` doesn't suppress tags
**Detection:** Regex match for `<think>`, `<thinking>`, `<reasoning>` in raw response
**Fix:** `STRIP_THINKING_TAGS` handler BEFORE JSON extraction

**Sources:**
- [DeepSeek R1 thinking suppression](https://github.com/Aider-AI/aider/issues/3008) - HIGH confidence
- [vLLM reasoning output docs](https://docs.vllm.ai/en/stable/features/reasoning_outputs/) - HIGH confidence

### 2. JSON Wrapper Text
**Models affected:** DeepSeek V3.2, GLM-4.7, GPT-OSS-120B
**Symptom:** "Here's my prediction: ```json\n{...}\n```"
**Root cause:** Models add explanatory text despite `json_object` mode
**Detection:** Response starts with natural language, JSON is embedded
**Fix:** `EXTRACT_JSON` handler to strip markdown and text

**Sources:**
- [Getting structured responses guide](https://jss367.github.io/getting-structured-responses-from-deepseek-r1.html) - MEDIUM confidence
- Empirical observation from existing code configs - MEDIUM confidence

### 3. Language Mixing
**Models affected:** GLM-4.6, GLM-4.7
**Symptom:** JSON keys in English, but values or surrounding text in Chinese
**Root cause:** Models trained primarily on Chinese, default to Chinese reasoning
**Detection:** Unicode range check for Chinese characters
**Fix:** `ENGLISH_ENFORCED` variant with explicit language instruction

**Sources:**
- [Chinese LLM bilingual capabilities](https://www.siliconflow.com/articles/en/best-open-source-LLM-for-Mandarin-Chinese) - LOW confidence
- GLM documentation describes bilingual training - MEDIUM confidence

### 4. Timeout on Reasoning Models
**Models affected:** All reasoning/thinking models (R1, K2-Thinking, Qwen3-Thinking)
**Symptom:** Request times out at 15s default
**Root cause:** Models generate extensive CoT before final answer, tokens/sec is lower
**Detection:** Request duration exceeds timeout, no response received
**Fix:** Increase timeout to 60-90s via `PromptConfig.timeoutMs`

**Sources:**
- [Reasoning model latency characteristics](https://cameronrwolfe.substack.com/p/demystifying-reasoning-models) - MEDIUM confidence
- Existing timeout configs in codebase - HIGH confidence (empirical)

### 5. Small Model Instruction Drift
**Models affected:** Llama 3.2 3B, Llama 3.1 8B, any <10B parameter models
**Symptom:** Returns text response instead of JSON, ignores format instructions
**Root cause:** Small models have limited instruction-following capability
**Detection:** Response is valid English but not valid JSON
**Fix:** `JSON_STRICT` variant with very explicit format rules, or consider model retirement

**Sources:**
- [Small model limitations](https://www.datacamp.com/blog/top-small-language-models) - LOW confidence
- [SLM instruction-following trade-offs](https://www.bentoml.com/blog/the-best-open-source-small-language-models) - LOW confidence

### 6. Empty Response (API-level)
**Models affected:** Any model, intermittent
**Symptom:** HTTP 200 response with empty `content` field
**Root cause:** Model refused to generate, or provider issue
**Detection:** `message.content` is null/empty/undefined
**Fix:** Already handled in base.ts (checks content/reasoning/reasoning_details), triggers retry

**Sources:**
- [DeepSeek API empty content issue](https://api-docs.deepseek.com/guides/json_mode) - HIGH confidence (official warning)
- Existing error handling in codebase - HIGH confidence

### 7. Rate Limiting (429)
**Models affected:** Any model during high load
**Symptom:** HTTP 429 response
**Root cause:** Provider API limits (Together AI, Synthetic)
**Detection:** HTTP status 429
**Fix:** Already handled via `RateLimitError` + exponential backoff + fallback chains

**Sources:**
- Existing retry logic in codebase - HIGH confidence

## Validation and Testing Strategy

### Current State (Strong Foundation)
- **Vitest integration tests** for all 42 models (`all-models.test.ts`)
- **Zod schema validation** (`PredictionOutputSchema`)
- **Retry logic** with exponential backoff
- **JSON mode enforcement** via `response_format: json_object`

### Gaps for 100% Coverage
1. **No per-model failure history** - Can't see "Model X failed 10 times this week"
2. **No config experiment tracking** - Can't see "We tried JSON_STRICT, it didn't help"
3. **No regression detection** - Can't detect "Model X was working yesterday"
4. **No raw response storage** - Can't replay failures for debugging
5. **No automated config tuning** - Manual trial-and-error for each model

### Recommended Testing Infrastructure

```typescript
// 1. Per-model test harness (CLI tool)
// Usage: npm run test:model -- deepseek-r1 --variants all
// Tests all 4 prompt variants, 3 response handlers, outputs success matrix

// 2. Response snapshot testing
// Save raw responses from each model, detect when format changes
// Example: tests/snapshots/deepseek-r1/success-001.json

// 3. Regression test suite
// Run nightly against all 42 models with fixed test case
// Alert on any model dropping below 80% success rate

// 4. Config validation
// Validate that all models in index.ts have appropriate configs
// Reasoning models MUST have timeout >= 60s
// Chinese models MUST have ENGLISH_ENFORCED or explicitly waived
```

## Open Questions and Research Gaps

### High Priority (Blocking 100% Coverage)
1. **Synthetic.new model behavior undocumented** - No official docs for 13 Synthetic-exclusive models
2. **Optimal timeout per model unknown** - Need empirical P95 latency data
3. **Effectiveness of prompt variants unproven** - No A/B test data yet
4. **Small model viability uncertain** - Can 3B models ever reliably return JSON?

### Medium Priority (Optimization)
5. **Cost-reliability trade-offs not analyzed** - Which models give best value?
6. **Fallback chain effectiveness unknown** - Do Together AI fallbacks actually work?
7. **Batch vs single prediction performance** - Do batch predictions hurt success rate?

### Low Priority (Future Work)
8. **Model version tracking** - How to detect when Together/Synthetic upgrades models?
9. **Multi-provider strategies** - Should we try both providers for critical predictions?
10. **Dynamic timeout adjustment** - Auto-increase timeout on 504 errors?

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| **Failure mode categories** | HIGH | Confirmed via official docs (DeepSeek, vLLM) + existing code |
| **Thinking tag solutions** | HIGH | Multiple sources + existing working implementations |
| **Model family patterns** | MEDIUM | Based on WebSearch + existing configs, not all tested |
| **Small model limitations** | LOW | General articles, not specific to JSON tasks |
| **Chinese model language issues** | MEDIUM | Documented in GLM literature, confirmed in code configs |
| **Timeout requirements** | HIGH | Existing configs empirically validated |
| **Cost data** | HIGH | Directly from Together AI and estimated for Synthetic |

## Sources

### Structured Output and JSON Mode
- [Structured Outputs - vLLM](https://docs.vllm.ai/en/latest/features/structured_outputs/)
- [Structured Outputs - Together.ai](https://docs.together.ai/docs/json-mode)
- [DeepSeek JSON Mode](https://api-docs.deepseek.com/guides/json_mode)
- [How to Ensure LLM Output Adheres to JSON Schema](https://modelmetry.com/blog/how-to-ensure-llm-output-adheres-to-a-json-schema)

### Thinking Tags and Reasoning Models
- [DeepSeek R1 thinking tags issue](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/575)
- [Removing thinking tags from DeepSeek R1](https://github.com/Aider-AI/aider/issues/3008)
- [Reasoning Outputs - vLLM](https://docs.vllm.ai/en/stable/features/reasoning_outputs/)
- [Constrained generation with reasoning](https://fireworks.ai/blog/constrained-generation-with-reasoning)

### Model Families and Capabilities
- [Chinese Open-Source LLMs Overview](https://intuitionlabs.ai/articles/chinese-open-source-llms-2025)
- [Top 10 Open Source LLMs 2026](https://o-mega.ai/articles/top-10-open-source-llms-the-deepseek-revolution-2026)
- [Small Language Models Guide](https://www.datacamp.com/blog/top-small-language-models)
- [Kimi K2 Thinking Model](https://recodechinaai.substack.com/p/kimi-k2-thinking-the-46m-model-shifting)

### Production Reliability and Monitoring
- [Multi-provider LLM orchestration in production](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10)
- [Best LLM monitoring tools 2026](https://www.braintrust.dev/articles/best-llm-monitoring-tools-2026)
- [LLM Evaluation Landscape 2026](https://research.aimultiple.com/llm-eval-tools/)
- [LLM Failure Modes](https://medium.com/@adnanmasood/a-field-guide-to-llm-failure-modes-5ffaeeb08e80)

### Validation and Testing
- [Structured Output Generation Guide](https://medium.com/@emrekaratas-ai/structured-output-generation-in-llms-json-schema-and-grammar-based-decoding-6a5c58b698a6)
- [LiteLLM JSON Mode](https://docs.litellm.ai/docs/completion/json_mode)
- [StrictJSON Framework](https://github.com/tanchongmin/strictjson)
