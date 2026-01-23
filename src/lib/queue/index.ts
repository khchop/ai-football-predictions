/**
 * BullMQ Queue Setup
 * 
 * Central queue configuration for the event-driven betting system.
 * Uses existing Redis connection.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

// Job type constants
export const JOB_TYPES = {
  // Repeatable
  FETCH_FIXTURES: 'fetch-fixtures',
  BACKFILL_MISSING: 'backfill-missing',
  CHECK_MODEL_HEALTH: 'check-disabled-models',
  
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

export function getQueueConnection(): IORedis {
  if (connection) {
    console.log(`[Queue] Reusing existing Redis connection #${connectionId}`);
    return connection;
  }
  
  connectionId++;
  console.log(`[Queue] Creating new Redis connection #${connectionId}...`);
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL not configured - required for job queue');
  }
  
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
  
  connection.on('error', (err) => {
    console.error(`[Queue:Conn#${connectionId}] Redis error:`, err.message);
  });
  
  connection.on('connect', () => {
    console.log(`[Queue:Conn#${connectionId}] ✓ Redis connected`);
  });
  
  connection.on('ready', () => {
    console.log(`[Queue:Conn#${connectionId}] ✓ Redis ready`);
  });
  
  connection.on('close', () => {
    console.log(`[Queue:Conn#${connectionId}] Redis connection closed`);
  });
  
  return connection;
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
} as const;

// Default options for all queues
function createQueueOptions() {
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
      timeout: 120000, // 2 minute timeout per job (individual workers may have shorter timeouts)
    },
  };
}

// Separate queues for each job type (robust routing, no job name filtering needed)
// These are created lazily on first access to avoid build-time initialization
let _analysisQueue: Queue;
let _predictionsQueue: Queue;
let _lineupsQueue: Queue;
let _oddsQueue: Queue;
let _liveQueue: Queue;
let _settlementQueue: Queue;
let _fixturesQueue: Queue;
let _backfillQueue: Queue;
let _contentQueue: Queue;
let _modelRecoveryQueue: Queue;
let _matchQueue: Queue;

export const analysisQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_analysisQueue) _analysisQueue = new Queue(QUEUE_NAMES.ANALYSIS, createQueueOptions());
    return (_analysisQueue as any)[prop];
  }
});

export const predictionsQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_predictionsQueue) _predictionsQueue = new Queue(QUEUE_NAMES.PREDICTIONS, createQueueOptions());
    return (_predictionsQueue as any)[prop];
  }
});

export const lineupsQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_lineupsQueue) _lineupsQueue = new Queue(QUEUE_NAMES.LINEUPS, createQueueOptions());
    return (_lineupsQueue as any)[prop];
  }
});

export const oddsQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_oddsQueue) _oddsQueue = new Queue(QUEUE_NAMES.ODDS, createQueueOptions());
    return (_oddsQueue as any)[prop];
  }
});

export const liveQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_liveQueue) _liveQueue = new Queue(QUEUE_NAMES.LIVE, createQueueOptions());
    return (_liveQueue as any)[prop];
  }
});

export const settlementQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_settlementQueue) _settlementQueue = new Queue(QUEUE_NAMES.SETTLEMENT, createQueueOptions());
    return (_settlementQueue as any)[prop];
  }
});

export const fixturesQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_fixturesQueue) _fixturesQueue = new Queue(QUEUE_NAMES.FIXTURES, createQueueOptions());
    return (_fixturesQueue as any)[prop];
  }
});

export const backfillQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_backfillQueue) _backfillQueue = new Queue(QUEUE_NAMES.BACKFILL, createQueueOptions());
    return (_backfillQueue as any)[prop];
  }
});

export const contentQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_contentQueue) _contentQueue = new Queue(QUEUE_NAMES.CONTENT, createQueueOptions());
    return (_contentQueue as any)[prop];
  }
});

export const modelRecoveryQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_modelRecoveryQueue) _modelRecoveryQueue = new Queue(QUEUE_NAMES.MODEL_RECOVERY, createQueueOptions());
    return (_modelRecoveryQueue as any)[prop];
  }
});

// Legacy queue (kept for backward compatibility during migration)
export const matchQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_matchQueue) _matchQueue = new Queue('match-jobs', createQueueOptions());
    return (_matchQueue as any)[prop];
  }
});

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
    default:
      throw new Error(`Unknown queue name: ${queueName}`);
  }
}

// Helper to get all queues (for monitoring/status)
export function getAllQueues(): Queue[] {
  // Initialize all queues by accessing them
  const queues = [
    analysisQueue,
    predictionsQueue,
    lineupsQueue,
    oddsQueue,
    liveQueue,
    settlementQueue,
    fixturesQueue,
    backfillQueue,
    contentQueue,
    modelRecoveryQueue,
  ];
  // Access a property to trigger initialization
  queues.forEach(q => q.name);
  return queues;
}

// Export for dashboard
export { Queue, Worker, Job };
