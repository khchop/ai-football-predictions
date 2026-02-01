/**
 * One-time migration script to create missing tables
 * Run with: npx tsx scripts/migrate-missing-tables.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Creating missing tables...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS circuit_breaker_states (
      service TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'closed',
      failures INTEGER DEFAULT 0,
      successes INTEGER DEFAULT 0,
      last_failure_at TIMESTAMP,
      last_state_change TIMESTAMP DEFAULT NOW(),
      total_failures INTEGER DEFAULT 0,
      total_successes INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS match_roundups (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      scoreboard TEXT NOT NULL,
      events TEXT,
      stats TEXT NOT NULL,
      model_predictions TEXT NOT NULL,
      top_performers TEXT NOT NULL,
      narrative TEXT NOT NULL,
      keywords TEXT,
      similarity_hash TEXT,
      generation_cost DOUBLE PRECISION,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      generated_by TEXT,
      status TEXT DEFAULT 'pending',
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_state ON circuit_breaker_states(state);
    CREATE INDEX IF NOT EXISTS idx_match_roundups_match_id ON match_roundups(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_roundups_status ON match_roundups(status);
  `);

  console.log('✓ Tables created successfully');
  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
