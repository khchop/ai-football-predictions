import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getModelById,
  getModelBettingStats,
} from '@/lib/db/queries';
import { getProviderById, type ModelTier } from '@/lib/llm';
import { ArrowLeft, Bot, Sparkles, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export default async function ModelPage({ params }: ModelPageProps) {
  const { id } = await params;

  // Fetch model data
  const model = await getModelById(id);

  if (!model) {
    notFound();
  }

  // Fetch betting stats only (old prediction stats removed)
  const [bettingStats] = await Promise.all([
    getModelBettingStats(id),
  ]);
  
  // Stub data for removed prediction-based components
  const stats = {
    totalPredictions: 0,
    totalPoints: 0,
    averagePoints: 0,
    accuracy: 0,
    exactScores: 0,
    correctTendencies: 0,
    correctGoalDiffs: 0,
  };
  const weeklyPerformance: any[] = [];
  const competitionStats: any[] = [];

  // Get provider info for tier badge
  const provider = getProviderById(id);
  const tier = provider && 'tier' in provider ? (provider as { tier: ModelTier }).tier : undefined;

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

      {/* Stats Grid - Removed, using betting system now */}

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

      {/* TODO: Add betting history component - showing betting performance above */}
    </div>
  );
}
