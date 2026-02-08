-- Migration: Add provider attribution columns to predictions table
-- Phase 61: Provider Attribution

-- Provider attribution columns (Phase 61)
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS provider_used TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS attempted_providers TEXT;

-- Index for admin dashboard GROUP BY provider_used queries
CREATE INDEX IF NOT EXISTS idx_predictions_provider_used ON predictions(provider_used);

-- Composite index for time-filtered provider distribution queries
CREATE INDEX IF NOT EXISTS idx_predictions_created_provider ON predictions(created_at, provider_used);
