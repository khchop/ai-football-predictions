# Domain Pitfalls: Content Generation Pipeline

**Domain:** BullMQ + LLM content generation
**Researched:** 2026-02-04
**Focus:** What causes content to silently not be generated

---

## Critical Pitfalls

Mistakes that cause missing content without visible errors.

### Pitfall 1: Silent Failure Pattern

**What goes wrong:** Content generation functions return `false` instead of throwing errors.

**Why it happens:** Design intent was "non-blocking" - content generation shouldn't block match scoring. But this makes failures invisible.

**Code location:**
```typescript
// src/lib/content/match-content.ts - ALL three functions
} catch (error) {
  log.error({ matchId, err }, 'Post-match content generation failed');
  return false;  // <-- SILENT FAILURE
}
```

**Consequences:**
- Job completes "successfully" with `false` result
- No BullMQ retry triggered
- No DLQ entry created
- Content gap not visible in queue monitoring
- Only discoverable by querying database for NULL content fields

**Prevention:**
```typescript
// Option A: Throw the error (enables retry)
} catch (error) {
  log.error({ matchId, err }, 'Post-match content generation failed');
  throw error;  // Let BullMQ handle retry
}

// Option B: Separate "optional" path from "required" path
// In scoring worker:
try {
  await generatePostMatchContent(matchId);  // Non-blocking
} catch (err) {
  // Queue a dedicated content job for retry
  await contentQueue.add('generate-post-match', { matchId, retryReason: err.message });
}
```

**Detection:**
```sql
-- Find finished matches without post-match content
SELECT m.id, m.home_team, m.away_team, m.kickoff_time
FROM matches m
LEFT JOIN match_content mc ON m.id = mc.match_id
WHERE m.status = 'finished'
  AND m.kickoff_time > NOW() - INTERVAL '7 days'
  AND mc.post_match_content IS NULL;
```

### Pitfall 2: Scan Query Timing Windows

**What goes wrong:** `scan_match_content` job uses time windows that can miss matches.

**Why it happens:** Query filters for matches within `hoursAhead` but match status may change after the window.

**Code location:**
```typescript
// src/lib/content/queries.ts
export async function getMatchesMissingPreMatchContent(hoursAhead: number = 24) {
  // ...
  .where(
    and(
      eq(matches.status, 'scheduled'),  // Only scheduled
      gte(matches.kickoffTime, now.toISOString()),
      lte(matches.kickoffTime, targetTime.toISOString()),
      // ...
    )
  )
}
```

**Consequences:**
- Match scheduled for T+25h: Not in window (24h default)
- Match goes live at T-1h: No longer 'scheduled', missed by pre-match scan
- Backfill only catches matches that STILL have `scheduled` status

**Prevention:**
- Extend `hoursAhead` to 48h or more
- Remove status filter for pre-match (generate even for live/finished if not yet generated)
- Add separate "catch-up" query that ignores time window

**Detection:**
```bash
# Check if scan_match_content is finding anything
grep "Content scan complete" logs/*.log | tail -10
# Look for: generated: 0, remaining: 0
```

### Pitfall 3: Together AI JSON Parsing Failures

**What goes wrong:** LLM returns malformed JSON, parsing fails, content not generated.

**Why it happens:** AI models occasionally output broken JSON (unclosed quotes, invalid escapes, markdown wrapper).

**Code location:**
```typescript
// src/lib/content/together-client.ts
try {
  parsedContent = JSON.parse(jsonString) as T;
} catch (parseError) {
  loggers.togetherClient.error({
    content: content.substring(0, 500),
    error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
  }, 'Failed to parse response as JSON');
  throw new Error(`Failed to parse AI response as JSON: ...`);
}
```

**Consequences:**
- Error thrown in Together client
- Caught by content generation function
- Returns `false` (silent failure)
- No content generated

**Prevention:**
- The code already attempts to fix common JSON issues
- Add retry with different prompt if parsing fails
- Fall back to raw text extraction for key fields

**Detection:**
```bash
# Check for JSON parsing errors
grep "Failed to parse response as JSON" logs/*.log
```

---

## Moderate Pitfalls

Mistakes that cause delays or partial content.

### Pitfall 4: Rate Limiting Backoff

**What goes wrong:** Together AI rate limits (429) cause exponential backoff, delaying content.

**Why it happens:** Content worker concurrency=1, limiter max=30/min, but scan jobs can queue many items.

**Code location:**
```typescript
// src/lib/queue/workers/content.worker.ts
{
  concurrency: 1,
  limiter: {
    max: 30,     // Max 30 requests per minute
    duration: 60000,
  },
}
```

**Consequences:**
- Queue backup during high-volume periods
- Content generated hours after match finishes
- User sees empty content sections

**Prevention:**
- Monitor queue depth
- Prioritize post-match content over previews
- Consider higher concurrency with better rate limiting

**Detection:**
```bash
# Check content queue depth
curl -H "X-Admin-Password: $ADMIN_PASSWORD" https://kroam.xyz/api/admin/queue-status | \
  jq '.queues["content-queue"]'
```

### Pitfall 5: Missing Analysis Data

**What goes wrong:** Pre-match content generation fails because no analysis data exists.

**Why it happens:** Analysis worker hasn't run yet, or failed.

**Code location:**
```typescript
// src/lib/content/match-content.ts
const { match, analysis } = matchData[0];
// analysis can be null if not yet fetched

const prompt = `...
Betting Odds (1X2):
- Home: ${analysis?.oddsHome || 'N/A'}  // Falls back to N/A
```

**Consequences:**
- Content generated but quality is poor (lots of "N/A")
- Better than no content, but not ideal

**Prevention:**
- Check for analysis before generating pre-match content
- Skip generation if critical data missing
- Re-queue for later attempt

### Pitfall 6: Predictions Not Scored Yet

**What goes wrong:** Betting content generated but predictions haven't been scored.

**Why it happens:** Timing issue - content scan runs before scoring worker.

**Code location:**
```typescript
// src/lib/content/queries.ts
.where(
  and(
    eq(matches.status, 'scheduled'),  // Only scheduled matches
    // ...
  )
)
```

**Consequences:**
- Betting content shows predictions but no point values
- Content becomes stale after match finishes

**Prevention:**
- Generate betting content closer to kickoff (T-30m instead of T-6h)
- Regenerate after scoring completes

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 7: Duplicate Content Generation Attempts

**What goes wrong:** Same content generated multiple times due to timing.

**Why it happens:** Scan job and individual generation job both queue the same match.

**Code location:**
```typescript
// src/lib/queue/workers/content.worker.ts - scanMatchesNeedingPreviews
await contentQueue.add(
  'generate-match-preview',
  { ... },
  {
    jobId: `preview-${match.id}`,  // Prevents duplicates
  }
);
```

**Consequences:**
- Wasted LLM calls (cost)
- Potential race conditions

**Mitigation:** Job IDs already prevent duplicate jobs. Just ensure all paths use consistent IDs.

### Pitfall 8: Content Table Fragmentation

**What goes wrong:** Hard to audit content completeness across multiple tables.

**Current tables:**
- `match_content` (pre-match, betting, post-match)
- `match_roundups` (long-form narrative)
- `match_previews` (legacy)
- `blog_posts` (league roundups)

**Consequences:**
- Complex queries to check completeness
- Inconsistent data model

**Mitigation:** `getMatchContentUnified` query exists but adds complexity.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Investigation | Silent failures hiding root cause | Query database directly for NULL fields |
| Fix failures | Breaking non-blocking design | Use separate retry queue instead of inline throw |
| Improve observability | Metric overhead | Sample metrics, don't track every call |
| Circuit breaker | Opens too aggressively | Tune thresholds based on actual error rates |

---

## Quick Reference: Where Content Can Fail

| Content Type | Generation Path | Failure Point | Silent? |
|--------------|-----------------|---------------|---------|
| Pre-match | `scan_match_content` -> `generatePreMatchContent` | Together AI error | YES |
| Betting | `scan_match_content` -> `generateBettingContent` | Together AI error | YES |
| Post-match | `scoring.worker` -> `generatePostMatchContent` | Together AI error | YES |
| Roundup | `content.worker` -> `generatePostMatchRoundup` | Together AI error | NO (throws) |
| Preview | `content.worker` -> `generateMatchPreview` | Together AI error | NO (throws) |
| League Roundup | `content.worker` -> `generateLeagueRoundup` | Together AI error | NO (throws) |

**Key insight:** The three short-form content types in `match-content.ts` all use the silent failure pattern. The long-form types in `generator.ts` properly throw.

---

## Sources

- Codebase analysis: Direct examination of error handling in content generation code
- Production logs: Historical error patterns (Together AI rate limits, JSON parsing)
- Queue monitoring: Job completion vs content creation correlation
