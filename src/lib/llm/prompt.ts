// Prompt templates for LLM predictions
// Keep prompts simple and focused for reliable JSON parsing

// ============================================================================
// SINGLE MATCH PREDICTION
// ============================================================================

export const SYSTEM_PROMPT = `You are a football betting analyst competing against 30 AI models.

BETTING RULES:
- You have a virtual balance starting at €1,000
- Each match: Place exactly 3 bets × €1 each = €3 total
- Payout = Stake × Odds (if won), €0 (if lost)
- Goal: Maximize profit through smart risk/reward decisions

BET TYPES (all required):
1. RESULT: Choose ONE of 1, X, 2, 1X, X2, or 12
   - 1 = Home win
   - X = Draw
   - 2 = Away win
   - 1X = Home win OR draw (safer, lower odds)
   - X2 = Away win OR draw (safer, lower odds)
   - 12 = Home win OR away win (no draw)

2. OVER/UNDER: Choose ONE line (e.g., O2.5, U1.5)
   - Pick the line and direction with best risk/reward
   - Available: O0.5, U0.5, O1.5, U1.5, O2.5, U2.5, O3.5, U3.5, O4.5, U4.5

3. BTTS (Both Teams To Score): Choose Yes or No
   - Yes = Both teams score at least 1 goal
   - No = At least one team scores 0

STRATEGY:
- Lower odds = safer bet but lower profit (e.g., O0.5 @1.05)
- Higher odds = riskier but higher profit (e.g., U0.5 @10.00)
- Balance risk across your 3 bets
- Consider match context: form, injuries, H2H, standings

OUTPUT: ONLY JSON {"result_bet": "...", "over_under_bet": "...", "btts_bet": "..."}
No explanations, no markdown.`;

export function createUserPrompt(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  matchDate: string
): string {
  return `Predict the final score for this football match:

Home Team: ${homeTeam}
Away Team: ${awayTeam}
Competition: ${competition}
Date: ${matchDate}

Consider team strength, recent form, and historical head-to-head when making your prediction.

Respond with ONLY the JSON prediction:`;
}

// Parse LLM response to extract score prediction
export interface ParsedPrediction {
  homeScore: number;
  awayScore: number;
  success: boolean;
  error?: string;
}

export function parsePredictionResponse(response: string): ParsedPrediction {
  try {
    // Clean up the response
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags (used by o1, DeepSeek R1, etc.)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown code block markers
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Try to find JSON object with home_score/away_score or homeScore/awayScore pattern
    // Look for the most specific pattern first (simple flat objects)
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

    // If no simple match found, try to parse all JSON objects in the response
    if (!jsonMatch) {
      // Use a balanced bracket approach to find valid JSON objects
      const jsonObjects = findJsonObjects(cleaned);
      for (const obj of jsonObjects) {
        try {
          const parsed = JSON.parse(obj);
          // Check if this object or any nested property has our scores
          const scores = findScoresInObject(parsed);
          if (scores) {
            return {
              homeScore: Math.max(0, Math.floor(scores.home)),
              awayScore: Math.max(0, Math.floor(scores.away)),
              success: true,
            };
          }
        } catch {
          // Continue to next match
        }
      }
    }

    if (!jsonMatch) {
      // Try to extract numbers directly as last resort
      // Look for patterns like "1-2", "1 - 2", "Home: 1, Away: 2"
      const scorePattern = /(\d+)\s*[-:]\s*(\d+)/;
      const scoreMatch = cleaned.match(scorePattern);
      if (scoreMatch) {
        const homeNum = parseInt(scoreMatch[1], 10);
        const awayNum = parseInt(scoreMatch[2], 10);
        // Reject if scores look like years (> 20)
        if (homeNum > 20 || awayNum > 20) {
          return {
            homeScore: 0,
            awayScore: 0,
            success: false,
            error: `Unrealistic scores detected: ${homeNum}-${awayNum}`,
          };
        }
        return {
          homeScore: homeNum,
          awayScore: awayNum,
          success: true,
        };
      }
      
      return {
        homeScore: 0,
        awayScore: 0,
        success: false,
        error: 'No JSON object found in response',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Handle different key formats
    const homeScore = parsed.home_score ?? parsed.homeScore ?? parsed.home ?? null;
    const awayScore = parsed.away_score ?? parsed.awayScore ?? parsed.away ?? null;

    // Validate the structure
    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
      // Try parsing as strings
      const homeNum = parseInt(String(homeScore), 10);
      const awayNum = parseInt(String(awayScore), 10);
      
      if (isNaN(homeNum) || isNaN(awayNum)) {
        return {
          homeScore: 0,
          awayScore: 0,
          success: false,
          error: 'Invalid score format - expected numbers',
        };
      }
      
      // Clamp to reasonable range (0-20 goals max)
      const clampedHome = Math.min(20, Math.max(0, homeNum));
      const clampedAway = Math.min(20, Math.max(0, awayNum));
      
      return {
        homeScore: clampedHome,
        awayScore: clampedAway,
        success: true,
      };
    }

    // Validate scores are non-negative integers, clamped to reasonable range
    const clampedHome = Math.min(20, Math.max(0, Math.floor(homeScore)));
    const clampedAway = Math.min(20, Math.max(0, Math.floor(awayScore)));
    
    return {
      homeScore: clampedHome,
      awayScore: clampedAway,
      success: true,
    };
  } catch (error) {
    return {
      homeScore: 0,
      awayScore: 0,
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Find all JSON objects in a string using balanced bracket matching
function findJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  
  return objects;
}

// Recursively search for score fields in an object
function findScoresInObject(obj: unknown): { home: number; away: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  
  const record = obj as Record<string, unknown>;
  
  // Check for direct score properties
  const homeScore = record['home_score'] ?? record['homeScore'] ?? record['home'];
  const awayScore = record['away_score'] ?? record['awayScore'] ?? record['away'];
  
  if (homeScore !== undefined && awayScore !== undefined) {
    const home = typeof homeScore === 'number' ? homeScore : parseInt(String(homeScore), 10);
    const away = typeof awayScore === 'number' ? awayScore : parseInt(String(awayScore), 10);
    if (!isNaN(home) && !isNaN(away)) {
      return { home, away };
    }
  }
  
  // Check nested objects (e.g., { prediction: { home_score: 1, away_score: 0 } })
  for (const key in record) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findScoresInObject(value);
      if (nested) return nested;
    }
  }
  
  return null;
}

// ============================================================================
// BATCH PREDICTION (Multiple Matches)
// ============================================================================

export const BATCH_SYSTEM_PROMPT = `You are a football betting analyst competing against 30 AI models.

BETTING RULES:
- Virtual balance: €1,000
- Each match: 3 bets × €1 = €3 wagered
- Payout = Stake × Odds (if won)
- Goal: Maximize profit

BET TYPES (all required per match):
1. RESULT: 1, X, 2, 1X, X2, or 12
2. OVER/UNDER: O0.5, U0.5, O1.5, U1.5, O2.5, U2.5, O3.5, U3.5, O4.5, U4.5
3. BTTS: Yes or No

STRATEGY: Balance risk/reward based on odds and match context.

OUTPUT: JSON ARRAY for ALL matches:
[{"match_id": "id", "result_bet": "...", "over_under_bet": "...", "btts_bet": "..."}, ...]
- match_id must EXACTLY match provided IDs
- No explanations, no markdown`;

// Batch prediction result for a single match
export interface BatchPredictionItem {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

// Full batch prediction result
export interface BatchParsedResult {
  predictions: BatchPredictionItem[];
  success: boolean;
  error?: string;
  failedMatchIds?: string[];
}

// Parse batch prediction response - expects JSON array
export function parseBatchPredictionResponse(
  response: string,
  expectedMatchIds: string[]
): BatchParsedResult {
  try {
    // Clean up the response
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown code block markers
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Find JSON array in response
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return {
        predictions: [],
        success: false,
        error: 'No JSON array found in response',
        failedMatchIds: expectedMatchIds,
      };
    }
    
    const parsed = JSON.parse(arrayMatch[0]);
    
    if (!Array.isArray(parsed)) {
      return {
        predictions: [],
        success: false,
        error: 'Parsed result is not an array',
        failedMatchIds: expectedMatchIds,
      };
    }
    
    const predictions: BatchPredictionItem[] = [];
    const foundMatchIds = new Set<string>();
    
    for (const item of parsed) {
      // Extract match ID (support various formats)
      const matchId = item.match_id ?? item.matchId ?? item.id ?? item.fixture_id ?? item.fixtureId;
      if (!matchId) continue;
      
      const matchIdStr = String(matchId);
      
      // Extract scores
      const homeScore = item.home_score ?? item.homeScore ?? item.home;
      const awayScore = item.away_score ?? item.awayScore ?? item.away;
      
      if (homeScore === undefined || awayScore === undefined) continue;
      
      const homeNum = typeof homeScore === 'number' ? homeScore : parseInt(String(homeScore), 10);
      const awayNum = typeof awayScore === 'number' ? awayScore : parseInt(String(awayScore), 10);
      
      if (isNaN(homeNum) || isNaN(awayNum)) continue;
      
      // Reject unrealistic scores
      if (homeNum > 20 || awayNum > 20 || homeNum < 0 || awayNum < 0) continue;
      
      predictions.push({
        matchId: matchIdStr,
        homeScore: Math.floor(homeNum),
        awayScore: Math.floor(awayNum),
      });
      foundMatchIds.add(matchIdStr);
    }
    
    // Find missing match IDs
    const failedMatchIds = expectedMatchIds.filter(id => !foundMatchIds.has(id));
    
    return {
      predictions,
      success: predictions.length > 0,
      error: failedMatchIds.length > 0 
        ? `Missing predictions for ${failedMatchIds.length} matches` 
        : undefined,
      failedMatchIds: failedMatchIds.length > 0 ? failedMatchIds : undefined,
    };
  } catch (error) {
    return {
      predictions: [],
      success: false,
      error: `Failed to parse batch JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      failedMatchIds: expectedMatchIds,
    };
  }
}

// ============================================================================
// BETTING SYSTEM (NEW)
// ============================================================================

// Single match betting response
export interface ParsedBets {
  resultBet: string; // '1' | '2' | '1X' | 'X2'
  overUnderBet: string; // 'O2.5' | 'U1.5' etc.
  bttsBet: string; // 'Yes' | 'No'
  success: boolean;
  error?: string;
}

// Parse single match betting response
export function parseBettingResponse(response: string): ParsedBets {
  try {
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Find JSON object
    const jsonMatch = cleaned.match(/\{[^{}]*\}/);
    if (!jsonMatch) {
      return {
        resultBet: '',
        overUnderBet: '',
        bttsBet: '',
        success: false,
        error: 'No JSON object found in response',
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const resultBet = parsed.result_bet ?? parsed.resultBet ?? parsed.result;
    const overUnderBet = parsed.over_under_bet ?? parsed.overUnderBet ?? parsed.over_under;
    const bttsBet = parsed.btts_bet ?? parsed.bttsBet ?? parsed.btts;
    
    if (!resultBet || !overUnderBet || !bttsBet) {
      return {
        resultBet: String(resultBet || ''),
        overUnderBet: String(overUnderBet || ''),
        bttsBet: String(bttsBet || ''),
        success: false,
        error: 'Missing required bet fields',
      };
    }
    
    // Normalize over/under format
    const normalizedOU = normalizeOverUnder(String(overUnderBet));
    
    return {
      resultBet: String(resultBet),
      overUnderBet: normalizedOU,
      bttsBet: String(bttsBet),
      success: true,
    };
  } catch (error) {
    return {
      resultBet: '',
      overUnderBet: '',
      bttsBet: '',
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Batch betting item
export interface BatchBettingItem {
  matchId: string;
  resultBet: string;
  overUnderBet: string;
  bttsBet: string;
}

// Batch betting result
export interface BatchBettingResult {
  bets: BatchBettingItem[];
  success: boolean;
  error?: string;
  failedMatchIds?: string[];
}

// Parse batch betting response
export function parseBatchBettingResponse(
  response: string,
  expectedMatchIds: string[]
): BatchBettingResult {
  try {
    let cleaned = response.trim();
    
    // Remove thinking/reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // Remove markdown
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Find JSON array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return {
        bets: [],
        success: false,
        error: 'No JSON array found in response',
        failedMatchIds: expectedMatchIds,
      };
    }
    
    const parsed = JSON.parse(arrayMatch[0]);
    
    if (!Array.isArray(parsed)) {
      return {
        bets: [],
        success: false,
        error: 'Parsed result is not an array',
        failedMatchIds: expectedMatchIds,
      };
    }
    
    const bets: BatchBettingItem[] = [];
    const foundMatchIds = new Set<string>();
    const rawMatchIds: string[] = []; // For debug logging
    
    for (const item of parsed) {
      const matchId = item.match_id ?? item.matchId ?? item.id;
      if (!matchId) continue;
      
      let matchIdStr = String(matchId);
      rawMatchIds.push(matchIdStr); // Track what models are returning
      
      const resultBet = item.result_bet ?? item.resultBet ?? item.result;
      const overUnderBet = item.over_under_bet ?? item.overUnderBet ?? item.over_under;
      const bttsBet = item.btts_bet ?? item.bttsBet ?? item.btts;
      
      if (!resultBet || !overUnderBet || !bttsBet) continue;
      
      // Try exact match first
      let matchedId = matchIdStr;
      if (expectedMatchIds.includes(matchIdStr)) {
        foundMatchIds.add(matchIdStr);
      } else {
        // Try flexible matching for truncated UUIDs or partial matches
        const partialMatch = expectedMatchIds.find(expected => 
          expected.startsWith(matchIdStr) || // Model returned truncated UUID
          matchIdStr.startsWith(expected) || // Model returned longer version
          expected.includes(matchIdStr) ||   // Model returned substring
          matchIdStr.includes(expected)      // Expected is substring of returned
        );
        
        if (partialMatch) {
          matchedId = partialMatch;
          foundMatchIds.add(partialMatch);
        }
      }
      
      bets.push({
        matchId: matchedId,
        resultBet: String(resultBet),
        overUnderBet: normalizeOverUnder(String(overUnderBet)),
        bttsBet: String(bttsBet),
      });
    }
    
    // SINGLE-MATCH FALLBACK: If we only expected 1 match and got 1+ bet(s), assume first bet is for that match
    if (expectedMatchIds.length === 1 && bets.length > 0 && !foundMatchIds.has(expectedMatchIds[0])) {
      console.log(`[Parse] Single-match fallback: Assigning bet to ${expectedMatchIds[0]} (model returned: ${rawMatchIds[0]})`);
      bets[0].matchId = expectedMatchIds[0];
      foundMatchIds.add(expectedMatchIds[0]);
    }
    
    const failedMatchIds = expectedMatchIds.filter(id => !foundMatchIds.has(id));
    
    // Debug logging when matches are missing
    if (failedMatchIds.length > 0) {
      console.log(`[Parse] Expected match IDs: ${expectedMatchIds.join(', ')}`);
      console.log(`[Parse] Model returned IDs: ${rawMatchIds.join(', ')}`);
      console.log(`[Parse] Successfully matched: ${Array.from(foundMatchIds).join(', ')}`);
      console.log(`[Parse] Missing matches: ${failedMatchIds.join(', ')}`);
    }
    
    return {
      bets,
      success: bets.length > 0,
      error: failedMatchIds.length > 0 
        ? `Missing bets for ${failedMatchIds.length} matches` 
        : undefined,
      failedMatchIds: failedMatchIds.length > 0 ? failedMatchIds : undefined,
    };
  } catch (error) {
    return {
      bets: [],
      success: false,
      error: `Failed to parse batch JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      failedMatchIds: expectedMatchIds,
    };
  }
}

// Normalize over/under format to short form (O2.5, U1.5)
function normalizeOverUnder(input: string): string {
  const normalized = input.trim().toUpperCase();
  
  // "Over 2.5" → "O2.5"
  if (normalized.startsWith('OVER ')) {
    return 'O' + normalized.replace('OVER ', '');
  }
  // "Under 2.5" → "U2.5"
  if (normalized.startsWith('UNDER ')) {
    return 'U' + normalized.replace('UNDER ', '');
  }
  // Already in short form
  return normalized;
}
