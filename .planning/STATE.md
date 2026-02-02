# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** v1.1 Milestone complete — ready for audit

## Current Position

Phase: 8 of 8 complete (UX Transparency)
Plan: 2/2 complete
Status: Milestone complete
Last activity: 2026-02-02 — Completed Phase 8 (UX Transparency)

Progress: [████████████████████] 100% (27/27 v1.1 plans)

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

**v1.1 Phase 7:**

| Plan | Duration | Description |
|------|----------|-------------|
| 07-01 | ~4 min | Match Page Schema & Metadata |
| 07-02 | ~6 min | Blog Roundups & Competition Schema |
| 07-03 | ~5 min | SEO Finalization |
| Total | ~15 min | 3 plans |

**v1.1 Phase 8:**

| Plan | Duration | Description |
|------|----------|-------------|
| 08-01 | ~2.1 min | Tooltip Infrastructure |
| 08-02 | ~3 min | Accuracy Display Integration |
| Total | ~5.1 min | 2 plans |

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
- 07-01: Use EventScheduled for all matches — schema.org has no EventCompleted, signal completion via homeTeamScore/awayTeamScore
- 07-01: Dynamic noindex at 30 days for finished matches — balances crawl budget vs. historical value
- 07-01: Predicted score from likelyScores[0] — most probable outcome per bookmaker odds
- 07-03: Sitemap methodology priority 0.7 — important reference page between static and specialized pages
- 07-03: Green accuracy badge on OG images — high contrast on purple gradient for social media visibility
- 07-03: Truncate at word boundaries — prevents mid-word breaks in metadata
- 07-02: Match extraction for roundups — Primary: matchId field, Fallback: parse markdown /matches/ links
- 07-02: Competition pages indexing — Set robots.index: true (were false), competitions are navigation hubs
- 07-02: Unique title templates — Every page type has distinct pattern, site name suffix, under 60 chars
- 08-01: TooltipProvider placement — Single provider in layout.tsx wrapping Navigation/main/Footer avoids nesting
- 08-01: Denominator format — Show "X/Y (Z%)" to reveal sample size, monospace font for number readability
- 08-01: Tooltip delays — 300ms initial, 100ms skip between tooltips balances responsiveness vs accidental triggers
- 08-02: Data source verified — totalPredictions in leaderboard query equals scored predictions (status='scored' filter)

### Pending Todos

None.

### Blockers/Concerns

**Phase 8 (UX Transparency) - COMPLETE:**
- ✅ AccuracyDisplay component shows "X/Y (Z%)" format across all accuracy displays
- ✅ Tooltip infrastructure with methodology explanation and /methodology link
- ✅ Data correctness verified: totalPredictions = scoredPredictions (query filters status='scored')
- ✅ Consistent format across leaderboard, model page, stats grid, competition breakdown
- Human testing recommended: visual formatting, tooltip interactions, mobile responsiveness

**v1.1 Milestone - COMPLETE:**
- ✅ Phase 5: Stats foundation with canonical accuracy formula
- ✅ Phase 6: Data migration with methodology page
- ✅ Phase 7: SEO enhancement with structured data
- ✅ Phase 8: UX transparency with denominator display

## Session Continuity

Last session: 2026-02-02
Stopped at: v1.1 Milestone complete - all 4 phases executed and verified
Resume with: `/gsd:audit-milestone` to verify cross-phase integration before archiving
