# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete
**Current focus:** Phase 58 - Observability & Monitoring (v2.8 Model Coverage)

## Current Position

Phase: 58 of 58 (Observability & Monitoring) — In progress
Plan: 1 of 3 in phase 58
Status: In progress
Last activity: 2026-02-08 — Completed 58-01-PLAN.md (Model stats data layer)

Progress: [█████████████████████████████████████████████████████████░] 98% (57/58 phases, 58 plan 1/3)

## Performance Metrics

**Velocity:**
- Total plans completed: 190 (across phases 1-58)
- Milestones shipped: 7 (v1.0 through v2.7)
- Current milestone: v2.8 Model Coverage (phases 53-58)

**Recent Milestones:**
- v2.7 Pipeline Reliability: 9 plans, 2 days (2026-02-06 → 2026-02-07)
- v2.6 SEO/GEO Site Health: 17 plans, 1 day (2026-02-06)
- v2.5 Model Reliability: 11 plans, 1 day (2026-02-05)

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- 58-01: Success = prediction exists for model+date; failure = active model missing prediction where pipeline ran
- 58-01: Error categories best-effort from models.failureReason (latest error only, not per-prediction)
- 58-01: Health thresholds: >=90% healthy, >=80% warning, <80% critical
- 58-01: Regression detection: >10% drop AND current rate <90% (dual threshold prevents alert fatigue)
- 57-02: 7 Together AI models deprecated (non-serverless) — need deactivation, not code fixes
- 57-02: 3 Synthetic unfixable: glm-4.7-syn (SGLang bug), qwen3-235b-thinking-syn (thinking leak), deepseek-v3.2-syn (placeholder JSON)
- 57-02: Adjusted active models: 35 (after removing 7 deprecated) — 29/35 passing (82.9%) with fallback recovery
- 57-02: 2 models recoverable via existing fallback: deepseek-r1-0528-syn, kimi-k2.5-syn
- 57-01: 3/13 Synthetic models mappable to Together AI; 10/13 exclusive — No additional fallback mappings possible
- 57-01: 5 risk models identified (exclusive + default config) — deepseek-v3-0324-syn, deepseek-v3.1-terminus-syn, minimax-m2-syn, minimax-m2.1-syn, qwen3-coder-480b-syn
- 57-01: Theoretical coverage 88.1% (37/42 models) — Risk models are warnings not failures
- 56-02: Belt-and-suspenders pattern validated — All problematic models use both prompt variant + response handler
- 56-01: Audit-first pattern for fixes — Verify current state before making changes
- 55-01: P95 + 20% safety margin for timeout tuning — Data-driven formula
- 54-02: Use predictBatch not callAPI — Ensures response handlers apply correctly
- 53-02: CI offline tests only — Fast feedback (<10s), no API keys
- v2.8: Protect-first approach — regression tests before fixes prevent whack-a-mole oscillation
- v2.8: Diagnose before fix — systematic testing with golden fixtures replaces guesswork
- v2.8: Category-based fixes — group failures by type for targeted solutions

### Pending Todos

- **Action needed:** Deactivate 7 deprecated Together AI models in database (qwen2.5-72b-turbo, llama-4-scout, llama-3.1-405b-turbo, llama-3-70b-reference, cogito-70b, cogito-109b-moe, cogito-405b)
- **Action needed:** Investigate 3 fixable Together AI empty-response failures (kimi-k2-instruct, nemotron-nano-9b-v2, gemma-3n-e4b)
- **Human action:** Run `npx tsx scripts/generate-golden-fixtures.ts` with API keys to capture real golden fixture baselines
- **Human action:** Configure GitHub branch protection — Settings > Branches > require "Model Regression Tests" status check

### Blockers/Concerns

**v2.8 Diagnostic Findings:**
- 7 Together AI models deprecated to non-serverless — biggest gap in model count
- GLM 4.7 has SGLang structured output bug at Synthetic provider — monitoring for fix
- 95% target achievable at ~90.6% when excluding deprecated + unfixable models from denominator

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 026 | Fix match report overwrite, add preview data, remove duplicate predictions | 2026-02-07 | 3e4a953 | [026-fix-match-report-overwrite-duplicates](./quick/026-fix-match-report-overwrite-duplicates/) |
| 027 | Improve match detail text to 500+ words (preview + roundup narrative) | 2026-02-07 | 53ed692 | [027-improve-match-detail-text-500-words](./quick/027-improve-match-detail-text-500-words/) |
| 028 | Fix HierarchyRequestError in match narrative rendering | 2026-02-07 | ce33711 | [028-fix-hierarchyrequesterror-insertbefore-d](./quick/028-fix-hierarchyrequesterror-insertbefore-d/) |
| 029 | Fix match preview text to focus on odds, predictions & outcomes instead of hallucinated facts | 2026-02-07 | c57f7f2 | [029-fix-match-preview-text-to-focus-on-odds-](./quick/029-fix-match-preview-text-to-focus-on-odds-/) |
| 030 | Backfill script to regenerate all existing match previews with anti-hallucination prompt | 2026-02-07 | ec33e5f | [030-backfill-regenerate-match-previews-anti-](./quick/030-backfill-regenerate-match-previews-anti-/) |
| 031 | Remove head-to-head section from match generation, refocus on AI consensus | 2026-02-07 | 77f105a | [031-remove-head-to-head-from-match-generatio](./quick/031-remove-head-to-head-from-match-generatio/) |
| 032 | Fix match roundups: remove "no events" filler, refocus on AI prediction accuracy | 2026-02-07 | 929df88 | [032-fix-match-report-remove-no-events-focus-](./quick/032-fix-match-report-remove-no-events-focus-/) |
| 033 | Fix consensus percentages and upgrade to Kimi K2 Thinking | 2026-02-07 | aafcf66 | [033-fix-consensus-percentages-upgrade-conten](./quick/033-fix-consensus-percentages-upgrade-conten/) |
| 034 | Content generation fallback from Kimi K2 to Llama 4 Maverick | 2026-02-07 | 0da46b0 | [034-content-fallback-model-kimi-errors](./quick/034-content-fallback-model-kimi-errors/) |
| 035 | Switch primary content model from Kimi K2 to DeepSeek V3.1 | 2026-02-07 | 218831d | [035-switch-primary-content-model-from-kimi-k](./quick/035-switch-primary-content-model-from-kimi-k/) |
| 036 | Refocus match roundup prompt exclusively on AI model performance | 2026-02-07 | 14f59e9 | [036-refocus-match-roundup-prompt-on-ai-model](./quick/036-refocus-match-roundup-prompt-on-ai-model/) |

## Session Continuity

Last session: 2026-02-08
Stopped at: Completed 58-01-PLAN.md (Model stats data layer)
Resume file: .planning/phases/58-observability-monitoring/58-02-PLAN.md

**Next action:** Execute 58-02-PLAN.md (Admin API endpoint for model health) then 58-03-PLAN.md (Dashboard visualization)
