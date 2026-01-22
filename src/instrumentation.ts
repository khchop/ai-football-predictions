/**
 * Next.js Instrumentation Hook
 * 
 * This file runs when the Next.js server starts (Node.js runtime only).
 * Perfect for initializing the queue system and workers.
 * 
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('\n🚀 [Instrumentation] Initializing event-driven betting system...\n');

    try {
      // 0. Sync models from code to database (auto-sync on startup)
      try {
        const { syncModelsToDatabase } = await import('./lib/db/sync-models');
        const result = await syncModelsToDatabase();
        console.log(`[Instrumentation] Model sync: ${result.total} active models`);
      } catch (syncError) {
        console.error('[Instrumentation] Model sync failed (non-fatal):', syncError);
        // Continue startup even if sync fails
      }

      // 1. Setup repeatable jobs (fetch-fixtures every 6h)
      const { setupRepeatableJobs } = await import('./lib/queue/setup');
      await setupRepeatableJobs();

      // 2. Start all workers
      const { startAllWorkers } = await import('./lib/queue/workers');
      const workers = startAllWorkers();
      console.log(`[Instrumentation] Started ${workers.length} workers`);

      // 3. Catch-up scheduling for existing matches
      const { catchUpScheduling } = await import('./lib/queue/catch-up');
      const { scheduled, matches } = await catchUpScheduling();
      console.log(`[Instrumentation] Catch-up: Scheduled ${scheduled} jobs for ${matches} matches`);

      console.log('\n✅ [Instrumentation] Event-driven system initialized successfully\n');
    } catch (error) {
      console.error('\n❌ [Instrumentation] Failed to initialize:', error);
      // Don't throw - let app start even if queue fails
    }
  }
}
