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
     const { loggers } = await import('./lib/logger/modules');
     
     loggers.instrumentation.info('Initializing event-driven betting system');

     try {
       // 0. Validate environment variables
       const { validateEnvironmentOrThrow } = await import('./lib/utils/env-validation');
       validateEnvironmentOrThrow();
       
        // 1. Sync models from code to database (auto-sync on startup)
        try {
          const { syncModelsToDatabase } = await import('./lib/db/sync-models');
          const result = await syncModelsToDatabase();
          loggers.instrumentation.info({ activeModels: result.total }, 'Model sync completed');
        } catch (syncError) {
          loggers.instrumentation.warn({ error: syncError instanceof Error ? syncError.message : String(syncError) }, 'Model sync failed (non-fatal)');
          // Continue startup even if sync fails
        }

        // 1.5. Warm cache with frequently accessed data
        try {
          const { warmCache } = await import('./lib/cache/warming');
          const warmingResult = await warmCache();
          loggers.instrumentation.info({ warmed: warmingResult.warmed.length, failed: warmingResult.failed.length, duration: warmingResult.duration }, 'Cache warming completed');
        } catch (warmingError) {
          loggers.instrumentation.warn({ error: warmingError instanceof Error ? warmingError.message : String(warmingError) }, 'Cache warming failed (non-fatal)');
          // Continue startup even if warming fails
        }

        // 2. Setup repeatable jobs (fetch-fixtures every 6h)
       const { setupRepeatableJobs } = await import('./lib/queue/setup');
       await setupRepeatableJobs();

       // 3. Start all workers
       const { startAllWorkers } = await import('./lib/queue/workers');
       const workers = startAllWorkers();
       loggers.instrumentation.info({ workerCount: workers.length }, 'Workers started');

       // 4. Catch-up scheduling for existing matches
       const { catchUpScheduling } = await import('./lib/queue/catch-up');
       const { scheduled, matches } = await catchUpScheduling();
       loggers.instrumentation.info({ jobsScheduled: scheduled, matchesTotal: matches }, 'Catch-up scheduling completed');

       loggers.instrumentation.info('Event-driven system initialized successfully');
     } catch (error) {
       loggers.instrumentation.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to initialize');
       // Don't throw - let app start even if queue fails
     }
   }
 }
