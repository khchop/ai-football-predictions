# Phase 31: Investigation & Diagnosis Report

**Investigation Date:** 2026-02-04 12:23 UTC
**Scope:** Content generation pipeline failure analysis
**Lookback Period:** 7-14 days

---

## Database Audit

**Executed:** 2026-02-04 12:23 UTC

### Query 1: Total matches by status in last 7 days

```sql
SELECT status, COUNT(*) as count
FROM matches
WHERE kickoff_time::timestamp >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;
```

**Results:**

```
  status   | count
-----------+-------
 finished  |   101
 postponed |     1
```

**Analysis:** 102 total matches in last 7 days (101 finished, 1 postponed).

---

### Query 2: Matches missing ANY content (summary OR FAQ) since deployment

```sql
SELECT
  m.status,
  COUNT(*) as total_matches,
  COUNT(mc.id) as has_content_record,
  COUNT(mc.pre_match_content) as has_pre_match,
  COUNT(mc.betting_content) as has_betting,
  COUNT(mc.post_match_content) as has_post_match,
  COUNT(mc.faq_content) as has_faq
FROM matches m
LEFT JOIN match_content mc ON m.id = mc.match_id
WHERE m.kickoff_time::timestamp >= NOW() - INTERVAL '7 days'
GROUP BY m.status;
```

**Results:**

```
  status   | total_matches | has_content_record | has_pre_match | has_betting | has_post_match | has_faq
-----------+---------------+--------------------+---------------+-------------+----------------+---------
 postponed |             1 |                  1 |             1 |           1 |              0 |       0
 finished  |           101 |                100 |            96 |          96 |            100 |       1
```

**Analysis:**
- **Pre-match content:** 5 matches missing (96/101 = 95%)
- **Betting content:** 5 matches missing (96/101 = 95%)
- **Post-match content:** 1 match missing (100/101 = 99%)
- **FAQ content:** 100 matches missing (1/101 = 1%)
- **Missing content record entirely:** 1 match (Bologna vs AC Milan on 2026-02-03)

---

### Query 3: Timeline analysis - when did content generation stop working?

```sql
SELECT
  DATE(created_at::timestamp) as date,
  COUNT(*) as content_records_created,
  COUNT(pre_match_content) as pre_match_count,
  COUNT(post_match_content) as post_match_count
FROM match_content
GROUP BY DATE(created_at::timestamp)
ORDER BY date DESC
LIMIT 14;
```

**Results:**

```
    date    | content_records_created | pre_match_count | post_match_count
------------+-------------------------+-----------------+------------------
 2026-02-03 |                       4 |               0 |                4
 2026-02-01 |                      26 |              26 |               25
 2026-01-31 |                      28 |              28 |               28
 2026-01-30 |                       7 |               7 |                7
 2026-01-29 |                      18 |              18 |               18
 2026-01-28 |                      18 |              18 |               18
 2026-01-27 |                       2 |               2 |                2
 2026-01-26 |                       4 |               4 |                4
 2026-01-25 |                      28 |              28 |               28
 2026-01-24 |                      26 |              26 |               26
 2026-01-23 |                       4 |               4 |                4
```

**CRITICAL FINDING:** Pre-match content generation stopped working after 2026-02-01.
- **2026-02-01:** 26 pre-match, 25 post-match (last successful day)
- **2026-02-03:** 0 pre-match, 4 post-match (only post-match content being generated)

---

### Query 4: Content generation timestamps - last successful generation

```sql
SELECT
  MAX(pre_match_generated_at) as last_pre_match,
  MAX(betting_generated_at) as last_betting,
  MAX(post_match_generated_at) as last_post_match,
  MAX(faq_generated_at) as last_faq
FROM match_content;
```

**Results:**

```
      last_pre_match      |       last_betting       |     last_post_match      |         last_faq
--------------------------+--------------------------+--------------------------+--------------------------
 2026-02-01T14:15:12.219Z | 2026-02-01T19:31:03.004Z | 2026-02-03T21:15:42.566Z | 2026-02-03T21:11:05.259Z
```

**Analysis:**
- **Last pre-match content:** 2026-02-01 14:15 UTC (3 days ago)
- **Last betting content:** 2026-02-01 19:31 UTC (3 days ago)
- **Last post-match content:** 2026-02-03 21:15 UTC (today - working!)
- **Last FAQ content:** 2026-02-03 21:11 UTC (today - working!)

**Pre-match and betting content generation stopped on 2026-02-01 evening.**

---

### Query 5: Quality audit - check for HTML artifacts, truncation, placeholder text

```sql
SELECT
  id, match_id,
  LEFT(pre_match_content, 100) as pre_match_sample,
  LEFT(post_match_content, 100) as post_match_sample
FROM match_content
WHERE
  pre_match_content LIKE '%<%'
  OR pre_match_content LIKE '%&lt;%'
  OR post_match_content LIKE '%<%'
  OR post_match_content LIKE '%&lt;%'
LIMIT 10;
```

**Results:**

```
 id | match_id | pre_match_sample | post_match_sample
----+----------+------------------+-------------------
(0 rows)
```

**Analysis:** No HTML artifacts detected in existing content (good quality signal).

---

### Supplemental Query: Spot check Feb 2-3 matches

```sql
SELECT
  m.home_team || ' vs ' || m.away_team as match,
  m.kickoff_time,
  m.status,
  mc.pre_match_content IS NOT NULL as has_pre_match,
  mc.betting_content IS NOT NULL as has_betting,
  mc.post_match_content IS NOT NULL as has_post_match,
  mc.created_at as content_record_created
FROM matches m
LEFT JOIN match_content mc ON m.id = mc.match_id
WHERE m.kickoff_time::timestamp >= '2026-02-02'
  AND m.kickoff_time::timestamp < '2026-02-04'
ORDER BY m.kickoff_time DESC
LIMIT 20;
```

**Results:**

```
           match           |       kickoff_time        |  status  | has_pre_match | has_betting | has_post_match |  content_record_created
---------------------------+---------------------------+----------+---------------+-------------+----------------+--------------------------
 Bologna vs AC Milan       | 2026-02-03T19:45:00+00:00 | finished | f             | f           | f              |
 Mallorca vs Sevilla       | 2026-02-02T20:00:00+00:00 | finished | f             | f           | t              | 2026-02-03T21:15:08.475Z
 Sunderland vs Burnley     | 2026-02-02T20:00:00+00:00 | finished | f             | f           | t              | 2026-02-03T21:11:05.259Z
 Udinese vs AS Roma        | 2026-02-02T19:45:00+00:00 | finished | f             | f           | t              | 2026-02-03T21:15:12.942Z
 Kocaelispor vs Fenerbahçe | 2026-02-02T17:00:00+00:00 | finished | f             | f           | t              | 2026-02-03T21:15:16.404Z
```

**Pattern:** All matches from Feb 2-3 are missing pre-match AND betting content, but POST-MATCH content IS being generated (content records created on 2026-02-03).

---

### Summary Statistics

**Affected Matches:** 5 out of 101 finished matches (5%) from last 7 days
**Missing Content Types:**
- Pre-match: 5 matches
- Betting: 5 matches
- Post-match: 1 match
- FAQ: 100 matches (expected - FAQ is rarely generated)

**Failure Window:** Started after 2026-02-01 19:31 UTC
**Currently Working:** Post-match content generation (working as of 2026-02-03 21:15 UTC)
**Currently Broken:** Pre-match and betting content generation

---

## Queue Health

**Executed:** 2026-02-04 12:30 UTC

### Environment Check

```bash
# Check for Redis configuration
grep -i "REDIS" .env.local
```

**Result:**
```
No REDIS_URL found
```

**Analysis:** REDIS_URL environment variable is NOT configured. This is CRITICAL - BullMQ queue system requires Redis to function.

### Code Architecture Review

**Worker initialization:** Workers are started via `src/instrumentation.ts` when Next.js server boots (Node.js runtime only).

**Startup sequence:**
1. Validate environment (`validateEnvironmentOrThrow()`)
2. Sync models to database
3. Warm cache with frequently accessed data
4. Setup repeatable jobs (fixtures fetch every 6h)
5. **Start all workers** (`startAllWorkers()`) - includes content worker
6. Catch-up scheduling for existing matches

**Content Worker Configuration:**
- Queue name: `content-queue`
- Concurrency: 1 (rate limiting for Together AI)
- Rate limiter: 30 requests per minute
- Handles jobs: `scan_match_content`, `match_preview`, `league_roundup`, `model_report`, `generate-roundup`

### Process Check

```bash
ps aux | grep -i "node\|next" | grep -v grep
```

**Result:** No Next.js server processes found running.

**Analysis:** Application server is NOT currently running. This means:
- No workers are active
- No scan_match_content jobs are being triggered
- No content generation is happening

### Redis Connection Check

From `src/lib/queue/index.ts` analysis:
```typescript
export function getQueueConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL not configured - required for job queue');
  }
  // ...
}
```

**Expected behavior:** Application startup will throw error on missing REDIS_URL when trying to initialize queue system.

**Actual behavior:** Since server is not running, queue system was never initialized.

---

## Worker Status

**Status:** NOT RUNNING

**Evidence:**
1. No Next.js server process found (`ps aux`)
2. No REDIS_URL configured in environment
3. No pm2 processes (pm2 not installed)
4. Workers are initialized in `instrumentation.ts` on server start

**Last known worker activity:** Unknown (no accessible logs found)

**Implications:**
- **Scan jobs not running:** `scan_match_content` job (should run periodically to backfill missing content) is not executing
- **No reactive content generation:** Even if jobs were queued externally, no workers exist to process them
- **Queue state unknown:** Cannot inspect BullMQ queue state without Redis CLI access

**Historical context from database:**
- Post-match content IS being generated (last: 2026-02-03 21:15 UTC)
- This suggests a DIFFERENT mechanism is generating post-match content
- Likely: post-match content is generated synchronously via API routes or other trigger, NOT via queue workers

---

## Timeline Correlation

### Failure Timeline

**2026-02-01 19:31 UTC** - Last betting content generated
**2026-02-01 evening** - Pre-match/betting content generation stops
**2026-02-02** - Git commits suggest active development (SEO enhancements)
**2026-02-03 21:15 UTC** - Post-match content still generating (different mechanism)

### Deployment Activity

Git log from 2026-02-01 to 2026-02-02:
```
2026-02-02 12:44:04 - fix(08): revise 08-02-PLAN based on checker feedback
2026-02-02 12:39:56 - docs(08): create UX Transparency phase plan
...
2026-02-02 11:49:28 - docs(08): capture phase context
```

**Analysis:** Multiple commits on 2026-02-02, but these are planning/documentation commits, not code changes that would affect workers.

**Hypothesis:** Server may have been stopped for development/testing and never restarted, or REDIS_URL was removed from environment.

---

## Root Cause

**Primary Cause:** Application server not running - worker processes never started

**Confidence Level:** HIGH

**Evidence:**

1. **Process check confirms no server running:**
   - `ps aux | grep node` shows no Next.js processes
   - No pm2 processes (pm2 not installed)
   - Workers are only started when Next.js server boots via `instrumentation.ts`

2. **Missing Redis configuration:**
   - `REDIS_URL` environment variable is not configured in `.env.local`
   - Queue system REQUIRES Redis and throws error on startup if missing
   - Server startup would fail immediately when trying to initialize queue system

3. **Content generation architecture shows dependency on workers:**
   - Pre-match content: Generated by `scanMatchesMissingContent()` function in content worker
   - Betting content: Generated by `scanMatchesMissingContent()` function in content worker
   - Both triggered by `scan_match_content` repeatable job (cron: every hour at :15)
   - No workers running = no scan jobs executing = no pre-match/betting content generated

4. **Post-match content still works (different mechanism):**
   - Last post-match content: 2026-02-03 21:15 UTC (working!)
   - Last FAQ content: 2026-02-03 21:11 UTC (working!)
   - **Implication:** Post-match content is likely generated via different trigger (API route, webhook, or synchronous call after match settlement), NOT via queue workers

5. **Timeline matches server downtime:**
   - Last pre-match content: 2026-02-01 14:15 UTC
   - Last betting content: 2026-02-01 19:31 UTC
   - Gap of 3 days with no pre-match/betting content
   - Pattern suggests server stopped after 2026-02-01 evening

**Ruling Out Alternative Causes:**

**Alternative 1: Silent failures (return false instead of throw)**
- **Ruled out because:** Content IS being generated (post-match), proving generation functions work
- **Evidence:** `generatePostMatchContent()` returns false on error (non-blocking), yet post-match content IS being generated successfully
- **Conclusion:** The issue isn't silent failures - it's that scan jobs aren't running at all

**Alternative 2: Rate limits (Together AI 429 errors)**
- **Ruled out because:** No workers running to make API calls
- **Evidence:** Worker rate limiter (30 requests/minute) is configured but never activated
- **Conclusion:** Can't hit rate limits if no requests are being made

**Alternative 3: Worker death (process crashed and didn't restart)**
- **Ruled out because:** Workers never started in first place
- **Evidence:** No server process found, REDIS_URL missing would prevent startup
- **Conclusion:** This is about server not running, not worker crashes

**Alternative 4: Scheduling issues (jobs not being added to queue)**
- **Ruled out because:** Queue system requires Redis connection to function
- **Evidence:** `scan_match_content` repeatable job registered in `setup.ts` (lines 253-265), but requires Redis
- **Conclusion:** Jobs can't be scheduled without Redis connection and running server

**Affected Scope:**

- **Total matches affected:** 5 out of 101 finished matches (5%) from last 7 days
- **Date range:** 2026-02-02 to 2026-02-03 (matches that kicked off after server stopped)
- **Content types affected:** Pre-match and betting content only
- **Content types working:** Post-match and FAQ content (different generation mechanism)

**Data Gaps/Limitations:**

1. **No Redis CLI access:** Cannot inspect queue state, DLQ, or job history
2. **No worker logs:** Cannot determine exact shutdown time or reason
3. **No server uptime tracking:** Cannot confirm when server was last running
4. **REDIS_URL history unknown:** Cannot determine if it was ever configured or when it was removed

**Root Cause Summary:**

The content generation pipeline failure is caused by the Next.js application server not running. The server startup requires `REDIS_URL` configuration for the BullMQ queue system, which is missing from the environment. Even if configured, no server process is currently running to start workers and execute the scheduled `scan_match_content` jobs that generate pre-match and betting content.

Post-match content continues to work because it uses a different generation trigger (likely synchronous API call after match settlement), not dependent on queue workers.

**Next Steps (Phase 32):**

1. Configure `REDIS_URL` environment variable
2. Start Next.js application server (`npm run dev` or `npm start`)
3. Verify workers start successfully via logs
4. Confirm `scan_match_content` job executes and backfills missing content
5. Monitor for any errors during content generation (silent failures, rate limits, etc.)

