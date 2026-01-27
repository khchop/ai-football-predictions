# 01-02-SUMMARY: Stats Calculation Services

## Files Created/Modified

### New Files

1. **src/lib/services/points-calculator.ts** (351 lines)
   - Points calculation service with Kicktipp quota scoring
   - Rarity scoring constants (2-6 points based on prediction frequency)
   - Row-level locking for race condition prevention

2. **src/lib/db/queries/stats.ts** (370 lines)
   - Stats query helpers for aggregated model/match statistics
   - Leaderboard with configurable metrics
   - Recent form queries

## Commits Made

1. `21e0016` - feat(01-02): Create points calculator service with rarity scoring
2. `ce141b5` - feat(01-02): Create stats query helpers for model and match statistics

## Verification Results

- **ESLint**: No errors in new files
- **TypeScript**: Files compile without errors in project context
- **Build**: Production build compiles successfully (static page generation fails due to missing DATABASE_URL - expected)

## Features Implemented

### Points Calculator (`src/lib/services/points-calculator.ts`)

- `RARITY_POINTS` constant with tiers:
  - COMMON (>75%): 2 points
  - UNCOMMON (50-75%): 3 points
  - RARE (25-50%): 4 points
  - VERY_RARE (10-25%): 5 points
  - UNIQUE (<10%): 6 points

- `calculatePointsForPrediction()` - Returns scoring breakdown:
  - Tendency points (2-6 based on rarity)
  - Goal diff bonus (+1)
  - Exact score bonus (+3)
  - Total points (max 10)

- `calculateAndSavePoints()` - Scores all predictions for a match:
  - Validates match is finished with scores
  - Calculates rarity-based tendency points
  - Updates predictions with scores
  - Updates model streak statistics

- `updateMatchQuotasWithLock()` - Uses SELECT FOR UPDATE for race condition prevention

### Stats Queries (`src/lib/db/queries/stats.ts`)

- `getModelOverallStats()` - Returns complete model stats including streaks
- `getModelCompetitionStats()` - Returns stats filtered by competition and season
- `getModelClubStats()` - Returns performance vs specific club (home/away)
- `getLeaderboard()` - Returns top models with configurable sorting metric
- `getModelRecentForm()` - Returns last N completed matches with points
- `refreshStatsViews()` - Notifies for materialized view refresh

## Issues Encountered

1. **TypeScript path alias resolution**: Some errors when running tsc directly on files due to @/ alias not being resolved. Fixed by using project-level type checking.

2. **Transaction type mismatch**: Drizzle's PgTransaction type doesn't match the database type. Fixed by removing tx parameter from calculateMatchQuotas() since it can create its own connection.

## Notes

- All functions use existing database patterns from queries.ts
- Streak tracking follows existing updateModelStreak patterns
- Query helpers support optional season and competition filters
- Row locking uses SQL FOR UPDATE via drizzle-orm's sql tagged template
