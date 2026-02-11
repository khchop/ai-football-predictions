/**
 * Rename Synthetic Model IDs: Drop -syn Suffix
 *
 * Purpose: Phase 63 of v2.9 Provider Unification (CONS-03) - rename 10 Synthetic-exclusive
 * model IDs by dropping the -syn suffix across all database tables.
 *
 * This migration:
 * 1. Validates that target model_ids do NOT already exist (safety check)
 * 2. Creates new model rows (copy from old) so FK tables can reference them
 * 3. Updates model_id across all 5 FK tables: predictions, llm_model_stats, bets, model_balances, model_usage
 * 4. Deletes old model rows (no longer referenced)
 * 5. Validates no old model_ids remain and row counts match pre-migration
 * 6. Supports --dry-run mode for safe previewing
 * 7. Is idempotent (safe to run multiple times)
 *
 * Unlike the consolidation migration (Phase 62), this is a straightforward rename operation:
 * - No deduplication needed (no matching base models exist for these 10)
 * - No conflicts possible (target IDs are brand new)
 * - Just UPDATE model_id everywhere
 *
 * Usage:
 *   npx tsx scripts/rename-syn-models.ts              # Execute migration
 *   npx tsx scripts/rename-syn-models.ts --dry-run    # Preview changes
 *   npx tsx scripts/rename-syn-models.ts --verbose    # Show detailed output
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { predictions, llmModelStats, bets, modelBalances, modelUsage, models } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// RENAME_MAP: Maps old -syn IDs to new clean IDs (10 Synthetic-exclusive models)
// These models ONLY exist on Synthetic.new, not on Together AI
// No conflicts possible because target IDs don't exist yet
const RENAME_MAP: Record<string, string> = {
  'qwen3-235b-thinking-syn': 'qwen3-235b-thinking',
  'deepseek-v3-0324-syn': 'deepseek-v3-0324',
  'deepseek-v3.1-terminus-syn': 'deepseek-v3.1-terminus',
  'deepseek-v3.2-syn': 'deepseek-v3.2',
  'minimax-m2-syn': 'minimax-m2',
  'minimax-m2.1-syn': 'minimax-m2.1',
  'glm-4.6-syn': 'glm-4.6',
  'glm-4.7-syn': 'glm-4.7',
  'qwen3-coder-480b-syn': 'qwen3-coder-480b',
  'gpt-oss-120b-syn': 'gpt-oss-120b',
};

interface TableRowCounts {
  tableName: string;
  oldId: string;
  newId: string;
  countBeforeRename: number;
}

interface RenameResult {
  tableName: string;
  oldId: string;
  newId: string;
  updatedRows: number;
}

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Pre-validation: Count rows per old model_id and verify target IDs don't exist
 */
async function preValidate(db: ReturnType<typeof getDb>): Promise<Map<string, TableRowCounts[]>> {
  console.log('\n--- Pre-Validation ---');

  const rowCountsMap = new Map<string, TableRowCounts[]>();

  // Check if target model_ids already exist in models table (may be stubs from sync-models)
  console.log('\nSafety check: Checking if target IDs already exist...');
  const targetIds = Object.values(RENAME_MAP);
  const existingTargets = await db.execute(sql`
    SELECT id FROM models WHERE id IN (${sql.join(targetIds.map(id => sql.raw(`'${id}'`)), sql`, `)})
  `);

  if (existingTargets.rows.length > 0) {
    console.log(`⚠ Found ${existingTargets.rows.length} target model IDs that already exist (likely stubs from sync-models):`);
    for (const row of existingTargets.rows) {
      console.log(`  - ${(row as any).id}`);
    }
    console.log('\nThese stub rows will be deleted before renaming -syn models.');
    console.log('This is safe because the -syn models contain the real data.');
  } else {
    console.log('✓ No target IDs exist yet - clean rename');
  }

  // Count rows per old model_id across all tables
  console.log('\nCounting rows per old model_id...');

  for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
    const counts: TableRowCounts[] = [];

    // models table
    const modelsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(models)
      .where(sql`${models.id} = ${oldId}`);
    counts.push({
      tableName: 'models',
      oldId,
      newId,
      countBeforeRename: modelsCount[0]?.count || 0,
    });

    // predictions table
    const predictionsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(predictions)
      .where(sql`${predictions.modelId} = ${oldId}`);
    counts.push({
      tableName: 'predictions',
      oldId,
      newId,
      countBeforeRename: predictionsCount[0]?.count || 0,
    });

    // llm_model_stats table
    const statsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(llmModelStats)
      .where(sql`${llmModelStats.modelId} = ${oldId}`);
    counts.push({
      tableName: 'llm_model_stats',
      oldId,
      newId,
      countBeforeRename: statsCount[0]?.count || 0,
    });

    // bets table
    const betsCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bets)
      .where(sql`${bets.modelId} = ${oldId}`);
    counts.push({
      tableName: 'bets',
      oldId,
      newId,
      countBeforeRename: betsCount[0]?.count || 0,
    });

    // model_balances table
    const balancesCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(modelBalances)
      .where(sql`${modelBalances.modelId} = ${oldId}`);
    counts.push({
      tableName: 'model_balances',
      oldId,
      newId,
      countBeforeRename: balancesCount[0]?.count || 0,
    });

    // model_usage table
    const usageCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(modelUsage)
      .where(sql`${modelUsage.modelId} = ${oldId}`);
    counts.push({
      tableName: 'model_usage',
      oldId,
      newId,
      countBeforeRename: usageCount[0]?.count || 0,
    });

    rowCountsMap.set(oldId, counts);

    // Report per-model totals
    const totalRows = counts.reduce((sum, c) => sum + c.countBeforeRename, 0);
    if (isVerbose || totalRows > 0) {
      console.log(`\n${oldId} -> ${newId}:`);
      for (const count of counts) {
        if (count.countBeforeRename > 0 || isVerbose) {
          console.log(`  ${count.tableName}: ${count.countBeforeRename} rows`);
        }
      }
      console.log(`  TOTAL: ${totalRows} rows`);
    }
  }

  // Summary
  const grandTotal = Array.from(rowCountsMap.values())
    .flat()
    .reduce((sum, c) => sum + c.countBeforeRename, 0);

  console.log(`\n✓ Pre-validation complete: ${grandTotal} total rows will be renamed across all tables`);

  return rowCountsMap;
}

/**
 * Execute rename migration within a transaction
 */
async function executeRename(
  db: ReturnType<typeof getDb>,
  preValidationCounts: Map<string, TableRowCounts[]>
): Promise<RenameResult[]> {
  console.log('\n--- Executing Rename Migration ---');

  const results: RenameResult[] = [];

  // Begin transaction
  console.log('Beginning transaction...');
  await db.execute(sql`BEGIN`);

  try {
    // Step 0: Delete stub target model rows if they exist (created by sync-models)
    console.log('\nStep 0: Deleting stub target model rows (if they exist)...');
    const targetIds = Object.values(RENAME_MAP);
    const deleteResult = await db.execute(sql`
      DELETE FROM models
      WHERE id IN (${sql.join(targetIds.map(id => sql.raw(`'${id}'`)), sql`, `)})
        AND id NOT IN (${sql.join(Object.keys(RENAME_MAP).map(id => sql.raw(`'${id}'`)), sql`, `)})
    `);
    const deletedStubs = deleteResult.rowCount || 0;
    if (deletedStubs > 0) {
      console.log(`  ✓ Deleted ${deletedStubs} stub model rows`);
    } else {
      console.log(`  ✓ No stub rows to delete`);
    }

    // Step 1: Create new model rows by copying from old rows (avoids FK constraint issues)
    // We INSERT new rows first so FK tables can reference them, then update FKs, then delete old rows
    console.log('\nStep 1: Creating new model rows (copy from old)...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      // Copy all columns except id (which we replace with newId)
      const oldRow = await db.execute(sql`SELECT * FROM models WHERE id = ${oldId}`);
      if (oldRow.rows.length === 0) {
        if (isVerbose) console.log(`  ⚠ ${oldId}: not found, skipping`);
        continue;
      }
      const row = oldRow.rows[0] as any;
      const result = await db.execute(sql`
        INSERT INTO models (id, provider, model_name, display_name, model_description, is_premium, active, created_at,
          current_streak, current_streak_type, best_streak, worst_streak, best_exact_streak, best_tendency_streak)
        VALUES (${newId}, ${row.provider}, ${row.model_name}, ${row.display_name}, ${row.model_description},
          ${row.is_premium}, ${row.active}, ${row.created_at}, ${row.current_streak}, ${row.current_streak_type},
          ${row.best_streak}, ${row.worst_streak}, ${row.best_exact_streak}, ${row.best_tendency_streak})
        ON CONFLICT (id) DO NOTHING
      `);

      const insertedRows = result.rowCount || 0;
      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${insertedRows > 0 ? 'created' : 'already exists'}`);
      }
    }

    // Step 2: Rename in predictions table (FK tables first, now that new model rows exist)
    console.log('\nStep 2: Renaming in predictions table...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        UPDATE predictions
        SET model_id = ${newId}
        WHERE model_id = ${oldId}
      `);

      const updatedRows = result.rowCount || 0;
      results.push({
        tableName: 'predictions',
        oldId,
        newId,
        updatedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${updatedRows} rows`);
      }
    }

    // Step 3: Rename in llm_model_stats table
    console.log('\nStep 3: Renaming in llm_model_stats table...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        UPDATE llm_model_stats
        SET model_id = ${newId}
        WHERE model_id = ${oldId}
      `);

      const updatedRows = result.rowCount || 0;
      results.push({
        tableName: 'llm_model_stats',
        oldId,
        newId,
        updatedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${updatedRows} rows`);
      }
    }

    // Step 4: Rename in bets table
    console.log('\nStep 4: Renaming in bets table...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        UPDATE bets
        SET model_id = ${newId}
        WHERE model_id = ${oldId}
      `);

      const updatedRows = result.rowCount || 0;
      results.push({
        tableName: 'bets',
        oldId,
        newId,
        updatedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${updatedRows} rows`);
      }
    }

    // Step 5: Rename in model_balances table
    console.log('\nStep 5: Renaming in model_balances table...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        UPDATE model_balances
        SET model_id = ${newId}
        WHERE model_id = ${oldId}
      `);

      const updatedRows = result.rowCount || 0;
      results.push({
        tableName: 'model_balances',
        oldId,
        newId,
        updatedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${updatedRows} rows`);
      }
    }

    // Step 6: Rename in model_usage table
    console.log('\nStep 6: Renaming in model_usage table...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        UPDATE model_usage
        SET model_id = ${newId}
        WHERE model_id = ${oldId}
      `);

      const updatedRows = result.rowCount || 0;
      results.push({
        tableName: 'model_usage',
        oldId,
        newId,
        updatedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ ${oldId} -> ${newId}: ${updatedRows} rows`);
      }
    }

    // Step 7: Delete old model rows (all FK references now point to new IDs)
    console.log('\nStep 7: Deleting old model rows...');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        DELETE FROM models WHERE id = ${oldId}
      `);

      const deletedRows = result.rowCount || 0;
      results.push({
        tableName: 'models_delete',
        oldId,
        newId,
        updatedRows: deletedRows,
      });

      if (isVerbose) {
        console.log(`  ✓ Deleted old row: ${oldId} (${deletedRows} rows)`);
      }
    }

    console.log('\n✓ All rename operations completed');

    return results;
  } catch (error) {
    console.error('\n✗ Rename migration failed - rolling back transaction');
    await db.execute(sql`ROLLBACK`);
    throw error;
  }
}

/**
 * Post-validation: Verify no old IDs remain and row counts match
 */
async function postValidate(
  db: ReturnType<typeof getDb>,
  preValidationCounts: Map<string, TableRowCounts[]>,
  renameResults: RenameResult[]
): Promise<boolean> {
  console.log('\n--- Post-Validation ---');

  let allPassed = true;

  // Check 1: Verify no old model_ids remain across ALL tables
  console.log('\nCheck 1: Verifying no old model_ids remain...');
  const oldIds = Object.keys(RENAME_MAP);
  const remainingOldIds = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM models WHERE id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS models_count,
      (SELECT COUNT(*)::int FROM predictions WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS predictions_count,
      (SELECT COUNT(*)::int FROM llm_model_stats WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS stats_count,
      (SELECT COUNT(*)::int FROM bets WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS bets_count,
      (SELECT COUNT(*)::int FROM model_balances WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS balances_count,
      (SELECT COUNT(*)::int FROM model_usage WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS usage_count
  `);

  const remainingRow = remainingOldIds.rows[0] as any;
  const totalRemaining =
    (remainingRow?.models_count || 0) +
    (remainingRow?.predictions_count || 0) +
    (remainingRow?.stats_count || 0) +
    (remainingRow?.bets_count || 0) +
    (remainingRow?.balances_count || 0) +
    (remainingRow?.usage_count || 0);

  if (totalRemaining > 0) {
    console.error('✗ FAIL: Old model_ids still exist:');
    if (remainingRow?.models_count > 0) console.error(`  - models: ${remainingRow.models_count}`);
    if (remainingRow?.predictions_count > 0) console.error(`  - predictions: ${remainingRow.predictions_count}`);
    if (remainingRow?.stats_count > 0) console.error(`  - llm_model_stats: ${remainingRow.stats_count}`);
    if (remainingRow?.bets_count > 0) console.error(`  - bets: ${remainingRow.bets_count}`);
    if (remainingRow?.balances_count > 0) console.error(`  - model_balances: ${remainingRow.balances_count}`);
    if (remainingRow?.usage_count > 0) console.error(`  - model_usage: ${remainingRow.usage_count}`);
    allPassed = false;
  } else {
    console.log('✓ PASS: No old model_ids remain');
  }

  // Check 2: Verify new model_ids exist and row counts match pre-migration
  console.log('\nCheck 2: Verifying row counts match pre-migration...');
  for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
    const preCounts = preValidationCounts.get(oldId);
    if (!preCounts) {
      console.error(`✗ FAIL: No pre-validation counts found for ${oldId}`);
      allPassed = false;
      continue;
    }

    for (const preCount of preCounts) {
      // Get post-rename count for new ID
      let postCount = 0;
      if (preCount.tableName === 'models') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(models)
          .where(sql`${models.id} = ${newId}`);
        postCount = result[0]?.count || 0;
      } else if (preCount.tableName === 'predictions') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(predictions)
          .where(sql`${predictions.modelId} = ${newId}`);
        postCount = result[0]?.count || 0;
      } else if (preCount.tableName === 'llm_model_stats') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(llmModelStats)
          .where(sql`${llmModelStats.modelId} = ${newId}`);
        postCount = result[0]?.count || 0;
      } else if (preCount.tableName === 'bets') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(bets)
          .where(sql`${bets.modelId} = ${newId}`);
        postCount = result[0]?.count || 0;
      } else if (preCount.tableName === 'model_balances') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(modelBalances)
          .where(sql`${modelBalances.modelId} = ${newId}`);
        postCount = result[0]?.count || 0;
      } else if (preCount.tableName === 'model_usage') {
        const result = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(modelUsage)
          .where(sql`${modelUsage.modelId} = ${newId}`);
        postCount = result[0]?.count || 0;
      }

      if (postCount !== preCount.countBeforeRename) {
        console.error(
          `✗ FAIL: Row count mismatch for ${preCount.tableName}.${newId}: expected ${preCount.countBeforeRename}, got ${postCount}`
        );
        allPassed = false;
      } else if (isVerbose && postCount > 0) {
        console.log(`  ✓ ${preCount.tableName}.${newId}: ${postCount} rows (matches pre-migration)`);
      }
    }
  }

  if (allPassed) {
    console.log('✓ PASS: All row counts match pre-migration');
  }

  // Check 3: Verify no orphaned FKs
  console.log('\nCheck 3: Verifying no orphaned FKs...');
  const orphanedFKs = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM predictions p WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = p.model_id)) AS predictions_orphans,
      (SELECT COUNT(*)::int FROM llm_model_stats s WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = s.model_id)) AS stats_orphans,
      (SELECT COUNT(*)::int FROM bets b WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = b.model_id)) AS bets_orphans,
      (SELECT COUNT(*)::int FROM model_balances mb WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = mb.model_id)) AS balances_orphans,
      (SELECT COUNT(*)::int FROM model_usage mu WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = mu.model_id)) AS usage_orphans
  `);

  const orphanRow = orphanedFKs.rows[0] as any;
  const totalOrphans =
    (orphanRow?.predictions_orphans || 0) +
    (orphanRow?.stats_orphans || 0) +
    (orphanRow?.bets_orphans || 0) +
    (orphanRow?.balances_orphans || 0) +
    (orphanRow?.usage_orphans || 0);

  if (totalOrphans > 0) {
    console.error('✗ FAIL: Orphaned FK references found:');
    if (orphanRow?.predictions_orphans > 0) console.error(`  - predictions: ${orphanRow.predictions_orphans}`);
    if (orphanRow?.stats_orphans > 0) console.error(`  - llm_model_stats: ${orphanRow.stats_orphans}`);
    if (orphanRow?.bets_orphans > 0) console.error(`  - bets: ${orphanRow.bets_orphans}`);
    if (orphanRow?.balances_orphans > 0) console.error(`  - model_balances: ${orphanRow.balances_orphans}`);
    if (orphanRow?.usage_orphans > 0) console.error(`  - model_usage: ${orphanRow.usage_orphans}`);
    allPassed = false;
  } else {
    console.log('✓ PASS: No orphaned FK references');
  }

  // Check 4: Verify none of the 10 renamed -syn IDs remain (the 3 consolidated -syn models are handled by post-consolidation)
  console.log('\nCheck 4: Verifying no renamed -syn IDs remain...');
  const remainingSynSuffixes = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM models WHERE id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS models_syn,
      (SELECT COUNT(*)::int FROM predictions WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS predictions_syn,
      (SELECT COUNT(*)::int FROM llm_model_stats WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS stats_syn,
      (SELECT COUNT(*)::int FROM bets WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS bets_syn,
      (SELECT COUNT(*)::int FROM model_balances WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS balances_syn,
      (SELECT COUNT(*)::int FROM model_usage WHERE model_id IN (${sql.join(oldIds.map(id => sql.raw(`'${id}'`)), sql`, `)})) AS usage_syn
  `);

  const synRow = remainingSynSuffixes.rows[0] as any;
  const totalSyn =
    (synRow?.models_syn || 0) +
    (synRow?.predictions_syn || 0) +
    (synRow?.stats_syn || 0) +
    (synRow?.bets_syn || 0) +
    (synRow?.balances_syn || 0) +
    (synRow?.usage_syn || 0);

  if (totalSyn > 0) {
    console.error('✗ FAIL: Model IDs with -syn suffix still exist:');
    if (synRow?.models_syn > 0) console.error(`  - models: ${synRow.models_syn}`);
    if (synRow?.predictions_syn > 0) console.error(`  - predictions: ${synRow.predictions_syn}`);
    if (synRow?.stats_syn > 0) console.error(`  - llm_model_stats: ${synRow.stats_syn}`);
    if (synRow?.bets_syn > 0) console.error(`  - bets: ${synRow.bets_syn}`);
    if (synRow?.balances_syn > 0) console.error(`  - model_balances: ${synRow.balances_syn}`);
    if (synRow?.usage_syn > 0) console.error(`  - model_usage: ${synRow.usage_syn}`);
    allPassed = false;
  } else {
    console.log('✓ PASS: No -syn suffixes remain');
  }

  console.log('\n' + (allPassed ? '✓ All post-validation checks PASSED' : '✗ Some post-validation checks FAILED'));

  return allPassed;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(80));
  console.log('=== Rename Synthetic Model IDs: Phase 63 (CONS-03) ===');
  console.log('='.repeat(80));
  console.log(`\nRenaming ${Object.keys(RENAME_MAP).length} Synthetic-exclusive model IDs (dropping -syn suffix)\n`);

  if (isDryRun) {
    console.log('[DRY RUN MODE] No changes will be made\n');
  }

  const db = getDb();

  // Pre-validation
  const preValidationCounts = await preValidate(db);

  if (isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('DRY RUN: All changes rolled back');
    console.log('='.repeat(80));
    console.log('\nTo execute the migration, run without --dry-run flag');
    process.exit(0);
  }

  // Execute rename migration
  const renameResults = await executeRename(db, preValidationCounts);

  // Post-validation
  const postValidationPassed = await postValidate(db, preValidationCounts, renameResults);

  if (!postValidationPassed) {
    console.error('\n✗ Post-validation FAILED - rolling back transaction');
    await db.execute(sql`ROLLBACK`);
    process.exit(1);
  }

  // Commit transaction
  console.log('\nCommitting transaction...');
  await db.execute(sql`COMMIT`);
  console.log('✓ Transaction committed successfully');

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('=== Migration Summary ===');
  console.log('='.repeat(80));

  const totalUpdated = renameResults.reduce((sum, r) => sum + r.updatedRows, 0);
  console.log(`✓ Renamed ${Object.keys(RENAME_MAP).length} model IDs across all tables`);
  console.log(`✓ Total rows updated: ${totalUpdated}`);
  console.log('✓ All validation checks passed');
  console.log('✓ Migration completed successfully');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error during rename migration:', error);
  process.exit(1);
});
