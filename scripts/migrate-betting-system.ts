#!/usr/bin/env tsx
/**
 * Migration script: Add betting system tables and columns
 * Run: npx tsx scripts/migrate-betting-system.ts
 */

import { Pool } from 'pg';
import 'dotenv/config';

const migrations = [
  {
    name: 'Add odds columns to match_analysis',
    sql: `
      ALTER TABLE match_analysis
        ADD COLUMN IF NOT EXISTS odds_1x TEXT,
        ADD COLUMN IF NOT EXISTS odds_x2 TEXT,
        ADD COLUMN IF NOT EXISTS odds_12 TEXT,
        ADD COLUMN IF NOT EXISTS odds_over_05 TEXT,
        ADD COLUMN IF NOT EXISTS odds_under_05 TEXT,
        ADD COLUMN IF NOT EXISTS odds_over_15 TEXT,
        ADD COLUMN IF NOT EXISTS odds_under_15 TEXT,
        ADD COLUMN IF NOT EXISTS odds_over_25 TEXT,
        ADD COLUMN IF NOT EXISTS odds_under_25 TEXT,
        ADD COLUMN IF NOT EXISTS odds_over_35 TEXT,
        ADD COLUMN IF NOT EXISTS odds_under_35 TEXT,
        ADD COLUMN IF NOT EXISTS odds_over_45 TEXT,
        ADD COLUMN IF NOT EXISTS odds_under_45 TEXT,
        ADD COLUMN IF NOT EXISTS odds_btts_yes TEXT,
        ADD COLUMN IF NOT EXISTS odds_btts_no TEXT;
    `,
  },
  {
    name: 'Create seasons table',
    sql: `
      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_current BOOLEAN DEFAULT false,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `,
  },
  {
    name: 'Create model_balances table',
    sql: `
      CREATE TABLE IF NOT EXISTS model_balances (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id),
        season TEXT NOT NULL,
        starting_balance DOUBLE PRECISION DEFAULT 1000.00,
        current_balance DOUBLE PRECISION DEFAULT 1000.00,
        total_wagered DOUBLE PRECISION DEFAULT 0.00,
        total_won DOUBLE PRECISION DEFAULT 0.00,
        total_bets INTEGER DEFAULT 0,
        winning_bets INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        UNIQUE(model_id, season)
      );
      
      CREATE INDEX IF NOT EXISTS idx_model_balances_season ON model_balances(season);
      CREATE INDEX IF NOT EXISTS idx_model_balances_model_id ON model_balances(model_id);
    `,
  },
  {
    name: 'Create bets table',
    sql: `
      CREATE TABLE IF NOT EXISTS bets (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES matches(id),
        model_id TEXT NOT NULL REFERENCES models(id),
        season TEXT NOT NULL,
        bet_type TEXT NOT NULL,
        selection TEXT NOT NULL,
        odds DOUBLE PRECISION NOT NULL,
        stake DOUBLE PRECISION DEFAULT 1.00,
        status TEXT DEFAULT 'pending',
        payout DOUBLE PRECISION,
        profit DOUBLE PRECISION,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        settled_at TEXT,
        UNIQUE(match_id, model_id, bet_type)
      );
      
      CREATE INDEX IF NOT EXISTS idx_bets_match_id ON bets(match_id);
      CREATE INDEX IF NOT EXISTS idx_bets_model_id ON bets(model_id);
      CREATE INDEX IF NOT EXISTS idx_bets_season ON bets(season);
      CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
    `,
  },
  {
    name: 'Initialize 2024-2025 season',
    sql: `
      INSERT INTO seasons (id, name, start_date, is_current)
      VALUES ('season-2024-2025', '2024-2025', '2024-08-01', true)
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    name: 'Initialize model balances',
    sql: `
      INSERT INTO model_balances (id, model_id, season, starting_balance, current_balance)
      SELECT 
        'balance-' || models.id || '-2024-2025' as id,
        models.id as model_id,
        '2024-2025' as season,
        1000.00 as starting_balance,
        1000.00 as current_balance
      FROM models
      WHERE models.active = true
      ON CONFLICT (model_id, season) DO NOTHING;
    `,
  },
];

async function runMigrations() {
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
    // Try without SSL first, fallback to SSL if needed
    ssl: false,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');

    // Run each migration
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      console.log(`[${i + 1}/${migrations.length}] Running: ${migration.name}`);
      
      try {
        await pool.query(migration.sql);
        console.log(`   ✅ Success\n`);
      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('seasons', 'model_balances', 'bets')
      ORDER BY table_name;
    `);
    
    console.log(`   Found ${result.rows.length}/3 tables:`);
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    if (result.rows.length === 3) {
      console.log('\n✅ Migration completed successfully!');
      console.log('   All tables created and initialized.');
    } else {
      console.log('\n⚠️  Warning: Some tables might be missing');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
