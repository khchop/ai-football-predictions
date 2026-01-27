/**
 * BullMQ Queue Setup
 * 
 * Central queue configuration for the event-driven betting system.
 * Uses existing Redis connection.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { loggers } from '@/lib/logger/modules';

// Job type constants
export const JOB_TYPES = {
  // Repeatable
  FETCH_FIXTURES: 'fetch-fixtures',
  BACKFILL_MISSING: 'backfill-missing',
  CHECK_MODEL_HEALTH: 'check-disabled-models',
  UPDATE_STANDINGS: 'update-standings',
  
  // Per-match scheduled
  ANALYZE_MATCH: 'analyze-match',
  REFRESH_ODDS: 'refresh-odds',
  FETCH_LINEUPS: 'fetch-lineups',
  PREDICT_MATCH: 'predict-match',
  MONITOR_LIVE: 'monitor-live',
  SETTLE_MATCH: 'settle-match',
  
  // Utility
  CATCH_UP: 'catch-up',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

// Redis connection for BullMQ (separate from cache to avoid conflicts)
let connection: IORedis | null = null;
let connectionId = 0;
let connectionHealthy = false;
const log = loggers.queue;

export function getQueueConnection(): IORedis {
   if (connection) {
     log.debug({ connectionId }, 'Reusing existing Redis connection');
     return connection;
   }
   
   connectionId++;
   log.info({ connectionId }, 'Creating new Redis connection for queue');
   
   const redisUrl = process.env.REDIS_URL;
   if (!redisUrl) {
     throw new Error('REDIS_URL not configured - required for job queue');
   }
   
   connection = new IORedis(redisUrl, {
     maxRetriesPerRequest: null, // Required for BullMQ
     enableReadyCheck: false,
     retryStrategy(times) {
       if (times > 10) {
         log.error({ connectionId, retries: times }, 'Queue Redis connection failed after max retries');
         connectionHealthy = false;
         return null; // Stop retrying
       }
       const delay = Math.min(times * 500, 5000); // 500ms → 5s exponential backoff
       log.warn({ connectionId, retries: times, delayMs: delay }, 'Queue Redis retrying connection');
       return delay;
     },
     reconnectOnError(err) {
       const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
       return targetErrors.some(e => err.message.includes(e));
     },
   });
   
   connection.on('error', (err) => {
     connectionHealthy = false;
     log.error({ connectionId, error: err.message }, 'Queue Redis error');
   });
   
   connection.on('connect', () => {
     log.info({ connectionId }, 'Queue Redis connecting');
   });
   
   connection.on('ready', () => {
     connectionHealthy = true;
     log.info({ connectionId }, 'Queue Redis ready');
   });
   
   connection.on('reconnecting', () => {
     log.info({ connectionId }, 'Queue Redis reconnecting');
   });
   
    connection.on('close', () => {
      log.info({ connectionId }, 'Queue Redis connection closed');
    });
    
    // Register graceful shutdown handler on first connection
    registerShutdownHandler();
    
    return connection;
}

/**
 * Check if queue connection is healthy
 */
export function isQueueConnectionHealthy(): boolean {
  return connection !== null && connectionHealthy;
}

/**
 * Ensure queue connection is healthy, throw if not
 * Use before critical queue operations to fail-fast on unhealthy Redis
 */
export function ensureQueueHealthy(): void {
  if (!isQueueConnectionHealthy()) {
    const message = connection === null 
      ? 'Queue connection not initialized'
      : 'Queue connection unhealthy';
    log.error({ connectionId }, `Critical operation rejected: ${message}`);
    throw new Error(`Queue operation failed: ${message}`);
  }
}

// Track if shutdown handler registered to avoid duplicate registrations
let shutdownHandlerRegistered = false;

/**
 * Register graceful shutdown handler on first connection
 * Closes Redis connection on SIGTERM/SIGINT
 */
function registerShutdownHandler(): void {
  if (shutdownHandlerRegistered) return;
  shutdownHandlerRegistered = true;
  
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      log.info({ signal }, 'Graceful shutdown initiated');
      await closeQueueConnection();
      process.exit(0);
    });
  });
}

/**
 * Close queue Redis connection gracefully
 */
export async function closeQueueConnection(): Promise<void> {
  if (!connection) {
    log.debug('Queue connection not initialized, nothing to close');
    return;
  }
  
  try {
    log.info({ connectionId }, 'Closing queue Redis connection');
    connectionHealthy = false;
    await connection.quit();
    connection = null;
    log.info({ connectionId }, 'Queue Redis connection closed successfully');
  } catch (err) {
    log.error({ connectionId, error: err instanceof Error ? err.message : String(err) }, 'Error closing queue connection');
    // Force disconnect even if quit fails
    try {
      if (connection) {
        connection.disconnect();
      }
    } catch (e) {
      log.debug('Disconnect failed during error recovery');
    }
    connection = null;
  }
}

// Queue names for separate job type routing
export const QUEUE_NAMES = {
  ANALYSIS: 'analysis-queue',
  PREDICTIONS: 'predictions-queue',
  LINEUPS: 'lineups-queue',
  ODDS: 'odds-queue',
  LIVE: 'live-queue',
  SETTLEMENT: 'settlement-queue',
  CONTENT: 'content-queue',
  FIXTURES: 'fixtures-queue',
  BACKFILL: 'backfill-queue',
  MODEL_RECOVERY: 'model-recovery-queue',
  STANDINGS: 'standings-queue',
  STATS: 'stats-queue',
} as const;

// Queue-specific timeout configurations
const QUEUE_TIMEOUTS = {
  [QUEUE_NAMES.PREDICTIONS]: 10 * 60 * 1000, // 10 minutes - LLM calls are slow
  [QUEUE_NAMES.ANALYSIS]: 5 * 60 * 1000,     // 5 minutes - multiple API calls
  [QUEUE_NAMES.BACKFILL]: 5 * 60 * 1000,     // 5 minutes - many database operations
  [QUEUE_NAMES.SETTLEMENT]: 3 * 60 * 1000,   // 3 minutes - scoring many predictions
  [QUEUE_NAMES.STATS]: 2 * 60 * 1000,        // 2 minutes - stats calculation
  default: 2 * 60 * 1000,                     // 2 minutes - default for fast operations
} as const;

// Worker lock duration configurations (must be >= timeout)
const WORKER_LOCK_DURATIONS = {
  [QUEUE_NAMES.PREDICTIONS]: 10 * 60 * 1000, // 10 minutes
  [QUEUE_NAMES.ANALYSIS]: 5 * 60 * 1000,     // 5 minutes
  [QUEUE_NAMES.BACKFILL]: 5 * 60 * 1000,     // 5 minutes
  [QUEUE_NAMES.SETTLEMENT]: 3 * 60 * 1000,   // 3 minutes
  [QUEUE_NAMES.STATS]: 2 * 60 * 1000,        // 2 minutes
  default: 30 * 1000,                        // 30 seconds - prevents stalled marking
} as const;

// Get timeout for a specific queue
export function getQueueTimeout(queueName: string): number {
  return QUEUE_TIMEOUTS[queueName as keyof typeof QUEUE_TIMEOUTS] ?? QUEUE_TIMEOUTS.default;
}

// Get lock duration for a specific queue
export function getWorkerLockDuration(queueName: string): number {
  return WORKER_LOCK_DURATIONS[queueName as keyof typeof WORKER_LOCK_DURATIONS] ?? WORKER_LOCK_DURATIONS.default;
}

// Default options for all queues
function createQueueOptions(queueName?: string) {
  const timeout = queueName ? getQueueTimeout(queueName) : QUEUE_TIMEOUTS.default;
  
  return {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 5, // More attempts to handle API rate limits
      backoff: {
        type: 'exponential',
        delay: 30000, // 30s → 60s → 120s → 240s → 480s (total ~15 min of retrying)
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Keep completed jobs for 24 hours
        count: 1000,       // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
      },
      timeout, // Queue-specific timeout
    },
  };
}

// Separate queues for each job type (robust routing, no job name filtering needed)
// Queue factory - creates queue with options and registers for cleanup
function createQueue(name: string): Queue {
  const queue = new Queue(name, createQueueOptions(name));
  log.info({ queueName: name }, `Queue created: ${name}`);
  return queue;
}

// Eagerly create all queues for monitoring and health checks
// Lazy initialization is preserved for workers that don't need all queues
const _queues: Map<string, Queue> = new Map();

// Get or create queue by name (lazy initialization)
export function getOrCreateQueue(queueName: string): Queue {
  if (!_queues.has(queueName)) {
    _queues.set(queueName, createQueue(queueName));
  }
  return _queues.get(queueName)!;
}

// Exported queues using factory pattern (lazy initialization)
let _analysisQueue: Queue | null = null;
export function getAnalysisQueue(): Queue {
  if (!_analysisQueue) _analysisQueue = createQueue(QUEUE_NAMES.ANALYSIS);
  return _analysisQueue;
}

// Use a Proxy to make queue access lazy - connection only happens on first property access
const createLazyQueueProxy = (getter: () => Queue): Queue => {
  return new Proxy({} as Queue, {
    get(_target, prop) {
      const queue = getter();
      return (queue as any)[prop];
    },
  });
};

export const analysisQueue = createLazyQueueProxy(getAnalysisQueue);

// Remaining queues with factory pattern
let _predictionsQueue: Queue | null = null;
export function getPredictionsQueue(): Queue {
  if (!_predictionsQueue) _predictionsQueue = createQueue(QUEUE_NAMES.PREDICTIONS);
  return _predictionsQueue;
}
export const predictionsQueue = createLazyQueueProxy(getPredictionsQueue);

let _lineupsQueue: Queue | null = null;
export function getLineupsQueue(): Queue {
  if (!_lineupsQueue) _lineupsQueue = createQueue(QUEUE_NAMES.LINEUPS);
  return _lineupsQueue;
}
export const lineupsQueue = createLazyQueueProxy(getLineupsQueue);

let _oddsQueue: Queue | null = null;
export function getOddsQueue(): Queue {
  if (!_oddsQueue) _oddsQueue = createQueue(QUEUE_NAMES.ODDS);
  return _oddsQueue;
}
export const oddsQueue = createLazyQueueProxy(getOddsQueue);

let _liveQueue: Queue | null = null;
export function getLiveQueue(): Queue {
  if (!_liveQueue) _liveQueue = createQueue(QUEUE_NAMES.LIVE);
  return _liveQueue;
}
export const liveQueue = createLazyQueueProxy(getLiveQueue);

let _settlementQueue: Queue | null = null;
export function getSettlementQueue(): Queue {
  if (!_settlementQueue) _settlementQueue = createQueue(QUEUE_NAMES.SETTLEMENT);
  return _settlementQueue;
}
export const settlementQueue = createLazyQueueProxy(getSettlementQueue);

let _fixturesQueue: Queue | null = null;
export function getFixturesQueue(): Queue {
  if (!_fixturesQueue) _fixturesQueue = createQueue(QUEUE_NAMES.FIXTURES);
  return _fixturesQueue;
}
export const fixturesQueue = createLazyQueueProxy(getFixturesQueue);

let _backfillQueue: Queue | null = null;
export function getBackfillQueue(): Queue {
  if (!_backfillQueue) _backfillQueue = createQueue(QUEUE_NAMES.BACKFILL);
  return _backfillQueue;
}
export const backfillQueue = createLazyQueueProxy(getBackfillQueue);

let _contentQueue: Queue | null = null;
export function getContentQueue(): Queue {
  if (!_contentQueue) _contentQueue = createQueue(QUEUE_NAMES.CONTENT);
  return _contentQueue;
}
export const contentQueue = createLazyQueueProxy(getContentQueue);

let _modelRecoveryQueue: Queue | null = null;
export function getModelRecoveryQueue(): Queue {
  if (!_modelRecoveryQueue) _modelRecoveryQueue = createQueue(QUEUE_NAMES.MODEL_RECOVERY);
  return _modelRecoveryQueue;
}
export const modelRecoveryQueue = createLazyQueueProxy(getModelRecoveryQueue);

let _standingsQueue: Queue | null = null;
export function getStandingsQueue(): Queue {
  if (!_standingsQueue) _standingsQueue = createQueue(QUEUE_NAMES.STANDINGS);
  return _standingsQueue;
}
export const standingsQueue = createLazyQueueProxy(getStandingsQueue);

let _statsQueue: Queue | null = null;
export function getStatsQueue(): Queue {
  if (!_statsQueue) _statsQueue = createQueue(QUEUE_NAMES.STATS);
  return _statsQueue;
}
export const statsQueue = createLazyQueueProxy(getStatsQueue);

// Legacy queue (kept for backward compatibility)
let _matchQueue: Queue | null = null;
export function getMatchQueue(): Queue {
  if (!_matchQueue) _matchQueue = createQueue('match-jobs');
  return _matchQueue;
}
export const matchQueue = createLazyQueueProxy(getMatchQueue);

// Helper to get a queue by name
export function getQueue(queueName: string): Queue {
  switch (queueName) {
    case QUEUE_NAMES.ANALYSIS:
      return analysisQueue;
    case QUEUE_NAMES.PREDICTIONS:
      return predictionsQueue;
    case QUEUE_NAMES.LINEUPS:
      return lineupsQueue;
    case QUEUE_NAMES.ODDS:
      return oddsQueue;
    case QUEUE_NAMES.LIVE:
      return liveQueue;
    case QUEUE_NAMES.SETTLEMENT:
      return settlementQueue;
    case QUEUE_NAMES.FIXTURES:
      return fixturesQueue;
    case QUEUE_NAMES.BACKFILL:
      return backfillQueue;
    case QUEUE_NAMES.CONTENT:
      return contentQueue;
    case QUEUE_NAMES.MODEL_RECOVERY:
      return modelRecoveryQueue;
    case QUEUE_NAMES.STANDINGS:
      return standingsQueue;
    case QUEUE_NAMES.STATS:
      return statsQueue;
    default:
      throw new Error(`Unknown queue name: ${queueName}`);
  }
}

// Helper to get all queues (for monitoring/status)
export function getAllQueues(): Queue[] {
  return [
    getAnalysisQueue(),
    getPredictionsQueue(),
    getLineupsQueue(),
    getOddsQueue(),
    getLiveQueue(),
    getSettlementQueue(),
    getFixturesQueue(),
    getBackfillQueue(),
    getContentQueue(),
    getModelRecoveryQueue(),
    getStandingsQueue(),
    getStatsQueue(),
  ];
}

// Export for dashboard
export { Queue, Worker, Job };
