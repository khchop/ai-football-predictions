import { getDb, predictions, matches } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';

async function checkAccuracy() {
  const db = getDb();
  
  console.log('\n=== Checking llama-3.1-8b-turbo accuracy in Eredivisie ===\n');
  
  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      correctTendency: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      correctTotal: sql<number>`SUM(CASE WHEN ${predictions.totalPoints} > 0 THEN 1 ELSE 0 END)`,
      accuracyTendency: sql<number>`ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / COUNT(*)::numeric, 1)`,
      accuracyTotal: sql<number>`ROUND(100.0 * SUM(CASE WHEN ${predictions.totalPoints} > 0 THEN 1 ELSE 0 END) / COUNT(*)::numeric, 1)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(predictions.modelId, 'llama-3.1-8b-turbo'),
        eq(matches.competitionId, 'eredivisie'),
        eq(predictions.status, 'scored')
      )
    );
  
  console.log('Total predictions:', result[0].total);
  console.log('Correct tendency (tendency_points > 0):', result[0].correctTendency);
  console.log('Correct with points (total_points > 0):', result[0].correctTotal);
  console.log('\nAccuracy using tendency_points > 0 (CORRECT):', result[0].accuracyTendency + '%');
  console.log('Accuracy using total_points > 0 (WRONG):', result[0].accuracyTotal + '%');
  
  console.log('\n=== Checking PSV vs NAC match ===\n');
  
  const matchCheck = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
      correctCount: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(matches)
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(eq(matches.slug, 'psv-eindhoven-vs-nac-breda-2026-01-24'))
    .groupBy(matches.id);
  
  if (matchCheck.length > 0) {
    console.log('Match found:', matchCheck[0].homeTeam, 'vs', matchCheck[0].awayTeam);
    console.log('Score:', matchCheck[0].homeScore, '-', matchCheck[0].awayScore);
    console.log('Status:', matchCheck[0].status);
    console.log('Total predictions:', matchCheck[0].predictionCount);
    console.log('Correct predictions:', matchCheck[0].correctCount);
  } else {
    console.log('Match not found');
  }
  
  process.exit(0);
}

checkAccuracy().catch(console.error);
