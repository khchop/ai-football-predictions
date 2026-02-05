# Feature Landscape: Model-Specific Prompts & Fallback Chains

**Domain:** Multi-LLM Production Systems with Reliability Patterns
**Researched:** 2026-02-05
**Context:** Subsequent milestone (v2.5) for existing platform with 36 LLM models (6 currently disabled)

## Executive Summary

This research examines feature expectations for production LLM systems managing multiple models with varying reliability characteristics. The domain has matured significantly in 2024-2026, with clear patterns emerging around model-specific prompt optimization, fallback chain orchestration, circuit breaker patterns, and dynamic fleet management.

**Key insight:** The shift from "fire and forget" LLM calls to sophisticated reliability patterns (model-specific prompts, fallback chains, circuit breakers, observability) is now table stakes for production systems. Differentiation comes from adaptive learning systems that optimize prompts based on historical performance.

**Current state analysis:** Project has 36 models (30 Together.ai + 6 Synthetic.new disabled), with 6 models failing due to:
- **JSON output issues:** DeepSeek V3.2, Qwen3-235B-Thinking return natural language prose instead of structured JSON
- **Timeout issues:** Kimi K2.5, GLM 4.6/4.7 exceed 30s default timeout (thinking models need 45-60s)
- **API bugs:** GLM 4.7 hits SGLang structured output bug confirmed by Synthetic.new
- **Parse failures:** GPT-OSS-120B returns `{"type":"object"}` instead of predictions

**UI/UX issue:** Hardcoded "35 models" in SEO metadata while actual active count is 30 (83% uptime vs expected 100%).

## Table Stakes

Features users expect from production multi-LLM systems. Missing these makes the system feel fragile or unprofessional.

| Feature | Why Expected | Complexity | Priority | Notes |
|---------|--------------|------------|----------|-------|
| **Model-specific prompt templates** | Different models perform optimally with different prompting styles (GPT prefers numeric constraints, Claude prefers structured XML, thinking models need reasoning space) | Medium | P0 | Per research: GPT-4 responds 22% better to crisp numeric constraints vs verbose instructions; Claude over-explains without explicit boundaries. **Critical for project:** Qwen3-235B-Thinking and DeepSeek-V3.2 need explicit JSON schema examples to prevent natural language output |
| **Automatic fallback chain** | Primary model failures should transparently retry with alternative models | Medium | P0 | Standard pattern: Primary → Provider-level fallback → Cross-provider fallback. Prevents user-facing failures. **Project needs:** Synthetic models → Together.ai equivalents |
| **Retry with exponential backoff** | Transient failures (rate limits, timeouts) should retry automatically | Low | P0 | Already partially implemented in codebase. Industry standard: exponential backoff with jitter |
| **Circuit breaker pattern** | Failing models should be temporarily removed from rotation to prevent cascading failures | Medium | P0 | Current system has auto-disable after 3 failures; circuit breaker adds temporary states (half-open probe). **Enhance existing logic** |
| **Dynamic model count display** | UI should reflect actual active model count, not hardcoded numbers | Low | P0 | **CRITICAL PROJECT ISSUE:** "35 models" hardcoded in 15+ locations (SEO metadata, schema.org, FAQ, OG images) while 6 models disabled = user sees 29 predictions but metadata claims 35 |
| **Structured output enforcement** | JSON responses must be valid and parsable | Medium | P0 | **CRITICAL PROJECT ISSUE:** deepseek-v3.2, qwen3-235b-thinking return natural language instead of JSON. API-native methods (OpenAI JSON mode) or constrained decoding required. Current parser has multi-strategy fallbacks but can't fix non-JSON responses |
| **Model health monitoring** | Track success/failure rates per model in real-time | Medium | P1 | Observability best practice: latency, error rate, token usage, response quality per model |
| **Graceful degradation** | System continues functioning when subset of models fail | Low | P0 | Already implemented via auto-disable; enhance with user communication about disabled models |
| **Provider-level fallback** | When Synthetic.new model fails, fallback to equivalent Together.ai model | Medium | P1 | **PROJECT-SPECIFIC:** Together.ai has DeepSeek R1, GLM-4-Plus, Qwen equivalents. Map Synthetic → Together for redundancy |
| **Timeout configuration per model** | Thinking models (DeepSeek R1, Kimi K2.5) need longer timeouts than fast models | Low | P1 | **PROJECT ISSUE:** Research shows reasoning models trade speed for accuracy; default 30s timeout insufficient. Kimi K2.5, GLM models timing out. **Recommendation:** 60s for thinking models, 15-30s for standard models |
| **Real-time active count API** | Endpoint returning current active/disabled model statistics | Low | P1 | Feeds dynamic UI displays and observability dashboards. **Feeds fix for hardcoded counts** |

### Implementation Notes

**Model-specific prompts** - Current project has 6 failing models with different failure modes:

1. **GLM-4.7** (API bug) → SGLang structured output bug confirmed by Synthetic.new
   **Fix:** Fallback to Together.ai GLM-4-Plus or use JSON mode instead of structured output

2. **Kimi K2.5, GLM 4.6** (timeout) → Exceed 30s default
   **Fix:** Increase timeout to 60s for thinking/reasoning models per research findings

3. **Qwen3-235B-Thinking, DeepSeek-V3.2** (natural language output) → Return prose instead of JSON
   **Fix:** Add explicit JSON schema example to prompt: `{"home_score": 2, "away_score": 1}` with instruction "OUTPUT ONLY THIS JSON FORMAT, NO OTHER TEXT"

4. **GPT-OSS-120B** (invalid response) → Returns `{"type":"object"}`
   **Fix:** Similar to #3, add explicit format enforcement

**Fallback mapping** (from existing codebase analysis in 39-03 plan):
```
Synthetic Model → Together.ai Fallback
- deepseek-r1-0528 → meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo
- kimi-k2.5-syn → Qwen/Qwen3-235B-A14B-Instruct-Turbo
- glm-4.7-thinking → deepseek-ai/DeepSeek-V3 (reasoning equivalent)
- qwen3-235b-thinking → Qwen/Qwen3-235B-A14B-Instruct-Turbo
```

**Dynamic counts** - Replace hardcoded "35 models" in:
- SEO metadata (match pages, league pages, homepage)
- OG image text generation
- Schema.org descriptions
- FAQ content ("How many AI models make predictions?")
- Hero sections and marketing copy

**Implementation:** Use provider stats query everywhere:
```sql
SELECT COUNT(*) FROM models WHERE active = true
```

## Differentiators

Features that set a production LLM system apart. Not expected by default, but provide competitive advantage.

| Feature | Value Proposition | Complexity | ROI | Notes |
|---------|-------------------|------------|-----|-------|
| **Adaptive prompt optimization** | Automatically tune prompts based on historical model performance | High | High | Learning system: track which prompt variations yield best JSON parse rates per model, auto-adjust. **Defer to v2.6+** - needs telemetry infrastructure |
| **Cost-aware fallback routing** | Route to cheaper models first, expensive models as fallback | Medium | Medium | Example: Try Qwen3 (free) before GPT-4o (paid). Optimize cost without sacrificing reliability. **Relevant for project:** Together.ai free tier vs Synthetic paid models |
| **Model performance leaderboard** | Public dashboard showing which models are most reliable (not just accurate) | Low | High | Transparency builds trust; already have accuracy leaderboard, add reliability metrics (uptime %, parse success %, avg latency). **Easy win for v2.5** |
| **Predictive circuit breaking** | Detect degradation patterns before complete failure | High | Medium | ML-based: if model accuracy drops 15% in 2 hours, proactively reduce traffic. **Defer** - ML complexity not justified yet |
| **Multi-model consensus voting** | Generate predictions from 3 models, use majority vote | Medium | Medium | Improves accuracy but increases cost 3x. Good for high-stakes predictions. **Out of scope** - conflicts with individual model leaderboard focus |
| **Model-specific timeout tuning** | Auto-learn optimal timeout per model from historical latency | Medium | Low | Nice-to-have: DeepSeek R1 needs 45s, GPT-4-Turbo needs 8s. Could auto-tune from p95 latency. **Manual config sufficient for v2.5** |
| **Fallback chain visualization** | Admin UI showing which fallback path each prediction took | Low | Low | Debugging aid: "65% succeeded on primary, 25% used fallback, 10% failed". **Consider for v2.6** |
| **A/B testing infrastructure** | Compare prompt variations or model configurations with traffic splitting | High | Medium | Platform feature: run 10% traffic with new prompt, measure impact. **Defer** - premature; need baseline stability first |
| **Model warmup/cooldown** | Gradually reintroduce disabled models with reduced traffic | Medium | Medium | Circuit breaker enhancement: half-open state sends 10% traffic to test recovery. **Good fit for v2.5** - enhances existing auto-disable |

### Differentiation Strategy

For this project (v2.5 milestone):

**Implement:**
- **Model performance leaderboard** (reliability tab on existing leaderboard) - Easy transparency win
- **Cost-aware fallback routing** (prefer Together.ai free tier before Synthetic paid models) - Saves budget
- **Model warmup/cooldown** (enhance existing auto-disable with gradual recovery) - Professional reliability pattern

**Defer to v2.6+:**
- Adaptive prompt optimization (requires telemetry infrastructure)
- Predictive circuit breaking (ML complexity not justified yet)
- A/B testing infrastructure (premature; need baseline stability first)

## Anti-Features

Features to explicitly NOT build. Common mistakes or complexity traps in this domain.

| Anti-Feature | Why Avoid | What to Do Instead | Evidence |
|--------------|-----------|-------------------|----------|
| **Synchronous fallback chains** | Trying 5 models sequentially creates 20-60s latency that kills UX | Parallel first-choice generation OR async retry with result caching | Research: users abandon after 3s load time; sequential fallbacks kill UX. **Project impact:** Current T-30m prediction window allows async retries; don't block on fallbacks |
| **Unbounded retry loops** | Retrying forever on persistent failures wastes API budget ($1-5 daily limit) and delays error detection | Hard cap at 3 retries with exponential backoff, then fail fast | Production best practice: "Set hard caps for retries and max fallbacks per minute". **Project has daily budget constraint** |
| **Single global circuit breaker** | One failing model trips circuit for all models | Per-model circuit breakers with independent state | Research finding: "Circuit breakers that detect failure patterns per service". **Project already has per-model auto-disable - correct approach** |
| **Model fine-tuning for JSON output** | Expensive ($100s), brittle (models drift with provider updates), unnecessary | Use API-native JSON mode or constrained decoding via prompt engineering | Research: "API-native approaches...make outputs reliable...no need for fragile post-processing". **Relevant:** Don't fine-tune Qwen/DeepSeek; fix prompts instead |
| **Complex prompt orchestration frameworks** | LangChain/LlamaIndex adds 500KB+ bundle size and 3-5ms overhead for simple use cases | Start with direct API calls; add framework only when complexity justifies it | Anti-pattern research: "Jumping directly to complex orchestrated multi-agent frameworks...introduces significant overhead". **Project uses direct API calls - correct** |
| **Storing all prompt variations** | Trying every possible prompt permutation creates combinatorial explosion (storage, testing) | Version control 1-3 tested prompts per model; use A/B testing to validate new versions | Prompt engineering is now treated like code: "version control, testing, A/B experimentation". **Store in Git, not database** |
| **Real-time prompt generation** | Generating prompts with another LLM call doubles latency (60s → 120s) and cost (2x API calls) | Template-based prompts with variable substitution | **Project uses template-based approach in prompt.ts - correct** |
| **Model-specific result parsing** | Different parse logic per model creates maintenance nightmare (36 parsers for 36 models) | Enforce standard JSON schema; reject non-conforming responses; retry with enhanced prompt | **Current issue:** deepseek-v3.2 returning natural language proves this point. Fix prompt, not parser |
| **Hiding model failures from users** | Silently failing creates mystery when counts don't match ("Why do I see 29 predictions when you claim 35 models?") | Surface active/disabled status transparently in UI | **CRITICAL PROJECT ISSUE:** Users expect 35 models but see 29 rows. Need transparency about disabled models |
| **Manual fallback configuration** | Hardcoding fallback chains becomes stale when models update (new models added, old deprecated) | Auto-generate fallback mappings from provider registry based on capabilities (tier, reasoning, size) | Existing provider registry supports this. **Implement in v2.5** |
| **Universal timeout for all models** | Thinking models timeout at 30s, fast models waste time waiting | Per-model timeout configuration based on model type (standard: 15s, reasoning: 60s) | **PROJECT ISSUE:** Kimi K2.5, GLM timing out. Research: "Thinking models require more processing time...timeout risk" |

### Anti-Pattern Examples from Current System

**What's happening:** 6 models disabled with hardcoded "35 models" text creates confusion
**Why it's bad:** Users see 29 prediction rows but metadata says 35
**Correct approach:** Dynamic count from `SELECT COUNT(*) FROM models WHERE active = true`
**User perception:** Transparency about 30/36 active > lying about 35

**What's happening:** DeepSeek R1, Qwen3-Thinking return natural language prose
**Why it's bad:** Parse failures cause model to auto-disable
**Correct approach:** Add explicit JSON schema to prompt with example, use JSON mode if available
**Anti-pattern avoided:** Don't build model-specific parsers; fix prompts to enforce output format

**What's happening:** Timeouts after 30s for all models
**Why it's bad:** Thinking models need more time; fast models waste time waiting
**Correct approach:** Model-specific timeout config: `{ "gpt-4-turbo": 15000, "deepseek-r1": 60000, "kimi-k2.5": 60000 }`
**Research support:** "Deep thinking models require more processing time before responding, which increases response times and creates a timeout risk"

## Feature Dependencies

Understanding which features must be built before others.

```
Foundation Tier (Build First):
├─ Per-model prompt templates
├─ Per-model timeout configuration
├─ Structured output enforcement (JSON mode/schema)
└─ Dynamic model count queries

Reliability Tier (Build Second):
├─ Retry with exponential backoff (enhance existing)
├─ Circuit breaker pattern (enhance auto-disable)
├─ Provider-level fallback mapping
└─ Graceful degradation messaging

Observability Tier (Build Third):
├─ Model health monitoring (success rates)
├─ Real-time active count API
├─ Fallback chain telemetry
└─ Model performance leaderboard

Advanced Tier (Future):
├─ Adaptive prompt optimization (requires telemetry)
├─ Cost-aware routing (requires usage tracking)
├─ Predictive circuit breaking (requires ML)
└─ A/B testing infrastructure
```

**Critical path for v2.5:**
1. **Fix structured output** (model-specific prompts with JSON enforcement)
2. **Enable provider fallbacks** (Synthetic → Together.ai)
3. **Replace hardcoded counts** with dynamic queries
4. **Add model-specific timeouts** for thinking models

**Sequence rationale:**
- Must fix JSON output before fallbacks work (fallback to broken model still fails)
- Must implement fallbacks before re-enabling disabled models (prevent immediate re-disable)
- Must fix counts after models re-enabled (otherwise still shows wrong number)
- Timeouts can be parallel with other work (independent configuration)

## MVP Recommendation

For v2.5 milestone (Model Reliability & Dynamic Counts), prioritize:

### Must Have (P0)

1. **Model-specific prompt templates** with JSON enforcement
   - Add explicit schema examples to prompts for failing models
   - Instruction: "OUTPUT ONLY VALID JSON: {\"home_score\": X, \"away_score\": Y}. NO OTHER TEXT."
   - Use Together.ai JSON mode where available (GPT-4, Llama models)
   - **Complexity:** 2-3 hours (modify existing prompt templates in prompt.ts)
   - **Impact:** Fixes DeepSeek-V3.2, Qwen3-235B-Thinking, GPT-OSS-120B parse failures

2. **Provider-level fallback chain** (Synthetic → Together.ai)
   - Implement fallback mapping from existing 39-03 plan
   - Automatic retry with alternative provider on failure
   - **Complexity:** 4-6 hours (new fallback orchestration logic in prediction service)
   - **Impact:** Increases reliability from 83% (30/36) to 95%+ with redundancy

3. **Dynamic model counts** everywhere
   - Replace 15+ hardcoded "35 models" references
   - Use provider stats: `SELECT COUNT(*) WHERE active = true`
   - Update: SEO metadata, schema.org, FAQ, OG images, hero sections
   - **Complexity:** 2-3 hours (find/replace + query refactor)
   - **Impact:** Fixes UX confusion (metadata matches reality)

4. **Model-specific timeout configuration**
   - Increase timeout for thinking models (60s vs 30s default)
   - Configuration map: `{ "kimi-k2.5-syn": 60000, "glm-4.6-syn": 60000, "deepseek-r1": 60000 }`
   - **Complexity:** 1-2 hours (add timeout config to provider definitions)
   - **Impact:** Fixes Kimi K2.5, GLM 4.6 timeout failures

### Should Have (P1)

5. **Enhanced circuit breaker** with half-open state
   - After auto-disable, periodically probe with reduced traffic (10%)
   - Re-enable model after 3 consecutive successful probes
   - **Complexity:** 4-5 hours (enhance existing auto-disable logic)
   - **Impact:** Automated recovery from transient failures

6. **Model health monitoring API**
   - `/api/admin/model-health` endpoint
   - Returns per-model: success rate, avg latency, last failure time, parse success rate
   - **Complexity:** 3-4 hours (new endpoint + telemetry queries)
   - **Impact:** Observability for debugging and optimization

7. **Active model count API**
   - `/api/models/stats` public endpoint
   - Returns: `{ total: 36, active: 30, disabled: 6, byProvider: { together: 29, synthetic: 7 } }`
   - **Complexity:** 1 hour (simple aggregation query)
   - **Impact:** Powers dynamic UI displays (feeds #3)

8. **Model performance leaderboard tab**
   - Add "Reliability" tab to existing leaderboard
   - Metrics: uptime %, parse success %, avg latency, total predictions
   - **Complexity:** 2-3 hours (UI component + stats query)
   - **Impact:** Transparency builds trust; differentiates from generic leaderboards

### Defer to Post-MVP

- **Adaptive prompt optimization** (needs baseline telemetry first)
- **Cost-aware routing** (needs cost tracking infrastructure)
- **A/B testing framework** (premature for current scale)
- **Predictive circuit breaking** (ML complexity not justified)

## Success Metrics

How to measure if features are working:

| Metric | Target | Current | Measurement |
|--------|--------|---------|-------------|
| **Model success rate** | >95% for all active models | ~83% (30/36 active) | `COUNT(predictions) / COUNT(attempts)` per model |
| **JSON parse success** | 100% of successful API calls | <100% (deepseek/qwen fail) | Parse attempt success rate |
| **Fallback utilization** | <5% of predictions use fallback | N/A (no fallback) | Count fallback chain activations |
| **Auto-recovery rate** | 50%+ of disabled models recover within 24h | 0% (manual re-enable) | Disabled → Re-enabled transitions |
| **UI count accuracy** | 100% match between metadata and actual | 0% (hardcoded "35" vs actual "30") | "35 models" text vs `SELECT COUNT(*)` |
| **Timeout-related failures** | <1% of failures due to timeout | ~17% (kimi, glm timeouts) | Timeout errors / total errors |
| **Model uptime** | Average >95% across all models | 83% (30/36) | Active models / total models |
| **User-facing error rate** | <0.1% of predictions fail completely | Unknown (need tracking) | Failed predictions with no fallback |

## Feature Complexity Matrix

Effort estimation for implementation:

| Feature | LOC | Files | Complexity | Risk |
|---------|-----|-------|------------|------|
| Model-specific prompts | ~100 | 2 (prompts.ts, prediction-service.ts) | Low | Low - isolated to prompt logic |
| Fallback chain orchestration | ~200 | 3 (prediction-service.ts, provider registry, new fallback-chain.ts) | Medium | Medium - changes core prediction flow |
| Dynamic model counts | ~50 | 8+ (SEO metadata, schema, FAQ, OG images) | Low | Low - find/replace + query |
| Model-specific timeouts | ~30 | 2 (together-client.ts, synthetic-provider.ts) | Low | Low - config-driven |
| Circuit breaker enhancement | ~150 | 2 (auto-disable logic, health monitoring) | Medium | Medium - stateful logic |
| Health monitoring API | ~100 | 2 (new endpoint, telemetry service) | Low | Low - read-only queries |
| Active count API | ~40 | 1 (new endpoint) | Low | Low - simple aggregation |
| Performance leaderboard | ~80 | 2 (UI component, stats query) | Low | Low - extends existing leaderboard |

**Total estimated effort for MVP (P0 + P1):** 18-28 hours across 2-3 days

**Risk factors:**
- Fallback orchestration touches core prediction flow (needs careful testing)
- Circuit breaker state management (needs Redis for distributed coordination)
- Dynamic count replacement (need to find all 15+ hardcoded instances)

## Research Confidence

| Area | Confidence | Source Quality | Validation |
|------|------------|----------------|------------|
| Model-specific prompts | **HIGH** | Multiple 2026 guides from OpenAI, Lakera, AnalyticsVidhya; direct codebase evidence | Validated by existing failures (Qwen/DeepSeek returning natural language) |
| Fallback chain patterns | **HIGH** | Production case studies from Portkey, LangChain, Statsig | Standard pattern across LLM gateway providers |
| Structured output enforcement | **HIGH** | Official provider docs (OpenAI, Anthropic), DeepInfra JSON guide | Direct correlation to current project failures |
| Circuit breaker pattern | **HIGH** | Azure Architecture Center, production implementations | Already partially implemented (auto-disable) |
| Dynamic model counting | **HIGH** | Common sense + existing codebase analysis | Obvious solution to hardcoded count problem |
| Timeout configuration | **HIGH** | Alibaba Cloud Deep Thinking docs, Ollama blog, research on reasoning models | Validated by Kimi/GLM timeout failures in project |
| Observability patterns | **MEDIUM** | LLMOps guides, observability platform docs | Best practices but not domain-specific |
| Adaptive optimization | **MEDIUM** | Emerging pattern; limited production examples | Defer due to implementation complexity vs proven value |

## Open Questions

Areas requiring further investigation or decisions:

### 1. Fallback chain depth
- **Question:** How many fallback levels? (Primary → Provider fallback → Cross-provider → Fail?)
- **Options:** 2-level (primary + one fallback) vs 3-level (multiple fallbacks)
- **Recommendation:** Start with 2-level; monitor fallback success rates
- **Decision criteria:** If secondary fallback succeeds >20%, add tertiary
- **Project-specific:** Together.ai as Synthetic fallback should be sufficient (both cover similar model families)

### 2. Circuit breaker thresholds
- **Question:** What failure rate/count trips circuit? Current: 3 consecutive failures
- **Options:** Keep 3 consecutive | Change to 5 failures in 10 attempts | Rate-based (>50% in 1 hour)
- **Recommendation:** Enhance to rate-based (3 consecutive OR >60% failure rate in last 10)
- **Rationale:** Current logic misses intermittent failures (model works, fails, works, fails = never disabled)

### 3. Prompt versioning strategy
- **Question:** How to version prompts? Git commits? Database? Config files?
- **Options:** Git-based (commit hash) | Database with version field | Config with semver
- **Recommendation:** Git-based initially (simplest); migrate to database if A/B testing added later
- **Rationale:** Current system uses code-based prompts in prompt.ts; don't over-engineer

### 4. Model re-enable automation
- **Question:** Auto re-enable disabled models, or require manual intervention?
- **Options:** Fully automatic | Manual admin approval | Automatic with alert/notification
- **Recommendation:** Automatic with alert (circuit breaker half-open state with 10% traffic probe)
- **Rationale:** Balance between hands-off operation and safety; daily matches mean manual intervention is bottleneck

### 5. Cost tracking granularity
- **Question:** Track costs per model? Per prediction? Per user?
- **Options:** Model-level only | Prediction-level (with job metadata) | No cost tracking yet
- **Recommendation:** Defer to v2.6; current focus is reliability not cost optimization
- **Rationale:** Together.ai and Synthetic don't provide per-call cost APIs; would need token estimation

### 6. JSON mode vs prompt engineering for structured output
- **Question:** Use API-native JSON mode where available, or rely on prompt engineering?
- **Options:** JSON mode (Together.ai supports for some models) | Pure prompt engineering | Hybrid
- **Recommendation:** Hybrid approach - JSON mode for Together.ai models that support it, enhanced prompts for others
- **Rationale:** Research shows API-native JSON mode is most reliable, but not all models support it

### 7. Fallback notification/logging strategy
- **Question:** How to notify about fallback usage? Log only? Alert? User-visible?
- **Options:** Silent logging | Admin alerts when >10% use fallback | User-visible indicator
- **Recommendation:** Silent logging + admin alerts + optional user-visible "via fallback" badge on predictions
- **Rationale:** Transparency without alarm; users care about reliability, not implementation details

## Sources

### Model-Specific Prompts & LLM Differences
- [Prompt Engineering Guide 2026 | AnalyticsVidhya](https://www.analyticsvidhya.com/blog/2026/01/master-prompt-engineering/) - HIGH confidence
- [The Ultimate Guide to Prompt Engineering in 2026 | Lakera](https://www.lakera.ai/blog/prompt-engineering-guide) - HIGH confidence
- [Prompt Engineering Playbook 2026 | metricsmule](https://metricsmule.com/ai/prompt-engineering-playbook-2026/) - MEDIUM confidence
- [Best practices for LLM prompt engineering | Palantir](https://www.palantir.com/docs/foundry/aip/best-practices-prompt-engineering) - HIGH confidence
- [Your 2026 Guide to Prompt Engineering | The AI Corner](https://www.the-ai-corner.com/p/your-2026-guide-to-prompt-engineering) - MEDIUM confidence
- [Choosing an LLM in 2026: The Practical Comparison Table | DEV Community](https://dev.to/superorange0707/choosing-an-llm-in-2026-the-practical-comparison-table-specs-cost-latency-compatibility-354g) - MEDIUM confidence

### Fallback Chains & Retry Patterns
- [Retries, fallbacks, and circuit breakers in LLM apps | Portkey](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) - HIGH confidence
- [LLM Router: Best strategies to route failed LLM requests | Vellum](https://www.vellum.ai/blog/what-to-do-when-an-llm-request-fails) - HIGH confidence
- [Provider fallbacks: Ensuring LLM availability | Statsig](https://www.statsig.com/perspectives/providerfallbacksllmavailability) - MEDIUM confidence
- [Optimizing LLM Performance with Caching, Fallback, and Load Balancing | Radicalbit](https://radicalbit.ai/resources/blog/llm-performance/) - MEDIUM confidence

### Structured Output & JSON Reliability
- [The guide to structured outputs and function calling with LLMs | Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms) - HIGH confidence
- [Reliable JSON-Only Responses with DeepInfra LLMs | DeepInfra](https://deepinfra.com/blog/deepinfra-json-only-responses) - HIGH confidence
- [From Chaos to Structure: A Developer's Guide to Reliable JSON from LLMs | Medium](https://medium.com/@sonitanishk2003/from-chaos-to-structure-a-developers-guide-to-reliable-json-from-llms-de6dc0ffde07) - MEDIUM confidence
- [Structured Output Generation in LLMs | Medium](https://medium.com/@emrekaratas-ai/structured-output-generation-in-llms-json-schema-and-grammar-based-decoding-6a5c58b698a6) - MEDIUM confidence

### Circuit Breaker Pattern
- [Building a Circuit Breaker for LLM Services in Laravel](https://andyhinkle.com/blog/building-a-circuit-breaker-for-llm-services-in-laravel) - MEDIUM confidence
- [Circuit Breaker Pattern - Azure Architecture Center | Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) - HIGH confidence
- [How to Configure Circuit Breaker Patterns | OneUptime](https://oneuptime.com/blog/post/2026-02-02-circuit-breaker-patterns/view) - MEDIUM confidence

### Thinking Models & Timeout Configuration
- [How to use deep thinking models | Alibaba Cloud](https://www.alibabacloud.com/help/en/model-studio/deep-thinking) - HIGH confidence
- [Thinking | Ollama Blog](https://ollama.com/blog/thinking) - HIGH confidence
- [The Complete Guide to DeepSeek Models | BentoML](https://www.bentoml.com/blog/the-complete-guide-to-deepseek-models-from-v3-to-r1-and-beyond) - MEDIUM confidence
- [A Technical Tour of the DeepSeek Models from V3 to V3.2 | Magazine](https://magazine.sebastianraschka.com/p/technical-deepseek) - HIGH confidence

### Dynamic UI & Model Count Display
- [Using LLMs to Generate User-Defined Real-Time Data Visualizations | Tinybird](https://www.tinybird.co/blog/using-llms-to-generate-user-defined-real-time-data-visualizations) - MEDIUM confidence
- [18 Predictions for 2026 | Jakob Nielsen on UX](https://jakobnielsenphd.substack.com/p/2026-predictions) - MEDIUM confidence
- [The State Of LLMs 2025: Progress and Predictions | Magazine](https://magazine.sebastianraschka.com/p/state-of-llms-2025) - MEDIUM confidence

### LLM Observability
- [LLM Observability Tools: 2026 Comparison | lakeFS](https://lakefs.io/blog/llm-observability-tools/) - HIGH confidence
- [AI Observability: A Complete Guide for 2026 | UptimeRobot](https://uptimerobot.com/knowledge-hub/observability/ai-observability-the-complete-guide/) - MEDIUM confidence
- [The complete guide to LLM observability for 2026 | Portkey](https://portkey.ai/blog/the-complete-guide-to-llm-observability/) - HIGH confidence

### Anti-Patterns
- [Patterns and Anti-Patterns for Building with LLMs | Medium](https://medium.com/marvelous-mlops/patterns-and-anti-patterns-for-building-with-llms-42ea9c2ddc90) - HIGH confidence
- [Don't Fall for These 5 Anti-Patterns in GenAI Project Delivery | Creative Dock](https://www.creativedock.com/blog/dont-fall-for-these-5-anti-patterns-in-genai-project-delivery) - MEDIUM confidence
- [LLM RAG Anti-Patterns: Stop Stuffing Context | Medium](https://medium.com/@2nick2patel2/llm-rag-anti-patterns-stop-stuffing-context-c79c11a2529d) - MEDIUM confidence

### Existing Codebase
- `/Users/pieterbos/Documents/bettingsoccer/.planning/PROJECT.md` - Project context and current state
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/providers/synthetic.ts` - 6 disabled models analysis
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/prompt.ts` - Current prompt templates and parsing logic
- Existing v2.4 implementation (172 validated requirements across 36 models)

---

**Research complete.** Ready for requirements definition phase.
