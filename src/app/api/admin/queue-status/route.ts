/**
 * Queue Status API
 * 
 * Provides visibility into the BullMQ queue state without Bull Board.
 * Shows job counts, active jobs, and upcoming scheduled jobs.
 */

import { matchQueue } from '@/lib/queue';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get queue counts
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      matchQueue.getWaitingCount(),
      matchQueue.getActiveCount(),
      matchQueue.getCompletedCount(),
      matchQueue.getFailedCount(),
      matchQueue.getDelayedCount(),
      matchQueue.isPaused(),
    ]);

    // Get sample jobs from various states
    const [waitingJobs, activeJobs, delayedJobs, failedJobs] = await Promise.all([
      matchQueue.getJobs(['waiting'], 0, 10),
      matchQueue.getJobs(['active'], 0, 10),
      matchQueue.getJobs(['delayed'], 0, 20),
      matchQueue.getJobs(['failed'], 0, 10),
    ]);

    // Get repeatable jobs
    const repeatableJobs = await matchQueue.getRepeatableJobs();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      },
      jobs: {
        waiting: waitingJobs.map(formatJob),
        active: activeJobs.map(formatJob),
        delayed: delayedJobs.map(formatJob),
        failed: failedJobs.map(formatJob),
      },
      repeatable: repeatableJobs.map((job) => ({
        key: job.key,
        name: job.name,
        pattern: job.pattern,
        next: job.next,
      })),
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
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.delay,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
  };
}
