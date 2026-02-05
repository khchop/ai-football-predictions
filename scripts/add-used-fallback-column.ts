/**
 * Migration script to add used_fallback column to predictions table
 * Run with: npx tsx scripts/add-used-fallback-column.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Adding used_fallback column to predictions table...');

  await pool.query(`
    ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN DEFAULT false;
  `);

  console.log('✓ Column added successfully');

  // Verify the column exists
  const result = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'used_fallback';
  `);

  if (result.rows.length > 0) {
    console.log('✓ Verification passed:', result.rows[0]);
  } else {
    console.error('✗ Column not found after migration');
    process.exit(1);
  }

  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
