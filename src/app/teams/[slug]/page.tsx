import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTeamBySlug } from '@/lib/football/teams';
import { getTeamStats, getTeamMatches } from '@/lib/db/queries/team-stats';
import { buildSportsTeamSchema } from '@/lib/seo/schema/team';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { buildTeamTitle, buildTeamDescription } from '@/lib/seo/metadata';
import { BASE_URL } from '@/lib/seo/constants';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildTeamBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';
import { getCompetitionById } from '@/lib/football/competitions';
import { Card, CardContent } from '@/components/ui/card';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300; // 5 min ISR

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  // Redirect to canonical URL if slug is an alias
  if (slug !== team.slug) {
    permanentRedirect(`/teams/${team.slug}`);
  }

  // Parallel data fetch
  const [stats, recentMatches] = await Promise.all([
    getTeamStats(team.id),
    getTeamMatches(team.id, { limit: 10, status: 'finished' }),
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

        {/* Stats overview card */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Record */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {stats.wins}-{stats.draws}-{stats.losses}
              </div>
              <p className="text-sm text-muted-foreground">Record (W-D-L)</p>
            </CardContent>
          </Card>

          {/* Goals Scored */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.goalsScored}</div>
              <p className="text-sm text-muted-foreground">Goals Scored</p>
            </CardContent>
          </Card>

          {/* Goals Conceded */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.goalsConceded}</div>
              <p className="text-sm text-muted-foreground">Goals Conceded</p>
            </CardContent>
          </Card>

          {/* Clean Sheets */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.cleanSheets}</div>
              <p className="text-sm text-muted-foreground">Clean Sheets</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent matches section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
          {recentMatches.length > 0 ? (
            <div className="space-y-2">
              {recentMatches.map((match) => (
                <Card key={match.matchId} className="bg-card/50 border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={match.isHome ? 'font-semibold' : ''}>
                        {match.homeTeam}
                      </span>
                      <span className="text-muted-foreground">
                        {match.homeScore !== null
                          ? `${match.homeScore} - ${match.awayScore}`
                          : 'vs'}
                      </span>
                      <span className={!match.isHome ? 'font-semibold' : ''}>
                        {match.awayTeam}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(match.kickoffTime).toLocaleDateString()}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent matches found.</p>
          )}
        </section>
      </div>
    </>
  );
}
