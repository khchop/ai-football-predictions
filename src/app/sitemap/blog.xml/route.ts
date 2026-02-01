import { BASE_URL } from '@/lib/seo/constants';
import { getDb, blogPosts } from '@/lib/db';
import { eq, isNotNull, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const db = getDb();

  const allBlogPosts = await db
    .select({
      slug: blogPosts.slug,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      isNotNull(blogPosts.slug)
    ))
    .orderBy(desc(blogPosts.publishedAt));

  const urls = allBlogPosts
    .filter(post => post.slug)
    .map(post => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastmod: post.publishedAt
        ? new Date(post.publishedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
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
