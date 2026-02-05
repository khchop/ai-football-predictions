# Phase 41: Together AI Fallbacks - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Synthetic model failures automatically fall back to Together AI equivalents with cycle detection and cost tracking. Handles failure detection, mapping configuration, cost monitoring, and admin visibility. Does not add new models or change model behavior — only provides resilience when Synthetic fails.

</domain>

<decisions>
## Implementation Decisions

### Fallback Mapping
- 1:1 same-model mapping: Kimi K2.5-syn → Together Kimi K2.5, GLM-4.6-syn → Together GLM-4.6
- If no Together AI equivalent exists, fail the prediction (no fallback available)
- Explicit configuration: each model declares `fallbackModelId` in config — no auto-discovery
- Attribution: show prediction as original model (e.g., "Kimi K2.5-syn") but track fallback internally

### Failure Detection
- Any error triggers fallback: timeout, parse error, empty response, API error, rate limit
- No retries on original model — first failure immediately triggers fallback
- If fallback also fails, fail the prediction (max depth 1, no fallback chains)
- Rate limits treated same as other errors — no special wait-and-retry logic

### Cost Visibility
- Admin dashboard only — not per-prediction, not public
- Warning threshold: alert when fallback cost >2x original Synthetic cost
- Warning delivery: visual badge on admin dashboard
- Estimated costs only (token counts × published rates) — no billing API integration

### Transparency
- Users don't see fallbacks — predictions show original model name
- Admin dashboard shows per-model fallback rates (e.g., "GLM-4.6-syn: 15% fallback")
- No impact on leaderboard rankings — accuracy is what matters, not reliability
- Minimal database tracking: boolean `usedFallback` flag only

### Claude's Discretion
- Exact dashboard layout for fallback statistics
- Cost estimation calculation details
- Cycle detection implementation approach
- Logging verbosity for fallback events

</decisions>

<specifics>
## Specific Ideas

- Keep it simple: 1:1 mapping, immediate fallback, minimal tracking
- Fallbacks are internal plumbing — users should never know they happened
- Admin visibility focused on actionable metrics (which models fail, how much extra cost)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-together-ai-fallbacks*
*Context gathered: 2026-02-05*
