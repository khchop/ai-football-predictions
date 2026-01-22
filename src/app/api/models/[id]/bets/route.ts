import { NextRequest, NextResponse } from 'next/server';
import { getModelBettingHistory, getModelBettingStats } from '@/lib/db/queries';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: modelId } = await params;
  const searchParams = request.nextUrl.searchParams;
  
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status') as 'pending' | 'won' | 'lost' | null;

  try {
    // Fetch betting history
    const bets = await getModelBettingHistory(modelId, {
      limit: limit + 1,
      offset,
      status: status || undefined,
    });

    const hasMore = bets.length > limit;
    const data = hasMore ? bets.slice(0, limit) : bets;

    // Fetch betting stats
    const stats = await getModelBettingStats(modelId);

    return NextResponse.json({
      bets: data,
      stats,
      hasMore,
      offset: offset + data.length,
    });
  } catch (error) {
    console.error('Error fetching model bets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}
