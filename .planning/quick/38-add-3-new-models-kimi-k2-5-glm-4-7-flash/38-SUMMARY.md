---
phase: quick-38
plan: 01
type: summary
tags:
  - models
  - providers
  - kimi
  - glm
  - deepseek
  - openrouter
completed: 2026-02-10
duration: ~5min
---

# Quick Task 38: Add 3 New Models Summary

**One-liner:** Added Kimi K2.5 as 3-provider model (Together → Synthetic → OR) and 2 OR-only models (GLM 4.7 Flash, DeepSeek R1-0528)

## What Was Done

### Task 1: Kimi K2.5 as 3-Provider Model
- **Together AI:** Added `KimiK25Provider` (model #30)
  - Model: `moonshotai/Kimi-K2.5`
  - Tier: budget
  - Pricing: $1.00/$3.00 per 1M tokens
  - Updated Moonshot section comment to "3 models"

- **Synthetic:** Added `KimiK25_SynProvider` (model #11)
  - Model: `hf:moonshotai/Kimi-K2.5`
  - New "MOONSHOT (1)" section created
  - Same pricing as Together

- **OpenRouter:** Added `KimiK25_OR` (model #36 → 38 after Task 2)
  - Model: `moonshotai/kimi-k2.5`
  - Pricing: $0.45/$2.25 per 1M tokens (45% cheaper than primary)

- **Route:** Added 3-provider fallback chain
  - `kimi-k2.5: ['kimi-k2.5', 'kimi-k2.5-syn', 'kimi-k2.5-or']`
  - Together (primary) → Synthetic (2nd) → OpenRouter (3rd fallback)

### Task 2: OR-Only Primary Models
- **GLM 4.7 Flash:** Budget tier, ultra-cheap
  - Model: `z-ai/glm-4.7-flash`
  - Pricing: $0.06/$0.40 per 1M tokens
  - Config: `ENGLISH_ENFORCED + EXTRACT_JSON` (matches GLM 4.7)
  - Timeout: 60s

- **DeepSeek R1-0528:** Budget reasoning model
  - Model: `deepseek/deepseek-r1-0528`
  - Pricing: $0.40/$1.75 per 1M tokens
  - Config: `THINKING_STRIPPED + STRIP_THINKING_TAGS` (matches DeepSeek R1)
  - Timeout: 120s (reasoning needs extended time)

**No routes needed:** These are standalone OR primary models. The `getActiveProviders()` function automatically includes them because they don't appear in any fallback position.

### Task 3: Build Verification
- Ran `npx next build --webpack`
- No TypeScript errors
- Provider route validation passed: 36 routes
- All provider IDs resolved correctly
- Kimi K2.5 route validated: `['kimi-k2.5', 'kimi-k2.5-syn', 'kimi-k2.5-or']`

## Model Count Updates

**Before:** 42 total models
- Together AI: 29 models
- Synthetic: 10 exclusive models
- OpenRouter: 35 models (3 primary + 32 fallbacks)

**After:** 44 total models
- Together AI: 30 models (+1 Kimi K2.5)
- Synthetic: 11 models (+1 Kimi K2.5)
- OpenRouter: 38 models (+3: Kimi K2.5 fallback, GLM 4.7 Flash, DeepSeek R1-0528)

**Routes:** 36 fallback routes (1 new 3-provider route)

**Active models (via getActiveProviders):**
- Together: 30 (if TOGETHER_API_KEY set)
- Synthetic: 11 (if SYNTHETIC_API_KEY set)
- OpenRouter primaries: 5 (if OPENROUTER_API_KEY set)
  - DeepSeekR1_OR
  - Qwen3_235B_OR
  - Llama4Scout_OR
  - GLM47Flash_OR (new)
  - DeepSeekR1_0528_OR (new)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Kimi K2.5 Prompt Configuration
- Uses default prompt variant (no special handling needed)
- Standard JSON response mode
- Default timeout (60s)
- No response handler overrides

### OR-Only Model Configurations
**GLM 4.7 Flash:**
- Inherits GLM 4.7's configuration to ensure consistency
- `ENGLISH_ENFORCED` prevents Chinese text output
- `EXTRACT_JSON` handles potential JSON formatting issues
- Same timeout as other GLM models (60s)

**DeepSeek R1-0528:**
- Inherits DeepSeek R1's configuration for reasoning models
- `THINKING_STRIPPED` removes thinking tags from prompt
- `STRIP_THINKING_TAGS` cleans up response
- Extended 120s timeout for chain-of-thought processing

### Provider Counts
Updated all count comments across files:
- `together.ts`: 29 → 30 models
- `synthetic.ts`: 10 → 11 models
- `openrouter.ts`: 35 → 38 models
- `index.ts`: 39 → 41 total non-conditional providers

### Route Validation
The new Kimi K2.5 route successfully validated:
- All 3 provider IDs exist in their respective arrays
- No duplicate providers in the route
- Max depth not exceeded (3 providers)
- Route logged in build output: `"Provider routes validated successfully"`

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `src/lib/llm/providers/together.ts` | Added KimiK25Provider, updated counts, renumbered models 5-30 | +46/-42 |
| `src/lib/llm/providers/synthetic.ts` | Added KimiK25_SynProvider, new Moonshot section, updated counts | +24/-8 |
| `src/lib/llm/providers/openrouter.ts` | Added KimiK25_OR, GLM47Flash_OR, DeepSeekR1_0528_OR, renumbered 20-36 | +71/-45 |
| `src/lib/llm/index.ts` | Added kimi-k2.5 route, updated ALL_PROVIDERS comment | +2/-1 |

**Total:** 4 files, +143/-96 lines

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4bfccbc | feat | Add Kimi K2.5 as 3-provider model (Together → Synthetic → OR route) |
| c38f921 | feat | Add GLM 4.7 Flash and DeepSeek R1-0528 as OR-only standalone models |

## Verification

✅ **Build:** Next.js build passed with webpack
✅ **TypeScript:** No type errors
✅ **Routes:** 36 routes validated successfully
✅ **Providers:** All 44 models instantiated correctly
✅ **Kimi K2.5 route:** 3-provider chain validated
✅ **OR-only models:** GLM 4.7 Flash and DeepSeek R1-0528 excluded from fallback-only filter

## Self-Check

### Files Created
✅ FOUND: `.planning/quick/38-add-3-new-models-kimi-k2-5-glm-4-7-flash/38-SUMMARY.md`

### Commits Exist
✅ FOUND: 4bfccbc (feat: Kimi K2.5 as 3-provider model)
✅ FOUND: c38f921 (feat: GLM 4.7 Flash and DeepSeek R1-0528 as OR-only)

### Provider Instances Exist
✅ `KimiK25Provider` exported from `together.ts`
✅ `KimiK25_SynProvider` exported from `synthetic.ts`
✅ `KimiK25_OR` exported from `openrouter.ts`
✅ `GLM47Flash_OR` exported from `openrouter.ts`
✅ `DeepSeekR1_0528_OR` exported from `openrouter.ts`

### Route Configuration
✅ `kimi-k2.5` route exists in `MODEL_PROVIDER_ROUTES`
✅ Route array: `['kimi-k2.5', 'kimi-k2.5-syn', 'kimi-k2.5-or']`
✅ No routes for OR-only models (correct - they're standalone primaries)

## Self-Check: PASSED

All verification steps passed successfully.

## Next Steps

**Database synchronization (future):**
- Run `scripts/sync-models.ts` to add new models to database
- This will create 3 new `models` table rows:
  - `kimi-k2.5` (primary Together provider)
  - `glm-4.7-flash` (OR-only primary)
  - `deepseek-r1-0528` (OR-only primary)

**Activation:**
- All 3 models are automatically available via `getActiveProviders()`
- Kimi K2.5 will be used when its route is selected
- GLM 4.7 Flash and DeepSeek R1-0528 will appear in model selection as OR primaries

**Testing recommendations:**
- Test Kimi K2.5 fallback chain (Together → Synthetic → OR)
- Verify GLM 4.7 Flash produces English-only output
- Verify DeepSeek R1-0528 correctly strips thinking tags
- Monitor response quality for all 3 new models

## Impact

**Model diversity:** +3 models (Kimi K2.5, GLM 4.7 Flash, DeepSeek R1-0528)

**Reliability:** Kimi K2.5 now has 3-provider redundancy (highest reliability tier)

**Cost efficiency:** GLM 4.7 Flash is ultra-cheap ($0.06/$0.40) for budget use cases

**Reasoning capacity:** DeepSeek R1-0528 adds another budget reasoning model option

**Total active models:** Up to 46 models (30 Together + 11 Synthetic + 5 OR primaries) when all API keys configured
