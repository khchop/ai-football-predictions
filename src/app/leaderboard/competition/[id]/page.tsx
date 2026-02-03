import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { LeaderboardTableSkeleton } from '@/components/leaderboard/skeleton';
import type { LeaderboardEntry } from '@/lib/table/columns';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import { LiveTabRefresher } from '@/app/matches/live-refresher';
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import { getDb, competitions } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getLeaderboard, type LeaderboardFilters as LeaderboardQueryFilters } from '@/lib/db/queries/stats';

// ISR: Revalidate every 60 seconds

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getCompetition(competitionId: string) {
  const db = getDb();
  return db.query.competitions.findFirst({
    where: eq(competitions.id, competitionId),
  });
}

interface LeaderboardContentProps {
  competitionId: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

async function LeaderboardContent({ competitionId, searchParams }: LeaderboardContentProps) {
  // Parse filter parameters
  const season = typeof searchParams.season === 'string' ? parseInt(searchParams.season, 10) : undefined;

  // Verify competition exists
  const competition = await getCompetition(competitionId);

  if (!competition) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">Competition not found.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          The requested competition does not exist or has no data.
        </p>
      </div>
    );
  }

  // Build filters and query database directly
  const filters: LeaderboardQueryFilters = {
    competitionId,
    season,
  };

  const leaderboard = await getLeaderboard(50, 'avgPoints', filters);

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No prediction data available for this competition.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Models will start appearing once they make predictions in this competition.
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
  }));

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <LeaderboardTable entries={formattedLeaderboard} />
      </CardContent>
    </Card>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: competitionId } = await params;

  const competition = await getCompetition(competitionId);

  if (competition) {
    return {
      title: `${competition.name} Leaderboard | kroam`,
      description: `AI model performance rankings for ${competition.name} predictions`,
    };
  }

  return {
    title: 'Competition Leaderboard | kroam',
    description: 'AI model performance rankings for football predictions',
  };
}

export default async function CompetitionLeaderboardPage({ params, searchParams }: PageProps) {
  const { id: competitionId } = await params;
  const resolvedParams = await searchParams;

  // Get competition name for page title
  const competition = await getCompetition(competitionId);
  const competitionName = competition?.name || null;

  return (
    <LiveTabRefresher refreshInterval={30000}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{competitionName || 'Competition'} Leaderboard</h1>
            <p className="text-muted-foreground">
              AI model performance for {competitionName || 'this competition'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <LeaderboardFilters disabledFilters={['competition']} />
        </Suspense>

        {/* Leaderboard Content */}
        <Suspense fallback={<LeaderboardTableSkeleton />}>
          <LeaderboardContent competitionId={competitionId} searchParams={resolvedParams} />
        </Suspense>
      </div>
    </LiveTabRefresher>
  );
}
