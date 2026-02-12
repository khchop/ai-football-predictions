---
phase: 72-model-configuration-archive-schema
verified: 2026-02-12T21:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 72: Model Configuration & Archive Schema Verification Report

**Phase Goal:** Configure 20 active OpenRouter models with correct IDs/pricing and add database archive infrastructure

**Verified:** 2026-02-12T21:00:00Z

**Status:** passed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System defines exactly 20 active models with correct OpenRouter model IDs and pricing | ✓ VERIFIED | OPENROUTER_PROVIDERS array contains exactly 20 models with valid OpenRouter API model IDs |
| 2 | New models are defined with appropriate prompt variants and timeouts | ✓ VERIFIED | 13 new models defined with correct configs (GLM-5, DeepSeek V3.2/R1-0528, Devstral Small, Qwen3 30B, GPT-OSS 20B, Step 3.5, Mistral Small 3.2, Gemma 3 27B/12B, Trinity Large, Phi-4, Llama 4 Scout) |
| 3 | GLM-4.7 route registration bug is fixed | ✓ VERIFIED | GLM-4.7 replaced by GLM-5 with correct `-or` suffix and route entry |
| 4 | Models table has archived boolean column with default false | ✓ VERIFIED | Schema defines `archived: boolean('archived').default(false)` at line 80 with index |
| 5 | Database migration for archived column exists | ✓ VERIFIED | migrations/006_add_archived_column.sql contains valid ALTER TABLE and CREATE INDEX statements |
| 6 | MODEL_PROVIDER_ROUTES has exactly 20 entries | ✓ VERIFIED | MODEL_PROVIDER_ROUTES contains 20 route entries matching 20 active models |
| 7 | All route provider IDs reference valid providers | ✓ VERIFIED | All 20 provider IDs in routes exist in OPENROUTER_PROVIDERS |
| 8 | Old/archived models removed from active configuration | ✓ VERIFIED | 11 old models removed (DeepSeekR1, DeepSeekV31, Llama31_8B, Llama32_3B, Qwen25_7B, GPTOSS120B, Ministral3_14B, MistralSmall3_24B, Gemma3nE4B, GLM47Flash, RNJ1Instruct) |
| 9 | MiniMax M2.1 pricing updated | ✓ VERIFIED | Pricing changed from $0.35/$0.70 to $0.27/$0.95 per 1M tokens |
| 10 | Model validation passes at module load time | ✓ VERIFIED | validateProviderRoutes() executed successfully during build without errors |
| 11 | TypeScript compilation succeeds | ✓ VERIFIED | npx tsc --noEmit --skipLibCheck passed for all modified files |

**Score:** 11/11 truths verified (100%)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | archived column definition | ✓ VERIFIED | Line 80: `archived: boolean('archived').default(false)` |
| `src/lib/db/schema.ts` | archived index definition | ✓ VERIFIED | Line 83: `index('idx_models_archived').on(table.archived)` |
| `migrations/006_add_archived_column.sql` | Migration SQL file | ✓ VERIFIED | 4 lines with ALTER TABLE and CREATE INDEX with IF NOT EXISTS guards |
| `src/lib/llm/providers/openrouter.ts` | 20 OpenRouterProvider instances | ✓ VERIFIED | Exactly 20 instances defined with correct IDs and OpenRouter model paths |
| `src/lib/llm/providers/openrouter.ts` | OPENROUTER_PROVIDERS array | ✓ VERIFIED | Array contains exactly 20 models organized by family |
| `src/lib/llm/index.ts` | MODEL_PROVIDER_ROUTES with 20 entries | ✓ VERIFIED | 20 route entries (lines 27-75) |
| `src/lib/llm/index.ts` | validateProviderRoutes() call | ✓ VERIFIED | Function defined and executes at module load |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| schema.ts | migration SQL | archived column DDL match | ✓ WIRED | Both define `archived BOOLEAN DEFAULT false` |
| OPENROUTER_PROVIDERS | MODEL_PROVIDER_ROUTES | provider IDs | ✓ WIRED | All 20 provider IDs in routes exist in OPENROUTER_PROVIDERS |
| MODEL_PROVIDER_ROUTES | validateProviderRoutes() | module load validation | ✓ WIRED | Validation executes and passes without errors |
| New providers | OpenRouter API | model field matches API IDs | ✓ WIRED | All model fields use valid OpenRouter API model IDs (e.g., z-ai/glm-5, deepseek/deepseek-v3.2) |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MDL-01: 20 active models configured | ✓ SATISFIED | OPENROUTER_PROVIDERS array has exactly 20 models |
| MDL-02: New models defined with configs | ✓ SATISFIED | 13 new models defined with appropriate prompt variants and timeouts (Nemotron 30B unavailable, Nemotron 9B v2 kept as substitute) |
| MDL-03: Old models archived | ✓ SATISFIED | 11 old models removed from OPENROUTER_PROVIDERS array |
| MDL-04: GLM-4.7 route bug fixed | ✓ SATISFIED | GLM-4.7 replaced by GLM-5 with correct `-or` suffix |
| MDL-05: Validation passes | ✓ SATISFIED | validateProviderRoutes() passes at module load time |
| ARCH-01: archived column added | ✓ SATISFIED | Schema has `archived` boolean column with default false and migration file exists |

**Coverage:** 6/6 requirements satisfied (100%)

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholders, empty implementations, or console.log-only functions found in modified files.

### Commits Verified

All commits from SUMMARY.md exist in git history:

- ✓ 6187113 - feat(72-01): add archived column to models schema (2 files: schema.ts, migration SQL)
- ✓ 5fce8cd - feat(72-01): add 13 new OpenRouter model providers (1 file: openrouter.ts)
- ✓ 3ce87c1 - feat(72-02): update OPENROUTER_PROVIDERS to exactly 20 models (1 file: openrouter.ts, -203 lines +56 lines)
- ✓ 985b286 - feat(72-02): update MODEL_PROVIDER_ROUTES to 20 entries (1 file: index.ts, -20 lines +45 lines)

### Model Configuration Details

**New Models (13):**
1. GLM-5 (premium) - z-ai/glm-5 - $0.80/$2.56 - ENGLISH_ENFORCED + EXTRACT_JSON
2. DeepSeek V3.2 (budget) - deepseek/deepseek-v3.2 - $0.25/$0.38
3. DeepSeek R1-0528 (premium) - deepseek/deepseek-r1-0528 - $0.40/$1.75 - THINKING_STRIPPED
4. Devstral Small (budget) - mistralai/devstral-small - $0.10/$0.30
5. Qwen3 30B A3B (ultra-budget) - qwen/qwen3-30b-a3b - $0.06/$0.22
6. GPT-OSS 20B (ultra-budget) - openai/gpt-oss-20b - $0.03/$0.14 - JSON_STRICT
7. Step 3.5 Flash (budget) - stepfun/step-3.5-flash - $0.10/$0.30
8. Mistral Small 3.2 24B (ultra-budget) - mistralai/mistral-small-3.2-24b-instruct - $0.06/$0.18
9. Gemma 3 27B (ultra-budget) - google/gemma-3-27b-it - $0.04/$0.15
10. Trinity Large Preview (free) - arcee-ai/trinity-large-preview:free - $0.00/$0.00
11. Phi-4 (ultra-budget) - microsoft/phi-4 - $0.06/$0.14
12. Llama 4 Scout (ultra-budget) - meta-llama/llama-4-scout-17b-16e-instruct - $0.08/$0.30
13. Gemma 3 12B (ultra-budget) - google/gemma-3-12b-it - $0.03/$0.10

**Updated Models (1):**
- MiniMax M2.1: Pricing updated from $0.35/$0.70 to $0.27/$0.95

**Kept Models (6):**
- Kimi K2.5, Qwen3 235B, Qwen3 235B Thinking, Llama 4 Maverick, Cogito 671B, Nemotron Nano 9B v2

**Removed Models (11):**
- DeepSeekR1, DeepSeekV31, Llama31_8B, Llama32_3B, Qwen25_7B, GPTOSS120B, Ministral3_14B, MistralSmall3_24B, Gemma3nE4B, GLM47Flash, RNJ1Instruct

**Note:** Nemotron 3 Nano 30B A3B was unavailable on OpenRouter (returns 404). Nemotron Nano 9B v2 kept as substitute to maintain 20-model target.

---

## Verification Summary

Phase 72 successfully achieves its goal. The system now:

1. **Defines exactly 20 active OpenRouter models** with correct model IDs, pricing, and prompt configurations
2. **Includes all 13 new models** (or 14 attempted, with 1 unavailable) with appropriate timeouts and prompt variants
3. **Fixes the GLM-4.7 route bug** by replacing it with GLM-5 using correct naming conventions
4. **Adds archive infrastructure** with `archived` boolean column in schema and migration SQL
5. **Passes module validation** with validateProviderRoutes() executing successfully at load time
6. **Maintains wiring integrity** with all 20 routes correctly referencing provider IDs

All 6 requirements (MDL-01 through MDL-05, ARCH-01) are satisfied. No gaps, no anti-patterns, all artifacts substantive and wired. TypeScript compilation succeeds. Ready to proceed to Phase 73.

---

_Verified: 2026-02-12T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
