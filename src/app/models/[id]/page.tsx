import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getModelById,
  getModelBettingStats,
  getModelPredictionStats,
  getModelWeeklyPerformance,
  getModelStatsByCompetition,
} from '@/lib/db/queries';
import { getProviderById, type ModelTier } from '@/lib/llm';
import { ArrowLeft, Bot, Sparkles, DollarSign, TrendingUp, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ModelPerformanceChart } from '@/components/model-performance-chart';
import { ModelCompetitionBreakdown } from '@/components/model-competition-breakdown';

export const dynamic = 'force-dynamic';

interface ModelPageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { id } = await params;
  const model = await getModelById(id);

  if (!model) {
    return {
      title: 'Model Not Found',
    };
  }

  const baseUrl = 'https://kroam.xyz';
  const url = `${baseUrl}/models/${id}`;

  return {
    title: `${model.displayName} AI Prediction Accuracy & Stats | Kroam`,
    description: `Track the football prediction performance of ${model.displayName}. View ROI, win rate, recent streak, and league-by-league accuracy analysis.`,
    alternates: {
      canonical: url,
    },
  };
}

// Loading skeleton for stats
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

// Loading skeleton for chart
function ChartSkeleton() {
  return <Skeleton className="h-[300px] rounded-xl" />;
}

// Loading skeleton for table
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { id } = await params;

  // Fetch model data
  const model = await getModelById(id);

  if (!model) {
    notFound();
  }

  // Fetch all model data
  const [bettingStats, predictionStats, weeklyPerformance, competitionStats] = await Promise.all([
    getModelBettingStats(id),
    getModelPredictionStats(id),
    getModelWeeklyPerformance(id),
    getModelStatsByCompetition(id),
  ]);

  // Get provider info for tier badge
  const provider = getProviderById(id);
  const tier = provider && 'tier' in provider ? (provider as { tier: ModelTier }).tier : undefined;

  return (
    <div className="space-y-8">
      {/* ... previous code ... */}
      
      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-8">
          {/* Betting Performance */}
          {bettingStats && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Betting Performance</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-card/50 border border-border/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Balance</p>
                  <p className="text-2xl font-bold font-mono">€{bettingStats.balance.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-card/50 border border-border/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Profit/Loss</p>
                  <p className={cn(
                    "text-2xl font-bold font-mono",
                    bettingStats.profit > 0 && "text-green-400",
                    bettingStats.profit < 0 && "text-red-400"
                  )}>
                    {bettingStats.profit >= 0 ? '+' : ''}€{bettingStats.profit.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl bg-card/50 border border-border/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">ROI</p>
                  <p className={cn(
                    "text-2xl font-bold font-mono",
                    bettingStats.roi > 0 && "text-green-400",
                    bettingStats.roi < 0 && "text-red-400"
                  )}>
                    {bettingStats.roi >= 0 ? '+' : ''}{bettingStats.roi.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl bg-card/50 border border-border/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                  <p className="text-2xl font-bold font-mono">{bettingStats.winRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{bettingStats.winningBets}/{bettingStats.totalBets}</p>
                </div>
              </div>
            </section>
          )}

          {/* Performance Chart */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Performance Trend</h2>
            </div>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6">
                <Suspense fallback={<ChartSkeleton />}>
                  <ModelPerformanceChart data={weeklyPerformance} />
                </Suspense>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-8">
          {/* Competition Breakdown */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">By League</h2>
            </div>
            <Suspense fallback={<StatsSkeleton />}>
              <ModelCompetitionBreakdown data={competitionStats} />
            </Suspense>
          </section>

          {/* Streaks & Records */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Streaks</h2>
            </div>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Streak</span>
                  <span className={cn(
                    "font-bold",
                    (model.currentStreak || 0) > 0 ? "text-green-400" : (model.currentStreak || 0) < 0 ? "text-red-400" : ""
                  )}>
                    {(model.currentStreak || 0) > 0 ? '+' : ''}{model.currentStreak || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Best Win Streak</span>
                  <span className="font-bold text-green-400">+{model.bestStreak || 0}</span>
                </div>
                {predictionStats && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Exact Scores</span>
                      <span className="font-bold text-primary">{predictionStats.exactScores}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Points/Match</span>
                      <span className="font-bold">{predictionStats.avgPoints}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
