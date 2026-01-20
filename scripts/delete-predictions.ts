import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Count predictions before
  const before = await client.execute('SELECT COUNT(*) as count FROM predictions');
  console.log('Predictions before:', before.rows[0].count);

  // Delete all predictions for today's matches
  const result = await client.execute(`
    DELETE FROM predictions 
    WHERE match_id IN (
      SELECT id FROM matches 
      WHERE date(kickoff_time) = date('now')
    )
  `);
  console.log('Deleted rows:', result.rowsAffected);

  // Count predictions after
  const after = await client.execute('SELECT COUNT(*) as count FROM predictions');
  console.log('Predictions after:', after.rows[0].count);
}

main().catch(console.error);
