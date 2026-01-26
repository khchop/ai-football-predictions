-- Add match_minute column to store live match time display (e.g., "45'", "HT", "67'")
ALTER TABLE matches ADD COLUMN match_minute TEXT;
