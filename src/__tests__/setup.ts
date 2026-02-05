/**
 * Vitest Test Setup
 *
 * Loads environment variables and provides test mode helpers.
 * Executed before each test file via vitest.config.ts setupFiles.
 */
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Test mode from environment
 * Set TEST_MODE=mock to skip real API calls
 */
export const TEST_MODE = process.env.TEST_MODE || 'real';

/**
 * Check if real API calls should be skipped
 * Returns true if no API keys are configured
 */
export function shouldSkipRealAPI(): boolean {
  const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
  const hasSyntheticKey = !!process.env.SYNTHETIC_API_KEY;

  return !hasTogetherKey && !hasSyntheticKey;
}

// Log test configuration at startup
console.log('\n[Test Setup]');
console.log(`  Mode: ${TEST_MODE}`);
console.log(`  Together API: ${process.env.TOGETHER_API_KEY ? 'configured' : 'not configured'}`);
console.log(`  Synthetic API: ${process.env.SYNTHETIC_API_KEY ? 'configured' : 'not configured'}`);
console.log('');
