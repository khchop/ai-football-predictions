# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The prediction pipeline must reliably generate scores from 21 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

**Current focus:** v3.0 Club/Team Pages - Phase 71 AI Content & FAQ Generation

## Current Position

Phase: 71 of 71 (AI Content & FAQ Generation)
Plan: 1 of 2 in current phase
Status: Phase 71 in progress - Plan 01 complete (content infrastructure)
Last activity: 2026-02-12 - Completed 71-01: teamContent table + AI generation functions

Progress: [██████████████████████████████████████████░] 99.5% (v2.9 complete, v3.0 Phases 67-70 complete, Phase 71: 1/2 plans done)

## Performance Metrics

**Velocity:**
- Total plans completed: 173 plans (phases 1-62, 67-70, 71-01) + 5 quick tasks (quick-037 through quick-043)
- Milestones shipped: 14 (v1.0 through v2.9)
- v3.0 in progress: Phases 67-70 complete (8/8 plans), Phase 71: 1/2 plans done

**Recent Milestones:**
- v2.9 Provider Unification: Phases 59-62 built infra, quick-040/041 completed by removing Synthetic+Together (shipped 2026-02-11)
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
- [Phase 71-01]: Use text timestamps (not timestamp type) to match matchContent pattern
- [Phase 71-01]: Separate analysisGeneratedAt and faqGeneratedAt for independent generation
- [Phase 71-01]: Skip teams with <5 matches (insufficient data for meaningful analysis)
- [Phase 71-01]: Direct imports (./together-client) to avoid circular dependencies

### Pending Todos

**v3.0 todos:**
- Phase 71-02: Next up (wire content generation into queue worker + team page UI)
- Post-deployment: Test team page internal linking graph in Search Console
- Decide canonical URL strategy for duplicate content (leaderboard vs team pages)
- Monitor AI content generation cost (~$0.20 for 200 teams full batch)

### Blockers/Concerns

**v3.0 considerations:**
- No blockers - Phase 71-01 complete (content infrastructure ready)
- Phase 71-02 remaining: queue worker + UI rendering

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 040 | Remove all Synthetic providers, use OpenRouter when possible | 2026-02-11 | e8bd822 | [040-remove-synthetic-providers-use-openroute](./quick/040-remove-synthetic-providers-use-openroute/) |
| 041 | Remove Together AI provider, move all models to OpenRouter, deduplicate model entries | 2026-02-11 | 0dba995 | [041-remove-together-ai-provider-move-all-mod](./quick/041-remove-together-ai-provider-move-all-mod/) |
| 042 | Fix match card click navigation - card body to match detail, team names to team pages | 2026-02-11 | 8a65d44 | [042-fix-match-boxes-linking-to-team-pages-in](./quick/42-fix-match-boxes-linking-to-team-pages-in/) |
| 043 | Reduce OpenRouter spend: trim 38→21 models, retries 5→2, cap reasoning tokens, wire cost tracking | 2026-02-12 | fd6fcd1 | [43-reduce-openrouter-spend-trim-expensive-m](./quick/43-reduce-openrouter-spend-trim-expensive-m/) |
| Phase 71 P01 | 275 | 2 tasks | 4 files |

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed Phase 71-01 (teamContent table + AI generation functions)
Resume file: .planning/phases/71-ai-content-generation/71-01-SUMMARY.md

**Next action:** Execute Phase 71-02 (queue worker + team page rendering)

---
*Last updated: 2026-02-12 after Phase 71-01 (team content infrastructure)*
