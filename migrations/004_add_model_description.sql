-- Add model_description column to models table
ALTER TABLE models ADD COLUMN model_description TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN models.model_description IS 'AI-generated description of the model (2-3 sentences explaining what the model is, key characteristics)';
