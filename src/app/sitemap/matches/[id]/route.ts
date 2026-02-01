import { BASE_URL } from '@/lib/seo/constants';
import { getDb, matches, competitions } from '@/lib/db';
import { eq, isNotNull, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const CHUNK_SIZE = 45000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const chunkId = parseInt(id, 10);

  if (isNaN(chunkId) || chunkId < 0) {
    return new Response('Invalid chunk ID', { status: 400 });
  }

  const db = getDb();
  const offset = chunkId * CHUNK_SIZE;

  const matchData = await db
    .select({
      matchSlug: matches.slug,
      competitionSlug: competitions.slug,
      updatedAt: matches.updatedAt,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(isNotNull(matches.slug))
    .orderBy(desc(matches.kickoffTime))
    .limit(CHUNK_SIZE)
    .offset(offset);

  const urls = matchData
    .filter(match => match.matchSlug && match.competitionSlug)
    .map(match => ({
      url: `${BASE_URL}/leagues/${match.competitionSlug}/${match.matchSlug}`,
      lastmod: match.updatedAt
        ? new Date(match.updatedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      changefreq: match.status === 'finished' ? 'monthly' : 'hourly',
      priority: match.status === 'scheduled' ? 0.8 : 0.6,
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
