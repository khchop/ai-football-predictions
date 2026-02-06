import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { getLeaderboardWithTrends } from '@/lib/db/queries/stats';
import { getOverallStats } from '@/lib/db/queries';
import { Bot, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/constants';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getOverallStats();
  const modelCount = stats.activeModels;

  return {
    title: buildGenericTitle('AI Model Football Predictions'),
    description: buildGenericDescription(`Compare ${modelCount} AI models predicting football matches. See accuracy rankings, performance trends, and which models predict best.`),
    alternates: {
      canonical: `${BASE_URL}/models`,
    },
    openGraph: {
      title: 'AI Model Football Predictions | Kroam',
      description: `${modelCount} AI models competing to predict football matches across 17 competitions.`,
      url: `${BASE_URL}/models`,
      type: 'website',
      siteName: 'Kroam',
      images: [
        {
          url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Model Football Predictions')}`,
          width: 1200,
          height: 630,
          alt: 'AI Model Football Predictions',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Model Football Predictions | Kroam',
      description: `${modelCount} models competing with live accuracy rankings.`,
      images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Model Football Predictions')}`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ModelsPage() {
  const stats = await getOverallStats();
  const modelCount = stats.activeModels;

  const leaderboard = await getLeaderboardWithTrends(50, 'avgPoints', { timePeriod: 'all' });

  // Empty state
  if (leaderboard.length === 0) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Model Football Predictions</h1>
            <p className="text-muted-foreground">
              Open-source AI models compete to predict football matches across 17 competitions.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No prediction data available yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Models will appear once they start making predictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">AI Model Football Predictions</h1>
          <p className="text-muted-foreground">
            {modelCount} open-source AI models compete to predict football matches across 17 competitions. Rankings update after every match.
          </p>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid gap-3">
        {leaderboard.map((model, index) => {
          const rank = index + 1;
          const trendIcon =
            model.trendDirection === 'rising' ? TrendingUp :
            model.trendDirection === 'falling' ? TrendingDown :
            Minus;
          const trendColor =
            model.trendDirection === 'rising' ? 'text-green-500' :
            model.trendDirection === 'falling' ? 'text-red-500' :
            'text-muted-foreground/50';

          const TrendIcon = trendIcon;

          return (
            <Link key={model.modelId} href={`/models/${model.modelId}`}>
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left: Rank and Name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/30 font-bold text-sm shrink-0">
                        #{rank}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{model.displayName}</h3>
                        <p className="text-sm text-muted-foreground truncate">{model.provider}</p>
                      </div>
                    </div>

                    {/* Right: Stats */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Predictions</p>
                        <p className="font-semibold">{model.totalPredictions.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Avg Points</p>
                        <p className="font-semibold">{model.avgPoints.toFixed(2)}</p>
                      </div>
                      <div className={`${trendColor} flex items-center justify-center w-8`}>
                        <TrendIcon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* CTA to Leaderboard */}
      <div className="text-center">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View detailed leaderboard with filters →
        </Link>
      </div>
    </div>
  );
}
