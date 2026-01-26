-- Track failed prediction attempts per match/model pair
-- Allows retrying up to 3 times before giving up
-- Records are auto-cleaned after 7 days
CREATE TABLE IF NOT EXISTS prediction_attempts (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  model_id TEXT NOT NULL REFERENCES models(id),
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT now(),
  UNIQUE(match_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_attempts_match_id ON prediction_attempts(match_id);
CREATE INDEX IF NOT EXISTS idx_prediction_attempts_created_at ON prediction_attempts(created_at);
