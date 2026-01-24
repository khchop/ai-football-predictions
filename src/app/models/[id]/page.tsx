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
  getModelRank,
  getModelResultTypeBreakdown,
} from '@/lib/db/queries';
import { getProviderById, type ModelTier } from '@/lib/llm';
import { ArrowLeft, Bot, Sparkles, DollarSign, TrendingUp, BarChart2, Award, Target } from 'lucide-react';
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
  const [bettingStats, predictionStats, weeklyPerformance, competitionStats, modelRank, resultTypeBreakdown] = await Promise.all([
    getModelBettingStats(id),
    getModelPredictionStats(id),
    getModelWeeklyPerformance(id),
    getModelStatsByCompetition(id),
    getModelRank(id),
    getModelResultTypeBreakdown(id),
  ]);

  // Get provider info
  const provider = getProviderById(id);

   // Calculate hero stats
   const totalPredictions = predictionStats?.totalPredictions || 0;
   const avgPointsPerMatch = predictionStats?.avgPoints || '0.00';
   const tendencyAccuracy = predictionStats?.scoredPredictions 
     ? Math.round((predictionStats.correctTendencies / predictionStats.scoredPredictions) * 100)
     : 0;

   return (
     <div className="space-y-8">
       {/* Model Header */}
       <div className="border-b border-border/50 pb-6">
         <div className="flex items-start justify-between gap-4 mb-4">
           <Link 
             href="/leaderboard" 
             className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
           >
             <ArrowLeft className="h-4 w-4" />
             Back to Leaderboard
           </Link>
         </div>

         {/* Model Name and Provider */}
         <div className="space-y-2 mb-4">
           <div className="flex items-center gap-3">
             <Bot className="h-8 w-8 text-primary" />
             <div>
               <h1 className="text-3xl font-bold">{model.displayName}</h1>
               <p className="text-sm text-muted-foreground capitalize">
                 {provider?.name || model.provider} AI Model
               </p>
             </div>
           </div>
         </div>

         {/* Model Description */}
         {model.modelDescription && (
           <div className="bg-card/30 border border-border/50 rounded-lg p-4">
             <p className="text-sm leading-relaxed text-foreground/80">
               {model.modelDescription}
             </p>
           </div>
         )}
       </div>
       
        {/* Hero Stats - Key Metrics at a Glance */}
        <section aria-label="Key Performance Metrics">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Global Rank */}
            <Card className={modelRank ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" : "bg-card/50 border-border/50"}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Global Rank</p>
                </div>
                <p className="text-4xl font-bold text-primary">
                  {modelRank ? `#${modelRank}` : "Unranked"}
                </p>
              </CardContent>
            </Card>

           {/* Average Points */}
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-6">
               <div className="flex items-center gap-2 mb-2">
                 <TrendingUp className="h-4 w-4 text-primary" />
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Points</p>
               </div>
               <p className="text-4xl font-bold font-mono">{avgPointsPerMatch}</p>
               <p className="text-xs text-muted-foreground mt-1">per match</p>
             </CardContent>
           </Card>

           {/* Total Predictions */}
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-6">
               <div className="flex items-center gap-2 mb-2">
                 <Target className="h-4 w-4 text-primary" />
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Predictions</p>
               </div>
               <p className="text-4xl font-bold font-mono">{totalPredictions}</p>
               <p className="text-xs text-muted-foreground mt-1">matches</p>
             </CardContent>
           </Card>

           {/* Tendency Accuracy */}
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-6">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="h-4 w-4 text-primary" />
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accuracy</p>
               </div>
               <p className="text-4xl font-bold font-mono">{tendencyAccuracy}%</p>
               <p className="text-xs text-muted-foreground mt-1">tendency</p>
             </CardContent>
           </Card>
         </div>
       </section>

       {/* Betting Performance (only if data exists) */}
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

       {/* Performance Overview - Chart + Breakdown */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Performance Chart */}
         <section className="lg:col-span-2">
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

         {/* Result Type + Streaks Combined */}
         <section>
           <div className="flex items-center gap-2 mb-4">
             <Target className="h-5 w-5 text-primary" />
             <h2 className="text-xl font-semibold">Performance Breakdown</h2>
           </div>
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-4 space-y-6">
               {/* Result Type Breakdown */}
               {resultTypeBreakdown && resultTypeBreakdown.length === 3 && (
                 <div>
                   <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">By Result Type</h3>
                   <div className="space-y-3">
                     {resultTypeBreakdown.map((breakdown) => {
                       const resultLabel = 
                         breakdown.resultType === 'H' ? 'Home Win' :
                         breakdown.resultType === 'D' ? 'Draw' :
                         'Away Win';
                       
                       return (
                         <div key={breakdown.resultType}>
                           <div className="flex justify-between items-center mb-1">
                             <span className="text-sm text-muted-foreground">{resultLabel}</span>
                             <span className="text-sm font-semibold">{breakdown.count} predictions</span>
                           </div>
                           <div className="flex justify-between items-center text-xs">
                             <span className="text-muted-foreground">Accuracy: {breakdown.accuracy}%</span>
                             <span className="text-primary font-semibold">Avg: {breakdown.avgPoints} pts</span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {/* Streaks */}
               <div>
                 <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Streaks</h3>
                 <div className="space-y-3">
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
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-muted-foreground">Exact Scores</span>
                       <span className="font-bold text-primary">{predictionStats.exactScores}</span>
                     </div>
                   )}
                 </div>
               </div>
             </CardContent>
           </Card>
         </section>
       </div>

       {/* Competition Breakdown - Full Width */}
       <section>
         <div className="flex items-center gap-2 mb-4">
           <BarChart2 className="h-5 w-5 text-primary" />
           <h2 className="text-xl font-semibold">Performance by League</h2>
         </div>
         <Card className="bg-card/50 border-border/50">
           <CardContent className="p-6">
             <Suspense fallback={<TableSkeleton />}>
               <ModelCompetitionBreakdown data={competitionStats} />
             </Suspense>
           </CardContent>
         </Card>
       </section>
     </div>
   );
}
