-- Migration: Add Betting System Tables and Columns
-- Date: 2026-01-22
-- Description: Transform from prediction scoring to betting simulation

-- =====================================================
-- PART 1: Add new odds columns to match_analysis
-- =====================================================

ALTER TABLE match_analysis
  ADD COLUMN IF NOT EXISTS odds_1x TEXT,
  ADD COLUMN IF NOT EXISTS odds_x2 TEXT,
  ADD COLUMN IF NOT EXISTS odds_12 TEXT,
  ADD COLUMN IF NOT EXISTS odds_over_05 TEXT,
  ADD COLUMN IF NOT EXISTS odds_under_05 TEXT,
  ADD COLUMN IF NOT EXISTS odds_over_15 TEXT,
  ADD COLUMN IF NOT EXISTS odds_under_15 TEXT,
  ADD COLUMN IF NOT EXISTS odds_over_25 TEXT,
  ADD COLUMN IF NOT EXISTS odds_under_25 TEXT,
  ADD COLUMN IF NOT EXISTS odds_over_35 TEXT,
  ADD COLUMN IF NOT EXISTS odds_under_35 TEXT,
  ADD COLUMN IF NOT EXISTS odds_over_45 TEXT,
  ADD COLUMN IF NOT EXISTS odds_under_45 TEXT,
  ADD COLUMN IF NOT EXISTS odds_btts_yes TEXT,
  ADD COLUMN IF NOT EXISTS odds_btts_no TEXT;

-- =====================================================
-- PART 2: Create betting seasons table
-- =====================================================

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- PART 3: Create model balances table
-- =====================================================

CREATE TABLE IF NOT EXISTS model_balances (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id),
  season TEXT NOT NULL,
  starting_balance REAL DEFAULT 1000.00,
  current_balance REAL DEFAULT 1000.00,
  total_wagered REAL DEFAULT 0.00,
  total_won REAL DEFAULT 0.00,
  total_bets INTEGER DEFAULT 0,
  winning_bets INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(model_id, season)
);

CREATE INDEX IF NOT EXISTS idx_model_balances_season ON model_balances(season);
CREATE INDEX IF NOT EXISTS idx_model_balances_model_id ON model_balances(model_id);

-- =====================================================
-- PART 4: Create bets table
-- =====================================================

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  model_id TEXT NOT NULL REFERENCES models(id),
  season TEXT NOT NULL,
  bet_type TEXT NOT NULL, -- 'result' | 'over_under' | 'btts'
  selection TEXT NOT NULL, -- '1' | '2' | '1X' | 'X2' | 'O2.5' | 'U1.5' | 'Yes' | 'No'
  odds REAL NOT NULL,
  stake REAL DEFAULT 1.00,
  status TEXT DEFAULT 'pending', -- 'pending' | 'won' | 'lost' | 'void'
  payout REAL,
  profit REAL,
  created_at TEXT DEFAULT (datetime('now')),
  settled_at TEXT,
  UNIQUE(match_id, model_id, bet_type)
);

CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_model_id ON bets(model_id);
CREATE INDEX IF NOT EXISTS idx_bets_season ON bets(season);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

-- =====================================================
-- PART 5: Initialize current season
-- =====================================================

-- Create 2024-2025 season (current season)
INSERT INTO seasons (id, name, start_date, is_current)
VALUES ('season-2024-2025', '2024-2025', '2024-08-01', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 6: Initialize all models with starting balance
-- =====================================================

INSERT INTO model_balances (id, model_id, season, starting_balance, current_balance)
SELECT 
  'balance-' || models.id || '-2024-2025' as id,
  models.id as model_id,
  '2024-2025' as season,
  1000.00 as starting_balance,
  1000.00 as current_balance
FROM models
WHERE models.active = true
ON CONFLICT (model_id, season) DO NOTHING;

-- =====================================================
-- Migration complete
-- =====================================================
