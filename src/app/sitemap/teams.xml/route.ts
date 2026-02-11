import { BASE_URL } from '@/lib/seo/constants';
import { TEAMS } from '@/lib/football/teams';
import { getTeamStats } from '@/lib/db/queries/team-stats';

export async function GET(): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  // Fetch stats for all teams in parallel
  const teamStatsPromises = TEAMS.map(async (team) => {
    const stats = await getTeamStats(team.id);
    return { team, stats };
  });

  const teamStatsResults = await Promise.all(teamStatsPromises);

  // Filter out teams with fewer than 5 matches (thin content prevention)
  const qualifiedTeams = teamStatsResults.filter(
    ({ stats }) => stats.totalMatches >= 5
  );

  // Generate sitemap entries
  const urls = qualifiedTeams.map(({ team }) => ({
    url: `${BASE_URL}/teams/${team.slug}`,
    lastmod: today,
    changefreq: 'weekly',
    priority: 0.7,
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
