---
phase: 39-testing-validation
plan: 01
subsystem: testing
tags: [synthetic, validation, llm, testing, models]

# Dependency graph
requires:
  - phase: 37-synthetic-foundation
    provides: SYNTHETIC_PROVIDERS configuration and base provider class
  - phase: 38-database-integration
    provides: Model registration in database
provides:
  - Model validation script for testing all 13 Synthetic.new models
  - Documented model compatibility report (7/13 models validated)
  - Known issues with specific models (GLM, reasoning models, timeouts)
affects: [production-readiness, model-selection, 39-02-together-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validation script pattern using Promise.allSettled for concurrent model testing"
    - "Model classification by type (reasoning, GLM, standard)"
    - "Raw response preview for debugging parse failures"

key-files:
  created:
    - scripts/validate-synthetic-models.ts
  modified: []

key-decisions:
  - "6 models fail validation (qwen3-235b-thinking-syn, deepseek-v3.2-syn, kimi-k2.5-syn, glm-4.6-syn, glm-4.7-syn, gpt-oss-120b-syn)"
  - "GLM-4.7 has known structured output bug in SGLang (Synthetic.new confirmed)"
  - "Reasoning models (deepseek-r1, kimi-k2-thinking) parse successfully despite different output formats"
  - "7 models production-ready: deepseek-r1-0528-syn, kimi-k2-thinking-syn, deepseek-v3-0324-syn, deepseek-v3.1-terminus-syn, minimax-m2-syn, minimax-m2.1-syn, qwen3-coder-480b-syn"

patterns-established:
  - "Model validation before production: test all providers with sample predictions before enabling in prediction cycles"
  - "Concurrent validation with Promise.allSettled: handles individual failures gracefully"
  - "Model type detection: classify models as reasoning/GLM/standard for specialized validation"

# Metrics
duration: 5min
completed: 2026-02-04
---

# Phase 39 Plan 01: Model Validation Script Summary

**Created validation script testing all 13 Synthetic.new models; 7 models validated successfully, 6 models have known issues (API bugs, timeouts, parse failures)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-04T21:17:00Z
- **Completed:** 2026-02-04T21:22:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created validation script testing all 13 Synthetic.new models with sample prediction
- Validated 7 models production-ready (deepseek-r1, kimi-k2-thinking, deepseek-v3 variants, minimax variants, qwen3-coder)
- Documented 6 failing models with specific error types (API bugs, timeouts, parse failures)
- Established model validation pattern for future provider integrations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create model validation script** - `4e2bd92` (feat)

**Plan metadata:** (pending this commit)

## Files Created/Modified
- `scripts/validate-synthetic-models.ts` - Validates all 13 Synthetic.new models with sample prediction, logs parse results, detects thinking tags and Chinese output

## Validation Results

### Successful Models (7/13)

**Reasoning Models:**
- ✅ `deepseek-r1-0528-syn` - Parsed successfully, prediction: 1-2
- ✅ `kimi-k2-thinking-syn` - Parsed successfully, prediction: 1-1

**Standard Models:**
- ✅ `deepseek-v3-0324-syn` - Parsed successfully, prediction: 1-1
- ✅ `deepseek-v3.1-terminus-syn` - Parsed successfully, prediction: 1-1
- ✅ `minimax-m2-syn` - Parsed successfully, prediction: 1-1
- ✅ `minimax-m2.1-syn` - Parsed successfully, prediction: 1-1
- ✅ `qwen3-coder-480b-syn` - Parsed successfully, prediction: 1-2

### Failed Models (6/13)

**Parse Failures (2):**
- ❌ `qwen3-235b-thinking-syn` - No valid JSON found (returns natural language reasoning)
- ❌ `deepseek-v3.2-syn` - No valid JSON found (returns natural language reasoning)

**Timeouts (2):**
- ❌ `kimi-k2.5-syn` - Timeout after 30 seconds
- ❌ `glm-4.6-syn` - Timeout after 30 seconds

**API Bugs (1):**
- ❌ `glm-4.7-syn` - API error: "response_format.type = json_schema and json_object are currently not supported for GLM 4.7 due to a structured output bug in SGLang"

**No Valid Predictions (1):**
- ❌ `gpt-oss-120b-syn` - Returns `{"type":"object"}` instead of predictions

## Decisions Made

**1. Production model selection:**
- Enable 7 validated models for prediction cycles
- Disable 6 failing models until issues resolved
- Keep model configurations in code for future re-testing

**2. GLM-4.7 excluded:**
- Confirmed API-level bug (SGLang structured output issue)
- Not a parser problem - API cannot return JSON mode
- Re-test when Synthetic.new fixes upstream

**3. Reasoning model parse behavior:**
- `deepseek-r1-0528-syn` and `kimi-k2-thinking-syn` parse successfully
- Raw responses show no thinking tags in validation run
- Parser handles various output formats correctly

**4. Timeout models investigation needed:**
- `kimi-k2.5-syn` and `glm-4.6-syn` consistently timeout at 30s
- May be slow inference or rate limiting
- Re-test with longer timeout or at different time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. API key confusion:**
- Initial validation used Together AI key instead of Synthetic.new key
- User confirmed correct SYNTHETIC_API_KEY added to .env.local
- Resolved: Re-ran validation with correct key

**2. Model failures expected:**
- 6/13 models failed validation
- Not deviations - this is the purpose of validation
- Documented specific failure modes for each model

## Next Phase Readiness

**Production readiness:**
- 7 models validated and ready for prediction cycles
- Model registry includes all 13 models (6 will fail if enabled)
- Validation script can be re-run anytime to check status

**Blockers:**
- GLM-4.7 blocked by upstream SGLang bug (Synthetic.new fix required)
- 2 models timeout (may need rate limit investigation)
- 2 models return natural language instead of JSON (prompt adjustment needed?)

**Next steps:**
- Run Together AI model validation (39-02)
- Decision on whether to keep failing models in registry or remove
- Consider prompt adjustments for qwen3-235b-thinking and deepseek-v3.2

---
*Phase: 39-testing-validation*
*Completed: 2026-02-04*
