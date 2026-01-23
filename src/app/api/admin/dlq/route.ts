/**
 * Dead Letter Queue (DLQ) Admin API
 * 
 * Allows viewing and managing permanently failed jobs.
 * Requires admin authentication and rate limiting (10 req/min).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getDeadLetterJobs,
  getDeadLetterCount,
  clearDeadLetterQueue,
  deleteDeadLetterEntry,
} from '@/lib/queue/dead-letter';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { validateQuery } from '@/lib/validation/middleware';
import { getDlqQuerySchema } from '@/lib/validation/schemas';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { createValidationErrorResponse } from '@/lib/utils/error-sanitizer';

// Zod schema for DELETE query parameters
const dlqDeleteSchema = z.object({
  queueName: z.string().min(1, 'Queue name required').optional(),
  jobId: z.string().min(1, 'Job ID required').optional(),
});

/**
 * GET /api/admin/dlq - Get failed jobs from DLQ
 * Query params: limit, offset
 * Rate limited to 10 requests per minute
 */
export async function GET(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:dlq:get:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);
  
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
    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const { data: validatedQuery, error: validationError } = validateQuery(getDlqQuerySchema, queryParams);
    if (validationError) {
      return validationError;
    }
    
    const { limit, offset } = validatedQuery;
    
    const [jobs, total] = await Promise.all([
      getDeadLetterJobs(limit, offset),
      getDeadLetterCount(),
    ]);
    
    return NextResponse.json(
      {
        jobs,
        total,
        limit,
        offset,
      },
      {
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  } catch (error) {
    console.error('[Admin DLQ API] Error fetching DLQ:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DLQ' },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}

/**
 * DELETE /api/admin/dlq - Clear DLQ or delete specific entry
 * Query params: queueName, jobId (optional - if not provided, clears all)
 * Rate limited to 10 requests per minute
 */
export async function DELETE(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:dlq:delete:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);
  
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
    const { searchParams } = new URL(req.url);
    
    // Validate DELETE query parameters
    const parseResult = dlqDeleteSchema.safeParse({
      queueName: searchParams.get('queueName'),
      jobId: searchParams.get('jobId'),
    });
    
    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error.flatten().fieldErrors);
    }
    
    const { queueName, jobId } = parseResult.data;
    
    if (queueName && jobId) {
      // Delete specific entry
      const deleted = await deleteDeadLetterEntry(queueName, jobId);
      return NextResponse.json(
        {
          success: deleted,
          message: deleted ? 'Entry deleted' : 'Entry not found',
        },
        { headers: createRateLimitHeaders(rateLimitResult) }
      );
    } else {
      // Clear all entries
      const count = await clearDeadLetterQueue();
      return NextResponse.json(
        {
          success: true,
          deletedCount: count,
          message: `Cleared ${count} entries from DLQ`,
        },
        { headers: createRateLimitHeaders(rateLimitResult) }
      );
    }
  } catch (error) {
    console.error('[Admin DLQ API] Error deleting from DLQ:', error);
    return NextResponse.json(
      { error: 'Failed to delete from DLQ' },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
