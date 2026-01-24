/**
 * Match Content Generation
 * 
 * Generates 3-section narrative content for match pages:
 * 1. Pre-match (~150-200 words) - generated after odds refresh
 * 2. Betting (~150-200 words) - generated after AI predictions
 * 3. Post-match (~150-200 words) - generated after scoring
 * 
 * Uses Together AI (Llama 4 Maverick) for consistent quality.
 * All functions are non-blocking (failures logged, not thrown).
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, matchContent, matches, matchAnalysis, bets, models, predictions } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import { generateTextWithTogetherAI } from './together-client';
import { CONTENT_CONFIG, estimateContentCost } from './config';
import { eq, desc } from 'drizzle-orm';

const log = loggers.content;

/**
 * Generate pre-match content (~150-200 words)
 * 
 * Triggered: After odds refresh (~6h before kickoff)
 * Content: Market expectations, bookmaker favors, key odds insights
 * 
 * Returns: true if content generated and saved, false if failed (non-blocking)
 */
export async function generatePreMatchContent(matchId: string): Promise<boolean> {
  try {
    const db = getDb();

    // Get match, competition, and analysis data
    const matchData = await db
      .select({
        match: matches,
        analysis: matchAnalysis,
      })
      .from(matches)
      .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
      .where(eq(matches.id, matchId))
      .limit(1);

     if (matchData.length === 0) {
       log.warn({ matchId }, 'Match not found for pre-match content generation');
       return false;
     }

    const { match, analysis } = matchData[0];

    // Build prompt for pre-match content
    const prompt = `Write 4-5 sentences (~150-200 words) summarizing bookmaker expectations for ${match.homeTeam} vs ${match.awayTeam}.

Match Details:
- Competition: (Match ID: ${matchId})
- Kickoff: ${match.kickoffTime}

Betting Odds (1X2):
- Home: ${analysis?.oddsHome || 'N/A'}
- Draw: ${analysis?.oddsDraw || 'N/A'}
- Away: ${analysis?.oddsAway || 'N/A'}

Market Insights:
- Over 2.5 Goals: ${analysis?.oddsOver25 || 'N/A'}
- Both Teams to Score: ${analysis?.oddsBttsYes || 'N/A'}
- Expert Advice: ${analysis?.advice || 'N/A'}

Team Form:
- ${match.homeTeam}: ${analysis?.homeTeamForm || 'N/A'} (${analysis?.homeGoalsScored}F/${analysis?.homeGoalsConceded}A)
- ${match.awayTeam}: ${analysis?.awayTeamForm || 'N/A'} (${analysis?.awayGoalsScored}F/${analysis?.awayGoalsConceded}A)

Include:
- Who bookmakers favor and the odds
- Key market insights (over/under, BTTS trends)
- Any notable value or pricing anomalies

Write flowing prose without headers.`;

     const systemPrompt = 'You are a professional football analyst writing a pre-match market summary for betting enthusiasts.';

     // Generate content (returns raw text, no JSON parsing)
     const result = await generateTextWithTogetherAI(
       systemPrompt,
       prompt,
       0.7,
       1000
     );

     // Content is already a string
     const content = result.content;

    // Save to database
    const db2 = getDb();
    const contentId = uuidv4();
    const now = new Date().toISOString();

    await db2
      .insert(matchContent)
      .values({
        id: contentId,
        matchId,
        preMatchContent: content,
        preMatchGeneratedAt: now,
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: matchContent.matchId,
        set: {
          preMatchContent: content,
          preMatchGeneratedAt: now,
          totalTokens: result.usage.totalTokens,
          totalCost: estimateContentCost(
            result.usage.promptTokens,
            result.usage.completionTokens
          ).toFixed(4),
          updatedAt: now,
        },
      });

     log.info(
       {
         matchId,
         tokens: result.usage.totalTokens,
         cost: result.cost.toFixed(4),
       },
       '✓ Pre-match content generated'
     );
     return true;
   } catch (error) {
     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Pre-match content generation failed'
     );
     // Non-blocking: don't throw, return false
     return false;
   }
}

/**
 * Generate betting content (~150-200 words)
 * 
 * Triggered: After AI predictions (~30m before kickoff)
 * Content: AI model consensus, prediction distribution, confidence
 * 
 * Returns: true if content generated and saved, false if failed (non-blocking)
 */
export async function generateBettingContent(matchId: string): Promise<boolean> {
   try {
     const db = getDb();

     // Get match and predictions
     const matchData = await db
       .select({
         match: matches,
       })
       .from(matches)
       .where(eq(matches.id, matchId))
       .limit(1);

      if (matchData.length === 0) {
        log.warn({ matchId }, 'Match not found for betting content generation');
        return false;
      }

      const match = matchData[0].match;

     // Get AI model predictions for this match
     const modelPredictions = await db
       .select({
         modelName: models.displayName,
         predictedHome: predictions.predictedHome,
         predictedAway: predictions.predictedAway,
         predictedResult: predictions.predictedResult,
       })
       .from(predictions)
       .innerJoin(models, eq(predictions.modelId, models.id))
       .where(eq(predictions.matchId, matchId));

     // Build prediction summary
     let predictionsSummary = '';
     if (modelPredictions.length > 0) {
       // Count result tendencies
       const homeFavor = modelPredictions.filter((p) => p.predictedResult === 'H').length;
       const drawFavor = modelPredictions.filter((p) => p.predictedResult === 'D').length;
       const awayFavor = modelPredictions.filter((p) => p.predictedResult === 'A').length;

       // Find most common scores
       const scoreFrequency = modelPredictions.reduce((acc, p) => {
         const score = `${p.predictedHome}-${p.predictedAway}`;
         acc[score] = (acc[score] || 0) + 1;
         return acc;
       }, {} as Record<string, number>);

       const topScores = Object.entries(scoreFrequency)
         .sort(([, a], [, b]) => b - a)
         .slice(0, 3)
         .map(([score, count]) => `${score} (${count} models)`)
         .join(', ');

       predictionsSummary = `
Prediction Distribution:
- Home Win (${match.homeTeam}): ${homeFavor} models
- Draw: ${drawFavor} models
- Away Win (${match.awayTeam}): ${awayFavor} models
Total Models: ${modelPredictions.length}

Top Predicted Scores:
${topScores}

Sample Model Predictions:
${modelPredictions
   .slice(0, 5)
   .map((p) => `- ${p.modelName}: ${p.predictedHome}-${p.predictedAway}`)
   .join('\n')}`;
     }

    const prompt = `Write 4-5 sentences (~150-200 words) summarizing AI model predictions for ${match.homeTeam} vs ${match.awayTeam}.

Match: ${match.homeTeam} vs ${match.awayTeam}
Kickoff: ${match.kickoffTime}

${predictionsSummary}

Include:
- Consensus prediction (most popular score/outcome)
- Distribution breakdown (how many models favor each side)
- Notable outliers or split opinions
- Confidence level of the consensus

Write flowing prose without headers.`;

     const systemPrompt =
       'You are a data analyst summarizing AI football model predictions for betting insights.';

     // Generate content (returns raw text, no JSON parsing)
     const result = await generateTextWithTogetherAI(
       systemPrompt,
       prompt,
       0.7,
       1000
     );

     // Content is already a string
     const content = result.content;

    // Save to database
    const db2 = getDb();
    const now = new Date().toISOString();

    await db2
      .update(matchContent)
      .set({
        bettingContent: content,
        bettingGeneratedAt: now,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        updatedAt: now,
      })
      .where(eq(matchContent.matchId, matchId));

     log.info(
       {
         matchId,
         tokens: result.usage.totalTokens,
         cost: result.cost.toFixed(4),
       },
       '✓ Betting content generated'
     );
     return true;
   } catch (error) {
     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Betting content generation failed'
     );
     // Non-blocking: don't throw, return false
     return false;
   }
}

/**
 * Generate post-match content (~150-200 words)
 * 
 * Triggered: After match scoring complete
 * Content: Result summary, how AI models performed, top scorers
 * 
 * Returns: true if content generated and saved, false if failed (non-blocking)
 */
export async function generatePostMatchContent(matchId: string): Promise<boolean> {
  try {
    const db = getDb();

    // Get match with final score
    const matchData = await db
      .select({
        match: matches,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

     if (matchData.length === 0) {
       log.warn({ matchId }, 'Match not found for post-match content generation');
       return false;
     }

     const match = matchData[0].match;

     if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) {
       log.warn(
         { matchId, status: match.status },
         'Match not finished, skipping post-match content'
       );
       return false;
     }

    // Get predictions with model names
    const predictionsWithModels = await db
      .select({
        modelName: models.displayName,
        predictedHome: predictions.predictedHome,
        predictedAway: predictions.predictedAway,
        tendencyPoints: predictions.tendencyPoints,
        goalDiffBonus: predictions.goalDiffBonus,
        exactScoreBonus: predictions.exactScoreBonus,
        totalPoints: predictions.totalPoints,
      })
      .from(predictions)
      .innerJoin(models, eq(predictions.modelId, models.id))
      .where(eq(predictions.matchId, matchId))
      .orderBy(desc(predictions.totalPoints));

     const correctTendency = predictionsWithModels.filter((p) => p.tendencyPoints !== null && p.tendencyPoints > 0)
       .length;
     const exactScores = predictionsWithModels.filter(
       (p) => p.exactScoreBonus !== null && p.exactScoreBonus > 0
     ).length;

    // Build top performers list with actual model names
    const topPerformers = predictionsWithModels
      .filter(p => p.totalPoints !== null && p.totalPoints > 0)
      .slice(0, 5)
      .map(p => `- ${p.modelName}: ${p.predictedHome}-${p.predictedAway} (${p.totalPoints} pts)`)
      .join('\n');

    // Build exact hits list
    const exactHits = predictionsWithModels
      .filter(p => p.exactScoreBonus !== null && p.exactScoreBonus > 0)
      .map(p => p.modelName);

    const prompt = `Write 4-5 sentences (~150-200 words) about ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}.

Final Score: ${match.homeScore}-${match.awayScore}
Status: ${match.status}
Quotas: Home=${match.quotaHome}, Draw=${match.quotaDraw}, Away=${match.quotaAway}

AI Model Performance:
- Total Predictions: ${predictionsWithModels.length}
- Correct Tendency: ${correctTendency} models (${predictionsWithModels.length > 0 ? ((correctTendency / predictionsWithModels.length) * 100).toFixed(1) : 0}%)
- Exact Score Hits: ${exactHits.length > 0 ? exactHits.join(', ') : 'None'}
- Total Points Awarded: ${predictionsWithModels.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}

Top Performers (by points):
${topPerformers || 'No correct predictions'}

All Predictions (top 10 by points):
${predictionsWithModels.slice(0, 10).map(p => `- ${p.modelName}: ${p.predictedHome}-${p.predictedAway} (${p.totalPoints ?? 0} pts)`).join('\n')}

Include:
- Match result summary
- How AI models performed (use actual model names like "Llama 3.3 70B", "DeepSeek R1", "Qwen 2.5 72B", etc.)
- Name the top scoring models specifically with their predictions
- Notable predictions that hit or missed (with model names)

IMPORTANT: Use the actual model names provided above. DO NOT use generic names like "Model 1", "Model 2", etc.

Write flowing prose without headers.`;

     const systemPrompt =
       'You are a sports analyst writing match reports and AI model performance summaries.';

     // Generate content (returns raw text, no JSON parsing)
     const result = await generateTextWithTogetherAI(
       systemPrompt,
       prompt,
       0.7,
       1000
     );

     // Content is already a string
     const content = result.content;

    // Save to database
    const db2 = getDb();
    const now = new Date().toISOString();

    await db2
      .update(matchContent)
      .set({
        postMatchContent: content,
        postMatchGeneratedAt: now,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        updatedAt: now,
      })
      .where(eq(matchContent.matchId, matchId));

     log.info(
       {
         matchId,
         tokens: result.usage.totalTokens,
         cost: result.cost.toFixed(4),
       },
       '✓ Post-match content generated'
     );
     return true;
   } catch (error) {
     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Post-match content generation failed'
     );
     // Non-blocking: don't throw, return false
     return false;
   }
}
