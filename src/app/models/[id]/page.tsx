import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ModelStatsGrid } from '@/components/model-stats-grid';
import { ModelPerformanceChart } from '@/components/model-performance-chart';
import { ModelCompetitionBreakdown } from '@/components/model-competition-breakdown';
import { ModelPredictionHistory } from '@/components/model-prediction-history';
import {
  getModelById,
  getModelOverallStats,
  getModelWeeklyPerformance,
  getModelStatsByCompetition,
  getModelPredictionHistory,
  getModelFunStats,
} from '@/lib/db/queries';
import { getProviderById, type ModelTier } from '@/lib/llm';
import { ArrowLeft, Bot, Sparkles, Target, Hash } from 'lucide-react';
import type { Metadata } from 'next';

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
      title: 'Model Not Found - AI Football Predictions',
    };
  }

  return {
    title: `${model.displayName} - AI Football Predictions`,
    description: `View prediction history and performance stats for ${model.displayName}. See accuracy, streaks, and competition breakdown.`,
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

// Fun stats component
function FunStats({ stats }: { stats: Awaited<ReturnType<typeof getModelFunStats>> }) {
  if (!stats.mostPredictedScore && !stats.bestExactScore) {
    return null;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {stats.mostPredictedScore && (
        <div className="rounded-xl bg-card/50 border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Favorite Prediction</span>
          </div>
          <p className="text-2xl font-bold font-mono">{stats.mostPredictedScore.score}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Predicted {stats.mostPredictedScore.count} times
          </p>
        </div>
      )}
      {stats.bestExactScore && (
        <div className="rounded-xl bg-card/50 border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-green-400" />
            <span className="text-sm text-muted-foreground">Best Exact Score</span>
          </div>
          <p className="text-2xl font-bold font-mono text-green-400">{stats.bestExactScore.score}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Hit correctly {stats.bestExactScore.count} time{stats.bestExactScore.count !== 1 ? 's' : ''}
          </p>
        </div>
      )}
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

  // Fetch all data in parallel
  const [stats, weeklyPerformance, competitionStats, recentPredictions, funStats] = await Promise.all([
    getModelOverallStats(id),
    getModelWeeklyPerformance(id),
    getModelStatsByCompetition(id),
    getModelPredictionHistory(id, { limit: 21 }), // Fetch 21 to check if there are more
    getModelFunStats(id),
  ]);

  // Get provider info for tier badge
  const provider = getProviderById(id);
  const tier = provider && 'tier' in provider ? (provider as { tier: ModelTier }).tier : undefined;

  // Check if there are more predictions
  const hasMorePredictions = recentPredictions.length > 20;
  const displayPredictions = hasMorePredictions ? recentPredictions.slice(0, 20) : recentPredictions;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leaderboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
          <Bot className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{model.displayName}</h1>
          <p className="text-muted-foreground capitalize">{model.provider}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <Suspense fallback={<StatsSkeleton />}>
        <ModelStatsGrid model={model} stats={stats} tier={tier} />
      </Suspense>

      {/* Fun Stats */}
      <FunStats stats={funStats} />

      {/* Performance Chart */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Performance Over Time</h2>
        </div>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <Suspense fallback={<ChartSkeleton />}>
              <ModelPerformanceChart data={weeklyPerformance} />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Competition Breakdown */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Performance by Competition</h2>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <Suspense fallback={<TableSkeleton />}>
              <ModelCompetitionBreakdown data={competitionStats} />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Recent Predictions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent Predictions</h2>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <Suspense fallback={<TableSkeleton />}>
              <ModelPredictionHistory
                initialData={displayPredictions}
                modelId={id}
                hasMore={hasMorePredictions}
              />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
