import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingMatches, getRecentMatches, getFinishedMatches, getOverallStats } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'upcoming';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let matches;
    
    switch (type) {
      case 'upcoming':
        matches = await getUpcomingMatches(48);
        break;
      case 'recent':
        matches = await getRecentMatches(limit);
        break;
      case 'finished':
        matches = await getFinishedMatches(limit);
        break;
      default:
        matches = await getRecentMatches(limit);
    }

    // Get overall stats
    const stats = await getOverallStats();

    // Format response
    const formattedMatches = matches.map(({ match, competition }) => ({
      id: match.id,
      externalId: match.externalId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamLogo: match.homeTeamLogo,
      awayTeamLogo: match.awayTeamLogo,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      kickoffTime: match.kickoffTime,
      status: match.status,
      round: match.round,
      venue: match.venue,
      competition: {
        id: competition.id,
        name: competition.name,
      },
    }));

    return NextResponse.json({
      success: true,
      matches: formattedMatches,
      stats,
      count: formattedMatches.length,
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
