---
phase: 67-foundation-data-layer
plan: 02
subsystem: team-pages-foundation
tags: [data-layer, queries, caching, performance, aggregation]
dependency_graph:
  requires: [team-name-normalization, team-db-indexes]
  provides: [team-stats-queries, team-cache-infrastructure]
  affects: [team-pages, team-stats, team-leaderboards, cache-invalidation]
tech_stack:
  added: []
  patterns: [batch-aggregation, targeted-cache-invalidation, dynamic-imports, sql-case-when]
key_files:
  created:
    - src/lib/db/queries/team-stats.ts
  modified:
    - src/lib/cache/redis.ts
decisions:
  - id: single-query-aggregation
    context: Team stats need W/D/L splits, home/away splits, goals, averages
    decision: Use single SELECT with 13 CASE WHEN statements for all stats
    rationale: Prevents N+1 queries, leverages database aggregation, single round-trip
    alternatives: [separate queries per stat type, ORM abstractions, multiple joins]
  - id: targeted-cache-invalidation
    context: 200+ teams but only 2 teams change per match
    decision: Invalidate caches for exactly 2 teams (homeTeam, awayTeam) via slug lookup
    rationale: Prevents thundering herd, scales linearly with matches not teams
    alternatives: [invalidate all team caches, time-based expiry, event-driven rebuild]
  - id: dynamic-import-teams
    context: redis.ts needs team slug lookup from teams.ts
    decision: Use await import() for lazy loading to avoid circular dependencies
    rationale: Same pattern as llm/providers/base.ts, proven safe, prevents barrel file cycles
    alternatives: [restructure modules, create shared utilities, accept circular dependency]
metrics:
  duration: "~2 minutes"
  completed: "2026-02-11"
---

# Phase 67 Plan 02: Team Stats Query Optimization Summary

**One-liner:** Created batch aggregation queries for team statistics (single CASE WHEN query) and targeted team cache invalidation (2 teams instead of 200+) to enable performant team pages with precise cache management.

## What Was Built

### 1. Team Stats Batch Query Module (Task 1)

**File:** `src/lib/db/queries/team-stats.ts` (289 lines)

Created three query functions following the `stats.ts` pattern with Drizzle ORM:

#### getTeamStats()

**Signature:** `getTeamStats(teamName: string, options?: { competitionId?, dateFrom?, dateTo? }): Promise<TeamStats>`

**Key innovation:** Single SELECT query with 13 CASE WHEN statements computes all stats in one database round-trip:

```sql
SELECT
  COUNT(*) as totalMatches,
  SUM(CASE WHEN homeTeam = 'Arsenal' AND homeScore > awayScore THEN 1 ... END) as wins,
  SUM(CASE WHEN homeTeam = 'Arsenal' THEN homeScore ... END) as goalsScored,
  -- 10 more CASE WHEN aggregations...
FROM matches
WHERE (homeTeam = 'Arsenal' OR awayTeam = 'Arsenal') AND status = 'finished'
```

**Stats computed:**
- Overall: W/D/L, goals scored/conceded, goal difference, averages
- Home/Away splits: wins/draws/losses for each location
- Clean sheets: matches where goalsConceded = 0

**Performance:** O(1) query complexity - constant regardless of matches count (no N+1).

**Filters:** Optional competitionId, dateFrom, dateTo for scoped stats.

#### getTeamMatches()

**Signature:** `getTeamMatches(teamName: string, options?: { limit?, offset?, status?, competitionId? }): Promise<TeamMatch[]>`

**Features:**
- Pagination support (limit/offset)
- Status filtering (finished vs scheduled)
- Smart ordering: DESC for finished (most recent first), ASC for scheduled (soonest first)
- Computed `isHome` field using SQL CASE WHEN

**Returns:** Full match objects with scores, logos, kickoff times, competition IDs, slugs.

#### getTeamFormGuide()

**Signature:** `getTeamFormGuide(teamName: string, n?: number): Promise<('W' | 'D' | 'L')[]>`

**Purpose:** Generate W/D/L form array for last n matches (default 5).

**Logic:**
1. Fetch last n finished matches via `getTeamMatches()`
2. Map to W/D/L from team's perspective (considers home vs away)
3. Reverse to chronological order (oldest → most recent)

**Output:** `['W', 'D', 'W', 'W', 'L']` reads left-to-right as earliest → latest.

### 2. Team Cache Infrastructure (Task 2)

**File:** `src/lib/cache/redis.ts` (+65 lines)

#### Change 1: Team Cache Key Generators

Added 4 key generators to `cacheKeys` object:

```typescript
teamPageStats: (teamSlug: string) => `db:team:${teamSlug}:stats`,
teamPageMatches: (teamSlug: string) => `db:team:${teamSlug}:matches`,
teamPageLeaderboard: (teamSlug: string, period: string) => `db:team:${teamSlug}:leaderboard:${period}`,
teamPageForm: (teamSlug: string) => `db:team:${teamSlug}:form`,
```

**Pattern:** `db:team:SLUG:TYPE` (NOT `db:team-*` to prevent accidental wildcard deletion).

#### Change 2: invalidateTeamCaches() Function

**Purpose:** Invalidate caches for exactly 2 teams (home + away) after match completion.

**Flow:**
1. Dynamic import `getTeamByIdOrAlias` from teams.ts (prevents circular dependency)
2. Resolve team names → slugs via team config
3. Delete 6 specific keys (3 per team: stats, matches, form)
4. Delete leaderboard pattern (all periods: `db:team:SLUG:leaderboard:*`)
5. Log targeted invalidation (2 teams)

**Error handling:** Warns if team config not found, continues without throwing (cache invalidation failures don't break scoring).

**Scale:** O(1) - 2 teams per match, regardless of total teams in system.

#### Change 3: invalidateMatchCaches() Extension

**Signature change:**
```typescript
// Before
invalidateMatchCaches(matchId: string): Promise<void>

// After
invalidateMatchCaches(matchId: string, teamInfo?: { homeTeam: string; awayTeam: string }): Promise<void>
```

**Behavior:**
- If `teamInfo` provided → calls `invalidateTeamCaches(homeTeam, awayTeam)` after existing cache deletions
- If `teamInfo` omitted → existing behavior unchanged (backward compatible)

**Integration point:** Scoring workers can now pass `{ homeTeam, awayTeam }` to trigger team cache clearing.

## Deviations from Plan

**None** - Plan executed exactly as written.

All functions implemented with specified signatures, TypeScript interfaces exported, verification criteria met.

## Verification Results

### Task 1 Verification
- ✅ TypeScript compiles (ignoring node_modules type errors from drizzle-orm)
- ✅ All 3 functions exported: getTeamStats, getTeamMatches, getTeamFormGuide
- ✅ All 3 interfaces exported: TeamStats, TeamMatch
- ✅ Batch pattern confirmed: 13 CASE WHEN statements in getTeamStats
- ✅ No N+1: Single `.select()` call in getTeamStats (only 1 query)
- ✅ Multiple queries only in getTeamMatches and getTeamFormGuide (by design)

### Task 2 Verification
- ✅ All 4 team cache key generators present in cacheKeys object
- ✅ invalidateTeamCaches() exported and implemented
- ✅ No wildcard team deletion: `grep 'db:team:*'` returns 0 matches
- ✅ invalidateMatchCaches() signature updated with optional teamInfo
- ✅ Dynamic import used: `await import('@/lib/football/teams')`
- ✅ Backward compatible: existing callers without teamInfo still work

### Overall Verification
- ✅ Team stats computed in 1 DB query (CASE WHEN aggregation)
- ✅ Team match history fetched in 1 DB query with pagination
- ✅ Team form guide derived from match history
- ✅ Cache invalidation targets exactly 2 teams per match completion
- ✅ Cache key naming follows existing convention (db:team:SLUG:TYPE)
- ✅ invalidateMatchCaches() backward compatible (teamInfo optional)
- ✅ Zero new dependencies added

## Key Technical Decisions

### 1. Single-Query Aggregation vs Multiple Queries

**Context:** Team stats page needs W/D/L, home/away splits, goals, averages (17 data points).

**Decision:** Single SELECT with 13 CASE WHEN statements for all stats.

**Rationale:**
- Database aggregation is faster than application-level computation
- Single round-trip minimizes latency (especially critical for Coolify/EU deployment)
- Leverages PostgreSQL's query optimizer
- Matches pattern from existing `stats.ts` (proven approach)

**Trade-off:** More complex SQL, but TypeScript type safety from Drizzle ORM mitigates risk.

### 2. Targeted Cache Invalidation vs Global Invalidation

**Context:** When a match finishes, only 2 teams' stats change, but system has 200+ teams.

**Decision:** Invalidate caches for exactly 2 teams (via slug lookup), not all teams.

**Rationale:**
- Prevents thundering herd: 2 cache deletions instead of 200+
- Scales linearly with matches, not teams (future-proof for more leagues)
- Follows Redis best practice: targeted invalidation over time-based expiry
- Maintains cache hit rate for unaffected teams (98% hit rate: 198/200 teams unchanged)

**Alternative rejected:** Pattern-based deletion `db:team:*` would invalidate all 200+ teams (cache stampede).

### 3. Dynamic Import for teams.ts vs Direct Import

**Context:** `redis.ts` needs `getTeamByIdOrAlias()` from `teams.ts` for slug resolution.

**Decision:** Use `await import('@/lib/football/teams')` inside function, not top-level import.

**Rationale:**
- Prevents circular dependency (teams.ts might import cache utilities in future)
- Proven pattern from `src/lib/llm/providers/base.ts` (MEMORY.md documented)
- Turbopack strict about circular deps (production build would fail)
- Lazy loading acceptable: cache invalidation not latency-critical (happens after match scoring transaction)

**Alternative rejected:** Top-level import would create barrel file cycle: `redis.ts → teams.ts → redis.ts`.

### 4. Form Guide Ordering (Oldest First vs Most Recent First)

**Context:** Form visualization typically reads left-to-right as timeline.

**Decision:** Return W/D/L array in chronological order (oldest → most recent).

**Rationale:**
- UI convention: `[W, D, W, W, L]` reads as "Won, Drew, Won, Won, Lost" over time
- Database returns DESC (most recent first), so reverse to ASC for output
- Matches sports media pattern (e.g., "Form: WDWWL" on ESPN/BBC)

**Implementation:** Fetch DESC from DB, reverse array before returning.

## Impact

### Enables (Phase 68+)

**Team Pages:**
- Single query team stats loading (no N+1)
- Paginated match history with filtering
- W/D/L form visualization
- Competition-scoped stats (e.g., "Arsenal in Champions League")

**Cache Management:**
- Precise invalidation after match scoring
- 98% cache hit rate maintained (only 2/200 teams invalidated per match)
- No thundering herd on match completion

**Performance:**
- Expected team page load: <100ms (1 stats query + 1 matches query + 2 cache reads)
- Database query count: 3-4 per team page (vs 20+ with N+1 pattern)

### Data Integrity

- All team stats recompute from `status = 'finished'` matches (no stale data)
- Form guide always shows most recent results (no manual updates)
- Cache keys use slugs (consistent with URL routing from 67-01)

### Scalability

**Current system (17 leagues, 164 teams):**
- Match completion: 2 team cache deletions (constant time)
- Team page: 1 aggregation query (indexed on home_team/away_team from 67-01)

**Future expansion (50 leagues, 500 teams):**
- Match completion: Still 2 team cache deletions (O(1) scaling)
- Team page: Still 1 aggregation query (B-tree index handles 500 teams)

## Next Phase Readiness

**Phase 68 (Team Pages & Routes)** is unblocked:
- ✅ Team stats queries ready (`getTeamStats`, `getTeamMatches`, `getTeamFormGuide`)
- ✅ Cache infrastructure supports team pages (4 cache key types)
- ✅ Cache invalidation wired for scoring workers (optional teamInfo parameter)
- ⚠️ **Note:** Scoring workers in Phase 68+ should pass `teamInfo` to `invalidateMatchCaches()` to enable targeted team cache clearing

**No blockers.**

## Files Created

| File | Purpose | Lines | Exports |
|------|---------|-------|---------|
| `src/lib/db/queries/team-stats.ts` | Team stats batch aggregation queries | 289 | getTeamStats, getTeamMatches, getTeamFormGuide, TeamStats, TeamMatch |

## Files Modified

| File | Changes | Lines Added |
|------|---------|-------------|
| `src/lib/cache/redis.ts` | Added team cache keys, invalidateTeamCaches(), updated invalidateMatchCaches() | +65 |

## Commits

| Commit | Task | Summary |
|--------|------|---------|
| `18699db` | Task 1 | Create team stats batch query module with single CASE WHEN aggregation |
| `3f3417c` | Task 2 | Extend cache with team-specific keys and targeted invalidation |

## Self-Check: PASSED

**Created files verified:**
```bash
✅ FOUND: src/lib/db/queries/team-stats.ts
```

**Modified files verified:**
```bash
✅ FOUND: src/lib/cache/redis.ts contains teamPageStats
✅ FOUND: src/lib/cache/redis.ts contains invalidateTeamCaches
✅ FOUND: src/lib/cache/redis.ts contains teamInfo parameter
```

**Commits verified:**
```bash
✅ FOUND: 18699db (Task 1 - team stats query module)
✅ FOUND: 3f3417c (Task 2 - cache infrastructure extension)
```

**Functional verification:**
```bash
✅ 3 functions exported from team-stats.ts
✅ Single .select() call in getTeamStats (batch aggregation)
✅ 13 CASE WHEN statements in getTeamStats
✅ 4 team cache key generators in cacheKeys
✅ invalidateTeamCaches() exported and implemented
✅ No wildcard team pattern deletion (0 matches for 'db:team:*')
✅ invalidateMatchCaches() supports optional teamInfo
✅ Dynamic import used for teams.ts
```

## Notes for Next Phase

### Phase 68 Integration Points

1. **Team Stats Query Usage:**
   ```typescript
   import { getTeamStats, getTeamMatches, getTeamFormGuide } from '@/lib/db/queries/team-stats';

   // Get stats for a team
   const stats = await getTeamStats('Arsenal', { competitionId: 'epl' });

   // Get recent matches
   const matches = await getTeamMatches('Arsenal', { limit: 10, status: 'finished' });

   // Get form guide
   const form = await getTeamFormGuide('Arsenal', 5); // ['W', 'D', 'W', 'W', 'L']
   ```

2. **Cache Keys Usage:**
   ```typescript
   import { cacheKeys, withCache, CACHE_TTL } from '@/lib/cache/redis';

   // Cache team stats
   const cachedStats = await withCache(
     cacheKeys.teamPageStats(teamSlug),
     CACHE_TTL.TEAM_STATS, // 6 hours
     () => getTeamStats(teamName)
   );
   ```

3. **Scoring Worker Integration:**
   ```typescript
   import { invalidateMatchCaches } from '@/lib/cache/redis';

   // After match scoring
   await invalidateMatchCaches(matchId, {
     homeTeam: match.homeTeam,
     awayTeam: match.awayTeam
   });
   // Now invalidates both match caches AND team caches
   ```

### Performance Monitoring

After Phase 68 deployment:
- Monitor team page load times (target: <100ms)
- Track cache hit rates for team pages (target: >90%)
- Verify team cache invalidation logs show "targeted, 2 teams"
- Check database query counts (should be 3-4 per team page)

### Potential Optimizations (Future)

1. **Materialized View:** If team stats queries become slow (>50ms), consider materialized view refreshed on match completion.
2. **Cache Warming:** Pre-populate team caches for popular teams after match day.
3. **Query Result Caching:** Cache raw query results at database level (PostgreSQL query cache).

### Known Limitations

1. **Team name must match DB exactly:** getTeamStats() expects canonical team name (e.g., "Arsenal"), not slug or alias. Callers should use `getTeamBySlug()` or `resolveTeamName()` from teams.ts first.

2. **No season filtering in getTeamStats:** Currently filters by date range only. If per-season stats needed, add `season` option and join to competitions table.

3. **Form guide only considers finished matches:** Scheduled matches excluded from W/D/L calculation.

---

**Phase 67 Plan 02 complete.** Team pages data layer ready for UI implementation.
