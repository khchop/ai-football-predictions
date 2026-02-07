# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete
**Current focus:** v2.7 Pipeline Reliability & Retroactive Backfill

## Current Position

Phase: 52 of 52 (Monitoring & Observability) — COMPLETE
Plan: 3 of 3 complete (all plans complete)
Status: Phase complete - pipeline monitoring & observability operational
Last activity: 2026-02-07 — Completed 52-03-PLAN.md

Progress: [████████████████████████████████████████████████] 100% (4/4 phases in v2.7 complete)

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

**Phase 51 (v2.7):**
- 51-01: Use optional allowRetroactive flag instead of modifying match status or bypassing checks globally
- 51-01: Log retroactive processing explicitly for observability
- 51-01: Preserve normal pipeline behavior when flag is undefined/false
- 51-02: Use favoriteTeamName IS NOT NULL as hasAnalysis indicator (Phase 50 pattern)
- 51-02: Process matches sequentially (for-loop) to respect API-Football rate limits
- 51-02: Separate job ID prefixes per phase: analyze-retro-*, predict-retro-*, settle-retro-*
- 51-02: Phase-specific timeouts: 120s analysis, 300s predictions, 60s settlement
- 51-02: Continue on per-match errors to maximize recovery coverage

**Phase 52 (v2.7 - latest):**
- 52-01: Return 100% coverage when no upcoming matches (avoids false alerts during quiet periods)
- 52-01: Sort gaps by urgency (closest kickoff first) for actionable prioritization
- 52-01: Error handling with logging and re-throw (lets callers decide response strategy)
- 52-01: Query only 'scheduled' status matches (live/finished don't need pre-match jobs)
- 52-02: Cache coverage for 60s in health endpoint (avoids DB/Redis spam on frequent polling)
- 52-02: Health endpoint returns HTTP 503 when Redis unhealthy, 200 otherwise
- 52-02: Health status levels: 'ok' (Redis healthy + coverage >= 90%), 'degraded' (coverage < 90%), 'unhealthy' (Redis down)
- 52-02: No auth on health endpoint (load balancers need unauthenticated access, aggregate data only)
- 52-02: Backfill worker step 7 isolated in try/catch (health check failure never blocks backfill work)
- 52-02: Queue metrics use debug level for coverage errors (non-critical periodic metrics)
- 52-03: Both endpoints use RATE_LIMIT_PRESETS.admin (10 req/min) to prevent abuse
- 52-03: Settlement failures endpoint truncates error messages to 300 chars to prevent sensitive data leakage
- 52-03: Pipeline health uses 6-hour window for early warning (enough time to investigate + fix)
- 52-03: POST /settlement-failures retries single match with fresh DB data (not stale job data)
- 52-03: Separate rate limit keys per HTTP method (GET vs POST) for fair quota allocation

**v2.7 Roadmap:**
- Phase 49: Pipeline Scheduling Fixes (PIPE-01 to PIPE-05) — COMPLETE
- Phase 50: Settlement Investigation & Recovery (SETTLE-01 to SETTLE-04) — COMPLETE (code)
- Phase 51: Retroactive Backfill Script (RETRO-01 to RETRO-06) — COMPLETE
- Phase 52: Monitoring & Observability (MON-01 to MON-05) — COMPLETE

### Pending Todos

None.

### Blockers/Concerns

**v2.7 Issues (from investigation):**
- 43 failed settlement jobs ready for investigation — SCRIPT READY (`npx tsx scripts/investigate-settlement-failures.ts`)
- ~~Pipeline not scheduling analysis/predictions for existing matches after restart~~ FIXED (49-01)
- ~~Last 7 days of matches may be missing predictions entirely~~ FIXED (51-02) - backfill script ready
- ~~Root cause: scheduleMatchJobs() skips matches where kickoff <= now (line 113 of scheduler.ts)~~ FIXED (49-01)
- ~~Root cause: Fixtures worker only schedules for isNewMatch (line 90)~~ FIXED (49-01)
- ~~Backfill windows too narrow (12h for analysis, 2h for predictions)~~ FIXED (49-02)
- ~~Scoring worker silently skips zero-prediction matches~~ FIXED (50-01)

**Phase 50 & 51 Human Verification Items:**
1. Run `npx tsx scripts/investigate-settlement-failures.ts` against production Redis (SETTLE-01)
2. Run `npx tsx scripts/backfill-settlement.ts` against production (settle all recent matches)
3. POST `/api/admin/settlement/retry` with admin auth to retry failed jobs
4. Monitor scoring worker logs for conditional retry behavior
5. Wait for next hourly backfill worker run to verify zero-prediction detection
6. Run `npx tsx scripts/backfill-retroactive-predictions.ts --days 7` against production (RETRO backfill)

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

Last session: 2026-02-07T02:07:26Z
Stopped at: Completed 52-03-PLAN.md (admin dashboard endpoints)
Resume file: None

**Platform status:**
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- 0 disabled models (all 6 previously disabled models re-enabled)
- 268 requirements validated (v1.0-v2.6 + PIPE + SETTLE + RETRO + MON complete)
- 0 remaining requirements for v2.7

**Next action:** v2.7 COMPLETE - Ready to ship monitoring & observability features

---
*Last updated: 2026-02-07 after Phase 52 Plan 01 completed*
