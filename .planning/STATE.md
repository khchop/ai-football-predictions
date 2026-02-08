# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

**Current focus:** v2.9 Provider Unification & Maximum Coverage

## Current Position

Phase: 59 of 66 (Provider Integration Foundations)
Plan: Ready to plan (no plans created yet)
Status: Roadmap approved, ready to begin phase planning
Last activity: 2026-02-08 — v2.9 roadmap created with 8 phases and 100% requirement coverage

Progress: [████████████████████████████████████████████████████████████████████████████████████░░░░░] 88%

## Performance Metrics

**Velocity:**
- Total plans completed: 158 plans (phases 1-58)
- Milestones shipped: 13 (v1.0 through v2.8)

**Recent Milestones:**
- v2.8 Model Coverage: 13 plans, 2 days (2026-02-07 → 2026-02-08)
- v2.7 Pipeline Reliability: 9 plans, 2 days (2026-02-06 → 2026-02-07)
- v2.6 SEO/GEO Site Health: 17 plans, 1 day (2026-02-06)

**Recent Trend:**
- Last 3 milestones: 1-2 days each
- Trend: Stable velocity with comprehensive scope

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.8: P95 + 20% safety margin for timeouts (data-driven approach beats guessing)
- v2.8: Belt-and-suspenders for model fixes (prompt variant + response handler together prevent regressions)
- v2.8: Deprecate 7 Together AI models (provider moved to non-serverless, not a code issue)

### Pending Todos

- **Action needed:** Deactivate 7 deprecated Together AI models in database (qwen2.5-72b-turbo, llama-4-scout, llama-3.1-405b-turbo, llama-3-70b-reference, cogito-70b, cogito-109b-moe, cogito-405b)
- **Action needed:** Investigate 3 fixable Together AI empty-response failures (kimi-k2-instruct, nemotron-nano-9b-v2, gemma-3n-e4b)
- **Human action:** Run `npx tsx scripts/generate-golden-fixtures.ts` with API keys to capture real golden fixture baselines
- **Human action:** Configure GitHub branch protection — Settings > Branches > require "Model Regression Tests" status check

### Post-Deploy Actions (v2.8)

- **Database migration:** Apply `drizzle/0014_add_llm_model_stats.sql` to production database
- **Report generation:** Run `npx tsx scripts/generate-before-after-report.ts` to generate before/after comparison
- **Model deactivation:** Deactivate 7 deprecated Together AI models in production database
- **Verify:** Check admin dashboard model health cards at /admin after deploy

### Blockers/Concerns

**Phase 64 (Model Re-Activation) research gap:**
- Need to verify exact OpenRouter model IDs for 7 deprecated Together models
- OpenRouter model IDs may differ from Together (e.g., meta-llama/llama-3.1-70b-instruct vs llama-3.1-70b)
- Resolution: Call OpenRouter API during phase 64 planning to verify model availability and IDs

**Phase 62-63 (Migration) complexity:**
- Model consolidation requires foreign key updates across 4 tables (predictions, llm_model_stats, bets, model_balances)
- High risk of referential integrity issues if not properly validated
- Resolution: Comprehensive pre/post validation with expand/contract pattern and rollback capability built into migration script

## Session Continuity

Last session: 2026-02-08
Stopped at: v2.9 roadmap creation complete, awaiting phase 59 planning
Resume file: None

**Next action:** `/gsd:plan-phase 59` to create execution plans for Provider Integration Foundations
