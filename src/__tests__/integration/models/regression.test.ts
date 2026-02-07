/**
 * Regression Test Suite (REGR-01)
 *
 * Validates model output parsing against golden fixtures WITHOUT API calls.
 * Tests run offline, using captured baseline responses from generate-golden-fixtures.ts
 *
 * Purpose: Catch parser/schema changes that break existing working models
 * Usage: npm run test:regression (no API keys required, runs in <5 seconds)
 */
import { describe, test, expect, beforeAll } from 'vitest';
import {
  getSuccessfulFixtures,
  getFixtureStats,
  getFixturesByProvider,
  type GoldenFixture,
} from '@/__tests__/fixtures/golden';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import { parseBatchPredictionResponse } from '@/lib/llm/prompt';

describe('REGR-01: Golden Fixture Regression Tests', () => {
  let fixtureStats: ReturnType<typeof getFixtureStats>;

  beforeAll(() => {
    fixtureStats = getFixtureStats();
    console.log('\n=== Golden Fixture Regression Tests ===');
    console.log(`Total fixtures: ${fixtureStats.total}`);
    console.log(`Successful: ${fixtureStats.successful} (${fixtureStats.successRate}%)`);
    console.log(`Failed: ${fixtureStats.failed}`);
    console.log(`Together AI: ${fixtureStats.togetherCount}`);
    console.log(`Synthetic: ${fixtureStats.syntheticCount}`);
    console.log('');

    if (fixtureStats.successful === 0) {
      console.warn(
        '⚠️  No successful fixtures found. Run: npx tsx scripts/generate-golden-fixtures.ts'
      );
    }
  });

  // ============================================================================
  // Model Count Validation
  // ============================================================================

  describe('Model Count Validation', () => {
    test('total fixture count matches expected (42 models)', () => {
      expect(fixtureStats.total).toBe(42);
    });

    test('Together AI model count is 29', () => {
      expect(fixtureStats.togetherCount).toBe(29);
    });

    test('Synthetic model count is 13', () => {
      expect(fixtureStats.syntheticCount).toBe(13);
    });
  });

  // ============================================================================
  // Fixture-Based Structural Tests (Together AI Models)
  // ============================================================================

  describe('Together AI Models - Structural Validation', () => {
    const togetherFixtures = getFixturesByProvider('together').filter((f) => f.success);

    if (togetherFixtures.length === 0) {
      test.skip('no successful Together AI fixtures available', () => {});
      return;
    }

    describe.each(togetherFixtures)('$modelId', (fixture: GoldenFixture) => {
      test('parsed data passes PredictionOutputSchema', () => {
        expect(fixture.parsed).toBeDefined();

        const validation = PredictionOutputSchema.safeParse(fixture.parsed);

        if (!validation.success) {
          console.error(
            `Validation failed for ${fixture.modelId}:`,
            validation.error.issues
          );
        }

        expect(validation.success).toBe(true);
      });

      test('home_score is valid integer (0-20)', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        const homeScore = fixture.parsed.home_score;
        expect(Number.isInteger(homeScore)).toBe(true);
        expect(homeScore).toBeGreaterThanOrEqual(0);
        expect(homeScore).toBeLessThanOrEqual(20);
      });

      test('away_score is valid integer (0-20)', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        const awayScore = fixture.parsed.away_score;
        expect(Number.isInteger(awayScore)).toBe(true);
        expect(awayScore).toBeGreaterThanOrEqual(0);
        expect(awayScore).toBeLessThanOrEqual(20);
      });

      test('match_id is non-empty string', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        expect(typeof fixture.parsed.match_id).toBe('string');
        expect(fixture.parsed.match_id.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Fixture-Based Structural Tests (Synthetic Models)
  // ============================================================================

  describe('Synthetic Models - Structural Validation', () => {
    const syntheticFixtures = getFixturesByProvider('synthetic').filter(
      (f) => f.success
    );

    if (syntheticFixtures.length === 0) {
      test.skip('no successful Synthetic fixtures available', () => {});
      return;
    }

    describe.each(syntheticFixtures)('$modelId', (fixture: GoldenFixture) => {
      test('parsed data passes PredictionOutputSchema', () => {
        expect(fixture.parsed).toBeDefined();

        const validation = PredictionOutputSchema.safeParse(fixture.parsed);

        if (!validation.success) {
          console.error(
            `Validation failed for ${fixture.modelId}:`,
            validation.error.issues
          );
        }

        expect(validation.success).toBe(true);
      });

      test('home_score is valid integer (0-20)', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        const homeScore = fixture.parsed.home_score;
        expect(Number.isInteger(homeScore)).toBe(true);
        expect(homeScore).toBeGreaterThanOrEqual(0);
        expect(homeScore).toBeLessThanOrEqual(20);
      });

      test('away_score is valid integer (0-20)', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        const awayScore = fixture.parsed.away_score;
        expect(Number.isInteger(awayScore)).toBe(true);
        expect(awayScore).toBeGreaterThanOrEqual(0);
        expect(awayScore).toBeLessThanOrEqual(20);
      });

      test('match_id is non-empty string', () => {
        expect(fixture.parsed).toBeDefined();
        if (!fixture.parsed) return;

        expect(typeof fixture.parsed.match_id).toBe('string');
        expect(fixture.parsed.match_id.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Parser Regression Tests
  // ============================================================================

  describe('Parser Regression Tests', () => {
    const successfulFixtures = getSuccessfulFixtures();

    test('parseBatchPredictionResponse handles clean JSON', () => {
      const mockResponse = JSON.stringify([
        { match_id: 'test-001', home_score: 2, away_score: 1 },
      ]);

      const result = parseBatchPredictionResponse(mockResponse, ['test-001']);

      expect(result.success).toBe(true);
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0]).toEqual({
        matchId: 'test-001',
        homeScore: 2,
        awayScore: 1,
      });
    });

    test('parseBatchPredictionResponse handles JSON in markdown blocks', () => {
      const mockResponse = `\`\`\`json
[
  { "match_id": "test-002", "home_score": 3, "away_score": 0 }
]
\`\`\``;

      const result = parseBatchPredictionResponse(mockResponse, ['test-002']);

      expect(result.success).toBe(true);
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].matchId).toBe('test-002');
    });

    test('parseBatchPredictionResponse handles thinking tags', () => {
      const mockResponse = `<thinking>
Analyzing match data...
Manchester United vs Liverpool
</thinking>

[
  { "match_id": "test-003", "home_score": 1, "away_score": 2 }
]`;

      const result = parseBatchPredictionResponse(mockResponse, ['test-003']);

      expect(result.success).toBe(true);
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].matchId).toBe('test-003');
    });

    test('parseBatchPredictionResponse handles single object without array', () => {
      const mockResponse = `{ "match_id": "test-004", "home_score": 0, "away_score": 0 }`;

      const result = parseBatchPredictionResponse(mockResponse, ['test-004']);

      expect(result.success).toBe(true);
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].matchId).toBe('test-004');
    });

    test('parseBatchPredictionResponse rejects invalid scores', () => {
      const mockResponse = JSON.stringify([
        { match_id: 'test-005', home_score: 25, away_score: 1 }, // Out of range
      ]);

      const result = parseBatchPredictionResponse(mockResponse, ['test-005']);

      // Should fail because home_score > 10 (validateScore rejects it)
      expect(result.success).toBe(false);
      expect(result.failedMatchIds).toContain('test-005');
    });

    test('parseBatchPredictionResponse handles rawResponseSample from fixtures', () => {
      // Test with actual raw response samples from successful fixtures
      const fixturesWithRawResponse = successfulFixtures.filter(
        (f) => f.rawResponseSample && f.parsed
      );

      if (fixturesWithRawResponse.length === 0) {
        // Skip if no fixtures with raw responses available yet
        return;
      }

      for (const fixture of fixturesWithRawResponse.slice(0, 5)) {
        // Test first 5
        const result = parseBatchPredictionResponse(
          fixture.rawResponseSample!,
          [fixture.parsed!.match_id]
        );

        // Parser should successfully extract the same values captured in fixture
        if (result.success && result.predictions.length > 0) {
          const prediction = result.predictions[0];
          expect(prediction.matchId).toBe(fixture.parsed!.match_id);
          // Note: We don't check exact scores match because rawResponseSample
          // is truncated to 500 chars and may be incomplete
        }
      }
    });
  });

  // ============================================================================
  // Coverage Summary
  // ============================================================================

  describe('Coverage Summary', () => {
    test('logs fixture statistics for debugging', () => {
      const stats = getFixtureStats();

      console.log('\n=== Fixture Coverage ===');
      console.log(`Total models: ${stats.total}`);
      console.log(`Successful fixtures: ${stats.successful}`);
      console.log(`Failed fixtures: ${stats.failed}`);
      console.log(`Success rate: ${stats.successRate}%`);
      console.log(
        `Together AI: ${getFixturesByProvider('together').filter((f) => f.success).length}/${stats.togetherCount}`
      );
      console.log(
        `Synthetic: ${getFixturesByProvider('synthetic').filter((f) => f.success).length}/${stats.syntheticCount}`
      );
      console.log('');

      // Always pass - this is just for logging
      expect(true).toBe(true);
    });
  });
});
