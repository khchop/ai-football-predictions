# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete
**Current focus:** Phase 54 - Diagnostic Infrastructure (v2.8 Model Coverage)

## Current Position

Phase: 54 of 58 (Diagnostic Infrastructure)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-07 — Completed quick-034 (content generation fallback from Kimi K2 to Llama 4 Maverick)

Progress: [█████████████████████████████████████████████████████░] 91% (53/58 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 182 (across phases 1-54)
- Milestones shipped: 7 (v1.0 through v2.7)
- Current milestone: v2.8 Model Coverage (phases 53-58)

**Recent Milestones:**
- v2.7 Pipeline Reliability: 9 plans, 2 days (2026-02-06 → 2026-02-07)
- v2.6 SEO/GEO Site Health: 17 plans, 1 day (2026-02-06)
- v2.5 Model Reliability: 11 plans, 1 day (2026-02-05)

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- quick-033: Pre-calculated consensus before prompting — Calculate H/D/A percentages from DB predictions before prompt building (prevents LLM fabrication)
- quick-033: Kimi K2 Thinking for content — Upgrade to reasoning model via Synthetic API (~$5/month vs ~$0.71/month for quality)
- quick-033: Thinking tag stripping pattern — Strip <think>...</think> BEFORE JSON parsing to prevent parse errors
- quick-033: Explicit prompt interpolation — Inject exact numbers into prompt instructions instead of relying on LLM to honor separate data
- quick-032: Omit empty event sections entirely — Prevents LLM from generating filler text about data absence
- quick-032: Model predictions first in roundups — AI prediction accuracy is section 3, events become section 5 (conditional)
- quick-032: CRITICAL RULES instruction block — Strong signal to LLM about non-negotiable behaviors (e.g., never mention data absence)
- quick-031: Remove H2H section entirely — H2H data rarely available, low value; focus on AI consensus instead
- quick-031: AI consensus language in predictions — State percentages (e.g., "45% draw, 35% home, 20% away") and confidence level
- quick-031: Betting Insights as value betting guide — Highlight where AI predictions DIFFER from market odds
- 54-01: Priority-ordered failure categorization — timeout > api-error > empty > language > thinking-tag > parse prevents misclassification
- 54-01: diag- prefix for diagnostic match IDs — Avoids collision with existing test-validation-001 fixture
- 53-02: Separate test vs production schemas — Test schemas validate LLM output, production validates DB insert (different field names, different concerns)
- 53-02: CI offline tests only — Fast feedback (<10s), no API keys, sufficient for regression detection
- 53-01: Golden fixtures over live tests — Offline validation prevents API rate limits, enables fast CI (<5s tests)
- 53-01: Structure validation, not exact scores — LLM outputs are non-deterministic, fixtures validate JSON structure only
- v2.8: Protect-first approach — regression tests before fixes prevent whack-a-mole oscillation
- v2.8: Diagnose before fix — systematic testing with golden fixtures replaces guesswork
- v2.8: Category-based fixes — group failures by type (timeout, tags, language, JSON) for targeted solutions

### Pending Todos

- **Human action:** Run `npx tsx scripts/generate-golden-fixtures.ts` with API keys to capture real golden fixture baselines (placeholder data currently)
- **Human action:** Configure GitHub branch protection — Settings > Branches > require "Model Regression Tests" status check
- **Optional:** Run `npx tsx scripts/backfill-match-previews.ts` to regenerate all existing match previews with anti-hallucination prompt (quick-030)

### Blockers/Concerns

**v2.8 Known Risks:**
- Whack-a-mole pitfall: Fixing Model A breaks Model B (mitigated by regression suite in Phase 53)
- Timeout escalation: Reasoning models need 60-90s but risk budget/pipeline issues
- Unfixable models: Small models (3B-7B) may not support JSON reliably

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

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed quick-033 (fix consensus percentages, upgrade to Kimi K2 Thinking)
Resume file: None

**Next action:** Execute 54-02-PLAN.md (diagnostic runner)
