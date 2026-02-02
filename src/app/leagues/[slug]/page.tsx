import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCompetitionById, COMPETITIONS } from '@/lib/football/competitions';
import { LeagueHubContent } from './league-hub-content';
import { Skeleton } from '@/components/ui/skeleton';
import { buildCompetitionSchema } from '@/lib/seo/schema/competition';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { BASE_URL } from '@/lib/seo/constants';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Removed generateStaticParams to avoid build-time database queries
// Pages will be rendered on-demand with ISR caching (60s revalidation)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionById(slug);

  if (!competition) {
    return {
      title: 'League Not Found',
    };
  }

  const title = `${competition.name} Predictions | AI Models Compete | kroam.xyz`;
  const description = `AI predictions for ${competition.name} from 35 models. Track accuracy, compare predictions, and see which AI performs best.`;
  const url = `${BASE_URL}/leagues/${slug}`;

  // OG image for competition
  const ogImageUrl = new URL(`${BASE_URL}/api/og/league`);
  ogImageUrl.searchParams.set('leagueName', competition.name);
  ogImageUrl.searchParams.set('matchCount', '0');
  ogImageUrl.searchParams.set('upcomingCount', '0');

  return {
    title,
    description,
    keywords: [competition.name, 'football predictions', 'AI predictions'],
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
  const competition = getCompetitionById(slug);

  if (!competition) {
    notFound();
  }

  // Build schema.org structured data
  const competitionSchema = buildCompetitionSchema(competition);
  const breadcrumbs = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Leagues', url: `${BASE_URL}/leagues` },
    { name: competition.name, url: `${BASE_URL}/leagues/${slug}` },
  ]);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [competitionSchema, breadcrumbs],
  };

  return (
    <>
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Suspense fallback={<LoadingSkeleton />}>
        <LeagueHubContent competitionId={slug} />
      </Suspense>
    </>
  );
}
