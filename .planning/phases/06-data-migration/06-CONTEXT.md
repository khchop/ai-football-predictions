# Phase 6: Data Migration - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Recalculate historical accuracy stats for all 160 models across 17 leagues using the corrected `tendencyPoints > 0` formula from Phase 5. Preserve audit trail and communicate changes to users. No new features — this is a data correction phase.

</domain>

<decisions>
## Implementation Decisions

### User Communication
- Primary channel: Changelog entry (standard release notes format)
- Secondary: Permanent methodology page explaining "How we calculate accuracy"
- Tone: Technical correction — "We fixed a formula bug that inflated accuracy by ~7%"
- Before/after comparison: Show sample models with old/new values in changelog only, not on model pages

### Rollback Strategy
- Data backup: Snapshot table (`stats_pre_migration`) in database before migration runs
- Rollback trigger: User-reported issues (no automatic triggers)
- Retention: 30 days, then drop snapshot table
- If rollback needed: Keep methodology page but update to explain reversion while investigating

### Migration Execution
- Timing: Live migration (no maintenance window)
- Transition state: Accept brief inconsistency — some pages may show old values for minutes
- Batch size: All at once — single transaction recalculates all 160 models
- Idempotent: Yes, migration script can safely run multiple times

### Verification Approach
- Primary check: Automated comparison against expected formula results
- Scope: All models (comprehensive verification, not just samples)
- Output: Detailed report listing each model with old/new values, suitable for changelog
- Anomaly threshold: Flag deviations exceeding 15% from old value (focus on big changes)

### Claude's Discretion
- Exact schema for snapshot table
- Migration script implementation details
- Verification report format
- Cache invalidation timing after migration

</decisions>

<specifics>
## Specific Ideas

- Methodology page should be permanent reference users can link to
- Detailed verification report can feed directly into changelog entry
- The ~94% → ~87% correction mentioned in STATE.md is the expected magnitude

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-data-migration*
*Context gathered: 2026-02-02*
