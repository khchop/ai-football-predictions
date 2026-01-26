-- Fix tendency_points check constraint to allow 0 (for wrong predictions)
-- Previously it was CHECK (tendency_points >= 2 AND tendency_points <= 6)
-- which caused wrong predictions (tendency_points = 0) to fail scoring

BEGIN;

-- Drop the old constraint (trying both likely names just in case)
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_tendency_points_check;
-- Also try the name that might have been generated if the previous migration didn't name it explicitly (though 002 didn't name it, Postgres generates one)
-- Usually <table>_<column>_check

-- Add the corrected constraint
ALTER TABLE predictions 
ADD CONSTRAINT predictions_tendency_points_check 
CHECK (tendency_points = 0 OR (tendency_points >= 2 AND tendency_points <= 6));

COMMIT;
