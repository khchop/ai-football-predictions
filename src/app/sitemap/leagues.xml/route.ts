import { BASE_URL } from '@/lib/seo/constants';
import { COMPETITIONS } from '@/lib/football/competitions';


export async function GET(): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  // Generate sitemap from static config to ensure all URLs are valid
  // Only include club competitions (domestic + european)
  const urls = COMPETITIONS
    .filter(comp => comp.category === 'club-domestic' || comp.category === 'club-europe')
    .map(comp => ({
      url: `${BASE_URL}/leagues/${comp.id}`,
      lastmod: today,
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
