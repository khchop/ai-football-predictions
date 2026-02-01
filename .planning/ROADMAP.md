# Roadmap: AI Football Predictions Bug Fix Stabilization

## Overview

This milestone fixes 18 critical bugs across the AI Football Predictions Platform to achieve production stability. The fix order follows dependency analysis: stability first (database/workers), then data accuracy (scoring/cache), then performance (Redis/SSR), and finally UX polish (mobile/real-time). Each phase unblocks the next - pool size enables workers, workers enable accurate scoring, accurate scoring enables meaningful UX improvements.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (1.1, 2.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Critical Stability** - Stop production crashes, ensure predictions complete
- [x] **Phase 2: Data Accuracy** - Ensure leaderboard points are correct and timely
- [x] **Phase 3: Infrastructure Performance** - Reduce load on Redis and improve page performance
- [ ] **Phase 4: UX Polish** - Improve user experience on frontend

## Phase Details

### Phase 1: Critical Stability
**Goal**: Prediction pipeline runs without crashes and handles failures gracefully
**Depends on**: Nothing (first phase)
**Requirements**: CRIT-01, CRIT-02, CRIT-03, CRIT-04, CRIT-05
**Success Criteria** (what must be TRUE):
  1. Database queries complete without "connection pool exhausted" errors under 12+ concurrent workers
  2. Queue workers continue processing when API returns null/malformed data (no unhandled exceptions)
  3. LLM responses with markdown, extra text, or malformed JSON still produce valid predictions
  4. API timeouts trigger appropriate backoff (60s for rate limits, linear for timeouts) without immediate model disable
  5. Models auto-disable only after 5 consecutive failures and auto-recover after 1h cooldown
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Database pool sizing and health monitoring
- [x] 01-02-PLAN.md — Worker error handling and defensive null checks
- [x] 01-03-PLAN.md — JSON parse recovery with multi-strategy extraction
- [x] 01-04-PLAN.md — Timeout handling and model failure classification

### Phase 2: Data Accuracy
**Goal**: Leaderboard totals and points are calculated correctly with no race conditions
**Depends on**: Phase 1 (stable workers required)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. All 35 predictions for a match are scored exactly once, even under concurrent settlement jobs
  2. Leaderboard totals match sum of individual prediction points (no cache-induced discrepancies)
  3. Model streaks correctly reset on wrong predictions and ignore voided/cancelled matches
  4. Cache shows updated data within 5 seconds of settlement completion
  5. Quota points match Kicktipp standard formula (2-6 points based on prediction rarity)
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Settlement transaction with row locking and atomic streak updates
- [x] 02-02-PLAN.md — Quota calculation formula correction to match Kicktipp standard
- [x] 02-03-PLAN.md — Streak tracking edge cases (voided/cancelled/postponed matches)
- [x] 02-04-PLAN.md — Cache invalidation with SCAN and post-transaction timing

### Phase 3: Infrastructure Performance
**Goal**: Redis operations are non-blocking and pages load quickly
**Depends on**: Phase 2 (correct data required before optimizing delivery)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, UIUX-01
**Success Criteria** (what must be TRUE):
  1. Cache pattern deletion uses SCAN (cursor-based), not KEYS (blocking) - ALREADY DONE in Phase 2
  2. Match detail pages with 35+ predictions load in under 2 seconds (streamed)
  3. Circuit breaker state survives Redis restarts (persisted to database fallback)
  4. API-Football requests are tracked against daily budget (100/day free tier)
  5. System continues functioning when Redis is unavailable (degraded mode, no crashes)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Match page SSR optimization with streaming Suspense
- [x] 03-02-PLAN.md — Circuit breaker state database persistence
- [x] 03-03-PLAN.md — API budget enforcement and Redis graceful degradation

### Phase 4: UX Polish
**Goal**: Frontend is responsive, real-time, and handles errors gracefully
**Depends on**: Phase 3 (performance must be stable before polish)
**Requirements**: UIUX-02, UIUX-03, UIUX-04
**Success Criteria** (what must be TRUE):
  1. Prediction cards display correctly on mobile without horizontal scrolling
  2. Leaderboard updates visible within 30 seconds of settlement (polling or cache-busting)
  3. React rendering failures show error UI, not white screens (error boundaries catch all async failures)
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Mobile responsive prediction cards
- [ ] 04-02-PLAN.md — Leaderboard auto-refresh with LiveTabRefresher
- [ ] 04-03-PLAN.md — Error boundary coverage with react-error-boundary

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Stability | 4/4 | ✓ Complete | 2026-02-01 |
| 2. Data Accuracy | 4/4 | ✓ Complete | 2026-02-01 |
| 3. Infrastructure Performance | 3/3 | ✓ Complete | 2026-02-01 |
| 4. UX Polish | 0/3 | Planned | - |

---
*Roadmap created: 2026-01-31*
*Total requirements: 18 (all v1 requirements mapped)*
