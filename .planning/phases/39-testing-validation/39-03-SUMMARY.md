---
phase: 39-testing-validation
plan: 03
subsystem: llm
tags: [fallback, synthetic, together-ai, provider-mapping]

# Dependency graph
requires:
  - phase: 39-02
    provides: Active Synthetic models (7 validated)
  - phase: 37-01
    provides: Synthetic provider base class
provides:
  - MODEL_FALLBACKS mapping (Synthetic -> Together AI)
  - getFallbackProvider() lookup function
  - Cross-provider fallback documentation
affects: [prediction-pipeline, batch-predictions, auto-retry]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-fallback-mapping, cross-provider-resilience]

key-files:
  created: []
  modified:
    - src/lib/llm/index.ts

key-decisions:
  - "Conservative fallback mapping - only truly equivalent models"
  - "2 fallbacks: deepseek-r1-0528-syn -> deepseek-r1, kimi-k2-thinking-syn -> kimi-k2-instruct"
  - "Fallback not integrated into pipeline yet - future enhancement"

patterns-established:
  - "Cross-provider fallback: use MODEL_FALLBACKS for equivalent model lookup"
  - "Fallback availability: check both mapping exists AND API key configured"

# Metrics
duration: 2min
completed: 2026-02-04
---

# Phase 39 Plan 03: Together AI Fallbacks Summary

**Cross-provider fallback mapping from Synthetic models to Together AI equivalents with getFallbackProvider() lookup function**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-04T21:45:46Z
- **Completed:** 2026-02-04T21:47:03Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Created MODEL_FALLBACKS constant mapping 2 Synthetic models to Together equivalents
- Implemented getFallbackProvider() function for pipeline integration
- Documented which Synthetic models have no Together equivalent
- Added usage notes for future prediction pipeline integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create model fallback mapping** - `0367aa4` (feat)
2. **Task 2: Document fallback strategy** - included in Task 1 (documentation was comprehensive)

## Files Created/Modified
- `src/lib/llm/index.ts` - Added MODEL_FALLBACKS mapping and getFallbackProvider() function

## Decisions Made
- **Conservative mapping only:** Only mapped models with truly equivalent counterparts
  - deepseek-r1-0528-syn -> deepseek-r1 (same model family, version difference)
  - kimi-k2-thinking-syn -> kimi-k2-instruct (same base model, different tuning)
- **No forced fallbacks:** Models without good equivalents get no fallback
  - DeepSeek V3 variants, MiniMax, GLM, Qwen Coder - exclusive to Synthetic
- **Future integration:** Fallback not auto-used in pipeline yet
  - Prediction pipeline decides when/if to use fallbacks
  - Manual integration point documented in code comments

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation.

## Next Phase Readiness
- Fallback mapping ready for integration into prediction pipeline
- getFallbackProvider() exported and available for import
- Future work: Integrate fallbacks into predictions.worker.ts for automatic retry

---
*Phase: 39-testing-validation*
*Completed: 2026-02-04*
