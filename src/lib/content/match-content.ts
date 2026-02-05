/**
 * Match Content Generation
 *
 * Generates 3-section narrative content for match pages:
 * 1. Pre-match (~150-200 words) - generated after odds refresh
 * 2. Betting (~150-200 words) - generated after AI predictions
 * 3. Post-match (~150-200 words) - generated after scoring
 *
 * Uses Together AI (Llama 4 Maverick) for consistent quality.
 * All functions throw errors on failure to enable BullMQ retry and DLQ tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, matchContent, matches, matchAnalysis, bets, models, predictions } from '@/lib/db';
import { getOverallStats } from '@/lib/db/queries';
import { loggers } from '@/lib/logger/modules';
import { generateTextWithTogetherAI, generateWithTogetherAI } from './together-client';
import { CONTENT_CONFIG, estimateContentCost } from './config';
import { eq, desc } from 'drizzle-orm';
import { format } from 'date-fns';
import { RetryableContentError, FatalContentError } from '@/lib/errors/content-errors';
import { sanitizeContent, validateNoHtml } from './sanitization';

export interface FAQItem {
  question: string;
  answer: string;
}

const log = loggers.content;

/**
 * Validate generated content meets quality thresholds
 * Throws if content is invalid (retryable - LLM may produce valid content on retry)
 */
function validateGeneratedContent(
  content: string,
  contentType: 'pre-match' | 'betting' | 'post-match' | 'faq',
  minLength: number = 100
): void {
  // Length check
  if (content.length < minLength) {
    throw new Error(
      `Content too short: ${content.length} chars (min: ${minLength}) for ${contentType}`
    );
  }

  // Empty/whitespace check
  if (content.trim().length === 0) {
    throw new Error(`Content is empty or whitespace only for ${contentType}`);
  }

  // Placeholder detection
  const placeholders = [
    /\[TEAM NAME\]/gi,
    /\[PLACEHOLDER\]/gi,
    /lorem ipsum/gi,
    /\bTODO\b/gi,
    /\bFIXME\b/gi,
    /\{\{.*?\}\}/g,
    /\[Insert.*?\]/gi,
    /I cannot generate/gi,
    /As an AI/gi,
    /I'm unable to/gi,
  ];

  for (const pattern of placeholders) {
    if (pattern.test(content)) {
      throw new Error(
        `Placeholder detected in ${contentType} content: ${pattern.source}`
      );
    }
  }
}

/**
 * Generate pre-match content (~150-200 words)
 *
 * Triggered: After odds refresh (~6h before kickoff)
 * Content: Market expectations, bookmaker favors, key odds insights
 *
 * Throws: FatalContentError if match not found, RetryableContentError on API failures
 */
export async function generatePreMatchContent(matchId: string): Promise<void> {
  let match: typeof matches.$inferSelect | undefined;

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
       throw new FatalContentError(
         `Match not found for pre-match content generation: ${matchId}`,
         {
           matchId,
           reason: 'match_not_found',
           timestamp: new Date().toISOString(),
         }
       );
     }

    ({ match } = matchData[0]);
    const { analysis } = matchData[0];

    // Build prompt for pre-match content
    const prompt = `Write 4-5 sentences (~150-200 words) about ${match.homeTeam} vs ${match.awayTeam}.

ANSWER-FIRST REQUIREMENT (CRITICAL):
Your FIRST sentence MUST state who bookmakers favor to win.
Include in first 30-60 words: the favored team, predicted outcome, and odds.

CORRECT EXAMPLE:
"${match.homeTeam} are favored to beat ${match.awayTeam} at odds of ${analysis?.oddsHome || 'X.XX'} in this match, with bookmakers giving them a clear edge based on recent form."

INCORRECT EXAMPLE (DO NOT USE):
"This exciting fixture sees ${match.homeTeam} take on ${match.awayTeam} this weekend in what promises to be a thrilling encounter..."

ENTITY NAME CONSISTENCY:
- Always use "${match.homeTeam}" (never abbreviate to nicknames or acronyms)
- Always use "${match.awayTeam}" (never abbreviate to nicknames or acronyms)

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

Include (after the answer-first opening):
- Key market insights (over/under, BTTS trends)
- Any notable value or pricing anomalies
- Brief form context

OUTPUT FORMAT:
- Plain text only, no HTML tags
- No HTML entities (use actual characters: &, ", etc.)
- Use natural line breaks for paragraphs

Write flowing prose without headers.`;

     const systemPrompt = 'You are a professional football analyst writing a pre-match market summary for betting enthusiasts.';

     // Generate content (returns raw text, no JSON parsing)
     const result = await generateTextWithTogetherAI(
       systemPrompt,
       prompt,
       0.7,
       1000
     );

     // Content is already a string - sanitize before validation
     const content = sanitizeContent(result.content);

    // Validate content before saving
    validateGeneratedContent(content, 'pre-match', 100);
    validateNoHtml(content);

    // Save to database
    const db2 = getDb();
    const contentId = uuidv4();
    const nowISOString = new Date().toISOString();

    await db2
      .insert(matchContent)
      .values({
        id: contentId,
        matchId,
        preMatchContent: content,
        preMatchGeneratedAt: nowISOString,
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        createdAt: nowISOString,
        updatedAt: nowISOString,
      })
      .onConflictDoUpdate({
        target: matchContent.matchId,
        set: {
          preMatchContent: content,
          preMatchGeneratedAt: nowISOString,
          totalTokens: result.usage.totalTokens,
          totalCost: estimateContentCost(
            result.usage.promptTokens,
            result.usage.completionTokens
          ).toFixed(4),
          updatedAt: nowISOString,
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
   } catch (error) {
     // Re-throw FatalContentError as-is
     if (error instanceof FatalContentError) {
       throw error;
     }

     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Pre-match content generation failed'
     );

     throw new RetryableContentError(
       `Pre-match content generation failed for ${matchId}`,
       {
         matchId,
         homeTeam: match?.homeTeam || 'Unknown',
         awayTeam: match?.awayTeam || 'Unknown',
         contentType: 'pre-match',
         timestamp: new Date().toISOString(),
         originalError: error,
       }
     );
   }
}

/**
 * Generate betting content (~150-200 words)
 *
 * Triggered: After AI predictions (~30m before kickoff)
 * Content: AI model consensus, prediction distribution, confidence
 *
 * Throws: FatalContentError if match not found, RetryableContentError on API failures
 */
export async function generateBettingContent(matchId: string): Promise<void> {
   let match: typeof matches.$inferSelect | undefined;

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
        throw new FatalContentError(
          `Match not found for betting content generation: ${matchId}`,
          {
            matchId,
            reason: 'match_not_found',
            timestamp: new Date().toISOString(),
          }
        );
      }

      match = matchData[0].match;

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

OUTPUT FORMAT:
- Plain text only, no HTML tags
- No HTML entities (use actual characters: &, ", etc.)
- Use natural line breaks for paragraphs

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

     // Content is already a string - sanitize before validation
     const content = sanitizeContent(result.content);

    // Validate content before saving
    validateGeneratedContent(content, 'betting', 100);
    validateNoHtml(content);

    // Save to database (upsert to handle cases where matchContent record doesn't exist yet)
    const db2 = getDb();
    const nowISOString = new Date().toISOString();
    const contentId = uuidv4();

    await db2
      .insert(matchContent)
      .values({
        id: contentId,
        matchId,
        bettingContent: content,
        bettingGeneratedAt: nowISOString,
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        createdAt: nowISOString,
        updatedAt: nowISOString,
      })
      .onConflictDoUpdate({
        target: matchContent.matchId,
        set: {
          bettingContent: content,
          bettingGeneratedAt: nowISOString,
          totalTokens: result.usage.totalTokens,
          totalCost: estimateContentCost(
            result.usage.promptTokens,
            result.usage.completionTokens
          ).toFixed(4),
          updatedAt: nowISOString,
        },
      });

     log.info(
       {
         matchId,
         tokens: result.usage.totalTokens,
         cost: result.cost.toFixed(4),
       },
       '✓ Betting content generated'
     );
   } catch (error) {
     // Re-throw FatalContentError as-is
     if (error instanceof FatalContentError) {
       throw error;
     }

     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Betting content generation failed'
     );

     throw new RetryableContentError(
       `Betting content generation failed for ${matchId}`,
       {
         matchId,
         homeTeam: match?.homeTeam || 'Unknown',
         awayTeam: match?.awayTeam || 'Unknown',
         contentType: 'betting',
         timestamp: new Date().toISOString(),
         originalError: error,
       }
     );
   }
}

/**
 * Generate post-match content (~150-200 words)
 *
 * Triggered: After match scoring complete
 * Content: Result summary, how AI models performed, top scorers
 *
 * Throws: FatalContentError if match not found or not finished, RetryableContentError on API failures
 */
export async function generatePostMatchContent(matchId: string): Promise<void> {
  let match: typeof matches.$inferSelect | undefined;

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
       throw new FatalContentError(
         `Match not found for post-match content generation: ${matchId}`,
         {
           matchId,
           reason: 'match_not_found',
           timestamp: new Date().toISOString(),
         }
       );
     }

     match = matchData[0].match;

     if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) {
       log.warn(
         { matchId, status: match.status },
         'Match not finished, skipping post-match content'
       );
       throw new FatalContentError(
         `Match not finished, cannot generate post-match content: ${matchId}`,
         {
           matchId,
           reason: 'match_not_finished',
           timestamp: new Date().toISOString(),
         }
       );
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

ANSWER-FIRST REQUIREMENT (CRITICAL):
Your FIRST sentence MUST state the final score and winner.
Include in first 30-60 words: the score, who won (or draw), and AI model prediction accuracy.

CORRECT EXAMPLE:
"${match.homeTeam} defeated ${match.awayTeam} ${match.homeScore}-${match.awayScore}, with ${correctTendency} of ${predictionsWithModels.length} AI models correctly predicting the result."

INCORRECT EXAMPLE (DO NOT USE):
"In a thrilling match, ${match.homeTeam} hosted ${match.awayTeam} at their home ground on this exciting matchday..."

ENTITY NAME CONSISTENCY:
- Always use "${match.homeTeam}" (never abbreviate to nicknames or acronyms)
- Always use "${match.awayTeam}" (never abbreviate to nicknames or acronyms)

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

Include (after the answer-first opening):
- How AI models performed (use actual model names like "Llama 3.3 70B", "DeepSeek R1", "Qwen 2.5 72B", etc.)
- Name the top scoring models specifically with their predictions
- Notable predictions that hit or missed (with model names)

IMPORTANT: Use the actual model names provided above. DO NOT use generic names like "Model 1", "Model 2", etc.

OUTPUT FORMAT:
- Plain text only, no HTML tags
- No HTML entities (use actual characters: &, ", etc.)
- Use natural line breaks for paragraphs

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

     // Content is already a string - sanitize before validation
     const content = sanitizeContent(result.content);

    // Validate content before saving
    validateGeneratedContent(content, 'post-match', 100);
    validateNoHtml(content);

    // Save to database (upsert to handle cases where matchContent record doesn't exist yet)
    const db2 = getDb();
    const nowISOString = new Date().toISOString();
    const contentId = uuidv4();

    await db2
      .insert(matchContent)
      .values({
        id: contentId,
        matchId,
        postMatchContent: content,
        postMatchGeneratedAt: nowISOString,
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        createdAt: nowISOString,
        updatedAt: nowISOString,
      })
      .onConflictDoUpdate({
        target: matchContent.matchId,
        set: {
          postMatchContent: content,
          postMatchGeneratedAt: nowISOString,
          totalTokens: result.usage.totalTokens,
          totalCost: estimateContentCost(
            result.usage.promptTokens,
            result.usage.completionTokens
          ).toFixed(4),
          updatedAt: nowISOString,
        },
      });

     log.info(
       {
         matchId,
         tokens: result.usage.totalTokens,
         cost: result.cost.toFixed(4),
       },
       '✓ Post-match content generated'
     );
   } catch (error) {
     // Re-throw FatalContentError as-is
     if (error instanceof FatalContentError) {
       throw error;
     }

     log.error(
       {
         matchId,
         err: error instanceof Error ? error.message : String(error),
       },
       'Post-match content generation failed'
     );

     throw new RetryableContentError(
       `Post-match content generation failed for ${matchId}`,
       {
         matchId,
         homeTeam: match?.homeTeam || 'Unknown',
         awayTeam: match?.awayTeam || 'Unknown',
         contentType: 'post-match',
         timestamp: new Date().toISOString(),
         originalError: error,
       }
     );
   }
}

/**
 * Generate FAQ content (5 Q&A pairs)
 *
 * Triggered: After pre-match content (upcoming) or post-match content (finished)
 * Content: Match-specific FAQ with AI-generated answers
 *
 * Throws: FatalContentError if match not found, RetryableContentError on API failures or invalid format
 */
export async function generateFAQContent(matchId: string): Promise<void> {
  console.log('[generateFAQContent] Starting for match:', matchId);
  let match: typeof matches.$inferSelect | undefined;

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
      log.warn({ matchId }, 'Match not found for FAQ content generation');
      throw new FatalContentError(
        `Match not found for FAQ content generation: ${matchId}`,
        {
          matchId,
          reason: 'match_not_found',
          timestamp: new Date().toISOString(),
        }
      );
    }

    ({ match } = matchData[0]);
    const { analysis } = matchData[0];
    const isFinished = match.status === 'finished';
    const kickoffDate = new Date(match.kickoffTime);
    const formattedDate = format(kickoffDate, 'MMMM d, yyyy');
    const formattedTime = format(kickoffDate, 'h:mm a');

    // Get active model count for dynamic content
    const overallStats = await getOverallStats();
    const activeModelCount = overallStats.activeModels;

    // Get predictions for context
    const modelPredictions = await db
      .select({
        modelName: models.displayName,
        predictedHome: predictions.predictedHome,
        predictedAway: predictions.predictedAway,
        predictedResult: predictions.predictedResult,
        totalPoints: predictions.totalPoints,
      })
      .from(predictions)
      .innerJoin(models, eq(predictions.modelId, models.id))
      .where(eq(predictions.matchId, matchId))
      .orderBy(desc(predictions.totalPoints));

    // Build context for FAQ generation
    let matchContext = '';

    if (isFinished && match.homeScore !== null && match.awayScore !== null) {
      // Finished match context
      const correctPredictions = modelPredictions.filter(p => p.totalPoints !== null && p.totalPoints > 0);
      const exactScoreHits = modelPredictions.filter(p =>
        p.predictedHome === match!.homeScore && p.predictedAway === match!.awayScore
      );
      const accuracyPct = modelPredictions.length > 0
        ? ((correctPredictions.length / modelPredictions.length) * 100).toFixed(0)
        : '0';

      matchContext = `
MATCH RESULT:
${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}
Competition: Match page
Date: ${formattedDate}

AI MODEL ACCURACY DATA (USE THESE EXACT NUMBERS IN YOUR ANSWERS):
- Total models that predicted: ${modelPredictions.length}
- Correctly predicted result: ${correctPredictions.length} models (${accuracyPct}%)
- Predicted exact score: ${exactScoreHits.length} model(s)
${exactScoreHits.length > 0 ? `- Models with exact score: ${exactScoreHits.map(p => p.modelName).join(', ')}` : ''}

Top 3 performers by points:
${modelPredictions.slice(0, 3).map(p => `- ${p.modelName}: ${p.totalPoints ?? 0} points`).join('\n')}

ENTITY NAME CONSISTENCY:
- Always use "${match.homeTeam}" (never abbreviate to nicknames or acronyms)
- Always use "${match.awayTeam}" (never abbreviate to nicknames or acronyms)

Generate 5 FAQs. CRITICAL - Question #2 MUST be the accuracy question:
1. What was the final score of ${match.homeTeam} vs ${match.awayTeam}? (Include: ${match.homeScore}-${match.awayScore}, ${formattedDate})
2. How accurate were AI predictions for ${match.homeTeam} vs ${match.awayTeam}? (MUST include: "${correctPredictions.length} of ${modelPredictions.length} models (${accuracyPct}%)")
3. Which AI models performed best for this match? (Name the top 3 models with their points)
4. Did any AI model predict the exact score? (State ${exactScoreHits.length} models, name them if any)
5. How do AI football predictions work? (Brief methodology explanation)

CRITICAL: Use the EXACT numbers provided above in your answers. Do NOT use placeholders like "check the table" or "see above".`;
    } else {
      // Upcoming/Live match context
      const homeFavor = modelPredictions.filter(p => p.predictedResult === 'H').length;
      const drawFavor = modelPredictions.filter(p => p.predictedResult === 'D').length;
      const awayFavor = modelPredictions.filter(p => p.predictedResult === 'A').length;

      const scoreFrequency = modelPredictions.reduce((acc, p) => {
        const score = `${p.predictedHome}-${p.predictedAway}`;
        acc[score] = (acc[score] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topScores = Object.entries(scoreFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      // Determine consensus prediction (most favored outcome)
      const consensusOutcome = homeFavor > awayFavor && homeFavor > drawFavor
        ? `${match.homeTeam} win`
        : awayFavor > homeFavor && awayFavor > drawFavor
        ? `${match.awayTeam} win`
        : 'draw';
      const consensusCount = Math.max(homeFavor, drawFavor, awayFavor);

      matchContext = `
UPCOMING MATCH:
${match.homeTeam} vs ${match.awayTeam}
Kickoff: ${formattedDate} at ${formattedTime}
Venue: ${match.venue || 'TBD'}

BETTING ODDS:
- Home win: ${analysis?.oddsHome || 'N/A'}
- Draw: ${analysis?.oddsDraw || 'N/A'}
- Away win: ${analysis?.oddsAway || 'N/A'}

AI PREDICTION DATA (USE THESE EXACT NUMBERS IN YOUR ANSWERS):
- Total models predicting: ${modelPredictions.length}
- Consensus prediction: ${consensusOutcome} (${consensusCount} of ${modelPredictions.length} models)
- Home win predictions: ${homeFavor} models
- Draw predictions: ${drawFavor} models
- Away win predictions: ${awayFavor} models
- Most predicted score(s): ${topScores.map(([score, count]) => `${score} (${count} models)`).join(', ')}

Sample model predictions:
${modelPredictions.slice(0, 5).map(p => `- ${p.modelName}: ${p.predictedHome}-${p.predictedAway}`).join('\n')}

ENTITY NAME CONSISTENCY:
- Always use "${match.homeTeam}" (never abbreviate to nicknames or acronyms)
- Always use "${match.awayTeam}" (never abbreviate to nicknames or acronyms)

Generate 5 FAQs for this UPCOMING match:
1. When and where is ${match.homeTeam} vs ${match.awayTeam}? (Include: ${formattedDate}, ${formattedTime}, ${match.venue || 'venue TBD'})
2. What do AI models predict for ${match.homeTeam} vs ${match.awayTeam}? (MUST include: "${consensusCount} of ${modelPredictions.length} models predict ${consensusOutcome}")
3. What is the most predicted scoreline? (State the top predicted score(s) with model counts)
4. Which AI models are predicting a ${match.homeTeam} win? (Name specific models from sample list)
5. How accurate are AI football predictions? (Brief methodology, mention ${activeModelCount}+ models)

CRITICAL: Use the EXACT numbers and model names provided above. Do NOT use generic placeholders.`;
    }

    const prompt = `Generate exactly 5 FAQ question-answer pairs for this football match.

${matchContext}

REQUIREMENTS:
- Each answer should be 1-3 sentences, factual and direct
- Mention specific AI model names when relevant (GPT-4, Claude, Gemini, Llama, DeepSeek, etc.)
- Answers should be informative and SEO-friendly
- Do NOT use generic placeholders - use the actual data provided

Return a JSON array with exactly 5 objects, each having "question" and "answer" fields.
Example format:
[
  {"question": "What was the final score of Team A vs Team B?", "answer": "Team A won 2-1 against Team B..."},
  ...
]`;

    const systemPrompt = 'You are an SEO expert generating FAQ content for AI-powered football prediction pages. Generate factual, helpful Q&A pairs that would appear in search results. CRITICAL: All text in question/answer fields must be plain text with no HTML tags or entities. Return valid JSON only.';

    console.log('[generateFAQContent] Calling Together AI...');

    // Generate structured FAQ content
    const result = await generateWithTogetherAI<FAQItem[]>(
      systemPrompt,
      prompt,
      0.7,
      2000
    );

    console.log('[generateFAQContent] Together AI response received, validating...');

    // Validate we got an array of FAQs (LLM may produce valid format on retry)
    if (!Array.isArray(result.content) || result.content.length === 0) {
      log.warn({ matchId, content: result.content }, 'FAQ generation returned invalid format');
      console.log('[generateFAQContent] Invalid format:', typeof result.content, result.content);
      throw new Error('FAQ generation returned invalid format - will retry');
    }

    // Ensure exactly 5 FAQs and sanitize each field
    const faqs = result.content.slice(0, 5).map((faq: FAQItem) => ({
      question: sanitizeContent(faq.question),
      answer: sanitizeContent(faq.answer),
    }));

    // Validate each FAQ field meets minimum length and has no HTML
    for (const faq of faqs) {
      if (!faq.question || faq.question.length < 10) {
        throw new Error('FAQ question too short or missing');
      }
      if (!faq.answer || faq.answer.length < 20) {
        throw new Error('FAQ answer too short or missing');
      }
      validateNoHtml(faq.question);
      validateNoHtml(faq.answer);
    }

    // Save to database
    const db2 = getDb();
    const nowISOString = new Date().toISOString();
    const contentId = uuidv4();

    await db2
      .insert(matchContent)
      .values({
        id: contentId,
        matchId,
        faqContent: JSON.stringify(faqs),
        faqGeneratedAt: nowISOString,
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: result.usage.totalTokens,
        totalCost: estimateContentCost(
          result.usage.promptTokens,
          result.usage.completionTokens
        ).toFixed(4),
        createdAt: nowISOString,
        updatedAt: nowISOString,
      })
      .onConflictDoUpdate({
        target: matchContent.matchId,
        set: {
          faqContent: JSON.stringify(faqs),
          faqGeneratedAt: nowISOString,
          totalTokens: result.usage.totalTokens,
          totalCost: estimateContentCost(
            result.usage.promptTokens,
            result.usage.completionTokens
          ).toFixed(4),
          updatedAt: nowISOString,
        },
      });

    log.info(
      {
        matchId,
        faqCount: faqs.length,
        tokens: result.usage.totalTokens,
        cost: result.cost.toFixed(4),
      },
      '✓ FAQ content generated'
    );
  } catch (error) {
    // Re-throw FatalContentError as-is
    if (error instanceof FatalContentError) {
      throw error;
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[generateFAQContent] Error:', errMsg);
    log.error(
      {
        matchId,
        err: errMsg,
      },
      'FAQ content generation failed'
    );

    throw new RetryableContentError(
      `FAQ content generation failed for ${matchId}`,
      {
        matchId,
        homeTeam: match?.homeTeam || 'Unknown',
        awayTeam: match?.awayTeam || 'Unknown',
        contentType: 'faq',
        timestamp: new Date().toISOString(),
        originalError: error,
      }
    );
  }
}

/**
 * Get FAQ content for a match
 * Returns AI-generated FAQs if available, null otherwise
 */
export async function getMatchFAQContent(matchId: string): Promise<FAQItem[] | null> {
  try {
    const db = getDb();
    const result = await db
      .select({ faqContent: matchContent.faqContent })
      .from(matchContent)
      .where(eq(matchContent.matchId, matchId))
      .limit(1);

    if (result.length === 0 || !result[0].faqContent) {
      return null;
    }

    return JSON.parse(result[0].faqContent) as FAQItem[];
  } catch {
    return null;
  }
}

/**
 * Get content generation timestamp for a match
 * Returns the updatedAt timestamp from matchContent table for Article schema dateModified
 */
export async function getMatchContentTimestamp(matchId: string): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db
      .select({ updatedAt: matchContent.updatedAt })
      .from(matchContent)
      .where(eq(matchContent.matchId, matchId))
      .limit(1);

    if (result.length === 0 || !result[0].updatedAt) {
      return null;
    }

    return result[0].updatedAt;
  } catch {
    return null;
  }
}
