# Pitfalls Research: LLM Content Generation Pipeline

**Domain:** LLM-powered content generation with BullMQ job queues
**Researched:** 2026-02-04
**Confidence:** HIGH (codebase analysis + verified web research)
**Focus:** Diagnosing systemic content failures and preventing recurrence

## Executive Summary

The current content generation system shows two critical symptoms:
1. **All matches missing content** - systemic failure pattern
2. **HTML tags visible in older content** - sanitization gap

This research identifies failure modes specific to:
- BullMQ scheduled job execution
- Together AI LLM API calls
- Content parsing and sanitization
- Silent failure patterns

---

## Critical Pitfalls (Cause Rewrites)

### Pitfall 1: Job Schedule Drift and Missed Triggers

**What goes wrong:** Scheduled jobs (cron or delay-based) silently stop executing. Content generation halts across all matches with no errors logged.

**Root causes:**
- Redis connection drops without proper reconnection handling
- Worker process crashes without supervision (no PM2/systemd restart)
- Cron expressions evaluated in wrong timezone
- `repeatJobId` collision causing jobs to be deduplicated incorrectly
- BullMQ scheduler not started (Queue exists but no Worker attached)

**Current codebase evidence:**
```typescript
// content.worker.ts line 95-100 - limiter configuration
limiter: {
  max: 30, // Max 30 requests per minute
  duration: 60000,
}
```
If worker dies, this limiter state is lost and no jobs process.

**Warning signs:**
- Queue dashboard shows jobs in "waiting" state indefinitely
- `getJobCounts()` returns high "waiting" but zero "active"
- No worker logs for extended periods
- Redis KEYS show `bull:content-queue:*` entries but no processing

**Detection strategy:**
```typescript
// Heartbeat check - add to monitoring
const counts = await contentQueue.getJobCounts();
if (counts.waiting > 10 && counts.active === 0) {
  // Worker likely dead - alert immediately
  sendAlert('Content worker appears stalled');
}
```

**Prevention:**
1. Use process supervisor (PM2, systemd) with auto-restart
2. Add worker heartbeat monitoring to health checks
3. Log worker startup/shutdown explicitly
4. Verify timezone configuration for cron schedules

**Recovery:**
1. Check Redis connection: `redis-cli PING`
2. Verify worker process running: `ps aux | grep worker`
3. Restart worker with explicit logging
4. Run catch-up scan for missed content

---

### Pitfall 2: LLM API Silent Failures (200 OK, Empty Content)

**What goes wrong:** Together AI returns HTTP 200 but response body is empty, malformed, or contains only whitespace. Code proceeds without content, saves null/empty to database.

**Root causes:**
- Model overloaded, returns empty `choices` array
- Response truncated due to token limit without `finish_reason: "length"`
- API returns `null` content field silently
- Network proxy/gateway strips response body

**Current codebase evidence:**
```typescript
// together-client.ts line 168-169
if (!data.choices || data.choices.length === 0) {
  throw new Error('No response from Together AI API');
}
```
Good check, but doesn't catch `choices[0].message.content === ''`.

**Warning signs:**
- `matchContent` records exist but `preMatchContent`/`bettingContent`/`postMatchContent` is empty string
- Database has `generatedAt` timestamps but null content fields
- Logs show "Content generated" but no tokens counted

**Detection strategy:**
```typescript
// Add explicit empty check after extraction
const content = data.choices[0].message.content;
if (!content || content.trim().length < 50) {
  throw new Error(`LLM returned insufficient content: ${content?.length || 0} chars`);
}
```

**Prevention:**
1. Validate content length BEFORE saving to database
2. Check `finish_reason` is `"stop"` not `"length"` (truncation)
3. Add minimum word/character thresholds per content type
4. Log content length on successful generation

**Recovery:**
1. Query for empty content: `SELECT * FROM match_content WHERE preMatchContent = '' OR LENGTH(preMatchContent) < 50`
2. Add to regeneration backfill queue
3. Investigate API response logs for pattern

---

### Pitfall 3: JSON Parse Failures Causing Content Loss

**What goes wrong:** LLM returns valid prose wrapped in markdown or with extraneous text. JSON.parse fails, error is caught and logged, but content is lost forever.

**Root causes:**
- LLM adds "Here's the JSON:" preamble
- LLM wraps JSON in markdown triple backticks
- LLM adds trailing explanation after JSON
- Unescaped newlines/quotes within JSON strings
- Truncated response missing closing brackets

**Current codebase evidence:**
```typescript
// together-client.ts lines 186-227 - extensive JSON cleanup
// Good practices already in place:
// - Markdown code block extraction
// - Newline escaping within strings
// - Trailing comma removal
```
However, `generateTextWithTogetherAI` bypasses this for prose content (correct decision).

**Warning signs:**
- Logs show "Failed to parse response as JSON"
- `generateWithTogetherAI` (JSON) fails more than `generateTextWithTogetherAI` (prose)
- FAQ generation has higher failure rate than narrative content

**Detection strategy:**
```typescript
// Log raw content before parse attempt for debugging
loggers.togetherClient.debug({
  rawContent: content.substring(0, 200),
  contentLength: content.length,
}, 'Attempting JSON parse');
```

**Prevention:**
1. Use `generateTextWithTogetherAI` for all prose content (already done for match narratives)
2. Only use `generateWithTogetherAI` when structured output is required (FAQs)
3. Implement retry with corrective prompting: include parse error in retry prompt
4. Consider `json_repair` library as fallback before hard failure

**Recovery:**
1. Store raw LLM output in separate field for debugging
2. Manual repair of malformed JSON for critical content
3. Regenerate with explicit JSON-only prompt

---

### Pitfall 4: Rate Limit Cascade Failure

**What goes wrong:** Single rate limit (429) error triggers exponential backoff. Backoff delay exceeds job timeout. Job fails. All subsequent queued jobs inherit same rate limit state.

**Root causes:**
- Together AI dynamic rate limits (as of Jan 2026) vary by model and usage
- Batch of content jobs overwhelms rate limit
- Retry backoff multiplier too aggressive
- No circuit breaker to pause queue-wide

**Current codebase evidence:**
```typescript
// retry-config.ts line 147-152
TOGETHER_CONTENT_RETRY: {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}
```
3 retries with 30s max delay = 90s total. Job timeout is 60s (line 154). Jobs can timeout during retry.

**Warning signs:**
- Multiple 429 errors in logs within short timeframe
- Jobs failing with "timeout" after 429 errors
- Content queue backlog growing during rate limit period

**Detection strategy:**
```typescript
// Track rate limit hits per minute
let rateLimitHits = 0;
if (errorType === ErrorType.RATE_LIMIT) {
  rateLimitHits++;
  if (rateLimitHits > 5) {
    // Circuit breaker: pause content queue
    await contentQueue.pause();
    setTimeout(() => contentQueue.resume(), 60000);
  }
}
```

**Prevention:**
1. Implement queue-level circuit breaker for rate limits
2. Increase job timeout to accommodate retry delays
3. Use BullMQ's built-in rate limiter more conservatively
4. Batch content generation in off-peak hours

**Recovery:**
1. Pause content queue immediately on repeated 429s
2. Wait 60 seconds (full rate limit window)
3. Resume with lower throughput
4. Run backfill during low-usage period

---

## Moderate Pitfalls (Cause Delays/Tech Debt)

### Pitfall 5: Worker Lock Expiry (Stalled Jobs)

**What goes wrong:** Content generation takes longer than lock duration. BullMQ marks job as stalled. Another worker picks it up. Duplicate content or race conditions occur.

**Root causes:**
- Lock duration default 30s, LLM call takes 60s+
- Worker CPU spike prevents lock renewal
- Redis connection briefly lost during processing

**Current codebase evidence:**
```typescript
// index.ts line 196-207 - Lock durations defined
WORKER_LOCK_DURATIONS = {
  [QUEUE_NAMES.PREDICTIONS]: 10 * 60 * 1000,
  // ... but CONTENT queue uses default 30s
  default: 30 * 1000,
}
```
Content queue using default 30s lock, but content generation can take 60s+.

**Warning signs:**
- "Missing lock for job X" errors in logs
- Same content generated twice for same match
- Jobs marked as "stalled" then completed

**Prevention:**
1. Add explicit lock duration for content queue (at least 120s)
2. Use `extendLock()` in long-running jobs
3. Monitor stall rate as metric

**Recovery:**
1. Check for duplicate content entries per match
2. Deduplicate in database
3. Adjust lock duration configuration

---

### Pitfall 6: HTML in LLM Output (Sanitization Gap)

**What goes wrong:** LLM generates content with HTML tags (bold, lists, headers). Content stored raw in database. Frontend displays visible tags or XSS vulnerability.

**Root causes:**
- Prompt doesn't explicitly forbid HTML
- LLM interprets "flowing prose" as including markup
- Markdown-to-HTML conversion somewhere in pipeline
- Historical content generated before sanitization implemented

**Current codebase evidence:**
```typescript
// strip-html.ts - sanitization exists but must be called
export function stripHtml(html: string | null | undefined): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });
  return clean.replace(/\s+/g, ' ').trim();
}

// MatchContent.tsx - stripHtml called on render
{stripHtml(content.preMatchContent)}
```
Sanitization at render time, but older content in DB still has tags.

**Historical context in project:**
- "HTML tags visible in older content" is documented symptom
- Suggests content was stored with HTML before sanitization was added to render

**Warning signs:**
- `<p>`, `<strong>`, `<ul>` visible in rendered content
- Content contains markdown like `**bold**` or `### Header`
- Database content length much longer than rendered text

**Detection strategy:**
```sql
-- Find content with HTML tags
SELECT id, matchId
FROM match_content
WHERE preMatchContent LIKE '%<%>%'
   OR bettingContent LIKE '%<%>%'
   OR postMatchContent LIKE '%<%>%';
```

**Prevention:**
1. Add to prompt: "Write plain text only. Do not use HTML tags, markdown formatting, or special characters."
2. Sanitize BEFORE storing to database, not just on render
3. Validate content doesn't contain `<` or `>` characters before save

**Recovery:**
1. Query for affected content records
2. Run batch sanitization on existing data
3. Update prompts to prevent future occurrences

---

### Pitfall 7: Timezone Confusion in Scheduled Jobs

**What goes wrong:** Match kickoff is 15:00 local time. Job scheduled for "6 hours before" calculates wrong time due to UTC vs local timezone mismatch.

**Root causes:**
- `kickoffTime` stored in ISO/UTC
- Delay calculated using local system time
- Daylight saving time transitions
- Server in different timezone than expected

**Current codebase evidence:**
```typescript
// scheduler.ts line 109-110
const kickoff = new Date(match.kickoffTime).getTime();
const now = Date.now();
// delay calculation is timezone-agnostic (milliseconds)
```
This is correct approach (using timestamps), but any code using formatted dates could have issues.

**Warning signs:**
- Jobs run 1 hour early/late after DST changes
- Logs show job scheduled for unexpected times
- Content generated at wrong time relative to kickoff

**Prevention:**
1. Always use Unix timestamps for scheduling calculations
2. Never format dates for scheduling purposes
3. Log both scheduled time and current time in UTC
4. Test scheduling across DST boundary

**Recovery:**
1. Audit all date calculations for timezone handling
2. Add explicit UTC logging to scheduler
3. Reschedule affected jobs

---

### Pitfall 8: Memory Leak in Long-Running Worker

**What goes wrong:** Content worker runs for days/weeks. Memory usage grows. Eventually OOM killed. All in-progress jobs become stalled.

**Root causes:**
- Closure retaining references to large objects
- Accumulating event listeners
- Growing internal caches
- Memory not released between jobs

**Warning signs:**
- Worker memory usage grows over time
- Periodic OOM kills in container logs
- Performance degrades over worker uptime

**Prevention:**
1. Implement worker recycling (restart after N jobs or N hours)
2. Use memory profiling in development
3. Clear large objects after job completion
4. Set memory limits with graceful shutdown

**Recovery:**
1. Restart worker process
2. Investigate memory profile
3. Add recycling configuration

---

## Minor Pitfalls (Cause Annoyance)

### Pitfall 9: Inconsistent Content Quality

**What goes wrong:** Some content is excellent, some is generic or repetitive. No consistent quality baseline.

**Root causes:**
- Temperature too high (0.7) causes variability
- Prompt doesn't specify tone/style strictly
- Different data availability per match affects output
- Model version changes affect quality

**Warning signs:**
- User complaints about content quality variance
- Some content reads like template fill-in
- Lack of match-specific insights

**Prevention:**
1. Add explicit quality criteria to prompts
2. Consider lower temperature (0.5) for consistency
3. Add post-generation quality checks
4. A/B test prompt variations

---

### Pitfall 10: Cost Tracking Drift

**What goes wrong:** Token counting and cost estimation become inaccurate. Budget surprises.

**Root causes:**
- Pricing changes not reflected in config
- Token counting differs from billing
- Retry attempts not counted

**Current codebase evidence:**
```typescript
// config.ts line 23-26
pricing: {
  inputCostPerMillion: 0.27,  // USD
  outputCostPerMillion: 0.85, // USD
}
```
These prices need verification against current Together AI pricing.

**Prevention:**
1. Monthly audit of pricing against provider docs
2. Compare estimated vs actual billing
3. Include retry tokens in cost tracking

---

### Pitfall 11: Log Noise Obscuring Real Errors

**What goes wrong:** Every content generation logs extensively. Real errors buried in noise. Alert fatigue.

**Warning signs:**
- Hundreds of log lines per minute
- "Error" level used for expected conditions
- Can't find relevant logs during incident

**Prevention:**
1. Use debug level for routine operations
2. Reserve error level for actionable issues
3. Add correlation IDs to track job lifecycle
4. Implement log sampling for high-volume operations

---

## Silent Failure Patterns

These are the most dangerous failures - no error thrown, no content generated.

### Pattern A: Non-Blocking Function Returns False

**Current implementation:**
```typescript
// match-content.ts line 142-152
} catch (error) {
  log.error({ matchId, err: error.message }, 'Pre-match content generation failed');
  return false; // Non-blocking: don't throw
}
```

**The risk:** Caller logs warning and continues. No retry. No alert. Content missing.

**Mitigation:**
1. Track `false` returns as metric, not just errors
2. Alert if false-return rate exceeds threshold
3. Ensure backfill scan catches these misses

### Pattern B: Empty Query Results Skip Processing

**Current implementation:**
```typescript
// content.worker.ts line 157-160
if (matchesNeedingPreviews.length === 0) {
  log.info('No matches need previews at this time');
  return { scanned: 0, queued: 0, failed: 0 };
}
```

**The risk:** Query bug returns empty results. Worker reports "nothing to do." Content never generated.

**Mitigation:**
1. Log query parameters, not just result count
2. Alert if zero results for extended period during active match days
3. Sanity check: if matches exist in window, something should need content

### Pattern C: Successful Job With No Database Update

**The risk:** LLM call succeeds. Database write fails. Job completes successfully. Content lost.

**Mitigation:**
1. Verify database write after insert
2. Read-after-write validation for critical content
3. Alert on discrepancy between generation logs and database state

---

## Phase-Specific Warnings Summary

| Phase | Critical Pitfalls | Mitigation |
|-------|------------------|------------|
| Job Scheduling | #1 (drift), #7 (timezone) | Worker monitoring, UTC timestamps |
| LLM Integration | #2 (silent empty), #3 (JSON parse), #4 (rate limit) | Content validation, retry strategy, circuit breaker |
| Content Storage | #6 (HTML sanitization) | Sanitize before save, validate on write |
| Worker Management | #5 (lock expiry), #8 (memory leak) | Lock duration config, worker recycling |
| Monitoring | #11 (log noise), Silent Patterns | Structured logging, false-return tracking |

---

## Immediate Actions for Current Symptoms

### For "All matches missing content":

1. **Check worker status:**
   ```bash
   # Is worker running?
   pm2 status
   # Are jobs processing?
   redis-cli LLEN bull:content-queue:waiting
   ```

2. **Check for errors in last 24h:**
   ```bash
   grep -i "error\|fail" /var/log/content-worker.log | tail -100
   ```

3. **Verify scan job is running:**
   - Check if `scan_match_content` job exists in queue
   - Verify cron schedule is active

### For "HTML tags in older content":

1. **Identify affected records:**
   ```sql
   SELECT COUNT(*) FROM match_content
   WHERE preMatchContent LIKE '%<%>%';
   ```

2. **Run batch sanitization:**
   ```typescript
   // One-time migration script
   const affected = await db.select().from(matchContent)
     .where(sql`preMatchContent LIKE '%<%>%'`);

   for (const row of affected) {
     await db.update(matchContent)
       .set({ preMatchContent: stripHtml(row.preMatchContent) })
       .where(eq(matchContent.id, row.id));
   }
   ```

---

## Confidence Assessment

| Pitfall Category | Confidence | Basis |
|-----------------|------------|-------|
| Job Scheduling | HIGH | BullMQ docs + codebase analysis |
| LLM API Failures | HIGH | Together AI docs + common patterns |
| JSON Parsing | HIGH | Codebase shows existing handling, known LLM issue |
| Rate Limiting | HIGH | Together AI docs confirm dynamic limits |
| Worker Management | MEDIUM | General BullMQ patterns, needs production validation |
| Silent Failures | HIGH | Codebase analysis shows non-blocking patterns |

---

## Sources

**BullMQ Documentation:**
- [Going to Production](https://docs.bullmq.io/guide/going-to-production) - Production best practices
- [Troubleshooting](https://docs.bullmq.io/guide/troubleshooting) - Common errors and solutions
- [Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) - Retry configuration
- [Failing Fast When Redis is Down](https://docs.bullmq.io/patterns/failing-fast-when-redis-is-down) - Connection handling

**BullMQ Production Issues:**
- [How to Handle Worker Crashes in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-worker-crashes-recovery/view)
- [How to Handle Stalled Jobs in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-stalled-jobs/view)

**Together AI:**
- [Inference Rate Limits](https://docs.together.ai/docs/rate-limits) - Rate limit documentation
- [Together AI Rate Limit Exceeded](https://drdroid.io/integration-diagnosis-knowledge/together-ai-rate-limit-exceeded) - Error handling

**LLM Output Handling:**
- [Handling LLM Output Parsing Errors](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/handling-parsing-errors)
- [Handle Invalid JSON Output for Small Size LLM](https://watchsound.medium.com/handle-invalid-json-output-for-small-size-llm-a2dc455993bd)
- [Handling and Fixing Malformed JSON in LLM-Generated Responses](https://medium.com/@sd24chakraborty/handling-and-fixing-malformed-json-in-llm-generated-responses-f6907d1d1aa7)
- [Why Your LLM Returns "Sure! Here's the JSON" and How to Fix It](https://dev.to/acartag7/why-your-llm-returns-sure-heres-the-json-and-how-to-fix-it-2b1g)

**LLM Pipeline Patterns:**
- [Common Errors in LLM Pipelines and How to Fix Them](https://www.newline.co/@zaoyang/common-errors-in-llm-pipelines-and-how-to-fix-them--be9a72b6)
- [How to Debug LLM Failures: A Complete Guide](https://dev.to/kuldeep_paul/how-to-debug-llm-failures-a-complete-guide-3iil)
- [AI System Design Patterns for 2026](https://zenvanriel.nl/ai-engineer-blog/ai-system-design-patterns-2026/)

---

*Researched: 2026-02-04*
*Researcher: Claude (gsd-researcher)*
*Focus: Content generation pipeline failure modes*
