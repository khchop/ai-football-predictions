# Architecture Patterns: Model-Specific Prompts & Fallback Chains

**Project:** AI Football Predictions Platform v2.5
**Researched:** 2026-02-05
**Domain:** Integration Architecture for Model Reliability Features
**Confidence:** HIGH

## Executive Summary

This architecture research addresses **how** to integrate model-specific prompts and fallback chains into the **existing** provider architecture without breaking 29 working Together AI models. The key finding: this is a **refactoring milestone**, not a greenfield build.

**Current Architecture (v2.4):**
- **Provider abstraction:** `BaseLLMProvider` → `OpenAICompatibleProvider` → `TogetherProvider` / `SyntheticProvider`
- **Prediction pipeline:** BullMQ worker → `getActiveProviders()` → iterate models → `provider.callAPI()` → parse JSON
- **Error handling:** Multi-strategy JSON parsing, auto-disable after 5 failures, retry with exponential backoff
- **Model registry:** Database `models` table synced from code (`TOGETHER_PROVIDERS`, `SYNTHETIC_PROVIDERS` arrays)

**What v2.5 Adds:**
1. **Prompt selection layer** - Maps model ID → appropriate prompt variant BEFORE `callAPI()`
2. **Fallback orchestration layer** - Wraps `callAPI()` with fallback-on-error logic
3. **Dynamic count derivation** - Replaces hardcoded "35 models" with `getProviderStats().total`

**Core principle:** Minimal invasive changes. Add thin layers around existing abstractions, don't rewrite core logic.

---

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      BullMQ Predictions Worker                   │
│  (src/lib/queue/workers/predictions.worker.ts)                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ getActiveProviders()          │──→ Filters auto-disabled models
        │ (src/lib/llm/index.ts)        │    (existing)
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────────────────┐
        │  FOR EACH provider in activeProviders             │
        └───────────────┬───────────────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────────────────┐
        │  NEW: Prompt Selection Layer                       │
        │  getPromptForModel(provider.id, isBatch)           │
        │  → Returns model-specific or base prompt          │
        └───────────────┬────────────────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────────────────┐
        │  NEW: Fallback Orchestration Layer                 │
        │  callWithFallback(provider, systemPrompt, userPrompt) │
        │  → Try primary, fallback on error                  │
        └───────────────┬────────────────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────────────────┐
        │  EXISTING: Provider API Layer                      │
        │  provider.callAPI(systemPrompt, userPrompt)        │
        │  → OpenAICompatibleProvider.callAPI()              │
        └───────────────┬────────────────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────────────────┐
        │  Together AI / Synthetic.new API                   │
        │  POST /v1/chat/completions                         │
        └────────────────────────────────────────────────────┘
```

**Key insight:** New layers are **non-breaking additions**. Existing `provider.callAPI()` unchanged.

---

## Component Boundaries

### Existing Components (DO NOT MODIFY)

| Component | Responsibility | Location | Why Untouched |
|-----------|---------------|----------|---------------|
| **BaseLLMProvider** | Abstract provider interface with `callAPI()`, `predict()`, `getPredictions()` | `src/lib/llm/providers/base.ts` | Stable abstraction, 29 models depend on it |
| **OpenAICompatibleProvider** | Implements `callAPI()` with OpenAI-compatible HTTP request | `src/lib/llm/providers/base.ts` | Handles retries, timeouts, JSON mode - works correctly |
| **TogetherProvider** | Together.ai-specific configuration (endpoint, headers, pricing) | `src/lib/llm/providers/together.ts` | 29 working models, no issues |
| **SyntheticProvider** | Synthetic.new-specific configuration | `src/lib/llm/providers/synthetic.ts` | 7 active models, issues are prompt-related not provider-related |
| **getActiveProviders()** | Filters disabled models from provider registry | `src/lib/llm/index.ts` | Auto-disable logic already works |
| **MODEL_FALLBACKS map** | Maps Synthetic model ID → Together equivalent | `src/lib/llm/index.ts` (lines 24-39) | Already defined, just not used yet |
| **Predictions worker** | Orchestrates prediction generation for all models | `src/lib/queue/workers/predictions.worker.ts` | Core pipeline is sound, needs prompt selection + fallback |

### New Components (CREATE)

| Component | Responsibility | Location | Integration Point |
|-----------|---------------|----------|-------------------|
| **Prompt Selector** | Maps model ID → appropriate prompt variant | `src/lib/llm/prompt-selector.ts` (NEW) | Called before `callAPI()` in worker |
| **Fallback Orchestrator** | Wraps `callAPI()` with try-catch + fallback logic | `src/lib/llm/fallback.ts` (NEW) | Replaces direct `callAPI()` in worker |
| **Active Count Query** | Single source of truth for active model count | Enhance `getProviderStats()` in `src/lib/llm/index.ts` | Used by UI, content generation, prompts |

### Modified Components (ENHANCE)

| Component | Current | Modification | Why Safe |
|-----------|---------|--------------|----------|
| **Predictions worker** | Calls `provider.callAPI(BATCH_SYSTEM_PROMPT, prompt)` directly | Add prompt selection and fallback wrapper | Only changes caller, not provider implementation |
| **System prompts** | Hardcoded "28 other AI models" | Replace with `getProviderStats().total - 1` | Single string replacement, no logic change |
| **UI text** | Hardcoded "35 models" in 15+ locations | Replace with `await getActiveModelCount()` | Find/replace with dynamic query |
| **recordModelSuccess()** | Records success for requested model | Accept optional `actualModelId` parameter for fallback tracking | Backward compatible (parameter is optional) |

---

## Integration Points

### Integration Point 1: Prompt Selection (Predictions Worker)

**Current code (predictions.worker.ts, line ~162):**
```typescript
// CURRENT: Always uses BATCH_SYSTEM_PROMPT
const rawResponse = await (provider as unknown as { callAPI: (system: string, user: string) => Promise<string> }).callAPI(BATCH_SYSTEM_PROMPT, prompt);
```

**Modified code:**
```typescript
// MODIFIED: Select appropriate prompt for model
import { getPromptForModel } from '@/lib/llm/prompt-selector';

const systemPrompt = getPromptForModel(provider.id, true); // true = batch mode
const rawResponse = await (provider as unknown as { callAPI: (system: string, user: string) => Promise<string> }).callAPI(
  systemPrompt,  // ← CHANGED: model-specific prompt
  prompt
);
```

**Why this works:**
- `callAPI()` signature unchanged: still accepts `(systemPrompt, userPrompt)`
- Prompt selector is pure function: no side effects, no state
- Fallback to base prompt: if model not in map, returns `BATCH_SYSTEM_PROMPT`
- Zero risk to working models: 29 Together models get base prompt (same as before)

**Files touched:**
1. `src/lib/queue/workers/predictions.worker.ts` - Add prompt selection (1 line change)
2. `src/lib/llm/prompt-selector.ts` - New file (~100 LOC)

---

### Integration Point 2: Fallback Orchestration (Predictions Worker)

**Current code (predictions.worker.ts, lines ~147-236):**
```typescript
// CURRENT: Direct API call with try-catch per model
for (const provider of providers) {
  try {
    const rawResponse = await provider.callAPI(systemPrompt, prompt);
    // ... parse and save prediction ...
  } catch (modelError) {
    // ... log error, record failure, continue to next model ...
  }
}
```

**Modified code:**
```typescript
// MODIFIED: Wrap with fallback orchestration
import { callWithFallback } from '@/lib/llm/fallback';

for (const provider of providers) {
  try {
    const systemPrompt = getPromptForModel(provider.id, true);

    // NEW: Fallback wrapper returns [response, actualProvider]
    const [rawResponse, usedProvider] = await callWithFallback(
      provider,
      systemPrompt,
      prompt
    );

    // ... parse prediction (existing logic) ...

    // MODIFIED: Record success for actual provider (may be fallback)
    await recordModelSuccess(usedProvider.id);

    // NEW: Log fallback usage if different provider used
    if (usedProvider.id !== provider.id) {
      logger.info({
        requestedModel: provider.id,
        fallbackModel: usedProvider.id,
      }, 'Fallback provider succeeded');
    }

  } catch (modelError) {
    // UNCHANGED: Still record failure for requested model
    await recordModelFailure(provider.id, errorMessage, errorType);
  }
}
```

**Why this works:**
- `callWithFallback()` returns tuple: `[response: string, provider: LLMProvider]`
- Transparent to caller: still get `rawResponse` string (same as before)
- Fallback is optional: if no fallback configured, throws original error
- Success tracking enhanced: records fallback usage without breaking stats
- Backward compatible: models without fallbacks work exactly as before

**Files touched:**
1. `src/lib/queue/workers/predictions.worker.ts` - Wrap callAPI with fallback (~15 lines changed)
2. `src/lib/llm/fallback.ts` - New file (~150 LOC)
3. `src/lib/db/queries.ts` - Enhance `recordModelSuccess()` to accept optional `actualModelId` parameter (~5 lines)

---

### Integration Point 3: Dynamic Model Counts (Multiple Files)

**Current state:** Hardcoded "35 models" in 15+ locations identified in Phase 35 research:
- UI text: homepage, about page, league hubs
- Content generation: FAQ prompts, system prompts
- Schema.org: descriptions and metadata
- OG images: social share text

**Modified approach:** Single source of truth

```typescript
// src/lib/llm/index.ts (EXISTING FUNCTION - lines 115-136)
// Already implemented, just not used everywhere

export function getProviderStats(): {
  total: number;           // ← Use this instead of hardcoded 35
  active: number;          // ← Add this: filters disabled models
  together: number;
  synthetic: number;
  // ... other stats
} {
  const allProviders = [...TOGETHER_PROVIDERS, ...SYNTHETIC_PROVIDERS];
  const disabledIds = getAutoDisabledModelIds(); // ← Add disabled filtering

  return {
    total: allProviders.length,
    active: allProviders.filter(p => !disabledIds.has(p.id)).length,  // ← NEW
    together: TOGETHER_PROVIDERS.length,
    synthetic: SYNTHETIC_PROVIDERS.length,
    // ...
  };
}
```

**Usage pattern (replace 15+ hardcoded references):**

```typescript
// Example 1: UI text (React Server Component)
import { getProviderStats } from '@/lib/llm';

export default function HomePage() {
  const stats = getProviderStats();

  return (
    <h1>Compare predictions from {stats.active} AI models</h1>
    // CHANGED: was "35 AI models" (hardcoded)
  );
}

// Example 2: System prompt
import { getProviderStats } from './index';

const stats = getProviderStats();
export const SYSTEM_PROMPT = `You are competing against ${stats.total - 1} other AI models...`;
// CHANGED: was "28 other AI models" (hardcoded)

// Example 3: Content generation
import { getProviderStats } from '@/lib/llm';

export function buildPostMatchPrompt(match: Match, correctCount: number): string {
  const stats = getProviderStats();

  return `AI Model Performance:
- Total models: ${stats.active}
- Correct predictions: ${correctCount} of ${stats.active}
- Accuracy: ${Math.round(correctCount / stats.active * 100)}%`;
}
```

**Why this works:**
- Function already exists: just needs to be used consistently
- Stateless computation: no database query overhead
- Type-safe: TypeScript ensures stats object structure
- Automatic updates: add new provider → count updates everywhere

**Files touched:** 15+ locations across:
- `src/app/page.tsx` - Homepage hero
- `src/app/about/page.tsx` - About page
- `src/lib/llm/prompt.ts` - System prompts
- `src/lib/content/prompts.ts` - Content generation prompts
- `src/components/match/MatchFAQSchema.tsx` - FAQ generation
- `src/app/leagues/[slug]/league-hub-content.tsx` - League descriptions
- `src/components/MatchPageSchema.tsx` - Schema.org descriptions

---

## Data Flow Changes

### Before v2.5: Direct API Call

```
┌─────────────────┐
│ Worker gets job │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Iterate active models│
│ getActiveProviders() │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────────────┐
│ provider.callAPI(            │
│   BATCH_SYSTEM_PROMPT,  ← Always base prompt
│   userPrompt                 │
│ )                            │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────┐
│ Parse JSON response  │
│ (multi-strategy)     │
└────────┬─────────────┘
         │
         ├─ Success → recordModelSuccess(provider.id)
         │
         └─ Failure → recordModelFailure(provider.id)
                      ↓ (after 5 failures)
                      Auto-disable model
```

### After v2.5: Prompt Selection + Fallback Chain

```
┌─────────────────┐
│ Worker gets job │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Iterate active models│
│ getActiveProviders() │
└────────┬─────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ NEW: Prompt Selection Layer     │
│ getPromptForModel(provider.id)  │
│ → GLM: English-only variant     │
│ → Thinking: Suppress tags       │
│ → Others: Base prompt           │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ NEW: Fallback Orchestration Layer        │
│ callWithFallback(provider, prompt, user) │
└────────┬────────┬────────────────────────┘
         │        │
    PRIMARY      FALLBACK (if primary fails)
         │        │
         ▼        ▼
┌─────────────┐  ┌─────────────────────┐
│ Synthetic   │  │ Together.ai         │
│ API call    │  │ equivalent model    │
└──────┬──────┘  └──────┬──────────────┘
       │                │
       └────────┬───────┘
                │
                ▼
┌──────────────────────┐
│ Parse JSON response  │
│ (multi-strategy)     │
└────────┬─────────────┘
         │
         ├─ Success → recordModelSuccess(usedProvider.id)  ← Track actual provider
         │            Log fallback if usedProvider ≠ requestedProvider
         │
         └─ Failure → recordModelFailure(requestedProvider.id)
                      ↓ (after 5 failures)
                      Auto-disable model
```

**Key differences:**
1. **Prompt selection** happens once per model BEFORE API call
2. **Fallback wraps API call** - tries primary, catches error, tries fallback
3. **Success tracking enhanced** - records which provider actually succeeded
4. **Failure tracking unchanged** - still counts toward requested model's auto-disable

---

## New Components Detail

### Component 1: Prompt Selector

**File:** `src/lib/llm/prompt-selector.ts` (NEW)

**Responsibility:** Map model ID to appropriate prompt variant

**Interface:**
```typescript
/**
 * Get appropriate system prompt for a model
 * @param modelId - Model ID (e.g., 'deepseek-r1-0528-syn')
 * @param isBatch - Whether this is a batch prediction (affects prompt format)
 * @returns System prompt string
 */
export function getPromptForModel(modelId: string, isBatch: boolean = false): string;

/**
 * Check if model has custom prompt (useful for logging)
 */
export function hasCustomPrompt(modelId: string): boolean;
```

**Architecture:**
```typescript
// Prompt components (shared parts)
const PROMPT_COMPONENTS = {
  BASE_INSTRUCTIONS: `You are a football prediction AI...`,
  SCORING_RULES: `SCORING SYSTEM (Kicktipp Quota):...`,
  OUTPUT_FORMAT: `OUTPUT FORMAT: {"home_score": X, "away_score": Y}`,
};

// Model-specific overrides (only differences)
const MODEL_OVERRIDES: Record<string, string> = {
  'glm-4.7-syn': 'LANGUAGE: Respond ONLY in English. Do not use Chinese characters.',
  'kimi-k2.5-syn': 'JSON FORMAT REQUIRED: Your response must be valid JSON.',
  'deepseek-r1-0528-syn': 'OUTPUT FORMAT: Respond with JSON only. Do NOT include <think> tags.',
};

// Composition function
export function getPromptForModel(modelId: string, isBatch: boolean): string {
  const basePrompt = isBatch ? BATCH_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const override = MODEL_OVERRIDES[modelId];

  if (!override) {
    return basePrompt; // Most models use base prompt
  }

  // Inject override before output format section
  return [
    PROMPT_COMPONENTS.BASE_INSTRUCTIONS,
    PROMPT_COMPONENTS.SCORING_RULES,
    override,  // ← Model-specific instruction
    PROMPT_COMPONENTS.OUTPUT_FORMAT,
  ].join('\n\n');
}
```

**Why this design:**
- **Compositional:** Shared components reduce duplication (prevents Pitfall 6)
- **Explicit mapping:** `MODEL_OVERRIDES[modelId]` prevents partial matching bugs (prevents Pitfall 3)
- **Fallback to base:** If model not in map, returns base prompt (safe for 29 working models)
- **Type-safe:** TypeScript ensures prompts are strings
- **Testable:** Pure function, no side effects

**Dependencies:** None (uses existing `SYSTEM_PROMPT`, `BATCH_SYSTEM_PROMPT` from `prompt.ts`)

---

### Component 2: Fallback Orchestrator

**File:** `src/lib/llm/fallback.ts` (NEW)

**Responsibility:** Wrap API call with fallback-on-error logic

**Interface:**
```typescript
/**
 * Execute prediction with fallback
 * @param primary - Primary provider (usually Synthetic)
 * @param systemPrompt - System prompt to use
 * @param userPrompt - User prompt to use
 * @param attemptedModels - Set of models already attempted (for cycle detection)
 * @returns Tuple of [response, providerUsed]
 * @throws Error if both primary and fallback fail
 */
export async function callWithFallback(
  primary: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  attemptedModels: Set<string> = new Set()
): Promise<[string, LLMProvider]>;

/**
 * Get models with fallbacks configured (for monitoring)
 */
export function getModelsWithFallbacks(): Array<{ primary: string; fallback: string }>;
```

**Architecture:**
```typescript
export async function callWithFallback(
  primary: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  attemptedModels: Set<string> = new Set()
): Promise<[string, LLMProvider]> {
  // Prevent infinite loops
  if (attemptedModels.has(primary.id)) {
    throw new Error(`Cycle detected: ${primary.id} already attempted`);
  }
  if (attemptedModels.size >= 3) {
    throw new Error(`Max fallback depth (3) exceeded`);
  }

  // Add current model to attempted set
  const newAttemptedModels = new Set(attemptedModels);
  newAttemptedModels.add(primary.id);

  try {
    // Try primary provider
    logger.debug({ modelId: primary.id }, 'Attempting primary provider');
    const response = await (primary as any).callAPI(systemPrompt, userPrompt);
    return [response, primary];

  } catch (primaryError) {
    // Check if fallback exists
    const fallback = getFallbackProvider(primary.id);

    if (!fallback) {
      // No fallback configured → throw original error
      throw primaryError;
    }

    // Prevent fallback to already-attempted model
    if (newAttemptedModels.has(fallback.id)) {
      logger.warn({ primary: primary.id, fallback: fallback.id },
        'Fallback already attempted, aborting');
      throw primaryError;
    }

    logger.info({
      primary: primary.id,
      fallback: fallback.id,
      primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
    }, 'Falling back to alternative provider');

    try {
      // Recursive call with updated attempted set
      return await callWithFallback(
        fallback,
        systemPrompt,
        userPrompt,
        newAttemptedModels
      );
    } catch (fallbackError) {
      logger.error({
        primary: primary.id,
        fallback: fallback.id,
        primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      }, 'Both primary and fallback failed');

      // Throw fallback error (most recent failure)
      throw fallbackError;
    }
  }
}
```

**Why this design:**
- **Cycle detection:** `attemptedModels` set prevents infinite loops (prevents Pitfall 2)
- **Depth limit:** Hard cap of 3 attempts prevents runaway fallbacks
- **Transparent return:** Returns tuple `[response, provider]` so caller knows which provider succeeded
- **Recursive:** Supports multi-level fallbacks (fallback's fallback)
- **Error logging:** Comprehensive logging for monitoring fallback frequency

**Dependencies:**
- `getFallbackProvider()` from `src/lib/llm/index.ts` (already exists)
- `MODEL_FALLBACKS` map from `src/lib/llm/index.ts` (already exists)

**Prevents pitfalls:**
- Pitfall 2: Cycle detection and depth limit prevent infinite loops
- Pitfall 4: Re-checks disabled status before fallback (could add to `getFallbackProvider()`)
- Pitfall 7: Could add parameter normalization layer here if needed

---

## Build Order & Dependencies

### Recommended Build Sequence

**Phase 1: Prompt Selection (3-4 hours)**
1. Create `src/lib/llm/prompt-selector.ts`
   - Compositional prompt components
   - Model-specific overrides map
   - `getPromptForModel()` function
2. Add unit tests for prompt selection
3. Modify predictions worker to use prompt selector
4. Test with 2-3 failing models (GLM, Kimi K2.5)
5. Deploy and monitor parse success rates

**Phase 2: Fallback Orchestration (6-8 hours)**
1. Create `src/lib/llm/fallback.ts`
   - `callWithFallback()` with cycle detection
   - Depth limit enforcement
   - Comprehensive logging
2. Validate `MODEL_FALLBACKS` graph (no cycles)
3. Modify predictions worker to use fallback wrapper
4. Enhance `recordModelSuccess()` to track fallback usage
5. Deploy to 2 models (deepseek-r1-0528-syn, kimi-k2-thinking-syn)
6. Monitor fallback frequency for 3 days
7. Expand to remaining Synthetic models

**Phase 3: Dynamic Counts (2-3 hours)**
1. Enhance `getProviderStats()` to filter disabled models
2. Find all hardcoded "35 models" references (grep)
3. Replace with `getProviderStats().active`
4. Update system prompts, UI text, content generation
5. Add cache invalidation to model recovery worker
6. Deploy and verify consistency across pages

**Phase 4: Validation (2-3 hours)**
1. Run integration tests for all 36 models
2. Verify custom prompts used for correct models
3. Test fallback chain (force failures, verify fallback)
4. Validate counts match across all pages
5. Monitor production for 24 hours

**Total estimated effort:** 13-18 hours over 3-4 days

### Dependency Graph

```
┌──────────────────────┐
│ Phase 1: Prompt      │
│ Selection            │
│ (Independent)        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Phase 2: Fallback    │
│ Orchestration        │
│ (Depends on Phase 1) │──→ Needs prompt selector for fallback models
└──────────┬───────────┘
           │
           │  (Parallel)
           │
           ├────────────────────┐
           │                    │
           ▼                    ▼
┌──────────────────┐   ┌──────────────────┐
│ Phase 3: Dynamic │   │ Phase 4:         │
│ Counts           │   │ Validation       │
│ (Independent)    │   │ (Depends on 1-3) │
└──────────────────┘   └──────────────────┘
```

**Critical path:** Phase 1 → Phase 2 → Phase 4
**Parallel work:** Phase 3 can happen anytime (independent of prompts/fallbacks)

---

## Architecture Patterns

### Pattern 1: Prompt Composition Over Duplication

**What:** Build prompts from reusable components instead of copy-paste

**When to use:** When adding model-specific prompts

**Why it works:** Maintains 1 copy of shared sections (scoring rules, output format), only duplicates what's different

**Example:**
```typescript
// GOOD: Compositional (1 source of truth for shared parts)
const SHARED = {
  SCORING: `SCORING SYSTEM (Kicktipp Quota): ...`,
  OUTPUT: `OUTPUT FORMAT: {"home_score": X, "away_score": Y}`,
};

const MODEL_SPECIFIC = {
  'glm-4.7-syn': 'LANGUAGE: English only',
};

function buildPrompt(modelId: string): string {
  return [SHARED.SCORING, MODEL_SPECIFIC[modelId], SHARED.OUTPUT].filter(Boolean).join('\n\n');
}

// BAD: Duplication (maintain scoring system in 7 places)
const GLM_PROMPT = `SCORING SYSTEM (Kicktipp Quota): ... LANGUAGE: English only OUTPUT FORMAT: ...`;
const KIMI_PROMPT = `SCORING SYSTEM (Kicktipp Quota): ... JSON REQUIRED OUTPUT FORMAT: ...`;
```

**Prevents:** Pitfall 6 (Prompt Template Maintenance Sprawl)

---

### Pattern 2: Fallback Transparency

**What:** Fallback function returns which provider was used, not just the response

**When to use:** Any time fallback logic is implemented

**Why it works:** Enables tracking, logging, and metrics without changing core prediction logic

**Example:**
```typescript
// GOOD: Transparent (caller knows which provider succeeded)
const [response, usedProvider] = await callWithFallback(provider, systemPrompt, userPrompt);

if (usedProvider.id !== provider.id) {
  logger.info({ original: provider.id, fallback: usedProvider.id }, 'Fallback used');
  await recordFallbackUsage(provider.id, usedProvider.id);
}
await recordModelSuccess(usedProvider.id); // Record success for actual provider

// BAD: Opaque (can't tell if fallback was used)
const response = await callWithFallback(provider, systemPrompt, userPrompt);
await recordModelSuccess(provider.id); // Wrong! Might be fallback
```

**Prevents:** Pitfall 11 (Fallback Metrics Not Tracked Separately)

---

### Pattern 3: Single Source of Truth for Counts

**What:** One function provides model counts, used everywhere

**When to use:** Replacing hardcoded references to model counts

**Why it works:** Changes propagate automatically when providers added/removed

**Example:**
```typescript
// GOOD: Single source of truth
import { getProviderStats } from '@/lib/llm';

// UI
const stats = getProviderStats();
return <p>{stats.active} models</p>;

// System prompt
const stats = getProviderStats();
const prompt = `You compete against ${stats.active - 1} other models`;

// Content generation
const stats = getProviderStats();
const content = `${correctCount} of ${stats.active} AI models predicted correctly`;

// BAD: Multiple sources (drift inevitable)
const HOMEPAGE_COUNT = 35;
const PROMPT_COUNT = 28; // Why different?
const CONTENT_COUNT = 30; // Why different?
```

**Prevents:** Pitfall 5 (Stale Model Count Cache Inconsistency)

---

### Pattern 4: Defensive Fallback Chain

**What:** Validate fallback chain at startup, enforce limits at runtime

**When to use:** When implementing fallback orchestration

**Why it works:** Catches configuration errors before production, prevents runaway costs

**Example:**
```typescript
// Startup validation
function validateFallbackChain() {
  const graph = buildFallbackGraph(MODEL_FALLBACKS);
  const cycles = detectCycles(graph);

  if (cycles.length > 0) {
    throw new Error(`Fallback cycles detected: ${JSON.stringify(cycles)}`);
  }

  // Validate cost constraints
  for (const [primary, fallback] of Object.entries(MODEL_FALLBACKS)) {
    const primaryProvider = getProviderById(primary);
    const fallbackProvider = getProviderById(fallback);

    if (fallbackProvider.pricing.promptPer1M > primaryProvider.pricing.promptPer1M * 3) {
      logger.warn({
        primary,
        fallback,
        costMultiplier: fallbackProvider.pricing.promptPer1M / primaryProvider.pricing.promptPer1M,
      }, 'Fallback significantly more expensive than primary');
    }
  }
}

// Runtime limits
async function callWithFallback(...) {
  if (attemptedModels.size >= 3) {
    throw new Error('Max fallback depth exceeded');
  }
  // ...
}
```

**Prevents:** Pitfall 1 (Fallback Chain Cost Explosion), Pitfall 2 (Fallback Loop of Death)

---

## Success Criteria

### Integration Strategy

**Minimal Invasive Changes:**
- Add 2 new files (prompt-selector.ts, fallback.ts)
- Modify 1 existing file (predictions.worker.ts)
- Replace 15+ hardcoded references with dynamic queries
- Zero changes to provider classes (BaseLLMProvider, OpenAICompatibleProvider)

**Build Order:**
1. Prompt selection (independent)
2. Fallback orchestration (depends on #1)
3. Dynamic counts (independent, can be parallel)
4. Validation (depends on #1-3)

**Risk Mitigation:**
- Prompt selection has fallback to base prompt (safe for working models)
- Fallback orchestration has cycle detection and depth limits
- Dynamic counts use existing function (just use it consistently)

**Success Criteria:**
- 29 working Together models continue working (>95% success rate maintained)
- 6 disabled Synthetic models re-enabled (success rate >90%)
- Model counts consistent across all pages (0 discrepancies)
- Fallback frequency <5% (most models work without fallback)
- Zero fallback loops or cost explosions

**Key Principle:** Layer new functionality around existing abstractions, don't rewrite core logic.

---

**Metadata:**
- **Confidence:** HIGH (architecture based on direct codebase analysis)
- **Researched:** 2026-02-05
- **Valid until:** 2026-08-05 (architecture patterns stable)
- **Review triggers:** New provider added, prediction pipeline rewrite, provider API changes
