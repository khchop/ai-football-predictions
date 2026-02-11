/**
 * Migrate Model IDs to OpenRouter (-or) IDs
 *
 * Purpose: Quick tasks 040/041 created new model IDs with -or suffix but didn't
 * migrate prediction history from old IDs. This script renames old model IDs to
 * their new -or counterparts across all database tables.
 *
 * Handles:
 * 1. Direct renames: old-id → old-id-or (26 models)
 * 2. Together variant renames: old-turbo/lite/reference → base-or (10 models)
 * 3. Conflict deduplication: when both old and new have predictions for same match
 * 4. All 5 FK tables: predictions, llm_model_stats, bets, model_balances, model_usage
 *
 * Usage:
 *   npx tsx scripts/migrate-to-openrouter-ids.ts --dry-run --verbose  # Preview
 *   npx tsx scripts/migrate-to-openrouter-ids.ts --verbose            # Execute
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

// Complete mapping: old model ID → new -or model ID
const RENAME_MAP: Record<string, string> = {
  // Direct renames (old base ID → -or ID)
  'cogito-671b': 'cogito-671b-or',
  'deepseek-r1': 'deepseek-r1-or',
  'deepseek-v3-0324': 'deepseek-v3-0324-or',
  'deepseek-v3.1': 'deepseek-v3.1-or',
  'deepseek-v3.1-terminus': 'deepseek-v3.1-terminus-or',
  'deepseek-v3.2': 'deepseek-v3.2-or',
  'gemma-3n-e4b': 'gemma-3n-e4b-or',
  'glm-4.6': 'glm-4.6-or',
  'glm-4.7': 'glm-4.7-or',
  'gpt-oss-120b': 'gpt-oss-120b-or',
  'gpt-oss-20b': 'gpt-oss-20b-or',
  'kimi-k2-0905': 'kimi-k2-0905-or',
  'kimi-k2-instruct': 'kimi-k2-instruct-or',
  'kimi-k2.5': 'kimi-k2.5-or',
  'kimi-k2-thinking': 'kimi-k2-thinking', // stays same, no -or version
  'llama-4-maverick': 'llama-4-maverick-or',
  'llama-4-scout': 'llama-4-scout-or',
  'minimax-m2': 'minimax-m2-or',
  'minimax-m2.1': 'minimax-m2.1-or',
  'ministral-3-14b': 'ministral-3-14b-or',
  'mistral-7b-v0.2': 'mistral-7b-v0.2-or',
  'mistral-7b-v0.3': 'mistral-7b-v0.3-or',
  'mistral-small-3-24b': 'mistral-small-3-24b-or',
  'nemotron-nano-9b-v2': 'nemotron-nano-9b-v2-or',
  'qwen3-235b-thinking': 'qwen3-235b-thinking-or',
  'qwen3-coder-480b': 'qwen3-coder-480b-or',
  'rnj-1-instruct': 'rnj-1-instruct-or',

  // Together variant renames (turbo/lite/reference → standard -or)
  'llama-3.1-8b-turbo': 'llama-3.1-8b-or',
  'llama-3.3-70b-turbo': 'llama-3.3-70b-or',
  'qwen2.5-7b-turbo': 'qwen2.5-7b-or',
  'qwen2.5-72b-turbo': 'qwen2.5-72b-or',
  'llama-3.2-3b-turbo': 'llama-3.2-3b-or',
  'llama-3-8b-lite': 'llama-3-8b-or',
  'llama-3-70b-reference': 'llama-3-70b-or',
  'qwen3-next-80b-instruct': 'qwen3-next-80b-or',
  'llama-3.1-405b-turbo': 'llama-3.1-405b-or',
  'qwen3-235b-instruct': 'qwen3-235b-or',
};

// Remove no-op entries (same old and new)
for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
  if (oldId === newId) {
    delete RENAME_MAP[oldId];
  }
}

const FK_TABLES = ['predictions', 'llm_model_stats', 'bets', 'model_balances', 'model_usage'] as const;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

async function main() {
  const db = getDb();

  console.log('================================================================================');
  console.log('=== Migrate Model IDs to OpenRouter (-or) IDs ===');
  console.log('================================================================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Verbose: ${isVerbose ? 'ON' : 'OFF'}`);
  console.log(`\nRenaming ${Object.keys(RENAME_MAP).length} model IDs:\n`);

  for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
    console.log(`  ${oldId} → ${newId}`);
  }

  // Pre-validation: count rows to be affected per model
  console.log('\n--- Pre-Validation ---');
  let totalAffected = 0;
  let totalConflicts = 0;

  for (const table of FK_TABLES) {
    let tableAffected = 0;
    let tableConflicts = 0;
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const affected = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM ${sql.identifier(table)} WHERE model_id = ${oldId}
      `);
      const cnt = Number((affected.rows[0] as any).cnt);
      tableAffected += cnt;

      if (table === 'predictions' && cnt > 0) {
        const conflictResult = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM predictions p1
          WHERE p1.model_id = ${oldId}
          AND EXISTS (
            SELECT 1 FROM predictions p2
            WHERE p2.match_id = p1.match_id AND p2.model_id = ${newId}
          )
        `);
        const conflicts = Number((conflictResult.rows[0] as any).cnt);
        tableConflicts += conflicts;
      }
    }
    if (table === 'predictions') {
      console.log(`${table}: ${tableAffected} affected, ${tableConflicts} conflicts`);
      totalConflicts += tableConflicts;
    } else {
      console.log(`${table}: ${tableAffected} affected`);
    }
    totalAffected += tableAffected;
  }
  console.log(`\nTotal: ${totalAffected} rows to migrate, ${totalConflicts} conflicts to resolve`);

  if (totalAffected === 0) {
    console.log('\nNothing to migrate. Exiting.');
    process.exit(0);
  }

  // Execute migration in transaction
  console.log(`\n--- ${isDryRun ? 'DRY RUN ' : ''}Migration ---`);

  await db.execute(sql`BEGIN`);
  try {
    await db.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
    console.log('✓ Transaction started, FK constraints deferred');

    // Step 1: Ensure target model rows exist in models table
    console.log('\n--- Ensuring Target Model Rows Exist ---');
    const targetIds = [...new Set(Object.values(RENAME_MAP))];
    for (const targetId of targetIds) {
      const exists = await db.execute(sql`
        SELECT id, active FROM models WHERE id = ${targetId}
      `);
      if (exists.rows.length === 0) {
        console.log(`  ⚠ Target model row missing: ${targetId} — will create stub`);
        // Find an old model to copy from
        const oldId = Object.entries(RENAME_MAP).find(([_, v]) => v === targetId)?.[0];
        if (oldId) {
          await db.execute(sql`
            INSERT INTO models (id, name, provider, active, created_at, updated_at)
            SELECT ${targetId}, name, 'openrouter', true, NOW(), NOW()
            FROM models WHERE id = ${oldId}
            ON CONFLICT (id) DO NOTHING
          `);
          console.log(`  ✓ Created stub for ${targetId} from ${oldId}`);
        }
      } else {
        const row = exists.rows[0] as any;
        if (!row.active) {
          await db.execute(sql`UPDATE models SET active = true WHERE id = ${targetId}`);
          console.log(`  ✓ Reactivated ${targetId}`);
        } else if (isVerbose) {
          console.log(`  ✓ ${targetId} already exists and active`);
        }
      }
    }

    // Step 2: Resolve conflicts in predictions (delete old where new exists for same match)
    console.log('\n--- Deduplication: predictions ---');
    let totalDeduped = 0;
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        DELETE FROM predictions
        WHERE model_id = ${oldId}
        AND match_id IN (
          SELECT match_id FROM predictions WHERE model_id = ${newId}
        )
      `);
      const deleted = result.rowCount || 0;
      if (deleted > 0 || isVerbose) {
        console.log(`  ${oldId} → ${newId}: ${deleted} conflicts resolved`);
      }
      totalDeduped += deleted;
    }
    console.log(`Deleted ${totalDeduped} older duplicate predictions`);

    // Step 3: Resolve conflicts in llm_model_stats (merge)
    console.log('\n--- Deduplication: llm_model_stats ---');
    let totalStatsMerged = 0;
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      // Delete old stats where new stats exist for same date
      const result = await db.execute(sql`
        DELETE FROM llm_model_stats
        WHERE model_id = ${oldId}
        AND date IN (
          SELECT date FROM llm_model_stats WHERE model_id = ${newId}
        )
      `);
      const deleted = result.rowCount || 0;
      if (deleted > 0 || isVerbose) {
        console.log(`  ${oldId} → ${newId}: ${deleted} merged`);
      }
      totalStatsMerged += deleted;
    }
    console.log(`Merged ${totalStatsMerged} stat records`);

    // Step 4: Resolve conflicts in bets
    console.log('\n--- Deduplication: bets ---');
    let totalBetsDeduped = 0;
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      const result = await db.execute(sql`
        DELETE FROM bets
        WHERE model_id = ${oldId}
        AND match_id IN (
          SELECT match_id FROM bets WHERE model_id = ${newId}
        )
      `);
      const deleted = result.rowCount || 0;
      if (deleted > 0) {
        console.log(`  ${oldId} → ${newId}: ${deleted} conflicts resolved`);
      }
      totalBetsDeduped += deleted;
    }
    console.log(`Deleted ${totalBetsDeduped} older duplicate bets`);

    // Step 5: Rename model_id in all FK tables
    console.log('\n--- Model ID Rename ---');
    for (const [oldId, newId] of Object.entries(RENAME_MAP)) {
      let anyUpdated = false;
      for (const table of FK_TABLES) {
        const result = await db.execute(sql`
          UPDATE ${sql.identifier(table)}
          SET model_id = ${newId}
          WHERE model_id = ${oldId}
        `);
        const updated = result.rowCount || 0;
        if (updated > 0) {
          anyUpdated = true;
          if (isVerbose) {
            console.log(`  ${oldId} → ${newId} in ${table}: ${updated} rows`);
          }
        }
      }
      if (anyUpdated && !isVerbose) {
        console.log(`  ✓ ${oldId} → ${newId}`);
      }
    }

    // Step 6: Deactivate old model rows that have no more references
    console.log('\n--- Deactivate Old Model Rows ---');
    const oldIds = Object.keys(RENAME_MAP);
    let deactivated = 0;
    for (const oldId of oldIds) {
      // Check if any FK tables still reference this old ID
      const remaining = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM predictions WHERE model_id = ${oldId})::int +
          (SELECT COUNT(*) FROM llm_model_stats WHERE model_id = ${oldId})::int +
          (SELECT COUNT(*) FROM bets WHERE model_id = ${oldId})::int +
          (SELECT COUNT(*) FROM model_balances WHERE model_id = ${oldId})::int +
          (SELECT COUNT(*) FROM model_usage WHERE model_id = ${oldId})::int
        as total
      `);
      const total = Number((remaining.rows[0] as any).total);
      if (total === 0) {
        await db.execute(sql`UPDATE models SET active = false WHERE id = ${oldId}`);
        deactivated++;
      } else if (isVerbose) {
        console.log(`  ⚠ ${oldId} still has ${total} references, keeping`);
      }
    }
    console.log(`Deactivated ${deactivated} old model rows`);

    // Post-validation
    console.log('\n--- Post-Validation ---');
    let remainingRows: { model_id: string; cnt: number }[] = [];
    for (const oldId of Object.keys(RENAME_MAP)) {
      const r = await db.execute(sql`
        SELECT model_id, COUNT(*) as cnt FROM predictions
        WHERE model_id = ${oldId} GROUP BY model_id
      `);
      if (r.rows.length > 0 && Number((r.rows[0] as any).cnt) > 0) {
        remainingRows.push({ model_id: oldId, cnt: Number((r.rows[0] as any).cnt) });
      }
    }
    const remainingOld = { rows: remainingRows };
    if (remainingOld.rows.length === 0) {
      console.log('✅ PASS: No old model IDs remain in predictions');
    } else {
      console.log('❌ FAIL: Old model IDs still in predictions:');
      for (const row of remainingOld.rows) {
        console.log(`  ${row.model_id}: ${row.cnt}`);
      }
    }

    // Check orphaned FKs
    const orphaned = await db.execute(sql`
      SELECT p.model_id, COUNT(*) as cnt
      FROM predictions p
      LEFT JOIN models m ON m.id = p.model_id
      WHERE m.id IS NULL
      GROUP BY p.model_id
    `);
    if (orphaned.rows.length === 0) {
      console.log('✅ PASS: No orphaned FK references in predictions');
    } else {
      console.log('❌ FAIL: Orphaned FK references:');
      for (const row of orphaned.rows) {
        console.log(`  ${row.model_id}: ${row.cnt}`);
      }
    }

    // Count active models with predictions
    const activeWithPreds = await db.execute(sql`
      SELECT COUNT(DISTINCT p.model_id) as cnt
      FROM predictions p
      JOIN models m ON m.id = p.model_id AND m.active = true
    `);
    console.log(`✅ Active models with predictions: ${(activeWithPreds.rows[0] as any).cnt}`);

    // Total prediction count
    const totalPreds = await db.execute(sql`SELECT COUNT(*) as cnt FROM predictions`);
    console.log(`✅ Total predictions: ${(totalPreds.rows[0] as any).cnt}`);

    if (isDryRun) {
      await db.execute(sql`ROLLBACK`);
      console.log('\n🔄 DRY RUN: All changes rolled back');
    } else {
      await db.execute(sql`COMMIT`);
      console.log('\n✅ Migration committed successfully');
    }
  } catch (error) {
    await db.execute(sql`ROLLBACK`);
    console.error('\n❌ Migration failed, all changes rolled back:', error);
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('=== Migration Complete ===');
  console.log('================================================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
