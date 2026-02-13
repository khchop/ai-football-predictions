-- Archive inactive models that have scored predictions
-- These models have historical data and should appear in "Show Archived" leaderboard toggle
-- Previously, models were deactivated but never marked as archived

UPDATE models SET archived = true
WHERE active = false
AND id IN (
  SELECT DISTINCT model_id FROM predictions WHERE status = 'scored'
);
