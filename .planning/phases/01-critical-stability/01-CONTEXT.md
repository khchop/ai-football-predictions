# Phase 1: Critical Stability - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Stop production crashes and ensure predictions complete reliably. This phase fixes the prediction pipeline (JSON parsing, timeouts, retries), queue workers (error handling, null checks), database pool (sizing, monitoring), and model health system (auto-disable, recovery). The goal is stability — predictions should complete without crashes even when APIs return malformed data or fail temporarily.

</domain>

<decisions>
## Implementation Decisions

### Error Recovery Strategy
- **Retry count:** 5 retries before giving up on a prediction job
- **Backoff timing:** Error-type-aware backoff (60s for rate limits, linear for timeouts, 5s for parse errors)
- **UnrecoverableError triggers:** Match started (kickoff passed) OR invalid data (cancelled, postponed, malformed)
- **Jitter:** Claude's discretion based on load patterns

### Model Health Policy
- **Disable threshold:** 5 consecutive failures before auto-disabling a model
- **Recovery window:** 1 hour cooldown before auto-disabled models retry
- **Error classification:** Claude's discretion — determine whether rate limits/timeouts should count toward disable threshold differently than model-specific failures
- **Recovery behavior:** Claude's discretion — determine whether to start fresh (0 failures) or partial count (2 failures) after cooldown

### Logging and Observability
- **Log level:** Verbose — log all job starts/completions, API calls, decisions
- **LLM response logging:** First 500 chars of raw response on parse failures
- **Alerting:** Critical + warnings — model disabled, DB pool exhausted, worker crash, high retry rates, slow queries, API near budget
- **Pool monitoring:** Claude's discretion on frequency and thresholds

### Graceful Degradation
- **Partial predictions:** Show partial results — 20 predictions better than none
- **JSON fallback:** Treat regex-extracted scores as normal — if score extracted, it's valid
- **Worker isolation:** Full isolation — each queue worker is independent, one crash doesn't affect others
- **DB connection failure:** Claude's discretion based on pool behavior

### Claude's Discretion
- Retry jitter timing (0-10s range vs none)
- Error type classification for auto-disable
- Recovery failure count after cooldown
- DB pool monitoring frequency
- DB connection failure handling within jobs

</decisions>

<specifics>
## Specific Ideas

- Error-type-aware backoff is key — research already identified 60s/linear/5s pattern as appropriate
- Model health should distinguish transient (API issues) from permanent (bad model) failures
- Verbose logging essential for debugging production issues — but cap LLM responses at 500 chars
- Full worker isolation prevents cascade failures — existing architecture supports this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-critical-stability*
*Context gathered: 2026-01-31*
