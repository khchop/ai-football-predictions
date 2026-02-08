/**
 * Forward Migration: Consolidate Synthetic Model IDs
 *
 * Purpose: Phase 62 of v2.9 Provider Unification - consolidate 3 Synthetic model IDs
 * that have both Synthetic-specific IDs (-syn suffix) and base routing IDs.
 *
 * This migration:
 * 1. Deduplicates predictions where both -syn and base model IDs exist for the same match
 * 2. Updates model_id across all 5 FK tables: predictions, llm_model_stats, bets, model_balances, model_usage
 * 3. Validates referential integrity pre/post migration
 * 4. Supports --dry-run mode for safe previewing
 * 5. Is idempotent (safe to run multiple times)
 *
 * Usage:
 *   npx tsx scripts/migrate-consolidate-models.ts              # Execute migration
 *   npx tsx scripts/migrate-consolidate-models.ts --dry-run    # Preview changes
 *   npx tsx scripts/migrate-consolidate-models.ts --verbose    # Show detailed output
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { predictions, llmModelStats, bets, modelBalances, modelUsage, models } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// CONSOLIDATION_MAP: Maps Synthetic-specific model IDs to their base routing IDs
// Only these 3 models consolidate (they exist in both Synthetic and Together providers)
// The other 10 Synthetic-only models will be renamed in Phase 63 (CONS-03/04)
const CONSOLIDATION_MAP: Record<string, string> = {
  'deepseek-r1-0528-syn': 'deepseek-r1',
  'kimi-k2-thinking-syn': 'kimi-k2-thinking',
  'kimi-k2.5-syn': 'kimi-k2.5',
};

interface PreValidationStats {
  tableName: string;
  totalRows: number;
  affectedRows: number;
  conflicts: number;
}

interface DeduplicationResult {
  oldModelId: string;
  newModelId: string;
  deletedCount: number;
  mergedCount?: number; // For stats tables that merge values
}

interface UpdateResult {
  tableName: string;
  updatedRows: number;
}

interface PostValidationResult {
  tableName: string;
  totalRows: number;
  orphanedFKs: number;
  uniqueViolations: number;
}

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Pre-validation: Count total rows, affected rows, and conflicts per table
 */
async function preValidate(db: ReturnType<typeof getDb>): Promise<PreValidationStats[]> {
  console.log('\n--- Pre-Validation ---');

  const stats: PreValidationStats[] = [];

  // predictions table
  const predictionsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(predictions);
  const predictionsAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(predictions)
    .where(sql`${predictions.modelId} IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')`);

  // Detect prediction conflicts: matches where both old and new model_id exist
  const predictionConflicts = await db.execute(sql`
    SELECT COUNT(*)::int as conflict_count
    FROM (
      SELECT match_id,
        CASE
          WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
          WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-thinking'
          WHEN model_id = 'kimi-k2.5-syn' THEN 'kimi-k2.5'
          ELSE model_id
        END as consolidated_model_id
      FROM predictions
      WHERE match_id IN (
        SELECT match_id
        FROM predictions
        WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
      )
    ) consolidated
    GROUP BY match_id, consolidated_model_id
    HAVING COUNT(*) > 1
  `);

  stats.push({
    tableName: 'predictions',
    totalRows: predictionsTotal[0]?.count || 0,
    affectedRows: predictionsAffected[0]?.count || 0,
    conflicts: (predictionConflicts.rows[0] as any)?.conflict_count || 0,
  });

  // llm_model_stats table
  const statsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(llmModelStats);
  const statsAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(llmModelStats)
    .where(sql`${llmModelStats.modelId} IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')`);

  const statsConflicts = await db.execute(sql`
    SELECT COUNT(*)::int as conflict_count
    FROM (
      SELECT date,
        CASE
          WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
          WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-thinking'
          WHEN model_id = 'kimi-k2.5-syn' THEN 'kimi-k2.5'
          ELSE model_id
        END as consolidated_model_id
      FROM llm_model_stats
      WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
         OR model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
    ) consolidated
    GROUP BY date, consolidated_model_id
    HAVING COUNT(*) > 1
  `);

  stats.push({
    tableName: 'llm_model_stats',
    totalRows: statsTotal[0]?.count || 0,
    affectedRows: statsAffected[0]?.count || 0,
    conflicts: (statsConflicts.rows[0] as any)?.conflict_count || 0,
  });

  // bets table
  const betsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(bets);
  const betsAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(bets)
    .where(sql`${bets.modelId} IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')`);

  const betsConflicts = await db.execute(sql`
    SELECT COUNT(*)::int as conflict_count
    FROM (
      SELECT match_id, bet_type,
        CASE
          WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
          WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-thinking'
          WHEN model_id = 'kimi-k2.5-syn' THEN 'kimi-k2.5'
          ELSE model_id
        END as consolidated_model_id
      FROM bets
      WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
         OR model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
    ) consolidated
    GROUP BY match_id, consolidated_model_id, bet_type
    HAVING COUNT(*) > 1
  `);

  stats.push({
    tableName: 'bets',
    totalRows: betsTotal[0]?.count || 0,
    affectedRows: betsAffected[0]?.count || 0,
    conflicts: (betsConflicts.rows[0] as any)?.conflict_count || 0,
  });

  // model_balances table
  const balancesTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelBalances);
  const balancesAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(modelBalances)
    .where(sql`${modelBalances.modelId} IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')`);

  const balancesConflicts = await db.execute(sql`
    SELECT COUNT(*)::int as conflict_count
    FROM (
      SELECT season,
        CASE
          WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
          WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-thinking'
          WHEN model_id = 'kimi-k2.5-syn' THEN 'kimi-k2.5'
          ELSE model_id
        END as consolidated_model_id
      FROM model_balances
      WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
         OR model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
    ) consolidated
    GROUP BY season, consolidated_model_id
    HAVING COUNT(*) > 1
  `);

  stats.push({
    tableName: 'model_balances',
    totalRows: balancesTotal[0]?.count || 0,
    affectedRows: balancesAffected[0]?.count || 0,
    conflicts: (balancesConflicts.rows[0] as any)?.conflict_count || 0,
  });

  // model_usage table
  const usageTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelUsage);
  const usageAffected = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(modelUsage)
    .where(sql`${modelUsage.modelId} IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')`);

  const usageConflicts = await db.execute(sql`
    SELECT COUNT(*)::int as conflict_count
    FROM (
      SELECT date,
        CASE
          WHEN model_id = 'deepseek-r1-0528-syn' THEN 'deepseek-r1'
          WHEN model_id = 'kimi-k2-thinking-syn' THEN 'kimi-k2-thinking'
          WHEN model_id = 'kimi-k2.5-syn' THEN 'kimi-k2.5'
          ELSE model_id
        END as consolidated_model_id
      FROM model_usage
      WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn')
         OR model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5')
    ) consolidated
    GROUP BY date, consolidated_model_id
    HAVING COUNT(*) > 1
  `);

  stats.push({
    tableName: 'model_usage',
    totalRows: usageTotal[0]?.count || 0,
    affectedRows: usageAffected[0]?.count || 0,
    conflicts: (usageConflicts.rows[0] as any)?.conflict_count || 0,
  });

  // Print stats
  for (const stat of stats) {
    console.log(
      `${stat.tableName}: ${stat.totalRows} total, ${stat.affectedRows} affected, ${stat.conflicts} conflicts`
    );
  }

  return stats;
}

/**
 * Deduplication: predictions table
 * For each match with conflicting predictions, keep the newest created_at
 * If created_at is identical, keep the base model_id (not -syn)
 */
async function deduplicatePredictions(db: ReturnType<typeof getDb>): Promise<DeduplicationResult[]> {
  console.log('\n--- Deduplication: predictions ---');

  const results: DeduplicationResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    if (isVerbose) {
      console.log(`Processing ${oldId} → ${newId}...`);
    }

    // Delete older predictions using ROW_NUMBER window function
    // Keep row_num = 1 (newest created_at, or base model_id if tie)
    const deleteResult = await db.execute(sql`
      DELETE FROM predictions
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY match_id
              ORDER BY created_at DESC,
                CASE WHEN model_id = ${newId} THEN 0 ELSE 1 END
            ) as row_num
          FROM predictions
          WHERE match_id IN (
            SELECT match_id
            FROM predictions
            WHERE model_id IN (${oldId}, ${newId})
            GROUP BY match_id
            HAVING COUNT(*) > 1
          )
          AND model_id IN (${oldId}, ${newId})
        ) ranked
        WHERE row_num > 1
      )
    `);

    const deletedCount = deleteResult.rowCount || 0;

    if (deletedCount > 0 || isVerbose) {
      console.log(`  ${oldId} → ${newId}: ${deletedCount} conflicts resolved`);
    }

    results.push({
      oldModelId: oldId,
      newModelId: newId,
      deletedCount,
    });
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  console.log(`Deleted ${totalDeleted} older duplicates`);

  return results;
}

/**
 * Deduplication: llm_model_stats table
 * Merge stats by summing counts, recalculating success_rate, keeping newer updatedAt
 */
async function deduplicateLLMModelStats(db: ReturnType<typeof getDb>): Promise<DeduplicationResult[]> {
  console.log('\n--- Deduplication: llm_model_stats ---');

  const results: DeduplicationResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    if (isVerbose) {
      console.log(`Processing ${oldId} → ${newId}...`);
    }

    // Find conflicts where both old and new exist for same date
    const conflicts = await db.execute(sql`
      SELECT date, COUNT(*) as cnt
      FROM llm_model_stats
      WHERE model_id IN (${oldId}, ${newId})
      GROUP BY date
      HAVING COUNT(*) > 1
    `);

    let mergedCount = 0;

    for (const conflict of conflicts.rows as Array<{ date: string; cnt: number }>) {
      // Merge: sum all counts, recalculate success_rate, keep newer updatedAt
      await db.execute(sql`
        WITH aggregated AS (
          SELECT
            ${conflict.date} as date,
            ${newId} as model_id,
            SUM(success_count) as success_count,
            SUM(failure_count) as failure_count,
            SUM(total_attempts) as total_attempts,
            SUM(timeout_errors) as timeout_errors,
            SUM(parse_errors) as parse_errors,
            SUM(api_errors) as api_errors,
            SUM(language_errors) as language_errors,
            SUM(other_errors) as other_errors,
            MAX(updated_at) as updated_at
          FROM llm_model_stats
          WHERE model_id IN (${oldId}, ${newId})
            AND date = ${conflict.date}
        ),
        calculated AS (
          SELECT *,
            CASE
              WHEN total_attempts > 0 THEN (success_count::float / total_attempts::float * 100)
              ELSE 0
            END as success_rate
          FROM aggregated
        )
        UPDATE llm_model_stats
        SET
          success_count = calculated.success_count,
          failure_count = calculated.failure_count,
          total_attempts = calculated.total_attempts,
          success_rate = calculated.success_rate,
          timeout_errors = calculated.timeout_errors,
          parse_errors = calculated.parse_errors,
          api_errors = calculated.api_errors,
          language_errors = calculated.language_errors,
          other_errors = calculated.other_errors,
          updated_at = calculated.updated_at
        FROM calculated
        WHERE llm_model_stats.date = calculated.date
          AND llm_model_stats.model_id = ${newId}
      `);

      // Delete the old -syn row
      await db.execute(sql`
        DELETE FROM llm_model_stats
        WHERE date = ${conflict.date}
          AND model_id = ${oldId}
      `);

      mergedCount++;
    }

    if (mergedCount > 0 || isVerbose) {
      console.log(`  ${oldId} → ${newId}: ${mergedCount} merged`);
    }

    results.push({
      oldModelId: oldId,
      newModelId: newId,
      deletedCount: mergedCount,
      mergedCount,
    });
  }

  const totalMerged = results.reduce((sum, r) => sum + (r.mergedCount || 0), 0);
  console.log(`Merged ${totalMerged} stat records`);

  return results;
}

/**
 * Deduplication: bets table
 * For same (match_id, consolidated_model_id, bet_type), keep newest created_at
 */
async function deduplicateBets(db: ReturnType<typeof getDb>): Promise<DeduplicationResult[]> {
  console.log('\n--- Deduplication: bets ---');

  const results: DeduplicationResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    if (isVerbose) {
      console.log(`Processing ${oldId} → ${newId}...`);
    }

    const deleteResult = await db.execute(sql`
      DELETE FROM bets
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY match_id, bet_type
              ORDER BY created_at DESC,
                CASE WHEN model_id = ${newId} THEN 0 ELSE 1 END
            ) as row_num
          FROM bets
          WHERE match_id IN (
            SELECT match_id
            FROM bets
            WHERE model_id IN (${oldId}, ${newId})
            GROUP BY match_id, bet_type
            HAVING COUNT(*) > 1
          )
          AND model_id IN (${oldId}, ${newId})
        ) ranked
        WHERE row_num > 1
      )
    `);

    const deletedCount = deleteResult.rowCount || 0;

    if (deletedCount > 0 || isVerbose) {
      console.log(`  ${oldId} → ${newId}: ${deletedCount} conflicts resolved`);
    }

    results.push({
      oldModelId: oldId,
      newModelId: newId,
      deletedCount,
    });
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  console.log(`Deleted ${totalDeleted} older duplicates`);

  return results;
}

/**
 * Deduplication: model_balances table
 * For same (consolidated_model_id, season), sum balances, keep newer updatedAt
 */
async function deduplicateModelBalances(db: ReturnType<typeof getDb>): Promise<DeduplicationResult[]> {
  console.log('\n--- Deduplication: model_balances ---');

  const results: DeduplicationResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    if (isVerbose) {
      console.log(`Processing ${oldId} → ${newId}...`);
    }

    const conflicts = await db.execute(sql`
      SELECT season, COUNT(*) as cnt
      FROM model_balances
      WHERE model_id IN (${oldId}, ${newId})
      GROUP BY season
      HAVING COUNT(*) > 1
    `);

    let mergedCount = 0;

    for (const conflict of conflicts.rows as Array<{ season: string; cnt: number }>) {
      // Merge: sum balance metrics, keep newer updatedAt
      await db.execute(sql`
        WITH aggregated AS (
          SELECT
            ${conflict.season} as season,
            ${newId} as model_id,
            MAX(starting_balance) as starting_balance,
            SUM(current_balance) as current_balance,
            SUM(total_wagered) as total_wagered,
            SUM(total_won) as total_won,
            SUM(total_bets) as total_bets,
            SUM(winning_bets) as winning_bets,
            MAX(updated_at) as updated_at
          FROM model_balances
          WHERE model_id IN (${oldId}, ${newId})
            AND season = ${conflict.season}
        )
        UPDATE model_balances
        SET
          current_balance = aggregated.current_balance,
          total_wagered = aggregated.total_wagered,
          total_won = aggregated.total_won,
          total_bets = aggregated.total_bets,
          winning_bets = aggregated.winning_bets,
          updated_at = aggregated.updated_at
        FROM aggregated
        WHERE model_balances.season = aggregated.season
          AND model_balances.model_id = ${newId}
      `);

      // Delete the old -syn row
      await db.execute(sql`
        DELETE FROM model_balances
        WHERE season = ${conflict.season}
          AND model_id = ${oldId}
      `);

      mergedCount++;
    }

    if (mergedCount > 0 || isVerbose) {
      console.log(`  ${oldId} → ${newId}: ${mergedCount} merged`);
    }

    results.push({
      oldModelId: oldId,
      newModelId: newId,
      deletedCount: mergedCount,
      mergedCount,
    });
  }

  const totalMerged = results.reduce((sum, r) => sum + (r.mergedCount || 0), 0);
  console.log(`Merged ${totalMerged} balance records`);

  return results;
}

/**
 * Deduplication: model_usage table
 * For same (date, consolidated_model_id), sum counts/costs, keep newer updatedAt
 */
async function deduplicateModelUsage(db: ReturnType<typeof getDb>): Promise<DeduplicationResult[]> {
  console.log('\n--- Deduplication: model_usage ---');

  const results: DeduplicationResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    if (isVerbose) {
      console.log(`Processing ${oldId} → ${newId}...`);
    }

    const conflicts = await db.execute(sql`
      SELECT date, COUNT(*) as cnt
      FROM model_usage
      WHERE model_id IN (${oldId}, ${newId})
      GROUP BY date
      HAVING COUNT(*) > 1
    `);

    let mergedCount = 0;

    for (const conflict of conflicts.rows as Array<{ date: string; cnt: number }>) {
      // Merge: sum predictions_count and total_cost, keep newer updatedAt
      await db.execute(sql`
        WITH aggregated AS (
          SELECT
            ${conflict.date} as date,
            ${newId} as model_id,
            SUM(predictions_count) as predictions_count,
            SUM(CAST(total_cost AS DECIMAL)) as total_cost,
            MAX(updated_at) as updated_at
          FROM model_usage
          WHERE model_id IN (${oldId}, ${newId})
            AND date = ${conflict.date}
        )
        UPDATE model_usage
        SET
          predictions_count = aggregated.predictions_count,
          total_cost = CAST(aggregated.total_cost AS TEXT),
          updated_at = aggregated.updated_at
        FROM aggregated
        WHERE model_usage.date = aggregated.date
          AND model_usage.model_id = ${newId}
      `);

      // Delete the old -syn row
      await db.execute(sql`
        DELETE FROM model_usage
        WHERE date = ${conflict.date}
          AND model_id = ${oldId}
      `);

      mergedCount++;
    }

    if (mergedCount > 0 || isVerbose) {
      console.log(`  ${oldId} → ${newId}: ${mergedCount} merged`);
    }

    results.push({
      oldModelId: oldId,
      newModelId: newId,
      deletedCount: mergedCount,
      mergedCount,
    });
  }

  const totalMerged = results.reduce((sum, r) => sum + (r.mergedCount || 0), 0);
  console.log(`Merged ${totalMerged} usage records`);

  return results;
}

/**
 * Ensure base model rows exist in models table
 * Required because FK constraints enforce model_id references
 */
async function ensureBaseModelRows(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('\n--- Ensuring Base Model Rows Exist ---');

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    // Check if base model row exists
    const existing = await db
      .select({ id: models.id })
      .from(models)
      .where(sql`${models.id} = ${newId}`);

    if (existing.length === 0) {
      // Get the -syn model's attributes to copy
      const synModel = await db
        .select({
          provider: models.provider,
          modelName: models.modelName,
          displayName: models.displayName,
          modelDescription: models.modelDescription,
          isPremium: models.isPremium,
          active: models.active,
        })
        .from(models)
        .where(sql`${models.id} = ${oldId}`);

      if (synModel.length > 0) {
        const attrs = synModel[0];
        // Insert base model row using attributes from -syn model
        await db.execute(sql`
          INSERT INTO models (
            id, provider, model_name, display_name, model_description, is_premium, active
          ) VALUES (
            ${newId},
            ${attrs.provider},
            ${attrs.modelName},
            ${attrs.displayName?.replace('-syn', '') || newId},
            ${attrs.modelDescription},
            ${attrs.isPremium},
            ${attrs.active}
          )
        `);
        console.log(`  ✓ Created base model row: ${newId}`);
      } else {
        console.log(`  ⚠️  Warning: ${oldId} not found in models table, skipping ${newId} creation`);
      }
    } else {
      if (isVerbose) {
        console.log(`  ✓ Base model already exists: ${newId}`);
      }
    }
  }
}

/**
 * Update model_id across all tables
 */
async function updateModelIds(db: ReturnType<typeof getDb>): Promise<UpdateResult[]> {
  console.log('\n--- Model ID Update ---');

  const results: UpdateResult[] = [];

  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    // predictions
    const predictionsResult = await db.execute(sql`
      UPDATE predictions
      SET model_id = ${newId}
      WHERE model_id = ${oldId}
    `);

    // llm_model_stats
    const statsResult = await db.execute(sql`
      UPDATE llm_model_stats
      SET model_id = ${newId}
      WHERE model_id = ${oldId}
    `);

    // bets
    const betsResult = await db.execute(sql`
      UPDATE bets
      SET model_id = ${newId}
      WHERE model_id = ${oldId}
    `);

    // model_balances
    const balancesResult = await db.execute(sql`
      UPDATE model_balances
      SET model_id = ${newId}
      WHERE model_id = ${oldId}
    `);

    // model_usage
    const usageResult = await db.execute(sql`
      UPDATE model_usage
      SET model_id = ${newId}
      WHERE model_id = ${oldId}
    `);

    const totalUpdated =
      (predictionsResult.rowCount || 0) +
      (statsResult.rowCount || 0) +
      (betsResult.rowCount || 0) +
      (balancesResult.rowCount || 0) +
      (usageResult.rowCount || 0);

    if (isVerbose) {
      console.log(`${oldId} → ${newId}:`);
      console.log(`  predictions: ${predictionsResult.rowCount || 0} rows`);
      console.log(`  llm_model_stats: ${statsResult.rowCount || 0} rows`);
      console.log(`  bets: ${betsResult.rowCount || 0} rows`);
      console.log(`  model_balances: ${balancesResult.rowCount || 0} rows`);
      console.log(`  model_usage: ${usageResult.rowCount || 0} rows`);
    } else {
      console.log(`${oldId} → ${newId}: ${totalUpdated} rows updated across all tables`);
    }
  }

  return results;
}

/**
 * Post-validation: Check row counts, orphaned FKs, unique constraints
 */
async function postValidate(
  db: ReturnType<typeof getDb>,
  preStats: PreValidationStats[]
): Promise<PostValidationResult[]> {
  console.log('\n--- Post-Validation ---');

  const results: PostValidationResult[] = [];

  // predictions table
  const predictionsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(predictions);

  // Check for orphaned FKs (predictions.model_id NOT IN models.id)
  const predictionsOrphaned = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM predictions p
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = p.model_id
    )
  `);

  // Check unique constraint (match_id, model_id)
  const predictionsUniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT match_id, model_id, COUNT(*)
      FROM predictions
      GROUP BY match_id, model_id
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  const predictionsPre = preStats.find(s => s.tableName === 'predictions');
  const predictionsExpectedDelta = predictionsPre?.conflicts || 0;
  const predictionsActualDelta = (predictionsPre?.totalRows || 0) - (predictionsTotal[0]?.count || 0);

  results.push({
    tableName: 'predictions',
    totalRows: predictionsTotal[0]?.count || 0,
    orphanedFKs: (predictionsOrphaned.rows[0] as any)?.orphaned_count || 0,
    uniqueViolations: (predictionsUniqueViolations.rows[0] as any)?.violation_count || 0,
  });

  console.log(
    `predictions: ${predictionsTotal[0]?.count || 0} rows (delta: ${predictionsActualDelta}, expected: ${predictionsExpectedDelta})`
  );

  // llm_model_stats table
  const statsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(llmModelStats);

  const statsOrphaned = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM llm_model_stats s
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = s.model_id
    )
  `);

  const statsUniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT date, model_id, COUNT(*)
      FROM llm_model_stats
      GROUP BY date, model_id
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  results.push({
    tableName: 'llm_model_stats',
    totalRows: statsTotal[0]?.count || 0,
    orphanedFKs: (statsOrphaned.rows[0] as any)?.orphaned_count || 0,
    uniqueViolations: (statsUniqueViolations.rows[0] as any)?.violation_count || 0,
  });

  console.log(`llm_model_stats: ${statsTotal[0]?.count || 0} rows`);

  // bets table
  const betsTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(bets);

  const betsOrphaned = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM bets b
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = b.model_id
    )
  `);

  const betsUniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT match_id, model_id, bet_type, COUNT(*)
      FROM bets
      GROUP BY match_id, model_id, bet_type
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  results.push({
    tableName: 'bets',
    totalRows: betsTotal[0]?.count || 0,
    orphanedFKs: (betsOrphaned.rows[0] as any)?.orphaned_count || 0,
    uniqueViolations: (betsUniqueViolations.rows[0] as any)?.violation_count || 0,
  });

  console.log(`bets: ${betsTotal[0]?.count || 0} rows`);

  // model_balances table
  const balancesTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelBalances);

  const balancesOrphaned = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM model_balances b
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = b.model_id
    )
  `);

  const balancesUniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT model_id, season, COUNT(*)
      FROM model_balances
      GROUP BY model_id, season
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  results.push({
    tableName: 'model_balances',
    totalRows: balancesTotal[0]?.count || 0,
    orphanedFKs: (balancesOrphaned.rows[0] as any)?.orphaned_count || 0,
    uniqueViolations: (balancesUniqueViolations.rows[0] as any)?.violation_count || 0,
  });

  console.log(`model_balances: ${balancesTotal[0]?.count || 0} rows`);

  // model_usage table
  const usageTotal = await db.select({ count: sql<number>`COUNT(*)::int` }).from(modelUsage);

  const usageOrphaned = await db.execute(sql`
    SELECT COUNT(*)::int as orphaned_count
    FROM model_usage u
    WHERE NOT EXISTS (
      SELECT 1 FROM models m WHERE m.id = u.model_id
    )
  `);

  const usageUniqueViolations = await db.execute(sql`
    SELECT COUNT(*)::int as violation_count
    FROM (
      SELECT date, model_id, COUNT(*)
      FROM model_usage
      GROUP BY date, model_id
      HAVING COUNT(*) > 1
    ) duplicates
  `);

  results.push({
    tableName: 'model_usage',
    totalRows: usageTotal[0]?.count || 0,
    orphanedFKs: (usageOrphaned.rows[0] as any)?.orphaned_count || 0,
    uniqueViolations: (usageUniqueViolations.rows[0] as any)?.violation_count || 0,
  });

  console.log(`model_usage: ${usageTotal[0]?.count || 0} rows`);

  // Summary validation checks
  console.log('\n--- Validation Summary ---');

  const hasUniqueViolations = results.some(r => r.uniqueViolations > 0);
  const totalOrphanedFKs = results.reduce((sum, r) => sum + r.orphanedFKs, 0);

  if (hasUniqueViolations) {
    console.log('❌ FAIL: Unique constraint violations detected');
  } else {
    console.log('✅ PASS: No unique constraint violations');
  }

  if (totalOrphanedFKs > 0) {
    console.log(
      `⚠️  EXPECTED: ${totalOrphanedFKs} orphaned FKs (Phase 63 will update models table)`
    );
  } else {
    console.log('✅ No orphaned FKs');
  }

  return results;
}

/**
 * Main migration orchestration
 */
async function main() {
  console.log('=== Phase 62: Model Consolidation Migration ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Verbose: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log('\nConsolidating 3 Synthetic model IDs:');
  for (const [oldId, newId] of Object.entries(CONSOLIDATION_MAP)) {
    console.log(`  ${oldId} → ${newId}`);
  }

  const db = getDb();
  let success = false;

  try {
    // Begin transaction
    await db.execute(sql`BEGIN`);
    console.log('\n✓ Transaction started');

    // Defer FK constraint checking until end of transaction
    // This allows updating model_id to values that don't exist in models table yet
    // (Phase 63 will create the base model entries)
    await db.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
    console.log('✓ FK constraints deferred');

    // 1. Pre-validation
    const preStats = await preValidate(db);

    // 2. Ensure base model rows exist (required for FK constraints)
    await ensureBaseModelRows(db);

    // 3. Deduplication phase
    console.log('\n--- Deduplication Phase ---');
    await deduplicatePredictions(db);
    await deduplicateLLMModelStats(db);
    await deduplicateBets(db);
    await deduplicateModelBalances(db);
    await deduplicateModelUsage(db);

    // 4. Update phase
    await updateModelIds(db);

    // 5. Post-validation
    const postResults = await postValidate(db, preStats);

    // 6. Validation checks
    const hasUniqueViolations = postResults.some(r => r.uniqueViolations > 0);

    if (hasUniqueViolations) {
      throw new Error('Post-validation failed: unique constraint violations detected');
    }

    success = true;

    // 7. Commit or rollback
    if (isDryRun) {
      await db.execute(sql`ROLLBACK`);
      console.log('\n🔄 DRY RUN: All changes rolled back');
    } else {
      await db.execute(sql`COMMIT`);
      console.log('\n✅ Migration committed successfully');
    }
  } catch (error: any) {
    await db.execute(sql`ROLLBACK`);
    console.error('\n❌ Migration failed:', error.message);
    console.log('🔄 All changes rolled back');
    throw error;
  }

  if (success) {
    console.log('\n=== Migration Complete ===');
    if (isDryRun) {
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('All model IDs consolidated successfully.');
      console.log('Next: Run Phase 63 to update models table.');
    }
  }
}

// Run migration
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
