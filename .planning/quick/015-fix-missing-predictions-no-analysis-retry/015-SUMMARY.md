# Quick Task 015: Fix Missing Predictions - No Analysis Retry

## Problem

Three matches started without any predictions:
- Verona vs Pisa (Serie A)
- NAC Breda vs Excelsior (Eredivisie)
- Metz vs Lille (Ligue 1)

## Root Cause

The prediction pipeline is: analysis (T-6h) → predictions (T-30m).

**Bug 1 — Analysis worker (PRIMARY):** When `fetchAndStoreAnalysis()` returned null (API-Football had no data yet), the worker returned `{ success: false, reason: 'no_data_available' }`. Because this was a `return` (not `throw`), BullMQ marked the job as **completed** — no retries despite `attempts: 5` being configured.

**Bug 2 — Prediction worker (SECONDARY):** When `getMatchAnalysisByMatchId()` returned null (no analysis in DB), the worker returned `{ skipped: true, reason: 'no_analysis' }`. Same issue — BullMQ marked it completed, no retries.

## Fix

Changed both workers to `throw new Error(...)` instead of `return`, so BullMQ retries with the existing exponential backoff (30s → 60s → 120s → 240s → 480s = ~15 min total coverage).

### Files Modified

| File | Change |
|------|--------|
| `src/lib/queue/workers/analysis.worker.ts` | `return { success: false }` → `throw new Error(...)` |
| `src/lib/queue/workers/predictions.worker.ts` | `return { skipped: true }` → `throw new Error(...)` |

### Unchanged Skip Conditions

Legitimate skips still return (no retry):
- `match_not_found` — match doesn't exist in DB
- `match_not_scheduled` — match already started/finished
- `predictions_already_exist` — predictions already generated

## Verification

- TypeScript compilation: pass (no errors in modified files)
- Production build: pass
- Commit: `e4b6021`
