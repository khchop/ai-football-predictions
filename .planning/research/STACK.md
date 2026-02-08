# Stack Research: OpenRouter Integration & Multi-Provider Routing

**Domain:** LLM Provider Unification & Model Consolidation
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

This milestone adds OpenRouter as a third provider to unify routing (Synthetic → Together → OpenRouter) and consolidates 13 duplicate `-syn` models by merging their prediction history into base model IDs. All required infrastructure exists — **NO NEW DEPENDENCIES NEEDED**. Integration requires only provider class, routing logic, and data migration scripts.

**Key Finding:** OpenRouter uses OpenAI-compatible API format identical to existing Together/Synthetic providers. The existing `OpenAICompatibleProvider` base class handles all API interactions. Zero new packages required.

## Changes Needed (Zero New Dependencies)

### Provider Integration (ZERO packages)

**What's needed:**
- New `OpenRouterProvider` class extending `OpenAICompatibleProvider`
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Authentication: `OPENROUTER_API_KEY` env var (user already configured)
- Pricing: Per-model pricing from OpenRouter API

**Why no new packages:**
- OpenRouter implements OpenAI API spec for `/chat/completions`
- Existing `OpenAICompatibleProvider` handles auth, requests, retries, JSON parsing
- `fetchWithRetry` utility already supports HTTP/429/5xx error handling
- All prompt variants and response handlers work unchanged

**Integration points:**
| Existing | Usage |
|----------|-------|
| `OpenAICompatibleProvider` | Base class with `callAPI()`, `predict()`, `getPredictions()` |
| `fetchWithRetry` | HTTP client with retry logic (handles OpenRouter rate limits) |
| `PromptConfig` | Model-specific prompts/handlers already configured |
| `MODEL_FALLBACKS` | Extend mapping to include OpenRouter fallback chains |

### Multi-Provider Routing (ZERO packages)

**What's needed:**
- Extend `MODEL_FALLBACKS` map to include OpenRouter models
- Modify `getFallbackProvider()` to support 3-tier routing: Synthetic → Together → OpenRouter
- Cycle detection already implemented (validates fallback chains at startup)

**Why no new packages:**
- Existing fallback system (`callAPIWithFallback` in `base.ts`) supports any provider depth
- Validation logic (`validateFallbackMapping()`) already checks cycles and missing targets
- Only requires mapping configuration, not new infrastructure

**Example routing:**
```
deepseek-v3.2-syn (Synthetic) → deepseek-v3.1 (Together) → deepseek-ai/deepseek-v3 (OpenRouter)
```

### Model Consolidation & Data Migration (ZERO packages)

**What's needed:**
- Drizzle ORM custom migration script to UPDATE `predictions.modelId`
- Map 13 `-syn` model IDs to base IDs
- Preserve all prediction history (no data loss)

**Why no new packages:**
- Existing dependencies: `drizzle-orm@0.45.1` supports custom migrations
- Pattern exists: `scripts/migrate-predictions.ts` shows SQL execution via `db.execute(sql.raw())`
- PostgreSQL supports batch UPDATE with CASE statements for efficient remapping

**Migration strategy:**
```sql
-- Example migration pattern (from existing migrate-predictions.ts)
UPDATE predictions
SET model_id = CASE
  WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
  WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-instruct'
  -- ... 11 more mappings
END
WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', ...);
```

### Model Activation (ZERO packages)

**What's needed:**
- Update 7 deprecated Together models: set `active = true` in database
- Models available on OpenRouter: Llama 3.1 70B, Qwen2.5 72B, Mixtral 8x7B, etc.

**Why no new packages:**
- Drizzle ORM already manages `models.active` column
- Simple UPDATE query: `UPDATE models SET active = true WHERE id IN (...)`

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| OpenRouter SDK | Adds unnecessary abstraction over OpenAI-compatible API | Native fetch with `OpenAICompatibleProvider` |
| New HTTP client | `fetchWithRetry` already handles retries, rate limits, circuit breaking | Existing `fetchWithRetry` utility |
| Database migration library | Drizzle Kit generates migrations; custom SQL for data updates | `db.execute(sql.raw())` with custom SQL |
| Model registry package | Model metadata already in provider classes (pricing, tier, config) | Extend `TOGETHER_PROVIDERS` pattern for OpenRouter |
| Routing decision engine | Simple fallback map sufficient for 3-tier routing | Extend `MODEL_FALLBACKS` map |

## Integration Patterns

### Pattern 1: OpenRouter Provider Class

**Location:** `src/lib/llm/providers/openrouter.ts`

**Structure:** (identical to `together.ts` pattern)
```typescript
export class OpenRouterProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  protected getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
      'X-Title': 'Football AI Predictions',
    };
  }
}
```

**Why this works:**
- OpenRouter implements [OpenAI API specification](https://openrouter.ai/docs/api/reference/overview) for `/chat/completions`
- Request format: `{ model, messages, temperature, max_tokens, response_format }`
- Response format: `{ choices: [{ message: { content } }] }`
- Same as Together AI and Synthetic.new (both OpenAI-compatible)

### Pattern 2: Three-Tier Fallback Routing

**Location:** `src/lib/llm/index.ts` (extend `MODEL_FALLBACKS`)

**Structure:**
```typescript
export const MODEL_FALLBACKS: Record<string, string> = {
  // Tier 1 → Tier 2 (Synthetic → Together)
  'deepseek-r1-0528-syn': 'deepseek-r1',
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',

  // Tier 2 → Tier 3 (Together → OpenRouter)
  'deepseek-r1': 'deepseek-ai/deepseek-r1', // OpenRouter model ID
  'qwen3-235b-instruct': 'qwen/qwen-2.5-72b-instruct', // OpenRouter equivalent
};
```

**Why this works:**
- Existing `getFallbackProvider()` traverses map depth-first
- `validateFallbackMapping()` prevents cycles
- Max depth enforcement via BullMQ job attempts (already configured)

### Pattern 3: Prediction History Migration

**Location:** `scripts/migrate-consolidate-models.ts` (new file, existing pattern)

**Structure:** (based on `scripts/migrate-predictions.ts`)
```typescript
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

const MODEL_ID_MAPPING = {
  'deepseek-r1-0528-syn': 'deepseek-r1',
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',
  // ... 11 more mappings
};

async function migrate() {
  const db = getDb();

  // Build CASE statement for batch update
  const caseStatements = Object.entries(MODEL_ID_MAPPING)
    .map(([old_id, new_id]) => `WHEN '${old_id}' THEN '${new_id}'`)
    .join(' ');

  const updateSQL = `
    UPDATE predictions
    SET model_id = CASE model_id ${caseStatements} END
    WHERE model_id IN (${Object.keys(MODEL_ID_MAPPING).map(id => `'${id}'`).join(', ')});
  `;

  await db.execute(sql.raw(updateSQL));
}
```

**Why this works:**
- PostgreSQL CASE statement updates all 13 models in single transaction
- Preserves `predictions` table constraints (foreign key to `models.id`)
- Existing pattern from `migrate-predictions.ts` (line 20: `db.execute(sql.raw())`)

## Version Compatibility

| Existing Package | Version | Compatible With | Notes |
|------------------|---------|-----------------|-------|
| Next.js | 16.1.4 | OpenRouter API | No conflicts, server-side fetch supported |
| Drizzle ORM | 0.45.1 | Custom migrations | `db.execute(sql.raw())` for data updates |
| BullMQ | 5.34.3 | Multi-provider jobs | Job retry logic handles fallback chain depth |
| IORedis | 5.9.2 | Provider caching | Cache active providers (existing `withCache`) |
| TypeScript | ^5 | OpenRouter types | Extend `LLMProvider` interface (no breaking changes) |

**Critical Compatibility Notes:**
- OpenRouter API requires `response_format: { type: 'json_object' }` — already sent by `OpenAICompatibleProvider.callAPI()` (line 246)
- Fallback chain depth limited by BullMQ job attempts — already configured in retry config
- Model ID foreign key constraint in `predictions` table — must map to valid `models.id` during consolidation

## Cost & Performance Comparison

### OpenRouter Pricing vs Together AI

| Model | Together AI | OpenRouter (Together) | OpenRouter Markup |
|-------|-------------|----------------------|-------------------|
| DeepSeek R1 | $3.00/$7.00 | $3.00/$7.00 | 0% (direct passthrough) |
| Qwen 2.5 72B | $1.20/$1.20 | $1.20/$1.20 | 0% (direct passthrough) |
| Llama 3.3 70B | $0.88/$0.88 | $0.88/$0.88 | 0% (direct passthrough) |

**Source:** [OpenRouter Together Provider](https://openrouter.ai/provider/together) shows no markup for Together-hosted models

**Key Finding:** OpenRouter charges Together AI pricing with no markup when routing to Together provider. Cost-neutral fallback option.

### Performance Impact

**Latency:**
- Together AI direct: 980ms median RTT (p95: 1,720ms)
- OpenRouter → Together: 1,420ms median RTT (p95: 2,980ms)
- **Latency increase:** ~45% median, ~73% p95

**Source:** [OpenRouter vs Together AI benchmark](https://www.alibaba.com/product-insights/openrouter-vs-together-ai-which-api-marketplace-offers-the-most-cost-effective-access-to-frontier-open-models.html)

**Uptime:**
- Together AI: 99.95% (Q2 2024)
- OpenRouter: 99.72% (Q2 2024)

**Recommendation:** Use OpenRouter as fallback tier only (Tier 3). Latency impact acceptable for failure recovery, not primary routing.

## Fallback Routing Strategy

### When to Use Each Tier

**Tier 1 (Synthetic.new):** Primary for exclusive models
- Reasoning models: DeepSeek R1 0528, Kimi K2 Thinking, Qwen3 235B Thinking
- Synthetic-exclusive: DeepSeek V3 variants, MiniMax M2.x, GLM 4.6/4.7
- **Fallback:** Together AI equivalents (3/13 mappable)

**Tier 2 (Together AI):** Primary for open-source models
- 29 open-source models with direct provider access
- Lower latency (980ms vs 1,420ms OpenRouter)
- **Fallback:** OpenRouter for 7 deprecated models

**Tier 3 (OpenRouter):** Fallback-only tier
- Use when Synthetic + Together both fail
- Access to 400+ models if needed
- **Fallback:** None (terminal tier)

### Model Availability on OpenRouter

**Confirmed available** ([OpenRouter Models](https://openrouter.ai/models)):
- DeepSeek R1, DeepSeek V3.1 Terminus (671B/37B active)
- Qwen 2.5 7B, Qwen3-Next-80B-A3B-Instruct
- Mistral models (Llama 3.3 70B alternatives)
- Meta Llama 3.3 70B Instruct

**7 deprecated Together models:** Need OpenRouter model ID mapping during implementation

## Environment Configuration

**Required:**
```bash
# Already configured by user
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

**Optional:**
```bash
# OpenRouter-specific config (inherit from existing LLM config)
OPENROUTER_TIMEOUT_MS=15000  # Inherit from LLM_REQUEST_TIMEOUT_MS
OPENROUTER_BATCH_TIMEOUT_MS=20000  # Inherit from LLM_BATCH_TIMEOUT_MS
```

**No new config needed:** OpenRouter provider inherits timeout settings from `OpenAICompatibleProvider` base class (lines 198-205).

## Migration Risk Assessment

### Low Risk
- ✅ Provider class: Extends battle-tested `OpenAICompatibleProvider`
- ✅ Fallback routing: Uses existing `MODEL_FALLBACKS` map with validation
- ✅ API compatibility: OpenAI spec identical to Together/Synthetic

### Medium Risk
- ⚠️ Data migration: 13 model ID updates across `predictions` table
  - **Mitigation:** Single CASE statement transaction, test on staging first
  - **Rollback:** Keep model ID mapping for reversal if needed
- ⚠️ Fallback latency: 45% slower median RTT via OpenRouter
  - **Mitigation:** Use as Tier 3 only (failure recovery, not primary)

### Validation Required
- 🔍 OpenRouter model IDs for 7 deprecated Together models
  - Check OpenRouter API: `GET /api/v1/models` for exact model IDs
  - Map Together model names to OpenRouter equivalents
- 🔍 Pricing verification for OpenRouter-exclusive models
  - Confirm pricing via OpenRouter API or dashboard
  - Update `ModelPricing` in provider instances

## Implementation Checklist

**Provider Integration:**
- [ ] Create `src/lib/llm/providers/openrouter.ts`
- [ ] Define 7+ OpenRouter models (deprecated Together models + exclusives)
- [ ] Add `OPENROUTER_PROVIDERS` array
- [ ] Export in `src/lib/llm/index.ts`

**Routing Configuration:**
- [ ] Extend `MODEL_FALLBACKS` with OpenRouter mappings
- [ ] Verify model ID mappings via OpenRouter API
- [ ] Test fallback chain: Synthetic → Together → OpenRouter
- [ ] Confirm `validateFallbackMapping()` passes

**Data Migration:**
- [ ] Create `scripts/migrate-consolidate-models.ts`
- [ ] Define 13 model ID mappings (`-syn` → base)
- [ ] Test migration on staging database
- [ ] Run migration, verify prediction history preserved
- [ ] Update `models` table: deactivate old `-syn` entries

**Model Activation:**
- [ ] Identify 7 deprecated Together models
- [ ] Map to OpenRouter equivalents
- [ ] UPDATE `models.active = true` for 7 models
- [ ] Verify models appear in active provider list

**Validation:**
- [ ] Test prediction job with each provider
- [ ] Test fallback chain (force failure on Tier 1/2)
- [ ] Verify prediction history after consolidation
- [ ] Check cost tracking (OpenRouter predictions logged)

## Sources

**HIGH Confidence:**
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) — OpenAI-compatible format confirmed
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart) — Authentication and endpoint structure
- [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection) — Auto-fallback behavior
- [OpenRouter Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks) — Automatic failover documentation
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) — Custom SQL migration support
- [Drizzle ORM Custom Migrations](https://orm.drizzle.team/docs/kit-custom-migrations) — Manual data transformations

**MEDIUM Confidence:**
- [OpenRouter Models](https://openrouter.ai/models) — Model availability (updated Feb 2026)
- [OpenRouter Together Provider](https://openrouter.ai/provider/together) — Pricing passthrough confirmed
- [OpenRouter vs Together AI Benchmark](https://www.alibaba.com/product-insights/openrouter-vs-together-ai-which-api-marketplace-offers-the-most-cost-effective-access-to-frontier-open-models.html) — Performance comparison (Q2 2024 data)
- [OpenRouter Pricing Calculator](https://invertedstone.com/calculators/openrouter-pricing) — Cost comparison tool

---
*Stack research for: OpenRouter Integration & Multi-Provider Routing*
*Researched: 2026-02-08*
*Focus: Incremental additions to existing stack (zero new dependencies)*
