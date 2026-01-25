import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import { getLeaderboard, type TimeRange } from '@/lib/db/queries';
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Football Prediction Leaderboard | kroam Rankings',
  description: 'Compare 29 open-source AI models\' football prediction accuracy. See rankings by competition, ROI, win rate, and prediction streaks using the Kicktipp scoring system.',
  alternates: {
    canonical: 'https://kroam.xyz/leaderboard',
  },
  openGraph: {
    title: 'AI Football Prediction Leaderboard',
    description: 'Compare 29 open-source AI models\' football prediction accuracy across 17 competitions',
    url: 'https://kroam.xyz/leaderboard',
    type: 'website',
    siteName: 'kroam.xyz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Football Prediction Leaderboard',
    description: 'Compare 29 AI models\' football prediction accuracy',
  },
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function LeaderboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Parse filter parameters
  const competitionId = typeof searchParams.competition === 'string' && searchParams.competition !== 'all' 
    ? searchParams.competition 
    : undefined;
  const timeRange = (typeof searchParams.timeRange === 'string' ? searchParams.timeRange : 'all') as TimeRange;
  const minPredictions = typeof searchParams.minPredictions === 'string' 
    ? parseInt(searchParams.minPredictions, 10) 
    : 0;
  
  const leaderboard = await getLeaderboard({ competitionId, timeRange });
  
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
  
  // Map the data to match LeaderboardTable's expected format
  const formattedLeaderboard = leaderboard
    .map(entry => ({
      modelId: entry.model.id,
      displayName: entry.model.displayName,
      provider: entry.model.provider,
      totalPredictions: Number(entry.totalPredictions) || 0,
      totalPoints: Number(entry.totalPoints) || 0,
      averagePoints: Number(entry.avgPoints) || 0, // Convert to number (DB may return string)
      exactScores: Number(entry.exactScores) || 0,
      correctTendencies: Number(entry.correctTendencies) || 0,
    }))
    .filter(entry => entry.totalPredictions >= minPredictions);
  
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <LeaderboardTable entries={formattedLeaderboard} />
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  
  return (
    <div className="space-y-8">
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
      <Suspense fallback={<LoadingSkeleton />}>
        <LeaderboardContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
