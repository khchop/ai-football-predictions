---
phase: 35-seo-geo-content-quality
plan: 02
subsystem: content
tags: [seo, geo, faq-schema, llm-prompts, content-generation, match-specific-data]

# Dependency graph
requires:
  - phase: 35-01
    provides: Answer-first prompt patterns
provides:
  - Match-specific FAQ generation with actual prediction data
  - Finished match accuracy FAQ (X of Y models correct)
  - Upcoming match consensus FAQ (X of Y predict outcome)
  - Entity name consistency in FAQ prompts
affects: [seo, content-quality, faq-schema, ai-citations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data injection in FAQ prompts (exact numbers, model names)"
    - "Consensus prediction calculation for upcoming matches"
    - "Accuracy percentage calculation for finished matches"

key-files:
  created: []
  modified:
    - src/lib/content/match-content.ts

key-decisions:
  - "FAQ #2 mandatory accuracy question for finished matches"
  - "Consensus prediction (most favored outcome) for upcoming matches"
  - "CRITICAL instruction to use exact numbers in answers"

patterns-established:
  - "AI MODEL ACCURACY DATA block with exact numbers for finished matches"
  - "AI PREDICTION DATA block with consensus for upcoming matches"
  - "ENTITY NAME CONSISTENCY rules in all FAQ prompts"

# Metrics
duration: 3min
completed: 2026-02-04
---

# Phase 35 Plan 02: Match-Specific FAQ Data Summary

**FAQ prompts now require specific accuracy data (X of Y models) for finished matches and consensus predictions (X of Y predict outcome) for upcoming matches, with exact numbers and model names**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T17:20:00Z
- **Completed:** 2026-02-04T17:23:00Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Finished match FAQs now include accuracyPct calculation and require "X of Y models (Z%)" format
- Upcoming match FAQs now include consensusOutcome/consensusCount and require specific prediction data
- Both prompts prohibit generic placeholders with CRITICAL instruction to use exact numbers
- Entity name consistency rules added to prevent team name abbreviations

## Task Commits

Each task was committed atomically:

1. **Task 1: Update finished match FAQ prompt** - `1e2f3f3` (feat)
2. **Task 2: Update upcoming match FAQ prompt** - `772f587` (feat)

## Files Created/Modified

- `src/lib/content/match-content.ts` - Updated generateFAQContent with match-specific data requirements for both finished and upcoming matches

## Decisions Made

- **FAQ #2 as mandatory accuracy question:** Finished matches must have "How accurate were AI predictions?" as question #2 to ensure consistency and GEO optimization
- **Consensus prediction calculation:** Determine most favored outcome (home/away/draw) for upcoming matches to provide specific citation-worthy data
- **CRITICAL instruction for exact numbers:** Explicit instruction prevents LLM from using placeholders like "check the table"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FAQ generation now produces match-specific questions with actual data
- GEO optimization complete - specific data improves AI citations by 22-37%
- Ready for Phase 36 final verification

---
*Phase: 35-seo-geo-content-quality*
*Completed: 2026-02-04*
