# Requirements: v2.7 Pipeline Reliability & Retroactive Backfill

**Defined:** 2026-02-06
**Core Value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete — zero matches should go unserved

## v2.7 Requirements

Requirements for v2.7 milestone. Each maps to roadmap phases.

### Pipeline Scheduling

- [ ] **PIPE-01**: Catch-up scheduling handles past-due matches — schedules analysis/predictions/lineups immediately for matches where kickoff has passed but jobs never ran
- [ ] **PIPE-02**: Fixtures worker detects existing matches with no delayed/active BullMQ jobs and re-schedules them
- [ ] **PIPE-03**: Backfill worker checks wider time windows — 48h for missing analysis (not 12h), 12h for missing predictions (not 2h)
- [ ] **PIPE-04**: Backfill worker runs analysis → lineups → predictions chain for matches missing any step (not just individual steps)
- [ ] **PIPE-05**: After server restart, all matches within 48h have correct delayed jobs in Redis (verified by queue metrics)

### Settlement Recovery

- [ ] **SETTLE-01**: All 43 failed settlement jobs are investigated and root cause identified
- [ ] **SETTLE-02**: Settlement worker handles case where match is finished but has zero predictions (creates settlement retry instead of permanent failure)
- [ ] **SETTLE-03**: Backfill settlement covers all finished matches with unscored predictions
- [ ] **SETTLE-04**: Settlement retry cleans up stale failed jobs and re-queues with fresh data

### Retroactive Backfill

- [ ] **RETRO-01**: Script identifies all matches from last 7 days missing predictions
- [ ] **RETRO-02**: Script generates analysis data retroactively for matches missing it (using API-Football historical data)
- [ ] **RETRO-03**: Script generates predictions using pre-match context sent to all 42 LLMs
- [ ] **RETRO-04**: Finished match predictions are scored against actual results immediately after generation
- [ ] **RETRO-05**: Live match predictions are generated with available pre-match data (scored when match finishes)
- [ ] **RETRO-06**: Script is idempotent — running it twice doesn't create duplicate predictions

### Monitoring & Observability

- [ ] **MON-01**: Pipeline health endpoint shows match coverage (% of upcoming matches with scheduled analysis/predictions jobs)
- [ ] **MON-02**: Admin dashboard shows matches approaching kickoff with no scheduled jobs (gap detection)
- [ ] **MON-03**: Alert logged when match is within 2h of kickoff with no analysis job
- [ ] **MON-04**: Queue metrics include "matches without predictions" count alongside existing queue stats
- [ ] **MON-05**: Settlement failure dashboard shows failed settlement jobs with error reasons

## v2.8+ Requirements (Deferred)

### Pipeline Hardening

- **HARD-D01**: Automatic Redis persistence/backup to prevent job loss on restart
- **HARD-D02**: Multi-attempt prediction scheduling (T-30m, T-15m, T-5m fallback windows)
- **HARD-D03**: Prediction quality scoring (detect and flag low-confidence predictions)

### Advanced Monitoring

- **AMON-D01**: Slack/webhook alerts for pipeline failures
- **AMON-D02**: Historical pipeline reliability metrics (% matches with predictions over time)
- **AMON-D03**: Model-level health trends (per-model success rate over 7 days)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redis persistence configuration | Infrastructure-level change, not application code |
| New LLM models or providers | v2.7 is about reliability, not expansion |
| Real-time prediction streaming | Not needed for retroactive backfill |
| Changing prediction timing (T-30m) | Current timing is correct, issue is scheduling not timing |
| Modifying Kicktipp scoring formula | Scoring formula is validated, issue is settlement execution |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 49 | Pending |
| PIPE-02 | Phase 49 | Pending |
| PIPE-03 | Phase 49 | Pending |
| PIPE-04 | Phase 49 | Pending |
| PIPE-05 | Phase 49 | Pending |
| SETTLE-01 | Phase 50 | Pending |
| SETTLE-02 | Phase 50 | Pending |
| SETTLE-03 | Phase 50 | Pending |
| SETTLE-04 | Phase 50 | Pending |
| RETRO-01 | Phase 51 | Pending |
| RETRO-02 | Phase 51 | Pending |
| RETRO-03 | Phase 51 | Pending |
| RETRO-04 | Phase 51 | Pending |
| RETRO-05 | Phase 51 | Pending |
| RETRO-06 | Phase 51 | Pending |
| MON-01 | Phase 52 | Pending |
| MON-02 | Phase 52 | Pending |
| MON-03 | Phase 52 | Pending |
| MON-04 | Phase 52 | Pending |
| MON-05 | Phase 52 | Pending |

**Coverage:**
- v2.7 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

**Coverage validation:** ✓ 100% (20/20 requirements mapped)

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after roadmap created with full traceability*
