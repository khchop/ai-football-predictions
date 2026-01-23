/**
 * Dead Letter Queue (DLQ) for permanently failed jobs
 * 
 * Stores failed jobs in Redis for debugging and manual recovery.
 * Jobs that exhaust all retries are moved here for investigation.
 */

import { Job } from 'bullmq';
import { getQueueConnection } from './index';
import { loggers } from '@/lib/logger/modules';

const log = loggers.dlq;

const DLQ_KEY_PREFIX = 'dlq:';
const DLQ_INDEX_KEY = 'dlq:index';
const MAX_DLQ_ENTRIES = 1000; // Maximum failed jobs to keep
const DLQ_ALERT_THRESHOLD = 50; // Alert when DLQ exceeds this many entries

export interface DLQEntry {
  jobId: string;
  queueName: string;
  jobType: string;
  data: any;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
  stackTrace?: string;
}

/**
 * Add a failed job to the DLQ
 * Gracefully handles Redis unavailability
 */
export async function addToDeadLetterQueue(
   job: Job,
   error: Error
): Promise<void> {
   try {
     const redis = getQueueConnection();
     
     const entry: DLQEntry = {
       jobId: job.id || 'unknown',
       queueName: job.queueName,
       jobType: job.name,
       data: job.data,
       failedReason: error.message,
       attemptsMade: job.attemptsMade,
       timestamp: new Date().toISOString(),
       stackTrace: error.stack,
     };
     
     const entryKey = `${DLQ_KEY_PREFIX}${job.queueName}:${job.id}`;
     
     // Store the entry
     await redis.set(entryKey, JSON.stringify(entry), 'EX', 30 * 24 * 60 * 60); // 30 days TTL
     
     // Add to index (sorted by timestamp)
     await redis.zadd(DLQ_INDEX_KEY, Date.now(), entryKey);
     
      // Trim index to max size
      const count = await redis.zcard(DLQ_INDEX_KEY);
      if (count > MAX_DLQ_ENTRIES) {
        // Remove oldest entries
        await redis.zremrangebyrank(DLQ_INDEX_KEY, 0, count - MAX_DLQ_ENTRIES - 1);
      }
      
      // Alert if DLQ threshold exceeded
      if (count >= DLQ_ALERT_THRESHOLD) {
        log.warn(
          { dlqSize: count, threshold: DLQ_ALERT_THRESHOLD, maxEntries: MAX_DLQ_ENTRIES },
          'DLQ threshold exceeded - investigate failed jobs'
        );
      }
      
      log.error({ queue: job.queueName, jobName: job.name, jobId: job.id }, 'Added failed job to DLQ');
   } catch (dlqError) {
     // If DLQ fails (Redis unavailable), log locally but don't fail the process
     log.error({
       jobId: job.id,
       queueName: job.queueName,
       jobType: job.name,
       failedReason: error.message,
       dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
     }, 'Failed to add job to DLQ - Redis unavailable, job information logged locally');
   }
}

/**
 * Get failed jobs from DLQ
 */
export async function getDeadLetterJobs(
  limit: number = 50,
  offset: number = 0
): Promise<DLQEntry[]> {
  const redis = getQueueConnection();
  
  // Get keys from index (newest first)
  const keys = await redis.zrevrange(DLQ_INDEX_KEY, offset, offset + limit - 1);
  
  if (keys.length === 0) {
    return [];
  }
  
  // Get all entries
  const entries: DLQEntry[] = [];
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      try {
        entries.push(JSON.parse(data));
       } catch (error) {
         log.error({ entryKey: key, error: error instanceof Error ? error.message : String(error) }, 'Failed to parse DLQ entry');
       }
    }
  }
  
  return entries;
}

/**
 * Get total count of failed jobs in DLQ
 */
export async function getDeadLetterCount(): Promise<number> {
  const redis = getQueueConnection();
  return await redis.zcard(DLQ_INDEX_KEY);
}

/**
 * Clear all entries from DLQ
 */
export async function clearDeadLetterQueue(): Promise<number> {
  const redis = getQueueConnection();
  
  // Get all keys
  const keys = await redis.zrange(DLQ_INDEX_KEY, 0, -1);
  
  // Delete all entries
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  
   // Clear index
   await redis.del(DLQ_INDEX_KEY);
   
   log.info({ entryCount: keys.length }, 'Cleared entries from DLQ');
   return keys.length;
}

/**
 * Delete a specific entry from DLQ
 */
export async function deleteDeadLetterEntry(
  queueName: string,
  jobId: string
): Promise<boolean> {
  const redis = getQueueConnection();
  
  const entryKey = `${DLQ_KEY_PREFIX}${queueName}:${jobId}`;
  
  // Remove from index
  await redis.zrem(DLQ_INDEX_KEY, entryKey);
  
  // Delete entry
  const result = await redis.del(entryKey);
  
  return result > 0;
}
