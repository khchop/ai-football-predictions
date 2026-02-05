---
phase: 40-model-specific-prompt-selection
plan: 01
subsystem: llm
tags: [typescript, prompt-engineering, response-processing, enum, type-safety]

# Dependency graph
requires:
  - phase: 37-39 (Synthetic.new Integration)
    provides: Provider abstraction and model configuration structure
provides:
  - PromptVariant enum for model-specific prompt selection
  - ResponseHandler enum for output post-processing
  - Type-safe prompt enhancement functions
  - Pure TypeScript configuration (no new dependencies)
affects: [40-02-provider-integration, 41-fallback-chains, 42-model-management, 43-timeout-handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Enum-based configuration for compile-time validation
    - Pure functions for response processing
    - Template enhancement via string concatenation

key-files:
  created:
    - src/lib/llm/prompt-variants.ts
    - src/lib/llm/response-handlers.ts
  modified: []

key-decisions:
  - "Enum-based variants over string literals for type safety"
  - "Combo variants (e.g., ENGLISH_THINKING_STRIPPED) over multiple variant fields"
  - "Response handlers as pure functions (string -> string)"
  - "Variants append to base prompt instead of replacing"

patterns-established:
  - "PromptVariant enum: Compile-time validation of variant names"
  - "PROMPT_VARIANTS constant: Centralized instruction additions"
  - "getEnhancedSystemPrompt: Helper for concatenating base + variant"
  - "ResponseHandler enum: Type-safe handler selection"
  - "Handler pipeline: Strip tags BEFORE extracting JSON"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 40 Plan 01: Model-Specific Prompt Selection Summary

**Type-safe prompt variants and response handlers for failing models (GLM, Kimi, DeepSeek, Qwen) using pure TypeScript enums and functions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T14:26:21Z
- **Completed:** 2026-02-05T14:28:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PromptVariant enum with 5 variants (BASE, ENGLISH_ENFORCED, JSON_STRICT, THINKING_STRIPPED, ENGLISH_THINKING_STRIPPED)
- ResponseHandler enum with 3 handlers (DEFAULT, EXTRACT_JSON, STRIP_THINKING_TAGS)
- Compile-time validation via TypeScript enums prevents invalid configurations
- Pure function approach enables testing and composition

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt variants configuration** - `61570ac` (feat)
2. **Task 2: Create response handler functions** - `6a07845` (feat)

## Files Created/Modified
- `src/lib/llm/prompt-variants.ts` - PromptVariant enum, PROMPT_VARIANTS constant, PromptConfig interface, getEnhancedSystemPrompt helper
- `src/lib/llm/response-handlers.ts` - ResponseHandler enum, handler functions, applyResponseHandler utility

## Decisions Made

**1. Enum-based configuration over string literals**
- Rationale: TypeScript compilation catches typos and invalid references at build time
- Benefit: Refactoring is safe - all usages tracked by type checker

**2. Combo variants instead of multi-variant arrays**
- Decision: Single `promptVariant` field, create `ENGLISH_THINKING_STRIPPED` for combined needs
- Rationale: Simpler configuration model, explicit about what each model gets
- Alternative rejected: Array of variants requiring merge logic

**3. Response handlers as pure functions**
- Decision: `(response: string) => string` signature
- Rationale: Easy to test, compose, and reason about
- Pattern: Strip tags → Extract JSON → Parse (pipeline composition)

**4. Variants append to base prompt**
- Decision: getEnhancedSystemPrompt concatenates base + variant addition
- Rationale: Maintains single source of truth for core prediction prompt
- Benefit: Updating base prompt automatically affects all variants

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward TypeScript file creation with enum and function definitions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 40 Plan 02:**
- PromptVariant enum available for provider class configuration
- ResponseHandler enum ready for response pipeline integration
- PromptConfig interface defines shape for model configuration

**For Plan 02 integration:**
- Provider classes will import PromptVariant, ResponseHandler enums
- Model configurations will specify `promptVariant`, `responseHandler`, `timeoutMs`
- Prediction logic will call `getEnhancedSystemPrompt(basePrompt, variant)`
- Response pipeline will call `applyResponseHandler(response, handler)` before JSON parsing

**Blockers:** None

**Validation needed in Plan 02:**
- Confirm GLM models with ENGLISH_ENFORCED actually output English
- Confirm DeepSeek V3.2 with JSON_STRICT stops adding explanations
- Confirm Qwen thinking models with THINKING_STRIPPED remove tags correctly

---
*Phase: 40-model-specific-prompt-selection*
*Completed: 2026-02-05*
