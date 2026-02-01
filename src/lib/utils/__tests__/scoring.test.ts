import { describe, test, expect } from 'vitest';
import { calculateQuotas } from '../scoring';

describe('calculateQuotas - Kicktipp formula', () => {
  test('returns MIN_QUOTA for all tendencies when empty', () => {
    const result = calculateQuotas([]);
    expect(result).toEqual({ home: 2, draw: 2, away: 2 });
  });

  test('returns MAX_QUOTA for unpredicted outcomes', () => {
    // All 10 predictions are home wins - draw and away get max quota
    const predictions = Array(10).fill({ predictedHome: 2, predictedAway: 1 });
    const result = calculateQuotas(predictions);

    expect(result.home).toBe(2); // All predicted home = low quota
    expect(result.draw).toBe(6); // None predicted draw = max quota
    expect(result.away).toBe(6); // None predicted away = max quota
  });

  test('evenly distributed predictions get mid-range quotas', () => {
    // 10 home, 10 draw, 10 away = 33% each
    const predictions = [
      ...Array(10).fill({ predictedHome: 2, predictedAway: 1 }), // Home wins
      ...Array(10).fill({ predictedHome: 1, predictedAway: 1 }), // Draws
      ...Array(10).fill({ predictedHome: 1, predictedAway: 2 }), // Away wins
    ];
    const result = calculateQuotas(predictions);

    // With P = 0.33, rawQuota = (6 / (10 * 0.33)) - (6/10) + 2 = 1.82 - 0.6 + 2 = 3.22
    // Clamped and rounded = 3
    expect(result.home).toBe(3);
    expect(result.draw).toBe(3);
    expect(result.away).toBe(3);
  });

  test('rare predictions get higher quotas', () => {
    // 28 home, 1 draw, 1 away
    const predictions = [
      ...Array(28).fill({ predictedHome: 2, predictedAway: 1 }), // Home wins
      { predictedHome: 1, predictedAway: 1 }, // 1 draw
      { predictedHome: 1, predictedAway: 2 }, // 1 away
    ];
    const result = calculateQuotas(predictions);

    // Home: P = 28/30 = 0.93, quota = (6 / (10 * 0.93)) - 0.6 + 2 = 0.65 - 0.6 + 2 = 2.05 -> 2
    expect(result.home).toBe(2);
    // Draw/Away: P = 1/30 = 0.033, quota = (6 / (10 * 0.033)) - 0.6 + 2 = 18.18 - 0.6 + 2 = 19.58 -> clamped to 6
    expect(result.draw).toBe(6);
    expect(result.away).toBe(6);
  });

  test('quotas are always between MIN (2) and MAX (6)', () => {
    // Test with various distributions
    const distributions = [
      Array(35).fill({ predictedHome: 2, predictedAway: 1 }), // All home
      Array(1).fill({ predictedHome: 2, predictedAway: 1 }),  // Single prediction
      [
        ...Array(20).fill({ predictedHome: 2, predictedAway: 1 }),
        ...Array(10).fill({ predictedHome: 1, predictedAway: 1 }),
        ...Array(5).fill({ predictedHome: 1, predictedAway: 2 }),
      ],
    ];

    for (const predictions of distributions) {
      const result = calculateQuotas(predictions);
      expect(result.home).toBeGreaterThanOrEqual(2);
      expect(result.home).toBeLessThanOrEqual(6);
      expect(result.draw).toBeGreaterThanOrEqual(2);
      expect(result.draw).toBeLessThanOrEqual(6);
      expect(result.away).toBeGreaterThanOrEqual(2);
      expect(result.away).toBeLessThanOrEqual(6);
    }
  });
});
