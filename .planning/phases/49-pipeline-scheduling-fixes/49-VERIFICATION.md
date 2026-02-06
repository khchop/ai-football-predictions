---
phase: 49-pipeline-scheduling-fixes
verified: 2026-02-06T22:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 49: Pipeline Scheduling Fixes Verification Report

**Phase Goal:** Catch-up scheduling handles past-due matches and backfill detects wider gaps to ensure all matches receive analysis/predictions

**Verified:** 2026-02-06T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After server restart, scheduleMatchJobs() schedules jobs for matches where kickoff <= now (past-due matches) | ✓ VERIFIED | Early exit `if (kickoff <= now)` removed (line 112-115 deleted), replaced with status-based guard checking finished/cancelled/postponed. Past-due scheduled matches now enter function. |
| 2 | Fixtures worker schedules jobs for existing matches that have no active/delayed BullMQ jobs, not just new matches | ✓ VERIFIED | `scheduleMatchJobs` call moved outside `isNewMatch` block (line 94-137). All scheduled matches get jobs scheduled, IndexNow ping stays inside `isNewMatch` block. |
| 3 | Scheduler still skips matches with no externalId | ✓ VERIFIED | Guard on line 118-121: `if (!match.externalId) { ... return 0; }` unchanged and functional. |
| 4 | Backfill worker checks 48h window for missing analysis (not 12h) | ✓ VERIFIED | Line 67: `analysisHoursAhead = Math.max(hoursAhead, 48)`. Line 92 passes to query. setup.ts line 173 sets `hoursAhead: 48`. |
| 5 | Backfill worker checks 12h window for missing lineups/predictions (not 2h) | ✓ VERIFIED | Line 68-69: `lineupsHoursAhead = 12`, `predictionsHoursAhead = 12`. Line 209 and 264 pass to queries. |
| 6 | Dependency chain validation ensures analysis → lineups → predictions order | ✓ VERIFIED | DB queries enforce chain: `getMatchesMissingLineups` (line 1621) has `innerJoin(matchAnalysis)` requiring analysis. `getMatchesMissingPredictions` (line 2235) requires `lineupsAvailable: true`. Chain logging added line 147-150. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/queue/scheduler.ts` | scheduleMatchJobs without early exit on kickoff <= now | ✓ VERIFIED | Lines 112-116: Status-based guard replacing time-based exit. Line 249: `shouldRun` preserved with `kickoff > now` logic. |
| `src/lib/queue/workers/fixtures.worker.ts` | Job scheduling for both new and existing scheduled matches | ✓ VERIFIED | Lines 89-92: IndexNow for new matches only. Lines 94-137: scheduleMatchJobs for all scheduled matches with `isNewMatch` logged. |
| `src/lib/queue/workers/backfill.worker.ts` | Wider time windows (48h/12h/12h) and chain validation | ✓ VERIFIED | Lines 67-69: Window constants. Line 78: Windows tracked in results. Lines 147-150: Chain validation logging. |
| `src/lib/queue/setup.ts` | hoursAhead: 48 for repeatable and startup backfill | ✓ VERIFIED | Line 173: Repeatable job `hoursAhead: 48`. Line 228: Startup job `hoursAhead: 48`. Both updated from previous values. |
| `src/lib/queue/catch-up.ts` | Calls scheduleMatchJobs for 48h window matches | ✓ VERIFIED | Line 9: imports `scheduleMatchJobs`. Line 20: `getUpcomingMatches(48)`. Line 32: calls `scheduleMatchJobs({ match, competition })`. |
| `src/lib/db/queries.ts` | Gap detection queries with chain enforcement | ✓ VERIFIED | Line 1621: `getMatchesMissingLineups` innerJoin on matchAnalysis. Line 2228-2235: `getMatchesMissingPredictions` requires `lineupsAvailable: true`. Chain enforced at DB layer. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| catch-up.ts | scheduler.ts | catchUpScheduling calls scheduleMatchJobs for 48h window | ✓ WIRED | Line 32 of catch-up.ts calls `scheduleMatchJobs({ match, competition })` with imported function (line 9). |
| fixtures.worker.ts | scheduler.ts | fixtures worker calls scheduleMatchJobs for all scheduled matches | ✓ WIRED | Line 97 imports and calls `scheduleMatchJobs` for `status === 'scheduled'` (line 96), outside `isNewMatch` block. |
| setup.ts | backfill.worker.ts | Repeatable job passes hoursAhead: 48 | ✓ WIRED | Line 173 of setup.ts creates job with `hoursAhead: 48`. Line 28 of backfill.worker.ts reads `hoursAhead` from job.data. |
| backfill.worker.ts | queries.ts | Backfill calls getMatchesMissing* with wider windows | ✓ WIRED | Line 92: `getMatchesMissingAnalysis(analysisHoursAhead)`. Line 209: `getMatchesMissingLineups(lineupsHoursAhead)`. Line 264: `getMatchesMissingPredictions(predictionsHoursAhead)`. All imported from queries.ts (line 14-19). |
| scheduler.ts | Match status | Status-based guard checks finished/cancelled/postponed | ✓ WIRED | Line 113: `match.status === 'finished' || match.status === 'cancelled' || match.status === 'postponed'` prevents scheduling. Typed Match interface ensures status field exists. |
| scheduler.ts | Job timing | shouldRun logic distinguishes pre-match from MONITOR_LIVE | ✓ WIRED | Line 249: `shouldRun = job.name === JOB_TYPES.MONITOR_LIVE || kickoff > now`. Pre-match jobs (analysis, lineups, predictions) only run if kickoff hasn't passed. MONITOR_LIVE runs for in-progress matches. |

### Requirements Coverage

| Requirement | Status | Supporting Evidence |
|-------------|--------|---------------------|
| PIPE-01: scheduleMatchJobs handles past-due matches without early exit | ✓ SATISFIED | Truth 1 verified. Early exit removed (commit 0d2c7fd). Status guard on lines 112-116. Past-due scheduled matches enter function and get jobs via shouldRun logic (line 249). |
| PIPE-02: Fixtures worker schedules jobs for existing matches missing BullMQ jobs | ✓ SATISFIED | Truth 2 verified. scheduleMatchJobs moved outside isNewMatch block (commit dcabe97). Lines 94-137 schedule for all scheduled matches. Idempotent job IDs prevent duplicates. |
| PIPE-03: Backfill uses wider time windows (48h analysis, 12h lineups/predictions) | ✓ SATISFIED | Truths 4-5 verified. Constants on lines 67-69 (commit e4196ac). setup.ts lines 173 and 228 set hoursAhead: 48. Queries receive wider windows. |
| PIPE-04: Dependency chain validation (analysis → lineups → predictions) | ✓ SATISFIED | Truth 6 verified. DB query joins enforce chain: lineups requires matchAnalysis (line 1621), predictions requires lineupsAvailable (line 2235). Chain logging added (lines 147-150). |
| PIPE-05: Combined coverage via catch-up + backfill + stuck-match check | ✓ SATISFIED | All truths verified. catch-up.ts line 20: 48h window. backfill repeatable (setup.ts line 173): 48h window. Stuck-match check (setup.ts line 198-210): every 2 minutes. Three overlapping safety nets ensure coverage. |

### Anti-Patterns Found

**None found.** All modified files are clean.

| Pattern | Found | Details |
|---------|-------|---------|
| TODO/FIXME comments | 0 | No outstanding work flagged |
| Placeholder content | 0 | All implementations substantive |
| Empty returns | 0 | All functions return meaningful values |
| Console.log-only handlers | 0 | Proper logging with structured loggers |
| Hardcoded IDs | 0 | Job IDs are deterministic and documented |

### Human Verification Required

The following items require human verification after deployment:

#### 1. Server Restart Recovery Test

**Test:** Stop the server, wait 5 minutes, restart, check Bull Board
**Expected:** 
- All matches within 48h should have delayed jobs visible in Bull Board queue metrics
- No matches should be stuck in "scheduled" status after kickoff time passes
- Backfill job should trigger within 5 seconds and schedule missing jobs

**Why human:** Requires production environment with actual match data and BullMQ Redis inspection

#### 2. Catch-Up Window Coverage

**Test:** Create a match with kickoffTime in 36 hours, restart server, observe logs
**Expected:**
- catch-up.ts should find the match (48h window)
- scheduleMatchJobs should be called with the match
- Analysis job should be scheduled for kickoff - 6h
- Lineups job should be scheduled for kickoff - 60m
- Predictions job should be scheduled for kickoff - 30m

**Why human:** Requires controlled test scenario with known match data and log inspection

#### 3. Backfill Chain Enforcement

**Test:** Create a match with analysis but no lineups, wait for backfill cycle (hourly at :05)
**Expected:**
- Lineups job should be scheduled (has analysis)
- Predictions job should NOT be scheduled (no lineups yet)
- After lineups complete, next backfill cycle should schedule predictions

**Why human:** Requires observing multiple backfill cycles and verifying job sequence

#### 4. Past-Due Match Handling

**Test:** Create a match with kickoffTime 2 hours ago (status: scheduled), trigger backfill manually
**Expected:**
- scheduleMatchJobs should be called (no early exit)
- shouldRun logic should determine which jobs run (line 249)
- Pre-match jobs (analysis, lineups, predictions) should run with 1s delay if kickoff > now
- MONITOR_LIVE should run immediately if match should be live

**Why human:** Requires time-based scenario simulation and observing job execution

#### 5. Fixtures Worker Existing Match Re-scheduling

**Test:** Delete BullMQ jobs for an existing scheduled match, wait for fixtures fetch (every 3 hours)
**Expected:**
- scheduleMatchJobs should be called for the existing match (not just new matches)
- Jobs should be re-created with deterministic IDs
- isNewMatch log field should be false
- IndexNow should NOT ping (existing match)

**Why human:** Requires Redis queue manipulation and fixtures fetch cycle observation

---

## Phase Assessment

### Overall Status: PASSED

All 5 PIPE requirements are satisfied with verified code changes:

1. **PIPE-01 (Scheduler Early Exit):** ✓ Fixed in 49-01 commit 0d2c7fd
   - Early exit removed, status-based guard added
   - Past-due scheduled matches now enter scheduleMatchJobs()
   
2. **PIPE-02 (Fixtures Worker Re-scheduling):** ✓ Fixed in 49-01 commit dcabe97
   - scheduleMatchJobs called for all scheduled matches
   - IndexNow separated from job scheduling
   
3. **PIPE-03 (Wider Backfill Windows):** ✓ Fixed in 49-02 commit e4196ac
   - Analysis: 48h (was 12h)
   - Lineups: 12h (was 2h)
   - Predictions: 12h (was 2h)
   
4. **PIPE-04 (Chain Validation):** ✓ Fixed in 49-02 commit e4196ac
   - DB queries enforce analysis → lineups → predictions
   - Chain logging added for debugging
   
5. **PIPE-05 (Combined Coverage):** ✓ Verified via combined changes
   - Catch-up: 48h window on startup (catch-up.ts line 20)
   - Backfill: 48h repeatable job every hour (setup.ts line 173)
   - Stuck-match check: every 2 minutes (setup.ts line 198-210)

### Code Quality Assessment

**Strengths:**
- Clean separation of concerns (IndexNow vs job scheduling)
- Idempotent job IDs prevent duplicate scheduling across code paths
- Status-based guards more precise than time-based guards
- Chain enforcement at DB layer (type-safe, impossible to bypass)
- Explicit window tracking in backfill results for debugging

**No Regressions:**
- externalId guard preserved (line 118-121)
- shouldRun logic preserved (line 249) — correct distinction between pre-match and live jobs
- Idempotent job ID checks preserved (lines 207-222)
- Dynamic priority calculation preserved (lines 138, 150, 164, 176, 190)

**Risk Assessment:**
- LOW RISK: Changes are defensive (widen windows, remove early exits)
- NO BREAKING CHANGES: All existing behavior preserved
- SAFETY NETS: Three overlapping coverage mechanisms prevent gaps

### Commits Verified

1. `0d2c7fd` — fix(49-01): remove early exit for past-due matches in scheduleMatchJobs
2. `dcabe97` — fix(49-01): schedule jobs for existing matches in fixtures worker
3. `81f33ab` — docs(49-01): complete scheduler early exit fixes plan
4. `e4196ac` — feat(49-02): widen backfill time windows and add dependency chain validation
5. `a0bb451` — docs(49-02): complete backfill time windows plan

All commits are atomic, well-scoped, and have clear messages explaining the "why" not just the "what".

---

_Verified: 2026-02-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Phase Goal Achieved: YES_
_Ready for Production: YES (with human verification recommended)_
