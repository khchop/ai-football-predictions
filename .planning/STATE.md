# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** Phase 6 - Data Migration (next)

## Current Position

Phase: 6 of 8 (Data Migration)
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-02-02 — Completed plan 06-02-PLAN.md (User Communication)

Progress: [█████████████████░░░] 71% (22/31 total planned plans)

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
| 06-02 | ~4 min | User Communication (Methodology + Changelog) |
| Total | ~7 min | 2 plans |

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
- 06-02: /methodology route — top-level URL for permanent accuracy calculation reference
- 06-02: Keep a Changelog format — industry standard for documenting changes
- 06-02: Three diverse examples in changelog — shows impact range without overwhelming

### Pending Todos

None.

### Blockers/Concerns

**Phase 6 (Data Migration) - COMPLETE:**
- ✅ User communication addressed: /methodology page and CHANGELOG.md created
- ✅ Bug fix emphasis: Documentation clearly explains IS NOT NULL error
- ✅ Context provided: 50-55% is professional bookmaker range
- ✅ Transparency achieved: Real before/after data from 29 models shown

**Phase 7 (Documentation Cleanup):**
- Cross-linking opportunity: Link /methodology from about page, model pages
- Sitemap update: Add /methodology to sitemap.xml for SEO discoverability

**Phase 8 (SEO Enhancement):**
- Google takes 2-4 weeks to re-crawl and update rich snippets after structured data added
- Monitoring: Google Search Console structured data detection + rich snippet impressions

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed Phase 6 (Data Migration)
Resume with: Phase 7 (Documentation Cleanup) - cross-link methodology page, update sitemap
Continue file: None (phase complete)
