---
phase: 51-retroactive-backfill-script
plan: 01
subsystem: pipeline
tags: [bullmq, queue, workers, backfill, retroactive]

# Dependency graph
requires:
  - phase: 49-pipeline-scheduling-fixes
    provides: Fixed scheduling to process scheduled matches regardless of kickoff time
  - phase: 50-settlement-investigation-recovery
    provides: Settlement investigation and retry mechanisms
provides:
  - allowRetroactive flag on analysis and predictions worker payloads
  - Worker bypass for status checks when processing retroactive backfills
  - Foundation for retroactive backfill script in Plan 02
affects: [51-02-backfill-script, pipeline-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional payload flags for worker behavior modification"
    - "Status check bypass pattern for retroactive processing"

key-files:
  created: []
  modified:
    - src/lib/queue/types.ts
    - src/lib/queue/workers/analysis.worker.ts
    - src/lib/queue/workers/predictions.worker.ts

key-decisions:
  - "Use optional allowRetroactive flag instead of modifying match status or bypassing checks globally"
  - "Log retroactive processing explicitly for observability"
  - "Preserve normal pipeline behavior when flag is undefined/false"

patterns-established:
  - "Worker behavior flags: Optional payload fields for special processing modes"
  - "Retroactive processing: Bypass status checks while maintaining all other validation"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 51 Plan 01: Retroactive Backfill Worker Support

**Added allowRetroactive flag to analysis and predictions workers, enabling retroactive processing for finished/live matches while preserving normal pipeline behavior**

## Performance

- **Duration:** 2 min 4s
- **Started:** 2026-02-06T22:17:55Z
- **Completed:** 2026-02-06T22:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `allowRetroactive?: boolean` flag to AnalyzeMatchPayload and PredictMatchPayload types
- Modified analysis worker to bypass status check when allowRetroactive=true
- Modified predictions worker to bypass status check when allowRetroactive=true
- Both workers log retroactive processing for observability
- Backward compatible - optional flag maintains existing pipeline behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add allowRetroactive flag to queue payload types** - `cb1e6bd` (feat)
2. **Task 2: Update workers to respect allowRetroactive flag** - `90a5ec5` (feat)

## Files Created/Modified
- `src/lib/queue/types.ts` - Added allowRetroactive flag to AnalyzeMatchPayload and PredictMatchPayload
- `src/lib/queue/workers/analysis.worker.ts` - Extract allowRetroactive, bypass status check when true, log retroactive processing
- `src/lib/queue/workers/predictions.worker.ts` - Extract allowRetroactive, bypass status check when true, log retroactive processing

## Decisions Made
- **Use optional flag instead of match status modification:** Safer and more explicit than changing match status or bypassing checks globally. Allows normal pipeline and backfill script to coexist without interference.
- **Log retroactive processing explicitly:** Added log statements when allowRetroactive=true for observability and debugging.
- **Preserve normal pipeline behavior:** Flag defaults to undefined/false, so existing pipeline continues to skip non-scheduled matches as before.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation with no blockers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Backfill Script):**
- Workers now support retroactive processing flag
- Status check bypass logic validated
- Production build passes
- TypeScript compilation clean

**Blockers:** None

**Next steps:**
1. Create backfill script that queries finished matches missing predictions
2. Script will add jobs with `allowRetroactive: true` flag
3. Workers will process these matches regardless of status

## Self-Check: PASSED

All files and commits verified successfully.

---
*Phase: 51-retroactive-backfill-script*
*Completed: 2026-02-06*
