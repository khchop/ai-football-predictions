import { BASE_URL } from '@/lib/seo/constants';
import { COMPETITIONS } from '@/lib/football/competitions';
import { getDb, matches, competitions } from '@/lib/db';
import { eq, sql, desc } from 'drizzle-orm';


export async function GET(): Promise<Response> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Get most recent match update per competition for accurate lastmod
  const recentUpdates = await db
    .select({
      competitionId: competitions.id,
      lastUpdated: sql<string>`MAX(${matches.updatedAt})`.as('last_updated'),
    })
    .from(competitions)
    .leftJoin(matches, eq(competitions.id, matches.competitionId))
    .groupBy(competitions.id);

  const lastmodMap = new Map<string, string>();
  for (const row of recentUpdates) {
    if (row.lastUpdated) {
      // Parse ISO timestamp and extract date
      lastmodMap.set(row.competitionId, row.lastUpdated.split('T')[0]);
    }
  }

  // Include ALL leagues (removed category filter per user decision)
  const urls = COMPETITIONS.map(comp => ({
    url: `${BASE_URL}/leagues/${comp.id}`,
    lastmod: lastmodMap.get(comp.id) ?? today,
    changefreq: 'hourly',
    priority: 0.9,
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
