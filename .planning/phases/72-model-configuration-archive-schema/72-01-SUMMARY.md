---
phase: 72
plan: 01
subsystem: model-lifecycle
tags: [schema, migration, openrouter, model-providers]
dependency-graph:
  requires: []
  provides:
    - archived-column
    - new-model-providers
  affects:
    - models-table-schema
    - openrouter-provider-registry
tech-stack:
  added: []
  patterns: [drizzle-schema, openrouter-api]
key-files:
  created:
    - migrations/006_add_archived_column.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/llm/providers/openrouter.ts
decisions: []
metrics:
  duration: 117
  completed: 2026-02-12
---

# Phase 72 Plan 01: Model Configuration & Archive Schema Summary

**One-liner:** Added archived column to models schema with migration and defined 13 new OpenRouter model providers (GLM-5, DeepSeek V3.2/R1-0528, Devstral Small, Qwen3 30B, GPT-OSS 20B, Step 3.5, Mistral Small 3.2, Gemma 3 27B/12B, Trinity Large, Phi-4, Llama 4 Scout) plus MiniMax M2.1 pricing update.

## Objective

Add database archive infrastructure and define 14 new OpenRouter model providers (13 net new after skipping unavailable Nemotron).

## Tasks Completed

### Task 1: Add archived column to models schema and create migration
**Commit:** 6187113
**Files:** src/lib/db/schema.ts, migrations/006_add_archived_column.sql

Added `archived` boolean column (default false) to models table with index for query performance. Created migration SQL file 006_add_archived_column.sql. This provides the foundation for Phase 73 model lifecycle management where models can be archived while retaining historical data.

**Changes:**
- Added `archived: boolean('archived').default(false)` after `autoDisabled` field
- Added `index('idx_models_archived').on(table.archived)` for query optimization
- Created migration with `IF NOT EXISTS` guards for safe execution

### Task 2: Define 13 new model providers and update MiniMax pricing
**Commit:** 5fce8cd
**Files:** src/lib/llm/providers/openrouter.ts

Added 13 new OpenRouterProvider instances with correct OpenRouter model IDs, pricing, and prompt configurations:

**New Providers (13):**
1. GLM-5 (premium, reasoning) - `z-ai/glm-5` - $0.80/$2.56 per 1M - ENGLISH_ENFORCED + EXTRACT_JSON
2. DeepSeek V3.2 (budget) - `deepseek/deepseek-v3.2` - $0.25/$0.38 per 1M
3. DeepSeek R1-0528 (premium, reasoning) - `deepseek/deepseek-r1-0528` - $0.40/$1.75 per 1M - THINKING_STRIPPED + STRIP_THINKING_TAGS
4. Devstral Small (budget) - `mistralai/devstral-small` - $0.10/$0.30 per 1M
5. Qwen3 30B A3B (ultra-budget, MoE) - `qwen/qwen3-30b-a3b` - $0.06/$0.22 per 1M
6. GPT-OSS 20B (ultra-budget) - `openai/gpt-oss-20b` - $0.03/$0.14 per 1M - JSON_STRICT + EXTRACT_JSON
7. Step 3.5 Flash (budget, MoE) - `stepfun/step-3.5-flash` - $0.10/$0.30 per 1M
8. Mistral Small 3.2 24B (ultra-budget) - `mistralai/mistral-small-3.2-24b-instruct` - $0.06/$0.18 per 1M
9. Gemma 3 27B (ultra-budget) - `google/gemma-3-27b-it` - $0.04/$0.15 per 1M
10. Trinity Large Preview (free tier, MoE) - `arcee-ai/trinity-large-preview:free` - $0.00/$0.00 per 1M
11. Phi-4 (ultra-budget, 14B) - `microsoft/phi-4` - $0.06/$0.14 per 1M
12. Llama 4 Scout (ultra-budget, MoE) - `meta-llama/llama-4-scout-17b-16e-instruct` - $0.08/$0.30 per 1M
13. Gemma 3 12B (ultra-budget) - `google/gemma-3-12b-it` - $0.03/$0.10 per 1M

**Updated Existing Provider:**
- MiniMax M2.1: Updated pricing from $0.35/$0.70 to $0.27/$0.95 per 1M tokens

**Note:** Nemotron 3 Nano 30B A3B was skipped (returns 404 on OpenRouter). Kept existing qwen3-235b-thinking-or as 20th model to maintain target count.

**Total providers:** 31 (18 existing + 13 new)

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] ARCH-01 complete: models schema has `archived` boolean column with default false and migration file exists
- [x] MDL-02 partially complete: 13 new model instances defined (Nemotron 30B unavailable as noted in plan), MiniMax updated
- [x] All new providers have correct OpenRouter model IDs
- [x] TypeScript compiles without errors in modified files

## Self-Check

Verifying all claimed files and commits exist:

**Files created:**
- migrations/006_add_archived_column.sql: ✓ EXISTS
- No other files claimed as created

**Files modified:**
- src/lib/db/schema.ts: ✓ EXISTS
- src/lib/llm/providers/openrouter.ts: ✓ EXISTS

**Commits:**
- 6187113 (Task 1): ✓ EXISTS
- 5fce8cd (Task 2): ✓ EXISTS

**Self-Check: PASSED**

All claimed files exist and all commits are in git history.
