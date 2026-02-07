/**
 * Golden Fixture Generator
 *
 * Captures baseline responses from all 42 LLM models for regression testing.
 * Run with: npx tsx scripts/generate-golden-fixtures.ts
 *
 * Requirements:
 * - TOGETHER_API_KEY and SYNTHETIC_API_KEY environment variables
 * - All 42 models accessible via API
 *
 * Output: src/__tests__/fixtures/golden/all-models.json
 */
import { ALL_PROVIDERS } from '@/lib/llm';
import { TEST_MATCH_ID, TEST_PROMPT, REASONING_MODEL_IDS, getModelTimeout } from '@/__tests__/fixtures/test-data';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface GoldenFixture {
  modelId: string;
  provider: 'together' | 'synthetic';
  success: boolean;
  parsed?: { match_id: string; home_score: number; away_score: number };
  rawResponseSample?: string; // First 500 chars for debugging
  errorMessage?: string;
  timestamp: string;
}

async function generateGoldenFixtures(): Promise<void> {
  console.log(`\n=== Golden Fixture Generator ===`);
  console.log(`Models to test: ${ALL_PROVIDERS.length}`);
  console.log(`Together API: ${process.env.TOGETHER_API_KEY ? 'configured' : 'MISSING'}`);
  console.log(`Synthetic API: ${process.env.SYNTHETIC_API_KEY ? 'configured' : 'MISSING'}`);
  console.log('');

  if (!process.env.TOGETHER_API_KEY && !process.env.SYNTHETIC_API_KEY) {
    console.error('ERROR: No API keys configured. Set TOGETHER_API_KEY or SYNTHETIC_API_KEY.');
    process.exit(1);
  }

  const fixtures: GoldenFixture[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < ALL_PROVIDERS.length; i++) {
    const provider = ALL_PROVIDERS[i];
    const progress = `[${i + 1}/${ALL_PROVIDERS.length}]`;
    const providerType = provider.id.endsWith('-syn') ? 'synthetic' : 'together';

    console.log(`${progress} Testing ${provider.id} (${providerType})...`);

    try {
      // Get appropriate timeout for this model
      const timeout = getModelTimeout(provider.id);
      const timeoutSeconds = Math.floor(timeout / 1000);

      console.log(`  Timeout: ${timeoutSeconds}s ${REASONING_MODEL_IDS.has(provider.id) ? '(reasoning model)' : ''}`);

      // Call the model with test prompt
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      if (result.success && result.predictions.has(TEST_MATCH_ID)) {
        const prediction = result.predictions.get(TEST_MATCH_ID)!;

        fixtures.push({
          modelId: provider.id,
          provider: providerType,
          success: true,
          parsed: {
            match_id: TEST_MATCH_ID,
            home_score: prediction.homeScore,
            away_score: prediction.awayScore,
          },
          rawResponseSample: result.rawResponse?.slice(0, 500),
          timestamp: new Date().toISOString(),
        });

        successCount++;
        console.log(`  ✓ Success: ${prediction.homeScore}-${prediction.awayScore}`);
      } else {
        // Model returned but failed to parse
        const errorMsg = result.errors?.[TEST_MATCH_ID] || 'Unknown parsing error';
        fixtures.push({
          modelId: provider.id,
          provider: providerType,
          success: false,
          errorMessage: errorMsg,
          rawResponseSample: result.rawResponse?.slice(0, 500),
          timestamp: new Date().toISOString(),
        });

        failureCount++;
        console.log(`  ✗ Failed: ${errorMsg}`);
      }
    } catch (error) {
      // API call or network error
      const errorMsg = error instanceof Error ? error.message : String(error);
      fixtures.push({
        modelId: provider.id,
        provider: providerType,
        success: false,
        errorMessage: errorMsg,
        timestamp: new Date().toISOString(),
      });

      failureCount++;
      console.log(`  ✗ Error: ${errorMsg}`);
    }
  }

  // Write fixtures to JSON file
  const outputPath = join(process.cwd(), 'src/__tests__/fixtures/golden/all-models.json');
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2), 'utf-8');

  console.log(`\n=== Summary ===`);
  console.log(`Total models: ${ALL_PROVIDERS.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Success rate: ${Math.round((successCount / ALL_PROVIDERS.length) * 100)}%`);
  console.log(`\nFixtures written to: ${outputPath}`);
  console.log('');
}

// Run generator
generateGoldenFixtures().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
