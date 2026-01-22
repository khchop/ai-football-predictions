-- Hotfix Migration: Restore betting tables as empty structures
-- Date: 2026-01-22
-- Purpose: Allow old queries to run while we update code to use predictions

BEGIN;

-- Restore bets table (empty structure)
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  season TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds DOUBLE PRECISION NOT NULL,
  stake DOUBLE PRECISION DEFAULT 1.00,
  status TEXT DEFAULT 'pending',
  payout DOUBLE PRECISION,
  profit DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_model_id ON bets(model_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

-- Restore model_balances table (empty structure)
CREATE TABLE IF NOT EXISTS model_balances (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  season TEXT NOT NULL,
  starting_balance DOUBLE PRECISION DEFAULT 1000.00,
  current_balance DOUBLE PRECISION DEFAULT 1000.00,
  total_wagered DOUBLE PRECISION DEFAULT 0.00,
  total_won DOUBLE PRECISION DEFAULT 0.00,
  total_bets INTEGER DEFAULT 0,
  winning_bets INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_balances_model_id ON model_balances(model_id);
CREATE INDEX IF NOT EXISTS idx_model_balances_season ON model_balances(season);

-- Restore seasons table (empty structure)
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMIT;
