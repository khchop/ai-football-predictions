import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';
import { LeagueHubContent } from './league-hub-content';
import { Skeleton } from '@/components/ui/skeleton';
import { buildEnhancedCompetitionSchema } from '@/lib/seo/schema/competition';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { BASE_URL } from '@/lib/seo/constants';
import { abbreviateCompetition } from '@/lib/seo/abbreviations';
import { getCompetitionStats, getTopModelsByCompetition, getOverallStats } from '@/lib/db/queries';
import { generateFAQPageSchema } from '@/lib/seo/schemas';
import { generateLeagueFAQs } from '@/lib/league/generate-league-faqs';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildLeagueBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Removed generateStaticParams to avoid build-time database queries
// Pages will be rendered on-demand with ISR caching (60s revalidation)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) {
    return {
      title: 'League Not Found',
    };
  }

  // Fetch stats for dynamic metadata (including active model count)
  const [competitionStats, overallStats] = await Promise.all([
    getCompetitionStats(competition.id),
    getOverallStats(),
  ]);
  const stats = competitionStats;
  const modelCount = overallStats.activeModels;

  const shortName = abbreviateCompetition(competition.name);
  const title = `${shortName} AI Predictions | ${modelCount} Models | kroam.xyz`;

  // Dynamic description based on stats
  const description = stats.finishedMatches > 0
    ? `AI predictions for ${competition.name} from ${modelCount} models. ${stats.finishedMatches} matches analyzed with ${stats.avgGoalsPerMatch} avg goals. Track model accuracy and compare predictions.`
    : `AI predictions for ${competition.name} from ${modelCount} models. Track accuracy, compare predictions, and see which AI performs best.`;

  // Use canonical ID in URL, not the slug
  const url = `${BASE_URL}/leagues/${competition.id}`;

  // OG image for competition with real stats
  const ogImageUrl = new URL(`${BASE_URL}/api/og/league`);
  ogImageUrl.searchParams.set('leagueName', competition.name);
  ogImageUrl.searchParams.set('matchCount', String(stats.finishedMatches || 0));
  ogImageUrl.searchParams.set('upcomingCount', String(stats.scheduledMatches || 0));

  return {
    title,
    description,
    keywords: [
      competition.name,
      `${competition.name} predictions`,
      `${competition.name} AI`,
      'football predictions',
      'AI predictions',
      'football betting tips',
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website' as const,
      siteName: 'kroam.xyz',
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${competition.name} AI Predictions`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-4">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) {
    notFound();
  }

  // Redirect to canonical URL if slug is an alias
  if (slug !== competition.id) {
    permanentRedirect(`/leagues/${competition.id}`);
  }

  // Fetch stats, top models, and active model count for enhanced schema and FAQ generation in parallel
  const [stats, topModels, overallStats] = await Promise.all([
    getCompetitionStats(competition.id),
    getTopModelsByCompetition(competition.id, 1),
    getOverallStats(),
  ]);
  const activeModels = overallStats.activeModels;

  // Generate FAQs for schema (same source as LeagueHubContent for consistency)
  const topModel = topModels[0];
  const faqs = generateLeagueFAQs({
    competition: { id: competition.id, name: competition.name },
    stats: {
      finishedMatches: stats.finishedMatches,
      avgGoalsPerMatch: stats.avgGoalsPerMatch,
    },
    topModel: topModel ? {
      model: { name: topModel.model.displayName },
      accuracy: topModel.accuracy,
    } : undefined,
    activeModels,
  });

  // Build schema.org structured data with enhanced competition schema
  const competitionSchema = buildEnhancedCompetitionSchema({
    competition,
    stats: {
      totalMatches: stats.totalMatches,
      finishedMatches: stats.finishedMatches,
      avgGoalsPerMatch: stats.avgGoalsPerMatch,
    },
    activeModels,
  });
  const breadcrumbs = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Leagues', url: `${BASE_URL}/leagues` },
    { name: competition.name, url: `${BASE_URL}/leagues/${competition.id}` },
  ]);
  const faqSchema = generateFAQPageSchema(faqs);

  // Combined @graph with SportsOrganization, BreadcrumbList, and FAQPage
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [competitionSchema, breadcrumbs, faqSchema],
  };

  // Build visual breadcrumbs
  const visualBreadcrumbs = buildLeagueBreadcrumbs(competition.name, competition.id);

  return (
    <>
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Breadcrumbs items={visualBreadcrumbs} />
      <Suspense fallback={<LoadingSkeleton />}>
        <LeagueHubContent competitionId={competition.id} />
      </Suspense>
    </>
  );
}
