// Prompt templates for LLM score predictions
// Updated: January 2026 - Kicktipp Quota Scoring System

// ============================================================================
// SYSTEM PROMPT: Kicktipp Quota Scoring
// ============================================================================

export const SYSTEM_PROMPT = `You are competing in a football prediction competition using Kicktipp Quota Scoring.

SCORING RULES:
Your goal is to predict the exact final score of football matches. Points are awarded as follows:

1. TENDENCY POINTS (2-6 points): For correct match result (Home Win / Draw / Away Win)
   - The quota system rewards RARE correct predictions with MORE points
   - If most models predict the same result, those earn FEWER points (quota: 2)
   - If few models predict a result, those earn MORE points (quota: 6)
   - Formula: 30 ÷ (# models with same prediction), clamped to [2-6] range
   
2. GOAL DIFFERENCE BONUS (+1 point): Correct goal difference
   - Example: Predict 2-1, actual 3-2 → Both +1 difference → +1 bonus

3. EXACT SCORE BONUS (+3 points): Perfect score prediction
   - Example: Predict 2-1, actual 2-1 → +3 bonus

MAXIMUM: 10 points (6 tendency + 1 diff + 3 exact)

EXAMPLES:
- 30 models total, 25 predict Home Win (quota=2), 3 predict Draw (quota=6), 2 predict Away (quota=6)
- If match ends 2-1 (Home Win):
  * Predict 2-1: 2 (tendency) + 1 (diff) + 3 (exact) = 6 points
  * Predict 3-2: 2 (tendency) + 1 (diff) + 0 (not exact) = 3 points
  * Predict 1-0: 2 (tendency) + 0 (diff) + 0 (not exact) = 2 points
  * Predict 1-1: 0 points (wrong tendency)
- If match ends 1-1 (Draw):
  * Any model that predicted Draw gets 6 points (rare) + bonuses

STRATEGY:
- Focus on predicting the MOST LIKELY exact score
- Don't try to be contrarian - accuracy matters most
- The quota system automatically rewards unique correct predictions
- You won't know the quotas beforehand, so just be accurate

OUTPUT FORMAT:
Respond with ONLY valid JSON, no other text:
{"home_score": X, "away_score": Y}

Where X and Y are integers (0-9 typical range).`;

// ============================================================================
// BATCH SYSTEM PROMPT (for multiple matches)
// ============================================================================

export const BATCH_SYSTEM_PROMPT = `You are competing in a football prediction competition using Kicktipp Quota Scoring.

SCORING RULES:
Your goal is to predict the exact final score of football matches. Points are awarded as follows:

1. TENDENCY POINTS (2-6): Correct result (W/D/L) - rare predictions earn more
2. GOAL DIFFERENCE BONUS (+1): Correct goal difference
3. EXACT SCORE BONUS (+3): Perfect score prediction
MAXIMUM: 10 points

STRATEGY: Predict the most likely exact score. The quota system rewards rare correct predictions automatically.

OUTPUT FORMAT:
Respond with ONLY valid JSON array:
[
  {"match_id": "uuid1", "home_score": X, "away_score": Y},
  {"match_id": "uuid2", "home_score": X, "away_score": Y}
]`;

// ============================================================================
// USER PROMPT BUILDERS
// ============================================================================

export function createUserPrompt(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  matchDate: string
): string {
  return `Predict the exact final score for:

${homeTeam} vs ${awayTeam}
${competition}
${matchDate}

Respond with only JSON:`;
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

export interface ParsedPrediction {
  homeScore: number;
  awayScore: number;
  success: boolean;
  error?: string;
}

// Validate score is in reasonable range (0-10)
// Football scores in professional leagues rarely exceed 7-0
// Tighter validation prevents LLM hallucinations
function validateScore(score: number, label: string): { valid: boolean; error?: string } {
  if (isNaN(score)) {
    return { valid: false, error: `${label} is NaN` };
  }
  if (!Number.isInteger(score)) {
    return { valid: false, error: `${label} is not an integer: ${score}` };
  }
  if (score < 0 || score > 10) {
    return { valid: false, error: `${label} out of range (0-10): ${score}` };
  }
  return { valid: true };
}

export function parsePredictionResponse(response: string): ParsedPrediction {
  try {
    // Clean up the response
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags (in case any reasoning models slip through)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown code block markers
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Try to find JSON object with home_score/away_score
    const jsonPatterns = [
      /\{\s*"home_score"\s*:\s*\d+\s*,\s*"away_score"\s*:\s*\d+\s*\}/i,
      /\{\s*"away_score"\s*:\s*\d+\s*,\s*"home_score"\s*:\s*\d+\s*\}/i,
      /\{\s*"homeScore"\s*:\s*\d+\s*,\s*"awayScore"\s*:\s*\d+\s*\}/i,
      /\{\s*"awayScore"\s*:\s*\d+\s*,\s*"homeScore"\s*:\s*\d+\s*\}/i,
      /\{[^{}]*"home_?[sS]core"[^{}]*"away_?[sS]core"[^{}]*\}/i,
      /\{[^{}]*"away_?[sS]core"[^{}]*"home_?[sS]core"[^{}]*\}/i,
    ];

    let jsonMatch: RegExpMatchArray | null = null;
    for (const pattern of jsonPatterns) {
      jsonMatch = cleaned.match(pattern);
      if (jsonMatch) break;
    }

    // If no simple match found, try to parse the whole response
    if (!jsonMatch) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.home_score !== undefined && parsed.away_score !== undefined) {
          const homeScore = parseInt(String(parsed.home_score), 10);
          const awayScore = parseInt(String(parsed.away_score), 10);
          
          // Validate scores
          const homeValidation = validateScore(homeScore, 'home_score');
          if (!homeValidation.valid) {
            return { homeScore: 0, awayScore: 0, success: false, error: homeValidation.error };
          }
          const awayValidation = validateScore(awayScore, 'away_score');
          if (!awayValidation.valid) {
            return { homeScore: 0, awayScore: 0, success: false, error: awayValidation.error };
          }
          
          return { homeScore, awayScore, success: true };
        }
        if (parsed.homeScore !== undefined && parsed.awayScore !== undefined) {
          const homeScore = parseInt(String(parsed.homeScore), 10);
          const awayScore = parseInt(String(parsed.awayScore), 10);
          
          // Validate scores
          const homeValidation = validateScore(homeScore, 'homeScore');
          if (!homeValidation.valid) {
            return { homeScore: 0, awayScore: 0, success: false, error: homeValidation.error };
          }
          const awayValidation = validateScore(awayScore, 'awayScore');
          if (!awayValidation.valid) {
            return { homeScore: 0, awayScore: 0, success: false, error: awayValidation.error };
          }
          
          return { homeScore, awayScore, success: true };
        }
      } catch {
        // Continue to error handling
      }
    }

    // If we found a pattern match, parse it
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const homeScore = parseInt(String(parsed.home_score ?? parsed.homeScore), 10);
      const awayScore = parseInt(String(parsed.away_score ?? parsed.awayScore), 10);

      if (homeScore !== undefined && awayScore !== undefined) {
        // Validate scores
        const homeValidation = validateScore(homeScore, 'home_score');
        if (!homeValidation.valid) {
          return { homeScore: 0, awayScore: 0, success: false, error: homeValidation.error };
        }
        const awayValidation = validateScore(awayScore, 'away_score');
        if (!awayValidation.valid) {
          return { homeScore: 0, awayScore: 0, success: false, error: awayValidation.error };
        }
        
        return { homeScore, awayScore, success: true };
      }
    }

    return {
      homeScore: 0,
      awayScore: 0,
      success: false,
      error: 'Could not find valid score prediction in response',
    };
  } catch (error) {
    return {
      homeScore: 0,
      awayScore: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

// ============================================================================
// BATCH PREDICTION PARSING
// ============================================================================

export interface BatchPredictionItem {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface BatchParsedResult {
  predictions: BatchPredictionItem[];
  success: boolean;
  error?: string;
  failedMatchIds?: string[];
}

export function parseBatchPredictionResponse(
  response: string,
  expectedMatchIds: string[]
): BatchParsedResult {
  try {
    // Clean up response
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    let parsed: any;
    
    // Try to find JSON array first (preferred format)
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        parsed = JSON.parse(arrayMatch[0]);
        if (!Array.isArray(parsed)) {
          // Found brackets but not actually an array
          parsed = null;
        }
      } catch {
        // Array parsing failed, try fallbacks
        parsed = null;
      }
    }
    
    // Fallback 1: Try to find a JSON object (single prediction without array)
    if (!parsed) {
      // Look for object with score fields
      const objectPatterns = [
        /\{[^{}]*"home_?[sS]core"[^{}]*"away_?[sS]core"[^{}]*\}/i,
        /\{[^{}]*"away_?[sS]core"[^{}]*"home_?[sS]core"[^{}]*\}/i,
      ];
      
      for (const pattern of objectPatterns) {
        const objectMatch = cleaned.match(pattern);
        if (objectMatch) {
          try {
            const obj = JSON.parse(objectMatch[0]);
            // Wrap single object in array
            parsed = [obj];
            console.log('[Parser] Wrapped single object in array');
            break;
          } catch {
            // Continue to next pattern
          }
        }
      }
    }
    
    // Fallback 2: Try parsing entire cleaned response as JSON
    if (!parsed) {
      try {
        const maybeJson = JSON.parse(cleaned);
        if (Array.isArray(maybeJson)) {
          parsed = maybeJson;
        } else if (typeof maybeJson === 'object' && maybeJson !== null) {
          // Single object, wrap in array
          parsed = [maybeJson];
          console.log('[Parser] Wrapped parsed object in array');
        }
      } catch {
        // All parsing attempts failed
      }
    }
    
    // If all parsing failed, log preview and return error
    if (!parsed) {
      const preview = response.slice(0, 500);
      console.warn('[Parser] No valid JSON found. Response preview:', preview);
      return {
        predictions: [],
        success: false,
        error: `No valid JSON found in response (preview: ${preview.slice(0, 100)}...)`,
        failedMatchIds: expectedMatchIds,
      };
    }
    
    if (!Array.isArray(parsed)) {
      return {
        predictions: [],
        success: false,
        error: 'Response is not an array after all parsing attempts',
        failedMatchIds: expectedMatchIds,
      };
    }
    
    const predictions: BatchPredictionItem[] = [];
    const failedMatchIds: string[] = [];
    
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      
      // Try to extract match_id from various possible fields
      let matchId = item.match_id ?? item.matchId ?? item.id;
      
      // If no match_id provided and we have exactly 1 expected match, use that
      if (!matchId && expectedMatchIds.length === 1) {
        matchId = expectedMatchIds[0];
        console.log('[Parser] Using expected matchId for single-match prediction');
      }
      
      // Try various score field name variants
      const homeScore = item.home_score ?? item.homeScore ?? item.Home_Score ?? item.home;
      const awayScore = item.away_score ?? item.awayScore ?? item.Away_Score ?? item.away;
      
      if (!matchId || homeScore === undefined || awayScore === undefined) {
        console.warn('[Parser] Missing required fields:', { matchId, homeScore, awayScore, item });
        if (matchId) {
          failedMatchIds.push(String(matchId));
        } else if (expectedMatchIds.length === 1) {
          // Single match expected but couldn't parse - mark as failed
          failedMatchIds.push(expectedMatchIds[0]);
        }
        continue;
      }
      
      const homeParsed = parseInt(String(homeScore), 10);
      const awayParsed = parseInt(String(awayScore), 10);
      
      // Validate scores
      const homeValidation = validateScore(homeParsed, `home_score for match ${matchId}`);
      const awayValidation = validateScore(awayParsed, `away_score for match ${matchId}`);
      
      if (!homeValidation.valid || !awayValidation.valid) {
        console.warn(`[Batch Parse] Invalid score for match ${matchId}: ${homeValidation.error || awayValidation.error}`);
        failedMatchIds.push(String(matchId));
        continue;
      }
      
      predictions.push({
        matchId: String(matchId),
        homeScore: homeParsed,
        awayScore: awayParsed,
      });
    }
    
    // Check for missing matches
    for (const expectedId of expectedMatchIds) {
      if (!predictions.some(p => p.matchId === expectedId)) {
        failedMatchIds.push(expectedId);
      }
    }
    
    return {
      predictions,
      success: predictions.length > 0,
      error: predictions.length === 0 ? 'No valid predictions parsed' : undefined,
      failedMatchIds: failedMatchIds.length > 0 ? failedMatchIds : undefined,
    };
  } catch (error) {
    return {
      predictions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      failedMatchIds: expectedMatchIds,
    };
  }
}
