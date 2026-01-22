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

// Main queue for all match-related jobs
export const matchQueue = new Queue('match-jobs', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000,       // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

// Export for dashboard
export { Queue, Worker, Job };
