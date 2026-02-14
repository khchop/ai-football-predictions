# Quick Task 056: Fix model list to match exact 20 active models + MiniMax M2.5

## What Changed

### Bug Fix: Chicken-and-egg archive loop in syncModelsToDatabase
**File:** `src/lib/db/sync-models.ts`

`syncModelsToDatabase()` called `getActiveProviders()` which queries the DB for archived model IDs and filters them out. This meant once a model was archived in DB, the sync would skip it, and it could never be un-archived. Fixed by using `ALL_PROVIDERS` (the code-defined array) directly instead of the DB-filtered `getActiveProviders()`.

### Model ID Updates to match verified OpenRouter URLs
**File:** `src/lib/llm/providers/openrouter.ts`

| Model | Old ID | New ID |
|-------|--------|--------|
| Qwen3 235B | `qwen/qwen3-235b` | `qwen/qwen3-235b-a22b` |
| Mistral Small 3.2 | `mistralai/mistral-small-3.2-24b-instruct` | `mistralai/mistral-small-3.2-24b-instruct-2506` |
| Llama 4 Scout | `meta-llama/llama-4-scout-17b-16e-instruct` | `meta-llama/llama-4-scout` |

### Display name update
- Qwen3 235B → Qwen3 235B A22B (reflects actual model variant)

### llms-full.txt updates
**File:** `src/app/llms-full.txt/route.ts`
- Updated all 3 model IDs to match new values

## Result
On next deploy/restart, `syncModelsToDatabase()` will iterate ALL 21 code-defined models and force-set `active: true, archived: false` for each, fixing the archived GLM-4.7 and any other incorrectly archived models.
