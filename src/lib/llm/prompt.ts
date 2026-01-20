// Prompt templates for LLM predictions
// Keep prompts simple and focused for reliable JSON parsing

export const SYSTEM_PROMPT = `You are a football match score predictor. Your task is to predict the final score of a football match.

IMPORTANT: You must respond with ONLY valid JSON in this exact format:
{"home_score": <integer>, "away_score": <integer>}

Rules:
- home_score and away_score must be non-negative integers (0 or higher)
- Do not include any other text, explanation, or markdown formatting
- Do not wrap the JSON in code blocks
- Just output the raw JSON object`;

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
        return {
          homeScore: parseInt(scoreMatch[1], 10),
          awayScore: parseInt(scoreMatch[2], 10),
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
      
      return {
        homeScore: Math.max(0, homeNum),
        awayScore: Math.max(0, awayNum),
        success: true,
      };
    }

    // Validate scores are non-negative integers
    return {
      homeScore: Math.max(0, Math.floor(homeScore)),
      awayScore: Math.max(0, Math.floor(awayScore)),
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
