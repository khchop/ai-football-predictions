# Pitfalls Research

## Multi-Granularity Stats Engine

### Pitfall 1: Over-Invalidation

**Problem:** Invalidating all cache levels on every match update
**Impact:** Performance degradation, cache thrashing
**Detection:** High cache miss rate, elevated Redis operations

**Prevention:**
- Track which granularity levels are affected by each match
- Match update → determine affected competition → determine affected clubs
- Only invalidate: affected_competition_stats, affected_club_stats
- Overall stats: always invalidate (small, cheap)

**Implementation:**
```typescript
function invalidateStatsCache(match: Match) {
  // Always invalidate overall (one key)
  redis.del('stats:overall');

  // Invalidate only affected competition
  redis.del(`stats:competition:${match.competition_id}:${match.season}`);

  // Invalidate affected clubs (both teams)
  redis.del(`stats:club:${match.home_team_id}:${match.season}`);
  redis.del(`stats:club:${match.away_team_id}:${match.season}`);
}
```

### Pitfall 2: N+1 Query Problems

**Problem:** Fetching stats for each model separately in loops
**Impact:** Database load, slow API responses

**Prevention:**
- Use single aggregation query with GROUP BY
- Fetch all models' stats for a level in one query
- Use batch loading for related data

**Detection:** Slow stats endpoint, high DB connection usage

### Pitfall 3: Stale Data from Materialized Views

**Problem:** Views not refreshed after match completion
**Impact:** Incorrect stats displayed to users

**Prevention:**
- Refresh materialized views synchronously with match scoring
- Or use CONCURRENTLY for zero-downtime refresh
- Add data freshness indicator in UI

**Implementation:**
```sql
-- Refresh materialized view immediately after scoring
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_overall;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_competition;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_club;
```

### Pitfall 4: Missing Indexes for Granular Queries

**Problem:** Slow queries when filtering by competition/club
**Impact:** Timeout on stats API endpoints

**Prevention:**
- Add composite indexes:
  - `(competition_id, season, model_id)` for competition stats
  - `(club_id, season, model_id)` for club stats
- Index partial/completed matches separately

### Pitfall 5: Division by Zero in Averages

**Problem:** Models with no predictions causing NaN in averages
**Impact:** Broken UI, confusing statistics

**Prevention:**
- Handle zero-count cases explicitly
- Return null or 0 for averages with no data
- Add validation before rendering

## Automated Content Generation

### Pitfall 6: LLM Hallucination

**Problem:** LLM generates incorrect match facts or statistics
**Impact:** Bad SEO, user distrust, factual errors

**Prevention:**
- Provide structured data as context, not free text
- Use JSON mode for structured output
- Fact-check key claims against database before publishing
- Use low temperature (0.1-0.3)

**Mitigation:**
- Add confidence scores to generated claims
- Include citations to data sources
- Human review for high-traffic pages

### Pitfall 7: Prompt Injection in Content

**Problem:** Malicious prompts injected into match context
**Impact:** Unexpected LLM behavior, potential security issues

**Prevention:**
- Sanitize all match/team names before prompt
- Use structured output (JSON schema)
- Validate all inputs with Zod

### Pitfall 8: Content Generation Timeout

**Problem:** LLM takes too long, worker timeout
**Impact:** Missing content, retry loops

**Prevention:**
- Set appropriate timeout on LLM calls
- Use streaming for long content
- Implement retry with exponential backoff
- Pre-generate templates for common patterns

### Pitfall 9: Duplicate Content

**Problem:** Similar matches generating identical roundups
**Impact:** SEO duplicate content penalties

**Prevention:**
- Add unique elements to each roundup
- Include model-specific analysis
- Reference historical context
- Generate different opening sentences

### Pitfall 10: SEO Meta Description Duplication

**Problem:** Generated pages with identical meta descriptions
**Impact:** Poor SEO, search ranking issues

**Prevention:**
- Include unique elements in meta:
  - Match score
  - Competition name
  - Top performing model
- Use template with variable injection

## General Platform Pitfalls

### Pitfall 11: Prediction API Rate Limits

**Problem:** Too many predictions generated, hitting API limits
**Impact:** Failed predictions, gaps in data

**Prevention:**
- Implement rate limiting per model
- Batch predictions where possible
- Queue-based processing with backpressure
- Monitor Together.ai usage

### Pitfall 12: Model API Failures

**Problem:** Model unavailable, predictions fail
**Impact: Incomplete leaderboard, gaps**

**Prevention:**
- Retry with exponential backoff
- Fallback to "no prediction" state
- Log failures for analysis
- Auto-disable models after repeated failures

### Pitfall 13: Time Zone Issues

**Problem:** Match times, deadlines in wrong time zone
**Impact:** Predictions for wrong matches, scoring errors

**Prevention:**
- Store all times in UTC
- Use consistent timezone in UI
- Validate against current time

### Pitfall 14: Prediction Deadline Handling

**Problem:** Predictions generated after match started
**Impact:** Invalid predictions in leaderboard

**Prevention:**
- Enforce prediction deadline
- Mark predictions with generated_at timestamp
- Only score predictions generated before match start
- Add validation in scoring service

### Pitfall 15: Data Inconsistency

**Problem:** Match result updated but predictions not rescored
**Impact:** Incorrect points, leaderboard errors

**Prevention:**
- Transactional update: match + scores + points
- Event-driven: score update triggers recalculation
- Consistency check cron job

## Phase Mapping

| Pitfall | Phase | Severity |
|---------|-------|----------|
| Over-invalidation | 2 (Caching) | High |
| N+1 queries | 1 (Foundation) | High |
| Stale materialized views | 1 (Foundation) | High |
| Missing indexes | 1 (Foundation) | High |
| Division by zero | 3 (UI) | Low |
| LLM hallucination | 4 (Content) | High |
| Prompt injection | 4 (Content) | Medium |
| Content timeout | 4 (Content) | Medium |
| Duplicate content | 5 (SEO) | Medium |
| Meta description duplication | 5 (SEO) | Low |
| API rate limits | Any | Medium |
| Model failures | Any | Medium |
| Time zone issues | Any | Low |
| Prediction deadline | Any | High |
| Data inconsistency | Any | High |
