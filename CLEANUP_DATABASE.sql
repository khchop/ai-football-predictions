/**
 * Database Cleanup Script - Fresh Start
 * 
 * Run this SQL to clean up all old data and start fresh from 2026-01-23.
 * This script is safe to run - it only deletes old/test data.
 * 
 * Execute in your PostgreSQL database:
 * 1. Via psql: psql $DATABASE_URL < CLEANUP_DATABASE.sql
 * 2. Via admin tool: Copy-paste into query editor
 * 3. Via Drizzle Studio: Run queries manually
 */

-- ============================================================================
-- STEP 1: Delete old predictions and match data (before 2026-01-23)
-- ============================================================================

BEGIN;

-- Delete predictions for old matches (cascades via foreign key)
DELETE FROM predictions 
WHERE match_id IN (
  SELECT id FROM matches 
  WHERE kickoff_time < '2026-01-23T00:00:00Z'
);

-- Delete match analysis for old matches
DELETE FROM match_analysis 
WHERE match_id IN (
  SELECT id FROM matches 
  WHERE kickoff_time < '2026-01-23T00:00:00Z'
);

-- Delete old matches
DELETE FROM matches 
WHERE kickoff_time < '2026-01-23T00:00:00Z';

COMMIT;

-- ============================================================================
-- STEP 2: Reset model health tracking (give all models a fresh chance)
-- ============================================================================

BEGIN;

UPDATE models SET 
  consecutive_failures = 0,
  last_failure_at = NULL,
  failure_reason = NULL,
  auto_disabled = false,
  -- Also reset streak tracking for fresh start
  current_streak = 0,
  current_streak_type = 'none'
WHERE TRUE;

COMMIT;

-- ============================================================================
-- STEP 3: Clear old model usage tracking
-- ============================================================================

BEGIN;

DELETE FROM model_usage 
WHERE date < '2026-01-23';

COMMIT;

-- ============================================================================
-- STEP 4: Clean up unused betting system tables (optional)
-- ============================================================================

-- The betting system is no longer used. You can optionally clean these up:

BEGIN;

-- Clear all bets (unused)
DELETE FROM bets WHERE TRUE;

-- Clear model balances (unused)
DELETE FROM model_balances WHERE TRUE;

COMMIT;

-- ============================================================================
-- STEP 5: Verify cleanup
-- ============================================================================

-- Check remaining data:
SELECT 
  'matches' as table_name, 
  COUNT(*) as count,
  MIN(kickoff_time) as oldest,
  MAX(kickoff_time) as newest
FROM matches

UNION ALL

SELECT 
  'predictions' as table_name,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM predictions

UNION ALL

SELECT 
  'match_analysis' as table_name,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM match_analysis

UNION ALL

SELECT 
  'models (active)' as table_name,
  COUNT(*) as count,
  NULL as oldest,
  NULL as newest
FROM models
WHERE active = true AND auto_disabled = false

ORDER BY table_name;

-- ============================================================================
-- STEP 6: Create missing tables (if migration hasn't run yet)
-- ============================================================================

-- Create blog_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  author TEXT DEFAULT 'AI Football Predictions',
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  competition_id TEXT REFERENCES competitions(id),
  match_id TEXT REFERENCES matches(id),
  content_type TEXT DEFAULT 'blog',
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  tags TEXT,
  view_count INTEGER DEFAULT 0,
  generated_by TEXT NOT NULL,
  generation_cost TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_competition_id ON blog_posts(competition_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_content_type ON blog_posts(content_type);

-- Create match_previews table if it doesn't exist
CREATE TABLE IF NOT EXISTS match_previews (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id),
  introduction TEXT NOT NULL,
  team_form_analysis TEXT NOT NULL,
  head_to_head TEXT,
  key_players TEXT,
  tactical_analysis TEXT,
  prediction TEXT NOT NULL,
  betting_insights TEXT,
  meta_description TEXT,
  keywords TEXT,
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  generated_by TEXT NOT NULL,
  generation_cost TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_match_previews_match_id ON match_previews(match_id);
CREATE INDEX IF NOT EXISTS idx_match_previews_status ON match_previews(status);
CREATE INDEX IF NOT EXISTS idx_match_previews_published_at ON match_previews(published_at);

-- ============================================================================
-- DONE!
-- ============================================================================

-- After running this script:
-- 1. Restart your application server
-- 2. Workers will re-initialize and fetch fresh fixtures
-- 3. Monitor logs for any errors
-- 4. Check queue status via admin API

SELECT 'Cleanup complete! Restart your server to begin fresh.' as message;
