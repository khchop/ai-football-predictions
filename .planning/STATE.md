# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The prediction pipeline must reliably generate scores from 21 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

**Current focus:** v3.1 Model Lifecycle & Discord Alerts

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-12 — Milestone v3.1 started

## Performance Metrics

**Velocity:**
- Total plans completed: 174 plans (phases 1-62, 67-71) + 7 quick tasks
- Milestones shipped: 15 (v1.0 through v3.0)

**Recent Milestones:**
- v3.0 Club/Team Pages: Phases 67-71 (10 plans), 2 days (2026-02-11 → 2026-02-12)
- v2.9 Provider Unification: Phases 59-62 + quick-040/041/042/043 (shipped 2026-02-11)
- v2.8 Model Coverage: 13 plans, 2 days (2026-02-07 → 2026-02-08)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

### Pending Todos

**v3.0 post-deployment:**
- Monitor team content queue worker in production (BullMQ dashboard)
- Verify weekly cron triggers on Sunday 06:00 UTC
- Test event-driven regeneration after match settlement
- Validate FAQPage schema in Google Rich Results Test
- Test team page internal linking graph in Search Console
- Decide canonical URL strategy for duplicate content (leaderboard vs team pages)
- Monitor AI content generation cost (~$0.20 for 200 teams full batch)

### Blockers/Concerns

No blockers — starting v3.1.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 040 | Remove all Synthetic providers, use OpenRouter when possible | 2026-02-11 | e8bd822 | [040-remove-synthetic-providers-use-openroute](./quick/040-remove-synthetic-providers-use-openroute/) |
| 041 | Remove Together AI provider, move all models to OpenRouter, deduplicate model entries | 2026-02-11 | 0dba995 | [041-remove-together-ai-provider-move-all-mod](./quick/041-remove-together-ai-provider-move-all-mod/) |
| 042 | Fix match card click navigation - card body to match detail, team names to team pages | 2026-02-11 | 8a65d44 | [042-fix-match-boxes-linking-to-team-pages-in](./quick/42-fix-match-boxes-linking-to-team-pages-in/) |
| 043 | Reduce OpenRouter spend: trim 38→21 models, retries 5→2, cap reasoning tokens, wire cost tracking | 2026-02-12 | fd6fcd1 | [43-reduce-openrouter-spend-trim-expensive-m](./quick/43-reduce-openrouter-spend-trim-expensive-m/) |

## Session Continuity

Last session: 2026-02-12
Stopped at: Starting milestone v3.1
Resume file: N/A

**Next action:** Define requirements and create roadmap for v3.1

---
*Last updated: 2026-02-12 after v3.1 milestone start*
