import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardFiltered, getActiveModels } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const daysParam = searchParams.get('days');
    const minPredictionsParam = searchParams.get('minPredictions');
    const activeOnlyParam = searchParams.get('activeOnly');
    
    const filters = {
      days: daysParam ? parseInt(daysParam, 10) : undefined,
      minPredictions: minPredictionsParam ? parseInt(minPredictionsParam, 10) : 5,
      activeOnly: activeOnlyParam !== 'false', // Default true
    };

    const leaderboard = await getLeaderboardFiltered(filters);
    const activeModels = await getActiveModels();

    return NextResponse.json({
      success: true,
      leaderboard,
      activeModels: activeModels.length,
      totalEntries: leaderboard.length,
      filters: {
        days: filters.days || 'all',
        minPredictions: filters.minPredictions,
        activeOnly: filters.activeOnly,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
