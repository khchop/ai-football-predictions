/**
 * Validate Team Mapping Script
 *
 * Validates that all distinct team names in the matches table
 * resolve correctly via the teams.ts mapping file.
 *
 * Usage: npx tsx scripts/validate-team-mapping.ts
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { getTeamByIdOrAlias, validateTeamMapping } from '../src/lib/football/teams';

async function main() {
  console.log('\n🔍 Validating team name mapping...\n');

  const db = getDb();

  try {
    // Query all distinct team names from matches table
    const result = await db.execute(sql`
      SELECT DISTINCT name FROM (
        SELECT home_team AS name FROM matches
        UNION
        SELECT away_team AS name FROM matches
      ) t ORDER BY name
    `);

    const dbTeamNames = result.rows.map((r: any) => r.name as string);
    console.log(`📊 Found ${dbTeamNames.length} distinct team names in database\n`);

    // Validate mapping
    const { unmapped } = validateTeamMapping(dbTeamNames);

    if (unmapped.length === 0) {
      console.log(`✅ SUCCESS: All ${dbTeamNames.length} DB team names resolve correctly.\n`);
      process.exit(0);
    } else {
      console.error(`❌ FAILURE: ${unmapped.length} unmapped team names:\n`);
      unmapped.forEach(n => console.error(`  - ${n}`));
      console.error('');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

main();
