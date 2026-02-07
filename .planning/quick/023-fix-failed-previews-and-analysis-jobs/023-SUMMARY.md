---
phase: quick-023
plan: 01
subsystem: operations
tags: [redis, bullmq, dlq, requeue, queue-management]

# Dependency graph
requires:
  - phase: quick-022
    provides: match_previews unique constraint fix
  - phase: quick-020
    provides: allowRetroactive flag support for analysis
provides:
  - DLQ requeue script for clearing failed job backlog
  - 107 failed jobs recovered (27 previews + 80 analysis)
affects: [operations, queue-health, content-generation, match-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: [one-time operational scripts with dry-run support]

key-files:
  created:
    - scripts/requeue-dlq-jobs.ts
  modified: []

key-decisions:
  - "Only requeue previews and analysis jobs, skip roundups/predictions/settlements"
  - "Use dry-run mode first to validate categorization before actual requeue"
  - "Add allowRetroactive flag to analysis jobs since matches are past kickoff"

patterns-established:
  - "DLQ requeue scripts should filter by job type and add necessary flags"
  - "One-time operational scripts include dry-run mode for safety"
  - "Requeue with unique jobId prefix (requeue-*) to avoid collisions"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Quick Task 023: Fix Failed Previews and Analysis Jobs Summary

**Cleared 107 failed jobs from DLQ (27 previews + 80 analysis) with type-filtered requeue script**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T10:46:47Z
- **Completed:** 2026-02-07T10:49:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created requeue script with dry-run mode and type filtering
- Successfully requeued 27 match preview jobs to content-queue
- Successfully requeued 80 analysis jobs to analysis-queue with allowRetroactive flag
- Cleared 107 jobs from DLQ (343 → 236 remaining)
- Verified script with dry-run before actual execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and run DLQ requeue script** - `e1b9695` (chore)

## Files Created/Modified
- `scripts/requeue-dlq-jobs.ts` - One-time script to requeue failed preview and analysis jobs from DLQ with type filtering and dry-run support

## Decisions Made

**1. Selective requeue by job type**
- Found 343 DLQ entries: 157 content-queue, 80 analysis-queue, 106 other queues
- Content-queue had 130 roundup jobs (generate-roundup, league_roundup) and 27 previews
- Decision: Only requeue match_preview jobs (27), skip roundup jobs (130)
- Rationale: Roundup jobs may have different root causes, safer to handle separately

**2. Skip predictions-queue and settlement-queue jobs**
- Found 106 jobs from predictions-queue (60 retro-predict) and settlement-queue (46 settle/rescore)
- Decision: Skip these - different root causes than preview/analysis failures
- Rationale: These need separate investigation, not related to quick-022 fix

**3. Add allowRetroactive flag to analysis jobs**
- Analysis jobs were originally scheduled for T-6h before kickoff
- Now past kickoff, would fail status check without allowRetroactive
- Decision: Add `allowRetroactive: true` to all analysis requeues
- Rationale: Enables retroactive backfill as implemented in quick-020

## Deviations from Plan

None - plan executed exactly as written. Script correctly filtered by job type and added necessary flags.

## Issues Encountered

None - script compiled and executed successfully on first attempt.

## Execution Details

**Dry-run results:**
```
Total DLQ entries: 343
  Content queue: 157 (27 previews, 130 roundups)
  Analysis queue: 80 (all eligible)
  Other queues: 106 (predictions + settlement)
```

**Actual requeue results:**
```
Content queue (previews):
  Found: 157
  Requeued: 27
  Failed/Skipped: 130 (roundup jobs)

Analysis queue:
  Found: 80
  Requeued: 80
  Failed/Skipped: 0

Other queues (skipped): 106
DLQ remaining: 236 (down from 343)
```

## Next Phase Readiness

- DLQ cleared of target job types (previews and analysis)
- Remaining 236 DLQ entries are roundup/prediction/settlement jobs with different root causes
- These can be investigated separately if needed
- Preview and analysis pipelines now have failed jobs back in queue for retry

## Self-Check: PASSED

**Created files verified:**
- scripts/requeue-dlq-jobs.ts exists and compiles

**Commits verified:**
- e1b9695 exists in git log

---
*Phase: quick-023*
*Completed: 2026-02-07*
