import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense, cache } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getModelById,
  getModelBettingStats,
  getModelPredictionStats,
  getModelWeeklyPerformance,
  getModelStatsByCompetitionWithRank,
  getModelRank,
  getModelResultTypeBreakdown,
} from '@/lib/db/queries';
import { getProviderById } from '@/lib/llm';
import { ArrowLeft, Bot, Sparkles, DollarSign, TrendingUp, BarChart2, Award, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ModelPerformanceChart } from '@/components/model-performance-chart';
import { ModelCompetitionBreakdown } from '@/components/model-competition-breakdown';
import { WebPageSchema } from '@/components/WebPageSchema';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { BASE_URL } from '@/lib/seo/constants';
import { AccuracyDisplay } from '@/components/accuracy-display';
import { RelatedModelsWidget } from '@/components/model/related-models-widget';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildModelBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';

// Memoize queries to avoid duplication between generateMetadata and page component
const getModelStatsData = cache((modelId: string) => getModelPredictionStats(modelId));
const getModelRankData = cache((modelId: string) => getModelRank(modelId));

// PPR enabled - removed force-dynamic, Next.js handles static/dynamic split via Suspense

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

  // Get prediction stats for OG image (uses memoized queries)
  const predictionStats = await getModelStatsData(id);
  const modelRank = await getModelRankData(id);
  
  // Calculate tendency accuracy from stats (correctTendencies / scoredPredictions * 100)
  // This matches the hero section's "Accuracy" display
  const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
    ? Math.round((predictionStats.correctTendencies / predictionStats.scoredPredictions) * 100)
    : 0;
  const rank = modelRank || 999;

  // Create OG image URL with encoded parameters
  const ogImageUrl = new URL(`${baseUrl}/api/og/model`);
  ogImageUrl.searchParams.set('modelName', model.displayName);
  ogImageUrl.searchParams.set('accuracy', accuracy.toString());
  ogImageUrl.searchParams.set('rank', rank.toString());

  return {
    title: `${model.displayName} Predictions | AI Football Model | kroam.xyz`,
    description: `${model.displayName} football predictions and accuracy stats. See performance across competitions with Prediction Accuracy: ${accuracy}%.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${model.displayName} AI Model`,
      description: `${accuracy}% tendency accuracy in football predictions - Rank #${rank}. Prediction Accuracy: ${accuracy}%`,
      url: url,
      type: 'website',
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${model.displayName} AI football prediction model`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${model.displayName} AI Model`,
      description: `${accuracy}% tendency accuracy in football predictions`,
      images: [ogImageUrl.toString()],
    },
  };
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

  // Fetch all model data (reuses memoized queries for prediction stats and rank)
  const [bettingStats, predictionStats, weeklyPerformance, competitionStats, modelRank, resultTypeBreakdown] = await Promise.all([
    getModelBettingStats(id),
    getModelStatsData(id),
    getModelWeeklyPerformance(id),
    getModelStatsByCompetitionWithRank(id),
    getModelRankData(id),
    getModelResultTypeBreakdown(id),
  ]);

  // Get provider info
  const provider = getProviderById(id);

   // Calculate hero stats
   // Use scoredPredictions for consistency with accuracy calculation
   const scoredPredictions = predictionStats?.scoredPredictions || 0;
   const totalPredictions = predictionStats?.totalPredictions || 0;
   const pendingPredictions = totalPredictions - scoredPredictions;
   const avgPointsPerMatch = predictionStats?.avgPoints || '0.00';
   const tendencyAccuracy = scoredPredictions 
     ? Math.round((predictionStats.correctTendencies / scoredPredictions) * 100)
     : 0;

    // Build BreadcrumbList schema
    const breadcrumbs = buildBreadcrumbSchema([
      { name: 'Home', url: BASE_URL },
      { name: 'Models', url: `${BASE_URL}/leaderboard` },
      { name: model.displayName, url: `${BASE_URL}/models/${id}` },
    ]);

    const schema = {
      '@context': 'https://schema.org',
      '@graph': [breadcrumbs],
    };

    // Build visual breadcrumbs
    const visualBreadcrumbs = buildModelBreadcrumbs(model.displayName, id);

    return (
      <div className="space-y-8">
        {/* Structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <WebPageSchema
          name={`${model.displayName} - AI Football Prediction Model`}
          description={`${model.displayName} AI model performance and statistics. Ranked #${modelRank || '—'} with ${scoredPredictions} predictions scored.`}
          url={`${BASE_URL}/models/${id}`}
          breadcrumb={[
            { name: 'Home', url: BASE_URL },
            { name: 'Leaderboard', url: `${BASE_URL}/leaderboard` },
            { name: model.displayName, url: `${BASE_URL}/models/${id}` },
          ]}
        />

        {/* Breadcrumbs */}
        <Breadcrumbs items={visualBreadcrumbs} />

       {/* Model Header */}
       <div className="border-b border-border/50 pb-6">

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

           {/* Scored Predictions */}
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-6">
               <div className="flex items-center gap-2 mb-2">
                 <Target className="h-4 w-4 text-primary" />
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Predictions</p>
               </div>
               <p className="text-4xl font-bold font-mono">{scoredPredictions}</p>
               <p className="text-xs text-muted-foreground mt-1">
                 {pendingPredictions > 0 ? `scored (${pendingPredictions} pending)` : 'matches'}
               </p>
             </CardContent>
           </Card>

           {/* Tendency Accuracy */}
           <Card className="bg-card/50 border-border/50">
             <CardContent className="p-6">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="h-4 w-4 text-primary" />
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accuracy</p>
               </div>
               <AccuracyDisplay
                 correct={predictionStats?.correctTendencies || 0}
                 total={scoredPredictions}
                 size="lg"
                 className="text-4xl"
               />
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

       {/* Related Models - SEO Internal Linking */}
       <section>
         <RelatedModelsWidget currentModelId={id} />
       </section>
     </div>
   );
}
