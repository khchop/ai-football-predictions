import { NextResponse } from 'next/server';
import { getLeaderboard, getActiveModels } from '@/lib/db/queries';

export async function GET() {
  try {
    const leaderboard = await getLeaderboard();
    const activeModels = await getActiveModels();

    return NextResponse.json({
      success: true,
      leaderboard,
      activeModels: activeModels.length,
      totalEntries: leaderboard.length,
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
