---
phase: quick-051
plan: 01
subsystem: llm
tags: [model-addition, openrouter, reasoning-model]
dependency_graph:
  requires: []
  provides:
    - minimax-m2.5-or provider (budget tier, reasoning model)
  affects:
    - src/lib/llm/providers/openrouter.ts
    - src/lib/llm/index.ts
    - test fixtures and model count assertions
tech_stack:
  added:
    - MiniMax M2.5 via OpenRouter (minimax/minimax-m2.5)
  patterns:
    - THINKING_STRIPPED + STRIP_THINKING_TAGS for mandatory thinking tags
    - 120s timeout for reasoning models
key_files:
  created: []
  modified:
    - src/lib/llm/providers/openrouter.ts
    - src/lib/llm/index.ts
    - src/__tests__/fixtures/test-data.ts
    - src/__tests__/integration/models/all-models.test.ts
    - scripts/validate-all-models.ts
decisions:
  - decision: Use THINKING_STRIPPED + STRIP_THINKING_TAGS (not EXTRACT_JSON like M2.1)
    rationale: MiniMax M2.5 is a reasoning model with mandatory <think> tags, same pattern as Qwen3 235B Thinking and DeepSeek R1-0528
    alternatives: Could have used EXTRACT_JSON like M2.1, but STRIP_THINKING_TAGS is the correct pattern for thinking models
  - decision: Set supportsJsonMode to false
    rationale: Matches M2.1 behavior; safer to extract JSON after thinking tags stripped rather than rely on native JSON mode
  - decision: Budget tier at $0.30/$1.20 per 1M tokens
    rationale: Pricing from OpenRouter API spec, comparable to other budget reasoning models
metrics:
  duration_seconds: 257
  tasks_completed: 2
  files_modified: 5
  commits: 2
  completed_date: 2026-02-14T13:24:47Z
---

# Quick Task 051: Add MiniMax M2.5 as New Model

**One-liner:** Added MiniMax M2.5 as 21st active model with THINKING_STRIPPED + STRIP_THINKING_TAGS config for reasoning capabilities.

## Overview

Added MiniMax M2.5 as the 21st model in the OpenRouter provider array. This is a net new addition (no model substitution), expanding the platform's reasoning model coverage. MiniMax M2.5 uses mandatory `<think>` tags for its reasoning process, requiring the same configuration pattern as Qwen3 235B Thinking and DeepSeek R1-0528.

## Tasks Completed

### Task 1: Add MiniMax M2.5 provider and route
**Commit:** a97e424

- Added `MiniMaxM25_OR` provider constant with:
  - Model ID: `minimax/minimax-m2.5`
  - Provider ID: `minimax-m2.5-or`
  - Tier: budget
  - Pricing: $0.30 prompt / $1.20 completion per 1M tokens
  - Config: `THINKING_STRIPPED` + `STRIP_THINKING_TAGS` + 120s timeout
  - `supportsJsonMode: false` (matches M2.1, safer extraction after thinking tags stripped)
- Added to `OPENROUTER_PROVIDERS` array (now 21 models total)
- Updated MiniMax section comment from "1 model" to "2 models"
- Updated header comment from "20 models" to "21 models"
- Added route `'minimax-m2.5': ['minimax-m2.5-or']` to `MODEL_PROVIDER_ROUTES`
- Updated index.ts comment from "20 active models" to "21 active models"

**Files modified:**
- `src/lib/llm/providers/openrouter.ts`
- `src/lib/llm/index.ts`

### Task 2: Update test fixtures and model count assertions
**Commit:** 95fba84

- Added `'minimax-m2.5-or'` to `REASONING_MODEL_IDS` in `test-data.ts` (thinking model classification)
- Added `'minimax-m2.5-or'` to `REASONING_MODEL_IDS` in `validate-all-models.ts` (consistency)
- Updated model count assertion in `all-models.test.ts` from 23 to 21 (correcting stale value)

**Files modified:**
- `src/__tests__/fixtures/test-data.ts`
- `src/__tests__/integration/models/all-models.test.ts`
- `scripts/validate-all-models.ts`

## Verification Results

✅ **TypeScript compilation:** No LLM-related errors (pre-existing test config errors unrelated to changes)
✅ **Provider count:** 21 providers defined, 21 in OPENROUTER_PROVIDERS array
✅ **Route exists:** `minimax-m2.5` → `['minimax-m2.5-or']` in MODEL_PROVIDER_ROUTES
✅ **Reasoning classification:** `minimax-m2.5-or` in both REASONING_MODEL_IDS sets
✅ **Model count test:** Updated to expect 21 models

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

**MiniMax M2.5 Configuration:**
```typescript
export const MiniMaxM25_OR = new OpenRouterProvider(
  'minimax-m2.5-or',
  'openrouter',
  'minimax/minimax-m2.5',
  'MiniMax M2.5 (OpenRouter)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 1.20 },
  false,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
    supportsJsonMode: false,
  }
);
```

**Key differences from MiniMax M2.1:**
- M2.5 uses `THINKING_STRIPPED` + `STRIP_THINKING_TAGS` (reasoning model)
- M2.1 uses `EXTRACT_JSON` (standard JSON extraction)
- M2.5 has 120s timeout (reasoning overhead)
- M2.1 has default 60s timeout

**Model count progression:**
- Before: 20 active models
- After: 21 active models
- Architecture: Single OpenRouter provider for all models

## Impact

**Positive:**
- Expanded reasoning model coverage with MiniMax's latest thinking model
- Consistent thinking tag handling across reasoning models
- Clear separation between standard (M2.1) and reasoning (M2.5) MiniMax models

**Risks:**
- None identified - net new addition with established config patterns

## Next Steps

- Monitor M2.5 performance in production predictions
- Track cost vs. accuracy compared to M2.1 and other budget reasoning models
- Consider eventual evaluation for archive status if performance doesn't justify cost

## Self-Check: PASSED

**Created files:** None (modification-only task)

**Modified files:**
- ✅ `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/providers/openrouter.ts` exists
- ✅ `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/index.ts` exists
- ✅ `/Users/pieterbos/Documents/bettingsoccer/src/__tests__/fixtures/test-data.ts` exists
- ✅ `/Users/pieterbos/Documents/bettingsoccer/src/__tests__/integration/models/all-models.test.ts` exists
- ✅ `/Users/pieterbos/Documents/bettingsoccer/scripts/validate-all-models.ts` exists

**Commits:**
- ✅ a97e424 exists (`feat(quick-051): add MiniMax M2.5 provider and route`)
- ✅ 95fba84 exists (`test(quick-051): update test fixtures for MiniMax M2.5`)

All claims verified.
