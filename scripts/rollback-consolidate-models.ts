/**
 * Rollback Migration: Restore Synthetic Model IDs
 *
 * Purpose: Reverse the Phase 62 consolidation migration by restoring -syn model IDs
 * where provider_used attribution shows the prediction came from Synthetic provider.
 *
 * This rollback:
 * 1. Uses provider_used column for safe predictions table reversal
 * 2. Skips rows with NULL provider_used (pre-Phase 61 historical data)
 * 3. Reverses other tables BUT cannot un-merge aggregated values
 * 4. Supports --dry-run mode for safe previewing
 * 5. Is idempotent (safe to run multiple times)
 *
 * LIMITATIONS:
 * - Aggregated stats (llm_model_stats, model_balances, model_usage) cannot be un-merged
 * - Values remain summed from forward migration
 * - If Phase 63 has run (models table updated), rollback creates orphaned FKs in reverse
 * - Rollback should be run BEFORE Phase 63, not after
 *
 * Usage:
 *   npx tsx scripts/rollback-consolidate-models.ts              # Execute rollback
 *   npx tsx scripts/rollback-consolidate-models.ts --dry-run    # Preview changes
 *   npx tsx scripts/rollback-consolidate-models.ts --verbose    # Show detailed output
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { predictions, llmModelStats, bets, modelBalances, modelUsage } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// ROLLBACK_MAP: Reverse of CONSOLIDATION_MAP
// Maps base routing IDs back to Synthetic-specific IDs
const ROLLBACK_MAP: Record<string, string> = {
  'deepseek-r1': 'deepseek-r1-0528-syn',
  'kimi-k2-thinking': 'kimi-k2-thinking-syn',
  'kimi-k2.5': 'kimi-k2.5-syn',
};

interface RollbackStats {
  tableName: string;
  totalRows: number;
  affectedRows: number;
  nullProviderUsedRows?: number; // predictions only
}

interface RollbackResult {
  tableName: string;
  rolledBackRows: number;
  skippedRows?: number; // predictions only (NULL provider_used)
}

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Pre-rollback validation: Count rows that would be affected
 */
async function preValidate(db: ReturnType<typeof getDb>): Promise<RollbackStats[]> {
  console.log('\n--- Pre-Rollback Validation ---');

  const stats: RollbackStats[] = [];

  // predictions table
  const predictionsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(predictions);

  // Count predictions with provider_used = Synthetic provider IDs
  const predictionsAffected = await db.execute(sql`
    SELECT COUNT(*)::int as affected_count
    FROM predictions
    WHERE model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
      AND provider_used IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
  `);

  // Count predictions with NULL provider_used (will be skipped)
  const predictionsNullProvider = await db.execute(sql`
    SELECT COUNT(*)::int as null_count
    FROM predictions
    WHERE model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
      AND provider_used IS NULL
  `);

  stats.push({
    tableName: 'predictions',
    totalRows: predictionsTotal[0]?.count || 0,
    affectedRows: (predictionsAffected.rows[0] as any)?.affected_count || 0,
    nullProviderUsedRows: (predictionsNullProvider.rows[0] as any)?.null_count || 0,
  });

  console.log(
    `predictions: ${predictionsTotal[0]?.count || 0} total, ${(predictionsAffected.rows[0] as any)?.affected_count || 0} to rollback, ${(predictionsNullProvider.rows[0] as any)?.null_count || 0} skipped (NULL provider_used)`
  );

  // llm_model_stats table
  const statsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(llmModelStats);
  const statsAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(llmModelStats)
    .where(sql`${llmModelStats.modelId} IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')`);

  stats.push({
    tableName: 'llm_model_stats',
    totalRows: statsTotal[0]?.count || 0,
    affectedRows: statsAffected[0]?.count || 0,
  });

  console.log(
    `llm_model_stats: ${statsTotal[0]?.count || 0} total, ${statsAffected[0]?.count || 0} to rollback`
  );

  // bets table
  const betsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(bets);
  const betsAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(bets)
    .where(sql`${bets.modelId} IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')`);

  stats.push({
    tableName: 'bets',
    totalRows: betsTotal[0]?.count || 0,
    affectedRows: betsAffected[0]?.count || 0,
  });

  console.log(`bets: ${betsTotal[0]?.count || 0} total, ${betsAffected[0]?.count || 0} to rollback`);

  // model_balances table
  const balancesTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelBalances);
  const balancesAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(modelBalances)
    .where(sql`${modelBalances.modelId} IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')`);

  stats.push({
    tableName: 'model_balances',
    totalRows: balancesTotal[0]?.count || 0,
    affectedRows: balancesAffected[0]?.count || 0,
  });

  console.log(
    `model_balances: ${balancesTotal[0]?.count || 0} total, ${balancesAffected[0]?.count || 0} to rollback`
  );

  // model_usage table
  const usageTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelUsage);
  const usageAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(modelUsage)
    .where(sql`${modelUsage.modelId} IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')`);

  stats.push({
    tableName: 'model_usage',
    totalRows: usageTotal[0]?.count || 0,
    affectedRows: usageAffected[0]?.count || 0,
  });

  console.log(
    `model_usage: ${usageTotal[0]?.count || 0} total, ${usageAffected[0]?.count || 0} to rollback`
  );

  return stats;
}

/**
 * Rollback predictions table using provider_used attribution
 * ONLY rollback where provider_used matches Synthetic provider ID
 */
async function rollbackPredictions(db: ReturnType<typeof getDb>): Promise<RollbackResult> {
  console.log('\n--- Rollback: predictions ---');

  let totalRolledBack = 0;

  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    const result = await db.execute(sql`
      UPDATE predictions
      SET model_id = ${synId}
      WHERE model_id = ${baseId}
        AND provider_used = ${synId}
    `);

    const rolledBack = result.rowCount || 0;
    totalRolledBack += rolledBack;

    if (rolledBack > 0 || isVerbose) {
      console.log(`  ${baseId} → ${synId}: ${rolledBack} rows`);
    }
  }

  // Count skipped rows (NULL provider_used)
  const skippedResult = await db.execute(sql`
    SELECT COUNT(*)::int as skipped_count
    FROM predictions
    WHERE model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
      AND provider_used IS NULL
  `);

  const skippedCount = (skippedResult.rows[0] as any)?.skipped_count || 0;

  console.log(`Rolled back ${totalRolledBack} predictions`);
  if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} predictions with NULL provider_used (pre-Phase 61 data)`);
  }

  return {
    tableName: 'predictions',
    rolledBackRows: totalRolledBack,
    skippedRows: skippedCount,
  };
}

/**
 * Rollback llm_model_stats table
 * WARNING: Cannot un-merge aggregated values (summed during forward migration)
 */
async function rollbackLLMModelStats(db: ReturnType<typeof getDb>): Promise<RollbackResult> {
  console.log('\n--- Rollback: llm_model_stats ---');
  console.log('  ⚠️  Aggregated values cannot be un-merged');

  let totalRolledBack = 0;

  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    const result = await db.execute(sql`
      UPDATE llm_model_stats
      SET model_id = ${synId}
      WHERE model_id = ${baseId}
    `);

    const rolledBack = result.rowCount || 0;
    totalRolledBack += rolledBack;

    if (rolledBack > 0 || isVerbose) {
      console.log(`  ${baseId} → ${synId}: ${rolledBack} rows`);
    }
  }

  console.log(`Rolled back ${totalRolledBack} stat records (merged values remain summed)`);

  return {
    tableName: 'llm_model_stats',
    rolledBackRows: totalRolledBack,
  };
}

/**
 * Rollback bets table
 */
async function rollbackBets(db: ReturnType<typeof getDb>): Promise<RollbackResult> {
  console.log('\n--- Rollback: bets ---');

  let totalRolledBack = 0;

  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    const result = await db.execute(sql`
      UPDATE bets
      SET model_id = ${synId}
      WHERE model_id = ${baseId}
    `);

    const rolledBack = result.rowCount || 0;
    totalRolledBack += rolledBack;

    if (rolledBack > 0 || isVerbose) {
      console.log(`  ${baseId} → ${synId}: ${rolledBack} rows`);
    }
  }

  console.log(`Rolled back ${totalRolledBack} bets`);

  return {
    tableName: 'bets',
    rolledBackRows: totalRolledBack,
  };
}

/**
 * Rollback model_balances table
 * WARNING: Cannot un-merge aggregated values (summed during forward migration)
 */
async function rollbackModelBalances(db: ReturnType<typeof getDb>): Promise<RollbackResult> {
  console.log('\n--- Rollback: model_balances ---');
  console.log('  ⚠️  Aggregated values cannot be un-merged');

  let totalRolledBack = 0;

  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    const result = await db.execute(sql`
      UPDATE model_balances
      SET model_id = ${synId}
      WHERE model_id = ${baseId}
    `);

    const rolledBack = result.rowCount || 0;
    totalRolledBack += rolledBack;

    if (rolledBack > 0 || isVerbose) {
      console.log(`  ${baseId} → ${synId}: ${rolledBack} rows`);
    }
  }

  console.log(`Rolled back ${totalRolledBack} balance records (merged values remain summed)`);

  return {
    tableName: 'model_balances',
    rolledBackRows: totalRolledBack,
  };
}

/**
 * Rollback model_usage table
 * WARNING: Cannot un-merge aggregated values (summed during forward migration)
 */
async function rollbackModelUsage(db: ReturnType<typeof getDb>): Promise<RollbackResult> {
  console.log('\n--- Rollback: model_usage ---');
  console.log('  ⚠️  Aggregated values cannot be un-merged');

  let totalRolledBack = 0;

  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    const result = await db.execute(sql`
      UPDATE model_usage
      SET model_id = ${synId}
      WHERE model_id = ${baseId}
    `);

    const rolledBack = result.rowCount || 0;
    totalRolledBack += rolledBack;

    if (rolledBack > 0 || isVerbose) {
      console.log(`  ${baseId} → ${synId}: ${rolledBack} rows`);
    }
  }

  console.log(`Rolled back ${totalRolledBack} usage records (merged values remain summed)`);

  return {
    tableName: 'model_usage',
    rolledBackRows: totalRolledBack,
  };
}

/**
 * Post-rollback validation: Check for orphaned FKs and unique constraints
 */
async function postValidate(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('\n--- Post-Rollback Validation ---');

  // Check for orphaned FKs in predictions
  const orphanedPredictions = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM predictions p
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = p.model_id
    )
  `);

  const orphanedCount = (orphanedPredictions.rows[0] as any)?.orphaned_count || 0;

  if (orphanedCount > 0) {
    console.log(
      `⚠️  ${orphanedCount} orphaned FK violations (expected if Phase 63 has run — base model rows removed)`
    );
  } else {
    console.log('✅ No orphaned FK violations');
  }

  // Check unique constraints
  const uniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT match_id, model_id, COUNT(*)
      FROM predictions
      GROUP BY match_id, model_id
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  const violationCount = (uniqueViolations.rows[0] as any)?.violation_count || 0;

  if (violationCount > 0) {
    console.log(`❌ FAIL: ${violationCount} unique constraint violations detected`);
  } else {
    console.log('✅ PASS: No unique constraint violations');
  }
}

/**
 * Main rollback orchestration
 */
async function main() {
  console.log('=== Phase 62: Model Consolidation Rollback ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Verbose: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('\nRolling back 3 consolidated model IDs:');
  for (const [baseId, synId] of Object.entries(ROLLBACK_MAP)) {
    console.log(`  ${baseId} → ${synId}`);
  }

  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('  - predictions table: Only rows with provider_used = Synthetic ID will be rolled back');
  console.log('  - predictions table: Rows with NULL provider_used will be SKIPPED');
  console.log('  - Other tables: Aggregated values remain summed (cannot un-merge)');
  console.log('  - If Phase 63 has run: Rollback will create orphaned FKs (base model rows removed)');

  const db = getDb();
  let success = false;

  try {
    // Begin transaction
    await db.execute(sql`BEGIN`);
    console.log('\n✓ Transaction started');

    // Defer FK constraint checking
    await db.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
    console.log('✓ FK constraints deferred');

    // 1. Pre-rollback validation
    const preStats = await preValidate(db);

    // 2. Rollback phase
    console.log('\n--- Rollback Phase ---');
    await rollbackPredictions(db);
    await rollbackLLMModelStats(db);
    await rollbackBets(db);
    await rollbackModelBalances(db);
    await rollbackModelUsage(db);

    // 3. Post-rollback validation
    await postValidate(db);

    success = true;

    // 4. Commit or rollback
    if (isDryRun) {
      await db.execute(sql`ROLLBACK`);
      console.log('\n🔄 DRY RUN: All changes rolled back');
    } else {
      await db.execute(sql`COMMIT`);
      console.log('\n✅ Rollback committed successfully');
    }
  } catch (error: any) {
    await db.execute(sql`ROLLBACK`);
    console.error('\n❌ Rollback failed:', error.message);
    console.log('🔄 All changes rolled back');
    throw error;
  }

  if (success) {
    console.log('\n=== Rollback Complete ===');
    if (isDryRun) {
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('Model IDs restored to Synthetic-specific IDs.');
      console.log('Note: Aggregated values remain summed (manual adjustment may be needed).');
    }
  }
}

// Run rollback
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
