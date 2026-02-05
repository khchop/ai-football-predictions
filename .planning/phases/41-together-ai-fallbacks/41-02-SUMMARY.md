---
phase: 41-together-ai-fallbacks
plan: 02
subsystem: llm
tags: [fallback, orchestration, synthetic, together-ai, predictions]

# Dependency graph
requires:
  - phase: 41-01
    provides: usedFallback database column and validation
provides:
  - callAPIWithFallback method on OpenAICompatibleProvider
  - Automatic Together AI fallback on Synthetic model failures
  - usedFallback tracking in prediction records
affects: [42-model-health-cache, 43-model-timeout-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns: [fallback-orchestration, max-depth-1]

key-files:
  created: []
  modified:
    - src/lib/llm/providers/base.ts
    - src/lib/queue/workers/predictions.worker.ts

key-decisions:
  - "Any error triggers fallback immediately (no retries on original model)"
  - "Max fallback depth 1 - if fallback fails, throw error"
  - "Attribution preserved - modelId stores original model, usedFallback tracks internal fallback"
  - "Fallback attempts logged with structured context (originalModel, fallbackModel, error)"

patterns-established:
  - "FallbackAPIResult tuple pattern: { response, usedFallback }"
  - "Cast to OpenAICompatibleProvider for fallback callAPI invocation"
  - "Success log differentiation with ↩ symbol for fallback predictions"

# Metrics
duration: 1.6min
completed: 2026-02-05
---

# Phase 41 Plan 02: Together AI Fallbacks - Orchestration Wrapper

**Automatic Together AI fallback on Synthetic model failures with single-depth retry and usedFallback tracking in predictions**

## Performance

- **Duration:** 1 min 38 sec
- **Started:** 2026-02-05T16:09:30Z
- **Completed:** 2026-02-05T16:11:08Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- callAPIWithFallback method on OpenAICompatibleProvider enables transparent fallback
- First failure triggers immediate Together AI retry (no delay, no original model retry)
- Prediction records track usedFallback boolean for admin visibility
- Structured logging captures fallback attempts and outcomes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add callAPIWithFallback method to base provider** - `ad9ee05` (feat)
2. **Task 2: Integrate fallback into predictions worker** - `464905e` (feat)
3. **Task 3: Verify NewPrediction type includes usedFallback** - `ffb812b` (chore)

## Files Created/Modified
- `src/lib/llm/providers/base.ts` - Added FallbackAPIResult interface and callAPIWithFallback method
- `src/lib/queue/workers/predictions.worker.ts` - Changed to callAPIWithFallback, added usedFallback tracking

## Decisions Made

**1. No retries on original model**
- First failure immediately triggers fallback
- Rationale: Synthetic models are already using provider-level retries (fetchWithRetry)

**2. Max depth 1 enforcement**
- Together AI providers have no fallbacks defined
- getFallbackProvider returns null for Together models
- No cycle detection needed - structurally impossible

**3. Attribution preservation**
- modelId stores original model (user-facing attribution)
- usedFallback boolean tracks internal fallback usage
- Rationale: Users should know which model they "requested", admins can see fallback stats

**4. Cast to OpenAICompatibleProvider for fallback**
- getFallbackProvider returns LLMProvider interface
- Fallback invocation requires concrete type for callAPI
- Safe because ALL_PROVIDERS all extend OpenAICompatibleProvider

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan specification with no blockers.

## Next Phase Readiness

**Ready for:**
- Phase 42: Cache invalidation and provider stats updates
- Phase 43: Timeout validation for reasoning models

**Key validation needed:**
- Cross-provider API parameter compatibility (Together vs Synthetic)
- Fallback timeout behavior (does Together AI inherit model-specific timeout?)
- Fallback impact on model health tracking (should failures count against original model?)

**Suggested testing:**
- Synthetic model timeout → fallback completes within remaining time budget
- Parse error on Synthetic → fallback returns valid JSON
- Both models fail → prediction marked as failed (not stuck in retry loop)

---
*Phase: 41-together-ai-fallbacks*
*Completed: 2026-02-05*
