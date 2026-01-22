-- Migration: Switch from betting to predictions system
-- Date: 2026-01-22
-- Purpose: Simplify to score prediction with Kicktipp Quota Scoring

BEGIN;

-- Drop betting tables (clean slate as requested)
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS model_balances CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  
  -- Prediction
  predicted_home INTEGER NOT NULL,
  predicted_away INTEGER NOT NULL,
  predicted_result TEXT NOT NULL CHECK (predicted_result IN ('H', 'D', 'A')),
  
  -- Scoring (NULL until match finishes)
  -- Kicktipp Quota System: Tendency (2-6) + Diff Bonus (0-1) + Exact Bonus (0-3) = Max 10 pts
  tendency_points INTEGER CHECK (tendency_points >= 2 AND tendency_points <= 6),
  goal_diff_bonus INTEGER CHECK (goal_diff_bonus IN (0, 1)),
  exact_score_bonus INTEGER CHECK (exact_score_bonus IN (0, 3)),
  total_points INTEGER CHECK (total_points >= 0 AND total_points <= 10),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'void')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  scored_at TIMESTAMP,
  
  UNIQUE(match_id, model_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_model_id ON predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);

-- Verify table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictions') THEN
    RAISE EXCEPTION 'predictions table was not created';
  END IF;
END $$;

COMMIT;
