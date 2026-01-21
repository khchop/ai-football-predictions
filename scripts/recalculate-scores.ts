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

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Quota constants
const MIN_QUOTA = 2;
const MAX_QUOTA = 6;
const GOAL_DIFF_BONUS = 1;
const EXACT_SCORE_BONUS = 3;

// Determine match result from scores
type Result = 'home' | 'draw' | 'away';

function getResult(homeScore: number, awayScore: number): Result {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

// Calculate quotas from prediction distribution
function calculateQuotas(predictions: Array<{ predicted_home_score: number; predicted_away_score: number }>): {
  home: number;
  draw: number;
  away: number;
} {
  const totalPredictions = predictions.length;
  
  if (totalPredictions === 0) {
    return { home: MIN_QUOTA, draw: MAX_QUOTA, away: MAX_QUOTA };
  }

  let homeCount = 0;
  let drawCount = 0;
  let awayCount = 0;

  for (const pred of predictions) {
    const result = getResult(pred.predicted_home_score, pred.predicted_away_score);
    if (result === 'home') homeCount++;
    else if (result === 'draw') drawCount++;
    else awayCount++;
  }

  // Calculate raw quotas (totalPredictions / count for each outcome)
  // If no one predicted an outcome, give it max quota
  const rawHome = homeCount > 0 ? totalPredictions / homeCount : MAX_QUOTA;
  const rawDraw = drawCount > 0 ? totalPredictions / drawCount : MAX_QUOTA;
  const rawAway = awayCount > 0 ? totalPredictions / awayCount : MAX_QUOTA;

  // Clamp to [MIN_QUOTA, MAX_QUOTA]
  const clamp = (val: number) => Math.max(MIN_QUOTA, Math.min(MAX_QUOTA, val));

  return {
    home: Math.round(clamp(rawHome) * 100) / 100,
    draw: Math.round(clamp(rawDraw) * 100) / 100,
    away: Math.round(clamp(rawAway) * 100) / 100,
  };
}

// Calculate score for a single prediction
function calculateScore(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  quotas: { home: number; draw: number; away: number }
): {
  tendencyPoints: number;
  goalDiffBonus: number;
  exactScoreBonus: number;
  total: number;
} {
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);

  // If tendency is wrong, 0 points
  if (predictedResult !== actualResult) {
    return { tendencyPoints: 0, goalDiffBonus: 0, exactScoreBonus: 0, total: 0 };
  }

  // Get quota for this tendency
  const tendencyPoints = quotas[predictedResult];

  // Check goal difference bonus
  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;
  const goalDiffBonus = predictedDiff === actualDiff ? GOAL_DIFF_BONUS : 0;

  // Check exact score bonus
  const exactScoreBonus = 
    predictedHome === actualHome && predictedAway === actualAway 
      ? EXACT_SCORE_BONUS 
      : 0;

  const total = tendencyPoints + goalDiffBonus + exactScoreBonus;

  return { tendencyPoints, goalDiffBonus, exactScoreBonus, total };
}

async function recalculateAllScores() {
  console.log('Starting score recalculation with Kicktipp Quota System...\n');

  // Get all finished matches
  const matchesResult = await pool.query(
    `SELECT id, home_score, away_score FROM matches WHERE status = 'finished' AND home_score IS NOT NULL`
  );
  const matches = matchesResult.rows;

  console.log(`Found ${matches.length} finished matches to process\n`);

  let totalPredictions = 0;
  let totalPoints = 0;

  for (const match of matches) {
    // Get all predictions for this match
    const predictionsResult = await pool.query(
      `SELECT id, predicted_home_score, predicted_away_score FROM predictions WHERE match_id = $1`,
      [match.id]
    );
    const predictions = predictionsResult.rows;

    if (predictions.length === 0) {
      continue;
    }

    // Calculate quotas
    const quotas = calculateQuotas(predictions);

    // Save quotas to match
    await pool.query(
      `UPDATE matches SET quota_home = $1, quota_draw = $2, quota_away = $3 WHERE id = $4`,
      [quotas.home, quotas.draw, quotas.away, match.id]
    );

    // Recalculate each prediction
    for (const pred of predictions) {
      const score = calculateScore(
        pred.predicted_home_score,
        pred.predicted_away_score,
        match.home_score,
        match.away_score,
        quotas
      );

      await pool.query(
        `UPDATE predictions 
         SET points_result = $1, 
             points_goal_diff = $2, 
             points_exact_score = $3, 
             points_total = $4
         WHERE id = $5`,
        [score.tendencyPoints, score.goalDiffBonus, score.exactScoreBonus, score.total, pred.id]
      );

      totalPredictions++;
      totalPoints += score.total;
    }

    console.log(
      `Match ${match.id}: ${predictions.length} predictions, quotas: H=${quotas.home} D=${quotas.draw} A=${quotas.away}`
    );
  }

  console.log(`\nDone! Recalculated ${totalPredictions} predictions`);
  console.log(`Total points: ${totalPoints}, Average: ${(totalPoints / totalPredictions).toFixed(2)}`);

  await pool.end();
}

recalculateAllScores().catch(console.error);
