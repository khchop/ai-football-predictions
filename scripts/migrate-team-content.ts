/**
 * Migration script: Add team_content table
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db';

async function migrate() {
  const db = getDb();

  console.log('Creating team_content table...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_content (
      id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL UNIQUE,
      analysis TEXT,
      analysis_generated_at TEXT,
      faq_content TEXT,
      faq_generated_at TEXT,
      generated_by TEXT,
      total_tokens INTEGER DEFAULT 0,
      total_cost TEXT DEFAULT '0',
      created_at TEXT DEFAULT now(),
      updated_at TEXT DEFAULT now()
    )
  `);

  console.log('Creating index on team_name...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_team_content_team_name ON team_content(team_name)
  `);

  console.log('✓ Migration complete');
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
