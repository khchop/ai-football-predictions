# OpenRouter Integration & Provider Unification Research Summary

**Project:** BettingSoccer - Multi-Provider LLM Routing
**Domain:** Provider unification, model consolidation, OpenRouter integration
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Adding OpenRouter as a third provider tier (Synthetic → Together → OpenRouter) and consolidating 13 duplicate `-syn` model IDs is primarily an **integration and data migration challenge**, not an infrastructure build. The critical finding: **zero new runtime dependencies required**. OpenRouter implements the OpenAI API specification identically to existing Together/Synthetic providers, meaning the current `OpenAICompatibleProvider` base class handles all API interactions without modification.

The project breaks into three parallel tracks: (1) **Provider integration** — add OpenRouterProvider class with same pattern as SyntheticProvider/TogetherProvider, (2) **Model consolidation** — database migration merging 13 `-syn` model IDs into canonical IDs while preserving all prediction history, and (3) **Routing enhancement** — extend MODEL_FALLBACKS map to support 3-tier provider chains with validation.

The primary risk is **foreign key migration complexity**. Renaming model IDs from `deepseek-r1-0528-syn` to `deepseek-r1` requires updating foreign keys in predictions, llm_model_stats, bets, and model_balances tables. PostgreSQL doesn't cascade string PK updates automatically, requiring explicit backfill strategy with referential integrity validation. Secondary risk: **fallback cost explosion** during provider outages (OpenRouter costs 2-5x Together for some models), requiring budget circuit breakers and cost-aware routing tiers.

The recommended approach: **expand/contract migration pattern** (add new columns, backfill, deploy code reading both, validate 24h, cut over) with comprehensive pre/post validation (row count checksums, referential integrity checks, leaderboard aggregate validation). Phase ordering is critical: foundations first (provider class, routing logic, validation scripts), migration second (database changes with rollback capability), worker integration third (update prediction jobs), monitoring fourth (cost tracking, fallback analytics).

## Key Findings

### Recommended Stack

**No new dependencies needed.** OpenRouter integration leverages existing infrastructure:

**Core technologies already in place:**
- **OpenAICompatibleProvider base class**: Handles authentication, request formatting, retries, JSON parsing for OpenAI-compatible APIs — OpenRouter uses identical spec
- **fetchWithRetry utility**: HTTP client with retry logic already supports rate limits (429), server errors (5xx) — works with OpenRouter unchanged
- **Drizzle ORM v0.45.1**: Supports custom migrations via `db.execute(sql.raw())` for model ID updates — pattern exists in `scripts/migrate-predictions.ts`
- **BullMQ v5.34.3**: Job retry logic handles fallback chain depth — existing configuration supports multi-tier routing
- **Next.js 16.1.4**: Server-side fetch compatible with OpenRouter API — no framework conflicts

**Why no packages needed:**
- OpenRouter implements [OpenAI API spec](https://openrouter.ai/docs/api/reference/overview): identical request format (`{ model, messages, temperature, response_format }`), same response structure (`{ choices: [{ message: { content } }] }`)
- Existing `MODEL_FALLBACKS` map supports arbitrary depth — just needs configuration extension for 3-tier routing
- PostgreSQL CASE statements handle batch model ID updates — no migration tool required
- Fallback validation (`validateFallbackMapping()`) already prevents cycles — works with extended chains

**Small additions (configuration only):**
- **OpenRouterProvider class** (`src/lib/llm/providers/openrouter.ts`) — extends existing base class, adds OpenRouter-specific headers/pricing
- **Provider routing module** (`src/lib/llm/provider-routing.ts`) — PROVIDER_ROUTES map + getProviderForModel() lookup function
- **Migration script** (`scripts/migrate-model-consolidation.ts`) — custom SQL for model ID merge + FK updates

### Expected Features

**Must have (provider unification MVP):**
- **OpenRouter Provider Class** — Third provider integration, LOW complexity (copy SyntheticProvider pattern)
- **Provider Priority Lists** — Replace binary fallback map with ordered arrays per model (Synthetic → Together → OpenRouter)
- **Extended Failover Logic** — Support 3-tier routing with max depth enforcement, LOW complexity (loop through priority list)
- **Prediction History Migration** — Consolidate 13 `-syn` model predictions into base IDs, HIGH complexity (foreign key updates, data integrity checks)
- **Provider Attribution Tracking** — Add `provider_used` field to track actual provider that served request, not just binary `usedFallback` flag
- **Model ID Cleanup** — Remove `-syn` suffix from 6 Synthetic-only models, update all references (19 models total: 13 merges + 6 renames)
- **Re-activate Deprecated Models** — Add 7 Together models back via OpenRouter (Llama 3.1 70B, Qwen 2.5 72B, etc.)

**Should have (post-MVP optimization):**
- **Provider Health Scoring** — Track success rate, latency, error rate per provider (not just per model) — improves routing decisions
- **Dynamic Priority Adjustment** — Auto-deprioritize unhealthy providers based on rolling window metrics
- **Cost Reporting by Provider** — Show cost breakdown in admin dashboard (`provider_used` field enables aggregation)
- **Fallback Analytics Dashboard** — Visualize fallback rates, success paths, cost impact of provider failures

**Defer (v2+ features):**
- **Weighted Load Balancing** — Probabilistic traffic distribution instead of sequential fallback (conflicts with current architecture)
- **Provider-Specific Prompt Tuning** — Different prompts per provider, not just per model (combinatorial explosion: 42 models × 3 providers)
- **Cross-Provider Model Consolidation** — Treat "deepseek-r1" on Together and OpenRouter as identical (risks attribution confusion)
- **OpenRouter Auto Router** — Use OpenRouter's automatic model selection (breaks attribution, contradicts leaderboard concept)

### Architecture Approach

The architecture follows a **provider-agnostic model identity** pattern: each unique LLM (e.g., `deepseek-r1`) has a single model ID in database, while provider routing happens transparently at API layer.

**Major components:**

1. **OpenRouterProvider** — Extends `OpenAICompatibleProvider` with OpenRouter-specific configuration (endpoint: `https://openrouter.ai/api/v1/chat/completions`, headers: Bearer auth + HTTP-Referer + X-Title, pricing: per-model from OpenRouter API, fallback models: optional `models` array for OpenRouter's native fallback)

2. **Provider Routing Module** — Centralizes provider selection logic (PROVIDER_ROUTES: maps model IDs to priority arrays, getProviderForModel(): resolves model ID to provider instance trying providers in order, isProviderAvailable(): checks API key configuration, prevents routing to unconfigured providers)

3. **Model Consolidation Migration** — Database transformation preserving prediction history (conflict detection: identify matches predicted by both old/new model IDs, deduplication strategy: keep prediction with highest totalPoints or earliest createdAt, foreign key updates: update predictions, llm_model_stats, bets, model_balances, stats merging: aggregate health metrics into target model)

4. **Worker Integration** — Update prediction jobs to use unified model lookup (replace: iteration through ALL_PROVIDERS, with: getProviderForModel(modelId), benefits: respects provider priority, handles fallback chains transparently, tracks provider attribution)

**Data flow changes:**

**Before:**
```
Worker → getActiveProviders() → filter by API key → iterate providers → provider.callAPI()
                                                          ↓
                                                  predictions (modelId = provider.id)
```

**After:**
```
Worker → getActiveProviders() → unified model list → getProviderForModel(modelId)
                                                          ↓
                                                Try Synthetic → Together → OpenRouter
                                                          ↓
                                                  predictions (modelId = unified ID)
```

**Integration points:**
- `src/lib/llm/index.ts` — Add OPENROUTER_PROVIDERS to ALL_PROVIDERS, extend getActiveProviders() with OPENROUTER_API_KEY check
- `src/lib/llm/provider-routing.ts` — NEW: provider priority configuration + lookup logic
- `src/lib/llm/providers/openrouter.ts` — NEW: OpenRouterProvider class + model instances
- `src/lib/queue/workers/predictions.worker.ts` — Replace direct provider iteration with getProviderForModel()
- `scripts/migrate-model-consolidation.ts` — NEW: one-time migration for model ID merge

### Critical Pitfalls

1. **Cascade Timeout Explosion** — Multi-provider fallback chains create additive latency (3 providers × 15s timeout = 45s total request time). **Prevention:** Tiered timeouts (primary: 15s, fallback: 10s, final: 5s), circuit breakers per provider (skip unhealthy providers), maximum total request budget (20s across all fallbacks), fail fast on non-retryable errors (400-level shouldn't trigger fallback)

2. **Foreign Key Migration Without Referential Integrity Validation** — Renaming model IDs breaks foreign keys in predictions, llm_model_stats, bets, model_balances causing orphaned records and leaderboard corruption. **Prevention:** Pre-migration validation (count references per model, export checksum), expand/contract pattern (add new column → backfill → deploy dual-read code → validate 24h → cut over), post-migration validation (referential integrity check: `SELECT COUNT(*) FROM predictions WHERE modelId NOT IN (SELECT id FROM models)` must return 0)

3. **Cache Invalidation Scope Blindness** — Model ID rename invalidates caches but developers miss derived caches (`db:leaderboard:*`, `db:model:*:stats`, `roundup:*`). **Prevention:** Pre-migration cache audit (grep all `cacheKeys.*model` patterns), invalidation strategy (Group 1: direct model keys, Group 2: model-filtered queries, Group 3: content embedding names), nuclear option during migration (FLUSHDB during low-traffic window), post-migration cache dependency tracking

4. **Fallback-Triggered Cost Explosion** — OpenRouter fallback costs 2-5x Together for some models, causing budget spikes during provider outages. **Prevention:** Tiered fallback strategy (cheapest → mid-cost → most expensive), cost ceilings per tier (OpenRouter only for critical requests), budget circuit breaker (pause fallback if daily spend > threshold), cost monitoring (track cost-per-request by provider, alert when hourly spend > 2x average)

5. **Duplicate Model Merge Without Prediction Deduplication** — Merging `deepseek-r1` (Together) + `deepseek-r1-0528-syn` (Synthetic) creates duplicate predictions if both predicted same match. **Prevention:** Pre-migration conflict detection (find matches with predictions from both model IDs), deduplication strategy (keep prediction with highest totalPoints or earliest createdAt), soft delete (mark duplicates as `status = 'merged'` instead of DELETE for rollback capability)

6. **Provider-Specific Response Format Drift** — OpenRouter returns different response structure than Together/Synthetic (reasoning_content vs reasoning, pagination wrappers, error formats). **Prevention:** Provider abstraction (OpenRouterProvider normalizes responses before returning), response validation (Zod schema on API response), integration tests with real API calls (not mocks) per provider

7. **Model Behavior Regression on Re-Activation** — Re-activating deprecated models via OpenRouter returns different outputs than original provider (different variants, preprocessing, temperature). **Prevention:** Regression testing before activation (10 sample prompts, compare to historical outputs), per-model prompt config tuning, phased rollout (1-2 models, monitor 48h, then activate rest)

8. **Circular Dependency in Provider Routing** — `index.ts` imports `openrouter.ts`, `openrouter.ts` extends `base.ts`, `base.ts` imports `getFallbackProvider()` from `index.ts` causes "Cannot access before initialization" in Turbopack. **Prevention:** Dynamic imports for fallback (`await import('../index')`), move fallback logic to separate module, barrel files only re-export (never import from sub-modules)

9. **Partial Cache Flush Race Condition** — Cache invalidation before database commit causes stale data re-caching between flush and commit. **Prevention:** Transaction-aware invalidation (invalidate AFTER commit, not before), cache locking during migration, short TTL (10s) during migration window, cache warming after migration

10. **Missing Rollback Data for Model Merge** — Model merge deletes duplicate predictions, backup only captures post-merge state, can't restore. **Prevention:** Pre-migration backup (export full predictions table to CSV/S3), soft delete pattern (keep merged predictions with `status = 'merged'`), audit trail (log all changes to migration_log table with rollback instructions)

## Implications for Roadmap

Based on research, suggested phase structure follows **foundations → migration → integration → monitoring** order. Critical: don't skip validation steps or skip directly to worker integration before data is correct.

### Phase 1: Provider Integration Foundations
**Rationale:** Must have OpenRouter provider class and routing logic before any model consolidation. Provider routing is dependency for migration (determines which models to merge).
**Delivers:** OpenRouterProvider class (extends OpenAICompatibleProvider, OpenRouter-specific headers/pricing), PROVIDER_ROUTES configuration (priority arrays per model), getProviderForModel() lookup function (tries providers in order, checks API key availability), validation scripts (ensure no duplicate model IDs, verify routing chains)
**Addresses:** Circular dependency pitfall, provider response format drift
**Duration:** 2-3 days
**Research needed:** None — pattern exists in SyntheticProvider/TogetherProvider

### Phase 2: Migration Script Development
**Rationale:** Database migration is highest risk component. Must build, test, and validate migration on staging before production.
**Delivers:** Migration script (`scripts/migrate-model-consolidation.ts`), pre-migration validation (conflict detection, reference counts, FK audit), deduplication logic (deterministic precedence, soft delete), post-migration validation (referential integrity checks, row count checksums, leaderboard aggregates), rollback script (restore from backup, undo ID changes)
**Addresses:** Foreign key migration pitfall, duplicate prediction pitfall, missing rollback data
**Duration:** 3-4 days
**Research needed:** None — Drizzle migration patterns documented, PostgreSQL FK behavior well-understood

### Phase 3: Data Migration Execution
**Rationale:** One-time data transformation preserving all prediction history. Requires downtime window or expand/contract pattern.
**Delivers:** Backup creation (full predictions table export to S3), migration execution (update model IDs in models, predictions, llm_model_stats, bets, model_balances), cache flush (FLUSHDB or targeted invalidation), referential integrity validation, before/after comparison report
**Addresses:** Cache invalidation scope blindness, partial cache flush race condition
**Duration:** 2-3 hours execution + 24h validation window
**Research needed:** None — execution only, migration script tested in Phase 2

### Phase 4: Worker Integration
**Rationale:** Update prediction workers to use unified model lookup and provider routing. Only deploy after data migration complete and validated.
**Delivers:** Update predictions.worker.ts (replace ALL_PROVIDERS iteration with getProviderForModel()), provider attribution tracking (log actual provider used in predictions table), fallback chain testing (verify Synthetic → Together → OpenRouter routing), production validation (canary deployment, monitor error rates)
**Addresses:** Worker integration, provider attribution tracking
**Duration:** 1-2 days
**Research needed:** None — worker pattern exists, provider routing tested in Phase 1

### Phase 5: Model Re-Activation
**Rationale:** Re-activate 7 deprecated Together models via OpenRouter. Low risk since fallback-only (not primary provider).
**Delivers:** Add 7 OpenRouter model instances (Llama 3.1 70B, Qwen 2.5 72B, Mixtral 8x7B, etc.), update models table (set active = true), provider routing config (OpenRouter-only for these models), regression testing (verify outputs match expectations)
**Addresses:** Model behavior regression pitfall
**Duration:** 1 day
**Research needed:** Need to verify OpenRouter model IDs for 7 deprecated Together models

### Phase 6: Monitoring & Cost Tracking
**Rationale:** Long-term success requires visibility into provider health, fallback rates, and cost attribution.
**Delivers:** Provider health dashboard (success rate, latency, error rate per provider), cost breakdown by provider (extend model_usage table or create provider_usage), fallback analytics endpoint (`/api/admin/fallback-stats` with provider breakdown), budget circuit breaker (alert/pause when daily spend exceeds threshold)
**Addresses:** Fallback cost explosion pitfall, provider health monitoring
**Duration:** 2-3 days
**Research needed:** None — extends existing monitoring patterns

### Phase Ordering Rationale

- **Provider integration before migration (Phase 1 → 2)** — Must know provider routing logic to determine which models to consolidate. Migration depends on understanding which model IDs map to which providers.
- **Migration script development before execution (Phase 2 → 3)** — Cannot execute migration without tested, validated script. Staging testing is mandatory to avoid production data corruption.
- **Data migration before worker integration (Phase 3 → 4)** — Workers must read from unified model IDs. Deploying worker changes before migration causes model lookup failures.
- **Worker integration before re-activation (Phase 4 → 5)** — Re-activated models use new provider routing. Must have routing logic in workers before activating OpenRouter-only models.
- **Monitoring after core integration (Phase 6 last)** — Monitoring enhances existing functionality but isn't blocking. Can deploy incrementally after core routing works.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Model Re-Activation):** Need to map 7 deprecated Together models to OpenRouter equivalents. OpenRouter model IDs may differ (e.g., `meta-llama/llama-3.1-70b-instruct` vs `llama-3.1-70b`). Requires OpenRouter API call: `GET /api/v1/models` to verify exact IDs and availability.

**Phases with standard patterns (skip research):**
- **Phase 1:** Provider class pattern exists (SyntheticProvider, TogetherProvider)
- **Phase 2:** Migration script pattern exists (`scripts/migrate-predictions.ts`)
- **Phase 3:** Database migration execution is operational, not research
- **Phase 4:** Worker integration pattern exists (predictions.worker.ts)
- **Phase 6:** Monitoring pattern exists (model_usage tracking, admin endpoints)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Zero new dependencies confirmed, OpenRouter API spec matches existing providers, Drizzle migration patterns proven |
| **Features** | HIGH | Provider priority lists follow industry patterns (OpenRouter, Portkey, LiteLLM), model consolidation is database operation (not novel architecture) |
| **Architecture** | HIGH | Provider-agnostic model identity pattern is standard multi-provider approach, existing base class handles all variations |
| **Pitfalls** | HIGH | Foreign key migration risks well-documented, fallback cost explosion confirmed in research, circular dependency matches quick-013 experience |

**Overall confidence:** HIGH

Research is grounded in existing codebase (OpenAICompatibleProvider base class, MODEL_FALLBACKS map, migration script patterns), verified against OpenRouter official documentation, and informed by production multi-provider patterns (Portkey, LiteLLM routing strategies). The primary unknowns are operational (exact OpenRouter model IDs for deprecated models) not architectural.

### Gaps to Address

**During Phase 5 (Model Re-Activation):**
- **OpenRouter model ID mapping** — 7 deprecated Together models need exact OpenRouter model IDs verified. Check OpenRouter API: `GET /api/v1/models` for canonical IDs and availability status.
- **Pricing verification** — Confirm OpenRouter pricing for re-activated models matches documented rates. Update ModelPricing in provider instances if discrepancies found.
- **Model behavior validation** — Test sample predictions from re-activated models to ensure output quality/format matches Together historical data. Flag models with >20% drift for prompt config tuning.

**During Phase 3 (Data Migration):**
- **Actual conflict count** — Pre-migration validation will reveal how many matches have duplicate predictions (both old/new model IDs). If high (>1000), may need phased deduplication or manual review of high-value predictions.
- **Downtime window** — Migration execution time depends on predictions table size (currently unknown row count). If >1M predictions, may need expand/contract pattern instead of single-transaction migration.

**Post-deployment (Phase 6+):**
- **Fallback rate in production** — Unknown how often OpenRouter fallback will trigger. If >20% of requests use fallback, indicates primary providers (Synthetic/Together) unreliable. May need dynamic priority adjustment or provider health alerts.
- **Cost impact validation** — Budget projections assume OpenRouter pricing matches documented rates and fallback usage <10%. First month post-deployment will validate assumptions. If costs spike >50%, may need budget circuit breaker or provider tier restrictions.

## Sources

### High Confidence (OpenRouter Official Documentation)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) — OpenAI-compatible format confirmed, authentication, endpoint structure
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart) — Integration patterns, API key setup, request/response examples
- [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection) — Auto-fallback behavior, provider.order configuration, health-based routing
- [OpenRouter Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks) — Automatic failover via `models` array parameter
- [OpenRouter Models](https://openrouter.ai/models) — Model availability catalog (Feb 2026), pricing, provider hosting

### High Confidence (Database Migration Patterns)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) — Custom SQL migration support, schema evolution
- [Drizzle ORM Custom Migrations](https://orm.drizzle.team/docs/kit-custom-migrations) — Manual data transformations via `db.execute()`
- [Migrating Foreign Keys in PostgreSQL](https://thomas.skowron.eu/blog/migrating-foreign-keys-in-postgresql/) — FK update strategies, referential integrity
- [Zero-downtime Postgres migrations](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/) — Expand/contract pattern, validation techniques
- [PostgreSQL MERGE Statement](https://neon.com/postgresql/postgresql-tutorial/postgresql-merge) — Batch update patterns, CASE statements

### High Confidence (Multi-Provider Routing)
- [Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) — Routing patterns, fallback strategies, cost management
- [Provider fallbacks: Ensuring LLM availability](https://www.statsig.com/perspectives/providerfallbacksllmavailability) — Availability patterns, circuit breakers
- [Failover routing strategies for LLMs in production](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/) — Portkey routing patterns, health-based priority
- [Routing, Load Balancing, and Failover in LLM Systems](https://dev.to/debmckinney/routing-load-balancing-and-failover-in-llm-systems-pn3) — Load balancing vs sequential fallback tradeoffs

### Medium Confidence (Cost Tracking & Budget Management)
- [OpenRouter Together Provider](https://openrouter.ai/provider/together) — Pricing passthrough, no markup for Together-hosted models
- [OpenRouter vs Together AI Benchmark](https://www.alibaba.com/product-insights/openrouter-vs-together-ai-which-api-marketplace-offers-the-most-cost-effective-access-to-frontier-open-models.html) — Performance comparison, latency analysis
- [Budget limits and alerts in LLM apps](https://portkey.ai/blog/budget-limits-and-alerts-in-llm-apps/) — Budget tracking patterns, circuit breakers

### Medium Confidence (Cache Invalidation)
- [How to Build Cache Invalidation Strategies](https://oneuptime.com/blog/post/2026-01-30-cache-invalidation-strategies/view) — Invalidation patterns, race condition prevention
- [How to Implement Cache Invalidation with Redis](https://oneuptime.com/blog/post/2026-01-25-redis-cache-invalidation/view) — Redis-specific patterns, TTL strategies

### Existing Codebase (High Confidence)
- `src/lib/llm/providers/base.ts` — OpenAICompatibleProvider implementation, callAPIWithFallback()
- `src/lib/llm/providers/synthetic.ts` — SyntheticProvider pattern (template for OpenRouterProvider)
- `src/lib/llm/index.ts` — MODEL_FALLBACKS map, getFallbackProvider(), validateFallbackMapping()
- `scripts/migrate-predictions.ts` — Migration script pattern with db.execute(sql.raw())
- `src/lib/db/schema.ts` — Foreign key structure (predictions.modelId, models.id)

---

*Research completed: 2026-02-08*
*Ready for roadmap: yes*
*Next step: Define milestone requirements for provider unification*
