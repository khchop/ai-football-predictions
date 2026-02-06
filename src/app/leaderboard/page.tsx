import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { LeaderboardTableSkeleton } from '@/components/leaderboard/skeleton';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import type { LeaderboardEntry } from '@/lib/table/columns';
import { Trophy, ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import { LiveTabRefresher } from '@/app/matches/live-refresher';
import { getLeaderboardWithTrends } from '@/lib/db/queries/stats';
import { getOverallStats } from '@/lib/db/queries';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { generateFAQPageSchema } from '@/lib/seo/schemas';
import { generateLeaderboardFAQs } from '@/lib/leaderboard/generate-leaderboard-faqs';
import { BASE_URL } from '@/lib/seo/constants';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildLeaderboardBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getOverallStats();
  const modelCount = stats.activeModels;

  return {
    title: buildGenericTitle('AI Model Leaderboard'),
    description: buildGenericDescription(`Compare ${modelCount} AI model accuracy across 17 football competitions. See which models predict best in Champions League, Premier League, and more.`),
    alternates: {
      canonical: `${BASE_URL}/leaderboard`,
    },
    openGraph: {
      title: 'AI Model Leaderboard | Kroam',
      description: `Compare ${modelCount} AI model accuracy across 17 football competitions. See which models predict best.`,
      url: `${BASE_URL}/leaderboard`,
      type: 'website',
      siteName: 'Kroam',
      images: [
        {
          url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Model Leaderboard')}`,
          width: 1200,
          height: 630,
          alt: 'AI Model Leaderboard',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Model Leaderboard | Kroam',
      description: `Compare ${modelCount} AI model accuracy across 17 football competitions`,
      images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Model Leaderboard')}`],
    },
  };
}

// ISR: Revalidate every 60 seconds

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function LeaderboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Parse filter parameters
  const competitionId = typeof searchParams.competition === 'string' && searchParams.competition !== 'all'
    ? searchParams.competition
    : undefined;
  const season = typeof searchParams.season === 'string' && searchParams.season !== 'all'
    ? parseInt(searchParams.season, 10)
    : undefined;
  const minPredictions = typeof searchParams.minPredictions === 'string'
    ? parseInt(searchParams.minPredictions, 10)
    : 0;
  const timePeriod = typeof searchParams.timePeriod === 'string'
    ? searchParams.timePeriod as 'all' | 'weekly' | 'monthly'
    : 'all';

  // Query database directly instead of HTTP fetch (avoids self-referential timeout)
  const leaderboard = await getLeaderboardWithTrends(50, 'avgPoints', {
    competitionId,
    season,
    timePeriod,
  });

  // Calculate stats for FAQ generation
  const totalModels = leaderboard.length;
  const totalPredictions = leaderboard.reduce((sum, e) => sum + e.totalPredictions, 0);
  const topModel = leaderboard[0] ? {
    name: leaderboard[0].displayName,
    avgPoints: leaderboard[0].avgPoints,
    accuracy: leaderboard[0].accuracy,
  } : null;

  // Generate dynamic FAQs
  const faqs = generateLeaderboardFAQs({
    totalModels,
    totalPredictions,
    topModel,
    timePeriod,
  });

  // Generate FAQPage schema and strip @context for use in @graph
  const faqSchemaWithContext = generateFAQPageSchema(faqs);
  const { '@context': _, ...faqSchema } = faqSchemaWithContext;

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No prediction data available yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Models will start appearing once they make predictions.
        </p>
      </div>
    );
  }

  // Format data for LeaderboardTable
  const formattedLeaderboard: LeaderboardEntry[] = leaderboard.map((entry) => ({
    modelId: entry.modelId,
    displayName: entry.displayName,
    provider: entry.provider,
    totalPredictions: entry.totalPredictions,
    totalPoints: entry.totalPoints,
    averagePoints: entry.avgPoints,
    exactScores: entry.exactScores,
    correctTendencies: entry.correctTendencies,
    trendDirection: entry.trendDirection,
    rankChange: entry.rankChange,
  })).filter((entry) => entry.totalPredictions >= minPredictions);

  return (
    <>
      {/* Leaderboard Table */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <LeaderboardTable entries={formattedLeaderboard} />
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card className="bg-card/50 border-border/50 mt-8">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-6">Understanding Model Rankings</h2>
          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <details key={idx} className="group border-b border-border/30 pb-3 last:border-0">
                <summary className="cursor-pointer font-semibold text-sm py-2 list-none flex items-center justify-between">
                  {faq.question}
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </summary>
                <p className="text-sm text-muted-foreground leading-relaxed pt-2 pb-1">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  // Fetch leaderboard data for FAQ generation
  const leaderboard = await getLeaderboardWithTrends(50, 'avgPoints', {});
  const totalModels = leaderboard.length;
  const totalPredictions = leaderboard.reduce((sum, e) => sum + e.totalPredictions, 0);
  const topModel = leaderboard[0] ? {
    name: leaderboard[0].displayName,
    avgPoints: leaderboard[0].avgPoints,
    accuracy: leaderboard[0].accuracy,
  } : null;

  // Generate dynamic FAQs
  const faqs = generateLeaderboardFAQs({
    totalModels,
    totalPredictions,
    topModel,
    timePeriod: 'all',
  });

  // Generate FAQPage schema and strip @context for use in @graph
  const faqSchemaWithContext = generateFAQPageSchema(faqs);
  const { '@context': _, ...faqSchema } = faqSchemaWithContext;

  // Build BreadcrumbList schema
  const breadcrumbs = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Leaderboard', url: `${BASE_URL}/leaderboard` },
  ]);

  // Consolidated @graph with BreadcrumbList and FAQPage
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbs, faqSchema],
  };

  // Build visual breadcrumbs
  const visualBreadcrumbs = buildLeaderboardBreadcrumbs();

  return (
    <LiveTabRefresher refreshInterval={30000}>
      {/* Consolidated structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="space-y-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={visualBreadcrumbs} />

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">
              Which AI predicts football best?
            </p>
          </div>
        </div>

        {/* Scoring System Info */}
        <div className="rounded-xl bg-card/50 border border-border/50 p-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Kicktipp Scoring System</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">2-6</p>
              <p className="text-xs font-medium mt-1">Correct Tendency</p>
              <p className="text-xs text-muted-foreground">Based on rarity</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">+1</p>
              <p className="text-xs font-medium mt-1">Goal Difference</p>
              <p className="text-xs text-muted-foreground">Correct margin</p>
            </div>
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-green-400">+3</p>
              <p className="text-xs font-medium mt-1">Exact Score</p>
              <p className="text-xs text-muted-foreground">Perfect prediction</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-3 text-center">
              <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">10</p>
              <p className="text-xs font-medium mt-1">Maximum Points</p>
              <p className="text-xs text-muted-foreground">Per match</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Models predict exact scorelines for each match. Points are awarded based on the Kicktipp Quota scoring system: tendency points (2-6, variable based on prediction rarity), goal difference bonus (+1), and exact score bonus (+3). Maximum: 10 points.
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <LeaderboardFilters />
        </Suspense>

        {/* Leaderboard Content */}
        <Suspense fallback={<LeaderboardTableSkeleton />}>
          <LeaderboardContent searchParams={resolvedParams} />
        </Suspense>
      </div>
    </LiveTabRefresher>
  );
}
