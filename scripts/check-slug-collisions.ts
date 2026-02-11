/**
 * Check for slug collisions in teams.ts
 */
import { TEAMS } from '../src/lib/football/teams';

const slugs = TEAMS.map(t => t.slug);
const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);

if (duplicates.length > 0) {
  console.error(`❌ Slug collisions detected: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
} else {
  console.log(`✅ No slug collisions - all ${slugs.length} slugs are unique`);
  process.exit(0);
}
