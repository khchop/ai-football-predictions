/**
 * Dead Letter Queue (DLQ) Admin API
 * 
 * Allows viewing and managing permanently failed jobs.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDeadLetterJobs,
  getDeadLetterCount,
  clearDeadLetterQueue,
  deleteDeadLetterEntry,
} from '@/lib/queue/dead-letter';

// Simple admin password check
function validateAdminRequest(req: NextRequest): boolean {
  const adminPassword = req.headers.get('X-Admin-Password');
  const expectedPassword = process.env.ADMIN_PASSWORD;
  
  if (!expectedPassword) {
    console.warn('[Admin DLQ API] ADMIN_PASSWORD not configured');
    return false;
  }
  
  return adminPassword === expectedPassword;
}

/**
 * GET /api/admin/dlq - Get failed jobs from DLQ
 * Query params: limit, offset
 */
export async function GET(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const [jobs, total] = await Promise.all([
      getDeadLetterJobs(limit, offset),
      getDeadLetterCount(),
    ]);
    
    return NextResponse.json({
      jobs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Admin DLQ API] Error fetching DLQ:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DLQ' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/dlq - Clear DLQ or delete specific entry
 * Query params: queueName, jobId (optional - if not provided, clears all)
 */
export async function DELETE(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const queueName = searchParams.get('queueName');
    const jobId = searchParams.get('jobId');
    
    if (queueName && jobId) {
      // Delete specific entry
      const deleted = await deleteDeadLetterEntry(queueName, jobId);
      return NextResponse.json({
        success: deleted,
        message: deleted ? 'Entry deleted' : 'Entry not found',
      });
    } else {
      // Clear all entries
      const count = await clearDeadLetterQueue();
      return NextResponse.json({
        success: true,
        deletedCount: count,
        message: `Cleared ${count} entries from DLQ`,
      });
    }
  } catch (error) {
    console.error('[Admin DLQ API] Error deleting from DLQ:', error);
    return NextResponse.json(
      { error: 'Failed to delete from DLQ' },
      { status: 500 }
    );
  }
}
