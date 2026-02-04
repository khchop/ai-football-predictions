# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Content generation pipeline must reliably trigger and produce SEO/GEO optimized content for all matches
**Current focus:** Phase 35 - SEO/GEO Content Quality

## Current Position

Phase: 35 of 36 (SEO/GEO Content Quality)
Plan: 0 of 3 in current phase
Status: Phase 34 complete, verified
Last activity: 2026-02-04 — Phase 34 verified (8/8 must-haves)

Progress: [█████░░░░░] 50% (v2.3)

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

**Total shipped:** 30 phases, 94 plans, 131 requirements

## Performance Metrics

**v2.3 Velocity:**
- Total plans completed: 8
- Average duration: 4.1 min
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 31 | 1/1 | 4min | 4min |
| 32 | 2/2 | 8min | 4min |
| 33 | 3/3 | 14min | 4.7min |
| 34 | 2/2 | 6min | 3min |
| 35 | 0/3 | - | - |
| 36 | 0/2 | - | - |

## Accumulated Context

### Decisions

| Date | Phase | Decision | Impact |
|------|-------|----------|--------|
| 2026-02-04 | 31 | Root cause: Application server not running (workers never started) | Content generation halted since 2026-02-01 evening |
| 2026-02-04 | 31 | REDIS_URL missing from environment blocks queue system initialization | Server startup will fail until configured |
| 2026-02-04 | 31 | Post-match content uses different generation mechanism (not queue-based) | Explains why post-match works while pre-match/betting broken |
| 2026-02-04 | 32-01 | Use BullMQ UnrecoverableError for fatal errors | Prevents wasted retry attempts for match-not-found cases |
| 2026-02-04 | 32-01 | Include diagnostic context in all errors | Enables proper debugging with matchId, teams, contentType, timestamp |
| 2026-02-04 | 32-01 | Worker scan job continues on individual failures | More robust backfill - individual jobs retry via BullMQ |
| 2026-02-04 | 32-02 | 120-second lock duration with 30s heartbeat | Content generation takes 30-90s, 4x safety margin |
| 2026-02-04 | 32-02 | 5 retry attempts with exponential backoff | LLM APIs have transient failures, need multiple chances |
| 2026-02-04 | 32-02 | Concurrency 3 for content worker | Balance throughput with LLM API rate limits (30 req/min) |
| 2026-02-04 | 32-02 | DLQ retention 7 days | Failed jobs visible for manual review, auto-cleaned weekly |
| 2026-02-04 | 33-01 | Use html-to-text and he libraries for sanitization | npm standards with 1344+ and 2535+ dependents respectively |
| 2026-02-04 | 33-01 | Defense-in-depth: prompts + runtime sanitization | LLMs proven to ignore format instructions, need both layers |
| 2026-02-04 | 33-01 | buildPostMatchRoundupPrompt switched from HTML to plain text | Aligns with plain-text-only content strategy |
| 2026-02-04 | 33-02 | Sanitize after LLM response, before validation and database save | Ensures clean content before any storage |
| 2026-02-04 | 33-02 | PostMatchRoundup HTML template preserved, text content inside sanitized | HTML structure intentional for rendering, LLM text sanitized |
| 2026-02-04 | 33-03 | Run migration script for existing content cleanup | 341 records across 4 tables sanitized |
| 2026-02-04 | 34-01 | In-memory state for queue circuit breaker (no Redis persistence) | Transient state acceptable, resets on worker restart |
| 2026-02-04 | 34-01 | 5 consecutive errors, 60s cooldown for rate limit protection | Match Together AI rate limit window (~30 req/min) |
| 2026-02-04 | 34-02 | 5-minute stalled threshold for worker health detection | 2x safety margin over 2-min lock duration |
| 2026-02-04 | 34-02 | Sentry warning level for missing content (not error) | Self-healing via backfill, avoid alert fatigue |
| v2.3 | - | Investigation before code changes (confirm root cause first) | Diagnostic phase prevents wasted effort on wrong fixes |
| v2.3 | - | Error throwing over return false (BullMQ retry pattern) | Enable proper error propagation and retry logic |

### Pending Todos

None.

### Blockers/Concerns

**Active Blockers:**
- REDIS_URL environment variable not configured (blocks server startup)
- Application server not running (blocks all worker processes)

**Future Concerns:**
- Validation patterns may need tuning based on actual LLM output in production
- Heartbeat frequency (30s) chosen conservatively, could be optimized

## Session Continuity

Last session: 2026-02-04 17:21 UTC
Stopped at: Phase 34 complete and verified
Resume file: None
Resume with: /gsd:plan-phase 35

**Next phase:** 35 - SEO/GEO Content Quality
