# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** The prediction pipeline must reliably generate scores from LLMs before kickoff and accurately score them when matches complete
**Current focus:** v2.9 Provider Unification & Maximum Coverage

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-08 — Milestone v2.9 started

## Performance Metrics

**Velocity:**
- Total plans completed: 205 (across phases 1-58)
- Milestones shipped: 13 (v1.0 through v2.8)

**Recent Milestones:**
- v2.8 Model Coverage: 13 plans, 2 days (2026-02-07 → 2026-02-08)
- v2.7 Pipeline Reliability: 9 plans, 2 days (2026-02-06 → 2026-02-07)
- v2.6 SEO/GEO Site Health: 17 plans, 1 day (2026-02-06)

## Accumulated Context

### Decisions

All v2.8 decisions archived to `.planning/milestones/v2.8-ROADMAP.md`.

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

None — ready for v2.9 milestone.

## Session Continuity

Last session: 2026-02-08
Stopped at: Starting v2.9 milestone
Resume file: N/A

**Next action:** Define requirements for v2.9 Provider Unification.
