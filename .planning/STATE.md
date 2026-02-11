# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

**Current focus:** v3.0 Club/Team Pages - Phase 69 UI Components & Match Display

## Current Position

Phase: 70 of 71 (Navigation & Cross-linking)
Plan: 2 of 2 in current phase
Status: Phase 70 complete
Last activity: 2026-02-11 - Completed 70-02-PLAN.md (Team Links in Match Components)

Progress: [█████████████████████████████████████████░] 99% (62 of 66 v2.9 phases complete, v3.0 Phase 67-70 complete: 8 of 8 plans done)

## Performance Metrics

**Velocity:**
- Total plans completed: 172 plans (phases 1-63, 67-01, 67-02, 68-01, 68-02, 69-01, 69-02, 70-01, 70-02) + 3 quick tasks (quick-37, quick-38, quick-39)
- Milestones shipped: 13 (v1.0 through v2.8), v2.9 95% complete
- v3.0 in progress: Phase 67 complete (2/2), Phase 68 complete (2/2), Phase 69 complete (2/2), Phase 70 complete (2/2, 2026-02-11)

**Recent Milestones:**
- v2.9 Provider Unification: 8 phases (59-66), in progress (phases 59-62 complete)
- v2.8 Model Coverage: 13 plans, 2 days (2026-02-07 to 2026-02-08)
- v2.7 Pipeline Reliability: 9 plans, 2 days (2026-02-06 to 2026-02-07)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.9: Smart multi-provider routing with MODEL_PROVIDER_ROUTES replacing MODEL_FALLBACKS
- v2.9: Provider attribution columns on predictions table for transparency
- v2.9: Model consolidation (merge -syn models into base counterparts)
- v3.0 Planning: Foundation-first approach - solve team name normalization, N+1 queries, and cache cascades before UI work
- v3.0 Planning: Zero new dependencies - reuse existing Next.js routes, Drizzle ORM, Schema.org patterns
- v3.0 Phase 67: Single-query aggregation for team stats (13 CASE WHEN in one SELECT)
- v3.0 Phase 67: Targeted cache invalidation (2 teams instead of 200+ on match completion)
- v3.0 Phase 68-01: Inline stats types in metadata helpers to avoid circular dependencies
- v3.0 Phase 68-01: Team sitemap quality filtering (5+ matches minimum)
- v3.0 Phase 68-01: Parallel Promise.all for team stats in sitemap generation
- [Phase 68-02]: Use 300s ISR revalidation for team detail pages (balance freshness vs performance)
- [Phase 68-02]: Exclude international competitions from teams index (national teams, not clubs)
- [Phase 69-01]: Map 'season' period to dateFrom (Aug 1) for current season filtering in getTeamModelLeaderboard
- [Phase 69-01]: Form indicator renders left-to-right as oldest-to-newest for timeline UX
- [Phase 69-01]: Add W/D/L colored circle badges to recent matches for visual result indication
- [Phase 69-02]: Use horizontal stacked bar with green/yellow/blue segments for prediction distribution
- [Phase 69-02]: Weekly accuracy aggregation (last 20 weeks) for trend chart balances data density with patterns
- [Phase 69-02]: Accuracy color thresholds: green 70%+, yellow 40-70%, red <40% aligned with form indicators
- [Phase 70-01]: Use overlay anchor pattern for league cards to avoid nested links
- [Phase 70-02]: Match hero and match card team names link to /teams/[slug]
- [Phase 70-02]: Removed ISR revalidate config (incompatible with Next.js 16 PPR), use Redis cache with tag invalidation

### Pending Todos

**v2.9 todos:**
- Complete phases 63-66 (model consolidation execution, re-activation, cost tracking, health monitoring)
- Investigate 3 fixable Together AI empty-response failures (kimi-k2-instruct, nemotron-nano-9b-v2, gemma-3n-e4b)

**v3.0 todos:**
- Phase 67: ✅ Complete (67-01 team mapping, 67-02 stats queries & cache)
- Phase 68: ✅ Complete (68-01 team SEO infrastructure, 68-02 team page routes)
- Phase 69: ✅ Complete (69-01 team leaderboard & enhanced stats, 69-02 match display & accuracy charts)
- Phase 70: ✅ Complete (70-01 bidirectional nav links, 70-02 team links in match components)
- Phase 71: Next up (AI content generation)
- Post-deployment: Test team page internal linking graph in Search Console
- Decide canonical URL strategy for duplicate content (leaderboard vs team pages)
- Phase 71: Estimate AI content generation cost (200+ teams × LLM calls)

### Blockers/Concerns

**v2.9 blockers:**
- Phase 63: Model consolidation execution requires production migration coordination
- Phase 64-66: Plan details TBD (awaiting Phase 63 completion)

**v3.0 considerations:**
- No blockers - independent feature milestone
- Research complete with HIGH confidence
- All patterns proven in existing codebase

## Session Continuity

Last session: 2026-02-11
Stopped at: Phase 70 complete (navigation & cross-linking - all internal links implemented)
Resume file: .planning/phases/71-ai-content-generation/ (if exists)

**Next action:** Begin Phase 71 (AI Content Generation) or verify v3.0 completion

---
*Last updated: 2026-02-11 after completing 70-02*
