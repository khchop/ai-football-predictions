import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchCard } from '@/components/match-card';
import { getUpcomingMatches, getFinishedMatches, getOverallStats, getLiveMatches } from '@/lib/db/queries';
import { Trophy, Calendar, Bot, Target, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function StatsBar() {
  const stats = await getOverallStats();
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.totalMatches}</p>
          <p className="text-xs text-muted-foreground">Matches</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.totalPredictions}</p>
          <p className="text-xs text-muted-foreground">Predictions</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.activeModels}</p>
          <p className="text-xs text-muted-foreground">AI Models</p>
        </div>
      </div>
      
      <Link 
        href="/leaderboard" 
        className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">Leaderboard</p>
          <p className="text-xs text-muted-foreground">View rankings</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform flex-shrink-0" />
      </Link>
    </div>
  );
}

async function LiveMatches() {
  const matches = await getLiveMatches();
  
  // Don't render anything if no live matches
  if (matches.length === 0) {
    return null;
  }
  
  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-red-400">Live Matches</h2>
            <p className="text-sm text-muted-foreground">{matches.length} match{matches.length !== 1 ? 'es' : ''} in progress</p>
          </div>
        </div>
        <Link 
          href="/matches" 
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map(({ match, competition }) => (
          <MatchCard
            key={match.id}
            match={{
              ...match,
              status: 'live',
              competition: {
                id: competition.id,
                name: competition.name,
              },
            }}
          />
        ))}
      </div>
    </section>
  );
}

async function UpcomingMatches() {
  const matches = await getUpcomingMatches(48);
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-8 sm:p-12 text-center">
        <Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No upcoming matches in the next 48 hours.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Check back later!</p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {matches.slice(0, 9).map(({ match, competition }) => {
        return (
          <MatchCard
            key={match.id}
            match={{
              ...match,
              status: match.status || 'scheduled',
              competition: {
                id: competition.id,
                name: competition.name,
              },
            }}
            showPredictions={false}
            predictions={[]}
          />
        );
      })}
    </div>
  );
}

async function RecentResults() {
  const matches = await getFinishedMatches(6);
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-8 sm:p-12 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No finished matches yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Results will appear once matches complete.</p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map(({ match, competition }) => (
        <MatchCard
          key={match.id}
          match={{
            ...match,
            status: match.status || 'finished',
            competition: {
              id: competition.id,
              name: competition.name,
            },
          }}
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/30">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
            </div>
            <Skeleton className="h-3 w-24 mx-auto mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-6 sm:py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          <Sparkles className="h-4 w-4" />
          <span>AI-Powered Predictions</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
          <span className="gradient-text">AI Football</span> Predictions
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-4">
          Watch AI models compete to predict football scores. 
          Champions League, Premier League, and more.
        </p>
      </section>

      {/* Stats */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <StatsBar />
      </Suspense>

      {/* Live Matches - only shows when there are live matches */}
      <Suspense fallback={null}>
        <LiveMatches />
      </Suspense>

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Upcoming Matches</h2>
            <p className="text-sm text-muted-foreground">Next 48 hours</p>
          </div>
          <Link 
            href="/matches" 
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Suspense fallback={<LoadingSkeleton />}>
          <UpcomingMatches />
        </Suspense>
      </section>

      {/* Recent Results */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Recent Results</h2>
            <p className="text-sm text-muted-foreground">Latest completed matches</p>
          </div>
          <Link 
            href="/matches?tab=finished" 
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Suspense fallback={<LoadingSkeleton />}>
          <RecentResults />
        </Suspense>
      </section>
    </div>
  );
}
