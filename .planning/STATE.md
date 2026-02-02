# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** v1.2 Technical SEO Fixes

## Current Position

Phase: 12 of 12 (v1.2 milestone) — Internal Linking COMPLETE
Plan: 2/2 complete
Status: Phase 12 verified, v1.2 milestone complete
Last activity: 2026-02-02 — Completed 12-02-PLAN.md (RecentPredictionsWidget)

Progress: [██████████████████████] 100% (12/12 phases complete)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 17 plans
- Average duration: 2.8 min per plan
- Total execution time: 47.9 minutes

**Velocity (v1.1):**
- Total plans completed: 10 plans
- Phases: 5-8 (Stats Foundation, Data Migration, SEO Enhancement, UX Transparency)
- 79 commits, 218 files changed
- +36,895 / -8,161 lines

**Velocity (v1.2 - Current):**
- Phase 9 plans completed: 3 plans
- Phase 10 plans completed: 2 plans
- Phase 11 plans completed: 2 plans
- Phase 12 plans completed: 2 plans
- Total v1.2 commits: 19
- Phase 12-02 duration: 1.4 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Full decision history available in phase SUMMARY.md files.

**Phase 9 Decisions:**
- Use 308 Permanent Redirect instead of 301 (Next.js permanentRedirect uses 308)
- Add aliases array to CompetitionConfig instead of separate mapping
- Query both competition.id and competition.slug in database for backward compatibility
- Edge-level redirects in next.config.ts for faster redirects before routing

**Phase 10 Decisions:**
- Use sr-only class for H1 tags to preserve visual design while satisfying SEO requirement
- Finished matches: "{home} {score}-{score} {away} Match Report"
- Upcoming matches: "{home} vs {away} AI Predictions"
- Title format (finished): "{home} {score} {away} | kroam.xyz" (concise with brand)
- Title format (upcoming): "{home} vs {away} Prediction" (no brand for length)
- League title: "{competition} Predictions | kroam.xyz" (removed verbose suffix)
- RoundupViewer h1 changed to h2 to maintain single H1 per page (verification fix)

**Phase 11 Decisions:**
- Use permanentRedirect() (308) instead of redirect() with RedirectType.replace (307) for SEO redirects
- Ahrefs noindex report is stale cache - code review confirms all league pages have index:true
- Match pages >30 days old intentionally noindexed (correct SEO practice)
- Orphan page resolution deferred to Phase 12 with detailed strategy

**Phase 12 Decisions:**
- Widget placement in left column below CompetitionTopModels for consistent layout
- Reuse existing getMatchesByCompetitionId query (no new database queries needed)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-02 15:49
Stopped at: Completed Phase 12 (Internal Linking) - v1.2 milestone complete
Resume with: New milestone planning or deployment
