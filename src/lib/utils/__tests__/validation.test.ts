import { isValidScore, isValidScorePair, validatePrediction, ValidatedPrediction } from '../validation';

describe('isValidScore', () => {
  it('accepts valid scores', () => {
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(10)).toBe(true);
    expect(isValidScore(20)).toBe(true);
  });

  it('rejects negative scores', () => {
    expect(isValidScore(-1)).toBe(false);
    expect(isValidScore(-10)).toBe(false);
    expect(isValidScore(-100)).toBe(false);
  });

  it('rejects scores > 20', () => {
    expect(isValidScore(21)).toBe(false);
    expect(isValidScore(25)).toBe(false);
    expect(isValidScore(100)).toBe(false);
  });

  it('rejects non-integer scores', () => {
    expect(isValidScore(1.5)).toBe(false);
    expect(isValidScore(10.5)).toBe(false);
    expect(isValidScore(20.1)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidScore(NaN)).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isValidScore(null)).toBe(false);
    expect(isValidScore(undefined)).toBe(false);
  });

  it('rejects string numbers', () => {
    expect(isValidScore('1')).toBe(false);
    expect(isValidScore('0')).toBe(false);
    expect(isValidScore('10')).toBe(false);
  });

  it('rejects other types', () => {
    expect(isValidScore(true)).toBe(false);
    expect(isValidScore(false)).toBe(false);
    expect(isValidScore({})).toBe(false);
    expect(isValidScore([])).toBe(false);
  });
});

describe('isValidScorePair', () => {
  it('accepts valid score pairs (snake_case)', () => {
    expect(isValidScorePair({ home_score: 1, away_score: 2 })).toBe(true);
    expect(isValidScorePair({ home_score: 0, away_score: 20 })).toBe(true);
    expect(isValidScorePair({ home_score: 5, away_score: 5 })).toBe(true);
  });

  it('accepts valid score pairs (camelCase)', () => {
    expect(isValidScorePair({ homeScore: 1, awayScore: 2 })).toBe(true);
    expect(isValidScorePair({ homeScore: 0, awayScore: 20 })).toBe(true);
  });

  it('accepts mixed case patterns', () => {
    expect(isValidScorePair({ homeScore: 1, away_score: 2 })).toBe(true);
    expect(isValidScorePair({ home_score: 1, awayScore: 2 })).toBe(true);
  });

  it('rejects invalid score pairs with negative scores', () => {
    expect(isValidScorePair({ home_score: -1, away_score: 2 })).toBe(false);
    expect(isValidScorePair({ home_score: 1, away_score: -2 })).toBe(false);
    expect(isValidScorePair({ homeScore: -1, away_score: -2 })).toBe(false);
  });

  it('rejects invalid score pairs with scores > 20', () => {
    expect(isValidScorePair({ home_score: 21, away_score: 2 })).toBe(false);
    expect(isValidScorePair({ home_score: 1, away_score: 25 })).toBe(false);
  });

  it('rejects score pairs with missing scores', () => {
    expect(isValidScorePair({ home_score: 1 })).toBe(false);
    expect(isValidScorePair({ away_score: 2 })).toBe(false);
    expect(isValidScorePair({})).toBe(false);
  });

  it('rejects score pairs with undefined scores', () => {
    expect(isValidScorePair({ home_score: undefined, away_score: 2 })).toBe(false);
    expect(isValidScorePair({ home_score: 1, away_score: undefined })).toBe(false);
  });

  it('rejects score pairs with null scores', () => {
    expect(isValidScorePair({ home_score: null, away_score: 2 })).toBe(false);
    expect(isValidScorePair({ home_score: 1, away_score: null })).toBe(false);
  });

  it('rejects non-integer scores', () => {
    expect(isValidScorePair({ home_score: 1.5, away_score: 2 })).toBe(false);
    expect(isValidScorePair({ home_score: 1, away_score: 2.5 })).toBe(false);
  });
});

describe('validatePrediction', () => {
  it('validates correct prediction objects (snake_case)', () => {
    const result = validatePrediction({ home_score: 1, away_score: 2 });
    expect(result).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it('validates correct prediction objects (camelCase)', () => {
    const result = validatePrediction({ homeScore: 3, awayScore: 0 });
    expect(result).toEqual({ homeScore: 3, awayScore: 0 });
  });

  it('handles multiple field name patterns (home/away)', () => {
    const result = validatePrediction({ home: 1, away: 2 });
    expect(result).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it('handles mixed field name patterns', () => {
    expect(validatePrediction({ home: 1, away_score: 2 })).toEqual({ homeScore: 1, awayScore: 2 });
    expect(validatePrediction({ home_score: 1, away: 2 })).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it('prioritizes snake_case over camelCase', () => {
    const result = validatePrediction({ home_score: 1, homeScore: 99, away_score: 2, awayScore: 99 });
    expect(result).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it('prioritizes camelCase over short form', () => {
    const result = validatePrediction({ homeScore: 1, home: 99, awayScore: 2, away: 99 });
    expect(result).toEqual({ homeScore: 1, awayScore: 2 });
  });

  it('rejects invalid inputs (null)', () => {
    expect(validatePrediction(null)).toBe(null);
  });

  it('rejects invalid inputs (undefined)', () => {
    expect(validatePrediction(undefined)).toBe(null);
  });

  it('rejects non-object inputs', () => {
    expect(validatePrediction('string')).toBe(null);
    expect(validatePrediction(123)).toBe(null);
    expect(validatePrediction(true)).toBe(null);
    expect(validatePrediction([])).toBe(null);
  });

  it('rejects prediction with negative home score', () => {
    expect(validatePrediction({ home_score: -1, away_score: 2 })).toBe(null);
    expect(validatePrediction({ home: -1, away: 2 })).toBe(null);
  });

  it('rejects prediction with negative away score', () => {
    expect(validatePrediction({ home_score: 1, away_score: -2 })).toBe(null);
    expect(validatePrediction({ home: 1, away: -2 })).toBe(null);
  });

  it('rejects prediction with scores > 20', () => {
    expect(validatePrediction({ home_score: 21, away_score: 2 })).toBe(null);
    expect(validatePrediction({ home_score: 1, away_score: 25 })).toBe(null);
  });

  it('rejects prediction with non-integer scores', () => {
    expect(validatePrediction({ home_score: 1.5, away_score: 2 })).toBe(null);
    expect(validatePrediction({ home_score: 1, away_score: 2.5 })).toBe(null);
  });

  it('rejects empty object', () => {
    expect(validatePrediction({})).toBe(null);
  });

  it('rejects prediction with missing home score', () => {
    expect(validatePrediction({ away_score: 2 })).toBe(null);
    expect(validatePrediction({ away: 2 })).toBe(null);
  });

  it('rejects prediction with missing away score', () => {
    expect(validatePrediction({ home_score: 1 })).toBe(null);
    expect(validatePrediction({ home: 1 })).toBe(null);
  });

  it('handles edge case: 0-0 score', () => {
    const result = validatePrediction({ home: 0, away: 0 });
    expect(result).toEqual({ homeScore: 0, awayScore: 0 });
  });

  it('handles high score: 20-20 (maximum valid)', () => {
    const result = validatePrediction({ homeScore: 20, awayScore: 20 });
    expect(result).toEqual({ homeScore: 20, awayScore: 20 });
  });

  it('rejects NaN scores', () => {
    expect(validatePrediction({ home_score: NaN, away_score: 2 })).toBe(null);
    expect(validatePrediction({ home_score: 1, away_score: NaN })).toBe(null);
  });
});
