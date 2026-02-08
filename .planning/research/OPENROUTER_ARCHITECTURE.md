# Architecture Patterns

**Domain:** Multi-Provider LLM Routing with OpenRouter Integration
**Researched:** 2026-02-08

## Recommended Architecture

### Overview

The integration follows a **provider-agnostic model identity** pattern where each unique LLM (e.g., `deepseek-r1`) has a single model ID in the database, while provider routing (Synthetic → Together → OpenRouter) happens transparently at the API layer.

```
User Request → ModelRouter → [Synthetic, Together, OpenRouter] → Response
                    ↓
            Single Model ID in DB
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ModelRouter** | Accepts model ID, tries providers in priority order | OpenRouterProvider, existing providers |
| **OpenRouterProvider** | Extends OpenAICompatibleProvider with OpenRouter-specific config | ModelRouter, OpenRouter API |
| **ProviderRegistry** | Maps model IDs to provider priority lists | ModelRouter, ALL_PROVIDERS |
| **Migration Script** | Merges duplicate -syn model IDs, updates foreign keys | PostgreSQL models + predictions tables |
| **Model Sync** | Syncs unified model list to database | PostgreSQL models table |

### Data Flow

**Current State:**
```
Match → Worker → getActiveProviders() → [provider1, provider2, ...] → callAPI()
                                                ↓
                                        predictions table (modelId FK)
```

**New State:**
```
Match → Worker → getActiveProviders() → ModelRouter.predict(modelId)
                                             ↓
                                    Try Synthetic → callAPIWithFallback()
                                    ↓ (fail)
                                    Try Together → callAPIWithFallback()
                                    ↓ (fail)
                                    Try OpenRouter → callAPI()
                                             ↓
                                    predictions table (modelId FK)
```

## Patterns to Follow

### Pattern 1: Provider Priority Lists

**What:** Define provider order per model at configuration time, not runtime.

**When:** Model has multiple provider sources (e.g., `deepseek-r1` on Synthetic, Together, OpenRouter).

**Implementation:**

```typescript
// src/lib/llm/provider-routing.ts

export interface ProviderRoute {
  modelId: string;
  providers: string[]; // Priority order: ['synthetic', 'together', 'openrouter']
}

export const PROVIDER_ROUTES: Record<string, string[]> = {
  // DeepSeek R1: Try Synthetic first (newest version), Together second, OpenRouter third
  'deepseek-r1': ['synthetic', 'together', 'openrouter'],

  // Kimi K2: Try Synthetic thinking variant first, Together instruct second, OpenRouter third
  'kimi-k2': ['synthetic', 'together', 'openrouter'],

  // MiniMax M2: Synthetic only currently, OpenRouter as fallback
  'minimax-m2': ['synthetic', 'openrouter'],

  // GLM 4.6: Synthetic only currently, OpenRouter as fallback
  'glm-4.6': ['synthetic', 'openrouter'],

  // Re-activated via OpenRouter: OpenRouter only
  'llama-3.1-70b': ['openrouter'],
  'qwen2.5-coder-32b': ['openrouter'],
  // ... 7 re-activated models
};

export function getProviderPriority(modelId: string): string[] {
  return PROVIDER_ROUTES[modelId] || ['together']; // Default to Together for unspecified
}
```

**Rationale:**
- Declarative configuration makes routing logic explicit and auditable
- Enables per-model optimization (newest version, best reliability, cost preference)
- Avoids runtime provider discovery complexity

### Pattern 2: Unified Provider Lookup

**What:** Single function resolves model ID to LLMProvider instance, trying providers in order.

**When:** Worker needs to generate predictions for a model ID.

**Implementation:**

```typescript
// src/lib/llm/provider-routing.ts

import { LLMProvider } from '@/types';
import { ALL_PROVIDERS } from './index';
import { SYNTHETIC_PROVIDERS } from './providers/synthetic';
import { TOGETHER_PROVIDERS } from './providers/together';
import { OPENROUTER_PROVIDERS } from './providers/openrouter'; // NEW

// Map provider name to instance array
const PROVIDER_MAP: Record<string, LLMProvider[]> = {
  synthetic: SYNTHETIC_PROVIDERS,
  together: TOGETHER_PROVIDERS,
  openrouter: OPENROUTER_PROVIDERS, // NEW
};

/**
 * Get provider instance for a model ID, trying providers in priority order
 * @param modelId - Unified model ID (e.g., 'deepseek-r1', 'minimax-m2')
 * @param providerName - Optional provider override for manual fallback
 * @returns LLMProvider instance or undefined if not found
 */
export function getProviderForModel(
  modelId: string,
  providerName?: string
): LLMProvider | undefined {
  // Manual override: specific provider requested
  if (providerName) {
    const providerList = PROVIDER_MAP[providerName];
    return providerList?.find(p => p.id === modelId);
  }

  // Try providers in priority order
  const priority = getProviderPriority(modelId);
  for (const name of priority) {
    const providerList = PROVIDER_MAP[name];
    const provider = providerList?.find(p => p.id === modelId);
    if (provider) {
      // Check if API key is configured for this provider
      if (isProviderAvailable(name)) {
        return provider;
      }
    }
  }

  return undefined;
}

function isProviderAvailable(providerName: string): boolean {
  switch (providerName) {
    case 'synthetic':
      return !!process.env.SYNTHETIC_API_KEY;
    case 'together':
      return !!process.env.TOGETHER_API_KEY;
    case 'openrouter':
      return !!process.env.OPENROUTER_API_KEY;
    default:
      return false;
  }
}
```

**Rationale:**
- Single source of truth for provider resolution
- Respects API key availability (graceful degradation)
- Enables manual provider override for debugging/testing

### Pattern 3: OpenRouter Provider with Model Fallbacks

**What:** OpenRouter supports native model fallback arrays via `models` parameter.

**When:** Primary model fails, OpenRouter tries fallback models automatically.

**Implementation:**

```typescript
// src/lib/llm/providers/openrouter.ts

import { OpenAICompatibleProvider } from './base';
import { ModelPricing, ModelTier } from './together';
import { PromptConfig } from '../prompt-variants';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  public readonly tier: ModelTier;
  public readonly pricing: ModelPricing;
  public readonly promptConfig: PromptConfig;
  public readonly fallbackModels?: string[]; // NEW: OpenRouter-specific fallback array

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly model: string, // OpenRouter model ID (e.g., 'deepseek/deepseek-r1')
    public readonly displayName: string,
    tier: ModelTier,
    pricing: ModelPricing,
    public readonly isPremium: boolean = false,
    promptConfig: PromptConfig = {},
    fallbackModels?: string[] // NEW
  ) {
    super();
    this.tier = tier;
    this.pricing = pricing;
    this.promptConfig = promptConfig;
    this.fallbackModels = fallbackModels;
  }

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured (OPENROUTER_API_KEY)');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Football AI Predictions',
    };
  }

  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Override to use OpenRouter model fallbacks
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: systemPrompt === BATCH_SYSTEM_PROMPT ? 800 : 150,
      response_format: { type: 'json_object' },
    };

    // Add OpenRouter-specific fallback models if configured
    if (this.fallbackModels && this.fallbackModels.length > 0) {
      body.models = [this.model, ...this.fallbackModels];
    }

    // Use parent class logic for retry/parsing
    return super.callAPI(systemPrompt, userPrompt);
  }
}

// Example provider instances
export const DeepSeekR1_OpenRouterProvider = new OpenRouterProvider(
  'deepseek-r1',
  'openrouter',
  'deepseek/deepseek-r1', // OpenRouter model ID
  'DeepSeek R1 (OpenRouter)',
  'premium',
  { promptPer1M: 0.55, completionPer1M: 2.19 }, // OpenRouter pricing
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
  },
  ['deepseek/deepseek-r1-distill-qwen-32b'] // Fallback to distilled version
);

export const OPENROUTER_PROVIDERS = [
  DeepSeekR1_OpenRouterProvider,
  // ... 7 re-activated models
  // ... 6 -syn models now available via OpenRouter
];
```

**Rationale:**
- Leverages OpenRouter's native fallback mechanism (automatic, no code changes)
- Reduces custom fallback logic complexity
- Provides cost optimization (fallback to cheaper distilled models)

### Pattern 4: Model ID Consolidation via Migration Script

**What:** Merge duplicate `-syn` model IDs into canonical IDs, update foreign keys.

**When:** One-time migration before deploying new provider routing.

**Implementation:**

```typescript
// scripts/migrate-model-consolidation.ts

import { getDb } from '../src/lib/db';
import { models, predictions } from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

interface ModelMapping {
  oldId: string; // e.g., 'deepseek-r1-0528-syn'
  newId: string; // e.g., 'deepseek-r1'
  reason: string;
}

const MODEL_CONSOLIDATIONS: ModelMapping[] = [
  // Duplicate models (same LLM, different providers)
  { oldId: 'deepseek-r1-0528-syn', newId: 'deepseek-r1', reason: 'Same model, consolidate to canonical ID' },
  { oldId: 'kimi-k2-thinking-syn', newId: 'kimi-k2', reason: 'Same model, consolidate to canonical ID' },
  { oldId: 'kimi-k2.5-syn', newId: 'kimi-k2', reason: 'Same model family, consolidate' },

  // Models removing -syn suffix (Synthetic-exclusive, now also on OpenRouter)
  { oldId: 'minimax-m2-syn', newId: 'minimax-m2', reason: 'Remove -syn suffix' },
  { oldId: 'minimax-m2.1-syn', newId: 'minimax-m2.1', reason: 'Remove -syn suffix' },
  { oldId: 'glm-4.6-syn', newId: 'glm-4.6', reason: 'Remove -syn suffix' },
  { oldId: 'glm-4.7-syn', newId: 'glm-4.7', reason: 'Remove -syn suffix' },
  { oldId: 'qwen3-coder-480b-syn', newId: 'qwen3-coder-480b', reason: 'Remove -syn suffix' },
  { oldId: 'gpt-oss-120b-syn', newId: 'gpt-oss-120b', reason: 'Remove -syn suffix' },
];

async function migrateModelConsolidation() {
  console.log('🔄 Starting model ID consolidation migration...\n');
  const db = getDb();

  for (const mapping of MODEL_CONSOLIDATIONS) {
    const { oldId, newId, reason } = mapping;
    console.log(`\n📦 Processing: ${oldId} → ${newId}`);
    console.log(`   Reason: ${reason}`);

    try {
      // 1. Check if old model exists
      const oldModel = await db
        .select()
        .from(models)
        .where(eq(models.id, oldId))
        .limit(1);

      if (oldModel.length === 0) {
        console.log(`   ⏭️  Old model ${oldId} not found, skipping`);
        continue;
      }

      // 2. Check if new model already exists
      const newModel = await db
        .select()
        .from(models)
        .where(eq(models.id, newId))
        .limit(1);

      let targetModelId = newId;

      if (newModel.length === 0) {
        // New model doesn't exist → rename old model
        console.log(`   ✏️  Renaming model ${oldId} → ${newId}`);
        await db
          .update(models)
          .set({
            id: newId,
            provider: 'multi', // Indicates multi-provider routing
          })
          .where(eq(models.id, oldId));
      } else {
        // New model exists → merge stats, delete old model
        console.log(`   🔀 Merging stats from ${oldId} into ${newId}`);

        // Aggregate health stats (max of best streaks, sum of totals)
        await db.execute(sql`
          UPDATE ${models}
          SET
            total_retry_attempts = ${models.totalRetryAttempts} + (
              SELECT total_retry_attempts FROM ${models} WHERE id = ${oldId}
            ),
            total_retry_successes = ${models.totalRetrySuccesses} + (
              SELECT total_retry_successes FROM ${models} WHERE id = ${oldId}
            ),
            best_streak = GREATEST(${models.bestStreak}, (
              SELECT best_streak FROM ${models} WHERE id = ${oldId}
            )),
            worst_streak = LEAST(${models.worstStreak}, (
              SELECT worst_streak FROM ${models} WHERE id = ${oldId}
            )),
            best_exact_streak = GREATEST(${models.bestExactStreak}, (
              SELECT best_exact_streak FROM ${models} WHERE id = ${oldId}
            )),
            best_tendency_streak = GREATEST(${models.bestTendencyStreak}, (
              SELECT best_tendency_streak FROM ${models} WHERE id = ${oldId}
            ))
          WHERE id = ${newId}
        `);

        targetModelId = newId;
      }

      // 3. Update all predictions foreign keys (preserves historical data)
      console.log(`   🔗 Updating prediction foreign keys...`);
      const updateResult = await db
        .update(predictions)
        .set({ modelId: targetModelId })
        .where(eq(predictions.modelId, oldId));

      console.log(`   ✅ Updated ${updateResult.rowCount || 0} predictions`);

      // 4. Delete old model if it still exists (after FK migration)
      if (newModel.length > 0) {
        await db
          .delete(models)
          .where(eq(models.id, oldId));
        console.log(`   🗑️  Deleted old model ${oldId}`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${oldId}:`, error);
      throw error; // Fail fast - manual intervention required
    }
  }

  console.log('\n✅ Model consolidation migration complete!\n');
}

// Run with error handling
migrateModelConsolidation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
```

**Rationale:**
- Preserves all historical predictions (no data loss)
- Merges health stats (best/worst streaks are meaningful across providers)
- Atomic operations (fail fast on errors, manual rollback if needed)
- Idempotent (can be run multiple times safely)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Runtime Provider Discovery

**What:** Iterating through ALL_PROVIDERS to find a model ID at prediction time.

**Why bad:**
- O(n) lookup for every prediction
- No explicit routing control
- Unclear which provider will be used

**Instead:** Pre-defined provider priority lists + direct lookup via PROVIDER_MAP.

### Anti-Pattern 2: Embedding Provider Name in Model ID

**What:** Using `deepseek-r1-synthetic`, `deepseek-r1-together`, `deepseek-r1-openrouter` as separate model IDs.

**Why bad:**
- Leaderboard fragmentation (same LLM shows up 3 times)
- No transparent fallback (user sees which provider failed)
- Database bloat (3x predictions rows for identical models)

**Instead:** Single model ID `deepseek-r1`, provider routing is implementation detail.

### Anti-Pattern 3: Deleting Old Predictions During Migration

**What:** CASCADE delete when removing old model IDs.

**Why bad:**
- Permanent data loss
- Historical accuracy stats disappear
- Leaderboard rankings lose legitimacy

**Instead:** UPDATE foreign keys to merged model ID, preserve all prediction rows.

### Anti-Pattern 4: Hardcoded OpenRouter Model Fallbacks

**What:** Manually implementing fallback chain for OpenRouter models.

**Why bad:**
- Duplicates OpenRouter's native fallback mechanism
- Adds latency (sequential API calls vs OpenRouter's parallel routing)
- Ignores OpenRouter's cost optimization logic

**Instead:** Use OpenRouter's `models` array parameter for automatic fallback.

## Scalability Considerations

| Concern | At Current (42 models) | After Integration (49 models) | Long Term (100+ models) |
|---------|------------------------|-------------------------------|-------------------------|
| **Provider Lookup** | O(n) scan of ALL_PROVIDERS | O(1) via PROVIDER_MAP | Add indexing if PROVIDER_MAP > 1000 entries |
| **Fallback Chains** | Max depth 1 (hardcoded) | OpenRouter native (unlimited) | Monitor OpenRouter fallback depth via response headers |
| **Database Foreign Keys** | predictions.modelId indexed | No change (same FK structure) | Consider partitioning predictions table by date |
| **Migration Downtime** | N/A | ~30 seconds (update FKs) | Use online migration with read replicas |

## Integration Points

### New Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **OpenRouterProvider** | `src/lib/llm/providers/openrouter.ts` | Provider class for OpenRouter API |
| **OPENROUTER_PROVIDERS** | `src/lib/llm/providers/openrouter.ts` | Array of OpenRouter model instances |
| **ProviderRouting** | `src/lib/llm/provider-routing.ts` | PROVIDER_ROUTES map + getProviderForModel() |
| **Migration Script** | `scripts/migrate-model-consolidation.ts` | One-time model ID merge + FK update |

### Modified Components

| Component | File Path | Changes |
|-----------|-----------|---------|
| **ALL_PROVIDERS** | `src/lib/llm/index.ts` | Add OPENROUTER_PROVIDERS to array |
| **getActiveProviders()** | `src/lib/llm/index.ts` | Check OPENROUTER_API_KEY availability |
| **Predictions Worker** | `src/lib/queue/workers/predictions.worker.ts` | Use getProviderForModel() instead of direct provider array iteration |
| **Model Sync Script** | `scripts/sync-models.ts` | Sync consolidated model list (remove -syn duplicates) |
| **PROVIDER_MAP** | `src/lib/llm/provider-routing.ts` | Add openrouter entry |

### Data Flow Changes

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

## Build Order (Considering Dependencies)

### Phase 1: Foundation (No Breaking Changes)

1. **Create OpenRouterProvider class** (`src/lib/llm/providers/openrouter.ts`)
   - Extends OpenAICompatibleProvider
   - Implements OpenRouter-specific headers
   - Adds fallbackModels support
   - **Validation:** Unit test with mock API key

2. **Create OPENROUTER_PROVIDERS array** (same file)
   - 7 re-activated models (deprecated on Together)
   - 6 Synthetic models now available via OpenRouter
   - **Validation:** Count matches expected (13 total)

3. **Create Provider Routing module** (`src/lib/llm/provider-routing.ts`)
   - PROVIDER_ROUTES map
   - getProviderPriority()
   - getProviderForModel()
   - **Validation:** Unit tests for priority resolution

### Phase 2: Integration (Additive Changes)

4. **Update ALL_PROVIDERS** (`src/lib/llm/index.ts`)
   - Add `...OPENROUTER_PROVIDERS` to array
   - **Validation:** Ensure no duplicate IDs (should be 42 → 55 temporary, then 49 after consolidation)

5. **Update getActiveProviders()** (`src/lib/llm/index.ts`)
   - Add OPENROUTER_API_KEY check
   - Filter by provider availability
   - **Validation:** Test with/without API key

6. **Add PROVIDER_MAP** (`src/lib/llm/provider-routing.ts`)
   - Map provider names to arrays
   - **Validation:** All providers reachable

### Phase 3: Migration (Breaking Changes - Requires Downtime)

7. **Run Model Consolidation Migration** (`scripts/migrate-model-consolidation.ts`)
   - **Pre-check:** Backup predictions table
   - Update foreign keys (predictions.modelId)
   - Merge health stats (models table)
   - Delete old model IDs
   - **Validation:** Row counts match before/after, no orphaned predictions

8. **Run Model Sync** (`scripts/sync-models.ts`)
   - Sync consolidated model list to database
   - Deactivate orphaned models
   - **Validation:** Active model count = 49

### Phase 4: Worker Integration (Deploy-Ready)

9. **Update Predictions Worker** (`src/lib/queue/workers/predictions.worker.ts`)
   - Replace direct provider iteration with getProviderForModel()
   - **Validation:** Test with mock match, verify routing

10. **Deploy & Monitor**
    - Deploy to production
    - Monitor OpenRouter API calls (success rate, latency)
    - Track fallback usage (usedFallback field in predictions)
    - **Validation:** No increase in error rate, fallbacks working

## Suggested Component Structure

```
src/lib/llm/
├── index.ts (MODIFIED: add OPENROUTER_PROVIDERS, update getActiveProviders)
├── provider-routing.ts (NEW: PROVIDER_ROUTES, getProviderForModel)
├── providers/
│   ├── base.ts (UNCHANGED)
│   ├── together.ts (UNCHANGED)
│   ├── synthetic.ts (UNCHANGED)
│   └── openrouter.ts (NEW: OpenRouterProvider class + instances)
└── ...

scripts/
├── sync-models.ts (MODIFIED: sync consolidated model list)
└── migrate-model-consolidation.ts (NEW: one-time migration)
```

## Testing Strategy

### Unit Tests

- **OpenRouterProvider.callAPI()** — Verify models array parameter sent
- **getProviderForModel()** — Test priority resolution with/without API keys
- **getProviderPriority()** — Verify correct priority order per model

### Integration Tests

- **Migration Script** — Test on staging DB with real predictions data
- **Predictions Worker** — Test with OpenRouter models (e.g., re-activated llama-3.1-70b)
- **Fallback Chain** — Disable Synthetic API key, verify Together fallback works

### Production Validation

- **OpenRouter API Success Rate** — Monitor via OpenRouter dashboard
- **Fallback Usage Rate** — Query predictions.usedFallback percentage
- **Model Count** — Verify 49 active models in database
- **Leaderboard Integrity** — Check deepseek-r1 aggregates predictions from all providers

## OpenRouter-Specific Considerations

### Provider Routing Configuration

OpenRouter supports advanced provider routing via `provider.order` parameter:

```typescript
// Example: Prioritize specific providers for BYOK or compliance
body.provider = {
  order: ['together', 'fireworks'], // Try Together first, Fireworks second
  // Alternative: Ignore specific providers
  ignore: ['deepinfra'], // Don't use DeepInfra
};
```

**Decision:** NOT using provider.order initially.
**Rationale:**
- OpenRouter's default load balancing prioritizes lowest cost + highest availability
- Provider-specific routing adds complexity without clear benefit
- Can be added later if specific providers show reliability issues

### Model Fallback Pricing

OpenRouter charges based on the model that **actually served the request**, not the primary model.

**Example:**
- Request `deepseek/deepseek-r1` (primary) with fallback `deepseek/deepseek-r1-distill-qwen-32b`
- If primary fails, charged at distilled model rate (~50% cheaper)
- Response includes `model` field showing which was used

**Implication:** Track actual model used via response for accurate cost reporting.

### BYOK (Bring Your Own Key) Support

OpenRouter supports using your own provider API keys (e.g., your Together API key via OpenRouter routing).

**Configuration:**
```typescript
// Requires account-level BYOK setup at openrouter.ai
body.provider = {
  sort: {
    by: 'price',
    partition: 'none', // Allows routing to BYOK providers for fallback models
  },
};
```

**Decision:** NOT using BYOK initially.
**Rationale:**
- Adds configuration complexity (manage keys in 2 places)
- Our direct Together integration is already optimized
- BYOK benefit is mainly for models ONLY available via specific providers

## Migration Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Foreign Key Update Timeout** | Low | High | Run migration during low-traffic window, add index on predictions.modelId |
| **Stats Merge Logic Error** | Medium | Medium | Dry-run on staging DB first, validate row counts |
| **Orphaned Predictions** | Low | High | Pre-migration validation: all prediction.modelId values exist in models table |
| **Leaderboard Confusion** | Medium | Low | Clear changelog communicating consolidation (e.g., "deepseek-r1 now includes Synthetic predictions") |

## Rollback Plan

If migration fails or causes issues:

1. **Database Rollback:** Restore predictions table from pre-migration backup
2. **Code Rollback:** Revert to pre-OpenRouter commit
3. **Model Sync Rollback:** Re-run sync-models.ts with old provider arrays
4. **Validation:** Check active model count = 42, predictions.modelId all valid

**RTO (Recovery Time Objective):** < 5 minutes (restore from backup)
**RPO (Recovery Point Objective):** 0 (no predictions generated during migration window)

## Performance Baseline

### Current Metrics (42 models, Together + Synthetic)

- **Average prediction latency:** 2.5s per model (from Phase 58 metrics)
- **Success rate:** 92% (from health tracking)
- **Cost per match:** ~$0.08 (25 matches/day baseline)

### Expected Metrics (49 models, + OpenRouter)

- **Average prediction latency:** 2.8s per model (+12% from OpenRouter routing overhead)
- **Success rate:** 95% (+3% from additional fallback paths)
- **Cost per match:** ~$0.09 (+12.5% from 7 re-activated models)

### Monitoring Alerts

- **OpenRouter API latency > 5s** → Investigate provider routing delays
- **Fallback usage rate > 20%** → Primary providers unhealthy
- **Model consolidation prediction count mismatch** → FK migration incomplete

## Sources

- [OpenRouter Model Fallbacks Documentation](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [OpenRouter Provider Selection Guide](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10)
- [A practical guide to OpenRouter: Unified LLM APIs, model routing, and real-world use](https://medium.com/@milesk_33/a-practical-guide-to-openrouter-unified-llm-apis-model-routing-and-real-world-use-d3c4c07ed170)
- [PostgreSQL MERGE Statement](https://neon.com/postgresql/postgresql-tutorial/postgresql-merge)
- [Database Migration Service - Migration Fidelity](https://docs.cloud.google.com/database-migration/docs/postgres/migration-fidelity)
