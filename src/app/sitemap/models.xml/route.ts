import { BASE_URL } from '@/lib/seo/constants';
import { getDb, models, predictions } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';


export async function GET(): Promise<Response> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Get most recent prediction timestamp per model for accurate lastmod
  const modelsWithLastmod = await db
    .select({
      id: models.id,
      lastPrediction: sql<string>`MAX(${predictions.createdAt})`.as('last_prediction'),
    })
    .from(models)
    .leftJoin(predictions, eq(models.id, predictions.modelId))
    .where(eq(models.active, true))
    .groupBy(models.id);

  const urls = modelsWithLastmod.map(model => ({
    url: `${BASE_URL}/models/${model.id}`,
    lastmod: model.lastPrediction
      ? new Date(model.lastPrediction).toISOString().split('T')[0]
      : today,
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
