#!/usr/bin/env tsx
/**
 * Data Migration: Recalculate Historical Accuracy Stats
 *
 * Purpose: Fix inflated accuracy numbers (94% -> 87%) by applying the corrected
 * formula from Phase 5 (tendencyPoints > 0 instead of IS NOT NULL).
 *
 * This script:
 * 1. Creates snapshot table stats_pre_migration for rollback reference
 * 2. Generates verification report comparing before/after accuracy values
 * 3. Invalidates all stats-related caches
 *
 * Note: The formula is already fixed in queries (Phase 5). This migration
 * documents the impact and preserves pre-migration state for reference.
 *
 * Run: npx tsx scripts/recalculate-accuracy.ts
 * Dry-run: npx tsx scripts/recalculate-accuracy.ts --dry-run
 */

import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

// Parse CLI args
const isDryRun = process.argv.includes('--dry-run');

interface VerificationReport {
  migrationDate: string;
  totalModels: number;
  flaggedModels: number;  // delta > 15
  summary: {
    avgDelta: number;
    maxDelta: number;
    minDelta: number;
  };
  models: Array<{
    modelId: string;
    displayName: string;
    oldAccuracy: number;
    newAccuracy: number;
    delta: number;
    scoredPredictions: number;
    flagged: boolean;
  }>;
}

interface ModelStats {
  model_id: string;
  display_name: string;
  scored_predictions: number;
  correct_tendencies: number;
  old_accuracy: number;
  new_accuracy: number;
}

/**
 * Import cache functions dynamically (for script execution context)
 */
async function getCacheFunctions() {
  try {
    // Import Redis client and cache functions
    const { getRedis, cacheDeletePattern, cacheDelete } = await import('../src/lib/cache/redis');
    return { getRedis, cacheDeletePattern, cacheDelete };
  } catch (error) {
    console.warn('⚠️  Warning: Could not import cache functions. Cache invalidation will be skipped.');
    console.warn(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Invalidate all stats-related caches after migration
 */
async function invalidateCaches(): Promise<void> {
  console.log('\n🗑️  Invalidating caches...');

  const cacheFns = await getCacheFunctions();
  if (!cacheFns) {
    console.log('   ⚠️  Cache invalidation skipped (functions not available)');
    return;
  }

  const { getRedis, cacheDeletePattern, cacheDelete } = cacheFns;
  const redis = getRedis();

  if (!redis) {
    console.log('   ⚠️  Redis not configured - cache invalidation skipped');
    return;
  }

  try {
    // Import cacheKeys helper
    const { cacheKeys } = await import('../src/lib/cache/redis');

    const results = await Promise.all([
      cacheDeletePattern('db:leaderboard:*'),
      cacheDelete(cacheKeys.overallStats()),
      cacheDelete(cacheKeys.topPerformingModel()),
      cacheDeletePattern('db:model:*:stats'),
    ]);

    const totalDeleted = results.reduce((sum: number, count) => sum + (typeof count === 'number' ? count : (count ? 1 : 0)), 0);
    console.log(`   ✅ Invalidated ${totalDeleted} cache keys`);
    console.log('   - db:leaderboard:* (all filter combinations)');
    console.log('   - db:stats:overall');
    console.log('   - db:models:top-performing');
    console.log('   - db:model:*:stats (all model stats)');
  } catch (error) {
    console.error(`   ❌ Error invalidating caches: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Check if migration has already run
 */
async function checkMigrationStatus(pool: Pool): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'stats_pre_migration'
    ) as exists;
  `);

  return result.rows[0].exists;
}

/**
 * Create snapshot table with pre-migration accuracy values
 */
async function createSnapshot(pool: Pool): Promise<number> {
  console.log('\n📸 Creating pre-migration snapshot...');

  // Drop existing snapshot if it exists (for reruns)
  await pool.query('DROP TABLE IF EXISTS stats_pre_migration CASCADE;');

  // Create snapshot with old accuracy calculation (IS NOT NULL)
  await pool.query(`
    CREATE TABLE stats_pre_migration AS
    SELECT
      m.id as model_id,
      m.display_name,
      COUNT(p.id) FILTER (WHERE p.status = 'scored') as scored_predictions,
      SUM(CASE WHEN p.tendency_points IS NOT NULL THEN 1 ELSE 0 END) as correct_tendencies_old,
      COALESCE(ROUND(100.0 * SUM(CASE WHEN p.tendency_points IS NOT NULL THEN 1 ELSE 0 END)
        / NULLIF(COUNT(p.id) FILTER (WHERE p.status = 'scored'), 0)::numeric, 1), 0) as old_accuracy,
      now() as snapshot_created_at
    FROM models m
    LEFT JOIN predictions p ON p.model_id = m.id
    WHERE m.active = true
    GROUP BY m.id, m.display_name;
  `);

  // Create index for fast lookups
  await pool.query(`
    CREATE INDEX idx_stats_pre_migration_model ON stats_pre_migration(model_id);
  `);

  // Get row count
  const countResult = await pool.query('SELECT COUNT(*) as count FROM stats_pre_migration;');
  const modelCount = parseInt(countResult.rows[0].count);

  console.log(`   ✅ Snapshot created with ${modelCount} models`);

  return modelCount;
}

/**
 * Generate verification report comparing old vs new accuracy
 */
async function generateVerificationReport(pool: Pool): Promise<VerificationReport> {
  console.log('\n📊 Generating verification report...');

  // Query both old (from snapshot) and new (live calculation with > 0 formula)
  const result = await pool.query<ModelStats>(`
    SELECT
      s.model_id,
      s.display_name,
      s.scored_predictions::integer,
      SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END)::integer as correct_tendencies,
      s.old_accuracy::numeric as old_accuracy,
      COALESCE(ROUND(100.0 * SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END)
        / NULLIF(s.scored_predictions, 0)::numeric, 1), 0)::numeric as new_accuracy
    FROM stats_pre_migration s
    LEFT JOIN predictions p ON p.model_id = s.model_id AND p.status = 'scored'
    GROUP BY s.model_id, s.display_name, s.scored_predictions, s.old_accuracy
    ORDER BY s.display_name;
  `);

  // Calculate deltas and flag large changes
  const models = result.rows.map(row => {
    const oldAccuracy = parseFloat(row.old_accuracy.toString());
    const newAccuracy = parseFloat(row.new_accuracy.toString());
    const delta = newAccuracy - oldAccuracy;

    return {
      modelId: row.model_id,
      displayName: row.display_name,
      oldAccuracy,
      newAccuracy,
      delta: parseFloat(delta.toFixed(1)),
      scoredPredictions: row.scored_predictions,
      flagged: Math.abs(delta) > 15,
    };
  });

  // Calculate summary statistics
  const deltas = models.map(m => m.delta);
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const maxDelta = Math.max(...deltas);
  const minDelta = Math.min(...deltas);
  const flaggedModels = models.filter(m => m.flagged).length;

  const report: VerificationReport = {
    migrationDate: new Date().toISOString(),
    totalModels: models.length,
    flaggedModels,
    summary: {
      avgDelta: parseFloat(avgDelta.toFixed(1)),
      maxDelta: parseFloat(maxDelta.toFixed(1)),
      minDelta: parseFloat(minDelta.toFixed(1)),
    },
    models,
  };

  console.log(`   ✅ Report generated for ${models.length} models`);
  console.log(`   Average delta: ${report.summary.avgDelta}% (expected: negative)`);
  console.log(`   Max delta: ${report.summary.maxDelta}%`);
  console.log(`   Min delta: ${report.summary.minDelta}%`);
  console.log(`   Flagged models (|delta| > 15): ${flaggedModels}`);

  // Warn if any increases detected
  const increases = models.filter(m => m.delta > 0);
  if (increases.length > 0) {
    console.log(`   ⚠️  WARNING: ${increases.length} models show accuracy INCREASE:`);
    increases.slice(0, 5).forEach(m => {
      console.log(`      - ${m.displayName}: ${m.oldAccuracy}% -> ${m.newAccuracy}% (+${m.delta}%)`);
    });
  }

  return report;
}

/**
 * Save verification report to disk
 */
function saveVerificationReport(report: VerificationReport): void {
  const outputDir = join(process.cwd(), '.planning', 'phases', '06-data-migration');
  const outputPath = join(outputDir, 'verification-report.json');

  // Ensure directory exists
  mkdirSync(outputDir, { recursive: true });

  // Write report
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n💾 Verification report saved:`);
  console.log(`   ${outputPath}`);
}

/**
 * Main migration execution
 */
async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set');
    console.error('   Set it in .env.local or export it before running this script');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  console.log(`   ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    // Check if migration already ran
    const alreadyRan = await checkMigrationStatus(pool);
    if (alreadyRan && !isDryRun) {
      console.log('\n✅ Migration already completed (stats_pre_migration table exists)');
      console.log('   To re-run, drop the table: DROP TABLE stats_pre_migration CASCADE;');
      process.exit(0);
    }

    if (isDryRun) {
      console.log('\n🧪 DRY RUN MODE - No changes will be made\n');

      // Count models
      const countResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM models
        WHERE active = true;
      `);
      const modelCount = parseInt(countResult.rows[0].count);

      console.log('Would perform the following:');
      console.log(`  1. Create snapshot table with ${modelCount} models`);
      console.log('  2. Generate verification report comparing old vs new accuracy');
      console.log('  3. Save report to .planning/phases/06-data-migration/verification-report.json');
      console.log('  4. Invalidate cache patterns:');
      console.log('     - db:leaderboard:*');
      console.log('     - db:stats:overall');
      console.log('     - db:models:top-performing');
      console.log('     - db:model:*:stats');

      console.log('\n✅ Dry run complete');
      return;
    }

    // Execute migration steps
    const modelCount = await createSnapshot(pool);
    const report = await generateVerificationReport(pool);
    saveVerificationReport(report);
    await invalidateCaches();

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Snapshot: stats_pre_migration (${modelCount} models)`);
    console.log(`   Report: .planning/phases/06-data-migration/verification-report.json`);
    console.log(`   Avg accuracy change: ${report.summary.avgDelta}%`);

    if (report.summary.avgDelta > 0) {
      console.log('\n⚠️  WARNING: Average accuracy INCREASED - this is unexpected!');
      console.log('   Expected: negative delta (accuracy should drop due to > 0 formula)');
      console.log('   Review verification report for details.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
