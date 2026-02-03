---
phase: 29
plan: 05
subsystem: seo
tags: [schema-org, structured-data, event-status, gap-closure]
dependency-graph:
  requires: [8, 27]
  provides: [complete-event-status-mapping]
  affects: []
tech-stack:
  added: []
  patterns: [schema-org-event-vocabulary]
key-files:
  created: []
  modified: [src/components/MatchPageSchema.tsx]
decisions:
  - id: ES-001
    choice: "Use default case for both 'scheduled' and unknown statuses"
    reason: "EventScheduled is the safe fallback for any unmapped state"
metrics:
  duration: 68s
  completed: 2026-02-03
---

# Phase 29 Plan 05: EventStatus Mapping Summary

**One-liner:** Added EventPostponed and EventCancelled cases to complete Schema.org event status vocabulary mapping.

## What Was Done

### Task 1: Add missing eventStatus cases for postponed and cancelled

Updated the `getEventStatus` function in `MatchPageSchema.tsx` to handle all five match states:

| Match Status | Schema.org EventStatus |
|--------------|------------------------|
| `scheduled` | `https://schema.org/EventScheduled` |
| `live` | `https://schema.org/EventInProgress` |
| `finished` | `https://schema.org/EventCompleted` |
| `postponed` | `https://schema.org/EventPostponed` |
| `cancelled` | `https://schema.org/EventCancelled` |

The default case handles both `scheduled` matches and any unknown states by returning `EventScheduled`, which is the appropriate fallback per Schema.org vocabulary.

**Commit:** 3ccc227

## Key Files Modified

- `src/components/MatchPageSchema.tsx` - Added 4 lines (2 new switch cases)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. TypeScript compilation: Passed (Next.js build successful)
2. Grep verification: Both `EventPostponed` and `EventCancelled` present at lines 35 and 37
3. Switch statement review: All 5 states covered

## Requirements Satisfied

- SGEO-03: eventStatus correctly maps to all states (scheduled, live, finished, postponed, cancelled)

## Next Phase Readiness

- No blockers
- No new dependencies introduced
- Schema.org structured data is now complete for all match states
