# Phase 32: Make Failures Visible - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert silent failures in content generation to proper thrown errors that BullMQ can retry and track. Content generation functions currently return false on failure — they should throw errors instead, enabling BullMQ's retry mechanism and dead letter queue.

</domain>

<decisions>
## Implementation Decisions

### Error Throwing Behavior
- Full diagnostic info in errors: match context (ID, teams, date) + request params + partial response if any
- Separate error classes: RetryableError for rate limits/timeouts, FatalError for invalid data/auth failures
- Structured JSON logging for errors (in addition to BullMQ tracking) for log aggregation

### Retry Semantics
- 5 retry attempts before job goes to DLQ
- Exponential backoff: 30s, 1m, 2m, 4m, 8m
- Special handling for rate limit errors (429): respect Retry-After header if present, longer base delay
- DLQ auto-clean after 7 days

### Content Validation
- Detect and reject common placeholder patterns: '[TEAM NAME]', 'lorem ipsum', 'TODO', etc.
- Validation runs before database save
- Invalid content is a retryable error (LLM might produce valid content on retry)

### Lock Configuration
- 2 minute lock duration before job considered stalled
- Heartbeat pattern: job periodically extends lock while actively processing
- Stalled jobs auto-retry using normal retry logic
- Concurrency limit: 3 parallel content jobs (avoid overwhelming LLM API)

### Claude's Discretion
- Exact minimum content length thresholds (may vary by content type)
- Fatal error handling: whether to skip remaining retries or give one more chance
- Specific placeholder patterns to detect beyond the common ones

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that follow BullMQ best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-make-failures-visible*
*Context gathered: 2026-02-04*
