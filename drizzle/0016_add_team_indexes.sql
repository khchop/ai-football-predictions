-- Migration: Add B-tree indexes on team name columns for team page queries
-- Phase 67: Foundation & Data Layer

-- B-tree indexes for exact string matching on team columns
-- These optimize WHERE home_team = 'X' and WHERE away_team = 'X' queries
-- Used by team stats aggregation, team match history, and team leaderboard queries
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team);

-- Note: IF NOT EXISTS ensures idempotency
-- Note: CONCURRENTLY cannot be used in migration files (requires running outside transaction)
--       For manual production execution, use: CREATE INDEX CONCURRENTLY IF NOT EXISTS ...
