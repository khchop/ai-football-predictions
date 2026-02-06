# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete
**Current focus:** v2.7 Pipeline Reliability & Retroactive Backfill

## Current Position

Phase: 49 (Pipeline Scheduling Fixes)
Plan: Ready to plan
Status: Roadmap created, ready for phase planning
Last activity: 2026-02-06 — v2.7 roadmap created with 4 phases

Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%

## Milestone History

| Milestone | Phases | Plans | Requirements | Shipped |
|-----------|--------|-------|--------------|---------|
| v1.0 Bug Fix Stabilization | 1-4 | 14 | 18 | 2026-02-01 |
| v1.1 Stats Accuracy & SEO | 5-8 | 10 | 19 | 2026-02-02 |
| v1.2 Technical SEO Fixes | 9-12 | 9 | 13 | 2026-02-02 |
| v1.3 Match Page Refresh | 13-16 | 13 | 18 | 2026-02-02 |
| v2.0 UI/UX Overhaul | 17-23 | 28 | 33 | 2026-02-03 |
| v2.1 Match Page Simplification | 24-25 | 3 | 9 | 2026-02-03 |
| v2.2 Match Page Rewrite | 26-30 | 17 | 21 | 2026-02-04 |
| v2.3 Content Pipeline & SEO | 31-36 | 13 | 24 | 2026-02-04 |
| v2.4 Synthetic.new Integration | 37-39 | 7 | 17 | 2026-02-05 |
| v2.5 Model Reliability | 40-43 | 11 | 36 | 2026-02-05 |
| v2.6 SEO/GEO Site Health | 44-48 | 17 | 24 | 2026-02-06 |

**Total shipped:** 48 phases, 145 plans, 248 requirements

## Accumulated Context

### Decisions

All decisions archived in milestone files. See `.planning/milestones/` for history.

**Phase 48 (v2.6 - latest):**
- 48-01: Pass 6 TTFB measurement integrated into audit script with page type categorization
- 48-01: TTFB >2s flagged as warnings (not failures) - best-effort optimization, not blocker
- 48-01: Match page generateMetadata parallelizes getMatchWithAnalysis and getOverallStats queries
- 48-02: Production audit passes 6/6 with 0 failures (1 acceptable warning for blog link sources)
- 48-02: TTFB baseline established: 50-73ms across all page types (well under 2s target)
- 48-02: Use Host header for hostname in Edge Runtime (request.url.hostname can be 'localhost')

**v2.7 Roadmap:**
- Phase 49: Pipeline Scheduling Fixes (PIPE-01 to PIPE-05)
- Phase 50: Settlement Investigation & Recovery (SETTLE-01 to SETTLE-04)
- Phase 51: Retroactive Backfill Script (RETRO-01 to RETRO-06)
- Phase 52: Monitoring & Observability (MON-01 to MON-05)

### Pending Todos

None.

### Blockers/Concerns

**v2.7 Issues (from investigation):**
- 43 failed settlement jobs in production need investigation
- Pipeline not scheduling analysis/predictions for existing matches after restart
- Last 7 days of matches may be missing predictions entirely
- Root cause: scheduleMatchJobs() skips matches where kickoff <= now (line 113 of scheduler.ts)
- Root cause: Fixtures worker only schedules for isNewMatch (line 90)
- Backfill windows too narrow (12h for analysis, 2h for predictions)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |
| 011 | Fix predictBatch type error breaking production build | 2026-02-05 | 8625f5d | [011-fix-predictbatch-type-error](./quick/011-fix-predictbatch-type-error/) |
| 012 | Fix circular dependency build error in LLM module | 2026-02-05 | 70ba190 | [012-fix-circular-dep-build-error](./quick/012-fix-circular-dep-build-error/) |
| 013 | Break circular dependency in base.ts imports | 2026-02-05 | 5322a19 | [013-break-circular-dep-base-imports-index](./quick/013-break-circular-dep-base-imports-index/) |
| 014 | Fix Ahrefs SEO issues (redirects, orphans, schema) | 2026-02-06 | ca6f4f2 | [014-fix-ahrefs-seo-issues](./quick/014-fix-ahrefs-seo-issues/) |
| 015 | Fix missing predictions (no analysis retry) | 2026-02-06 | e4b6021 | [015-fix-missing-predictions-no-analysis-retry](./quick/015-fix-missing-predictions-no-analysis-retry/) |

## Session Continuity

Last session: 2026-02-06
Stopped at: v2.7 roadmap created with 4 phases (49-52) covering 20 requirements
Resume file: None

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled)
- 248 requirements validated (v1.0-v2.6)
- 20 new requirements defined for v2.7

**Next action:** `/gsd:plan-phase 49` to plan Pipeline Scheduling Fixes

---
*Last updated: 2026-02-06 after v2.7 roadmap created*
