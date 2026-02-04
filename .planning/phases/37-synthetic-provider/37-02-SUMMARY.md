---
phase: 37-synthetic-provider
plan: 02
subsystem: llm
tags: [synthetic, openai-compatible, deepseek, qwen, minimax, glm]

# Dependency graph
requires:
  - phase: 37-01
    provides: SyntheticProvider class with OpenAI-compatible base
provides:
  - 13 Synthetic-exclusive model configurations
  - SYNTHETIC_PROVIDERS array export
  - Premium/budget tier classification
affects: [37-03, model-registry, prediction-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [model-config-pattern-syn-suffix, hf-org-model-format]

key-files:
  created: []
  modified: [src/lib/llm/providers/synthetic.ts]

key-decisions:
  - "13 models (not 14) - followed explicit task list in plan"
  - "All IDs use -syn suffix to distinguish from Together AI models"
  - "Placeholder pricing based on model size (actual pricing TBD)"
  - "4 premium models (3 reasoning + 1 coder), 9 budget models"

patterns-established:
  - "Synthetic ID pattern: lowercase-with-dashes-syn suffix"
  - "Model ID pattern: hf:org/model-name format"

# Metrics
duration: 2min
completed: 2026-02-04
---

# Phase 37 Plan 02: Define 13 Synthetic Model Configurations Summary

**13 Synthetic-exclusive models configured: 3 reasoning (DeepSeek R1-0528, Kimi K2-Thinking, Qwen3-235B-Thinking), 10 standard (DeepSeek V3 variants, MiniMax, Kimi K2.5, GLM, Qwen Coder, GPT-OSS-120B)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-04T20:42:04Z
- **Completed:** 2026-02-04T20:43:49Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Defined 13 model provider instances with full configuration
- Organized models by category with clear comments
- Exported SYNTHETIC_PROVIDERS array with all 13 models
- Applied -syn suffix to all IDs for Together AI differentiation

## Task Commits

Both tasks completed in single atomic commit:

1. **Tasks 1-2: Define 13 model providers + export array** - `1e41c89` (feat)

## Files Created/Modified
- `src/lib/llm/providers/synthetic.ts` - Added 13 SyntheticProvider instances and SYNTHETIC_PROVIDERS export

## Decisions Made
- **13 vs 14 models:** Plan objective mentioned "14 models" but Task 1 explicitly listed 13 numbered items. Followed the explicit task list.
- **Pricing estimates:** Used placeholder pricing based on model size since Synthetic.new pricing is TBD. Premium reasoning models priced higher than budget models.
- **ID naming:** All IDs use lowercase with dashes and -syn suffix (e.g., `deepseek-r1-0528-syn`) to distinguish from Together AI models.
- **Tier classification:** 4 premium models (3 reasoning + Qwen3-Coder-480B), 9 budget models.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. SYNTHETIC_API_KEY will be configured in Phase 37-03.

## Next Phase Readiness
- 13 model configurations ready for registry integration
- SyntheticProvider class + models complete for Phase 37-03 registry updates
- All models follow consistent pattern matching Together AI structure

---
*Phase: 37-synthetic-provider*
*Completed: 2026-02-04*
