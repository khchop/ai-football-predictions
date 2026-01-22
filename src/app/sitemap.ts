import { MetadataRoute } from 'next';
import { getDb, matches, models, competitions } from '@/lib/db';
import { desc, eq, isNotNull } from 'drizzle-orm';

// Force dynamic rendering (don't pre-render at build time)
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const baseUrl = 'https://kroam.xyz';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/matches`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ];

  // Get all matches with slugs for SEO-friendly URLs
  const allMatches = await db
    .select({
      matchSlug: matches.slug,
      competitionSlug: competitions.slug,
      updatedAt: matches.updatedAt,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(isNotNull(matches.slug)) // Only include matches with slugs
    .orderBy(desc(matches.kickoffTime))
    .limit(1000); // Limit to most recent 1000 matches

  const matchPages: MetadataRoute.Sitemap = allMatches
    .filter((match) => match.matchSlug && match.competitionSlug) // Extra safety check
    .map((match) => ({
      url: `${baseUrl}/predictions/${match.competitionSlug}/${match.matchSlug}`,
      lastModified: match.updatedAt ? new Date(match.updatedAt) : new Date(),
      changeFrequency: match.status === 'finished' ? 'monthly' : 'hourly',
      priority: match.status === 'scheduled' ? 0.8 : 0.6,
    }));

  // Get all models for sitemap
  const allModels = await db
    .select({
      id: models.id,
    })
    .from(models);

  const modelPages: MetadataRoute.Sitemap = allModels.map((model) => ({
    url: `${baseUrl}/models/${model.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...staticPages, ...matchPages, ...modelPages];
}
