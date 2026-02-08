# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

**Current focus:** v2.9 Provider Unification & Maximum Coverage

## Current Position

Phase: 60 of 66 (Multi-Provider Routing)
Plan: 1 of 1 (100% phase complete)
Status: Phase 60 complete - Multi-provider routing infrastructure with 3-tier fallback chains
Last activity: 2026-02-08 — Completed 60-01-PLAN.md (MODEL_PROVIDER_ROUTES system, multi-provider routing, unified fallback config)

Progress: [███████████████████████████████████████████████████████████████████████████████████████░░░] 91%

## Performance Metrics

**Velocity:**
- Total plans completed: 160 plans (phases 1-60)
- Milestones shipped: 13 (v1.0 through v2.8)
- v2.9 in progress: 2 of 8 phases complete (Phases 59-60)

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

- v2.9 (Phase 60): Single source of truth - MODEL_FALLBACKS fully deleted, getFallbackProvider() refactored as thin wrapper over MODEL_PROVIDER_ROUTES
- v2.9 (Phase 60): Only models with 2+ providers get entries in MODEL_PROVIDER_ROUTES (keeps config lean)
- v2.9 (Phase 60): Consolidated model IDs are routing-level identifiers, not provider IDs (separation of concerns)
- v2.9: Conditional provider inclusion pattern (API-key-gated, not in ALL_PROVIDERS to avoid errors)
- v2.9: Model ID namespacing with provider suffixes (-or) to avoid conflicts across providers
- v2.9: Test model instances for structural validation only (live API validation deferred to Phase 60/64)
- v2.8: P95 + 20% safety margin for timeouts (data-driven approach beats guessing)
- v2.8: Belt-and-suspenders for model fixes (prompt variant + response handler together prevent regressions)

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
Stopped at: Phase 60 execution complete (60-01-PLAN.md finished)
Resume file: .planning/phases/60-multi-provider-routing/60-01-SUMMARY.md

**Next action:** Continue with next phase in v2.9 Provider Unification milestone (Phase 61-64 or Phase 65-66)
