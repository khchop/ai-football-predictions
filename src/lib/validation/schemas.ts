import { z } from 'zod';

/**
 * Base Schemas - Reusable across endpoints
 */

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const booleanStringSchema = z.enum(['true', 'false']).transform(v => v === 'true');

/**
 * Enum Schemas
 */

export const matchTypeSchema = z.enum(['upcoming', 'recent', 'finished']);

export const betStatusSchema = z.enum(['all', 'won', 'lost', 'pending']);

export const queueNameSchema = z.enum(['predictions', 'content', 'other']);

/**
 * Route-Specific Schemas
 */

// GET /api/matches
export const getMatchesQuerySchema = z.object({
  type: matchTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetMatchesQuery = z.infer<typeof getMatchesQuerySchema>;

// GET /api/matches/:id
export const getMatchParamsSchema = z.object({
  id: uuidSchema,
});

export type GetMatchParams = z.infer<typeof getMatchParamsSchema>;

// GET /api/leaderboard
export const getLeaderboardQuerySchema = z.object({
  activeOnly: booleanStringSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetLeaderboardQuery = z.infer<typeof getLeaderboardQuerySchema>;

// GET /api/models/:id/bets
export const getModelBetsParamsSchema = z.object({
  id: uuidSchema,
});

export const getModelBetsQuerySchema = z.object({
  status: betStatusSchema.optional().transform(v => v === 'all' ? undefined : v),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetModelBetsParams = z.infer<typeof getModelBetsParamsSchema>;
export type GetModelBetsQuery = z.infer<typeof getModelBetsQuerySchema>;

// GET /api/admin/dlq
export const getDlqQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  queueName: queueNameSchema.optional(),
  jobId: z.string().optional(),
});

export type GetDlqQuery = z.infer<typeof getDlqQuerySchema>;

// GET /api/admin/queue-status
export const getQueueStatusQuerySchema = z.object({
  format: z.enum(['json', 'text']).optional(),
});

export type GetQueueStatusQuery = z.infer<typeof getQueueStatusQuerySchema>;

// GET /api/admin/data
export const getAdminDataQuerySchema = z.object({
  type: z.enum(['models', 'matches', 'predictions']).optional(),
});

export type GetAdminDataQuery = z.infer<typeof getAdminDataQuerySchema>;

// POST /api/admin/re-enable-model
export const reEnableModelBodySchema = z.object({
  modelId: uuidSchema,
});

export type ReEnableModelBody = z.infer<typeof reEnableModelBodySchema>;

// POST /api/admin/dlq
export const processDlqBodySchema = z.object({
  jobId: z.string(),
  action: z.enum(['retry', 'discard']),
});

export type ProcessDlqBody = z.infer<typeof processDlqBodySchema>;
