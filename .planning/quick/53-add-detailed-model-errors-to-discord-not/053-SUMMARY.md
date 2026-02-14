---
phase: quick-053
plan: 01
subsystem: notifications
tags:
  - discord
  - monitoring
  - error-tracking
  - debugging
dependency_graph:
  requires:
    - error-type-classification (retry-config)
    - discord-webhook-infrastructure
  provides:
    - detailed-error-notifications
    - prediction-run-summaries
  affects:
    - troubleshooting-workflow
    - operational-visibility
tech_stack:
  added:
    - none
  patterns:
    - error-grouping-by-type
    - fire-and-forget-notifications
    - batch-failure-tracking
key_files:
  created: []
  modified:
    - src/lib/notifications/discord.ts
    - src/lib/db/queries.ts
    - src/lib/queue/workers/predictions.worker.ts
decisions:
  - title: "Group failures by error type in Discord"
    rationale: "Easier to identify systematic issues (e.g., all parse-error models) vs. one-off failures"
    alternatives:
      - "Flat list of all failures (harder to scan)"
      - "Separate notification per failure (too noisy)"
  - title: "Show at most 10 failures in summary"
    rationale: "Discord embed field limits and readability"
    alternatives:
      - "Show all failures (could hit Discord limits)"
      - "Lower limit (might hide important patterns)"
  - title: "No notification for clean runs"
    rationale: "Reduce noise - only alert on problems"
    alternatives:
      - "Always send summary (too chatty)"
metrics:
  duration_minutes: 4
  completed_date: "2026-02-14"
  task_count: 2
  file_count: 3
  commit_count: 2
---

# Phase quick Plan 053: Add Detailed Model Errors to Discord Notifications Summary

**One-liner:** Enhanced Discord alerts with error type classification and prediction run summaries showing grouped per-model failures for easier troubleshooting without log access.

## What Was Built

### Auto-Disable Alert Enhancement
- Added `errorType` field to `AutoDisableParams` interface
- Display error type as separate field in Discord embed (e.g., "parse-error", "client-error")
- Renamed "Error" field to "Error Details" for clarity
- Pass errorType through from `recordModelFailure` to `sendAutoDisableAlert`

### Prediction Run Summary Notification
- Created `PredictionRunFailure` interface for tracking per-model errors
- Implemented `sendPredictionRunSummary` function with:
  - Color coding: orange if <50% failed, red if >=50% failed
  - Grouped failures by error type
  - Model names with truncated error messages (80 chars)
  - Limit of 10 failures shown (with "+N more" indicator)
- Wired into predictions worker:
  - Collect failures at all 4 failure points (empty response, parse failure, schema validation, catch block)
  - Send summary after prediction loop completes (fire-and-forget)
  - No notification for clean runs (0 failures)

## Technical Implementation

### Error Collection Points
1. **Empty response** (~line 226): `ErrorType.PARSE_ERROR`, message: "empty_response"
2. **Parse failure** (~line 268): `ErrorType.PARSE_ERROR`, message from parser
3. **Schema validation** (~line 293): `ErrorType.PARSE_ERROR`, message: "schema_validation_failed"
4. **Catch block** (~line 334): Classified via `classifyErrorType()`, message from exception

### Fire-and-Forget Pattern
All Discord notification code follows the fire-and-forget pattern:
- Wrapped in try-catch at notification layer
- `.catch(() => {})` at call sites
- Never throws, never blocks pipeline
- Errors logged internally via `loggers.discord`

## Verification

- Type-checking passes: `npx tsc --noEmit` (no errors in changed files)
- Build passes: `npx next build --webpack` (turbopack has local wasm issue, production builds work)
- `sendPredictionRunSummary` exported from discord.ts
- `PredictionRunFailure` interface exported
- `AutoDisableParams` has optional `errorType` field
- `sendAutoDisableAlert` displays error type in separate field
- Predictions worker collects failures and calls summary function
- No throw statements in notification paths

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

### src/lib/notifications/discord.ts
- Added `errorType?: string` to `AutoDisableParams`
- Created `PredictionRunFailure` interface (exported)
- Updated `sendAutoDisableAlert` to display error type as separate field
- Implemented `sendPredictionRunSummary` function with error grouping logic

### src/lib/db/queries.ts
- Updated `sendAutoDisableAlert` call in `recordModelFailure` to pass `errorType` parameter

### src/lib/queue/workers/predictions.worker.ts
- Imported `sendPredictionRunSummary`
- Added `modelFailures` array to track per-model failures during run
- Collect failure data at all 4 failure points with:
  - `modelId`, `displayName` (from `provider.displayName || provider.name || provider.id`)
  - `errorType` (from `ErrorType` enum or `classifyErrorType()`)
  - `errorMessage` (truncated to 100 chars)
- Call `sendPredictionRunSummary` after prediction loop if any failures occurred

## Commits

| Hash    | Message                                                                      |
|---------|------------------------------------------------------------------------------|
| 9b09e29 | feat(quick-053): add error type to auto-disable alerts and create prediction run summary notification |
| bd81a32 | feat(quick-053): wire prediction run summary into predictions worker         |

## Impact

### Developer Experience
- Troubleshoot model failures directly from Discord without needing log access
- Identify systematic issues (e.g., all parse-error models) vs. one-off failures
- Understand error distribution at a glance (grouped by type)

### Operational Visibility
- See all failures for a prediction run, not just auto-disabled models
- Catch degradation trends before auto-disable threshold (5 consecutive failures)
- Color-coded severity (orange vs. red) based on failure rate

### Discord Notifications Now Show
1. **Auto-disable alerts:** Error type + error details (before: only truncated error)
2. **Prediction run summaries:** Grouped failures with model names and errors (before: no notification)

## Next Steps

No follow-up required. Feature complete and ready for production.

## Self-Check: PASSED

All claimed artifacts verified:

**Created exports:**
```bash
# sendPredictionRunSummary exported
$ grep "^export async function sendPredictionRunSummary" src/lib/notifications/discord.ts
202:export async function sendPredictionRunSummary(params: {

# PredictionRunFailure exported
$ grep "^export interface PredictionRunFailure" src/lib/notifications/discord.ts
39:export interface PredictionRunFailure {
```

**Modified files exist:**
```bash
$ git log --oneline --stat -2 | grep -E "(discord|queries|predictions\.worker)"
 src/lib/db/queries.ts                          |   1 +
 src/lib/notifications/discord.ts               | 106 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 src/lib/queue/workers/predictions.worker.ts    |  61 ++++++++++++++++++++++++++++++++++++++++++-------
```

**Commits exist:**
```bash
$ git log --oneline | head -2
bd81a32 feat(quick-053): wire prediction run summary into predictions worker
9b09e29 feat(quick-053): add error type to auto-disable alerts and create prediction run summary notification
```

**Build passes:**
```bash
$ npx next build --webpack
...
○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
[Build completed successfully]
```
