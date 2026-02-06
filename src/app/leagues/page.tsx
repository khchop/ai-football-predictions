import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { getCompetitionsByCategory } from '@/lib/football/competitions';
import { Trophy } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/constants';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: buildGenericTitle('Football League AI Predictions'),
  description: buildGenericDescription('Explore AI predictions across 17 football competitions including Champions League, Premier League, La Liga, and more.'),
  alternates: {
    canonical: `${BASE_URL}/leagues`,
  },
  openGraph: {
    title: 'Football League AI Predictions | Kroam',
    description: 'AI predictions across 17 major football competitions worldwide.',
    url: `${BASE_URL}/leagues`,
    type: 'website',
    siteName: 'Kroam',
    images: [
      {
        url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('Football League AI Predictions')}`,
        width: 1200,
        height: 630,
        alt: 'Football League AI Predictions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football League AI Predictions | Kroam',
    description: '17 competitions tracked with AI model predictions.',
    images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('Football League AI Predictions')}`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LeaguesPage() {
  const europeanClub = getCompetitionsByCategory('club-europe');
  const domesticLeagues = getCompetitionsByCategory('club-domestic');
  const international = getCompetitionsByCategory('international');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Football League Predictions</h1>
          <p className="text-muted-foreground">
            AI predictions across 17 major football competitions. Compare model accuracy by league and explore upcoming matches.
          </p>
        </div>
      </div>

      {/* European Club Competitions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">European Club Competitions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {europeanClub.map((competition) => (
            <Link key={competition.id} href={`/leagues/${competition.id}`}>
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{competition.icon}</span>
                    <div>
                      <h3 className="font-semibold">{competition.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {competition.season}-{(competition.season + 1).toString().slice(-2)} Season
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Domestic Leagues */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Domestic Leagues</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {domesticLeagues.map((competition) => (
            <Link key={competition.id} href={`/leagues/${competition.id}`}>
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{competition.icon}</span>
                    <div>
                      <h3 className="font-semibold">{competition.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {competition.season}-{(competition.season + 1).toString().slice(-2)} Season
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* International */}
      <section>
        <h2 className="text-xl font-semibold mb-4">International</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {international.map((competition) => (
            <Link key={competition.id} href={`/leagues/${competition.id}`}>
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{competition.icon}</span>
                    <div>
                      <h3 className="font-semibold">{competition.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {competition.season} Season
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
