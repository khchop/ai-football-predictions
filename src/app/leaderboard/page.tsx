import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { LeaderboardTableSkeleton } from '@/components/leaderboard/skeleton';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import { FaqSchema } from '@/components/FaqSchema';
import type { LeaderboardEntry } from '@/lib/table/columns';
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import type { FAQItem } from '@/lib/seo/schemas';
import { LiveTabRefresher } from '@/app/matches/live-refresher';

// FAQ data for model ranking questions
const leaderboardFaqs: FAQItem[] = [
  {
    question: "What determines AI model ranking on this leaderboard?",
    answer: "Models are ranked by total points earned from football predictions using the Kicktipp scoring system. Points are awarded based on prediction accuracy: 2-6 points for correct match tendency (win/draw/loss), +1 bonus for correct goal difference, and +3 bonus for exact score predictions. Maximum 10 points per match.",
  },
  {
    question: "How is prediction accuracy calculated?",
    answer: "Prediction accuracy is measured using the Kicktipp Quota system, which rewards both the outcome prediction (tendency) and the precision of score estimation. The rarity of each prediction affects tendency points—uncommon correct predictions (e.g., away wins) earn more points than common ones (e.g., home wins). Average points per prediction shows model consistency.",
  },
  {
    question: "What are the best performing models?",
    answer: "Top-performing models are those with the highest average points per prediction across multiple competitions and time periods. Performance varies by competition—some models excel at Premier League predictions while others perform better in European competitions. Use the timeframe and competition filters to find the best model for your specific needs.",
  },
  {
    question: "Can I filter leaderboard by competition or time period?",
    answer: "Yes. Use the competition filter to view rankings for specific leagues (Premier League, La Liga, Serie A, etc.) or select 'All Competitions' for aggregate rankings. Time range filters show recent performance (Last 7 days, 30 days, all-time), helping identify both consistent long-term performers and recently improving models.",
  },
  {
    question: "What does 'Correct Tendencies' mean?",
    answer: "'Correct Tendencies' is the count of predictions where the model correctly predicted the match outcome (home win, draw, or away win). This is separate from the points awarded, which depend on prediction rarity via the Kicktipp system. A model with high tendency accuracy but lower total points may struggle with exact score predictions.",
  },
];

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

/**
 * Fetch leaderboard data from the API with ISR caching.
 *
 * ISR Pattern: Uses fetch-level `revalidate: 60` option (Phase 3 pattern)
 *
 * Note: Next.js supports two valid ISR patterns:
 * 1. Fetch-level: next: { revalidate: 60 } in fetch options (used here)
 * 2. Page-level: export const revalidate = 60 at module scope (Phase 5 pattern)
 *
 * The fetch-level approach allows more granular control when pages make multiple
 * fetch calls with different revalidation needs. Leaderboard pages were built
 * using this pattern in Phase 3 and remain consistent with the original design.
 */
async function fetchLeaderboard(filters: Record<string, string>): Promise<{
  success: boolean;
  data?: Array<{
    rank: number;
    modelId: string;
    displayName: string;
    provider: string;
    totalPredictions: number;
    scoredPredictions: number;
    totalPoints: number;
    avgPoints: number;
    accuracy: number;
    exactScores: number;
    correctTendencies: number;
  }>;
  error?: string;
}> {
  const cronSecret = process.env.CRON_SECRET || '';

  const searchParams = new URLSearchParams(filters);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stats/leaderboard?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function LeaderboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Parse filter parameters - note: timeRange is not passed to API as it's not supported
  const competition = typeof searchParams.competition === 'string' && searchParams.competition !== 'all'
    ? searchParams.competition
    : undefined;
  const season = typeof searchParams.season === 'string' && searchParams.season !== 'all'
    ? searchParams.season
    : undefined;
  const model = typeof searchParams.model === 'string' && searchParams.model !== 'all'
    ? searchParams.model
    : undefined;
  const minPredictions = typeof searchParams.minPredictions === 'string'
    ? parseInt(searchParams.minPredictions, 10)
    : 0;

  // Build filters for API
  const filters: Record<string, string> = {};
  if (competition) filters.competition = competition;
  if (season) filters.season = season;
  if (model) filters.model = model;

  // Fetch from API
  const result = await fetchLeaderboard(filters);
  const leaderboard = result.data || [];

  if (!result.success || leaderboard.length === 0) {
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
  })).filter((entry) => entry.totalPredictions >= minPredictions);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <LeaderboardTable entries={formattedLeaderboard} />
      </CardContent>
    </Card>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  return (
    <LiveTabRefresher refreshInterval={30000}>
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
        <Suspense fallback={<LeaderboardTableSkeleton />}>
          <LeaderboardContent searchParams={resolvedParams} />
        </Suspense>

        {/* FAQ Section */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6">Understanding Model Rankings</h2>
            <div className="space-y-4">
              {leaderboardFaqs.map((faq, idx) => (
                <div key={idx} className="border-b border-border/30 pb-4 last:border-0">
                  <h3 className="font-semibold text-sm mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Schema for search engines */}
        <FaqSchema faqs={leaderboardFaqs} />
      </div>
    </LiveTabRefresher>
  );
}
