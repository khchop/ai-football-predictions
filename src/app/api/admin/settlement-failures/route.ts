/**
 * Settlement Failures Admin API (MON-05)
 *
 * GET: View failed settlement jobs from queue and DLQ with error reasons
 * POST: Retry a specific failed settlement by matchId
 *
 * SECURITY: Requires admin authentication via X-Admin-Password header
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { getSettlementQueue, JOB_TYPES } from '@/lib/queue/index';
import { getDeadLetterJobs } from '@/lib/queue/dead-letter';
import { getMatchById } from '@/lib/db/queries';

/**
 * GET /api/admin/settlement-failures - View settlement failures
 * Returns failed jobs from both settlement queue and DLQ.
 * Rate limited to 10 requests per minute.
 */
export async function GET(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:settlement-failures:get:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

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

    // Get failed jobs from settlement queue
    const failedJobs = await settlementQueue.getFailed(0, 100);

    // Get settlement-related DLQ entries
    const dlqJobs = await getDeadLetterJobs(100, 0);
    const settlementDlqJobs = dlqJobs.filter(j => j.queueName === 'settlement-queue');

    // Format failures for dashboard
    const failures = [
      ...failedJobs.map(job => ({
        jobId: job.id,
        matchId: job.data?.matchId,
        source: 'queue' as const,
        failedReason: job.failedReason ? job.failedReason.substring(0, 300) : null,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
      ...settlementDlqJobs.map(job => ({
        jobId: job.jobId,
        matchId: job.data?.matchId,
        source: 'dlq' as const,
        failedReason: job.failedReason ? job.failedReason.substring(0, 300) : null,
        attemptsMade: job.attemptsMade || 0,
        timestamp: job.timestamp,
        processedOn: null,
        finishedOn: null,
      })),
    ];

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalFailures: failures.length,
      fromQueue: failedJobs.length,
      fromDlq: settlementDlqJobs.length,
      failures,
    }, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-settlement-failures-get') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}

/**
 * POST /api/admin/settlement-failures - Retry specific settlement failure
 * Re-queues a specific match's settlement job with fresh data.
 * Rate limited to 10 requests per minute.
 */
export async function POST(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:settlement-failures:post:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

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
    // Parse request body
    const body = await req.json();
    const { matchId } = body;

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Look up the match
    const matchData = await getMatchById(matchId);

    if (!matchData) {
      return NextResponse.json(
        { error: `Match ${matchId} not found` },
        { status: 404, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { match } = matchData;

    // Verify match is finished
    if (match.status !== 'finished') {
      return NextResponse.json(
        { error: `Match ${matchId} not finished (status: ${match.status})` },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Remove existing failed job for this match from queue
    const settlementQueue = getSettlementQueue();
    const possibleJobIds = [`settle-${matchId}`, `settle-retry-${matchId}`, `settle-zero-pred-${matchId}`];

    for (const jid of possibleJobIds) {
      try {
        const existingJob = await settlementQueue.getJob(jid);
        if (existingJob && await existingJob.isFailed()) {
          await existingJob.remove();
        }
      } catch {
        // Job doesn't exist, continue
      }
    }

    // Re-queue with fresh data
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

    return NextResponse.json({
      success: true,
      matchId,
      message: 'Settlement job re-queued',
    }, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-settlement-failures-post') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
