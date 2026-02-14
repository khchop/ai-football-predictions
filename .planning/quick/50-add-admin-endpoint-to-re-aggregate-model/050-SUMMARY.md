---
phase: quick-050
plan: 01
subsystem: admin-api
tags: [admin, endpoints, model-stats, re-aggregation]

dependency_graph:
  requires: [quick-049]
  provides: [admin-reaggregate-endpoint]
  affects: [llm_model_stats]

tech_stack:
  added: []
  patterns: [admin-auth, rate-limiting, date-range-processing]

key_files:
  created:
    - src/app/api/admin/reaggregate-stats/route.ts
  modified: []

decisions:
  - choice: Use JSON body for days parameter instead of query param
    rationale: Plan spec explicitly says "from JSON body" despite verification examples using query params
    alternatives: [query-param, path-param]
  - choice: Use Promise.all for parallel aggregation
    rationale: aggregateDailyStats is idempotent via upsert, parallel execution is safe and faster
    alternatives: [sequential-loop, batch-processing]

metrics:
  duration: 66 seconds
  completed: 2026-02-14T13:07:28Z
  tasks_completed: 1
  files_created: 1
  commits: 1
---

# Quick Task 050: Add Admin Endpoint to Re-Aggregate Model Stats

**One-liner:** POST /api/admin/reaggregate-stats endpoint for re-processing model health stats after logic fixes

## Overview

Created admin endpoint to re-aggregate model health statistics for a date range. This endpoint fixes stale historical data in `llm_model_stats` table after the quick-049 logic fix that excluded auto-disabled models from stats calculations.

The endpoint allows administrators to trigger re-processing of up to 365 days of historical stats by calling `aggregateDailyStats()` for each day in the specified range.

## Implementation Details

### Endpoint Structure

**Route:** `POST /api/admin/reaggregate-stats`

**Request body:**
```json
{
  "days": 30  // optional, default: 30, max: 365
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-14T13:07:28Z",
  "daysProcessed": 30,
  "dateRange": {
    "from": "2026-01-15",
    "to": "2026-02-14"
  }
}
```

### Security & Rate Limiting

1. **Rate limiting first** (before auth) using `RATE_LIMIT_PRESETS.admin`
2. **Admin authentication** via `requireAdminAuth(req)` checking X-Admin-Password header
3. **Input validation**: days must be between 1 and 365
4. **Error sanitization**: All errors sanitized via `sanitizeError(error, 'admin-reaggregate-stats')`
5. **Rate limit headers**: All responses include rate limit headers via `createRateLimitHeaders()`

### Date Range Processing

1. Generates array of dates from today back N days using `format(subDays(now, i), 'yyyy-MM-dd')`
2. Calls `aggregateDailyStats(date)` for each day in parallel via `Promise.all`
3. Safe for parallel execution because `aggregateDailyStats` uses upsert on `(date, modelId)` unique constraint

### Pattern Adherence

Follows exact pattern from `src/app/api/admin/model-health/route.ts`:
- Same import structure
- Same rate limit check order (before auth)
- Same 429 response format with Retry-After header
- Same auth check pattern
- Same error sanitization approach
- Same rate limit header inclusion in all responses

## Deviations from Plan

None - plan executed exactly as written.

## Testing

### Verification Commands

```bash
# File exists and exports POST function
grep -l "export async function POST" src/app/api/admin/reaggregate-stats/route.ts

# Has all required imports
grep "requireAdminAuth" src/app/api/admin/reaggregate-stats/route.ts
grep "aggregateDailyStats" src/app/api/admin/reaggregate-stats/route.ts
grep "checkRateLimit" src/app/api/admin/reaggregate-stats/route.ts
grep "sanitizeError" src/app/api/admin/reaggregate-stats/route.ts
```

### Manual Testing

```bash
# Test without auth (should 401)
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'

# Test with auth and default 30 days
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats" \
  -H "X-Admin-Password: ${ADMIN_PASSWORD}" \
  -H "Content-Type: application/json"

# Test with specific day count
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats" \
  -H "X-Admin-Password: ${ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'

# Test validation (should 400)
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats" \
  -H "X-Admin-Password: ${ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"days": 500}'
```

### Verification of Aggregation

After running the endpoint, verify:
1. `llm_model_stats` table has updated rows for the date range
2. `updatedAt` timestamps are recent
3. Error category columns are zeroed (per quick-049 fix)
4. Only active, non-auto-disabled models have stats

```sql
-- Check recent updates
SELECT date, modelId, updatedAt, successRate, totalAttempts
FROM llm_model_stats
WHERE updatedAt > NOW() - INTERVAL '5 minutes'
ORDER BY date DESC, modelId;

-- Verify error categories are zeroed
SELECT date, modelId, timeoutErrors, parseErrors, apiErrors, languageErrors, otherErrors
FROM llm_model_stats
WHERE updatedAt > NOW() - INTERVAL '5 minutes'
  AND (timeoutErrors > 0 OR parseErrors > 0 OR apiErrors > 0 OR languageErrors > 0 OR otherErrors > 0);
```

## Success Criteria

- [x] POST /api/admin/reaggregate-stats endpoint created
- [x] Requires admin auth via X-Admin-Password header
- [x] Rate limited with admin preset
- [x] Accepts `days` from JSON body (default 30, validates 1-365)
- [x] Generates date range and calls aggregateDailyStats for each day
- [x] Returns JSON with daysProcessed and dateRange
- [x] Error handling uses sanitizeError
- [x] Rate limit headers included in all responses
- [x] Follows exact pattern from model-health/route.ts
- [x] File meets minimum 70 line requirement (114 lines)

## Next Steps

1. Deploy to production
2. Run re-aggregation for last 30 days to fix historical data: `curl -X POST "https://kroam.xyz/api/admin/reaggregate-stats" -H "X-Admin-Password: $ADMIN_PASSWORD" -H "Content-Type: application/json" -d '{"days": 30}'`
3. Verify model health stats are accurate in admin dashboard
4. Monitor for any errors in aggregation process

## Self-Check

Verifying claims made in this summary:

```bash
# Check created file exists
[ -f "src/app/api/admin/reaggregate-stats/route.ts" ] && echo "FOUND: src/app/api/admin/reaggregate-stats/route.ts" || echo "MISSING: src/app/api/admin/reaggregate-stats/route.ts"
# Result: FOUND: src/app/api/admin/reaggregate-stats/route.ts

# Check commit exists
git log --oneline --all | grep -q "df20bf4" && echo "FOUND: df20bf4" || echo "MISSING: df20bf4"
# Result: FOUND: df20bf4
```

**Self-Check: PASSED** ✓
