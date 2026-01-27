import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardTable, type LeaderboardEntry } from '@/components/leaderboard-table';
import { LeaderboardFilters } from '@/components/leaderboard-filters';
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Fetch competition stats from the API
async function fetchCompetitionStats(competitionId: string, filters: Record<string, string>): Promise<{
  success: boolean;
  data?: {
    competitionId: string;
    competitionName: string;
    season: string;
    models: Array<{
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
    totalModels: number;
  };
  error?: string;
}> {
  const cronSecret = process.env.CRON_SECRET || '';
  
  const searchParams = new URLSearchParams(filters);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stats/competition/${competitionId}?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return { success: false, error: 'Competition not found' };
    }
    throw new Error(`Failed to fetch competition stats: ${response.statusText}`);
  }

  return response.json();
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

interface LeaderboardContentProps {
  competitionId: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

async function LeaderboardContent({ competitionId, searchParams }: LeaderboardContentProps) {
  // Parse filter parameters
  const season = typeof searchParams.season === 'string' ? searchParams.season : undefined;
  const model = typeof searchParams.model === 'string' ? searchParams.model : undefined;
  const limit = 50; // Default limit

  const filters: Record<string, string> = {};
  if (season) filters.season = season;
  if (model) filters.model = model;
  if (limit) filters.limit = String(limit);

  const result = await fetchCompetitionStats(competitionId, filters);

  if (!result.success) {
    if (result.error === 'Competition not found') {
      return (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Competition not found.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            The requested competition does not exist or has no data.
          </p>
        </div>
      );
    }
    throw new Error(result.error || 'Failed to load competition stats');
  }

  const { data } = result;

  if (!data || data.models.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No prediction data available for this competition.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Models will start appearing once they make predictions in this competition.
        </p>
      </div>
    );
  }

  // Format data for LeaderboardTable
  const formattedLeaderboard: LeaderboardEntry[] = data.models.map((model) => ({
    modelId: model.modelId,
    displayName: model.displayName,
    provider: model.provider,
    totalPredictions: model.totalPredictions,
    totalPoints: model.totalPoints,
    averagePoints: model.avgPoints,
    exactScores: model.exactScores,
    correctTendencies: model.correctTendencies,
  }));

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <LeaderboardTable entries={formattedLeaderboard} />
      </CardContent>
    </Card>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: competitionId } = await params;
  
  // Try to get competition name from API
  const cronSecret = process.env.CRON_SECRET || '';
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stats/competition/${competitionId}`,
      {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
        next: { revalidate: 3600 },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.competitionName) {
        return {
          title: `${data.data.competitionName} Leaderboard | kroam`,
          description: `AI model performance rankings for ${data.data.competitionName} predictions`,
        };
      }
    }
  } catch {
    // Ignore errors, use fallback
  }

  return {
    title: 'Competition Leaderboard | kroam',
    description: 'AI model performance rankings for football predictions',
  };
}

export default async function CompetitionLeaderboardPage({ params, searchParams }: PageProps) {
  const { id: competitionId } = await params;
  const resolvedParams = await searchParams;

  // Get competition name for page title
  let competitionName: string | null = null;
  try {
    const cronSecret = process.env.CRON_SECRET || '';
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stats/competition/${competitionId}`,
      {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
        next: { revalidate: 60 },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      competitionName = data.data?.competitionName || null;
    }
  } catch {
    // Ignore errors, will show fallback
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{competitionName || 'Competition'} Leaderboard</h1>
          <p className="text-muted-foreground">
            AI model performance for {competitionName || 'this competition'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <LeaderboardFilters disabledFilters={['competition']} />
      </Suspense>

      {/* Leaderboard Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <LeaderboardContent competitionId={competitionId} searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
