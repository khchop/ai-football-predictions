# Phase 41: Together AI Fallbacks - Research

**Researched:** 2026-02-05
**Domain:** LLM API fallback orchestration, error handling, cost tracking
**Confidence:** HIGH

## Summary

Fallback orchestration wraps primary API calls in try-catch blocks that automatically trigger secondary providers on failure. The platform already has robust error classification (ErrorType enum), retry strategies, and model health tracking infrastructure in Phase 40. This phase adds a thin orchestration layer that uses existing error handling to trigger Together AI fallbacks for Synthetic model failures.

**Architecture approach:** Wrap the existing `callAPI` method in providers with fallback logic that catches failures, checks for configured fallback models, and retries with Together AI equivalent. User-facing predictions show the original model name, but internal tracking flags when fallbacks occurred. Admin dashboard displays fallback rates per model and estimated cost warnings when fallback costs exceed 2x original costs.

**Primary recommendation:** Implement fallback orchestration at the provider level (not worker level) to minimize code changes and reuse existing error classification. Use explicit mapping (already exists in `MODEL_FALLBACKS`), track with boolean flag on predictions table, and aggregate metrics for admin dashboard.

## Standard Stack

The established patterns for fallback orchestration in LLM applications:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript try-catch | Native | Error handling and fallback triggering | Industry standard for synchronous fallback chains |
| Drizzle ORM | Current | Database schema and queries | Already used for model health tracking |
| Existing ErrorType enum | Current | Error classification | Already implemented in retry-config.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Set<string> | Native | Cycle detection (attempted models) | Runtime cycle prevention |
| Pino logger | Current | Fallback event logging | Already used for model failures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Provider-level wrapper | Worker-level orchestrator | Provider-level reuses existing callAPI error handling, worker-level requires duplicating error classification |
| Boolean tracking | Full cost tracking | User decision: minimal tracking (boolean only), cost estimates calculated on-demand |
| DFS cycle detection | Build-time validation | DFS is overkill for max depth 1, simple Set tracking sufficient |

**Installation:**
No new dependencies required — all infrastructure exists in current codebase.

## Architecture Patterns

### Current Provider Architecture
```
OpenAICompatibleProvider (base class)
├── callAPI(systemPrompt, userPrompt): Promise<string>
│   ├── fetchWithRetry (handles retries)
│   ├── Error classification (ErrorType enum)
│   └── Response extraction + handler
├── TogetherProvider (29 models)
└── SyntheticProvider (13 models)
```

### Recommended Fallback Architecture
```
Fallback orchestration wraps callAPI:
1. Try: Call original model via callAPI
2. Catch: Classify error (existing ErrorType)
3. Check: Does model have fallbackModelId?
4. Attempt: Call fallback model via callAPI
5. Track: Set usedFallback=true on prediction
6. Return: Response (attributed to original model)
```

### Pattern 1: Provider-Level Fallback Wrapper
**What:** Add `callAPIWithFallback` method to base provider class that wraps existing `callAPI`
**When to use:** For all Synthetic models with configured fallbacks (2 currently: deepseek-r1-0528-syn, kimi-k2-thinking-syn)
**Example:**
```typescript
// Source: Existing codebase patterns + industry fallback patterns
abstract class BaseLLMProvider {
  // Existing method (unchanged)
  protected abstract callAPI(systemPrompt: string, userPrompt: string): Promise<string>;

  // New fallback wrapper
  protected async callAPIWithFallback(
    systemPrompt: string,
    userPrompt: string,
    attemptedModels: Set<string> = new Set()
  ): Promise<{ response: string; usedFallback: boolean }> {
    // Cycle detection: prevent infinite loops
    if (attemptedModels.has(this.id)) {
      throw new Error(`Cycle detected: ${this.id} already attempted`);
    }

    // Max depth check (user decision: max depth 1)
    if (attemptedModels.size >= 2) {
      throw new Error('Max fallback depth exceeded');
    }

    attemptedModels.add(this.id);

    try {
      // Try original model (existing callAPI handles retries)
      const response = await this.callAPI(systemPrompt, userPrompt);
      return { response, usedFallback: false };
    } catch (error) {
      // Any error triggers fallback (user decision)
      const fallbackProvider = getFallbackProvider(this.id);

      if (!fallbackProvider) {
        // No fallback available, propagate error
        throw error;
      }

      logger.warn({
        originalModel: this.id,
        fallbackModel: fallbackProvider.id,
        error: error instanceof Error ? error.message : String(error),
      }, 'Model failed, attempting fallback');

      // Try fallback (recursive for depth tracking)
      const fallbackResult = await (fallbackProvider as any)
        .callAPIWithFallback(systemPrompt, userPrompt, attemptedModels);

      return { response: fallbackResult.response, usedFallback: true };
    }
  }
}
```

### Pattern 2: Minimal Database Tracking
**What:** Add single boolean column to predictions table
**When to use:** User decision: minimal tracking, admin-only visibility
**Example:**
```typescript
// Schema addition (predictions table)
export const predictions = pgTable('predictions', {
  // ... existing columns
  usedFallback: boolean('used_fallback').default(false), // NEW
});

// Prediction creation in worker
const prediction: NewPrediction = {
  id: uuidv4(),
  matchId,
  modelId: provider.id, // Original model (user-facing)
  predictedHome: scores.homeScore,
  predictedAway: scores.awayScore,
  predictedResult: result,
  usedFallback: apiResult.usedFallback, // Track internally
  status: 'pending',
};
```

### Pattern 3: Admin Dashboard Aggregation
**What:** Calculate fallback statistics on-demand in admin API
**When to use:** Admin dashboard only (not per-prediction, not public)
**Example:**
```typescript
// Admin API endpoint aggregation
const fallbackStats = await db
  .select({
    modelId: predictions.modelId,
    totalPredictions: sql<number>`count(*)::int`,
    fallbackCount: sql<number>`count(*) filter (where ${predictions.usedFallback} = true)::int`,
    fallbackRate: sql<number>`(count(*) filter (where ${predictions.usedFallback} = true)::float / count(*)::float)`,
  })
  .from(predictions)
  .groupBy(predictions.modelId)
  .where(
    and(
      gte(predictions.createdAt, startOfToday),
      eq(predictions.status, 'scored')
    )
  );
```

### Anti-Patterns to Avoid
- **Fallback chains >1 depth:** User decision specifies max depth 1 to prevent cascading failures and cost explosions
- **Auto-discovery fallbacks:** User decision requires explicit fallbackModelId configuration to prevent unexpected behavior
- **Retrying on original model:** User decision: first failure immediately triggers fallback, no retries on primary

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error classification | Custom error parser | Existing `classifyErrorType()` in retry-config.ts | Already handles 7 error types with proven patterns |
| Retry logic | Custom backoff | Existing `fetchWithRetry` in api-client.ts | Already handles exponential backoff, jitter, circuit breaker |
| Model health tracking | New tracking system | Existing `recordModelFailure/Success()` | Already tracks consecutive failures, auto-disable threshold |
| Cost calculation | Real-time billing API | Token count × pricing.promptPer1M | User decision: estimated costs only, no billing integration |

**Key insight:** Platform already has comprehensive error handling and model health infrastructure from Phase 40. Fallbacks should wrap existing patterns, not replace them.

## Common Pitfalls

### Pitfall 1: Cascading Failures
**What goes wrong:** Fallback model fails, triggers another fallback, causing cost explosion and worker exhaustion
**Why it happens:** No depth limit or cycle detection
**How to avoid:**
- User decision: Max depth 1 (if fallback fails, fail the prediction)
- Cycle detection with Set<string> tracking attempted models
- Build-time validation: Check `MODEL_FALLBACKS` for cycles at startup
**Warning signs:** Logs show same model ID appearing multiple times in fallback chain

### Pitfall 2: Cost Tracking Drift
**What goes wrong:** Estimated costs don't match actual billing, causing budget overruns
**Why it happens:** Token counts estimated (not actual), pricing changes not updated, cache hits not accounted for
**How to avoid:**
- User decision: Estimated costs only, admin-aware that these are approximations
- Conservative estimates: Use ~500 input tokens (prompt overhead), published pricing rates
- Warning threshold: Alert when fallback cost >2x original (catches major discrepancies)
**Warning signs:** Admin dashboard shows fallback costs consistently exceeding 2x threshold

### Pitfall 3: Attribution Confusion
**What goes wrong:** Leaderboard shows wrong model accuracy, users think fallback model is the original
**Why it happens:** Unclear whether prediction.modelId should be original or fallback model
**How to avoid:**
- User decision: Show original model name everywhere (predictions, leaderboard, public)
- Internal tracking: usedFallback boolean flag for admin visibility only
- Accuracy attribution: Original model gets credit/penalty (fallback is internal resilience)
**Warning signs:** Model accuracy suddenly improves after fallbacks implemented

### Pitfall 4: Fallback Configuration Staleness
**What goes wrong:** MODEL_FALLBACKS references non-existent model IDs, causing runtime failures
**Why it happens:** Models added/removed but fallback mapping not updated
**How to avoid:**
- Build-time validation: Check all fallbackModelId values exist in ALL_PROVIDERS
- Startup validation: Log warning if fallback model not found
- Fail gracefully: If fallback provider undefined, log error and fail prediction (don't crash worker)
**Warning signs:** Errors like "Fallback model xyz not found" in logs

### Pitfall 5: Rate Limit Amplification
**What goes wrong:** Original model hits rate limit (429), fallback immediately hits same limit, wasting quota
**Why it happens:** Both providers share infrastructure or account limits
**How to avoid:**
- User decision: Treat rate limits same as other errors (no special wait-and-retry)
- Provider diversity: Together AI uses separate infrastructure from Synthetic
- Error classification: Existing ErrorType.RATE_LIMIT already tracked, logs show patterns
**Warning signs:** Both original and fallback log 429 errors in same time window

## Code Examples

Verified patterns from official sources:

### Fallback Provider Lookup
```typescript
// Source: Existing codebase src/lib/llm/index.ts
export function getFallbackProvider(syntheticModelId: string): LLMProvider | undefined {
  const fallbackId = MODEL_FALLBACKS[syntheticModelId];
  if (!fallbackId) {
    return undefined;
  }

  // Check if Together API key is configured
  if (!process.env.TOGETHER_API_KEY) {
    return undefined;
  }

  return ALL_PROVIDERS.find(p => p.id === fallbackId);
}
```

### Cost Estimation Pattern
```typescript
// Source: Existing codebase src/lib/llm/providers/together.ts
// Already implemented on both TogetherProvider and SyntheticProvider
class TogetherProvider extends OpenAICompatibleProvider {
  estimateCost(inputTokens: number = 500, outputTokens: number = 50): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.promptPer1M;
    const outputCost = (outputTokens / 1_000_000) * this.pricing.completionPer1M;
    return inputCost + outputCost;
  }
}

// Admin cost comparison
function checkFallbackCost(
  originalProvider: TogetherProvider | SyntheticProvider,
  fallbackProvider: TogetherProvider | SyntheticProvider,
  inputTokens: number,
  outputTokens: number
): { exceeded2x: boolean; ratio: number } {
  const originalCost = originalProvider.estimateCost(inputTokens, outputTokens);
  const fallbackCost = fallbackProvider.estimateCost(inputTokens, outputTokens);
  const ratio = fallbackCost / originalCost;

  return {
    exceeded2x: ratio > 2.0,
    ratio,
  };
}
```

### Cycle Detection Pattern
```typescript
// Source: Industry standard pattern for directed graph cycle detection
function validateFallbackMapping(fallbacks: Record<string, string>): void {
  for (const startModel of Object.keys(fallbacks)) {
    const visited = new Set<string>();
    let current = startModel;

    while (current) {
      if (visited.has(current)) {
        throw new Error(`Cycle detected in fallback chain starting at ${startModel}`);
      }
      visited.add(current);
      current = fallbacks[current];
    }
  }
}

// Build-time validation (run once at startup)
validateFallbackMapping(MODEL_FALLBACKS);
```

### Admin Dashboard Query
```typescript
// Source: Existing admin patterns + Drizzle ORM documentation
interface FallbackMetrics {
  modelId: string;
  displayName: string;
  totalPredictions: number;
  fallbackCount: number;
  fallbackRate: number;
  estimatedOriginalCost: number;
  estimatedFallbackCost: number;
  costMultiplier: number;
  exceeds2x: boolean;
}

async function getFallbackMetrics(dateRange: { start: Date; end: Date }): Promise<FallbackMetrics[]> {
  // Get aggregated fallback statistics
  const stats = await db
    .select({
      modelId: predictions.modelId,
      totalPredictions: sql<number>`count(*)::int`,
      fallbackCount: sql<number>`count(*) filter (where ${predictions.usedFallback} = true)::int`,
    })
    .from(predictions)
    .where(
      and(
        gte(predictions.createdAt, dateRange.start.toISOString()),
        lte(predictions.createdAt, dateRange.end.toISOString())
      )
    )
    .groupBy(predictions.modelId);

  // Calculate costs for each model
  return stats.map(stat => {
    const provider = getProviderById(stat.modelId);
    const fallbackProvider = getFallbackProvider(stat.modelId);

    if (!provider || !fallbackProvider) {
      return null;
    }

    const originalCost = provider.estimateCost() * stat.fallbackCount;
    const fallbackCost = fallbackProvider.estimateCost() * stat.fallbackCount;
    const costMultiplier = originalCost > 0 ? fallbackCost / originalCost : 0;

    return {
      modelId: stat.modelId,
      displayName: provider.displayName,
      totalPredictions: stat.totalPredictions,
      fallbackCount: stat.fallbackCount,
      fallbackRate: stat.fallbackCount / stat.totalPredictions,
      estimatedOriginalCost: originalCost,
      estimatedFallbackCost: fallbackCost,
      costMultiplier,
      exceeds2x: costMultiplier > 2.0,
    };
  }).filter(Boolean) as FallbackMetrics[];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fail fast | Fallback chains | 2024-2025 | LLM orchestration platforms (Portkey, LiteLLM) now standard |
| Global retry logic | Provider-specific retries | 2025 | Platform already has service-specific retry configs |
| Runtime cycle detection only | Build-time + runtime validation | 2026 | Catch configuration errors before production |
| Full cost tracking | Estimated costs | 2026 | User decision prioritizes simplicity over precision |

**Deprecated/outdated:**
- **Auto-discovery fallbacks:** Industry moved to explicit configuration (prevents unexpected behavior)
- **Unlimited fallback depth:** Best practice now limits to 1-2 hops (prevents cost explosions)
- **Retry original model first:** Modern pattern treats fallback as immediate alternative (user decision)

## Open Questions

Things that couldn't be fully resolved:

1. **Fallback model selection strategy**
   - What we know: User decided on 1:1 same-model mapping (Kimi K2.5-syn → Together Kimi K2.5)
   - What's unclear: How to handle when Together model is also failing (no cascade, just fail)
   - Recommendation: Implement as specified (fail prediction if fallback also fails)

2. **Cost warning delivery mechanism**
   - What we know: User decided on "visual badge on admin dashboard"
   - What's unclear: Exact UI component (alert banner, table badge, notification dot)
   - Recommendation: Claude's discretion — suggest Alert component with amber color when any model exceeds 2x

3. **Logging verbosity**
   - What we know: Need to track fallback events for admin visibility
   - What's unclear: Log level (info vs warn), how much detail
   - Recommendation: Claude's discretion — warn level for fallback trigger, include originalModel, fallbackModel, errorType

## Sources

### Primary (HIGH confidence)
- Existing codebase: src/lib/llm/index.ts (MODEL_FALLBACKS already defined)
- Existing codebase: src/lib/utils/retry-config.ts (ErrorType enum, error classification)
- Existing codebase: src/lib/llm/providers/base.ts (callAPI structure, response handling)
- Existing codebase: src/lib/db/schema.ts (predictions table, models table)
- Existing codebase: src/components/admin/admin-dashboard.tsx (admin UI patterns)
- Phase 41 CONTEXT.md: User decisions on fallback behavior, cost tracking, transparency

### Secondary (MEDIUM confidence)
- [Portkey.ai: Retries, fallbacks, and circuit breakers in LLM apps](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) - Fallback patterns and circuit breaker integration
- [Statsig: Provider fallbacks for LLM availability](https://www.statsig.com/perspectives/providerfallbacksllmavailability) - Multi-provider orchestration architecture
- [DEV Community: Multi-provider LLM orchestration 2026](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) - Production fallback patterns
- [AlgoCademy: Cycle detection algorithms](https://algocademy.com/blog/algorithms-for-detecting-cycles-in-graphs-a-comprehensive-guide/) - DFS cycle detection for directed graphs
- [GeeksforGeeks: Detect cycle in directed graph](https://www.geeksforgeeks.org/dsa/detect-cycle-in-a-graph/) - Build-time validation patterns

### Tertiary (LOW confidence)
- [Grafana: Dashboard best practices 2026](https://grafana.com/grafana/dashboards/) - Admin metrics visualization patterns (not directly applicable, platform uses custom React components)
- [LLM Prices: Token cost calculator](https://www.llm-prices.com/) - Cost estimation methodology (verified with existing estimateCost methods)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists in codebase, no new libraries needed
- Architecture: HIGH - Provider-level wrapper pattern matches existing callAPI structure
- Pitfalls: HIGH - Based on user decisions and existing error handling patterns
- Cost tracking: HIGH - User decision for estimated costs aligns with existing provider methods
- Admin dashboard: MEDIUM - UI implementation details left to Claude's discretion

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain with explicit user decisions)

**Key constraints from CONTEXT.md:**
- 1:1 same-model mapping (no alternatives exploration)
- Max depth 1 (no fallback chains)
- Minimal tracking (boolean flag only)
- Admin-only visibility (no public exposure)
- Estimated costs (no billing API integration)
- Immediate fallback (no retries on original model)
