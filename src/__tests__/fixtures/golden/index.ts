/**
 * Golden Fixtures Index
 *
 * Provides access to golden fixture data for regression testing.
 * Golden fixtures capture known-good response structures from all 42 models.
 *
 * Usage:
 * 1. Generate fixtures: npx tsx scripts/generate-golden-fixtures.ts
 * 2. Import helpers: import { getSuccessfulFixtures } from '@/__tests__/fixtures/golden'
 * 3. Use in tests: validate parsing against known-good structures
 */
import allModelsFixtures from './all-models.json';

/**
 * Golden fixture structure
 */
export interface GoldenFixture {
  modelId: string;
  provider: 'together' | 'synthetic';
  success: boolean;
  parsed?: {
    match_id: string;
    home_score: number;
    away_score: number;
  };
  rawResponseSample?: string;
  errorMessage?: string;
  timestamp: string;
}

/**
 * All golden fixtures indexed by model ID
 */
export const GoldenFixtures: Record<string, GoldenFixture> = allModelsFixtures.reduce(
  (acc, fixture) => {
    acc[fixture.modelId] = fixture;
    return acc;
  },
  {} as Record<string, GoldenFixture>
);

/**
 * Get only successful fixtures (models that returned valid predictions)
 * Use this for structural validation tests
 */
export function getSuccessfulFixtures(): GoldenFixture[] {
  return allModelsFixtures.filter((f) => f.success);
}

/**
 * Get only failed fixtures (for debugging or failure analysis)
 */
export function getFailedFixtures(): GoldenFixture[] {
  return allModelsFixtures.filter((f) => !f.success);
}

/**
 * Get fixtures by provider type
 */
export function getFixturesByProvider(
  provider: 'together' | 'synthetic'
): GoldenFixture[] {
  return allModelsFixtures.filter((f) => f.provider === provider);
}

/**
 * Get model IDs with successful fixtures
 * Useful for parameterized tests
 */
export function getFixtureModelIds(): string[] {
  return getSuccessfulFixtures().map((f) => f.modelId);
}

/**
 * Get fixture by model ID
 */
export function getFixtureById(modelId: string): GoldenFixture | undefined {
  return GoldenFixtures[modelId];
}

/**
 * Get fixture statistics
 */
export function getFixtureStats(): {
  total: number;
  successful: number;
  failed: number;
  togetherCount: number;
  syntheticCount: number;
  successRate: number;
} {
  const successful = getSuccessfulFixtures();
  const together = getFixturesByProvider('together');
  const synthetic = getFixturesByProvider('synthetic');

  return {
    total: allModelsFixtures.length,
    successful: successful.length,
    failed: allModelsFixtures.length - successful.length,
    togetherCount: together.length,
    syntheticCount: synthetic.length,
    successRate:
      allModelsFixtures.length > 0
        ? Math.round((successful.length / allModelsFixtures.length) * 100)
        : 0,
  };
}

/**
 * Export raw fixtures for direct access
 */
export { allModelsFixtures };
