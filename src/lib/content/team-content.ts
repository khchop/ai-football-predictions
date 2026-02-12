/**
 * Team Content Generation
 *
 * Generates AI-powered analysis and FAQ content for team pages:
 * 1. Analysis (~200-250 words) - team form, stats, AI model performance
 * 2. FAQs (5-7 Q&A pairs) - structured data for SEO/GEO
 *
 * Uses DeepSeek V3.1 via OpenRouter for consistent quality.
 * All functions throw errors on failure to enable BullMQ retry and DLQ tracking.
 */

import { loggers } from '@/lib/logger/modules';
import { generateTextWithOpenRouter, generateWithOpenRouter } from './together-client';
import { CONTENT_CONFIG, estimateContentCost } from './config';
import { RetryableContentError, FatalContentError } from '@/lib/errors/content-errors';
import { sanitizeContent, validateNoHtml } from './sanitization';
import { getTeamStats, getTeamFormGuide, getTeamModelLeaderboard } from '@/lib/db/queries/team-stats';
import { getOverallStats } from '@/lib/db/queries';
import { upsertTeamAnalysis, upsertTeamFAQs } from '@/lib/db/queries/team-content';
import type { FAQItem } from '@/lib/seo/schemas';

const log = loggers.content;

/**
 * Validate generated content meets quality thresholds
 * Throws if content is invalid (retryable - LLM may produce valid content on retry)
 */
function validateGeneratedContent(
  content: string,
  contentType: 'pre-match' | 'betting' | 'post-match' | 'faq' | 'team-analysis' | 'team-faq',
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
 * Generate team analysis content (~200-250 words)
 *
 * Triggered: During team content generation queue job
 * Content: Form analysis, goal patterns, AI model performance for team
 *
 * Throws: Error if team has <5 matches or generation fails
 */
export async function generateTeamAnalysis(teamName: string): Promise<void> {
  try {
    // Fetch team data
    const stats = await getTeamStats(teamName);
    const formGuide = await getTeamFormGuide(teamName, 5);
    const modelLeaderboard = await getTeamModelLeaderboard(teamName, {
      timePeriod: 'all',
      limit: 5,
    });

    // Skip teams with insufficient data
    if (stats.totalMatches < 5) {
      log.warn({ teamName, totalMatches: stats.totalMatches }, 'Skipping team with insufficient data (<5 matches)');
      return;
    }

    // Build prompt with team data
    const systemPrompt = 'You are a football analyst writing club analysis for betting enthusiasts who use AI-powered prediction models.';

    const formString = formGuide.join(''); // e.g., "WDLWW"
    const topModels = modelLeaderboard.slice(0, 5);
    const avgAccuracy = topModels.length > 0
      ? (topModels.reduce((sum, m) => sum + m.accuracy, 0) / topModels.length).toFixed(1)
      : '0';

    const userPrompt = `Write 3-4 paragraphs (200-250 words) analyzing ${teamName}'s performance and AI prediction patterns.

Team Statistics:
- Total matches: ${stats.totalMatches}
- Record: ${stats.wins}W / ${stats.draws}D / ${stats.losses}L
- Goals: ${stats.goalsScored}F / ${stats.goalsConceded}A (${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference} goal difference)
- Recent form (last 5): ${formString}
- Home record: ${stats.homeWins}W / ${stats.homeDraws}D / ${stats.homeLosses}L
- Away record: ${stats.awayWins}W / ${stats.awayDraws}D / ${stats.awayLosses}L
- Clean sheets: ${stats.cleanSheets}

Top AI Models for ${teamName}:
${topModels.map((m, i) => `${i + 1}. ${m.displayName}: ${m.accuracy.toFixed(1)}% accuracy (${m.correctTendencies}/${m.totalPredictions} correct)`).join('\n')}
Average model accuracy: ${avgAccuracy}%

REQUIREMENTS:
1. First paragraph: Overall form and record analysis
2. Second paragraph: Goal scoring patterns and defensive performance
3. Third paragraph: AI model performance - mention specific model names and accuracy rates
4. Fourth paragraph (optional): Notable patterns (home/away splits, recent trends)

CRITICAL ANTI-HALLUCINATION RULES:
- Do NOT mention player names, injuries, managers, transfer rumors, or league table positions
- Do NOT invent statistics beyond what is provided above
- Only use the exact data given (match counts, goals, form, model accuracies)
- Use actual model names from the list above, not generic placeholders

OUTPUT FORMAT:
- Plain text only, no HTML tags
- No HTML entities (use actual characters: &, ", etc.)
- Use natural line breaks between paragraphs
- Write flowing prose without headers or bullet points`;

    // Generate content
    const result = await generateTextWithOpenRouter(
      systemPrompt,
      userPrompt,
      0.7,
      1000
    );

    // Sanitize and validate
    const content = sanitizeContent(result.content);
    validateGeneratedContent(content, 'team-analysis', 150);
    validateNoHtml(content);

    // Save to database
    await upsertTeamAnalysis(teamName, content, {
      generatedBy: CONTENT_CONFIG.model,
      totalTokens: result.usage.totalTokens,
      totalCost: estimateContentCost(
        result.usage.promptTokens,
        result.usage.completionTokens
      ).toFixed(4),
    });

    log.info(
      {
        teamName,
        tokens: result.usage.totalTokens,
        cost: result.cost.toFixed(4),
      },
      '✓ Team analysis generated'
    );
  } catch (error) {
    log.error(
      {
        teamName,
        err: error instanceof Error ? error.message : String(error),
      },
      'Team analysis generation failed'
    );

    throw new RetryableContentError(
      `Team analysis generation failed for ${teamName}`,
      {
        matchId: 'N/A',
        homeTeam: teamName,
        awayTeam: 'N/A',
        contentType: 'faq',
        timestamp: new Date().toISOString(),
        originalError: error,
      }
    );
  }
}

/**
 * Generate team FAQ content (5-7 Q&A pairs)
 *
 * Triggered: During team content generation queue job
 * Content: Structured FAQ with team-specific data embedded in answers
 *
 * Throws: Error if team has <5 matches or generation fails
 */
export async function generateTeamFAQs(teamName: string): Promise<void> {
  try {
    // Fetch team data
    const stats = await getTeamStats(teamName);
    const formGuide = await getTeamFormGuide(teamName, 5);
    const modelLeaderboard = await getTeamModelLeaderboard(teamName, {
      timePeriod: 'all',
      limit: 5,
    });
    const overallStats = await getOverallStats();
    const activeModelCount = overallStats.activeModels;

    // Skip teams with insufficient data
    if (stats.totalMatches < 5) {
      log.warn({ teamName, totalMatches: stats.totalMatches }, 'Skipping team FAQ with insufficient data (<5 matches)');
      return;
    }

    // Build prompt
    const systemPrompt = 'You are an SEO expert generating FAQ content for AI-powered football prediction pages. Return valid JSON only.';

    const formString = formGuide.join(''); // e.g., "WDLWW"
    const topModel = modelLeaderboard[0];
    const topModelName = topModel?.displayName || 'N/A';
    const topModelAccuracy = topModel?.accuracy.toFixed(1) || '0';

    const userPrompt = `Generate exactly 5-7 FAQ question-answer pairs for ${teamName}.

Team Statistics:
- Total matches tracked: ${stats.totalMatches}
- Record: ${stats.wins}W / ${stats.draws}D / ${stats.losses}L
- Goals: ${stats.goalsScored} scored, ${stats.goalsConceded} conceded
- Recent form (last 5): ${formString}
- Home/Away: ${stats.homeWins}-${stats.homeDraws}-${stats.homeLosses} (H), ${stats.awayWins}-${stats.awayDraws}-${stats.awayLosses} (A)

AI Model Performance:
- Best performing model: ${topModelName} (${topModelAccuracy}% accuracy)
- Total models tracking ${teamName}: ${activeModelCount}
- Top 3 models:
${modelLeaderboard.slice(0, 3).map(m => `  - ${m.displayName}: ${m.accuracy.toFixed(1)}% (${m.correctTendencies}/${m.totalPredictions})`).join('\n')}

REQUIRED QUESTIONS (in this order):
1. What is ${teamName}'s win-loss record?
   - Answer MUST include: ${stats.wins}W-${stats.draws}D-${stats.losses}L in ${stats.totalMatches} matches
2. Which AI model performs best for ${teamName}?
   - Answer MUST include: ${topModelName} with ${topModelAccuracy}% accuracy
3. How accurate are AI predictions for ${teamName}?
   - Answer MUST include: specific accuracy percentages from top models
4. What is ${teamName}'s recent form?
   - Answer MUST include: ${formString} (interpret W/D/L)
5. How many AI models predict ${teamName} matches?
   - Answer MUST include: ${activeModelCount} active models

OPTIONAL (add 1-2 more):
6. What is ${teamName}'s home vs away record?
7. How many goals does ${teamName} score on average?

REQUIREMENTS:
- Each answer: 2-3 sentences, factual, data-driven
- Use EXACT numbers from data above (do NOT invent different statistics)
- Mention specific AI model names (${topModelName}, etc.)
- Plain text answers, no HTML
- Return valid JSON array with "question" and "answer" fields

Example format:
[
  {"question": "What is ${teamName}'s win-loss record?", "answer": "${teamName} has a record of ${stats.wins} wins, ${stats.draws} draws, and ${stats.losses} losses across ${stats.totalMatches} tracked matches."},
  ...
]`;

    // Generate content
    const result = await generateWithOpenRouter<FAQItem[]>(
      systemPrompt,
      userPrompt,
      0.7,
      2000
    );

    // Validate we got an array of FAQs
    if (!Array.isArray(result.content) || result.content.length === 0) {
      log.warn({ teamName, content: result.content }, 'FAQ generation returned invalid format');
      throw new Error('FAQ generation returned invalid format - will retry');
    }

    // Ensure max 7 FAQs and sanitize each field
    const faqs = result.content.slice(0, 7).map((faq: FAQItem) => ({
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
    await upsertTeamFAQs(teamName, faqs, {
      generatedBy: CONTENT_CONFIG.model,
      totalTokens: result.usage.totalTokens,
      totalCost: estimateContentCost(
        result.usage.promptTokens,
        result.usage.completionTokens
      ).toFixed(4),
    });

    log.info(
      {
        teamName,
        faqCount: faqs.length,
        tokens: result.usage.totalTokens,
        cost: result.cost.toFixed(4),
      },
      '✓ Team FAQs generated'
    );
  } catch (error) {
    log.error(
      {
        teamName,
        err: error instanceof Error ? error.message : String(error),
      },
      'Team FAQ generation failed'
    );

    throw new RetryableContentError(
      `Team FAQ generation failed for ${teamName}`,
      {
        matchId: 'N/A',
        homeTeam: teamName,
        awayTeam: 'N/A',
        contentType: 'faq',
        timestamp: new Date().toISOString(),
        originalError: error,
      }
    );
  }
}
