-- Add quota columns to matches table for Kicktipp-style scoring
-- Quotas represent how many points a correct tendency prediction earns (2-6 range)
-- Lower quota = more models predicted that outcome = less points for being right

ALTER TABLE matches ADD COLUMN quota_home REAL;
ALTER TABLE matches ADD COLUMN quota_draw REAL;
ALTER TABLE matches ADD COLUMN quota_away REAL;

-- Update predictions table: simplify scoring columns for quota system
-- Remove deprecated columns (BTTS, Over/Under, Upset bonus)
-- Keep: tendency points (from quota), goal diff bonus, exact score bonus, total
