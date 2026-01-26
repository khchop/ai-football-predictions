-- Add critical indexes for performance and data integrity
-- This migration adds unique constraints and performance indexes

-- Unique constraint: one prediction per match per model
CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_match_model ON predictions(match_id, model_id);

-- Unique constraint: one analysis per match
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_analysis_match_id ON match_analysis(match_id);

-- Performance index for match queries (status + kickoff_time)
CREATE INDEX IF NOT EXISTS idx_matches_status_kickoff ON matches(status, kickoff_time);

-- Performance index for prediction lookups by match
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);

-- Performance index for prediction lookups by model
CREATE INDEX IF NOT EXISTS idx_predictions_model_id ON predictions(model_id);
