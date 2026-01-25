import { getDb, leagueStandings } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkStandings() {
  const db = getDb();
  
  // Check Ligue 1 standings by season
  const result = await db.execute(sql`
    SELECT 
      season, 
      league_id, 
      COUNT(*) as teams, 
      MAX(updated_at) as last_update,
      MAX(played) as max_played
    FROM league_standings 
    WHERE league_id = 61
    GROUP BY season, league_id 
    ORDER BY season DESC
  `);
  
  console.log('Ligue 1 Standings by Season:');
  console.table(result.rows);
  
  // Check a few team entries
  const teams = await db.execute(sql`
    SELECT team_name, season, played, points, position, updated_at
    FROM league_standings
    WHERE league_id = 61
    ORDER BY season DESC, position ASC
    LIMIT 10
  `);
  
  console.log('\nSample Teams:');
  console.table(teams.rows);
}

checkStandings().catch(console.error);
