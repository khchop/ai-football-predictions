# Phase 31: Investigation & Diagnosis - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Confirm root cause of missing content and quantify affected matches before making code changes. This is diagnostic work only — no fixes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Investigation scope
- Look back since deployment (full audit, not just 2026-02-03)
- "Missing content" = either summary OR FAQ missing (not requiring both)
- Track pre-match and post-match content separately as distinct metrics
- Include all matches regardless of status (upcoming, in-progress, finished)

### Output format
- Create markdown report: INVESTIGATION.md in phase folder
- Include full query outputs for reproducibility (not just summaries)
- Diagnosis only — no recommended fixes (that's Phase 32+)
- Include timestamps for when queries were executed (audit trail)

### Verification depth
- Full count of all matches since deployment (no sampling)
- Check both BullMQ queue state AND database outcomes
- Full worker health check: process status, memory, uptime, recent activity
- Check for quality issues: HTML artifacts, truncation, placeholder text

### Root cause approach
- Correlate both queue/log state AND timeline analysis
- Test all likely causes: silent failures, scheduling issues, rate limits, worker death
- Include confidence level (high/medium/low) with reasoning in conclusions
- Claude determines how to handle incomplete logs (note limitation vs block)

### Claude's Discretion
- How to handle missing/incomplete logs
- Query optimization for large datasets
- Report structure and section ordering
- Which specific metrics best demonstrate worker health

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard diagnostic approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-investigation-diagnosis*
*Context gathered: 2026-02-04*
