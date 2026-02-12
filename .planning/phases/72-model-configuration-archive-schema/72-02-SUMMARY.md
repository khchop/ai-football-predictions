---
phase: 72
plan: 02
subsystem: model-lifecycle
tags: [model-configuration, openrouter, provider-routes, validation]
dependency-graph:
  requires:
    - archived-column
    - new-model-providers
  provides:
    - 20-model-configuration
    - validated-provider-routes
  affects:
    - openrouter-provider-array
    - model-provider-routes
tech-stack:
  added: []
  patterns: [provider-routing, module-validation]
key-files:
  created: []
  modified:
    - src/lib/llm/providers/openrouter.ts
    - src/lib/llm/index.ts
decisions:
  - title: "Kept Nemotron Nano 9B v2 as 20th model"
    rationale: "Nemotron 3 Nano 30B A3B unavailable on OpenRouter (404). Kept existing Nemotron Nano 9B v2 (ultra-budget, $0.04/$0.16) as substitute to maintain 20-model target."
    alternatives: ["Keep Llama 3.1 8B", "Drop to 19 models"]
    impact: "Maintains target model count while staying within ultra-budget tier"
metrics:
  duration: 343
  completed: 2026-02-12
---

# Phase 72 Plan 02: Finalize 20-Model Configuration Summary

**One-liner:** Finalized 20-model OpenRouter configuration by updating OPENROUTER_PROVIDERS array (removed 11 old models, kept 6, included 14 new/updated) and MODEL_PROVIDER_ROUTES map (replaced 17 old routes with 20 new entries), with validation passing at module load time.

## Objective

Complete MDL-01 (20 active models), MDL-03 (archive old models), and MDL-05 (validation passes) by assembling the final OPENROUTER_PROVIDERS array and MODEL_PROVIDER_ROUTES map with exactly 20 models.

## Tasks Completed

### Task 1: Update OPENROUTER_PROVIDERS array and fix GLM-4.7 bug
**Commit:** 3ce87c1
**Files:** src/lib/llm/providers/openrouter.ts

Rebuilt OPENROUTER_PROVIDERS array to exactly 20 models, organized by family:
- **DeepSeek (2):** V3.2 (NEW), R1-0528 (NEW)
- **Moonshot Kimi (1):** K2.5 (KEPT)
- **Qwen (3):** 235B (KEPT), 235B Thinking (KEPT), 30B A3B (NEW)
- **Meta Llama (2):** Maverick (KEPT), Scout (NEW)
- **OpenAI OSS (1):** 20B (NEW)
- **Deep Cogito (1):** 671B (KEPT)
- **Mistral (2):** Devstral Small (NEW), Small 3.2 24B (NEW)
- **StepFun (1):** Step 3.5 Flash (NEW)
- **NVIDIA (1):** Nemotron Nano 9B v2 (KEPT)
- **Google (2):** Gemma 3 27B (NEW), Gemma 3 12B (NEW)
- **Z-AI GLM (1):** GLM-5 (NEW)
- **MiniMax (1):** M2.1 (UPDATED)
- **Arcee AI (1):** Trinity Large Preview (NEW)
- **Microsoft (1):** Phi-4 (NEW)

**Removed 11 old model instances:**
- DeepSeekR1_OR (replaced by R1-0528)
- DeepSeekV31_OR (replaced by V3.2)
- Llama31_8B_OR (replaced by Scout)
- Llama32_3B_OR (small, removed)
- Qwen25_7B_OR (replaced by Qwen3 30B)
- GPTOSS120B_OR (replaced by 20B)
- Ministral3_14B_OR (replaced by Mistral Small 3.2)
- MistralSmall3_24B_OR (replaced by 3.2 version)
- Gemma3nE4B_OR (replaced by Gemma 3 27B/12B)
- GLM47Flash_OR (replaced by GLM-5)
- RNJ1Instruct_OR (removed)

**GLM-4.7 bug:** Moot - model replaced by GLM-5 with correct `-or` suffix in provider ID.

**Total composition:** 6 kept + 1 updated + 13 new = 20 models

### Task 2: Update MODEL_PROVIDER_ROUTES and validate configuration
**Commit:** 985b286
**Files:** src/lib/llm/index.ts

Replaced entire MODEL_PROVIDER_ROUTES object with 20 entries matching the 20 active models:
- Updated provider ID convention comment: removed stale references to Together AI and Synthetic providers
- Changed comment from "21 active models" to "20 active models"
- Removed 10 old route entries for archived models
- Added 13 new route entries for new models + updated routes for DeepSeek/Llama families
- Kept nemotron-nano-9b-v2 route as 20th entry

**Validation:**
- `validateProviderRoutes()` executed successfully at module load time
- All 20 provider IDs in routes match OPENROUTER_PROVIDERS array
- TypeScript compilation passed for modified files
- Module import test passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added Nemotron Nano 9B v2 as 20th model**
- **Found during:** Task 1 - building OPENROUTER_PROVIDERS array
- **Issue:** Plan's explicit model list shows 19 models (Nemotron 3 Nano 30B A3B unavailable per 72-01), but must_haves require "exactly 20 active model instances"
- **Fix:** Kept existing Nemotron Nano 9B v2 (ultra-budget, $0.04/$0.16 per 1M tokens) as substitute for unavailable Nemotron 30B to reach target count
- **Files modified:** src/lib/llm/providers/openrouter.ts (added const definition and array entry)
- **Commit:** 3ce87c1 (included in Task 1)
- **Rationale:** Plan required exactly 20 models per must_haves and success criteria. Nemotron Nano 9B v2 is already available on OpenRouter (confirmed in old array), ultra-budget tier, and maintains NVIDIA representation in model family distribution.

## Success Criteria

- [x] MDL-01 complete: Exactly 20 models in OPENROUTER_PROVIDERS array
- [x] MDL-03 complete: 11 old/archived models removed from OPENROUTER_PROVIDERS
- [x] MDL-04 resolved: GLM-4.7 route bug moot (model replaced by GLM-5 with correct ID)
- [x] MDL-05 complete: validateProviderRoutes() passes without errors at module load time
- [x] Exactly 20 entries in MODEL_PROVIDER_ROUTES
- [x] Every route entry references a valid provider ID in OPENROUTER_PROVIDERS
- [x] TypeScript compilation succeeds (no errors in modified files)
- [x] Module loads successfully and validation executes

## Self-Check

Verifying all claimed files and commits exist:

**Files created:**
- None claimed

**Files modified:**
- src/lib/llm/providers/openrouter.ts: ✓ EXISTS
- src/lib/llm/index.ts: ✓ EXISTS

**Commits:**
- 3ce87c1 (Task 1): ✓ EXISTS
- 985b286 (Task 2): ✓ EXISTS

**Verification checks:**
- Model count in OPENROUTER_PROVIDERS array: ✓ 20 models
- Model count in MODEL_PROVIDER_ROUTES: ✓ 20 entries
- TypeScript errors in modified files: ✓ 0 errors
- Module validation passes: ✓ PASS

**Self-Check: PASSED**

All claimed files exist, all commits are in git history, and all verification checks pass.
