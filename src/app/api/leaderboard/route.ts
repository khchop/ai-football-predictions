import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardFiltered, getActiveModels, getActiveCompetitions } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const daysParam = searchParams.get('days');
    const minPredictionsParam = searchParams.get('minPredictions');
    const activeOnlyParam = searchParams.get('activeOnly');
    const competitionParam = searchParams.get('competition');
    
    const filters = {
      days: daysParam ? parseInt(daysParam, 10) : undefined,
      minPredictions: minPredictionsParam ? parseInt(minPredictionsParam, 10) : 5,
      activeOnly: activeOnlyParam !== 'false', // Default true
      competitionId: competitionParam || undefined,
    };

    const leaderboard = await getLeaderboardFiltered(filters);
    const activeModels = await getActiveModels();
    const competitions = await getActiveCompetitions();

    return NextResponse.json({
      success: true,
      leaderboard,
      activeModels: activeModels.length,
      totalEntries: leaderboard.length,
      competitions: competitions.map(c => ({ id: c.id, name: c.name })),
      filters: {
        days: filters.days || 'all',
        minPredictions: filters.minPredictions,
        activeOnly: filters.activeOnly,
        competition: filters.competitionId || 'all',
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
