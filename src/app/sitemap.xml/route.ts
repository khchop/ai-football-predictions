import { BASE_URL } from '@/lib/seo/constants';
import { getDb, matches } from '@/lib/db';
import { isNotNull } from 'drizzle-orm';


const CHUNK_SIZE = 45000;

async function getMatchChunkCount(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ slug: matches.slug })
    .from(matches)
    .where(isNotNull(matches.slug));

  return Math.ceil(result.length / CHUNK_SIZE);
}

export async function GET(): Promise<Response> {
  const matchChunks = await getMatchChunkCount();

  const sitemaps = [
    `${BASE_URL}/sitemap/static.xml`,
    `${BASE_URL}/sitemap/leagues.xml`,
    `${BASE_URL}/sitemap/models.xml`,
    `${BASE_URL}/sitemap/blog.xml`,
  ];

  // Add match sitemap chunks
  for (let i = 0; i < Math.max(1, matchChunks); i++) {
    sitemaps.push(`${BASE_URL}/sitemap/matches/${i}.xml`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(url => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
