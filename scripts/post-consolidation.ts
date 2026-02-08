/**
 * Post-Consolidation Operational Script
 *
 * Purpose: Phase 63 of v2.9 Provider Unification - post-migration operations
 * Run AFTER migrate-consolidate-models.ts has been executed successfully
 *
 * This script:
 * 1. Deactivates old -syn model rows in the models table (3 consolidated models)
 * 2. Invalidates all model-related caches comprehensively
 * 3. Verifies post-migration data integrity (orphaned FKs, duplicates, etc.)
 * 4. Supports --dry-run mode for safe previewing
 *
 * Usage:
 *   npx tsx scripts/post-consolidation.ts              # Execute operations
 *   npx tsx scripts/post-consolidation.ts --dry-run    # Preview only
 *   npx tsx scripts/post-consolidation.ts --verbose    # Show detailed output
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { models, predictions, llmModelStats, bets, modelBalances, modelUsage } from '@/lib/db/schema';
import { sql, inArray, eq } from 'drizzle-orm';
import { getRedis, cacheDeletePattern, cacheDelete, cacheKeys } from '@/lib/cache/redis';

// OLD_SYN_IDS: The 3 Synthetic-specific model IDs that were consolidated
// These model rows should be deactivated (not deleted) to preserve historical references
const OLD_SYN_IDS = ['deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn'];

interface IntegrityCheck {
  name: string;
  passed: boolean;
  count: number;
  expected: number;
  message: string;
}

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Deactivate old -syn model rows in the models table
 */
async function deactivateOldModels(db: ReturnType<typeof getDb>): Promise<number> {
  console.log('\n--- Step 1: Deactivate Old Models ---');

  if (isDryRun) {
    console.log('[DRY RUN] Would deactivate models with IDs:', OLD_SYN_IDS);

    // Count how many exist
    const existingCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(models)
      .where(inArray(models.id, OLD_SYN_IDS));

    const count = existingCount[0]?.count || 0;
    console.log(`[DRY RUN] Found ${count} model rows that would be deactivated`);
    return count;
  }

  // Execute deactivation
  const result = await db
    .update(models)
    .set({ active: false })
    .where(inArray(models.id, OLD_SYN_IDS));

  const deactivatedCount = result.rowCount || 0;
  console.log(`✓ Deactivated ${deactivatedCount} model rows`);

  if (isVerbose) {
    console.log('  Deactivated IDs:', OLD_SYN_IDS);
  }

  return deactivatedCount;
}

/**
 * Invalidate all model-related caches
 */
async function invalidateCaches(): Promise<number> {
  console.log('\n--- Step 2: Invalidate Caches ---');

  const redis = getRedis();
  if (!redis) {
    console.log('⚠ Redis not configured - skipping cache invalidation');
    return 0;
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would invalidate the following cache patterns:');
    console.log('  - db:models:active');
    console.log('  - db:models:count:active');
    console.log('  - db:models:top-performing');
    console.log('  - db:models:health:all');
    console.log('  - db:stats:overall');
    console.log('  - db:leaderboard:*');
    console.log('  - db:stats:*');
    console.log('  - db:model:*:stats');
    console.log('  - db:predictions:*');
    console.log('  - db:models:*');
    return 0;
  }

  let totalDeleted = 0;

  try {
    // Invalidate specific model keys
    await Promise.all([
      cacheDelete(cacheKeys.activeModels()),
      cacheDelete(cacheKeys.activeModelCount()),
      cacheDelete(cacheKeys.topPerformingModel()),
      cacheDelete(cacheKeys.allModelHealth()),
      cacheDelete(cacheKeys.overallStats()),
    ]);
    totalDeleted += 5;

    // Invalidate pattern-based keys
    const patterns = [
      'db:leaderboard:*',
      'db:stats:*',
      'db:model:*:stats',
      'db:predictions:*',
      'db:models:*',
    ];

    for (const pattern of patterns) {
      const deleted = await cacheDeletePattern(pattern);
      totalDeleted += deleted;
      if (isVerbose) {
        console.log(`  ✓ Pattern '${pattern}': deleted ${deleted} keys`);
      }
    }

    console.log(`✓ Invalidated ${totalDeleted} cache keys`);
  } catch (error) {
    console.error('✗ Cache invalidation failed:', error instanceof Error ? error.message : String(error));
  }

  return totalDeleted;
}

/**
 * Post-migration integrity verification
 */
async function verifyIntegrity(db: ReturnType<typeof getDb>): Promise<boolean> {
  console.log('\n--- Step 3: Post-Migration Integrity Verification ---');

  const checks: IntegrityCheck[] = [];

  // Check 1: Orphaned FKs in predictions
  const predictionsOrphans = await db.execute(sql`
    SELECT COUNT(*)::int as orphan_count
    FROM predictions p
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = p.model_id
    )
  `);
  const predOrphanCount = (predictionsOrphans.rows[0] as any)?.orphan_count || 0;
  checks.push({
    name: 'Predictions - Orphaned FKs',
    passed: predOrphanCount === 0,
    count: predOrphanCount,
    expected: 0,
    message: predOrphanCount === 0 ? 'No orphaned FKs' : `${predOrphanCount} orphaned FKs found`,
  });

  // Check 2: Orphaned FKs in llm_model_stats
  const statsOrphans = await db.execute(sql`
    SELECT COUNT(*)::int as orphan_count
    FROM llm_model_stats s
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = s.model_id
    )
  `);
  const statsOrphanCount = (statsOrphans.rows[0] as any)?.orphan_count || 0;
  checks.push({
    name: 'LLM Model Stats - Orphaned FKs',
    passed: statsOrphanCount === 0,
    count: statsOrphanCount,
    expected: 0,
    message: statsOrphanCount === 0 ? 'No orphaned FKs' : `${statsOrphanCount} orphaned FKs found`,
  });

  // Check 3: Orphaned FKs in bets
  const betsOrphans = await db.execute(sql`
    SELECT COUNT(*)::int as orphan_count
    FROM bets b
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = b.model_id
    )
  `);
  const betsOrphanCount = (betsOrphans.rows[0] as any)?.orphan_count || 0;
  checks.push({
    name: 'Bets - Orphaned FKs',
    passed: betsOrphanCount === 0,
    count: betsOrphanCount,
    expected: 0,
    message: betsOrphanCount === 0 ? 'No orphaned FKs' : `${betsOrphanCount} orphaned FKs found`,
  });

  // Check 4: Orphaned FKs in model_balances
  const balancesOrphans = await db.execute(sql`
    SELECT COUNT(*)::int as orphan_count
    FROM model_balances mb
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = mb.model_id
    )
  `);
  const balancesOrphanCount = (balancesOrphans.rows[0] as any)?.orphan_count || 0;
  checks.push({
    name: 'Model Balances - Orphaned FKs',
    passed: balancesOrphanCount === 0,
    count: balancesOrphanCount,
    expected: 0,
    message: balancesOrphanCount === 0 ? 'No orphaned FKs' : `${balancesOrphanCount} orphaned FKs found`,
  });

  // Check 5: Orphaned FKs in model_usage
  const usageOrphans = await db.execute(sql`
    SELECT COUNT(*)::int as orphan_count
    FROM model_usage mu
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = mu.model_id
    )
  `);
  const usageOrphanCount = (usageOrphans.rows[0] as any)?.orphan_count || 0;
  checks.push({
    name: 'Model Usage - Orphaned FKs',
    passed: usageOrphanCount === 0,
    count: usageOrphanCount,
    expected: 0,
    message: usageOrphanCount === 0 ? 'No orphaned FKs' : `${usageOrphanCount} orphaned FKs found`,
  });

  // Check 6: Remaining -syn model_id references in all tables for the 3 consolidated IDs
  const remainingSynRefs = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM predictions WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')) +
      (SELECT COUNT(*)::int FROM llm_model_stats WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')) +
      (SELECT COUNT(*)::int FROM bets WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')) +
      (SELECT COUNT(*)::int FROM model_balances WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')) +
      (SELECT COUNT(*)::int FROM model_usage WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn'))
      AS total_syn_refs
  `);
  const synRefCount = (remainingSynRefs.rows[0] as any)?.total_syn_refs || 0;
  checks.push({
    name: 'Remaining -syn References (3 consolidated IDs)',
    passed: synRefCount === 0,
    count: synRefCount,
    expected: 0,
    message: synRefCount === 0 ? 'All -syn references migrated' : `${synRefCount} -syn references still exist`,
  });

  // Check 7: Unique constraint violations in predictions (match_id, model_id duplicates)
  const uniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT match_id, model_id
      FROM predictions
      GROUP BY match_id, model_id
      HAVING COUNT(*) > 1
    ) duplicates
  `);
  const violationCount = (uniqueViolations.rows[0] as any)?.violation_count || 0;
  checks.push({
    name: 'Predictions - Unique Constraint (match_id, model_id)',
    passed: violationCount === 0,
    count: violationCount,
    expected: 0,
    message: violationCount === 0 ? 'No duplicate predictions' : `${violationCount} duplicate (match_id, model_id) pairs found`,
  });

  // Check 8: Total active models count (for reporting)
  const activeModelsCount = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(models)
    .where(eq(models.active, true));
  const activeCount = activeModelsCount[0]?.count || 0;
  checks.push({
    name: 'Total Active Models',
    passed: true, // Informational only
    count: activeCount,
    expected: -1, // No specific expectation
    message: `${activeCount} models active`,
  });

  // Print results
  console.log('\nIntegrity Check Results:');
  console.log('─'.repeat(80));

  let allPassed = true;
  for (const check of checks) {
    const status = check.passed ? '✓ PASS' : '✗ FAIL';
    const color = check.passed ? '\x1b[32m' : '\x1b[31m'; // Green or Red
    const reset = '\x1b[0m';

    console.log(`${color}${status}${reset} | ${check.name.padEnd(50)} | ${check.message}`);

    if (isVerbose && !check.passed) {
      console.log(`       Expected: ${check.expected}, Got: ${check.count}`);
    }

    if (!check.passed) {
      allPassed = false;
    }
  }

  console.log('─'.repeat(80));

  if (allPassed) {
    console.log('\n✓ All integrity checks PASSED');
  } else {
    console.log('\n✗ Some integrity checks FAILED — review output above');
  }

  return allPassed;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(80));
  console.log('=== Post-Consolidation: Phase 63 ===');
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('\n[DRY RUN MODE] No changes will be made\n');
  }

  const db = getDb();

  // Step 1: Deactivate old models
  const deactivatedCount = await deactivateOldModels(db);

  // Step 2: Invalidate caches
  const cacheCount = await invalidateCaches();

  // Step 3: Verify integrity
  const integrityPassed = await verifyIntegrity(db);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('=== Summary ===');
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('[DRY RUN] Operations that would be performed:');
    console.log(`  - Models deactivated: ${deactivatedCount}`);
    console.log(`  - Cache keys invalidated: ~${cacheCount}+`);
    console.log(`  - Integrity checks: ${integrityPassed ? 'PASS' : 'FAIL'}`);
  } else {
    console.log('Operations completed:');
    console.log(`  ✓ Models deactivated: ${deactivatedCount}`);
    console.log(`  ✓ Cache keys invalidated: ${cacheCount}`);
    console.log(`  ${integrityPassed ? '✓' : '✗'} Integrity checks: ${integrityPassed ? 'PASS' : 'FAIL'}`);
  }

  if (!integrityPassed) {
    console.error('\n✗ Post-consolidation verification FAILED');
    process.exit(1);
  }

  console.log('\n✓ Post-consolidation operations completed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error during post-consolidation:', error);
  process.exit(1);
});
