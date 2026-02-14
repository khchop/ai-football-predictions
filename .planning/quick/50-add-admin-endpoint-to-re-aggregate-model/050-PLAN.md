---
phase: quick-050
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/app/api/admin/reaggregate-stats/route.ts]
autonomous: true

must_haves:
  truths:
    - "Admin can trigger re-aggregation for a date range via POST request"
    - "Re-aggregation uses existing aggregateDailyStats for each day"
    - "Endpoint returns count of days processed"
  artifacts:
    - path: "src/app/api/admin/reaggregate-stats/route.ts"
      provides: "Admin endpoint for re-aggregating model health stats"
      exports: ["POST"]
      min_lines: 70
  key_links:
    - from: "src/app/api/admin/reaggregate-stats/route.ts"
      to: "src/lib/db/queries/model-stats.ts"
      via: "aggregateDailyStats import"
      pattern: "aggregateDailyStats"
    - from: "src/app/api/admin/reaggregate-stats/route.ts"
      to: "src/lib/utils/admin-auth.ts"
      via: "requireAdminAuth import"
      pattern: "requireAdminAuth"
---

<objective>
Add admin endpoint to re-aggregate model health stats for a date range.

Purpose: Fix stale historical data in `llm_model_stats` table after quick-049 logic fix.
Output: Working POST /api/admin/reaggregate-stats endpoint that processes date ranges.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/app/api/admin/model-health/route.ts
@src/lib/db/queries/model-stats.ts
@src/lib/utils/admin-auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create POST /api/admin/reaggregate-stats endpoint</name>
  <files>src/app/api/admin/reaggregate-stats/route.ts</files>
  <action>
Create new admin endpoint at `src/app/api/admin/reaggregate-stats/route.ts`:

**Structure:**
- Export async POST function
- Use rate limiting first (same pattern as model-health)
- Use requireAdminAuth(req) for authentication
- Accept optional `days` query parameter (default: 30)
- Generate date array from today back N days (YYYY-MM-DD format using date-fns)
- Call `aggregateDailyStats(date)` for each day sequentially with Promise.all
- Return JSON: { timestamp, daysProcessed, dateRange: { from, to } }
- Use sanitizeError for error handling
- Include rate limit headers in response

**Date handling:**
- Use `format(subDays(new Date(), i), 'yyyy-MM-dd')` pattern from model-stats.ts
- Import `format, subDays` from 'date-fns'

**Rate limiting:**
- Use `RATE_LIMIT_PRESETS.admin` (same as model-health endpoint)
- Create rate limit key: `admin:reaggregate:${rateLimitKey}`

**Error handling:**
- Wrap aggregation loop in try-catch
- Return 500 with sanitized error on failure
- Return 400 if days param invalid (< 1 or > 365)

**Follow existing patterns from model-health/route.ts:**
- Same import structure
- Same rate limit check order (before auth)
- Same 429 response format
- Same auth check
- Same error sanitization
- Same header inclusion with createRateLimitHeaders
  </action>
  <verify>
```bash
# File exists and exports POST function
grep -l "export async function POST" src/app/api/admin/reaggregate-stats/route.ts

# Has all required imports
grep "requireAdminAuth" src/app/api/admin/reaggregate-stats/route.ts
grep "aggregateDailyStats" src/app/api/admin/reaggregate-stats/route.ts
grep "checkRateLimit" src/app/api/admin/reaggregate-stats/route.ts
grep "sanitizeError" src/app/api/admin/reaggregate-stats/route.ts

# TypeScript compiles
npx tsc --noEmit src/app/api/admin/reaggregate-stats/route.ts
```
  </verify>
  <done>
POST /api/admin/reaggregate-stats endpoint exists with:
- Admin authentication via requireAdminAuth
- Rate limiting with admin preset
- Query param `days` (default 30, max 365)
- Calls aggregateDailyStats for each day in range
- Returns daysProcessed count and date range
- Error handling with sanitizeError
  </done>
</task>

</tasks>

<verification>
**Manual test:**
```bash
# Test without auth (should 401)
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats?days=7"

# Test with auth and default 30 days
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats" \
  -H "X-Admin-Password: ${ADMIN_PASSWORD}"

# Test with specific day count
curl -X POST "http://localhost:3000/api/admin/reaggregate-stats?days=7" \
  -H "X-Admin-Password: ${ADMIN_PASSWORD}"

# Check response structure
{
  "timestamp": "2026-02-14T...",
  "daysProcessed": 7,
  "dateRange": {
    "from": "2026-02-07",
    "to": "2026-02-14"
  }
}
```

**Verify aggregation:**
- Check `llm_model_stats` table has updated rows for the date range
- Verify updatedAt timestamps are recent
- Confirm error category columns are zeroed (per quick-049 fix)
</verification>

<success_criteria>
- [ ] POST /api/admin/reaggregate-stats endpoint created
- [ ] Requires admin auth via X-Admin-Password header
- [ ] Rate limited with admin preset
- [ ] Accepts `days` query parameter (default 30, validates 1-365)
- [ ] Generates date range and calls aggregateDailyStats for each day
- [ ] Returns JSON with daysProcessed and dateRange
- [ ] TypeScript compiles without errors
- [ ] Error handling uses sanitizeError
- [ ] Rate limit headers included in all responses
- [ ] Manual testing shows successful re-aggregation
</success_criteria>

<output>
After completion, create `.planning/quick/50-add-admin-endpoint-to-re-aggregate-model/050-SUMMARY.md`
</output>
