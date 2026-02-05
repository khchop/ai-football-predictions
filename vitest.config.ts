import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node environment for API testing (not jsdom)
    environment: 'node',

    // Timeout settings for LLM APIs
    testTimeout: 60000, // 60s default for LLM APIs
    hookTimeout: 10000, // 10s for setup/teardown

    // Concurrency control to avoid rate limits
    maxConcurrency: 5,

    // Test file patterns
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],

    // Setup files
    setupFiles: ['src/__tests__/setup.ts'],
  },

  // Path aliases matching tsconfig
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
