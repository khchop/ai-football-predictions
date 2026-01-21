import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { AccuracyChart } from '@/components/accuracy-chart';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLeaderboardFiltered } from '@/lib/db/queries';
import { Trophy, BarChart3, Table } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function LeaderboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Parse filter params
  const daysParam = searchParams.days;
  const minPredictionsParam = searchParams.minPredictions;
  
  const filters = {
    days: daysParam ? parseInt(String(daysParam), 10) : undefined,
    minPredictions: minPredictionsParam ? parseInt(String(minPredictionsParam), 10) : 5,
    activeOnly: true,
  };

  const leaderboard = await getLeaderboardFiltered(filters);
  
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No predictions match your filters.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Try adjusting the time period or minimum predictions filter.
        </p>
      </div>
    );
  }
  
  return (
    <Tabs defaultValue="table" className="space-y-6">
      <TabsList className="bg-card/50 border border-border/50">
        <TabsTrigger value="table" className="gap-2 data-[state=active]:bg-primary/10">
          <Table className="h-4 w-4" />
          Table
        </TabsTrigger>
        <TabsTrigger value="chart" className="gap-2 data-[state=active]:bg-primary/10">
          <BarChart3 className="h-4 w-4" />
          Chart
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="table">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <LeaderboardTable entries={leaderboard} />
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="chart">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <AccuracyChart data={leaderboard} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
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

      {/* Scoring Guide - Kicktipp Quota System */}
      <div className="rounded-xl bg-card/50 border border-border/50 p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Quota Scoring System</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-2xl font-bold text-primary">2-6</p>
            <p className="text-xs font-medium mt-1">Tendency</p>
            <p className="text-xs text-muted-foreground">Rarer = more pts</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">+1</p>
            <p className="text-xs font-medium mt-1">Goal Diff</p>
            <p className="text-xs text-muted-foreground">Correct margin</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">+3</p>
            <p className="text-xs font-medium mt-1">Exact Score</p>
            <p className="text-xs text-muted-foreground">Perfect match</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-3 text-center">
            <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">10</p>
            <p className="text-xs font-medium mt-1">Maximum</p>
            <p className="text-xs text-muted-foreground">Per match</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Quota points depend on how many AI models predicted the same result. Rarer correct predictions earn more points!
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="h-10" />}>
        <LeaderboardFilters />
      </Suspense>

      {/* Leaderboard Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <LeaderboardContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
