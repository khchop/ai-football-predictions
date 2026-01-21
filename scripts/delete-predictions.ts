import { Pool } from 'pg';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  // Count predictions before
  const before = await pool.query('SELECT COUNT(*) as count FROM predictions');
  console.log('Predictions before:', before.rows[0].count);

  // Delete all predictions for today's matches
  const result = await pool.query(`
    DELETE FROM predictions 
    WHERE match_id IN (
      SELECT id FROM matches 
      WHERE DATE(kickoff_time::timestamp) = CURRENT_DATE
    )
  `);
  console.log('Deleted rows:', result.rowCount);

  // Count predictions after
  const after = await pool.query('SELECT COUNT(*) as count FROM predictions');
  console.log('Predictions after:', after.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
