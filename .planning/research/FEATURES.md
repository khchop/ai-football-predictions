# Feature Research

**Domain:** Multi-Provider LLM Routing and Model Consolidation
**Researched:** 2026-02-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Provider Priority Lists | Industry standard for multi-provider systems. OpenRouter, Portkey, LiteLLM all use ordered provider lists. | MEDIUM | Existing: static MODEL_FALLBACKS map (3/13 Synthetic models). Need: dynamic priority lists per model, configurable provider order. |
| Automatic Failover | When primary provider fails, system must try next provider without user intervention. Production resilience requirement. | LOW | Existing: `callAPIWithFallback` in base.ts, max depth 1, cycle detection. Already handles retry logic. Needs extension for 3+ providers. |
| Prediction History Preservation | When merging duplicate models, historical scoring data must remain intact. Users expect consistent leaderboards and accuracy stats. | HIGH | Database constraint: `predictions.match_model_unique` prevents duplicates. Need migration to consolidate 13 -syn model histories into base models. |
| Health-Based Provider Selection | Unhealthy providers should be deprioritized automatically. Industry standard (OpenRouter checks 30s outage windows). | MEDIUM | Existing: `models.consecutiveFailures`, `autoDisabled`, `lastFailureAt`. Need: provider-level health tracking, dynamic priority adjustment based on health. |
| Attribution After Failover | When fallback succeeds, system must track which provider actually responded. Critical for cost tracking and debugging. | LOW | Existing: `predictions.usedFallback` boolean. Need: track actual provider used (not just binary flag), response time per provider. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Provider-Specific Configuration | Different prompt variants, timeouts, response handlers per provider. Optimizes for each provider's quirks. | MEDIUM | Existing: `PromptConfig` with `promptVariant`, `timeoutMs`, `responseHandler`. Already implemented for model-specific tuning. Need: extend to provider-level defaults. |
| Weighted Load Balancing | Distribute traffic across providers by percentage (not just sequential priority). Reduces rate limit risk, optimizes cost. | HIGH | Industry pattern (Portkey weights, OpenRouter inverse square pricing). Current: sequential fallback only. Implementation: non-trivial routing logic with sticky sessions for consistency. |
| Cost-Aware Routing | Select provider based on model pricing tier. Prioritize ultra-budget providers for high-volume predictions. | LOW | Existing: `ModelTier` enum, `pricing` field in Together models. Need: cross-provider cost comparison, routing preference by tier. |
| Model Availability Expansion | Re-activate deprecated Together models via OpenRouter. Increases coverage from 42 to 49 unique models. | MEDIUM | Specific to project: 7 deprecated Together models (qwen2.5-72b-turbo, llama-4-scout, etc.) available on OpenRouter. Need: provider routing config per model. |
| Smart Deduplication | Merge -syn suffix models into base models, preserve full prediction history with provider attribution. | HIGH | Affects 13 Synthetic models + 6 suffix-only models. Need: data migration script, model ID rewrite, stats recalculation, UI updates. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic Model Selection by Task | "Let the system pick the best model for each match based on complexity." | Breaks attribution tracking, makes debugging impossible, introduces hidden costs, violates user expectations (leaderboard assumes consistent model behavior). | Fixed model assignments per prediction. Users expect "Llama 70B" to always use Llama 70B, not switch to DeepSeek mid-season. |
| Unlimited Fallback Chains | "Try all providers until one works." | Cascading failures cause extreme latency (3+ providers × 15s timeout = 45s+ wait), cost explosion (pay for all failed attempts), attribution confusion. | Max depth 2 (primary + one fallback). Current implementation already limits to depth 1 with cycle detection. Extend to depth 2 max. |
| Real-Time Provider Health Dashboard | "Show live provider status to users." | Creates customer support burden ("Why is provider X red?"), exposes internal implementation details, requires WebSocket infrastructure for live updates. | Admin-only health monitoring (existing: `/api/admin/pipeline-health`). Public-facing: show model accuracy and reliability, not provider status. |
| Cross-Provider Model Equivalency | "DeepSeek R1 on Together = DeepSeek R1 on OpenRouter, so merge their stats." | Different providers use different inference optimizations, quantization, prompt preprocessing. Same model name ≠ identical behavior. | Track provider-model combinations as distinct entries. `deepseek-r1` (Together) vs `deepseek-r1-openrouter` as separate models with distinct stats. |
| Dynamic Price-Based Selection | "Always use cheapest available provider." | Race to bottom on quality, introduces latency for price lookups, breaks reproducibility (predictions change based on market prices). | Static cost-optimized routing config. Review quarterly, don't auto-adjust per request. |

## Feature Dependencies

```
Provider Priority Config
    └──requires──> Provider Health Tracking (need health to adjust priority)
                       └──requires──> Provider-Level Error Categorization

Model Deduplication
    └──requires──> Prediction History Migration
                       └──requires──> Provider Attribution in Predictions Table

OpenRouter Integration
    └──requires──> Provider Priority Config (need routing logic first)

Failover Extension (depth 2)
    └──requires──> Provider Attribution (need to track full chain)

Cost-Aware Routing
    └──enhances──> Provider Priority Config (can adjust priority by cost)

Weighted Load Balancing
    ──conflicts──> Sequential Fallback (mutually exclusive routing strategies)
```

### Dependency Notes

- **Provider Priority Config requires Health Tracking:** Priority lists are static by default, but dynamic adjustment based on provider health (OpenRouter-style 30s outage windows) requires real-time health metrics per provider.
- **Model Deduplication requires History Migration:** Cannot merge model IDs until prediction history is migrated and consolidated. Migration must preserve all historical points for leaderboard integrity.
- **OpenRouter Integration requires Priority Config:** Adding OpenRouter as third provider needs routing logic to decide Synthetic → Together → OpenRouter order. Current binary fallback (Synthetic → Together) insufficient.
- **Failover Extension requires Attribution:** Tracking which provider in chain actually responded requires `provider_used` field in predictions table, not just `used_fallback` boolean.
- **Weighted Load Balancing conflicts with Sequential Fallback:** Cannot implement both simultaneously. Load balancing distributes requests probabilistically across healthy providers (Portkey weights, OpenRouter inverse square). Sequential fallback tries providers in fixed order until one succeeds. Must choose one strategy per model.

## MVP Definition

### Launch With (Milestone Scope)

Minimum viable features to deliver provider unification and model consolidation.

- [x] **OpenRouter Provider Class** — Third provider integration. LOW complexity (copy SyntheticProvider pattern, change endpoint/headers).
- [x] **Provider Priority Lists** — Replace binary MODEL_FALLBACKS map with ordered provider arrays per model. MEDIUM complexity (refactor getFallbackProvider to getNextProvider with index).
- [x] **Extended Failover Logic** — Support up to 3 providers (Synthetic → Together → OpenRouter). LOW complexity (loop through priority list instead of single fallback lookup).
- [x] **Prediction History Migration** — Consolidate 13 -syn model predictions into base model IDs. HIGH complexity (SQL migration with data integrity checks, foreign key updates, stats recalculation).
- [x] **Provider Attribution Tracking** — Add `provider_used` field to predictions table. LOW complexity (schema change + update callAPI to return provider ID).
- [x] **Model ID Cleanup** — Remove -syn suffix from 6 Synthetic-only models, update all references. MEDIUM complexity (affects 19 models total: 13 merges + 6 renames).
- [x] **Re-activate Deprecated Models** — Add 7 Together models back via OpenRouter. LOW complexity (configuration only, no code changes).

### Add After Validation (Post-Milestone)

Features to add once core routing is stable and performing well.

- [ ] **Provider Health Scoring** — Track success rate, latency, error rate per provider (not just per model). Trigger: After 1 week of 3-provider routing, analyze which providers fail most. MEDIUM complexity.
- [ ] **Dynamic Priority Adjustment** — Auto-deprioritize providers with high failure rates. Trigger: If OpenRouter consistently fails on certain models, demote in priority list. HIGH complexity (requires Redis state for dynamic config).
- [ ] **Cost Reporting by Provider** — Show cost breakdown by provider in admin dashboard. Trigger: After 1 month, audit actual costs vs projections. LOW complexity (aggregate by provider_used field).
- [ ] **Fallback Analytics** — Dashboard showing fallback rates, success paths, cost impact of fallbacks. Trigger: User request for transparency on provider reliability. MEDIUM complexity (existing `/api/admin/fallback-stats` needs provider breakdown).

### Future Consideration (v2+)

Features to defer until multi-provider routing proves valuable.

- [ ] **Weighted Load Balancing** — Distribute requests probabilistically instead of sequential fallback. WHY DEFER: Conflicts with current fallback-based architecture, requires sticky sessions (Redis), adds complexity without proven benefit. Validate that sequential routing meets needs first.
- [ ] **Provider-Specific Prompt Tuning** — Different prompt variants for each provider, not just per model. WHY DEFER: Combinatorial explosion (42 models × 3 providers = 126 configs). Only pursue if data shows significant quality differences between providers for same model.
- [ ] **Cross-Provider Model Consolidation** — Treat "deepseek-r1" on Together and OpenRouter as same model. WHY DEFER: Risks attribution confusion and accuracy measurement corruption. Need extensive testing to prove providers produce equivalent results.
- [ ] **OpenRouter Auto Router** — Use OpenRouter's automatic model selection feature. WHY DEFER: Breaks attribution (don't know which model responded), introduces unpredictable costs, contradicts leaderboard concept (users expect consistent model behavior).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| OpenRouter Provider Class | LOW (infrastructure) | LOW (copy pattern) | P1 | Blocker for all other features. Must exist to route to OpenRouter. |
| Provider Priority Lists | MEDIUM (reliability) | MEDIUM (refactor) | P1 | Foundation for 3-provider routing. Current binary fallback insufficient. |
| Extended Failover Logic | HIGH (uptime) | LOW (loop logic) | P1 | Core benefit of multi-provider: automatic failover to 3rd option increases reliability. |
| Provider Attribution | HIGH (transparency) | LOW (add field) | P1 | Critical for cost tracking, debugging, and future analytics. Binary flag insufficient. |
| Prediction History Migration | HIGH (data integrity) | HIGH (SQL complexity) | P1 | Blocker for model consolidation. Must preserve historical leaderboard data. |
| Model ID Cleanup | MEDIUM (consistency) | MEDIUM (rename cascade) | P1 | Remove technical debt (-syn suffixes). Affects 19 models, multiple tables/UI. |
| Re-activate Deprecated Models | MEDIUM (coverage) | LOW (config only) | P2 | Nice to have (increases from 42 to 49 models) but not critical. Low risk. |
| Provider Health Scoring | MEDIUM (optimization) | MEDIUM (tracking) | P2 | Improves routing but not essential for launch. Add after observing real behavior. |
| Dynamic Priority Adjustment | LOW (auto-optimization) | HIGH (state mgmt) | P3 | Premature optimization. Validate that static priority works first. |
| Weighted Load Balancing | LOW (throughput) | HIGH (architecture) | P3 | Conflicts with fallback model. Only pursue if rate limits become problem. |
| Cost Reporting by Provider | LOW (visibility) | LOW (aggregate query) | P2 | Useful for auditing but not urgent. Easy to add later. |
| Fallback Analytics | MEDIUM (insights) | MEDIUM (dashboard) | P2 | Extends existing fallback-stats endpoint. Add when users request transparency. |

**Priority key:**
- P1: Must have for milestone (provider unification + model consolidation)
- P2: Should have, add within 2-4 weeks post-launch
- P3: Nice to have, future consideration after validation

## Competitor Feature Analysis

| Feature | OpenRouter | Portkey | LiteLLM | Our Approach |
|---------|------------|---------|---------|--------------|
| Provider Routing | `order` array for sequential priority. `sort` for price/latency/throughput sorting. Auto fallback enabled by default. | Weight-based load balancing (5:3:1 ratios). Sticky sessions via Redis. | Priority-based with `order` parameter. Latency + PeakEWMA for load balancing. | Sequential fallback (Synthetic → Together → OpenRouter). Static priority per model. Max depth 2. Rationale: Simpler than load balancing, sufficient for current scale (single worker per queue). |
| Provider Health | 30-second outage windows. Deprioritize unhealthy providers automatically. | Continuous health checks with auto-reroute. | Callback hooks for health tracking. | Model-level health tracking (existing: consecutiveFailures, autoDisabled). Need: provider-level health metrics. Start with passive tracking (log failures by provider), add active healthchecks later. |
| Attribution | Transparent (response headers show which provider handled request). | Logs show provider + model used. | Detailed request logs with provider info. | Add `provider_used` text field to predictions table. Track full provider chain in logs. UI shows model name only (don't expose provider to end users). |
| Cost Tracking | Per-request cost in dashboard. Supports BYOK for own API keys. | Cost per provider + total aggregated. Budget alerts. | Cost estimation pre-request. | Existing: `model_usage` table tracks daily costs. Need: split by provider (add provider_id to model_usage or create provider_usage table). Show cost breakdown in admin dashboard. |
| Fallback Behavior | Auto fallback on 429, 5xx errors. Configurable via `allow_fallbacks` parameter. | Fallback targets defined per model. Max chain depth configurable. | Fallback defined in routing config. | Existing: fallback on any error (timeout, parse, API error, rate limit). Max depth 1 (Synthetic → Together). Extend to depth 2 (add OpenRouter). No config needed (priority list determines fallback order). |
| Model Deduplication | No deduplication (users specify exact model+provider). Treats "gpt-4 on OpenAI" and "gpt-4 on Azure" as distinct. | No auto-deduplication. Config defines which models are equivalent. | No deduplication. Each provider+model is unique entry. | Custom migration: merge 13 -syn models into base models. Preserve history with provider attribution. Rationale: Reduces UI clutter (42 → ~29 models), consolidates leaderboard stats for equivalent models. |

## Sources

**Multi-Provider LLM Routing Patterns:**
- [Portkey: Failover routing strategies for LLMs in production](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)
- [DEV Community: Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10)
- [DEV Community: Routing, Load Balancing, and Failover in LLM Systems](https://dev.to/debmckinney/routing-load-balancing-and-failover-in-llm-systems-pn3)
- [Medium: A practical guide to OpenRouter (Jan 2026)](https://medium.com/@milesk_33/a-practical-guide-to-openrouter-unified-llm-apis-model-routing-and-real-world-use-d3c4c07ed170)

**Provider Routing & Load Balancing:**
- [LiteLLM: Router - Load Balancing](https://docs.litellm.ai/docs/routing)
- [kgateway: Prioritized model load-balancing](https://kgateway.dev/blog/ai-gateway-load-balancing-model-failover/)
- [Portkey: Load Balancing Docs](https://portkey.ai/docs/product/ai-gateway/load-balancing)
- [DEV Community: Weighted Load Balancing Across LLM Providers](https://dev.to/pranay_batta/weighted-load-balancing-across-llm-providers-without-code-changes-2mjj)

**OpenRouter Specifics:**
- [OpenRouter: Provider Routing Documentation](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter: API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter: Auto Router](https://openrouter.ai/docs/guides/routing/routers/auto-router)
- [VelvetShark: Multi-model routing guide](https://velvetshark.com/openclaw-multi-model-routing)

**Database Migration Patterns:**
- [Airbyte: Database Schema Migration](https://airbyte.com/data-engineering-resources/database-schema-migration)
- [Martin Fowler: Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)
- [Wikipedia: Schema Migration](https://en.wikipedia.org/wiki/Schema_migration)

**Deduplication in ML Systems:**
- [Zilliz: Data Deduplication at Trillion Scale (LLM Training)](https://zilliz.com/blog/data-deduplication-at-trillion-scale-solve-the-biggest-bottleneck-of-llm-training)
- [arXiv: Deduplicating Training Data Makes Language Models Better](https://arxiv.org/abs/2107.06499)

**Existing Codebase Analysis:**
- `/src/lib/llm/index.ts` — Current MODEL_FALLBACKS (3/13 Synthetic models), getFallbackProvider()
- `/src/lib/llm/providers/base.ts` — callAPIWithFallback() with max depth 1, cycle detection
- `/src/lib/db/schema.ts` — predictions table with usedFallback boolean, predictions_match_model_unique constraint
- `/src/lib/db/schema.ts` — models table with health tracking (consecutiveFailures, autoDisabled, lastFailureAt)

---
*Feature research for: Multi-Provider LLM Routing and Model Consolidation*
*Researched: 2026-02-08*
*Confidence: HIGH (verified with official docs, production systems, existing codebase)*
