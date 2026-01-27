import { NextResponse } from 'next/server';
import { enqueueViewRefresh } from '@/lib/queue/jobs/calculate-stats';
import { loggers } from '@/lib/logger/modules';

export async function POST(request: Request) {
  const log = loggers.cron.child({ route: '/api/cron/update-stats' });
  
  try {
    const body = await request.json().catch(() => ({}));
    const { secret } = body as { secret?: string };
    
    if (process.env.CRON_SECRET !== secret) {
      log.warn('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    log.info('Triggering stats update');
    
    await enqueueViewRefresh('all');
    
    return NextResponse.json({
      success: true,
      message: 'Stats update triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error: errorMessage }, 'Failed to trigger stats update');
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (process.env.CRON_SECRET !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await enqueueViewRefresh('all');
    
    return NextResponse.json({
      success: true,
      message: 'Stats update triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
