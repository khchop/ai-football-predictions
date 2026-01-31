# Research Summary: Bug Fix Stabilization

**Research Date:** 2026-01-31
**Milestone Focus:** Bug fixes and stabilization for existing AI Football Predictions Platform

## Key Findings

### Stack Recommendations (STACK.md)

**High Confidence Patterns:**
- BullMQ error-type-aware backoff (rate limit → 60s, timeout → linear, JSON parse → 5s)
- UnrecoverableError for permanent failures (match started, cancelled, invalid data)
- PostgreSQL pool sizing: 20+ connections with health monitoring
- Multi-strategy JSON parsing: direct → markdown extraction → regex → score pattern
- Model auto-disable with time-based recovery (5 failures → disable, 1h cooldown → re-enable)

**Critical Anti-Patterns to Avoid:**
- Swallowing errors silently
- Unbounded retries
- Creating connection per request
- Race conditions without transaction locks

### Architecture Analysis (ARCHITECTURE.md)

**Bug Location Map (16 bugs identified):**

| Category | Count | Root Cause Locations |
|----------|-------|---------------------|
| Critical Bugs | 5 | prediction engine, queue workers, DB pool |
| Data/Accuracy | 5 | scoring worker, cache layer, queries |
| UI/UX | 4 | frontend pages, components |
| Infrastructure | 4 | circuit breaker, cache, Redis |

**Recommended Fix Order:**
1. **Phase 1 (Critical Stability):** DB pool size, worker error handling, JSON parse
2. **Phase 2 (Data Accuracy):** Settlement transactions, cache timing, quota formula
3. **Phase 3 (Performance):** KEYS→SCAN, match page SSR, model recovery
4. **Phase 4 (UX Polish):** Mobile responsiveness, real-time updates, error boundaries

### Pitfalls Research (PITFALLS.md)

**High Risk Areas:**
1. Race conditions in match settlement (no DB transaction lock)
2. JSON parse recovery silently losing predictions
3. DB connection pool exhaustion during bulk operations
4. Model auto-disable breaking recovery (rapid disable-enable loops)
5. Cache invalidation delays showing stale data

**Fix Order Dependencies:**
- UnrecoverableError BEFORE JSON parsing improvements (prevent late predictions)
- Settlement transaction BEFORE cache invalidation (ensure correct data first)
- Connection leak audit BEFORE pool size increase (fix root cause)
- Error classification BEFORE auto-disable changes (distinguish transient vs permanent)

**Validation Checklist (per bug):**
- Settlement: idempotency, all 35 predictions scored once, leaderboard updates
- JSON parse: 10 malformed formats handled, zero predictions lost, raw logging
- Pool: 17 concurrent settlements, waiting count < 5, no leak warnings
- Auto-disable: 5 failures threshold, 1h recovery, permanent vs transient
- Cache: 5s update latency, SCAN not KEYS, hit rate drops on invalidation

## Implications for Requirements

**v1 Scope (Bug Fixes Only):**
- 16 bugs across 4 categories to address
- Phase order matters due to dependencies
- Focus on stability before performance before polish

**Out of Scope:**
- New features (user predictions, new leagues, new models)
- Mobile native apps
- Additional LLM providers
- Real-time WebSocket updates (leaderboard polling is acceptable)

## Confidence Levels

| Research Area | Confidence | Basis |
|---------------|------------|-------|
| Stack patterns | HIGH | Direct codebase analysis + documentation |
| Bug locations | HIGH | Line-number references to actual code |
| Fix order | HIGH | Dependency analysis with rationale |
| Pitfalls | MEDIUM-HIGH | Based on codebase patterns + industry knowledge |

---

*Research complete: 2026-01-31*
*Sources: STACK.md, ARCHITECTURE.md, PITFALLS.md, .planning/codebase/*
