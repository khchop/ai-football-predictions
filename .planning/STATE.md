# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete
**Current focus:** v2.7 Pipeline Reliability & Retroactive Backfill

## Current Position

Phase: 51 of 52 (Retroactive Backfill Script) — IN PROGRESS
Plan: 1 of 6 complete
Status: Plan 51-01 complete (worker support for retroactive processing)
Last activity: 2026-02-06 — Completed 51-01-PLAN.md (allowRetroactive flag added to workers)

Progress: [███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 52% (2.16/4 phases)

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

**Phase 49 (v2.7):**
- 49-01: Remove kickoff <= now early exit - prevents catch-up from working
- 49-01: Use match status (finished/cancelled/postponed) as scheduling guard instead
- 49-01: Preserve existing shouldRun logic (kickoff > now) for pre-match vs live job distinction
- 49-01: Schedule jobs for ALL scheduled matches in fixtures worker, not just new ones
- 49-02: Widen backfill analysis window to 48h minimum (was 12h) for full catch-up coverage
- 49-02: Widen lineups/predictions windows to 12h (was 2h) to catch recently missed matches
- 49-02: Chain validation enforced via DB query joins (analysis → lineups → predictions)
- 49-02: Added chain validation logging to show dependency flow

**Phase 50 (v2.7):**
- 50-01: Use favoriteTeamName field to detect if analysis exists (reliable API-Football indicator)
- 50-01: Throw error for retry when analysis exists but predictions don't (upstream pipeline issue)
- 50-01: Skip gracefully when no analysis exists (expected for old/imported matches)
- 50-01: Fixed schema error in getFinishedMatchesWithZeroPredictions (removed non-existent referee field)
- 50-02: Admin retry API fetches fresh match data from DB (failed jobs may have stale data)
- 50-02: Retry from both queue.getFailed() and DLQ (dual-source pattern)
- 50-02: Backfill worker detects zero-prediction matches hourly (step 6, priority 2)
- 50-02: Backfill script uses separate jobId patterns (settle-backfill-* vs settle-backfill-zero-*)
- 50-02: All operations use idempotent jobIds (safe to run multiple times)

**Phase 51 (v2.7 - latest):**
- 51-01: Use optional allowRetroactive flag instead of modifying match status or bypassing checks globally
- 51-01: Log retroactive processing explicitly for observability
- 51-01: Preserve normal pipeline behavior when flag is undefined/false

**v2.7 Roadmap:**
- Phase 49: Pipeline Scheduling Fixes (PIPE-01 to PIPE-05) — COMPLETE
- Phase 50: Settlement Investigation & Recovery (SETTLE-01 to SETTLE-04) — COMPLETE (code)
- Phase 51: Retroactive Backfill Script (RETRO-01 to RETRO-06)
- Phase 52: Monitoring & Observability (MON-01 to MON-05)

### Pending Todos

None.

### Blockers/Concerns

**v2.7 Issues (from investigation):**
- 43 failed settlement jobs ready for investigation — SCRIPT READY (`npx tsx scripts/investigate-settlement-failures.ts`)
- ~~Pipeline not scheduling analysis/predictions for existing matches after restart~~ FIXED (49-01)
- Last 7 days of matches may be missing predictions entirely (need backfill in Phase 51)
- ~~Root cause: scheduleMatchJobs() skips matches where kickoff <= now (line 113 of scheduler.ts)~~ FIXED (49-01)
- ~~Root cause: Fixtures worker only schedules for isNewMatch (line 90)~~ FIXED (49-01)
- ~~Backfill windows too narrow (12h for analysis, 2h for predictions)~~ FIXED (49-02)
- ~~Scoring worker silently skips zero-prediction matches~~ FIXED (50-01)

**Phase 50 Human Verification Items:**
1. Run `npx tsx scripts/investigate-settlement-failures.ts` against production Redis (SETTLE-01)
2. Run `npx tsx scripts/backfill-settlement.ts` against production (settle all recent matches)
3. POST `/api/admin/settlement/retry` with admin auth to retry failed jobs
4. Monitor scoring worker logs for conditional retry behavior
5. Wait for next hourly backfill worker run to verify zero-prediction detection

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

Last session: 2026-02-06T22:20:00Z
Stopped at: Completed 51-01-PLAN.md
Resume file: None

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled)
- 256 requirements validated (v1.0-v2.6 + PIPE-01 through PIPE-05 + SETTLE-02 through SETTLE-04)
- 12 remaining requirements for v2.7 (SETTLE-01, RETRO, MON)

**Next action:** Plan and execute Phase 51 (Retroactive Backfill Script)

---
*Last updated: 2026-02-06 after Phase 50 completed and verified*
