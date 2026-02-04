---
phase: 39-testing-validation
plan: 02
subsystem: llm
tags: [synthetic, model-validation, provider-config]

# Dependency graph
requires:
  - phase: 39-01
    provides: Model validation results identifying 6 failing Synthetic models
  - phase: 37-02
    provides: Original 13 Synthetic model configurations
provides:
  - 7 validated Synthetic models in SYNTHETIC_PROVIDERS export
  - 6 failing models documented with specific failure reasons
  - Automatic database deactivation via sync-models mechanism
affects: [prediction-cycles, model-selection, future-synthetic-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [disabled-model-documentation, preserve-definitions-for-retesting]

key-files:
  created: []
  modified: [src/lib/llm/providers/synthetic.ts]

key-decisions:
  - "Keep disabled model definitions in code (don't delete) for future re-testing"
  - "Document specific failure reasons in code comments"
  - "Rely on existing sync-models mechanism for database deactivation"

patterns-established:
  - "Disabled models: Add to DISABLED_MODELS comment section, remove from export array"
  - "Validation workflow: validate-synthetic-models.ts -> disable in code -> sync deactivates in DB"

# Metrics
duration: 8min
completed: 2026-02-04
---

# Phase 39 Plan 02: Disable Failing Synthetic Models Summary

**Excluded 6 failing Synthetic models from production by removing from SYNTHETIC_PROVIDERS export while preserving definitions for future re-testing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-04T21:30:00Z
- **Completed:** 2026-02-04T21:38:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Reduced SYNTHETIC_PROVIDERS from 13 to 7 validated models
- Documented all 6 disabled models with specific failure reasons in code
- Verified sync-models mechanism will deactivate disabled models in database on next server start
- Application builds successfully with reduced model set

## Task Commits

Each task was committed atomically:

1. **Task 1: Disable failing Synthetic models** - `01c50c3` (fix)
2. **Task 2: Verify sync-models mechanism** - No commit (verification-only task)

## Files Created/Modified

- `src/lib/llm/providers/synthetic.ts` - Reduced SYNTHETIC_PROVIDERS to 7 models, added DISABLED_MODELS documentation

## Disabled Models (6)

| Model | ID | Failure Reason |
|-------|-----|----------------|
| Qwen3 235B Thinking | qwen3-235b-thinking-syn | Parse failure: returns natural language instead of JSON |
| DeepSeek V3.2 | deepseek-v3.2-syn | Parse failure: returns natural language instead of JSON |
| Kimi K2.5 | kimi-k2.5-syn | Timeout: 30s timeout, needs investigation |
| GLM 4.6 | glm-4.6-syn | Timeout: 30s timeout, needs investigation |
| GLM 4.7 | glm-4.7-syn | API bug: SGLang structured output not supported (Synthetic.new confirmed) |
| GPT-OSS 120B | gpt-oss-120b-syn | Invalid response: returns {"type":"object"} instead of predictions |

## Active Models (7)

| Model | ID | Tier |
|-------|-----|------|
| DeepSeek R1 0528 | deepseek-r1-0528-syn | premium (reasoning) |
| Kimi K2 Thinking | kimi-k2-thinking-syn | premium (reasoning) |
| DeepSeek V3 0324 | deepseek-v3-0324-syn | budget |
| DeepSeek V3.1 Terminus | deepseek-v3.1-terminus-syn | budget |
| MiniMax M2 | minimax-m2-syn | budget |
| MiniMax M2.1 | minimax-m2.1-syn | budget |
| Qwen3 Coder 480B | qwen3-coder-480b-syn | premium |

## Decisions Made

1. **Preserve definitions** - Kept all 13 model const declarations in code to enable easy re-testing when upstream issues are fixed
2. **Document in code** - Added DISABLED_MODELS comment section explaining each failure
3. **Use existing sync** - Relied on sync-models.ts mechanism rather than manual database updates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript check (`npx tsc --noEmit`) shows pre-existing test infrastructure errors (missing vitest types), not related to this plan's changes
- ESLint passes for modified file specifically

## Next Phase Readiness

- 7 Synthetic models ready for production predictions
- Database sync will automatically deactivate 6 disabled models on next server start
- Ready for 39-03 (Integration Testing) or 39-04 (Validation Dashboard)

## Future Re-testing

When upstream issues are fixed for disabled models:
1. Move model from DISABLED_MODELS comment back to SYNTHETIC_PROVIDERS array
2. Run `validate-synthetic-models.ts` to verify fix
3. Server restart will re-activate model via sync-models

---
*Phase: 39-testing-validation*
*Completed: 2026-02-04*
