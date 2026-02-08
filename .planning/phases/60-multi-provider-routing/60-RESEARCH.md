# Phase 60: Multi-Provider Routing - Research

**Researched:** 2026-02-08
**Domain:** Multi-provider routing, fallback chains, cycle detection, priority list configuration
**Confidence:** HIGH

## Summary

Multi-provider routing implements ordered fallback chains where each model has a configurable provider priority list (e.g., Synthetic → Together → OpenRouter). When a provider fails, the system automatically tries the next provider in the priority order with max depth enforcement (3 providers max) and cycle detection to prevent infinite loops.

The platform already has Phase 41's `callAPIWithFallback` method implementing max depth 1 fallbacks with cycle detection using `Set<string>`. Phase 60 extends this to support 3-tier fallback chains with per-model provider priority lists, replacing the current hardcoded `MODEL_FALLBACKS` map with a unified routing system that works across all provider types.

**Architecture approach:** Replace the current `MODEL_FALLBACKS` Record<string, string> (single fallback per model) with a `MODEL_PROVIDER_ROUTES` Record<string, string[]> (ordered provider priority list per model). Extend the existing `callAPIWithFallback` method to support multi-tier fallbacks by iterating through the priority list, maintaining the existing cycle detection (Set<string>) and adding max depth enforcement (3 providers max).

**Primary recommendation:** Use TypeScript Record type for static configuration (known at compile time, no runtime mutation needed) with ordered arrays for provider priority. Extend existing fallback infrastructure rather than rewriting. Validate configuration at startup to catch cycles and ensure all referenced providers exist.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript Record | Native | Per-model provider priority configuration | Lightweight, type-safe, perfect for static configuration |
| TypeScript Array | Native | Ordered provider priority lists | Maintains insertion order, simple iteration |
| Set<string> | Native | Cycle detection (attempted providers) | O(1) lookups, prevents infinite loops |
| Existing ErrorType enum | Current (retry-config.ts) | Error classification for fallback triggering | Already handles 429, 5xx, timeouts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | Current | Provider attribution tracking | Phase 61 adds provider_used field |
| Pino logger | Current | Fallback event logging | Already logs fallback attempts |
| fetchWithRetry | Current (api-client.ts) | Automatic retries within provider | Handles transient failures before fallback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Record<string, string[]> | Map<string, string[]> | Map maintains insertion order but adds runtime overhead; Record is lighter for static config |
| Array iteration | DFS cycle detection | DFS is overkill for max depth 3; simple Set tracking sufficient |
| Replace callAPIWithFallback | New routing system | Extend existing infrastructure; reuse error classification and logging |
| Build-time validation | Runtime-only validation | Validate at module load time to fail fast on misconfiguration |

**Installation:**
No new dependencies required — extend existing `src/lib/llm/index.ts` and `src/lib/llm/providers/base.ts`.

## Architecture Patterns

### Current Architecture (Phase 41/59)
```
Provider Structure:
├── OpenAICompatibleProvider (base class)
│   ├── callAPI(system, user): Promise<string>
│   │   ├── fetchWithRetry (automatic retries)
│   │   ├── Error classification (ErrorType)
│   │   └── Response parsing + handlers
│   └── callAPIWithFallback(system, user): Promise<FallbackAPIResult>
│       ├── Try: callAPI on original model
│       ├── Catch: any error triggers fallback
│       ├── Check: getFallbackProvider(this.id)
│       └── Retry: fallbackProvider.callAPI (max depth 1)
├── TogetherProvider (29 models, 'together' name)
├── SyntheticProvider (13 models, 'synthetic' name)
└── OpenRouterProvider (3 models, 'openrouter' name)

Fallback Configuration (Phase 41):
MODEL_FALLBACKS: Record<string, string> = {
  'deepseek-r1-0528-syn': 'deepseek-r1',      // Synthetic → Together
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',
  'kimi-k2.5-syn': 'kimi-k2-instruct',
}
// Maps 3/13 Synthetic models to Together AI equivalents
// Max depth: 1 (single fallback)
```

### Recommended Architecture (Phase 60)
```
Extended Provider Priority Lists:
MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  // Example: Unified model with 3 providers in priority order
  'deepseek-r1': ['deepseek-r1-syn', 'deepseek-r1', 'deepseek-r1-or'],
  //              ^Synthetic (1st)    ^Together (2nd) ^OpenRouter (3rd)

  // Example: 2-tier fallback (OpenRouter → Together)
  'llama-4-scout': ['llama-4-scout-or', 'llama-4-scout'],
  //                ^OpenRouter (1st)    ^Together (2nd)

  // Example: Single provider (no fallback)
  'minimax-m2': ['minimax-m2-syn'],
  //             ^Synthetic only (exclusive model)
}

Extended callAPIWithFallback:
1. Input: consolidated model ID (e.g., 'deepseek-r1')
2. Lookup: MODEL_PROVIDER_ROUTES['deepseek-r1'] → ['deepseek-r1-syn', 'deepseek-r1', 'deepseek-r1-or']
3. Iterate: Try providers in priority order
   ├── Try: provider[0] (Synthetic)
   │   └── Catch: Log failure, continue to next
   ├── Try: provider[1] (Together)
   │   └── Catch: Log failure, continue to next
   └── Try: provider[2] (OpenRouter)
       └── Catch: All providers failed, throw error
4. Track: Set<string> prevents cycles, depth counter enforces max 3
5. Return: { response, usedFallback, providerUsed }
```

### Pattern 1: Per-Model Provider Priority Configuration
**What:** Static Record mapping consolidated model IDs to ordered provider arrays
**When to use:** For all models after Phase 62 consolidation (base model IDs without -syn/-or suffixes)
**Example:**
```typescript
// Source: LiteLLM priority configuration + codebase patterns
export const MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  // ============================================================================
  // REASONING MODELS (3-tier fallback chains)
  // ============================================================================

  // DeepSeek R1: Synthetic → Together → OpenRouter
  // Consolidated model ID 'deepseek-r1' tries 3 providers in order
  'deepseek-r1': [
    'deepseek-r1-0528-syn',  // Priority 1: Synthetic (specific version)
    'deepseek-r1',            // Priority 2: Together AI (base version)
    'deepseek-r1-or',         // Priority 3: OpenRouter (fallback)
  ],

  // Qwen3 235B: Together → OpenRouter (2-tier)
  'qwen3-235b': [
    'qwen3-235b-instruct',    // Priority 1: Together AI (direct)
    'qwen3-235b-or',          // Priority 2: OpenRouter (fallback)
  ],

  // ============================================================================
  // EXCLUSIVE MODELS (no fallback)
  // ============================================================================

  // MiniMax M2: Synthetic only (no equivalent on other providers)
  'minimax-m2': ['minimax-m2-syn'],

  // DeepSeek V3.2: Synthetic only
  'deepseek-v3.2': ['deepseek-v3.2-syn'],

  // ============================================================================
  // RE-ACTIVATED MODELS (Phase 64 - OpenRouter primary)
  // ============================================================================

  // Llama 4 Scout: OpenRouter → Together (2-tier)
  'llama-4-scout': [
    'llama-4-scout-or',       // Priority 1: OpenRouter (re-activated)
    'llama-4-scout',          // Priority 2: Together AI (fallback)
  ],
};

// Validation function (called at module load)
function validateProviderRoutes(): void {
  const providerIds = new Set(ALL_PROVIDERS.map(p => p.id));

  for (const [modelId, providers] of Object.entries(MODEL_PROVIDER_ROUTES)) {
    // Check: All provider IDs exist
    for (const providerId of providers) {
      if (!providerIds.has(providerId)) {
        throw new Error(
          `Invalid route for model "${modelId}": provider "${providerId}" not found in ALL_PROVIDERS`
        );
      }
    }

    // Check: No cycles (provider can't appear twice in same route)
    const unique = new Set(providers);
    if (unique.size !== providers.length) {
      throw new Error(
        `Cycle detected in route for model "${modelId}": duplicate provider in priority list`
      );
    }

    // Check: Max depth enforcement (3 providers max)
    if (providers.length > 3) {
      throw new Error(
        `Route for model "${modelId}" exceeds max depth: ${providers.length} providers (max 3)`
      );
    }

    // Check: At least one provider (empty routes invalid)
    if (providers.length === 0) {
      throw new Error(
        `Invalid route for model "${modelId}": empty provider list`
      );
    }
  }

  loggers.llm.info({
    modelCount: Object.keys(MODEL_PROVIDER_ROUTES).length,
    totalRoutes: Object.values(MODEL_PROVIDER_ROUTES).flat().length,
  }, 'Provider routes validated successfully');
}
```

### Pattern 2: Extended callAPIWithFallback with Multi-Tier Support
**What:** Extend existing `callAPIWithFallback` to iterate through provider priority list
**When to use:** Replace current max-depth-1 implementation in `src/lib/llm/providers/base.ts`
**Example:**
```typescript
// Source: Existing callAPIWithFallback + LiteLLM priority iteration pattern
export interface FallbackAPIResult {
  response: string;
  usedFallback: boolean;
  providerUsed?: string;  // NEW: Track which provider succeeded
  attemptedProviders?: string[];  // NEW: Track all attempts
}

async callAPIWithFallback(
  systemPrompt: string,
  userPrompt: string,
  consolidatedModelId?: string  // NEW: For multi-provider routing
): Promise<FallbackAPIResult> {
  // If consolidatedModelId provided, use multi-provider routing
  if (consolidatedModelId) {
    return this.callAPIWithMultiProviderRouting(
      systemPrompt,
      userPrompt,
      consolidatedModelId
    );
  }

  // Otherwise, use existing Phase 41 single-fallback logic (backward compatible)
  try {
    const response = await this.callAPI(systemPrompt, userPrompt);
    return { response, usedFallback: false };
  } catch (originalError) {
    const { getFallbackProvider } = await import('../index');
    const fallbackProvider = getFallbackProvider(this.id);

    if (!fallbackProvider) {
      throw originalError;
    }

    logger.warn({
      originalModel: this.id,
      fallbackModel: fallbackProvider.id,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    }, 'Model failed, attempting fallback');

    try {
      const fallbackResult = await (fallbackProvider as OpenAICompatibleProvider).callAPI(
        systemPrompt,
        userPrompt
      );

      return {
        response: fallbackResult,
        usedFallback: true,
        providerUsed: fallbackProvider.id,
      };
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}

private async callAPIWithMultiProviderRouting(
  systemPrompt: string,
  userPrompt: string,
  consolidatedModelId: string
): Promise<FallbackAPIResult> {
  // Dynamic import to avoid circular dependency
  const { MODEL_PROVIDER_ROUTES, getProviderById } = await import('../index');

  // Get provider priority list for this model
  const providerPriorityList = MODEL_PROVIDER_ROUTES[consolidatedModelId];
  if (!providerPriorityList || providerPriorityList.length === 0) {
    throw new Error(
      `No provider route configured for model "${consolidatedModelId}"`
    );
  }

  const attemptedProviders: string[] = [];
  let lastError: Error | null = null;

  // Try providers in priority order
  for (let i = 0; i < providerPriorityList.length; i++) {
    const providerId = providerPriorityList[i];
    const provider = getProviderById(providerId);

    if (!provider) {
      logger.warn({
        consolidatedModelId,
        providerId,
        priorityIndex: i,
      }, 'Provider in route not found, skipping');
      continue;
    }

    // Cycle detection: prevent same provider from being tried twice
    if (attemptedProviders.includes(providerId)) {
      throw new Error(
        `Cycle detected: provider "${providerId}" already attempted in this chain`
      );
    }

    attemptedProviders.push(providerId);

    // Max depth enforcement (3 providers max)
    if (attemptedProviders.length > 3) {
      throw new Error(
        `Max fallback depth exceeded: attempted ${attemptedProviders.length} providers (max 3)`
      );
    }

    try {
      // Try this provider (cast needed for callAPI access)
      const response = await (provider as OpenAICompatibleProvider).callAPI(
        systemPrompt,
        userPrompt
      );

      const usedFallback = i > 0;  // True if not the first provider

      if (usedFallback) {
        logger.info({
          consolidatedModelId,
          providerUsed: providerId,
          attemptedProviders,
          priorityIndex: i,
        }, 'Fallback succeeded');
      }

      return {
        response,
        usedFallback,
        providerUsed: providerId,
        attemptedProviders,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn({
        consolidatedModelId,
        providerId,
        priorityIndex: i,
        error: lastError.message,
        remainingProviders: providerPriorityList.length - i - 1,
      }, 'Provider failed, trying next in priority list');

      // Continue to next provider
    }
  }

  // All providers failed
  logger.error({
    consolidatedModelId,
    attemptedProviders,
    providerCount: attemptedProviders.length,
  }, 'All providers in routing chain failed');

  throw lastError || new Error('All providers failed with unknown error');
}
```

### Anti-Patterns to Avoid

- **Cross-provider cycles:** Provider A → Provider B → Provider A creates infinite loop. Build-time validation prevents this.
- **Runtime route mutation:** Modifying `MODEL_PROVIDER_ROUTES` at runtime breaks type safety and reproducibility. Routes are static configuration.
- **Ignoring cycle detection:** Set<string> tracking is mandatory to prevent infinite loops in misconfigured routes.
- **Exceeding max depth:** Allowing >3 providers increases latency and cost exponentially. Enforce limit at validation and runtime.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | DFS graph traversal | Set<string> membership check | O(1) lookups sufficient for max depth 3, DFS is overkill |
| Provider priority | Dynamic load balancing | Static ordered arrays | Sequential failover meets requirements, load balancing adds complexity |
| Error classification | New error type system | Existing ErrorType enum (retry-config.ts) | Already handles 429, 5xx, timeouts; reuse existing infrastructure |
| Fallback orchestration | Worker-level retry logic | Provider-level callAPIWithFallback | Centralizes logic, reuses existing error handling |

**Key insight:** The existing Phase 41 fallback infrastructure (error classification, logging, tracking) is sufficient. Phase 60 only needs to extend the provider priority list from depth 1 to depth 3 and replace the hardcoded `MODEL_FALLBACKS` map with configurable `MODEL_PROVIDER_ROUTES`.

## Common Pitfalls

### Pitfall 1: Circular Dependencies in Dynamic Imports
**What goes wrong:** `base.ts` imports from `index.ts` which re-exports from `base.ts`, causing circular dependency
**Why it happens:** Phase 13 encountered this when `callAPIWithFallback` needed `getFallbackProvider` from index
**How to avoid:** Use dynamic imports (`await import('../index')`) inside async methods to break the cycle at runtime
**Warning signs:** Build error "ReferenceError: Cannot access 'd' before initialization" or turbopack/webpack circular dependency warnings

### Pitfall 2: Runtime Route Mutations Breaking Reproducibility
**What goes wrong:** Changing `MODEL_PROVIDER_ROUTES` at runtime causes different results for same inputs
**Why it happens:** Developer tries to "fix" routes dynamically based on provider health
**How to avoid:** Treat `MODEL_PROVIDER_ROUTES` as immutable. Provider health affects whether providers are active (`getActiveProviders()`), not routing configuration
**Warning signs:** Non-deterministic prediction results, different fallback chains for same model

### Pitfall 3: Missing Provider Validation at Startup
**What goes wrong:** Route references non-existent provider ID, fails at runtime during predictions
**Why it happens:** Provider removed from codebase but not removed from routes
**How to avoid:** Call `validateProviderRoutes()` at module load time (top-level code in `index.ts`)
**Warning signs:** Production errors like "Provider 'deepseek-r1-old' not found" during prediction generation

### Pitfall 4: Exceeding Max Depth Without Enforcement
**What goes wrong:** Route configured with 5+ providers, causing excessive latency and cost
**Why it happens:** No validation enforces the 3-provider max depth requirement
**How to avoid:** Validate `providers.length <= 3` in `validateProviderRoutes()` and enforce in `callAPIWithMultiProviderRouting()`
**Warning signs:** Predictions taking >60 seconds, unexpected high costs from multiple fallback attempts

### Pitfall 5: Confusing Consolidated Model ID vs Provider ID
**What goes wrong:** Worker calls `callAPIWithFallback` with provider ID instead of consolidated model ID
**Why it happens:** Phase 62 consolidates models (removes -syn/-or suffixes), but calling code not updated
**How to avoid:** Use type-safe lookup: `MODEL_PROVIDER_ROUTES[consolidatedModelId]` returns `string[] | undefined`, throws if undefined
**Warning signs:** "No provider route configured for model 'deepseek-r1-syn'" errors after Phase 62 consolidation

## Code Examples

Verified patterns from existing codebase:

### Error Classification for Fallback Triggering
```typescript
// Source: src/lib/utils/retry-config.ts (existing, unchanged)
export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',           // 429, triggers fallback
  SERVER_ERROR = 'SERVER_ERROR',       // 5xx, triggers fallback
  TIMEOUT = 'TIMEOUT',                 // Request timeout, triggers fallback
  NETWORK_ERROR = 'NETWORK_ERROR',     // Connection issues, triggers fallback
  MODEL_SPECIFIC = 'MODEL_SPECIFIC',   // Model failures, triggers fallback
  UNKNOWN = 'UNKNOWN',                 // Unknown errors, triggers fallback
}

// All errors trigger fallback (ROUT-02 requirement)
```

### Cycle Detection with Set Tracking
```typescript
// Source: Existing callAPIWithFallback pattern (Phase 41)
const attemptedProviders = new Set<string>();

for (const providerId of providerPriorityList) {
  // Cycle detection: O(1) membership check
  if (attemptedProviders.has(providerId)) {
    throw new Error(`Cycle detected: ${providerId} already attempted`);
  }

  attemptedProviders.add(providerId);

  // Max depth check
  if (attemptedProviders.size > 3) {
    throw new Error('Max fallback depth exceeded');
  }

  // Try provider...
}
```

### Provider Retrieval from Registry
```typescript
// Source: src/lib/llm/index.ts (existing function)
export function getProviderById(id: string): LLMProvider | undefined {
  return ALL_PROVIDERS.find(p => p.id === id);
}

// Usage in routing:
const provider = getProviderById(providerId);
if (!provider) {
  logger.warn({ providerId }, 'Provider not found, skipping');
  continue;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single hardcoded fallback | Multi-provider priority lists | Phase 60 (Feb 2026) | Supports 3-tier fallback chains, enables OpenRouter as tertiary fallback |
| Max depth 1 | Max depth 3 | Phase 60 (Feb 2026) | Increases reliability but adds latency/cost for deep failures |
| Synthetic-specific fallbacks | Universal model routing | Phase 60 + Phase 62 | Works across all providers after model consolidation |
| Provider IDs with -syn/-or suffixes | Consolidated base model IDs | Phase 62 (Feb 2026) | Routes keyed by 'deepseek-r1' not 'deepseek-r1-syn' |

**Deprecated/outdated:**
- `MODEL_FALLBACKS: Record<string, string>`: Replaced by `MODEL_PROVIDER_ROUTES: Record<string, string[]>` in Phase 60
- Single-tier fallback logic: Extended to multi-tier iteration in Phase 60
- Synthetic-only fallback mappings: Generalized to work with all provider types (Together, Synthetic, OpenRouter)

## Open Questions

1. **Should OpenRouter be included as tertiary fallback for all models or opt-in per model?**
   - What we know: OpenRouter has higher per-token costs (markup over direct provider)
   - What's unclear: Cost budget threshold for enabling OpenRouter fallbacks
   - Recommendation: Phase 65 implements cost circuit breaker; start with opt-in OpenRouter for critical models only

2. **How to handle provider priority when same model exists on multiple providers with different pricing?**
   - What we know: LiteLLM recommends prioritizing by cost (lowest first)
   - What's unclear: Should we prioritize by reliability (success rate) or cost?
   - Recommendation: Phase 60 uses cost-based priority (cheapest first), Phase 66 can adjust based on provider health metrics

3. **Should provider priority lists be configurable via environment variables or database?**
   - What we know: Current `MODEL_FALLBACKS` is hardcoded in `index.ts`
   - What's unclear: Runtime configurability requirement not specified
   - Recommendation: Start with static configuration (code-based), defer runtime configurability to future phase if needed

## Sources

### Primary (HIGH confidence)
- [LiteLLM Router Priority Configuration](https://docs.litellm.ai/docs/routing) - Lower values = higher priority, order parameter
- [OpenRouter Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks) - Automatic failover with models array in priority order
- [Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) - Fallback chain components: Router, Gateway, Fallback Logic, Load Balancer
- Existing codebase: `src/lib/llm/index.ts` (MODEL_FALLBACKS, validateFallbackMapping)
- Existing codebase: `src/lib/llm/providers/base.ts` (callAPIWithFallback implementation)
- Existing codebase: `src/lib/utils/retry-config.ts` (ErrorType enum, error classification)

### Secondary (MEDIUM confidence)
- [Failover routing strategies for LLMs in production](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/) - Timeout and error code triggers, SLO matching
- [Provider Routing | OpenRouter Documentation](https://openrouter.ai/docs/guides/routing/provider-selection) - Order field for provider prioritization
- [TypeScript: Record vs Map](https://dev.to/safal_bhandari/typescript-choosing-between-record-and-map-for-key-value-data-514a) - Record for static config, Map for dynamic collections
- Phase 41 Research (`.planning/phases/41-together-ai-fallbacks/41-RESEARCH.md`) - Existing fallback architecture patterns
- Phase 57 Audit (in `src/lib/llm/index.ts` comments) - Synthetic model fallback mappings and exclusivity status

### Tertiary (LOW confidence - flagged for validation)
- [Bifrost Gateway Failover Pattern](https://dev.to/kuldeep_paul/how-to-build-multi-provider-failover-strategies-with-bifrost-for-ultra-reliable-ai-applications-1keo) - Declarative failover configuration (not directly applicable but shows industry pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing TypeScript native types, no new dependencies
- Architecture: HIGH - Extends proven Phase 41 patterns, well-understood fallback orchestration
- Pitfalls: HIGH - Based on actual Phase 13 circular dependency fix and Phase 41 implementation experience

**Research date:** 2026-02-08
**Valid until:** 30 days (stable domain - provider routing patterns are well-established)
