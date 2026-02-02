# Roadmap: AI Football Predictions Platform

## Milestones

- [x] **v1.0 Bug Fix Stabilization** - Phases 1-4 (shipped 2026-02-01)
- [ ] **v1.1 Stats Accuracy & SEO** - Phases 5-8 (in progress)

## Phases

<details>
<summary>v1.0 Bug Fix Stabilization (Phases 1-4) - SHIPPED 2026-02-01</summary>

### Phase 1: Database Resilience
**Goal**: Prevent database-related crashes
**Plans**: 3 plans

Plans:
- [x] 01-01: Connection pool sizing and health monitoring
- [x] 01-02: Transaction safety for settlements
- [x] 01-03: Database error recovery strategies

### Phase 2: Queue Worker Stability
**Goal**: Reliable job processing for predictions
**Plans**: 4 plans

Plans:
- [x] 02-01: Multi-strategy JSON extraction
- [x] 02-02: Error-type-aware model recovery
- [x] 02-03: API timeout handling
- [x] 02-04: Budget enforcement

### Phase 3: Scoring & Caching Fixes
**Goal**: Accurate scoring and cache management
**Plans**: 4 plans

Plans:
- [x] 03-01: Kicktipp quota calculation fix
- [x] 03-02: Leaderboard totals correction
- [x] 03-03: Streak tracking improvements
- [x] 03-04: Cache invalidation timing
- [x] 03-05: Cache pattern deletion optimization
- [x] 03-06: Redis unavailability handling

### Phase 4: Frontend Performance
**Goal**: Fast, responsive UI without errors
**Plans**: 3 plans

Plans:
- [x] 04-01: Streaming SSR for match pages
- [x] 04-02: Mobile responsiveness
- [x] 04-03: Error boundaries
- [x] 04-04: Auto-refresh leaderboards

</details>

## v1.1 Stats Accuracy & SEO (In Progress)

**Milestone Goal:** Fix inconsistent accuracy calculations and optimize for search engines.

### Phase 5: Stats Foundation

**Goal**: Single source of truth for accuracy calculations that produces consistent numbers everywhere

**Depends on**: Phase 4 (v1.0)

**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06

**Success Criteria** (what must be TRUE):
  1. User sees identical accuracy numbers for same model across leaderboard, model detail page, and competition pages (no more 94% vs 87% confusion)
  2. Model detail page displays correct tendency accuracy in hero section, not exact score percentage
  3. All stats queries use standardized formula with `tendencyPoints > 0` denominator
  4. Zero-prediction edge cases handled gracefully without division-by-zero errors
  5. Stats service layer provides single entry point for all accuracy calculations

**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md - Create stats service layer with canonical accuracy formula
- [x] 05-02-PLAN.md - Fix queries.ts functions with incorrect formulas
- [x] 05-03-PLAN.md - Fix model detail page metadata accuracy bug

### Phase 6: Data Migration

**Goal**: Historical stats recalculated with corrected formula, preserving audit trail

**Depends on**: Phase 5

**Requirements**: MIGR-01, MIGR-02, MIGR-03

**Success Criteria** (what must be TRUE):
  1. All 160 models across 17 leagues show recalculated accuracy using corrected formula
  2. Leaderboard rankings reflect corrected calculations without cache serving stale data
  3. User can view explanation of why accuracy numbers changed (changelog, methodology page)
  4. Historical data preserved for 30-day rollback window in case of issues

**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md - Execute migration with snapshot and verification report
- [x] 06-02-PLAN.md - Create methodology page and changelog entry

### Phase 7: SEO Enhancement

**Goal**: Search engines understand and surface predictions through structured data and optimized metadata

**Depends on**: Phase 6

**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06, SEO-07

**Success Criteria** (what must be TRUE):
  1. Match pages render Schema.org SportsEvent structured data in Google Rich Results Test
  2. Blog roundup pages render Schema.org Article structured data with correct metadata
  3. Competition pages have complete metadata (title, description, OG tags) and structured data
  4. Social shares display correct accuracy metric with specific label (not generic "Accurate")
  5. All pages pass Google Rich Results Test without errors or warnings

**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: UX Transparency

**Goal**: Users understand what accuracy metrics mean and trust the numbers

**Depends on**: Phase 7

**Requirements**: UX-01, UX-02, UX-03

**Success Criteria** (what must be TRUE):
  1. User sees denominator alongside percentage (e.g., "81/160 (50.6%)") for all accuracy displays
  2. User can hover/tap on metric to see tooltip explaining calculation methodology
  3. Leaderboard displays trustworthy numbers that match user's manual spot-checks of predictions

**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Resilience | v1.0 | 3/3 | Complete | 2026-02-01 |
| 2. Queue Worker Stability | v1.0 | 4/4 | Complete | 2026-02-01 |
| 3. Scoring & Caching Fixes | v1.0 | 6/6 | Complete | 2026-02-01 |
| 4. Frontend Performance | v1.0 | 4/4 | Complete | 2026-02-01 |
| 5. Stats Foundation | v1.1 | 3/3 | Complete | 2026-02-02 |
| 6. Data Migration | v1.1 | 2/2 | Complete | 2026-02-02 |
| 7. SEO Enhancement | v1.1 | 0/3 | Not started | - |
| 8. UX Transparency | v1.1 | 0/1 | Not started | - |

---
*Last updated: 2026-02-02 (Phase 6 complete with 2 plans)*
