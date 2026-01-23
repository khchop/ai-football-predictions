/**
 * Queue Status API
 * 
 * Provides visibility into the BullMQ queue state without Bull Board.
 * Shows job counts, active jobs, and upcoming scheduled jobs across all queues.
 * 
 * SECURITY: Requires admin authentication via X-Admin-Password header
 */

import { getAllQueues, QUEUE_NAMES } from '@/lib/queue';
import { NextRequest, NextResponse } from 'next/server';
import type { Queue } from 'bullmq';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

async function getQueueStats(queue: Queue) {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);
  
  return { waiting, active, completed, failed, delayed, paused };
}

export async function GET(request: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`admin:queue-status:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);
  
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  // Admin authentication (timing-safe comparison)
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const queues = getAllQueues();
    
    // Get stats from all queues
    const queueStats = await Promise.all(
      queues.map(async (queue) => ({
        name: queue.name,
        stats: await getQueueStats(queue),
      }))
    );
    
    // Calculate totals
    const totals = queueStats.reduce(
      (acc, { stats }) => ({
        waiting: acc.waiting + stats.waiting,
        active: acc.active + stats.active,
        completed: acc.completed + stats.completed,
        failed: acc.failed + stats.failed,
        delayed: acc.delayed + stats.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );
    
    // Get sample jobs from all queues
    const allJobs = await Promise.all(
      queues.map(async (queue) => ({
        queueName: queue.name,
        waiting: await queue.getJobs(['waiting'], 0, 5),
        active: await queue.getJobs(['active'], 0, 5),
        delayed: await queue.getJobs(['delayed'], 0, 10),
        failed: await queue.getJobs(['failed'], 0, 5),
      }))
    );
    
    // Get repeatable jobs from all queues
    const allRepeatableJobs = await Promise.all(
      queues.map(async (queue) => ({
        queueName: queue.name,
        jobs: await queue.getRepeatableJobs(),
      }))
    );

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        totals,
        queues: queueStats.reduce((acc, { name, stats }) => {
          acc[name] = stats;
          return acc;
        }, {} as Record<string, any>),
        recentJobs: allJobs
          .flatMap(({ queueName, waiting, active, delayed, failed }) => [
            ...waiting.map(j => ({ ...formatJob(j), queue: queueName, state: 'waiting' })),
            ...active.map(j => ({ ...formatJob(j), queue: queueName, state: 'active' })),
            ...delayed.map(j => ({ ...formatJob(j), queue: queueName, state: 'delayed' })),
            ...failed.map(j => ({ ...formatJob(j), queue: queueName, state: 'failed' })),
          ])
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 30),
        repeatable: allRepeatableJobs
          .flatMap(({ queueName, jobs }) =>
            jobs.map(job => ({
              queue: queueName,
              key: job.key,
              name: job.name,
              pattern: job.pattern,
              next: job.next,
            }))
          ),
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: sanitizeError(error, 'admin-queue-status'),
      },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}

function formatJob(job: any) {
  // Sanitize job data to prevent sensitive info leakage
  const sanitizedData = job.data ? {
    matchId: job.data.matchId,
    type: job.data.type,
    // Omit potentially sensitive fields like API keys, full payloads
  } : null;

  return {
    id: job.id,
    name: job.name,
    data: sanitizedData,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.delay,
    attemptsMade: job.attemptsMade,
    // Only show first 200 chars of error to avoid stack trace leakage
    failedReason: job.failedReason ? job.failedReason.substring(0, 200) : null,
  };
}
