import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchCard } from '@/components/match-card';
import { getMatchesByCompetitionSlug, getPublishedBlogPosts, getStandingsByCompetitionId } from '@/lib/db/queries';
import { Calendar, Clock, CheckCircle, List, Trophy } from 'lucide-react';
import { CompetitionBadge } from '@/components/competition-badge';
import type { BlogPost } from '@/lib/db/schema';
import type { Match, Competition } from '@/lib/db/schema';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface LeagueHubContentProps {
  competitionId: string;
}

interface MatchWithCompetition {
  match: Match;
  competition: Competition;
}

async function LeagueMatchesList({ competitionId }: { competitionId: string }) {
  const matches = await getMatchesByCompetitionSlug(competitionId, 50);

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No matches found for this competition.</p>
      </div>
    );
  }

  const upcomingMatches = matches.filter((m: MatchWithCompetition) => m.match.status === 'scheduled');
  const liveMatches = matches.filter((m: MatchWithCompetition) => m.match.status === 'live');
  const finishedMatches = matches.filter((m: MatchWithCompetition) => m.match.status === 'finished');

  const MatchGrid = ({ matchList }: { matchList: MatchWithCompetition[] }) => (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {matchList.map(({ match, competition }) => (
        <MatchCard
          key={match.id}
          match={{
            ...match,
            status: match.status || 'scheduled',
            competition: {
              id: competition.id,
              name: competition.name,
            },
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {liveMatches.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-red-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Live ({liveMatches.length})
          </h3>
          <MatchGrid matchList={liveMatches} />
        </div>
      )}

      {upcomingMatches.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Upcoming ({upcomingMatches.length})
          </h3>
          <MatchGrid matchList={upcomingMatches} />
        </div>
      )}

      {finishedMatches.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Recent Results ({finishedMatches.length})
          </h3>
          <MatchGrid matchList={finishedMatches.slice(0, 12)} />
        </div>
      )}
    </div>
  );
}

async function LeagueStandingsTable({ competitionId }: { competitionId: string }) {
  const standings = await getStandingsByCompetitionId(competitionId);

  if (!standings || standings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">Standings not available for this competition.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-4 py-3 text-left font-semibold">#</th>
              <th className="px-4 py-3 text-left font-semibold">Team</th>
              <th className="px-4 py-3 text-center font-semibold">P</th>
              <th className="px-4 py-3 text-center font-semibold">W</th>
              <th className="px-4 py-3 text-center font-semibold">D</th>
              <th className="px-4 py-3 text-center font-semibold">L</th>
              <th className="px-4 py-3 text-center font-semibold">GF</th>
              <th className="px-4 py-3 text-center font-semibold">GA</th>
              <th className="px-4 py-3 text-center font-semibold">GD</th>
              <th className="px-4 py-3 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => (
              <tr key={team.teamId} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-4 py-3">{team.position}</td>
                <td className="px-4 py-3 font-medium">{team.teamName}</td>
                <td className="px-4 py-3 text-center">{team.played}</td>
                <td className="px-4 py-3 text-center">{team.won}</td>
                <td className="px-4 py-3 text-center">{team.drawn}</td>
                <td className="px-4 py-3 text-center">{team.lost}</td>
                <td className="px-4 py-3 text-center">{team.goalsFor}</td>
                <td className="px-4 py-3 text-center">{team.goalsAgainst}</td>
                <td className="px-4 py-3 text-center">{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
                <td className="px-4 py-3 text-right font-semibold">{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function LeagueBlogPosts({ competitionId }: { competitionId: string }) {
  const posts = await getPublishedBlogPosts(6, 0);

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <p className="text-muted-foreground">No blog posts for this competition yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post: BlogPost) => (
        <Link key={post.id} href={`/blog/${post.slug}`}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="mb-2">
                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {post.contentType === 'league_roundup' ? 'League Roundup' : 'Analysis'}
                </span>
              </div>
              <h4 className="font-semibold mb-2 line-clamp-2">{post.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function MatchesLoadingSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

function StandingsLoadingSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export async function LeagueHubContent({ competitionId }: LeagueHubContentProps) {
  return (
    <Tabs defaultValue="matches" className="space-y-6">
      <TabsList className="bg-card/50 border border-border/50">
        <TabsTrigger value="matches" className="gap-2">
          <Calendar className="h-4 w-4" />
          Matches
        </TabsTrigger>
        <TabsTrigger value="standings" className="gap-2">
          <Trophy className="h-4 w-4" />
          Standings
        </TabsTrigger>
        <TabsTrigger value="news" className="gap-2">
          <List className="h-4 w-4" />
          News
        </TabsTrigger>
      </TabsList>

      <TabsContent value="matches">
        <Suspense fallback={<MatchesLoadingSkeleton />}>
          <LeagueMatchesList competitionId={competitionId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="standings">
        <Suspense fallback={<StandingsLoadingSkeleton />}>
          <LeagueStandingsTable competitionId={competitionId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="news">
        <Suspense fallback={<MatchesLoadingSkeleton />}>
          <LeagueBlogPosts competitionId={competitionId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
