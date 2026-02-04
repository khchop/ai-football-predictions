---
phase: 37-synthetic-provider
plan: 01
subsystem: llm
tags: [synthetic.new, openai-compatible, llm-provider]

# Dependency graph
requires:
  - phase: none
    provides: OpenAICompatibleProvider base class already exists
provides:
  - SyntheticProvider class for Synthetic.new API integration
  - Compatible with existing provider infrastructure
affects: [37-02 model instances, 37-03 provider registry integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OpenAI-compatible provider pattern (extends base class)"

key-files:
  created:
    - src/lib/llm/providers/synthetic.ts
  modified: []

key-decisions:
  - "Followed TogetherProvider pattern exactly for consistency"
  - "No Content-Type header in getHeaders() (base class handles it) - kept for explicit clarity"

patterns-established:
  - "SyntheticProvider: same constructor signature as TogetherProvider for interchangeability"

# Metrics
duration: 1min
completed: 2026-02-04
---

# Phase 37 Plan 01: Create SyntheticProvider Class Summary

**SyntheticProvider class extending OpenAICompatibleProvider with Synthetic.new endpoint and SYNTHETIC_API_KEY authentication**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-04T20:41:45Z
- **Completed:** 2026-02-04T20:42:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created SyntheticProvider class extending OpenAICompatibleProvider
- Configured endpoint to `https://api.synthetic.new/openai/v1/chat/completions`
- Implemented getHeaders() using SYNTHETIC_API_KEY with descriptive error
- Added estimateCost() and estimateBatchCost() methods matching TogetherProvider

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SyntheticProvider class** - `0e38502` (feat)

## Files Created/Modified
- `src/lib/llm/providers/synthetic.ts` - SyntheticProvider class with OpenAI-compatible API integration for Synthetic.new

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required in this plan. SYNTHETIC_API_KEY environment variable will be needed when Synthetic models are used.

## Next Phase Readiness
- SyntheticProvider class ready for model instance creation in 37-02
- Same interface as TogetherProvider enables seamless integration
- No blockers

---
*Phase: 37-synthetic-provider*
*Completed: 2026-02-04*
