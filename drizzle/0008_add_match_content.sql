-- Match content: 3-section narrative for SEO/GEO
-- Replaces raw odds panel with progressive content:
-- 1. Pre-match (~150-200 words) - generated after odds refresh
-- 2. Betting (~150-200 words) - generated after AI predictions
-- 3. Post-match (~150-200 words) - generated after scoring
-- Total: ~500 words per match

CREATE TABLE IF NOT EXISTS match_content (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Pre-match section (generated after odds refresh, ~6h before kickoff)
  pre_match_content TEXT,
  pre_match_generated_at TEXT,
  
  -- Betting section (generated after AI predictions, ~30m before kickoff)
  betting_content TEXT,
  betting_generated_at TEXT,
  
  -- Post-match section (generated after scoring complete)
  post_match_content TEXT,
  post_match_generated_at TEXT,
  
  -- AI generation metadata
  generated_by TEXT DEFAULT 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  total_tokens INTEGER DEFAULT 0,
  total_cost TEXT DEFAULT '0',
  
  created_at TEXT DEFAULT now(),
  updated_at TEXT DEFAULT now()
);

-- Index for quick lookup by match ID
CREATE INDEX IF NOT EXISTS idx_match_content_match_id ON match_content(match_id);
