import { z } from 'zod';

/**
 * Schema for validating a single prediction before database insert.
 * Guards the database boundary — invalid predictions are rejected here.
 *
 * Validates:
 * - predictedHome: integer between 0 and 20 (football scores)
 * - predictedAway: integer between 0 and 20 (football scores)
 * - matchId: non-empty string
 * - modelId: non-empty string
 */
export const PredictionInsertSchema = z.object({
  predictedHome: z.number().int().min(0).max(20),
  predictedAway: z.number().int().min(0).max(20),
  matchId: z.string().min(1),
  modelId: z.string().min(1),
});

export type PredictionInsertInput = z.infer<typeof PredictionInsertSchema>;
