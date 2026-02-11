/**
 * Test team helper functions
 */
import { getTeamBySlug, getTeamByIdOrAlias, resolveTeamName, getTeamsByLeague, getAllTeamSlugs } from '../src/lib/football/teams';

console.log('\n🧪 Testing team helper functions...\n');

// Test getTeamBySlug
const bySlug = getTeamBySlug('manchester-city');
if (bySlug?.id === 'Manchester City') {
  console.log('✅ getTeamBySlug("manchester-city") -> "Manchester City"');
} else {
  console.error('❌ getTeamBySlug failed');
  process.exit(1);
}

// Test getTeamByIdOrAlias with exact ID
const byId = getTeamByIdOrAlias('Manchester City');
if (byId?.slug === 'manchester-city') {
  console.log('✅ getTeamByIdOrAlias("Manchester City") -> slug: "manchester-city"');
} else {
  console.error('❌ getTeamByIdOrAlias with ID failed');
  process.exit(1);
}

// Test getTeamByIdOrAlias with alias
const byAlias = getTeamByIdOrAlias('Man City');
if (byAlias?.id === 'Manchester City') {
  console.log('✅ getTeamByIdOrAlias("Man City") -> "Manchester City"');
} else {
  console.error('❌ getTeamByIdOrAlias with alias failed');
  process.exit(1);
}

// Test resolveTeamName
const resolved = resolveTeamName('PSG');
if (resolved === 'Paris Saint Germain') {
  console.log('✅ resolveTeamName("PSG") -> "Paris Saint Germain"');
} else {
  console.error('❌ resolveTeamName failed');
  process.exit(1);
}

// Test getTeamsByLeague
const eplTeams = getTeamsByLeague('epl');
if (eplTeams.length === 20) {
  console.log(`✅ getTeamsByLeague("epl") -> ${eplTeams.length} teams`);
} else {
  console.error(`❌ getTeamsByLeague failed - expected 20 EPL teams, got ${eplTeams.length}`);
  process.exit(1);
}

// Test getAllTeamSlugs
const allSlugs = getAllTeamSlugs();
if (allSlugs.length === 164) {
  console.log(`✅ getAllTeamSlugs() -> ${allSlugs.length} slugs`);
} else {
  console.error(`❌ getAllTeamSlugs failed - expected 164 slugs, got ${allSlugs.length}`);
  process.exit(1);
}

console.log('\n✅ All helper function tests passed!\n');
