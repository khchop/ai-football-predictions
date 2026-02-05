# Domain Pitfalls: Model-Specific Prompts, Fallback Chains & Dynamic Counts

**Domain:** Adding model-specific prompts and fallback chains to existing LLM application
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This research focuses on pitfalls specific to ADDING model-specific prompts, fallback chains, and dynamic model counts to an EXISTING production LLM system (not building from scratch). The platform already has 36 models, auto-disable logic, multi-strategy JSON parsing, and 15+ hardcoded count references. The key risks are:

1. **Integration pitfalls** - Breaking existing working models when adding new features
2. **Fallback chain mistakes** - Cost explosions, API incompatibilities, infinite loops
3. **Dynamic count bugs** - Cache inconsistencies, stale counts across system
4. **Prompt template sprawl** - Maintenance nightmare with 36+ model-specific templates

These pitfalls are distinct from generic LLM issues because the system is brownfield with production data, existing error handling, and users expecting current models to keep working.

---

## Critical Pitfalls (Breaking/Expensive)

### Pitfall 1: Fallback Chain Cost Explosion

**What goes wrong:** Fallback from cheap Synthetic model ($0.40/1M tokens) to expensive Together premium model ($3.00/1M tokens) silently multiplies costs by 7.5x. With 100+ predictions per day, a single misconfigured fallback route can burn through monthly budget in hours.

**Why it happens:**
- Fallback mapping defined by "model equivalence" without cost consideration
- No budget guards in fallback execution path
- Silent fallback without cost-aware routing

**Real example from codebase:**
```typescript
// src/lib/llm/index.ts (current state)
export const MODEL_FALLBACKS: Record<string, string> = {
  'kimi-k2-thinking-syn': 'kimi-k2-instruct', // $2.00 → $1.00 (safe)
  'deepseek-r1-0528-syn': 'deepseek-r1',      // $3.00 → $1.47 (safe)
  // MISSING: Cost validation before fallback execution
};
```

**Prevention:**
1. Add `maxFallbackCost` parameter to fallback execution
2. Compare `fallbackModel.pricing` vs `originalModel.pricing` before attempting
3. Log fallback cost impact: `fallbackCost > originalCost * 2.0 ? WARN : INFO`
4. Add circuit breaker: pause fallbacks if daily cost exceeds budget threshold

**Warning signs:**
- Together AI API costs spike without prediction volume increase
- Budget alerts trigger mid-day instead of end-of-day
- Expensive premium models showing high usage in logs without explicit calls

**Detection:**
```typescript
// Add to fallback execution
if (fallbackProvider.pricing.promptPer1M > originalProvider.pricing.promptPer1M * 2) {
  logger.warn({
    original: originalProvider.id,
    fallback: fallbackProvider.id,
    costMultiplier: fallbackProvider.pricing.promptPer1M / originalProvider.pricing.promptPer1M,
  }, 'Fallback is significantly more expensive');
  // Consider: reject fallback or require explicit approval
}
```

**Phase impact:** Phase 39-03 (Together AI Fallbacks) must address this BEFORE implementing fallback execution.

---

### Pitfall 2: Fallback Loop of Death

**What goes wrong:** Model A fails → fallback to Model B → Model B also disabled/fails → fallback attempts Model A again → infinite loop consumes all queue workers and crashes prediction pipeline.

**Why it happens:**
- No tracking of "attempted models" in fallback chain
- Bidirectional fallback mappings without cycle detection
- Disabled models not filtered from fallback candidates

**Concrete scenario:**
```typescript
// BAD: Circular fallback mapping
MODEL_FALLBACKS = {
  'deepseek-r1-0528-syn': 'deepseek-r1',           // Syn → Together
  'deepseek-r1': 'deepseek-r1-0528-syn',           // Together → Syn (LOOP!)
};

// Execution path:
// 1. Try deepseek-r1-0528-syn → timeout
// 2. Fallback to deepseek-r1 → also timeout
// 3. Fallback to deepseek-r1-0528-syn → timeout
// 4. Repeat until worker dies
```

**Prevention:**
1. **Cycle detection:** Build fallback graph, detect cycles at startup (fail-fast)
2. **Attempted set:** Track `attemptedModelIds: Set<string>` in prediction context
3. **Max fallback depth:** Hard limit of 3 fallback attempts per prediction
4. **Filter disabled models:** Check `getAutoDisabledModelIds()` before each fallback

**Warning signs:**
- Worker processes consuming 100% CPU without completing predictions
- Same match stuck in "pending predictions" for hours
- Log shows same model ID appearing multiple times in single prediction flow
- Queue job timeout alerts (120s exceeded)

**Detection code:**
```typescript
// Add to getFallbackProvider()
export function getFallbackProvider(
  modelId: string,
  attemptedModels: Set<string> = new Set()
): LLMProvider | undefined {
  // Prevent cycles
  if (attemptedModels.has(modelId)) {
    logger.warn({ modelId, attemptedModels: Array.from(attemptedModels) },
      'Cycle detected in fallback chain');
    return undefined;
  }

  // Prevent excessive depth
  if (attemptedModels.size >= 3) {
    logger.warn({ attemptedModels: Array.from(attemptedModels) },
      'Max fallback depth exceeded');
    return undefined;
  }

  const fallbackId = MODEL_FALLBACKS[modelId];
  if (!fallbackId) return undefined;

  // Ensure fallback not in attempted set
  if (attemptedModels.has(fallbackId)) {
    logger.warn({ fallbackId, attemptedModels }, 'Fallback already attempted');
    return undefined;
  }

  return ALL_PROVIDERS.find(p => p.id === fallbackId);
}
```

**Phase impact:** Phase 39-03 (Together AI Fallbacks) - This is a release blocker. Must validate no cycles exist.

---

### Pitfall 3: Silent Prompt Override Breaking Working Models

**What goes wrong:** Adding model-specific prompts overrides the working base prompt for all models, breaking the 29 Together AI models that currently work. Users see prediction failures for previously reliable models.

**Why it happens:**
- Model-specific prompt logic has bug: applies when `modelId` matches partial string
- No fallback to base prompt when model-specific prompt not found
- Model-specific prompts tested in isolation, not integrated with existing flow

**Concrete scenario:**
```typescript
// BAD: Overly broad matching
function getPromptForModel(modelId: string): string {
  // BUG: 'kimi-k2' matches both 'kimi-k2-instruct' and 'kimi-k2-thinking-syn'
  if (modelId.includes('kimi-k2')) {
    return KIMI_SPECIFIC_PROMPT; // Wrong for kimi-k2-instruct!
  }
  return BASE_SYSTEM_PROMPT;
}

// RESULT: kimi-k2-instruct (working model) now uses wrong prompt → fails parsing
```

**Prevention:**
1. **Exact matching only:** Use `modelId === 'exact-id'` not `includes()` or regex
2. **Explicit mapping:** `MODEL_SPECIFIC_PROMPTS: Record<string, string>` with exact IDs
3. **Graceful fallback:** If prompt not in map, use `BASE_SYSTEM_PROMPT` (don't throw)
4. **Integration test:** Run all 36 models through prompt selection before deploying
5. **Gradual rollout:** Deploy model-specific prompts to 1 model first, validate, then expand

**Warning signs:**
- Working models suddenly disabled after prompt changes
- Parse errors in models that previously had 90%+ success rate
- Error logs showing unexpected prompt being used for model

**Safe implementation:**
```typescript
// GOOD: Explicit mapping with fallback
const MODEL_SPECIFIC_PROMPTS: Record<string, string> = {
  'kimi-k2.5-syn': KIMI_K25_PROMPT,          // Only matches exact ID
  'glm-4.7-syn': GLM_47_PROMPT,
  'qwen3-235b-thinking-syn': QWEN3_THINKING_PROMPT,
};

export function getSystemPrompt(modelId: string): string {
  return MODEL_SPECIFIC_PROMPTS[modelId] ?? BASE_SYSTEM_PROMPT; // Safe fallback
}

// Test before deploy
for (const provider of ALL_PROVIDERS) {
  const prompt = getSystemPrompt(provider.id);
  assert(prompt.length > 100, `Prompt too short for ${provider.id}`);
  assert(prompt.includes('JSON'), `Prompt missing JSON instruction for ${provider.id}`);
}
```

**Phase impact:** Phase 39-01 (Model-Specific Prompts) - Must test integration before merging.

---

### Pitfall 4: Race Condition Between Auto-Disable and Fallback

**What goes wrong:** Model A fails 5 times → triggers auto-disable → but fallback logic already queued a job using Model A → job runs after disable → creates 6th failure → database inconsistency → model stuck in limbo state.

**Why it happens:**
- Auto-disable happens in `recordModelFailure()` (database write)
- Fallback decision happens in queue worker (reads disabled models at job start)
- Time gap between "check if disabled" and "execute prediction" allows race

**Concrete scenario:**
```
t=0:   Worker checks disabled models → Model A not disabled
t=1:   Another worker records 5th failure for Model A
t=2:   Model A auto-disabled (autoDisabled=true, consecutiveFailures=5)
t=3:   First worker executes prediction with Model A (stale check)
t=4:   Prediction fails → recordModelFailure() sees autoDisabled=true but increments consecutiveFailures → now 6
t=5:   Database inconsistency: consecutiveFailures > DISABLE_THRESHOLD
```

**Why this matters in brownfield system:**
- Existing `getActiveProviders()` caches disabled models at startup
- Queue jobs are long-running (30-120s per batch)
- Multiple workers running concurrently (4+ workers)

**Prevention:**
1. **Check-then-execute atomicity:** Re-check disabled status immediately before API call
2. **Optimistic locking:** Use `autoDisabled` as gate in prediction execution
3. **Idempotent disable:** Prevent `consecutiveFailures` increment if already `autoDisabled=true`

**Safe implementation:**
```typescript
// In prediction worker, before calling LLM
async function executePredictionWithFallback(provider: LLMProvider, ...args) {
  // CRITICAL: Re-check disabled status (not cached)
  const model = await getModelById(provider.id);
  if (model?.autoDisabled) {
    logger.info({ modelId: provider.id }, 'Model disabled since job start, skipping');
    const fallback = getFallbackProvider(provider.id);
    if (fallback) {
      return executePredictionWithFallback(fallback, ...args); // Recursive with new model
    }
    throw new Error(`Model ${provider.id} disabled and no fallback available`);
  }

  // Proceed with API call
  return provider.predict(...args);
}
```

**Warning signs:**
- Models with `consecutiveFailures > 5` in database
- Auto-disabled models still appearing in prediction logs
- Models stuck disabled despite successful recovery attempts

**Phase impact:** Phase 39-03 (Together AI Fallbacks) - Must handle this in fallback execution logic.

---

## Moderate Pitfalls (Data Integrity/UX Issues)

### Pitfall 5: Stale Model Count Cache Inconsistency

**What goes wrong:** Homepage shows "35 AI models", leaderboard shows "36 models", match page FAQs say "30 models" - users see different counts across pages because each page has separate cache invalidation logic.

**Why it happens:**
- 15+ hardcoded references scattered across codebase (identified in milestone context)
- Dynamic count implementation replaces only SOME references, misses others
- Different cache TTLs for different pages (homepage: 1h, leaderboard: 5m, match: 60s)
- New model added → cache invalidation misses some keys

**Concrete locations (from codebase):**
```typescript
// Hardcoded locations to replace (from grep search):
// src/app/page.tsx - Homepage hero: "35+ AI models"
// src/app/about/page.tsx - About page: "35 models"
// src/lib/content/prompts.ts - System prompt: "28 other AI models"
// src/components/match/MatchFAQSchema.tsx - FAQ: "35 models"
// src/app/leagues/[slug]/league-hub-content.tsx - League description: "35 models"
```

**Prevention:**
1. **Single source of truth:** Create `getActiveModelCount()` function, use everywhere
2. **Consistent caching:** All model-count queries use same cache key
3. **Atomic invalidation:** When model added/disabled, invalidate ALL count caches
4. **Validation:** Add test that searches codebase for hardcoded numbers (30-40 range)

**Safe implementation:**
```typescript
// src/lib/llm/index.ts
export async function getActiveModelCount(): Promise<number> {
  return withCache(
    'stats:active_model_count',
    CACHE_TTL.STATS, // Same TTL everywhere
    async () => {
      const activeProviders = await getActiveProviders();
      return activeProviders.length;
    }
  );
}

// Cache invalidation (add to syncModelsToDatabase, recordModelSuccess, recordModelFailure)
async function invalidateModelCountCache() {
  await cacheDelete('stats:active_model_count');
}

// Usage everywhere
const modelCount = await getActiveModelCount();
return `${modelCount} AI models predict every match`;
```

**Warning signs:**
- Different model counts shown on different pages
- Model count doesn't update after re-enabling disabled model
- User reports: "Why does it say 35 in one place and 30 in another?"

**Detection:**
```bash
# Find hardcoded model counts (run in CI)
rg '\b(29|30|35|36|42)\s+(AI\s+)?models?' --type ts --type tsx
# Should return zero results after fix
```

**Phase impact:** Phase 39-04 (Dynamic Model Counts) - This is the main deliverable, can't ship with inconsistency.

---

### Pitfall 6: Prompt Template Maintenance Sprawl

**What goes wrong:** Start with 1 base prompt → add 6 model-specific prompts → now have 7 prompts to maintain. Change scoring system → must update 7 files. Add new market data → must update 7 files. Change JSON format → must update 7 files. Maintenance burden grows linearly with model count.

**Why it happens:**
- Copy-paste pattern for new model prompts
- No template inheritance or composition
- Each prompt is monolithic (system + user + format instructions)

**Concrete example:**
```typescript
// BAD: Full duplication
const BASE_SYSTEM_PROMPT = `You are a football prediction AI...
SCORING SYSTEM (Kicktipp Quota):
- Tendency Points (2-6): Correct match result...
OUTPUT FORMAT: {"home_score": X, "away_score": Y}`;

const KIMI_SPECIFIC_PROMPT = `You are a football prediction AI...
SCORING SYSTEM (Kicktipp Quota):
- Tendency Points (2-6): Correct match result...
SPECIAL INSTRUCTION: Respond in English only.
OUTPUT FORMAT: {"home_score": X, "away_score": Y}`;

// Now scoring changes → must update BOTH prompts
// Now output format changes → must update BOTH prompts
```

**Prevention:**
1. **Prompt composition:** Base template + model-specific override sections
2. **Modular prompt parts:** Separate `SCORING_RULES`, `OUTPUT_FORMAT`, `BASE_INSTRUCTIONS`
3. **Version control:** Track prompt versions separately from code (allow prompt updates without deploy)
4. **Testing:** Automated validation that all prompts include required sections

**Better implementation:**
```typescript
// GOOD: Compositional prompts
const PROMPT_COMPONENTS = {
  SCORING_RULES: `SCORING SYSTEM (Kicktipp Quota):...`,
  OUTPUT_FORMAT: `OUTPUT FORMAT: {"home_score": X, "away_score": Y}`,
  BASE_INSTRUCTIONS: `You are a football prediction AI...`,
};

const MODEL_OVERRIDES: Record<string, string> = {
  'kimi-k2.5-syn': 'SPECIAL INSTRUCTION: Respond in English only. Avoid Chinese characters.',
  'glm-4.7-syn': 'OUTPUT LANGUAGE: English only (不要用中文).',
  'qwen3-235b-thinking-syn': 'REASONING: Show brief reasoning in <think> tags before JSON.',
};

export function buildPrompt(modelId: string): string {
  const override = MODEL_OVERRIDES[modelId] || '';
  return [
    PROMPT_COMPONENTS.BASE_INSTRUCTIONS,
    PROMPT_COMPONENTS.SCORING_RULES,
    override, // Insert model-specific part
    PROMPT_COMPONENTS.OUTPUT_FORMAT,
  ].filter(Boolean).join('\n\n');
}

// Now scoring change updates SCORING_RULES → all 36 models get update automatically
```

**Warning signs:**
- Prompt files growing larger with each new model
- Git diffs show same text changed in 5+ different prompts
- Bug fix applied to base prompt but not model-specific prompts

**Phase impact:** Phase 39-01 (Model-Specific Prompts) - Design this upfront or suffer maintenance hell.

---

### Pitfall 7: Fallback Without API Compatibility Validation

**What goes wrong:** Fallback from Synthetic model to Together AI model → Together API requires different parameter format → fallback fails silently → prediction marked failed but real issue is API incompatibility, not model issue.

**Why it happens:**
- Assume OpenAI-compatible means 100% compatible
- Provider differences in: max_tokens limits, temperature ranges, stop sequences, tool calling format
- No pre-flight validation before fallback execution

**Real incompatibilities (from research):**
- **max_tokens:** Synthetic allows 4096, Together some models limited to 2048
- **temperature:** Synthetic accepts 0.0-2.0, Together some models 0.1-1.0 only
- **stop sequences:** Synthetic allows 4 sequences, Together allows 2
- **model ID format:** Synthetic uses `hf:org/model`, Together uses `org/model`

**Prevention:**
1. **Capability matrix:** Document provider-specific limits for each parameter
2. **Pre-flight check:** Validate request parameters against target provider before fallback
3. **Parameter normalization:** Adjust parameters when crossing providers

**Safe implementation:**
```typescript
interface ProviderLimits {
  maxTokens: number;
  temperatureRange: [number, number];
  maxStopSequences: number;
}

const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  'synthetic': { maxTokens: 4096, temperatureRange: [0, 2], maxStopSequences: 4 },
  'together': { maxTokens: 2048, temperatureRange: [0.1, 1], maxStopSequences: 2 },
};

function normalizeRequestForProvider(
  request: PredictionRequest,
  targetProvider: string
): PredictionRequest {
  const limits = PROVIDER_LIMITS[targetProvider];

  return {
    ...request,
    max_tokens: Math.min(request.max_tokens, limits.maxTokens),
    temperature: Math.max(limits.temperatureRange[0],
      Math.min(request.temperature, limits.temperatureRange[1])),
    stop: request.stop?.slice(0, limits.maxStopSequences),
  };
}

// In fallback execution
const normalizedRequest = normalizeRequestForProvider(request, fallbackProvider.name);
return fallbackProvider.predict(normalizedRequest);
```

**Warning signs:**
- Fallback failures logged as "model error" but error message is "invalid parameter"
- 400 Bad Request errors after fallback execution
- Fallbacks working in development but failing in production

**Phase impact:** Phase 39-03 (Together AI Fallbacks) - Test cross-provider fallback thoroughly.

---

### Pitfall 8: Dynamic Count Not Updated After Model Recovery

**What goes wrong:** 6 models auto-disabled → count shows "30 models" → recovery worker re-enables 3 models → count still shows "30 models" for next hour because cache not invalidated.

**Why it happens:**
- Model recovery worker (`recoverDisabledModels()`) updates database
- Cache invalidation not triggered by recovery worker
- Count cached with long TTL (60 minutes)

**Prevention:**
1. **Recovery triggers invalidation:** Add cache invalidation to `recoverDisabledModels()`
2. **Shorter TTL for model count:** Use 5-minute cache (model state changes frequently)
3. **Event-driven invalidation:** Emit event on model state change → invalidate all count caches

**Safe implementation:**
```typescript
// In src/lib/db/queries.ts
export async function recoverDisabledModels(): Promise<number> {
  const db = getDb();
  // ... existing recovery logic ...

  if (recoveredCount > 0) {
    // CRITICAL: Invalidate count cache after recovery
    await cacheDelete('stats:active_model_count');
    await cacheDelete(cacheKeys.activeProviders()); // Also invalidate provider list

    logger.info({ recoveredCount }, 'Model count cache invalidated after recovery');
  }

  return recoveredCount;
}
```

**Warning signs:**
- Admin dashboard shows "3 models recovered" but homepage still shows old count
- Model recovered but doesn't appear in leaderboard for 30+ minutes
- Cache invalidation logged for model state but count not updated

**Phase impact:** Phase 39-04 (Dynamic Model Counts) - Must handle recovery scenario.

---

## Minor Pitfalls (Annoyances/Edge Cases)

### Pitfall 9: Thinking Model XML Tags Breaking JSON Parser

**What goes wrong:** Thinking models (DeepSeek R1, Kimi K2 Thinking) return `<think>reasoning here</think>\n{"home_score": 2, "away_score": 1}` → existing JSON parser already strips these tags (line 148-150 in prompt.ts) → but model-specific prompts ask for JSON-only → model ignores instruction → still returns thinking tags → parse succeeds but log noise increases.

**Why it happens:**
- Thinking models trained to show reasoning by default
- Prompt instruction "JSON only" conflicts with model's base behavior
- Parser handles it (already strips tags) but creates unnecessary complexity

**Prevention:**
1. **Accept thinking behavior:** Don't try to suppress it with prompts (won't work)
2. **Document in model config:** Mark thinking models with `allowsThinkingTags: true`
3. **Separate parser for thinking models:** Custom parser that extracts and logs reasoning separately

**Current state (already handled):**
```typescript
// src/lib/llm/prompt.ts (lines 148-150)
// Remove thinking/reasoning tags (in case any reasoning models slip through)
cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
```

**Optimization:**
```typescript
// Instead of stripping, extract and log reasoning
const thinkingMatch = response.match(/<think>([\s\S]*?)<\/think>/i);
if (thinkingMatch) {
  logger.debug({
    modelId,
    reasoning: thinkingMatch[1].slice(0, 200) // First 200 chars
  }, 'Model provided reasoning');
}
```

**Warning signs:**
- High volume of "thinking tag removed" debug logs
- Thinking models showing lower parse success rate despite tags being stripped
- Users asking "why does the model show reasoning sometimes?"

**Phase impact:** Phase 39-01 (Model-Specific Prompts) - Document behavior, don't try to change it.

---

### Pitfall 10: Model-Specific Prompts Not Version Controlled Separately

**What goes wrong:** Change prompt for one model → requires full application deployment → can't A/B test prompts → can't roll back prompt without code rollback.

**Why it happens:**
- Prompts stored in TypeScript files alongside application code
- No separation between "code changes" and "prompt changes"
- Deploy process treats prompt updates same as feature updates

**Prevention:**
1. **Prompt versioning:** Store prompts in database or config files with version numbers
2. **Hot reload:** Allow prompt updates without application restart
3. **A/B testing:** Support multiple prompt versions per model
4. **Rollback:** Independent prompt rollback without code rollback

**Better architecture:**
```typescript
// Prompts as configuration, not code
interface PromptConfig {
  modelId: string;
  version: number;
  systemPrompt: string;
  activeFrom: string;
  activeTo?: string;
}

// Load from database or JSON config file
export async function getActivePrompt(modelId: string): Promise<string> {
  const config = await db.select()
    .from(promptConfigs)
    .where(and(
      eq(promptConfigs.modelId, modelId),
      lte(promptConfigs.activeFrom, new Date()),
      or(isNull(promptConfigs.activeTo), gte(promptConfigs.activeTo, new Date()))
    ))
    .orderBy(desc(promptConfigs.version))
    .limit(1);

  return config?.systemPrompt ?? BASE_SYSTEM_PROMPT;
}
```

**Warning signs:**
- Prompt changes blocked by deploy schedule
- Can't test new prompt without full deployment
- Prompt bugs require full application rollback

**Phase impact:** Phase 39-01 (Model-Specific Prompts) - Consider if rapid iteration needed.

---

### Pitfall 11: Fallback Metrics Not Tracked Separately

**What goes wrong:** Model A fails 5 times → disabled → fallback to Model B succeeds 100% → dashboard shows "Model A: 0% success" → looks like fallback isn't working → but fallback predictions counted under Model B stats, not Model A.

**Why it happens:**
- Prediction stored with `modelId = fallbackModelId` (which model actually predicted)
- No tracking of "intended model" vs "actual model"
- Success metrics show fallback model performance, not fallback system performance

**Prevention:**
1. **Track fallback metadata:** Store `originalModelId` and `fallbackModelId` in predictions
2. **Fallback success rate:** Separate metric for "fallback success when primary failed"
3. **Dashboard visibility:** Show "Model X: 5 predictions via fallback to Model Y"

**Enhanced schema:**
```typescript
// Add to predictions table
interface Prediction {
  // ... existing fields ...
  originalModelId?: string;  // If this prediction was a fallback
  fallbackModelId?: string;  // Which model actually made prediction
  fallbackReason?: string;   // Why fallback occurred
}

// Query fallback effectiveness
SELECT
  originalModelId,
  fallbackModelId,
  COUNT(*) as fallback_count,
  SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END) as successful_fallbacks
FROM predictions
WHERE originalModelId IS NOT NULL
GROUP BY originalModelId, fallbackModelId;
```

**Warning signs:**
- Can't answer "how often do fallbacks succeed?"
- Disabled model stats show 0 predictions but fallback is running
- No visibility into which fallback routes are most effective

**Phase impact:** Phase 39-03 (Together AI Fallbacks) - Track metrics from day 1 or lose visibility.

---

## Phase-Specific Warnings

| Phase | Primary Pitfall | Mitigation | Detection Method |
|-------|----------------|------------|------------------|
| 39-01: Model-Specific Prompts | Pitfall 3: Breaking working models | Exact ID matching, integration tests | Monitor parse success rate for all models after deploy |
| 39-01: Model-Specific Prompts | Pitfall 6: Prompt maintenance sprawl | Compositional prompt architecture | Count distinct prompt files (should be <3) |
| 39-03: Together AI Fallbacks | Pitfall 1: Cost explosion | Budget guards in fallback execution | Monitor Together AI API spend per hour |
| 39-03: Together AI Fallbacks | Pitfall 2: Fallback loops | Cycle detection, max depth limit | Worker CPU usage, queue job timeouts |
| 39-03: Together AI Fallbacks | Pitfall 4: Auto-disable race condition | Re-check disabled status before execution | Models with consecutiveFailures > 5 |
| 39-03: Together AI Fallbacks | Pitfall 7: API incompatibility | Parameter normalization | 400 errors after fallback |
| 39-04: Dynamic Model Counts | Pitfall 5: Stale cache inconsistency | Single source of truth, atomic invalidation | Different counts on different pages |
| 39-04: Dynamic Model Counts | Pitfall 8: Recovery not updating count | Cache invalidation in recovery worker | Count unchanged after recovery |

---

## Open Questions

### Question 1: Should fallbacks be per-error-type or per-model?

**What we know:** Current code has model-level fallback mapping (`MODEL_FALLBACKS`). Some errors are model-specific (parse failures) while others are provider-wide (rate limits, outages).

**Trade-offs:**
- **Per-model:** Simpler, but might fallback on transient provider issues
- **Per-error-type:** More accurate, but complex decision tree

**Recommendation:** Start with per-model (simpler), add error-type routing in Phase 2 if needed.

### Question 2: Should model-specific prompts use inheritance or complete replacement?

**What we know:** 6 disabled models need prompt fixes, but 30 working models should keep base prompt.

**Trade-offs:**
- **Inheritance:** `BASE_PROMPT + MODEL_OVERRIDE` - safer, but harder to test in isolation
- **Complete replacement:** Each model has full prompt - easier to test, but maintenance burden

**Recommendation:** Use inheritance (Pitfall 6 prevention) unless model needs fundamentally different approach.

### Question 3: Should dynamic counts be real-time or cached?

**What we know:** Model count changes infrequently (few times per day) but queried on every page load.

**Trade-offs:**
- **Real-time:** Always accurate, but adds database query to every request
- **Cached:** Fast, but can show stale data for cache TTL duration

**Recommendation:** Cached with 5-minute TTL + event-driven invalidation (balance performance and accuracy).

---

## Validation Checklist (Pre-Release)

**Before deploying Phase 39:**

### Model-Specific Prompts (39-01)
- [ ] All 36 model IDs tested with prompt selection logic
- [ ] Parse success rate maintained or improved for all models
- [ ] Prompt composition tested (base + override = valid prompt)
- [ ] No model receives wrong prompt due to partial ID matching
- [ ] Integration test: Each model produces valid JSON prediction

### Together AI Fallbacks (39-03)
- [ ] Fallback graph validated: No cycles detected
- [ ] Cost guards implemented: Expensive fallbacks logged
- [ ] Max fallback depth enforced: Hard limit of 3 attempts
- [ ] Disabled model filtering: Auto-disabled models excluded from fallbacks
- [ ] Race condition handled: Re-check disabled status before execution
- [ ] API compatibility: Parameter normalization for cross-provider fallbacks
- [ ] Fallback metrics tracked: originalModelId and fallbackModelId stored

### Dynamic Model Counts (39-04)
- [ ] Single source of truth: All count queries use `getActiveModelCount()`
- [ ] Hardcoded references removed: Codebase search returns 0 results for "35 models"
- [ ] Cache invalidation comprehensive: All model state changes trigger count invalidation
- [ ] Recovery updates count: Model recovery triggers cache invalidation
- [ ] Consistent across pages: Same count shown on homepage, leaderboard, match pages
- [ ] Integration test: Add model → count increments on all pages

### Cross-Cutting
- [ ] Budget monitoring: Alert if daily spend exceeds threshold
- [ ] Worker health: CPU and memory usage within normal range
- [ ] Queue performance: No jobs timing out due to fallback loops
- [ ] Error rates: Parse failures not increased after prompt changes
- [ ] User-visible correctness: No conflicting model counts shown

---

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis:
  - `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/index.ts` - Fallback mapping, provider selection
  - `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/prompt.ts` - Prompt system, JSON parsing
  - `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/providers/synthetic.ts` - 6 disabled models, failure modes
  - `/Users/pieterbos/Documents/bettingsoccer/src/lib/db/queries.ts` - Auto-disable logic, recovery worker
  - `/Users/pieterbos/Documents/bettingsoccer/.planning/PROJECT.md` - Current state, constraints
  - `/Users/pieterbos/Documents/bettingsoccer/.planning/phases/35-seo-geo-content-quality/35-RESEARCH.md` - Hardcoded count references

### Secondary (MEDIUM confidence)
- [Statsig: Provider fallbacks - Ensuring LLM availability](https://www.statsig.com/perspectives/providerfallbacksllmavailability) - Fallback pattern best practices
- [DEV Community: Multi-provider LLM orchestration in production - A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) - API compatibility pitfalls
- [Portkey Docs: Fallbacks](https://portkey.ai/docs/product/ai-gateway/fallbacks) - Fallback chain patterns
- [DEV Community: Your Primary LLM Provider Failed? Enable Automatic Fallback with Bifrost](https://dev.to/debmckinney/your-primary-llm-provider-failed-enable-automatic-fallback-with-bifrost-3j7j) - Fallback loop prevention
- [Latitude Blog: Guide to Multi-Model Prompt Design Best Practices](https://latitude-blog.ghost.io/blog/guide-to-multi-model-prompt-design-best-practices/) - Model-specific prompt patterns
- [Medium: The Complete MLOps/LLMOps Roadmap for 2026](https://medium.com/@sanjeebmeister/the-complete-mlops-llmops-roadmap-for-2026-building-production-grade-ai-systems-bdcca5ed2771) - Prompt versioning
- [Lakera: The Ultimate Guide to Prompt Engineering in 2026](https://www.lakera.ai/blog/prompt-engineering-guide) - Prompt engineering best practices
- [Promptingguide.ai: Prompt Chaining](https://www.promptingguide.ai/techniques/prompt_chaining) - Error handling in chains

---

## Metadata

**Confidence breakdown:**
- Integration pitfalls with existing system: HIGH - Based on direct codebase analysis
- Fallback chain patterns: HIGH - Multiple authoritative sources + production examples
- Dynamic count issues: HIGH - Common brownfield migration pattern
- Cost explosion risks: HIGH - Concrete pricing data from codebase
- Prompt maintenance patterns: MEDIUM - Best practices well-documented but project-specific

**Research date:** 2026-02-05
**Valid until:** 2026-05-05 (LLM provider landscape and API patterns relatively stable)

**Scope limitations:**
- Focused on ADDING features to existing system (brownfield), not building from scratch
- Pitfalls specific to 36-model system with production data and users
- Does not cover generic LLM issues (rate limits, hallucinations) - those already handled
- Does not cover new model onboarding (Synthetic API already integrated)

**Key assumptions:**
- Budget constraint of $1-5 USD/day for model inference
- 100+ predictions per day across 17 leagues
- 4+ concurrent queue workers
- Current auto-disable threshold of 5 consecutive failures
- 15+ hardcoded model count references (identified via grep)
