# Requirements: AI Football Predictions Platform

**Defined:** 2026-01-31
**Core Value:** Prediction pipeline reliably generates scores from 35 LLMs before kickoff and accurately calculates Kicktipp quota points when matches complete

## v1 Requirements

Bug fix stabilization milestone. All requirements are fixes to existing functionality.

### Critical Bugs (CRIT)

- [x] **CRIT-01**: JSON parse failures handled with multi-strategy extraction (direct -> markdown -> regex -> score pattern)
- [x] **CRIT-02**: API timeouts recovered gracefully with error-type-aware backoff (rate limit -> 60s, timeout -> linear)
- [x] **CRIT-03**: Model auto-disable uses proper threshold (5 failures) and time-based recovery (1h cooldown)
- [x] **CRIT-04**: Queue workers handle null/malformed API data without crashing (defensive error handling)
- [x] **CRIT-05**: Database connection pool sized appropriately (20+ connections) with health monitoring

### Data Accuracy (DATA)

- [ ] **DATA-01**: Settlement uses database transaction with row lock to prevent race conditions
- [ ] **DATA-02**: Leaderboard totals calculated correctly (cache invalidation after all predictions scored)
- [ ] **DATA-03**: Streak tracking handles voided matches, draws, and cancelled matches correctly
- [ ] **DATA-04**: Cache invalidation timing ensures no stale data visible after settlement
- [ ] **DATA-05**: Quota point calculation matches Kicktipp standard formula

### UI/UX (UIUX)

- [ ] **UIUX-01**: Match detail pages load within acceptable time (streaming predictions, lazy load)
- [ ] **UIUX-02**: Leaderboard updates visible without manual refresh (polling or cache-busting)
- [ ] **UIUX-03**: Mobile responsiveness for prediction cards (no horizontal scroll required)
- [ ] **UIUX-04**: Error boundaries catch all React rendering failures (no white screens)

### Infrastructure (INFR)

- [ ] **INFR-01**: Circuit breaker state persists through Redis restarts (prevent API flood on recovery)
- [ ] **INFR-02**: Cache pattern deletion uses SCAN instead of KEYS (non-blocking Redis operations)
- [ ] **INFR-03**: API rate limits enforced at budget level (prevent free tier exhaustion)
- [ ] **INFR-04**: Redis unavailability handled gracefully (system continues without cache)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Performance

- **PERF-01**: Real-time leaderboard updates via WebSocket (currently using polling)
- **PERF-02**: Prediction generation parallelization (currently sequential per model)

### Observability

- **OBSV-01**: Distributed tracing for prediction pipeline
- **OBSV-02**: Custom metrics dashboards for queue health
- **OBSV-03**: Alerting for model failure patterns

### Content

- **CONT-01**: Improved post-match roundup quality
- **CONT-02**: Pre-match preview content generation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User prediction submission | View-only platform by design |
| Betting integration | No gambling features |
| Additional LLM providers | Sticking with Together AI (35 models sufficient) |
| New leagues | Maintain existing 17 leagues |
| New prediction types | Stay with exact scores only |
| Mobile native apps | Web-only for now |
| Model fine-tuning | Using off-the-shelf models |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRIT-01 | Phase 1 | Complete |
| CRIT-02 | Phase 1 | Complete |
| CRIT-03 | Phase 1 | Complete |
| CRIT-04 | Phase 1 | Complete |
| CRIT-05 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| UIUX-01 | Phase 3 | Pending |
| UIUX-02 | Phase 4 | Pending |
| UIUX-03 | Phase 4 | Pending |
| UIUX-04 | Phase 4 | Pending |
| INFR-01 | Phase 3 | Pending |
| INFR-02 | Phase 3 | Pending |
| INFR-03 | Phase 3 | Pending |
| INFR-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 after roadmap creation*
