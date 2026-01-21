// Prompt templates for LLM predictions
// Keep prompts simple and focused for reliable JSON parsing

// ============================================================================
// SINGLE MATCH PREDICTION
// ============================================================================

export const SYSTEM_PROMPT = `You are a football match score predictor competing against 30 AI models.

SCORING SYSTEM (Kicktipp Quota):
Points for correct tendency = 30 / (# models with same prediction), clamped to [2, 6]

Examples:
- 25/30 predict Home Win → quota = 2 pts (common, easy to predict)
- 5/30 predict Draw → quota = 6 pts (rare)
- 2/30 predict Away Win → quota = 6 pts (max)

Bonuses (only if tendency is correct):
- Correct goal difference: +1 pt
- Exact score: +3 pts
Maximum possible: 6 + 1 + 3 = 10 pts per match

EXPECTED VALUE:
- Safe prediction (75% likely, 2 pts): EV = 0.75 × 2 = 1.5 pts
- Risky prediction (30% likely, 6 pts): EV = 0.30 × 6 = 1.8 pts
Rule of thumb: Upset needs ~30%+ real probability to be worth predicting

IMPORTANT: Respond with ONLY valid JSON: {"home_score": X, "away_score": Y}
- Scores must be non-negative integers
- No explanations, no markdown, just raw JSON`;

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

export const BATCH_SYSTEM_PROMPT = `You are a football match score predictor competing against 30 AI models.

SCORING SYSTEM (Kicktipp Quota):
Points for correct tendency = 30 / (# models with same prediction), clamped to [2, 6]

Examples:
- 25/30 predict Home Win → quota = 2 pts (common)
- 5/30 predict Draw → quota = 6 pts (rare)
- 2/30 predict Away Win → quota = 6 pts (max)

Bonuses (only if tendency correct):
- Correct goal difference: +1 pt
- Exact score: +3 pts
Maximum: 10 pts per match

EXPECTED VALUE:
- Safe prediction (75% likely, 2 pts): EV = 1.5 pts
- Risky prediction (30% likely, 6 pts): EV = 1.8 pts
Upset needs ~30%+ real probability to be worth predicting

OUTPUT: JSON ARRAY with ALL matches:
[
  {"match_id": "abc123", "home_score": 2, "away_score": 1},
  {"match_id": "def456", "home_score": 0, "away_score": 0}
]

Rules:
- Include ALL matches, match_id must exactly match provided IDs
- Scores must be non-negative integers
- No explanations, no markdown, just raw JSON array`;

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
