import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { TEAMS, getTeamsByLeague } from '@/lib/football/teams';
import { getCompetitionsByCategory } from '@/lib/football/competitions';
import { Users } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/constants';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: buildGenericTitle('Football Teams'),
  description: buildGenericDescription('Browse all football clubs tracked across 17 leagues with AI prediction stats and performance analysis.'),
  alternates: {
    canonical: `${BASE_URL}/teams`,
  },
  openGraph: {
    title: 'Football Teams | Kroam',
    description: 'Browse football clubs across 17 leagues with AI prediction stats.',
    url: `${BASE_URL}/teams`,
    type: 'website',
    siteName: 'Kroam',
    images: [
      {
        url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('Football Teams')}`,
        width: 1200,
        height: 630,
        alt: 'Football Teams',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Teams | Kroam',
    description: 'Browse football clubs across 17 leagues.',
    images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('Football Teams')}`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TeamsPage() {
  const domesticLeagues = getCompetitionsByCategory('club-domestic');
  const europeanLeagues = getCompetitionsByCategory('club-europe');

  // Filter teams to only include club teams (domestic + European leagues)
  const clubTeams = TEAMS.filter(team => {
    const comp = [...domesticLeagues, ...europeanLeagues].find(c => c.id === team.league);
    return comp !== undefined;
  });

  // Build CollectionPage structured data
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Football Teams',
    description: 'Browse all football clubs tracked across 17 leagues with AI prediction stats and performance analysis.',
    url: `${BASE_URL}/teams`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: clubTeams.length,
      itemListElement: clubTeams.map((team, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'SportsTeam',
          name: team.id,
          url: `${BASE_URL}/teams/${team.slug}`,
          sport: 'Football',
        },
      })),
    },
  };

  return (
    <div className="space-y-8">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Football Teams</h1>
          <p className="text-muted-foreground">
            Browse {clubTeams.length} clubs across {domesticLeagues.length + europeanLeagues.length} competitions with AI prediction tracking.
          </p>
        </div>
      </div>

      {/* Grouped by league — iterate domestic leagues first, then European */}
      {[...domesticLeagues, ...europeanLeagues].map(league => {
        const teams = getTeamsByLeague(league.id);
        if (teams.length === 0) return null;
        return (
          <section key={league.id}>
            <h2 className="text-xl font-semibold mb-4">
              {league.icon && <span className="mr-2">{league.icon}</span>}
              {league.name}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {teams.map(team => (
                <Link key={team.slug} href={`/teams/${team.slug}`}>
                  <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <h3 className="font-medium">{team.id}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
