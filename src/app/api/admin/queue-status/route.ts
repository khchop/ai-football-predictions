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

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.ADMIN_PASSWORD) {
    // SECURITY: Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Queue Status] CRITICAL: ADMIN_PASSWORD not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Allow in development without password
    console.warn('[Queue Status] ADMIN_PASSWORD not configured - allowing in development mode');
    return null;
  }
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}

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
  // Validate password
  const authError = validateAdminRequest(request);
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

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error('[Queue Status API] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 }
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
