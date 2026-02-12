-- Add archived column to models table for model lifecycle management
-- Archived models retain historical data but are excluded from active operations
ALTER TABLE models ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_models_archived ON models (archived);
