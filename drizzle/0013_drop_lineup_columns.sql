-- Migration: Drop lineup columns from match_analysis
-- Lineups are no longer used by the prediction pipeline

ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_formation;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_formation;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_starting_xi;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_starting_xi;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_coach;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_coach;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_available;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_updated_at;
ALTER TABLE match_analysis DROP COLUMN IF EXISTS raw_lineups_data;
