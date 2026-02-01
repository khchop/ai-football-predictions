import { BASE_URL } from '@/lib/seo/constants';
import { getDb, models } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const allModels = await db
    .select({ id: models.id })
    .from(models);

  const urls = allModels.map(model => ({
    url: `${BASE_URL}/models/${model.id}`,
    lastmod: today,
    changefreq: 'daily',
    priority: 0.7,
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
