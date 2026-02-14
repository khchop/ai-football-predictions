# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** The prediction pipeline must reliably generate scores from 20 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete.

**Current focus:** v3.2 PageSpeed Optimization

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-14 — Milestone v3.2 started

## Performance Metrics

**Velocity:**
- Total plans completed: 183 plans (phases 1-62, 67-74) + 19 quick tasks
- Milestones shipped: 16 (v1.0 through v3.1)

**Recent Milestones:**
- v3.1 Model Lifecycle & Discord Alerts: Phases 72-74 (5 plans), 2 days (2026-02-12 → 2026-02-13)
- v3.0 Club/Team Pages: Phases 67-71 (10 plans), 2 days (2026-02-11 → 2026-02-12)
- v2.9 Provider Unification: Phases 59-62 + quick-040/041/042/043 (shipped 2026-02-11)

**Trend:** Stable delivery cadence with 1-2 day milestone completion for focused work.

## Accumulated Context

### Decisions

Recent decisions from PROJECT.md affecting future work:

- **Cap at 20 active models** (v3.1): Lifecycle management with archive system
- **Archive excluded by default** (v3.1): Clean UX, opt-in includeArchived flag
- **Fire-and-forget Discord alerts** (v3.1): Avoid pipeline latency from webhook calls
- **Single OpenRouter provider** (v2.9): Eliminated provider complexity, all models on OpenRouter
- **Reduce to 20 models** (v3.1): Cut expensive/underperforming models, cap reasoning tokens
- **Zero error categories in model stats** (quick-046): Historical error attribution not possible from single failureReason; zero is more honest than fabricated data

### Pending Todos

**v3.0 post-deployment:**
- Monitor team content queue worker in production
- Verify weekly cron triggers on Sunday 06:00 UTC
- Test event-driven regeneration after match settlement
- Validate FAQPage schema in Google Rich Results Test
- Decide canonical URL strategy for duplicate content

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 044 | Fix Show Archived button on leaderboard to actually display archived models | 2026-02-13 | 8e261d3 | [044-fix-show-archived-button-on-leaderboard](./quick/044-fix-show-archived-button-on-leaderboard/) |
| 045 | Deep fix: archive inactive models so Show Archived toggle works | 2026-02-13 | 3c71b7b | [045-deep-fix-leaderboard-show-archived](./quick/045-deep-fix-leaderboard-show-archived/) |
| 046 | Fix model health success rate calculation with per-model attempt counting | 2026-02-13 | a8fbd71 | [046-fix-model-health-success-rate-calculatio](./quick/046-fix-model-health-success-rate-calculatio/) |
| 047 | Add natural language score extraction as fallback parser for thinking models | 2026-02-14 | c25e2a8 | [047-add-natural-language-score-extraction-fa](./quick/47-add-natural-language-score-extraction-fa/) |
| 048 | Fix Step 3.5 Flash auto-disable by setting supportsJsonMode false | 2026-02-14 | 7dc89ac | [048-fix-step-3-5-flash-auto-disable-by-setti](./quick/48-fix-step-3-5-flash-auto-disable-by-setti/) |
| 049 | Fix model health stats to exclude auto-disabled models | 2026-02-14 | a694bde | [049-fix-model-health-stats-to-exclude-auto-d](./quick/49-fix-model-health-stats-to-exclude-auto-d/) |
| 050 | Add admin endpoint to re-aggregate model stats | 2026-02-14 | df20bf4 | [050-add-admin-endpoint-to-re-aggregate-model](./quick/50-add-admin-endpoint-to-re-aggregate-model/) |
| 051 | Add MiniMax M2.5 as new model without substitution | 2026-02-14 | 95fba84 | [051-add-minimax-m2-5-as-new-model-without-su](./quick/51-add-minimax-m2-5-as-new-model-without-su/) |
| 052 | Sync active models - ensure exactly 21 models | 2026-02-14 | 2a08b9b | [052-sync-active-models-ensure-exactly-21-mod](./quick/52-sync-active-models-ensure-exactly-21-mod/) |
| 053 | Add detailed model errors to Discord notifications | 2026-02-14 | bd81a32 | [053-add-detailed-model-errors-to-discord-not](./quick/53-add-detailed-model-errors-to-discord-not/) |
| 054 | Fix empty page loads with Suspense fallbacks and error boundaries | 2026-02-14 | 7805bc9 | [054-fix-empty-page-loads-comprehensive-inves](./quick/54-fix-empty-page-loads-comprehensive-inves/) |
| 055 | Redesign team page layout with compact stats and hero section | 2026-02-14 | bc60fb7 | [055-redesign-team-page-layout-compact-stats-](./quick/55-redesign-team-page-layout-compact-stats-/) |
| 056 | Fix model list to match exact 20 active models plus MiniMax M2.5 | 2026-02-14 | df90500 | [056-fix-model-list-to-match-exact-20-active-](./quick/56-fix-model-list-to-match-exact-20-active-/) |

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed quick task 056: Fix model list to match exact 20 active models plus MiniMax M2.5
Resume file: None

**Next step:** Define requirements and create roadmap

---
*Last updated: 2026-02-14 after v3.2 milestone start*
