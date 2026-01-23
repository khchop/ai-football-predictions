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
import { getDb, matchContent, matches, matchAnalysis, bets, models } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import { generateWithTogetherAI } from './together-client';
import { CONTENT_CONFIG, estimateContentCost } from './config';
import { eq } from 'drizzle-orm';

const log = loggers.content;

/**
 * Generate pre-match content (~150-200 words)
 * 
 * Triggered: After odds refresh (~6h before kickoff)
 * Content: Market expectations, bookmaker favors, key odds insights
 */
export async function generatePreMatchContent(matchId: string): Promise<void> {
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
      return;
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

    // Generate content
    const result = await generateWithTogetherAI<{ content: string }>(
      systemPrompt,
      prompt,
      0.7,
      1000
    );

    // Extract content (handle both direct string and JSON wrapper)
    const content =
      typeof result.content === 'string'
        ? result.content
        : (result.content as any).content || JSON.stringify(result.content);

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
        cost: result.usage.totalTokens,
      },
      '✓ Pre-match content generated'
    );
  } catch (error) {
    log.error(
      {
        matchId,
        err: error instanceof Error ? error.message : String(error),
      },
      'Pre-match content generation failed'
    );
    // Non-blocking: don't throw
  }
}

/**
 * Generate betting content (~150-200 words)
 * 
 * Triggered: After AI predictions (~30m before kickoff)
 * Content: AI model consensus, prediction distribution, confidence
 */
export async function generateBettingContent(matchId: string): Promise<void> {
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
      return;
    }

    const match = matchData[0].match;

    // Get AI model bets for this match
    const modelBets = await db
      .select({
        modelName: models.displayName,
        betType: bets.betType,
        selection: bets.selection,
        odds: bets.odds,
      })
      .from(bets)
      .innerJoin(models, eq(bets.modelId, models.id))
      .where(eq(bets.matchId, matchId));

    // Build prediction summary
    let predictionsSummary = '';
    if (modelBets.length > 0) {
      const resultBets = modelBets.filter((b) => b.betType === 'result');
      const homeFavor = resultBets.filter((b) => b.selection === '1').length;
      const drawFavor = resultBets.filter((b) => b.selection === 'X').length;
      const awayFavor = resultBets.filter((b) => b.selection === '2').length;

      predictionsSummary = `
Prediction Distribution:
- Home Win (${match.homeTeam}): ${homeFavor} models
- Draw: ${drawFavor} models
- Away Win (${match.awayTeam}): ${awayFavor} models
Total Models: ${resultBets.length}

Sample Model Bets:
${modelBets
  .slice(0, 5)
  .map((b) => `- ${b.modelName}: ${b.betType} ${b.selection} @${b.odds}`)
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

    // Generate content
    const result = await generateWithTogetherAI<{ content: string }>(
      systemPrompt,
      prompt,
      0.7,
      1000
    );

    // Extract content
    const content =
      typeof result.content === 'string'
        ? result.content
        : (result.content as any).content || JSON.stringify(result.content);

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
        cost: result.usage.totalTokens,
      },
      '✓ Betting content generated'
    );
  } catch (error) {
    log.error(
      {
        matchId,
        err: error instanceof Error ? error.message : String(error),
      },
      'Betting content generation failed'
    );
    // Non-blocking: don't throw
  }
}

/**
 * Generate post-match content (~150-200 words)
 * 
 * Triggered: After match scoring complete
 * Content: Result summary, how AI models performed, top scorers
 */
export async function generatePostMatchContent(matchId: string): Promise<void> {
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
      return;
    }

    const match = matchData[0].match;

    if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) {
      log.warn(
        { matchId, status: match.status },
        'Match not finished, skipping post-match content'
      );
      return;
    }

    // Get predictions performance summary
    const predictions = await db.query.predictions.findMany({
      where: (p, { eq: eqOp }) => eqOp(p.matchId, matchId),
    });

    const correctTendency = predictions.filter((p) => p.totalPoints !== null && p.totalPoints > 0)
      .length;
    const exactScores = predictions.filter(
      (p) => p.exactScoreBonus !== null && p.exactScoreBonus > 0
    ).length;

    const prompt = `Write 4-5 sentences (~150-200 words) about ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}.

Final Score: ${match.homeScore}-${match.awayScore}
Status: ${match.status}
Quotas: Home=${match.quotaHome}, Draw=${match.quotaDraw}, Away=${match.quotaAway}

AI Model Performance:
- Total Predictions: ${predictions.length}
- Correct Tendency: ${correctTendency} models (${predictions.length > 0 ? ((correctTendency / predictions.length) * 100).toFixed(1) : 0}%)
- Exact Score Hits: ${exactScores} models
- Total Points Awarded: ${predictions.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}

Include:
- Match result summary and key details
- How AI models performed (% correct tendency, exact scores)
- Which models scored highest
- Notable predictions that hit or missed

Write flowing prose without headers.`;

    const systemPrompt =
      'You are a sports analyst writing match reports and AI model performance summaries.';

    // Generate content
    const result = await generateWithTogetherAI<{ content: string }>(
      systemPrompt,
      prompt,
      0.7,
      1000
    );

    // Extract content
    const content =
      typeof result.content === 'string'
        ? result.content
        : (result.content as any).content || JSON.stringify(result.content);

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
        cost: result.usage.totalTokens,
      },
      '✓ Post-match content generated'
    );
  } catch (error) {
    log.error(
      {
        matchId,
        err: error instanceof Error ? error.message : String(error),
      },
      'Post-match content generation failed'
    );
    // Non-blocking: don't throw
  }
}
