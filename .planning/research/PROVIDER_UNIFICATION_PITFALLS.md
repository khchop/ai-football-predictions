# Multi-Provider Routing & Model Consolidation Pitfalls

**Domain:** Multi-provider LLM routing (Synthetic → Together → OpenRouter), model identity consolidation, production data migration
**Researched:** 2026-02-08
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Cascade Timeout Explosion

**What goes wrong:**
Multi-provider fallback chains create additive latency where a request trying 3 providers with 2-second timeouts each can take 6+ seconds total, causing user-visible delays and timeout cascades in dependent services.

**Why it happens:**
Developers treat fallbacks like retries, applying the same timeout to each provider in sequence. When primary provider is rate-limited (not down), requests wait full timeout before failing over, then repeat on fallback.

**How to avoid:**
- Use different timeouts per provider tier (primary: 15s, fallback: 10s, final: 5s)
- Implement circuit breakers per provider (don't wait for timeout if provider known unhealthy)
- Track p99 latency per provider and adjust timeouts dynamically
- Set maximum total request time budget (e.g., 20s across all fallbacks)
- Fail fast on non-retryable errors (400-level client errors should not trigger fallback)

**Warning signs:**
- p99 latency spikes to 3x+ normal during provider degradation
- Queue lag increases despite no traffic increase
- Multiple providers showing elevated error rates simultaneously
- Alert fatigue from timeout alarms during known provider incidents

**Phase to address:**
Phase 1: Provider integration (timeout configuration, circuit breaker setup)
Phase 2: Health monitoring (latency tracking, circuit breaker state visualization)

---

### Pitfall 2: Foreign Key Migration Without Referential Integrity Validation

**What goes wrong:**
Renaming model IDs from `deepseek-r1-0528-syn` to `deepseek-r1-0528` breaks foreign key relationships in `predictions.modelId`, `llm_model_stats.modelId`, `bets.modelId`, and `model_balances.modelId`. Orphaned records cause leaderboard corruption, broken model pages, and cascading failures in aggregation queries.

**Why it happens:**
PostgreSQL foreign keys enforce constraints but don't automatically update references when primary key values change. Developers assume `UPDATE models SET id = new_id` will cascade, but string PKs require explicit `ON UPDATE CASCADE` or manual data migration.

**How to avoid:**
- **Pre-migration validation:**
  - Query all tables with `modelId` foreign keys: `SELECT table_name FROM information_schema.constraint_column_usage WHERE column_name = 'model_id'`
  - Count references per model: `SELECT modelId, COUNT(*) FROM predictions GROUP BY modelId`
  - Export reference counts as migration checkpoint

- **Migration strategy (expand/contract pattern):**
  1. Add new column `modelId_new` to all tables (no FK constraint yet)
  2. Backfill `modelId_new` with renamed IDs
  3. Deploy code reading from `modelId_new` (fallback to `modelId`)
  4. Verify 24 hours — rollback window
  5. Add FK constraint on `modelId_new`
  6. Drop `modelId` column and rename `modelId_new` to `modelId`

- **Post-migration validation:**
  - Checksum validation: compare row counts before/after
  - Referential integrity check: `SELECT COUNT(*) FROM predictions WHERE modelId NOT IN (SELECT id FROM models)` must return 0
  - Aggregate validation: compare leaderboard totals before/after

**Warning signs:**
- Queries returning fewer rows after migration
- Models missing from leaderboard despite having predictions
- `null` values in joins between predictions and models
- Constraint violation errors on INSERT/UPDATE

**Phase to address:**
Phase 3: Data migration (includes all validation, rollback procedures)

---

### Pitfall 3: Cache Invalidation Scope Blindness

**What goes wrong:**
Renaming model IDs invalidates all model-keyed caches, but developers only flush direct model caches (`db:models:active`), missing derived caches (`db:leaderboard:*`, `db:model:*:stats`, `roundup:*`). Stale caches return old model IDs, causing 404s on model pages and incorrect leaderboard rankings.

**Why it happens:**
Cache keys include model IDs but are scattered across the codebase with no central registry. Pattern-based invalidation (`cacheDeletePattern('*modelId*')`) is too broad (flushes unrelated caches) or too narrow (misses nested keys like `db:leaderboard:{hash}` where hash includes model filters).

**How to avoid:**
- **Pre-migration audit:**
  - Grep for all `cacheKeys.*model` patterns
  - Document cache key structure in migration notes
  - Map which caches embed model IDs in keys vs values

- **Invalidation strategy:**
  - Group 1 (direct model keys): `db:models:*`, `db:models:count:active`
  - Group 2 (model-filtered queries): `db:leaderboard:*`, `db:model:*:stats`, `db:stats:overall`
  - Group 3 (content embedding model names): `roundup:*`, `match_content:*`, `blog_posts:*`

- **Implementation:**
  - Phase 1 (during migration): flush ALL caches with `FLUSHDB` (nuclear option, safe during low-traffic window)
  - Phase 2 (post-migration): implement model rename cache hook in `invalidateModelCountCaches()`
  - Phase 3 (ongoing): add cache dependency tracking to `cacheSet()` metadata

**Warning signs:**
- Model pages return 404 despite model existing in database
- Leaderboard shows old model IDs intermittently (cache hit vs miss)
- `/api/models` returns different counts on repeated calls
- Admin dashboard shows stale model health metrics

**Phase to address:**
Phase 3: Data migration (cache flush during migration)
Phase 4: Cache infrastructure (implement dependency tracking)

---

### Pitfall 4: Fallback-Triggered Cost Explosion

**What goes wrong:**
Fallback provider is more expensive than primary (e.g., OpenRouter $3/1M tokens vs Together $0.60/1M). During primary provider outage, all traffic shifts to fallback, causing 5x cost spike. Budget alerts trigger mid-month quota exhaustion.

**Why it happens:**
Routing prioritizes availability over cost. Developers configure fallback chain without cost ceilings or budget-aware routing. During incidents, 100% traffic fails over to premium fallback, and no circuit breaker monitors spend rate.

**How to avoid:**
- **Tiered fallback strategy:**
  - Tier 1: Synthetic (cheapest) → Together (mid-cost) → OpenRouter (most expensive)
  - Tier 2: Configure cost ceilings per tier (e.g., OpenRouter only for critical requests)
  - Tier 3: Implement budget circuit breaker (pause fallback routing if daily spend > threshold)

- **Cost monitoring:**
  - Track cost-per-request by provider in `model_usage` table
  - Alert when hourly spend rate > 2x average
  - Implement fallback attribution: `predictions.usedFallback` + `predictions.fallbackProvider`

- **Emergency controls:**
  - Manual override to disable expensive fallbacks during extended outages
  - Rate limit fallback requests (max N requests/min to premium provider)
  - Queue overflow spillover (queue non-critical requests, don't fallback)

**Warning signs:**
- Daily spend chart shows vertical spikes correlating with provider incidents
- Fallback provider usage >> primary provider usage
- `model_usage.totalCost` anomalies for specific models
- Budget depletion emails before month-end

**Phase to address:**
Phase 1: Provider integration (tiered routing with cost metadata)
Phase 2: Health monitoring (cost tracking dashboard, budget alerts)

---

### Pitfall 5: Duplicate Model Merge Without Prediction Deduplication

**What goes wrong:**
Merging `deepseek-r1` (Together) and `deepseek-r1-0528-syn` (Synthetic) into single ID creates duplicate predictions in `predictions` table. Leaderboard shows model twice, points counted double, rankings corrupted.

**Why it happens:**
Migration script only renames model IDs in `models` table, assuming unique constraint on `(matchId, modelId)` will prevent duplicates. But if both models predicted same match before merge, you have 2 rows with different IDs that now map to same model.

**How to avoid:**
- **Pre-migration conflict detection:**
  ```sql
  SELECT matchId, COUNT(*) as dup_count
  FROM predictions
  WHERE modelId IN ('deepseek-r1', 'deepseek-r1-0528-syn')
  GROUP BY matchId
  HAVING COUNT(*) > 1;
  ```

- **Deduplication strategy (deterministic precedence):**
  - Keep prediction with highest `totalPoints` (best performing)
  - If tied, keep prediction with earliest `createdAt` (first to predict)
  - Mark discarded predictions as `status = 'merged'` (audit trail)

- **Migration SQL:**
  ```sql
  -- Mark duplicates for deletion
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY matchId
      ORDER BY totalPoints DESC NULLS LAST, createdAt ASC
    ) as rn
    FROM predictions
    WHERE modelId IN ('deepseek-r1', 'deepseek-r1-0528-syn')
  )
  UPDATE predictions SET status = 'merged'
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

  -- Update remaining predictions to merged model ID
  UPDATE predictions
  SET modelId = 'deepseek-r1'
  WHERE modelId IN ('deepseek-r1', 'deepseek-r1-0528-syn')
    AND status != 'merged';
  ```

**Warning signs:**
- Leaderboard shows duplicate entries for same model
- Model total points differ between queries (cache inconsistency)
- Unique constraint violations on prediction INSERT after migration
- Prediction count mismatch (sum of per-model counts > total predictions)

**Phase to address:**
Phase 3: Data migration (includes conflict detection, deduplication SQL)

---

### Pitfall 6: Provider-Specific Response Format Drift

**What goes wrong:**
OpenRouter returns different response structure than Together/Synthetic (e.g., `message.reasoning_content` vs `message.reasoning`, pagination wrapper, error format). Parser expecting Together format fails on OpenRouter response, causing prediction failures despite API success.

**Why it happens:**
OpenRouter acts as multi-provider gateway that normalizes schema "across models and providers," but normalization is imperfect. Reasoning models return thinking tokens in different fields, empty responses use different sentinels (`null` vs `""` vs `{"choices": []}`), and rate limit errors have provider-specific formats.

**How to avoid:**
- **Provider abstraction layer:**
  - Create `OpenRouterProvider extends OpenAICompatibleProvider`
  - Override `callAPI()` to normalize response format before returning
  - Map provider-specific error codes to standard error types

- **Response validation:**
  - Schema validation on API response (Zod/JSON schema)
  - Fail fast if response doesn't match expected structure
  - Log full raw response on validation failure (debugging corpus)

- **Testing:**
  - Integration tests with real API calls (not mocks) per provider
  - Record/replay tests with actual provider responses
  - Regression suite validates response parsing for all 42 models

**Warning signs:**
- Prediction failures spike after adding OpenRouter
- Error logs show "Cannot read property 'content' of undefined"
- Some models work, others fail with identical configuration
- Response handler extraction returns `undefined` despite 200 status

**Phase to address:**
Phase 1: Provider integration (OpenRouterProvider implementation, response normalization)
Phase 2: Testing (integration tests for all providers, response validation)

---

### Pitfall 7: Model Behavior Regression on Re-Activation

**What goes wrong:**
Re-activating deprecated models via OpenRouter returns different outputs than original provider. Model that previously passed JSON validation now returns markdown code blocks, thinking tags, or non-English text, causing prediction failures.

**Why it happens:**
OpenRouter may route to different underlying model variant (e.g., `kimi-k2-instruct` instead of `kimi-k2-thinking`), apply different system prompt preprocessing, or use different API parameters (temperature, top_p, response_format). Model behavior drifts because inference implementation differs between providers.

**How to avoid:**
- **Regression testing before re-activation:**
  - Test suite with 10 sample prompts per model
  - Compare OpenRouter responses to historical Together/Synthetic responses
  - Validate JSON structure, language detection, score format
  - Flag models with >20% output drift for manual review

- **Per-model prompt configuration:**
  - Use `PromptConfig` to tune prompts for OpenRouter variants
  - Override `responseHandler` for models returning non-standard formats
  - Document known differences (provider compatibility matrix)

- **Phased rollout:**
  - Activate 1-2 models, monitor for 48 hours
  - Check prediction success rate, parse failures, language errors
  - Only activate remaining models if regression metrics pass

**Warning signs:**
- Parse errors increase after re-activating deprecated models
- Language detection flags English-only models returning Chinese
- Thinking tag stripper reports tags in non-thinking models
- JSON extraction falls back to regex more frequently

**Phase to address:**
Phase 2: Testing (regression suite for re-activated models)
Phase 5: Rollout (phased activation with monitoring gates)

---

### Pitfall 8: Circular Dependency in Provider Routing

**What goes wrong:**
Adding third provider (OpenRouter) to routing logic creates circular dependency: `index.ts` imports `openrouter.ts`, `openrouter.ts` extends `base.ts`, `base.ts` imports `getFallbackProvider()` from `index.ts`. Build fails with "Cannot access 'd' before initialization" or crashes with ReferenceError.

**Why it happens:**
Barrel files (`index.ts`) re-export provider classes, and provider classes import fallback logic from barrel. ESM module resolution initializes barrel first, but barrel tries to import providers that aren't initialized yet. This is a known issue with Next.js Turbopack being stricter than Webpack.

**How to avoid:**
- **Dynamic imports for fallback:**
  - Use `await import('../index')` inside `callAPIWithFallback()` method (already implemented for Synthetic)
  - Move fallback logic out of barrel file into separate `fallback-router.ts`
  - Inject fallback provider via constructor (dependency injection pattern)

- **Build validation:**
  - Test production build with `npm run build` (Turbopack not Webpack)
  - Add pre-commit hook to detect circular imports
  - Use `madge` or `dpdm` to visualize dependency graph

- **Architecture principle:**
  - Barrel files should only re-export, never import from sub-modules
  - Sub-modules should never import from barrel (use direct imports)
  - Keep provider classes pure (no cross-provider dependencies)

**Warning signs:**
- Build fails with "Cannot access before initialization"
- ReferenceError with minified variable name in production logs
- Hot reload works but production build crashes
- Turbopack reports module graph issues

**Phase to address:**
Phase 1: Provider integration (architectural pattern enforcement, build validation)

---

### Pitfall 9: Partial Cache Flush Race Condition

**What goes wrong:**
During model ID migration, cache invalidation happens before database transaction commits. User request hits cache miss, queries database with old model ID, re-caches stale data. Migration completes, but caches contain mix of old and new IDs.

**Why it happens:**
Cache invalidation is fire-and-forget async operation that doesn't respect transaction boundaries. `invalidateModelCountCaches()` flushes Redis immediately, but database UPDATE is still in transaction. If read happens between flush and commit, race condition occurs.

**How to avoid:**
- **Transaction-aware cache invalidation:**
  ```typescript
  await db.transaction(async (tx) => {
    // 1. Update model IDs
    await tx.update(models).set({ id: newId }).where(eq(models.id, oldId));

    // 2. Update all foreign key references
    await tx.update(predictions).set({ modelId: newId }).where(eq(predictions.modelId, oldId));

    // 3. Commit transaction first
  });

  // 4. THEN invalidate caches (after commit)
  await invalidateModelCountCaches();
  await cacheDeletePattern('db:leaderboard:*');
  ```

- **Cache stampede prevention:**
  - Use cache locking during migration window
  - Set short TTL (10s) on caches during migration
  - Implement cache warming after migration (pre-populate with new IDs)

**Warning signs:**
- Intermittent 404s for hours after migration completes
- Leaderboard shows mix of old and new model IDs
- Cache hit rate drops to 0% then slowly recovers
- Logs show "model not found" errors for renamed models

**Phase to address:**
Phase 3: Data migration (transaction ordering, post-migration cache warming)

---

### Pitfall 10: Missing Rollback Data for Model Merge

**What goes wrong:**
Model merge migration deletes duplicate predictions (keeps best, discards rest). Rollback script can't restore deleted predictions because backup only includes final state, not which predictions were marked `status = 'merged'`.

**Why it happens:**
Developers assume rollback means "revert database to backup," but model merge is lossy transformation. Original prediction IDs, timestamps, and scores are lost when rows deleted. Backup captures post-merge state, not pre-merge state.

**How to avoid:**
- **Pre-migration backup strategy:**
  - Export full predictions table to CSV: `COPY predictions TO '/tmp/predictions_pre_merge.csv'`
  - Store backup in S3 with migration timestamp tag
  - Document rollback procedure in migration script comments

- **Soft delete pattern:**
  - Use `status = 'merged'` instead of DELETE (already in approach)
  - Keep merged predictions in table with `deletedAt` timestamp
  - Rollback = `UPDATE predictions SET status = 'scored', deletedAt = NULL WHERE status = 'merged'`

- **Audit trail:**
  - Log all model ID changes to `migration_log` table
  - Include: `oldModelId`, `newModelId`, `affectedRows`, `timestamp`, `operationType`
  - Rollback script reads log and reverses operations

**Warning signs:**
- Rollback script fails with "can't restore deleted rows"
- Post-rollback row counts don't match pre-migration
- Users report missing historical predictions after rollback
- Leaderboard totals differ before vs after rollback

**Phase to address:**
Phase 3: Data migration (soft delete implementation, backup procedures, rollback testing)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip duplicate detection in migration | Faster migration execution | Leaderboard corruption, double-counting points | Never — data integrity critical |
| Use global FLUSHDB for cache invalidation | Simple implementation | Clears unrelated caches, cold cache performance hit | Low-traffic migration window only |
| Hard-code fallback provider order | No configuration overhead | Can't adjust routing without code deploy | MVP only, must add config before prod |
| Skip response format validation | Faster API calls | Silent failures when provider changes response structure | Never — prediction failures expensive |
| Reuse Together pricing for OpenRouter | Less API rate limit usage | Inaccurate cost tracking, budget overruns | Only if tracking real costs separately |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenRouter | Assume OpenAI-compatible = drop-in replacement | Normalize response format, test all 200+ models, handle routing latency |
| Together → OpenRouter fallback | Use same model ID on both providers | Verify model availability on OpenRouter, map to closest equivalent if exact match missing |
| Cache invalidation | Flush only model cache keys | Map full cache dependency graph, flush derived caches (leaderboard, stats) |
| Foreign key migration | Rename PK and assume cascade | Explicit FK constraint update or backfill strategy, validate referential integrity |
| Cost tracking | Log only primary provider costs | Track fallback attribution, separate cost columns per provider |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fallback timeout cascade | p99 latency > 6s during provider outage | Circuit breaker per provider, adaptive timeouts, fail-fast on 400 errors | First provider outage with fallback |
| Cache stampede after flush | Database CPU spike, slow queries | Cache warming script, staggered TTL refresh, lock during migration | Flush during high traffic |
| N+1 queries in leaderboard with renamed models | Page load > 2s, 100+ SQL queries | Preload model metadata, join instead of lookup, query plan analysis | First pageview after migration |
| Sequential migration of 7 models | Migration takes 2+ hours, extended downtime | Batch updates in single transaction, parallel foreign key updates | Large prediction table (>1M rows) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Log full API responses with API keys | Credential exposure in logs | Strip auth headers before logging, use `[REDACTED]` placeholder |
| Store fallback provider credentials in code | Leaked credentials if repo exposed | Environment variables only, rotate keys after leak |
| No rate limiting on fallback provider | DDoS-like behavior during incident | Per-provider rate limiter, queue overflow instead of spam |
| Allow model ID injection in migration script | SQL injection, data corruption | Parameterized queries, whitelist valid model IDs |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during fallback | User sees spinner for 6+ seconds with no feedback | Progressive timeout message: "Trying alternative provider..." |
| Model page 404 after rename | Users can't find favorite model, broken bookmarks | 301 redirect from old model ID to new, update sitemap |
| Leaderboard shows duplicate models | Confusion about which model is correct, trust erosion | Pre-migration deduplication, post-migration validation |
| Missing model predictions after migration | Users think models stopped working | Backfill predictions for renamed models, preserve history |

## "Looks Done But Isn't" Checklist

- [ ] **Foreign key migration:** Verified ALL tables with modelId FK (not just predictions) — query `information_schema` for complete list
- [ ] **Cache invalidation:** Flushed derived caches (leaderboard, stats, roundup) not just model cache — pattern match all `cacheKeys.*model`
- [ ] **Fallback routing:** Tested with real provider outage (not mocks) — manual provider disable, verify fallback triggers
- [ ] **Cost tracking:** Attributed fallback costs to correct provider — check `model_usage.totalCost` breakdown
- [ ] **Duplicate detection:** Ran conflict query on ALL model pairs being merged — not just assumed uniqueness
- [ ] **Rollback testing:** Executed rollback script on staging — verify data integrity, row counts, referential integrity
- [ ] **Response validation:** Tested OpenRouter with real API calls for all models — not just one sample model
- [ ] **Build verification:** Production build with Turbopack (not Webpack) — catches circular dependencies

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Foreign key orphans after migration | MEDIUM | 1. Identify orphaned records with LEFT JOIN, 2. Manual data reconciliation or delete orphans, 3. Rebuild aggregates |
| Cache inconsistency (mix of old/new IDs) | LOW | 1. `FLUSHDB` to clear all caches, 2. Restart app servers, 3. Cache warming script |
| Duplicate predictions in leaderboard | HIGH | 1. Revert database to backup, 2. Re-run migration with deduplication, 3. Rebuild leaderboard |
| Fallback cost overrun | MEDIUM | 1. Disable expensive fallback provider, 2. Queue overflow requests, 3. Budget increase or wait for month reset |
| Provider response format mismatch | LOW | 1. Add response normalization layer, 2. Deploy hotfix, 3. Test with integration suite |
| Circular dependency build failure | LOW | 1. Dynamic import for fallback logic, 2. Rebuild production, 3. Add circular import detection to CI |
| Model behavior regression | MEDIUM | 1. Disable re-activated model, 2. Tune prompt config, 3. Re-test with regression suite |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cascade timeout explosion | Phase 1 (routing), Phase 2 (monitoring) | Load test with simulated provider outage, check p99 latency < 20s |
| Foreign key migration errors | Phase 3 (migration) | Referential integrity query returns 0 orphans |
| Cache invalidation scope blindness | Phase 3 (migration), Phase 4 (cache) | Grep for all cache keys, verify flush during migration, no 404s post-deploy |
| Fallback cost explosion | Phase 1 (routing), Phase 2 (monitoring) | Daily spend < 2x baseline during incident, budget alerts functional |
| Duplicate predictions | Phase 3 (migration) | Conflict detection query returns 0 duplicates, leaderboard unique constraint enforced |
| Provider response format drift | Phase 1 (provider integration), Phase 2 (testing) | Integration tests pass for all providers, response validation catches schema violations |
| Model behavior regression | Phase 2 (testing), Phase 5 (rollout) | Regression suite compares OpenRouter vs Together outputs, <10% drift allowed |
| Circular dependency | Phase 1 (architecture) | Production build succeeds with Turbopack, `madge` reports no cycles |
| Cache flush race condition | Phase 3 (migration) | Cache invalidation happens AFTER transaction commit, no intermittent 404s |
| Missing rollback data | Phase 3 (migration) | Rollback script tested on staging, restores pre-migration state completely |

## Sources

**Multi-provider LLM routing:**
- [Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10)
- [Provider fallbacks: Ensuring LLM availability](https://www.statsig.com/perspectives/providerfallbacksllmavailability)
- [Failover routing strategies for LLMs in production](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)
- [Routing, Load Balancing, and Failover in LLM Systems](https://dev.to/debmckinney/routing-load-balancing-and-failover-in-llm-systems-pn3)
- [LLM Router: Best strategies to route failed LLM requests](https://www.vellum.ai/blog/what-to-do-when-an-llm-request-fails)

**OpenRouter integration:**
- [A practical guide to OpenRouter: Unified LLM APIs, model routing, and real-world use](https://medium.com/@milesk_33/a-practical-guide-to-openrouter-unified-llm-apis-model-routing-and-real-world-use-d3c4c07ed170)
- [Provider Routing | Intelligent Multi-Provider Request Routing | OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Benchmarking Kimi K2.5: Together AI vs Fireworks vs OpenRouter](https://medium.com/@adityakamat007/benchmarking-kimi-k2-5-together-ai-vs-fireworks-vs-openrouter-2217086174f5)
- [OpenRouter Review 2025: API Gateway, Latency & Pricing Compared](https://skywork.ai/blog/openrouter-review-2025-api-gateway-latency-pricing/)

**Database migration & foreign keys:**
- [Migrating Foreign Keys in PostgreSQL](https://thomas.skowron.eu/blog/migrating-foreign-keys-in-postgresql/)
- [Zero-downtime Postgres migrations - the hard parts](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/)
- [Advanced PostgreSQL Migration Techniques: Working with Foreign Key Relationships](https://iifx.dev/en/articles/221306173)
- [Strategy for renaming tables and foreign keys](https://github.com/prisma/prisma/discussions/17038)

**Production data migration:**
- [The Definitive Guide to Handling Duplicates in PostgreSQL](https://dataengjourney.com/the-definitive-guide-to-handling-duplicates-in-postgresql/)
- [PostgreSQL MERGE Statement](https://neon.com/postgresql/postgresql-tutorial/postgresql-merge)
- [15 Proven Best Practices for a Smooth and Secure Database Migration](https://nanobytetechnologies.com/Blog/15-Proven-Best-Practices-for-a-Smooth-and-Secure-Database-Migration)

**Cache invalidation:**
- [How to Build Cache Invalidation Strategies](https://oneuptime.com/blog/post/2026-01-30-cache-invalidation-strategies/view)
- [How to Implement Cache Invalidation with Redis](https://oneuptime.com/blog/post/2026-01-25-redis-cache-invalidation/view)

**Rollback & validation:**
- [Database Rollback Strategies in DevOps](https://www.harness.io/harness-devops-academy/database-rollback-strategies-in-devops)
- [Database Rollbacks in CI/CD: Strategies and Pitfalls](https://medium.com/@jasminfluri/database-rollbacks-in-ci-cd-strategies-and-pitfalls-f0ffd4d4741a)
- [Data Migration Testing in 2026: Strategy and Techniques](https://blog.qasource.com/a-guide-to-data-migration-testing)
- [Data Migration Testing: Strategy & Techniques with Example](https://www.softwaretestinghelp.com/data-migration-testing/)
- [Validating Database Migration: How to Know It Actually Worked](https://www.ispirer.com/blog/validating-database-migration)

**Model deprecation & reactivation:**
- [AI Updates Today (February 2026) – Latest AI Model Releases](https://llm-stats.com/llm-updates)
- [Why Your Large Language Model Strategy Must Account for Obsolescence](https://vertesiahq.com/blog/your-model-has-been-retired-now-what)
- [LLM Serverless Model Deprecation Notice](https://novita.ai/docs/changelog/25-12-25)

---
*Pitfalls research for: Multi-provider LLM routing + model identity consolidation + production data migration*
*Researched: 2026-02-08*
