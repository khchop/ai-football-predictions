# Research Summary: Content Generation Pipeline Reliability

**Domain:** BullMQ-based content generation for AI football predictions
**Researched:** 2026-02-04
**Overall confidence:** HIGH

---

## Executive Summary

The content generation pipeline for the betting soccer app has a well-architected foundation using BullMQ for job scheduling, Together AI for LLM generation, and PostgreSQL for storage. However, the current implementation suffers from a critical **silent failure pattern** where content generation errors are logged but not propagated to the job system, making failures invisible to monitoring and preventing automatic retries.

The investigation revealed that ALL three short-form content types (pre-match, betting, post-match) in `match-content.ts` return `false` on failure instead of throwing errors. This means jobs "succeed" even when content generation fails, and the content gap is only discoverable by directly querying the database for NULL fields.

The existing backfill mechanism (`scan_match_content` at :15 hourly) is designed to catch these gaps, but it relies on time-window queries that can miss edge cases, and it's rate-limited to 10 generations per scan, which may be insufficient during high-volume periods.

---

## Key Findings

**Architecture:** Fundamentally sound - proper idempotency, BullMQ retry configuration, and DLQ support exist.

**Root Cause:** Silent failure pattern - content generation catches errors and returns `false` instead of throwing, bypassing BullMQ retry mechanism.

**Critical File:** `src/lib/content/match-content.ts` - all three functions (`generatePreMatchContent`, `generateBettingContent`, `generatePostMatchContent`) use this pattern.

**Contrast:** Long-form content in `src/lib/content/generator.ts` properly throws errors, triggering retries.

**Observability Gap:** No alerting when content is missing; DLQ only receives jobs that throw errors.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Investigation (1 day)

**Rationale:** Before fixing, confirm the actual break point for yesterday's missing content.

**Actions:**
1. Query database for matches with NULL `post_match_content`
2. Check `/api/admin/queue-status` for content queue health
3. Check logs for "content generation failed" messages
4. Check DLQ for any content-related failures

**Output:** Confirmed root cause (likely silent failures)

### Phase 2: Make Failures Visible (1-2 days)

**Rationale:** Addresses the critical silent failure pattern.

**Actions:**
1. Modify `generatePostMatchContent` to throw errors
2. Modify `generatePreMatchContent` and `generateBettingContent` similarly
3. Update scoring worker to handle thrown errors appropriately
4. Test that failures now trigger BullMQ retries

**Output:** Content failures now visible in DLQ, automatic retries enabled

### Phase 3: Backfill Missing Content (1 day)

**Rationale:** Fix the gap from yesterday's failures.

**Actions:**
1. Run database query to identify all matches missing content
2. Trigger manual backfill via admin endpoint or one-off script
3. Monitor content generation completion

**Output:** Historical content gaps filled

### Phase 4: Improve Observability (1-2 days)

**Rationale:** Prevent future silent content gaps.

**Actions:**
1. Add content completeness check query
2. Add alerting when finished matches lack content after X hours
3. Improve `/api/admin/queue-status` with content-specific metrics

**Output:** Proactive monitoring of content pipeline health

**Phase ordering rationale:**
- Investigation first to confirm hypothesis
- Make failures visible before adding monitoring (so monitoring has something to detect)
- Backfill only after failures are visible (to catch new failures)
- Observability last as it builds on the fixed system

**Research flags for phases:**
- Phase 1: Standard investigation, low complexity
- Phase 2: Requires careful handling of "non-blocking" intent - may need separate retry queue
- Phase 3: Standard database operations
- Phase 4: May need deeper research on metrics/alerting approach

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Root cause (silent failures) | HIGH | Direct code analysis confirms pattern |
| Fix approach (throw errors) | HIGH | Standard error handling pattern |
| BullMQ retry behavior | HIGH | Verified in configuration |
| Backfill mechanism | MEDIUM | Queries may have edge cases not fully analyzed |
| Observability gaps | HIGH | Clear from code - no metrics/alerts |

---

## Gaps to Address

1. **Together AI error types:** Need to verify which errors are transient (should retry) vs permanent (should fail fast)
2. **Rate limiting impact:** May need to analyze actual request rates vs limits
3. **Timezone edge cases:** Query time windows use Europe/Berlin timezone; edge cases at DST transitions not fully analyzed
4. **Long-running job handling:** Jobs with 10-minute timeout may need special consideration

---

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/content-pipeline/ARCHITECTURE.md` | System structure, investigation strategy, reliability patterns |
| `.planning/research/content-pipeline/PITFALLS.md` | Domain-specific failure modes and prevention |
| `.planning/research/content-pipeline/SUMMARY.md` | This file - synthesis with roadmap implications |

---

## Quick Investigation Commands

```bash
# 1. Check for matches missing post-match content (last 24h)
psql $DATABASE_URL -c "
SELECT m.id, m.home_team, m.away_team, m.kickoff_time, m.status
FROM matches m
LEFT JOIN match_content mc ON m.id = mc.match_id
WHERE m.status = 'finished'
  AND m.kickoff_time > NOW() - INTERVAL '24 hours'
  AND mc.post_match_content IS NULL;
"

# 2. Check content queue health
curl -H "X-Admin-Password: $ADMIN_PASSWORD" \
  https://kroam.xyz/api/admin/queue-status | \
  jq '.queues["content-queue"]'

# 3. Check for content generation errors in logs
grep "content generation failed" logs/*.log | tail -20

# 4. Check DLQ for content failures
curl -H "X-Admin-Password: $ADMIN_PASSWORD" \
  https://kroam.xyz/api/admin/dlq | jq '.entries[] | select(.queueName == "content-queue")'
```

---

## Summary

The content generation pipeline architecture is sound, but the silent failure pattern creates a blind spot. The fix is straightforward: convert `return false` to `throw error` in the three short-form content generation functions. This will enable BullMQ's retry mechanism and make failures visible in the DLQ, allowing for monitoring and alerting.
