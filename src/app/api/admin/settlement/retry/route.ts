/**
 * Settlement Retry Admin API
 *
 * Allows retrying and clearing failed settlement jobs.
 * Requires admin authentication and rate limiting (10 req/min).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSettlementQueue, JOB_TYPES } from '@/lib/queue/index';
import { getDeadLetterJobs, deleteDeadLetterEntry } from '@/lib/queue/dead-letter';
import { getMatchById } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

/**
 * POST /api/admin/settlement/retry - Retry failed settlement jobs
 * Fetches failed jobs from both the settlement queue and DLQ,
 * removes them, and re-queues with fresh match data.
 * Rate limited to 10 requests per minute.
 */
export async function POST(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:settlement:retry:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

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
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const settlementQueue = getSettlementQueue();

    const results = {
      retriedFromQueue: 0,
      retriedFromDlq: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // 1. Get failed jobs from settlement queue
    const failedJobs = await settlementQueue.getFailed(0, -1);

    for (const job of failedJobs) {
      try {
        const { matchId } = job.data;

        // Remove the failed job
        await job.remove();

        // Fetch fresh match data
        const matchData = await getMatchById(matchId);

        if (!matchData) {
          results.skipped++;
          results.errors.push(`Match ${matchId} not found`);
          continue;
        }

        const { match } = matchData;

        // Skip if match is not finished
        if (match.status !== 'finished') {
          results.skipped++;
          results.errors.push(`Match ${matchId} not finished (status: ${match.status})`);
          continue;
        }

        // Re-queue with idempotent jobId
        await settlementQueue.add(
          JOB_TYPES.SETTLE_MATCH,
          {
            matchId: match.id,
            homeScore: match.homeScore ?? 0,
            awayScore: match.awayScore ?? 0,
            status: match.status,
          },
          {
            delay: 1000,
            priority: 1,
            jobId: `settle-retry-${match.id}`,
          }
        );

        results.retriedFromQueue++;
      } catch (error: any) {
        results.errors.push(`Queue job ${job.id}: ${error.message}`);
      }
    }

    // 2. Get settlement jobs from DLQ
    const dlqJobs = await getDeadLetterJobs(1000, 0);
    const settlementDlqJobs = dlqJobs.filter(j => j.queueName === 'settlement-queue');

    for (const dlqEntry of settlementDlqJobs) {
      try {
        const matchId = dlqEntry.data?.matchId;

        if (!matchId) {
          results.skipped++;
          results.errors.push(`DLQ job ${dlqEntry.jobId} missing matchId`);
          continue;
        }

        // Fetch fresh match data
        const matchData = await getMatchById(matchId);

        if (!matchData) {
          results.skipped++;
          results.errors.push(`Match ${matchId} not found (DLQ)`);

          // Clean up DLQ entry for non-existent match
          await deleteDeadLetterEntry(dlqEntry.queueName, dlqEntry.jobId);
          continue;
        }

        const { match } = matchData;

        // Skip if match is not finished
        if (match.status !== 'finished') {
          results.skipped++;
          results.errors.push(`Match ${matchId} not finished (status: ${match.status}, DLQ)`);

          // Clean up DLQ entry for non-finished match
          await deleteDeadLetterEntry(dlqEntry.queueName, dlqEntry.jobId);
          continue;
        }

        // Re-queue with idempotent jobId
        await settlementQueue.add(
          JOB_TYPES.SETTLE_MATCH,
          {
            matchId: match.id,
            homeScore: match.homeScore ?? 0,
            awayScore: match.awayScore ?? 0,
            status: match.status,
          },
          {
            delay: 1000,
            priority: 1,
            jobId: `settle-retry-dlq-${match.id}`,
          }
        );

        // Delete from DLQ after successful re-queue
        await deleteDeadLetterEntry(dlqEntry.queueName, dlqEntry.jobId);

        results.retriedFromDlq++;
      } catch (error: any) {
        results.errors.push(`DLQ job ${dlqEntry.jobId}: ${error.message}`);
      }
    }

    return NextResponse.json(
      results,
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-settlement-retry') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}

/**
 * DELETE /api/admin/settlement/retry - Clear failed settlement jobs
 * Removes failed jobs from both queue and DLQ without retrying.
 * Rate limited to 10 requests per minute.
 */
export async function DELETE(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:settlement:delete:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

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
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const settlementQueue = getSettlementQueue();

    const results = {
      clearedFromQueue: 0,
      clearedFromDlq: 0,
    };

    // 1. Clear failed jobs from settlement queue
    const failedJobs = await settlementQueue.getFailed(0, -1);

    for (const job of failedJobs) {
      await job.remove();
      results.clearedFromQueue++;
    }

    // 2. Clear settlement jobs from DLQ
    const dlqJobs = await getDeadLetterJobs(1000, 0);
    const settlementDlqJobs = dlqJobs.filter(j => j.queueName === 'settlement-queue');

    for (const dlqEntry of settlementDlqJobs) {
      await deleteDeadLetterEntry(dlqEntry.queueName, dlqEntry.jobId);
      results.clearedFromDlq++;
    }

    return NextResponse.json(
      results,
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-settlement-delete') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
