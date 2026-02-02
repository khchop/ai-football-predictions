# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** Phase 6 - Data Migration (next)

## Current Position

Phase: 6 of 8 in progress (Data Migration)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-02 — Completed plan 06-01-PLAN.md (Accuracy Recalculation Migration)

Progress: [████████████████░░░░] 68% (21/31 total planned plans)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 17 plans
- Average duration: 2.8 min per plan
- Total execution time: 47.9 minutes

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Database Resilience | 3 | 9.2 min | 3.1 min |
| 2 - Queue Worker Stability | 4 | 11.5 min | 2.9 min |
| 3 - Scoring & Caching | 6 | 16.8 min | 2.8 min |
| 4 - Frontend Performance | 4 | 10.4 min | 2.6 min |

**v1.1 Phase 5:**

| Plan | Duration | Description |
|------|----------|-------------|
| 05-01 | ~2 min | Stats Service Layer |
| 05-02 | ~3 min | Query Accuracy Fixes |
| 05-03 | ~2 min | Model Page Metadata |
| Total | ~7 min | 3 plans |

**v1.1 Phase 6:**

| Plan | Duration | Description |
|------|----------|-------------|
| 06-01 | ~3 min | Accuracy Recalculation Migration |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0: Bug fixes only scope — existing platform has fundamental value, stability is priority
- v1.1: Stats accuracy before SEO — incorrect stats in structured data damage SEO more than missing structured data
- 05-01: Use `tendencyPoints > 0` formula (not IS NOT NULL) — prevents ~7% accuracy inflation
- 05-01: NULLIF division protection — prevents errors on models with no scored predictions
- 05-02: Also fixed getModelStatsByCompetitionWithRank — same bug pattern discovered during execution
- 05-03: Label accuracy as "tendency accuracy" in metadata — explicit about what metric means
- 06-01: Snapshot-before-modify pattern — stats_pre_migration table preserves rollback capability
- 06-01: JSON verification report format — machine-readable for blog post, human-readable for review
- 06-01: Bug severity revealed — actual impact -48% not -7% (IS NOT NULL counted 0-point predictions)

### Pending Todos

None.

### Blockers/Concerns

**Phase 6 (Data Migration) - UPDATED:**
- User communication CRITICAL: Accuracy drops from ~93% to ~44% (not 87% as estimated)
- Bug was 7x worse than expected: IS NOT NULL counted 0-point predictions as correct
- Mitigation: Blog post must emphasize bug fix, not model degradation
- Context needed: 44% accuracy is realistic for football prediction difficulty
- Verification report ready: .planning/phases/06-data-migration/verification-report.json

**Phase 7 (SEO Enhancement):**
- Google takes 2-4 weeks to re-crawl and update rich snippets after structured data added
- Monitoring: Google Search Console structured data detection + rich snippet impressions

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed plan 06-01 (Accuracy Recalculation Migration)
Resume with: Plan 06-02 (User Communication) - use verification report to generate blog post
