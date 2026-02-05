/**
 * Prediction Schema Tests
 * Quick validation that schemas work correctly
 */
import { describe, test, expect } from 'vitest';
import {
  PredictionOutputSchema,
  BatchPredictionSchema,
  validatePrediction,
  validateBatchPrediction,
} from './prediction';
import { TEST_MATCH_ID } from '../fixtures/test-data';

describe('PredictionOutputSchema', () => {
  test('validates correct prediction structure', () => {
    const valid = {
      match_id: TEST_MATCH_ID,
      home_score: 2,
      away_score: 1,
    };
    const result = PredictionOutputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test('rejects missing fields', () => {
    const invalid = { match_id: TEST_MATCH_ID };
    const result = PredictionOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects negative scores', () => {
    const invalid = {
      match_id: TEST_MATCH_ID,
      home_score: -1,
      away_score: 0,
    };
    const result = PredictionOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('BatchPredictionSchema', () => {
  test('validates array of predictions', () => {
    const valid = [
      { match_id: 'match-1', home_score: 1, away_score: 1 },
      { match_id: 'match-2', home_score: 3, away_score: 0 },
    ];
    const result = BatchPredictionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('validatePrediction helper', () => {
  test('returns success with data for valid input', () => {
    const result = validatePrediction({
      match_id: TEST_MATCH_ID,
      home_score: 2,
      away_score: 2,
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('returns issues for invalid input', () => {
    const result = validatePrediction({ invalid: true });
    expect(result.success).toBe(false);
    expect(result.issues).toBeDefined();
    expect(result.issues!.length).toBeGreaterThan(0);
  });
});

describe('validateBatchPrediction helper', () => {
  test('validates batch input', () => {
    const result = validateBatchPrediction([
      { match_id: 'a', home_score: 0, away_score: 0 },
    ]);
    expect(result.success).toBe(true);
  });
});
