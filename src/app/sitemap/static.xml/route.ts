import { BASE_URL } from '@/lib/seo/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export async function GET(): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  const staticPages: SitemapEntry[] = [
    { url: BASE_URL, lastmod: today, changefreq: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastmod: today, changefreq: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/leaderboard`, lastmod: today, changefreq: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/matches`, lastmod: today, changefreq: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastmod: today, changefreq: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/methodology`, lastmod: today, changefreq: 'monthly', priority: 0.7 },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
