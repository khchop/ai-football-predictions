# Quick-024: Fix API-Football Budget Limit & Error Logging

## Problem

Pipeline coverage at 0% — 21 matches, all without predictions. Analysis queue: 106 failed, 7 completed.

**Root cause:** Three compounding issues:

1. **Budget limit too low:** Hardcoded to 100 req/day (Free tier) but user has Pro tier (500-1000/day). Each match analysis = ~6 API calls. Live polling alone consumes most of the budget.
2. **Error serialization broken:** Pino logs `error: {}` for Error objects because no `err` serializer configured. Actual error messages (like `BudgetExceededError`) are invisible in logs.
3. **Budget errors silently swallowed:** `fetchPrediction/fetchInjuries/fetchOdds` catch ALL errors and return `null`. BudgetExceededError should propagate so BullMQ can retry with backoff.

## Evidence

From production logs at 13:44:29 UTC:
```
analysis-queue:    completed: 7,   failed: 106   ← 93% failure rate
predictions-queue: completed: 171, failed: 3     ← works when analysis exists
matchCoverage:     0% (21/21 without predictions)
```

Analysis errors show:
```
{"error":{},"msg":"Error fetching prediction"}    ← empty error object
{"error":{},"msg":"Error fetching injuries"}
{"error":{},"msg":"Error fetching odds"}
→ "No data available" → job fails
```

## Fix

1. **api-budget.ts:** `DAILY_REQUEST_LIMIT = 100` → `1000`
2. **logger/index.ts:** Add `serializers: { error: pino.stdSerializers.err, err: pino.stdSerializers.err }`
3. **api-client.ts:** Add `if (error instanceof BudgetExceededError) throw error;` in fetchPrediction, fetchInjuries, fetchOdds catch blocks

## Files Changed

- `src/lib/football/api-budget.ts` — budget limit 100 → 1000
- `src/lib/logger/index.ts` — add error serializers
- `src/lib/football/api-client.ts` — propagate BudgetExceededError

## Status

- [x] Implemented
- [x] Build verified
