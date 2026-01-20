/**
 * Recalculate all prediction scores using the Kicktipp Quota Scoring System
 * 
 * This script:
 * 1. Gets all finished matches
 * 2. For each match, calculates quotas based on prediction distribution
 * 3. Saves quotas to the match
 * 4. Recalculates all prediction scores using the new quota system
 * 
 * Run with: npx tsx scripts/recalculate-scores.ts
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Quota constants
const MIN_QUOTA = 2;
const MAX_QUOTA = 6;
const GOAL_DIFF_BONUS = 1;
const EXACT_SCORE_BONUS = 3;

// Determine match result from scores
function getResult(homeScore: number, awayScore: number): 'H' | 'D' | 'A' {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

// Calculate quotas from prediction distribution
function calculateQuotas(predictions: Array<{ predictedHome: number; predictedAway: number }>) {
  const total = predictions.length;
  
  if (total === 0) {
    return { home: MIN_QUOTA, draw: MIN_QUOTA, away: MIN_QUOTA };
  }
  
  let homeCount = 0;
  let drawCount = 0;
  let awayCount = 0;
  
  for (const pred of predictions) {
    const result = getResult(pred.predictedHome, pred.predictedAway);
    if (result === 'H') homeCount++;
    else if (result === 'D') drawCount++;
    else awayCount++;
  }
  
  const rawHomeQuota = homeCount > 0 ? total / homeCount : MAX_QUOTA;
  const rawDrawQuota = drawCount > 0 ? total / drawCount : MAX_QUOTA;
  const rawAwayQuota = awayCount > 0 ? total / awayCount : MAX_QUOTA;
  
  return {
    home: Math.round(Math.min(MAX_QUOTA, Math.max(MIN_QUOTA, rawHomeQuota)) * 10) / 10,
    draw: Math.round(Math.min(MAX_QUOTA, Math.max(MIN_QUOTA, rawDrawQuota)) * 10) / 10,
    away: Math.round(Math.min(MAX_QUOTA, Math.max(MIN_QUOTA, rawAwayQuota)) * 10) / 10,
  };
}

// Calculate scores for a single prediction
function calculateScores(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  quotaHome: number,
  quotaDraw: number,
  quotaAway: number
) {
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  
  // Wrong tendency = 0 points
  if (predictedResult !== actualResult) {
    return { tendencyPoints: 0, goalDiffBonus: 0, exactScoreBonus: 0, total: 0 };
  }
  
  // Tendency points based on quota
  let tendencyPoints = 0;
  switch (actualResult) {
    case 'H': tendencyPoints = quotaHome; break;
    case 'D': tendencyPoints = quotaDraw; break;
    case 'A': tendencyPoints = quotaAway; break;
  }
  
  // Goal difference bonus
  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;
  const goalDiffBonus = predictedDiff === actualDiff ? GOAL_DIFF_BONUS : 0;
  
  // Exact score bonus
  const exactScoreBonus = (predictedHome === actualHome && predictedAway === actualAway) 
    ? EXACT_SCORE_BONUS : 0;
  
  return {
    tendencyPoints,
    goalDiffBonus,
    exactScoreBonus,
    total: tendencyPoints + goalDiffBonus + exactScoreBonus,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('RECALCULATING ALL SCORES WITH KICKTIPP QUOTA SYSTEM');
  console.log('='.repeat(60));
  console.log('');

  // Get all finished matches
  const matchesResult = await client.execute(`
    SELECT id, home_team, away_team, home_score, away_score
    FROM matches
    WHERE status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL
    ORDER BY kickoff_time DESC
  `);

  const matches = matchesResult.rows;
  console.log(`Found ${matches.length} finished matches to recalculate\n`);

  let totalPredictions = 0;
  let totalPointsBefore = 0;
  let totalPointsAfter = 0;

  for (const match of matches) {
    const matchId = match.id as string;
    const homeTeam = match.home_team as string;
    const awayTeam = match.away_team as string;
    const actualHome = match.home_score as number;
    const actualAway = match.away_score as number;

    // Get all predictions for this match
    const predictionsResult = await client.execute({
      sql: `
        SELECT id, predicted_home_score, predicted_away_score, points_total
        FROM predictions
        WHERE match_id = ?
      `,
      args: [matchId],
    });

    const predictions = predictionsResult.rows;
    if (predictions.length === 0) {
      continue;
    }

    // Calculate quotas
    const predictionData = predictions.map(p => ({
      predictedHome: p.predicted_home_score as number,
      predictedAway: p.predicted_away_score as number,
    }));
    
    const quotas = calculateQuotas(predictionData);

    // Save quotas to match
    await client.execute({
      sql: `
        UPDATE matches 
        SET quota_home = ?, quota_draw = ?, quota_away = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [quotas.home, quotas.draw, quotas.away, matchId],
    });

    // Recalculate each prediction
    for (const prediction of predictions) {
      const predId = prediction.id as string;
      const predictedHome = prediction.predicted_home_score as number;
      const predictedAway = prediction.predicted_away_score as number;
      const oldTotal = (prediction.points_total as number) || 0;

      totalPredictions++;
      totalPointsBefore += oldTotal;

      const scores = calculateScores(
        predictedHome,
        predictedAway,
        actualHome,
        actualAway,
        quotas.home,
        quotas.draw,
        quotas.away
      );

      totalPointsAfter += scores.total;

      // Update prediction with new scores
      // Note: pointsResult now stores tendencyPoints, pointsExactScore stores exact bonus
      await client.execute({
        sql: `
          UPDATE predictions
          SET 
            points_result = ?,
            points_goal_diff = ?,
            points_exact_score = ?,
            points_over_under = 0,
            points_btts = 0,
            points_upset_bonus = 0,
            points_total = ?
          WHERE id = ?
        `,
        args: [
          scores.tendencyPoints,
          scores.goalDiffBonus,
          scores.exactScoreBonus,
          scores.total,
          predId,
        ],
      });
    }

    const actualResult = getResult(actualHome, actualAway);
    console.log(
      `${homeTeam} ${actualHome}-${actualAway} ${awayTeam} | ` +
      `Quotas: H:${quotas.home} D:${quotas.draw} A:${quotas.away} | ` +
      `Result: ${actualResult} | ` +
      `${predictions.length} predictions`
    );
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RECALCULATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total predictions recalculated: ${totalPredictions}`);
  console.log(`Total points before: ${totalPointsBefore}`);
  console.log(`Total points after: ${totalPointsAfter}`);
  console.log(`Average points before: ${(totalPointsBefore / totalPredictions).toFixed(2)}`);
  console.log(`Average points after: ${(totalPointsAfter / totalPredictions).toFixed(2)}`);
}

main().catch(console.error);
