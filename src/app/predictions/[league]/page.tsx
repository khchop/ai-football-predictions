import { notFound } from 'next/navigation';
import { getCompetitionBySlug, getMatchesByCompetitionSlug, getStandingsByCompetitionId } from '@/lib/db/queries';
import { Trophy, Calendar, Target, List } from 'lucide-react';
import Link from 'next/link';
import { MatchCard } from '@/components/match-card';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Metadata } from 'next';

interface LeaguePageProps {
  params: Promise<{
    league: string;
  }>;
}

export async function generateMetadata({ params }: LeaguePageProps): Promise<Metadata> {
  const { league } = await params;
  const competition = await getCompetitionBySlug(league);

  if (!competition) {
    return {
      title: 'League Not Found',
    };
  }

  const baseUrl = 'https://kroam.xyz';
  const url = `${baseUrl}/predictions/${league}`;

  return {
    title: `${competition.name} Predictions & AI Forecasts | Kroam`,
    description: `Expert AI football predictions for ${competition.name}. View upcoming matches, recent results, model accuracy rankings, and detailed match analysis.`,
    alternates: {
      canonical: url,
    },
  };
}

export default async function LeagueHubPage({ params }: LeaguePageProps) {
  const { league } = await params;
  const competition = await getCompetitionBySlug(league);

  if (!competition) {
    notFound();
  }

  const allMatches = await getMatchesByCompetitionSlug(league, 100);
  const standings = await getStandingsByCompetitionId(competition.id);

  const upcomingMatches = allMatches.filter(m => m.match.status === 'scheduled');
  const pastMatches = allMatches.filter(m => m.match.status === 'finished');
  const liveMatches = allMatches.filter(m => m.match.status === 'live');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-primary/10">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{competition.name}</h1>
          <p className="text-muted-foreground">AI Predictions & Match Forecasts</p>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {liveMatches.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-red-500">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Live Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {liveMatches.map((m) => (
                  <MatchCard 
                    key={m.match.id} 
                    match={{ 
                      ...m.match, 
                      status: m.match.status || 'scheduled',
                      competition: m.competition 
                    }} 
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Predictions
            </h2>
            {upcomingMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {upcomingMatches.map((m) => (
                  <MatchCard 
                    key={m.match.id} 
                    match={{ 
                      ...m.match, 
                      status: m.match.status || 'scheduled',
                      competition: m.competition 
                    }} 
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  No upcoming matches scheduled for this league.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Recent Results
          </h2>
          {pastMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pastMatches.map((m) => (
                <MatchCard 
                  key={m.match.id} 
                  match={{ 
                    ...m.match, 
                    status: m.match.status || 'finished',
                    competition: m.competition 
                  }} 
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No recent results found.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="standings">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Pos</th>
                      <th className="px-4 py-3 font-semibold">Team</th>
                      <th className="px-4 py-3 font-semibold text-center">PL</th>
                      <th className="px-4 py-3 font-semibold text-center">W</th>
                      <th className="px-4 py-3 font-semibold text-center">D</th>
                      <th className="px-4 py-3 font-semibold text-center">L</th>
                      <th className="px-4 py-3 font-semibold text-center">GD</th>
                      <th className="px-4 py-3 font-semibold text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {standings.map((team) => (
                      <tr key={team.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{team.position}</td>
                        <td className="px-4 py-3 font-bold">{team.teamName}</td>
                        <td className="px-4 py-3 text-center">{team.played}</td>
                        <td className="px-4 py-3 text-center">{team.won}</td>
                        <td className="px-4 py-3 text-center">{team.drawn}</td>
                        <td className="px-4 py-3 text-center">{team.lost}</td>
                        <td className="px-4 py-3 text-center">{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {standings.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  Standings data currently unavailable.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
