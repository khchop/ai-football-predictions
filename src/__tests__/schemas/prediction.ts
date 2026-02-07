/**
 * Prediction Validation Schemas
 *
 * Production schema for database boundary validation:
 * See src/lib/validation/prediction-schema.ts (PredictionInsertSchema)
 *
 * This file contains TEST schemas for validating LLM output format.
 * The field names differ: LLM output uses match_id/home_score/away_score,
 * while database insert uses matchId/predictedHome/predictedAway.
 *
 * These validate JSON STRUCTURE, not exact values (LLM outputs are non-deterministic).
 */
import { z } from 'zod';

/**
 * Schema for a single prediction output
 * Validates structure: match_id, home_score, away_score
 */
export const PredictionOutputSchema = z.object({
  match_id: z.string(),
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
});

/**
 * Schema for batch prediction output (array of predictions)
 */
export const BatchPredictionSchema = z.array(PredictionOutputSchema);

/**
 * Type alias for a single prediction
 */
export type PredictionOutput = z.infer<typeof PredictionOutputSchema>;

/**
 * Type alias for batch predictions
 */
export type BatchPrediction = z.infer<typeof BatchPredictionSchema>;

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  issues?: z.ZodIssue[];
}

/**
 * Validate a single prediction
 * @param input - Unknown input to validate
 * @returns Validation result with data or errors
 */
export function validatePrediction(input: unknown): ValidationResult<PredictionOutput> {
  const result = PredictionOutputSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    issues: result.error.issues,
  };
}

/**
 * Validate batch predictions
 * @param input - Unknown input to validate
 * @returns Validation result with data or errors
 */
export function validateBatchPrediction(input: unknown): ValidationResult<BatchPrediction> {
  const result = BatchPredictionSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    issues: result.error.issues,
  };
}
