# Phase 48: Performance & Verification - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize TTFB for slow pages and verify all v2.6 SEO fixes (Phases 44-47) pass Ahrefs re-audit with site health score >90. This is the final phase of the v2.6 milestone. No new SEO features — only performance optimization and verification of existing work.

</domain>

<decisions>
## Implementation Decisions

### TTFB Investigation Scope
- Profile ALL page types systematically (match, league, model, blog, index pages)
- Threshold: investigate pages with TTFB >2s (as stated in roadmap requirements)
- Fix easy wins, document complex issues that need bigger changes for future work
- Measurement: build-time audit script + post-deploy production measurement against kroam.xyz

### Optimization Approach
- /matches/UUID redirect: verify middleware-only is fast enough (<500ms), no edge caching unless needed
- All optimization techniques acceptable: query optimization, caching/PPR tuning, component-level fixes (lazy loading, bundle reduction)
- New dependencies allowed if they clearly help performance (runtime or dev)
- TTFB audit integration: Claude's discretion on whether to add as Pass 6 in existing audit or separate script

### Verification Process
- User runs Ahrefs site audit manually — Claude prepares the site to be audit-ready
- No additional validation tools needed (Google Rich Results Test, etc.) — Ahrefs is the tool of record
- If Ahrefs reveals NEW issues not covered by phases 44-47, fix them in this phase (this is the cleanup phase)
- Pre-audit spot-checks: Claude's discretion on what to verify before declaring ready

### Success Threshold
- Hard requirement: Ahrefs health score >90 (not negotiable)
- Zero critical or high-severity errors in Ahrefs specifically (Ahrefs is the only tool of record)
- TTFB optimization is best-effort — optimize what's reasonable, document the rest. Not a blocker if some pages remain >2s due to cold start or external factors
- Milestone closure: decide after Ahrefs audit results whether v2.6 is complete or needs additional phases

### Claude's Discretion
- Whether TTFB measurement becomes Pass 6 in existing audit or a separate script
- Which pre-audit spot-checks to run before declaring site ready for Ahrefs
- Specific profiling methodology and tooling choices
- Order of page types to investigate for TTFB

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The primary deliverable is an Ahrefs-ready site with health score >90.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 48-performance-verification*
*Context gathered: 2026-02-06*
