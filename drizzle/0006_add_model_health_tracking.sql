-- Add model health tracking fields
ALTER TABLE models ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_failure_at TEXT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_success_at TEXT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS auto_disabled BOOLEAN DEFAULT FALSE;
