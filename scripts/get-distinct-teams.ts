/**
 * Query distinct team names from matches table
 * Used for building the teams.ts mapping file
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function getDistinctTeams() {
  console.log('\n🔍 Querying distinct team names from database...\n');

  const db = getDb();

  try {
    const result = await db.execute(sql`
      SELECT DISTINCT name FROM (
        SELECT home_team AS name FROM matches
        UNION
        SELECT away_team AS name FROM matches
      ) t ORDER BY name
    `);

    const teamNames = result.rows.map((r: any) => r.name as string);

    console.log(`Found ${teamNames.length} distinct team names:\n`);
    teamNames.forEach((name, idx) => {
      console.log(`${(idx + 1).toString().padStart(3, ' ')}. ${name}`);
    });

    console.log(`\n✅ Total: ${teamNames.length} teams\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Query failed:', error);
    process.exit(1);
  }
}

getDistinctTeams();
