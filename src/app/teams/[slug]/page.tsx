import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTeamBySlug } from '@/lib/football/teams';
import {
  getTeamStats,
  getTeamFormGuide,
  getTeamModelLeaderboard,
  getTeamUpcomingWithPredictions,
  getTeamRecentWithAccuracy,
  getTeamAccuracyTrend,
  type TeamLeaderboardPeriod
} from '@/lib/db/queries/team-stats';
import { buildSportsTeamSchema } from '@/lib/seo/schema/team';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { buildTeamTitle, buildTeamDescription } from '@/lib/seo/metadata';
import { BASE_URL } from '@/lib/seo/constants';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildTeamBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';
import { getCompetitionById } from '@/lib/football/competitions';
import { TeamModelLeaderboard } from '@/components/team/team-model-leaderboard';
import { TeamLeaderboardFilter } from '@/components/team/team-leaderboard-filter';
import { TeamFormIndicator } from '@/components/team/team-form-indicator';
import { TeamStatsOverview } from '@/components/team/team-stats-overview';
import { TeamUpcomingMatches } from '@/components/team/team-upcoming-matches';
import { TeamRecentMatches } from '@/components/team/team-recent-matches';
import { TeamAccuracyTrendChart } from '@/components/team/team-accuracy-trend-chart';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 300; // 5 min ISR

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) {
    return {
      title: 'Team Not Found',
    };
  }

  // Fetch stats for dynamic metadata
  const stats = await getTeamStats(team.id);

  const title = buildTeamTitle(team.id);
  const description = buildTeamDescription(team.id, stats, 42);

  // Use canonical slug in URL
  const url = `${BASE_URL}/teams/${team.slug}`;

  // OG image for team
  const ogImageUrl = new URL(`${BASE_URL}/api/og/team`);
  ogImageUrl.searchParams.set('teamName', team.id);
  ogImageUrl.searchParams.set('wins', stats.wins.toString());
  ogImageUrl.searchParams.set('draws', stats.draws.toString());
  ogImageUrl.searchParams.set('losses', stats.losses.toString());

  return {
    title,
    description,
    keywords: [
      team.id,
      `${team.id} stats`,
      `${team.id} predictions`,
      'football predictions',
      'AI predictions',
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Kroam',
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${team.id} Stats`,
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

export default async function TeamPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const team = getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  // Redirect to canonical URL if slug is an alias
  if (slug !== team.slug) {
    permanentRedirect(`/teams/${team.slug}`);
  }

  // Parse timePeriod from search params
  const timePeriod = typeof resolvedSearchParams.timePeriod === 'string'
    ? resolvedSearchParams.timePeriod as TeamLeaderboardPeriod
    : 'all';

  // Parallel data fetch
  const [stats, formGuide, leaderboard, upcomingMatches, recentWithAccuracy, accuracyTrend] = await Promise.all([
    getTeamStats(team.id),
    getTeamFormGuide(team.id, 5),
    getTeamModelLeaderboard(team.id, { timePeriod }),
    getTeamUpcomingWithPredictions(team.id, 5),
    getTeamRecentWithAccuracy(team.id, 10),
    getTeamAccuracyTrend(team.id),
  ]);

  // Build schema.org structured data
  const teamSchema = buildSportsTeamSchema(team, stats);
  const breadcrumbSchemaItems = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Teams', url: `${BASE_URL}/teams` },
    { name: team.id, url: `${BASE_URL}/teams/${team.slug}` },
  ]);

  // Combined @graph
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [teamSchema, breadcrumbSchemaItems],
  };

  // Build visual breadcrumbs
  const visualBreadcrumbs = buildTeamBreadcrumbs(team.id, team.slug);

  // Look up competition
  const competition = getCompetitionById(team.league);

  return (
    <>
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Breadcrumbs items={visualBreadcrumbs} />
      <div className="space-y-8">
        {/* Header section */}
        <div>
          <h1 className="text-3xl font-bold">{team.id}</h1>
          <p className="text-muted-foreground">
            {competition?.name ?? team.league} — {stats.totalMatches} matches tracked
          </p>
        </div>

        {/* Stats overview section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Statistics</h2>
          <TeamStatsOverview stats={stats} />
        </section>

        {/* Form section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Form</h2>
          <TeamFormIndicator form={formGuide} />
        </section>

        {/* Model Leaderboard section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">AI Model Leaderboard for {team.id}</h2>
            <TeamLeaderboardFilter teamSlug={team.slug} />
          </div>
          <TeamModelLeaderboard entries={leaderboard} />
        </section>

        {/* Model Accuracy Trend section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Model Accuracy Over Time</h2>
          <TeamAccuracyTrendChart data={accuracyTrend} />
        </section>

        {/* Upcoming Matches section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Upcoming Matches</h2>
          <TeamUpcomingMatches matches={upcomingMatches} teamName={team.id} />
        </section>

        {/* Recent Matches section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
          <TeamRecentMatches matches={recentWithAccuracy} teamName={team.id} />
        </section>
      </div>
    </>
  );
}
