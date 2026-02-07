/**
 * Pre-configured Module Loggers
 * 
 * Centralized logger instances for each module area.
 * Use these in your code: loggers.predictionsWorker.info(...)
 */

import pino from 'pino';
import { createLogger } from './index';

// Pre-configured loggers for each module area
export const loggers = {
  // Queue system
  queue: createLogger('queue'),
  scheduler: createLogger('scheduler'),
  workers: createLogger('workers'),
  dlq: createLogger('dlq'),
  
  // Workers (individual)
  fixturesWorker: createLogger('worker:fixtures'),
  analysisWorker: createLogger('worker:analysis'),
  oddsWorker: createLogger('worker:odds'),
  predictionsWorker: createLogger('worker:predictions'),
  liveScoreWorker: createLogger('worker:live-score'),
  scoringWorker: createLogger('worker:scoring'),
  backfillWorker: createLogger('worker:backfill'),
  contentWorker: createLogger('worker:content'),
  modelRecoveryWorker: createLogger('worker:model-recovery'),
  standingsWorker: createLogger('worker:standings'),
  statsWorker: createLogger('worker:stats'),

  // Football data
  apiFootball: createLogger('api-football'),
  matchAnalysis: createLogger('match-analysis'),
  standings: createLogger('standings'),
  h2h: createLogger('h2h'),
  teamStats: createLogger('team-statistics'),
  
  // Infrastructure
  db: createLogger('db'),
  cache: createLogger('cache'),
  api: createLogger('api'),
  cron: createLogger('cron'),
  circuitBreaker: createLogger('circuit-breaker'),
  rateLimiter: createLogger('rate-limiter'),
  
  // Content & LLM
  content: createLogger('content'),
  llm: createLogger('llm'),
  togetherClient: createLogger('together-client'),
  
  // App
  instrumentation: createLogger('instrumentation'),
  modelSync: createLogger('model-sync'),
  envValidation: createLogger('env-validation'),
  auth: createLogger('auth'),
  betting: createLogger('betting'),
  betSettlement: createLogger('bet-settlement'),
};

/**
 * Helper for creating job-scoped loggers
 */
export function createJobLogger(
  baseLogger: pino.Logger,
  jobId: string | undefined,
  jobName: string,
  data?: Record<string, unknown>
): pino.Logger {
  return baseLogger.child({
    jobId,
    jobName,
    ...data,
  });
}

/**
 * Helper for creating request-scoped loggers
 */
export function createRequestLogger(
  requestId: string,
  method: string,
  path: string
): pino.Logger {
  return loggers.api.child({
    requestId,
    method,
    path,
  });
}
