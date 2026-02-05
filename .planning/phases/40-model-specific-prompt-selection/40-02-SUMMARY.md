---
phase: 40-model-specific-prompt-selection
plan: 02
subsystem: llm
tags: [prompt-engineering, llm-providers, together-ai, synthetic-new, model-configuration, response-handlers]

# Dependency graph
requires:
  - phase: 40-01
    provides: PromptVariant enum, PromptConfig interface, getEnhancedSystemPrompt helper, ResponseHandler enum, RESPONSE_HANDLERS constant
provides:
  - Base provider applies model-specific prompt variants and response handlers
  - TogetherProvider accepts optional promptConfig parameter
  - SyntheticProvider accepts optional promptConfig parameter
  - 6 previously disabled Synthetic models re-enabled with configurations
  - 42 total active models (29 Together + 13 Synthetic)
affects: [41-fallback-chain-validation, 42-provider-stats-cache, 43-timeout-handling]

# Tech tracking
tech-stack:
  added: []
  patterns: [optional-configuration-with-defaults, model-specific-timeout-override, unified-content-extraction]

key-files:
  created: []
  modified:
    - src/lib/llm/providers/base.ts
    - src/lib/llm/providers/together.ts
    - src/lib/llm/providers/synthetic.ts
    - src/lib/llm/prompt-variants.ts

key-decisions:
  - "Optional promptConfig property on provider classes (not abstract) - subclasses only override when needed"
  - "Unified content extraction before applying response handler - single return path handles all response formats"
  - "Fixed PromptConfig.responseHandler type from string to ResponseHandler enum for compile-time safety"
  - "90s timeout for Qwen3-235B-Thinking (largest reasoning model), 60s for other thinking models, 45s for JSON-strict models"

patterns-established:
  - "Model configuration through optional constructor parameter with empty object default"
  - "Response handler application after content extraction, before return"
  - "Backward compatibility through undefined checks with sensible defaults"

# Metrics
duration: 5min
completed: 2026-02-05
---

# Phase 40 Plan 02: Provider Integration Summary

**Integrated prompt variants and response handlers into provider classes, re-enabled 6 failing Synthetic models with model-specific configurations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T14:31:40Z
- **Completed:** 2026-02-05T14:37:04Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Base provider applies prompt variants to system prompts and response handlers to outputs before parsing
- TogetherProvider configured DeepSeek R1 with thinking tag suppression (THINKING_STRIPPED variant, STRIP_THINKING_TAGS handler, 60s timeout)
- SyntheticProvider re-enabled 6 disabled models with appropriate configurations:
  - Qwen3-235B-Thinking: thinking suppression, 90s timeout
  - DeepSeek V3.2: JSON strictness, JSON extraction, 45s timeout
  - Kimi K2.5: 60s timeout (was timing out at 30s)
  - GLM 4.6/4.7: English enforcement, 60s timeout
  - GPT-OSS 120B: JSON strictness, JSON extraction, 45s timeout
- Increased provider count from 36 to 42 (29 Together + 13 Synthetic)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update base provider to apply prompt variants and response handlers** - `3b84666` (feat)
   - Import PromptVariant, PromptConfig, getEnhancedSystemPrompt, ResponseHandler, RESPONSE_HANDLERS
   - Add optional promptConfig property to OpenAICompatibleProvider
   - Apply prompt variant to system prompt before API call
   - Use model-specific timeout when configured
   - Unify content extraction into single variable before applying response handler
   - Fix PromptConfig.responseHandler type (string → ResponseHandler)

2. **Task 2: Extend TogetherProvider with promptConfig support** - `8ef2eec` (feat)
   - Add promptConfig parameter to constructor (optional, defaults to {})
   - Store promptConfig as public readonly property
   - Configure DeepSeek R1 with THINKING_STRIPPED, STRIP_THINKING_TAGS, 60s timeout
   - All other 28 Together AI providers unchanged (use default config)

3. **Task 3: Configure Synthetic providers and re-enable disabled models** - `b6d2ed7` (feat)
   - Add promptConfig parameter to SyntheticProvider constructor
   - Configure reasoning models (DeepSeek R1 0528, Kimi K2 Thinking, Qwen3-235B-Thinking) with thinking suppression
   - Configure DeepSeek V3.2 with JSON strictness and extraction
   - Configure Kimi K2.5 with 60s timeout
   - Configure GLM 4.6/4.7 with English enforcement
   - Configure GPT-OSS 120B with JSON strictness and extraction
   - Update SYNTHETIC_PROVIDERS array to include all 13 models
   - Update summary comment (13 active, 0 disabled)

## Files Created/Modified

- `src/lib/llm/providers/base.ts` - OpenAICompatibleProvider applies prompt variants and response handlers
- `src/lib/llm/providers/together.ts` - TogetherProvider accepts promptConfig, configured DeepSeek R1
- `src/lib/llm/providers/synthetic.ts` - SyntheticProvider accepts promptConfig, re-enabled 6 models with configurations
- `src/lib/llm/prompt-variants.ts` - Fixed PromptConfig.responseHandler type (string → ResponseHandler enum)

## Decisions Made

1. **Optional property instead of abstract:** Made promptConfig a concrete optional property (not abstract) on OpenAICompatibleProvider. Subclasses only override when they need custom configuration. This is more flexible than requiring ALL subclasses to implement it.

2. **Unified content extraction:** Refactored callAPI to extract content into a single variable from all possible response fields (content, reasoning, reasoning_details), then apply response handler, then return. This creates a single return path that handles all OpenAI-compatible response formats consistently.

3. **Fixed type safety:** Changed PromptConfig.responseHandler from `string` to `ResponseHandler` enum. The string type was a placeholder from 40-01 to avoid circular dependency, but proper import order allows the enum type for compile-time validation.

4. **Model-specific timeouts:**
   - 90s for Qwen3-235B-Thinking (largest reasoning model, needs extra time)
   - 60s for DeepSeek R1, Kimi K2 Thinking, Kimi K2.5, GLM 4.6/4.7 (medium reasoning/timeout-prone models)
   - 45s for DeepSeek V3.2, GPT-OSS 120B (models needing JSON strictness but not reasoning time)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PromptConfig.responseHandler type**
- **Found during:** Task 1 (TypeScript compilation of base.ts)
- **Issue:** PromptConfig.responseHandler typed as `string` in prompt-variants.ts, but RESPONSE_HANDLERS is Record<ResponseHandler, Fn>, causing type error when indexing
- **Fix:** Imported ResponseHandler enum in prompt-variants.ts and changed responseHandler type from `string` to `ResponseHandler`
- **Files modified:** src/lib/llm/prompt-variants.ts
- **Verification:** TypeScript compilation passed with no errors
- **Committed in:** 3b84666 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type safety fix necessary for compilation. No scope creep.

## Issues Encountered

None - plan executed smoothly with one type safety correction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for phase 41 (Fallback Chain Validation):**
- All 42 providers now have model-specific configurations applied
- Response handlers will clean thinking tags, extract JSON from markdown
- Increased timeouts should prevent premature timeouts on slower models
- Base infrastructure supports runtime prompt variant switching

**Validation needed:**
- Test that GLM models actually return English with ENGLISH_ENFORCED variant
- Test that thinking models return valid JSON without thinking tags
- Test that Kimi K2.5 completes within 60s without timing out
- Test that DeepSeek V3.2 returns valid JSON that parses successfully

**No blockers:** Infrastructure complete, ready for integration testing.

---
*Phase: 40-model-specific-prompt-selection*
*Completed: 2026-02-05*
