# Quick Task 056: Fix model list to match exact 20 active models + MiniMax M2.5

## Goal
Fix the model sync system so all 21 code-defined models are active (not archived) and update OpenRouter model IDs to match verified URLs.

## Root Cause Analysis

### Bug 1: Chicken-and-egg archive loop
`syncModelsToDatabase()` calls `getActiveProviders()` which filters out archived models. So if a model gets archived in DB, it's excluded from sync, and can never be un-archived. The fix: sync should iterate over ALL code providers (`OPENROUTER_PROVIDERS`), not filtered `getActiveProviders()`.

### Bug 2: Model ID mismatches
Some OpenRouter model IDs in code don't match the verified URLs:
- `qwen/qwen3-235b` → should be `qwen/qwen3-235b-a22b`
- `mistralai/mistral-small-3.2-24b-instruct` → should be `mistralai/mistral-small-3.2-24b-instruct-2506`
- `meta-llama/llama-4-scout-17b-16e-instruct` → should be `meta-llama/llama-4-scout`

Note: `arcee-ai/trinity-large-preview:free` — the `:free` suffix is intentional for OpenRouter free tier routing. Keep as-is.

## Tasks

### Task 1: Fix syncModelsToDatabase to use ALL_PROVIDERS instead of getActiveProviders
**File:** `src/lib/db/sync-models.ts`
- Replace `getActiveProviders()` call with direct import of `OPENROUTER_PROVIDERS` (or `ALL_PROVIDERS`)
- This ensures ALL code-defined models are synced with `active: true, archived: false`
- The sync should be the authoritative source — if a model is in code, it should be active

### Task 2: Update OpenRouter model IDs to match verified URLs
**File:** `src/lib/llm/providers/openrouter.ts`
- Update Qwen3 235B model ID: `qwen/qwen3-235b` → `qwen/qwen3-235b-a22b`
- Update Mistral Small 3.2 model ID: `mistralai/mistral-small-3.2-24b-instruct` → `mistralai/mistral-small-3.2-24b-instruct-2506`
- Update Llama 4 Scout model ID: `meta-llama/llama-4-scout-17b-16e-instruct` → `meta-llama/llama-4-scout`

### Task 3: Update display names and references
**File:** `src/lib/llm/providers/openrouter.ts`
- Update Qwen3 235B display name to include A22B: `Qwen3 235B A22B (OpenRouter)`

**File:** `src/app/llms-full.txt/route.ts`
- Update model ID references in the text route

### Task 4: Verify model count consistency
- Confirm `OPENROUTER_PROVIDERS` array has exactly 21 entries
- Confirm `MODEL_PROVIDER_ROUTES` has exactly 21 entries
- Confirm test fixtures match if applicable

## Commit Strategy
Single atomic commit covering all changes.
