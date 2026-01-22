import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BettingLeaderboardTable } from '@/components/betting-leaderboard-table';
import { getBettingLeaderboard } from '@/lib/db/queries';
import { BETTING_CONSTANTS } from '@/lib/betting/constants';
import { Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function LeaderboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const leaderboard = await getBettingLeaderboard();
  
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No betting data available yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Models will start appearing once they place bets.
        </p>
      </div>
    );
  }
  
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <BettingLeaderboardTable entries={leaderboard} />
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

      {/* Betting Info */}
      <div className="rounded-xl bg-card/50 border border-border/50 p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Betting System</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-2xl font-bold text-primary">€{BETTING_CONSTANTS.STARTING_BALANCE.toFixed(0)}</p>
            <p className="text-xs font-medium mt-1">Starting Balance</p>
            <p className="text-xs text-muted-foreground">Per model</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{BETTING_CONSTANTS.BETS_PER_MATCH}</p>
            <p className="text-xs font-medium mt-1">Bets Per Match</p>
            <p className="text-xs text-muted-foreground">Result, O/U, BTTS</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">€{BETTING_CONSTANTS.STAKE_PER_BET.toFixed(0)}</p>
            <p className="text-xs font-medium mt-1">Stake Per Bet</p>
            <p className="text-xs text-muted-foreground">Fixed amount</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-3 text-center">
            <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">ROI</p>
            <p className="text-xs font-medium mt-1">Ranked By</p>
            <p className="text-xs text-muted-foreground">Return on invest</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Models analyze matches and place 3 bets each: Match Result (1X2/Double Chance), Over/Under Goals, and Both Teams To Score (BTTS).
        </p>
      </div>

      {/* Leaderboard Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <LeaderboardContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
