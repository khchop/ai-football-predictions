# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** Phase 2 - Data Accuracy

## Current Position

Phase: 2 of 4 (Data Accuracy)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-01 - Completed 02-03-PLAN.md (Streak edge cases)

Progress: [████████░░░░░░░░░░░] 47%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 3.9 min (3, 3, 7, 3, 4, 3.5, 4 min)
- Total execution time: 27.5 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Critical Stability | 4/4 | 16 min | 4.0 min/plan |
| 2. Data Accuracy | 3/4 | 11.5 min | 3.8 min/plan |
| 3. Infrastructure Performance | 0/4 | - | - |
| 4. UX Polish | 0/3 | - | - |

**Recent Trend:**
- Last 5 plans: 01-04 (3 min), 02-01 (4 min), 02-02 (3.5 min), 02-03 (4 min)
- Trend: Consistent ~3.5-4 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Bug fixes only scope - focus on stability, not new features
- Fix order follows dependency analysis from ARCHITECTURE.md research
- Pool size increased to 20 (from 10) to support 12+ concurrent workers per research recommendations
- Keep-alive enabled to prevent connection drops during idle periods
- Health monitoring interval set to 30s for balance of visibility and overhead
- Alert thresholds: 90% utilization warning, 5+ waiting connections warning, exhaustion error
- Multi-strategy JSON parsing: 4-strategy fallback chain (direct -> markdown -> regex -> flexible) for robust LLM response extraction
- Score validation: Reject negative, >20, non-integer scores with type predicates for type narrowing
- Enhanced parser with fallback: Enhanced parser tries 4 strategies, falls back to original parser for backward compatibility
- Error classification: retryable (network/timeout), unrecoverable (match started/cancelled), unknown (default retry)
- Backoff strategy: rate-limit 60s fixed, timeout linear (5s increments max 30s), parse exponential (5s->10s->20s), default exponential+jitter
- Model isolation: each model wrapped in try-catch, failures don't affect other models in batch
- Null validation: check matchData and rawResponse for null/malformed before processing
- Error-type-aware backoff: 7 error types with type-specific strategies (rate-limit: 60s, timeout: linear, parse: exponential)
- Model-specific failure classification: Only parse errors and 4xx count toward disable threshold, transient errors excluded
- Partial failure reset: Recovered models start with consecutiveFailures=2, require 3 more failures before re-disable
- Auto-disable threshold: Increased from 3 to 5 consecutive model-specific failures
- Automated recovery: Models recover after 1h cooldown with partial reset via 30-minute recovery worker
- Transaction-safe settlement: FOR UPDATE locking on predictions prevents concurrent settlement race conditions
- Streak updates inside transaction: Model streak updates happen atomically with prediction scoring
- Post-commit cache invalidation: Cache only invalidated after transaction commits successfully
- Kicktipp formula: Use (MAX / (10 * P)) - (MAX / 10) + MIN for quota calculation
- shouldUpdateStreak validates match status (finished), scores (not null), and prediction status (not void)
- FOR UPDATE row lock on models table prevents streak corruption from concurrent scoring

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 02-03-PLAN.md (Streak edge cases)
Resume file: None
