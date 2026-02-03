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
import { getDb, matches } from '@/lib/db';
import { eq, or } from 'drizzle-orm';
import { getLeaderboard, type LeaderboardFilters as LeaderboardQueryFilters } from '@/lib/db/queries/stats';

// ISR: Revalidate every 60 seconds

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getClubExists(clubId: string): Promise<boolean> {
  const db = getDb();
  const matchCheck = await db.query.matches.findFirst({
    where: or(eq(matches.homeTeam, clubId), eq(matches.awayTeam, clubId)),
  });
  return !!matchCheck;
}

interface LeaderboardContentProps {
  clubId: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

async function LeaderboardContent({ clubId, searchParams }: LeaderboardContentProps) {
  // Parse filter parameters
  const season = typeof searchParams.season === 'string' ? parseInt(searchParams.season, 10) : undefined;
  const isHome = typeof searchParams.isHome === 'string' ? searchParams.isHome === 'true' : undefined;

  // Verify club has matches
  const clubExists = await getClubExists(clubId);

  if (!clubExists) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">Club not found.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          The requested club does not exist or has no match data.
        </p>
      </div>
    );
  }

  // Build filters and query database directly
  const filters: LeaderboardQueryFilters = {
    clubId,
    isHome,
    season,
  };

  const leaderboard = await getLeaderboard(50, 'avgPoints', filters);

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No prediction data available for this club.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Models will start appearing once they make predictions for this club&apos;s matches.
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
  const { id: clubId } = await params;

  const clubExists = await getClubExists(clubId);

  if (clubExists) {
    // Use clubId as the name (formatted)
    const clubName = clubId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: `${clubName} Model Performance | kroam`,
      description: `AI model prediction performance for ${clubName} matches`,
    };
  }

  return {
    title: 'Club Leaderboard | kroam',
    description: 'AI model performance for football predictions',
  };
}

export default async function ClubLeaderboardPage({ params, searchParams }: PageProps) {
  const { id: clubId } = await params;
  const resolvedParams = await searchParams;

  // Format club ID as name (title case)
  const clubName = clubId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <LiveTabRefresher refreshInterval={30000}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{clubName} Model Performance</h1>
            <p className="text-muted-foreground">
              AI model predictions for {clubName} matches
            </p>
          </div>
        </div>

        {/* Filters */}
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <LeaderboardFilters disabledFilters={['club']} />
        </Suspense>

        {/* Leaderboard Content */}
        <Suspense fallback={<LeaderboardTableSkeleton />}>
          <LeaderboardContent clubId={clubId} searchParams={resolvedParams} />
        </Suspense>
      </div>
    </LiveTabRefresher>
  );
}
