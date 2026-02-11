---
phase: 67-foundation-data-layer
plan: 01
subsystem: team-pages-foundation
tags: [data-layer, mapping, indexes, performance]
dependency_graph:
  requires: []
  provides: [team-name-normalization, team-db-indexes]
  affects: [team-pages, team-stats, team-leaderboards]
tech_stack:
  added: []
  patterns: [configuration-file, db-indexes, validation-script]
key_files:
  created:
    - src/lib/football/teams.ts
    - scripts/validate-team-mapping.ts
    - drizzle/0016_add_team_indexes.sql
  modified:
    - src/lib/db/schema.ts
decisions: []
metrics:
  duration: "~4 minutes"
  completed: "2026-02-11"
---

# Phase 67 Plan 01: Team Name Mapping & Database Indexes Summary

**One-liner:** Created team name normalization config with 164 DB-audited entries and B-tree indexes for home_team/away_team columns to enable performant team page queries.

## What Was Built

### 1. Team Name Mapping Configuration (Task 1)

**File:** `src/lib/football/teams.ts`

Created comprehensive team name mapping following the `competitions.ts` pattern:

- **164 teams mapped** from database audit (SELECT DISTINCT on matches.home_team and matches.away_team)
- **Organized by league:** EPL (20), La Liga (20), Bundesliga (18), Serie A (20), Ligue 1 (18), Eredivisie (18), Super Lig (18), UCL (32)
- **Zero slug collisions** - all slugs are unique across 164 teams
- **Alias support** for common variants (e.g., "Man City" → "Manchester City", "PSG" → "Paris Saint Germain")

**Interface:**
```typescript
interface TeamConfig {
  id: string;           // Canonical DB name (e.g., "Manchester City")
  slug: string;         // URL slug (e.g., "manchester-city")
  aliases?: string[];   // Variants (e.g., ["Man City", "Man. City"])
  league: string;       // Competition ID (e.g., "epl", "laliga")
}
```

**Exports:**
- `TEAMS: TeamConfig[]` - Full array of 164 teams
- `getTeamBySlug(slug)` - Primary lookup for URL routing
- `getTeamByIdOrAlias(name)` - DB name resolution (checks id first, then aliases)
- `resolveTeamName(slugOrAlias)` - Returns canonical id
- `getTeamsByLeague(leagueId)` - Filter by competition
- `getAllTeamSlugs()` - All slugs for sitemap/static generation
- `validateTeamMapping(dbTeamNames)` - Audit function for scripts

**Validation Script:** `scripts/validate-team-mapping.ts`

Connects to database, queries all distinct team names, verifies 100% coverage via `getTeamByIdOrAlias()`.

**Result:** ✅ All 164 DB team names resolve correctly (0 unmapped)

### 2. Database Performance Indexes (Task 2)

**Migration:** `drizzle/0016_add_team_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team);
```

- B-tree indexes for exact string matching
- Optimizes `WHERE home_team = 'X'` and `WHERE away_team = 'X'` queries
- Idempotent with `IF NOT EXISTS`
- Production note: Cannot use `CONCURRENTLY` in transaction-based migrations

**Schema Update:** `src/lib/db/schema.ts`

Added index declarations to matches table:
```typescript
index('idx_matches_home_team').on(table.homeTeam),
index('idx_matches_away_team').on(table.awayTeam),
```

**Total indexes on matches table:** 7 (5 existing + 2 new)

## Deviations from Plan

**None** - Plan executed exactly as written.

All 164 teams from database were mapped successfully on first attempt. No unmapped teams, no slug collisions, no missing functionality.

## Verification Results

### Task 1 Verification
- ✅ TypeScript compiles: `src/lib/football/teams.ts` has no syntax errors
- ✅ No slug collisions: All 164 slugs are unique
- ✅ Every DB team resolves: `scripts/validate-team-mapping.ts` exits 0
- ✅ Helper functions work: All 6 helper functions tested and pass
- ✅ Follows pattern: Structure matches `competitions.ts` exactly

### Task 2 Verification
- ✅ Migration file exists: `drizzle/0016_add_team_indexes.sql` with valid CREATE INDEX statements
- ✅ Schema updated: Both `idx_matches_home_team` and `idx_matches_away_team` present
- ✅ No indexes removed: All 5 existing indexes intact
- ✅ Schema imports: `matches` table definition compiles without errors

## Key Technical Decisions

1. **No slug suffixes needed:** Despite 164 teams across multiple leagues, natural slugs were unique (e.g., no "Barcelona" collision because only one exists in dataset)

2. **UCL as "league" value:** Teams appearing only in Champions League competition get `league: "ucl"` (e.g., Celtic, Rangers, Red Bull Salzburg)

3. **Alias strategy:** Only added aliases for known common variants. Did not preemptively add abbreviations for all teams.

4. **Migration idempotency:** Used `IF NOT EXISTS` instead of `CONCURRENTLY` because migrations run in transactions. Production can manually run with `CONCURRENTLY` if needed for zero-downtime.

## Impact

### Enables (Phase 68)
- Team page URL routing via `/teams/[slug]`
- Team name display from slugs
- Team filtering by league for index pages
- Sitemap generation with all team URLs

### Performance Improvement
- **Before:** Full table scans on 5000+ match rows for team queries
- **After:** B-tree indexed lookups (expected <10ms for team stats queries)

### Data Integrity
- Every team page will resolve to correct matches (100% coverage)
- No 404s from unmapped team names
- Consistent canonical names across all pages

## Next Phase Readiness

**Phase 68 (Team Pages & Stats)** is unblocked:
- ✅ Team name normalization complete
- ✅ URL slug mapping ready
- ✅ Database indexes prepared for deployment
- ⚠️ **Action required:** Deploy migration `drizzle/0016_add_team_indexes.sql` to production before Phase 68 execution

**Deployment command:** `npx drizzle-kit push` or via Coolify/manual SQL execution

## Files Created

| File | Purpose | Lines | Exports |
|------|---------|-------|---------|
| `src/lib/football/teams.ts` | Team name normalization config | 282 | TeamConfig, TEAMS, 6 helpers |
| `scripts/validate-team-mapping.ts` | DB coverage validation script | 42 | - |
| `drizzle/0016_add_team_indexes.sql` | B-tree index migration | 12 | - |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Added 2 index declarations to matches table (lines 48-49) |

## Commits

| Commit | Task | Summary |
|--------|------|---------|
| `6771de1` | Task 1 | Create team name mapping file with 164 DB-audited entries |
| `2e4370d` | Task 2 | Add B-tree indexes for team columns and update schema |

## Self-Check: PASSED

**Created files verified:**
```bash
✅ FOUND: src/lib/football/teams.ts
✅ FOUND: scripts/validate-team-mapping.ts
✅ FOUND: drizzle/0016_add_team_indexes.sql
```

**Modified files verified:**
```bash
✅ FOUND: src/lib/db/schema.ts contains idx_matches_home_team
✅ FOUND: src/lib/db/schema.ts contains idx_matches_away_team
```

**Commits verified:**
```bash
✅ FOUND: 6771de1 (Task 1 - team mapping file)
✅ FOUND: 2e4370d (Task 2 - B-tree indexes)
```

**Functional verification:**
```bash
✅ All 164 DB team names resolve via getTeamByIdOrAlias()
✅ No slug collisions detected
✅ Helper functions tested and working
✅ Schema compiles without syntax errors
```

## Notes for Next Phase

1. **Migration deployment:** Phase 68 executor should verify indexes exist in production before running team page queries. Check with `\d matches` in psql or query `pg_indexes` table.

2. **Slug stability:** Team slugs are now canonical URLs. Do not change slugs without 301 redirects.

3. **New teams:** When new teams appear in matches table, add entries to `src/lib/football/teams.ts` with appropriate league assignment. Run validation script to verify coverage.

4. **Alias expansion:** If team name variants cause user confusion (e.g., search failures), add aliases to existing TeamConfig entries. No migration needed - purely code change.

5. **Index monitoring:** After migration deployment, monitor query performance with `EXPLAIN ANALYZE` on team page queries. Indexes should show "Index Scan" not "Seq Scan".

---

**Phase 67 Plan 01 complete.** Foundation ready for team pages implementation.
