import { NextResponse } from 'next/server';
import { getDb, matches } from '@/lib/db';
import { generatePostMatchContent } from '@/lib/content/match-content';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (process.env.CRON_SECRET !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    const finishedMatches = await db
      .select({
        id: matches.id,
        homeTeam: matches.homeTeam,
        awayTeam: matches.awayTeam,
      })
      .from(matches)
      .where(eq(matches.status, 'finished'))
      .orderBy(desc(matches.kickoffTime))
      .limit(10);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const match of finishedMatches) {
      try {
        await generatePostMatchContent(match.id);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failCount++;
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: failCount === 0,
      postsGenerated: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
