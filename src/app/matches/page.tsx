import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchCard } from '@/components/match-card';
import { getUpcomingMatches, getFinishedMatches, getRecentMatches, getLiveMatches, getLiveMatchCount } from '@/lib/db/queries';
import { Calendar, Clock, CheckCircle, List, Radio } from 'lucide-react';
import { LiveTabRefresher } from './live-refresher';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Upcoming Football Matches | AI Predictions | kroam.xyz',
  description: 'Browse upcoming and recent football matches with AI predictions from 35 models. Track live scores and pre-match analysis across 17 competitions.',
  alternates: {
    canonical: 'https://kroam.xyz/matches',
  },
  openGraph: {
    title: 'Upcoming Football Matches with AI Predictions',
    description: 'View upcoming matches with predictions from 35 AI models',
    url: 'https://kroam.xyz/matches',
    type: 'website',
    siteName: 'kroam.xyz',
  },
  twitter: {
    card: 'summary',
    title: 'Football Matches & AI Predictions',
    description: 'Browse matches with AI predictions from 35 models',
  },
};

async function LiveMatchesList() {
  const matches = await getLiveMatches();
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Radio className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No live matches right now.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Live scores will appear here when matches kick off.</p>
      </div>
    );
  }
  
  return (
    <LiveTabRefresher>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>{matches.length} match{matches.length !== 1 ? 'es' : ''} in progress</span>
          <span className="text-xs text-muted-foreground/60">• Auto-updates every 30s</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map(({ match, competition }) => (
            <MatchCard
              key={match.id}
              match={{
                ...match,
                status: match.status || 'live',
                competition: {
                  id: competition.id,
                  name: competition.name,
                },
              }}
            />
          ))}
        </div>
      </div>
    </LiveTabRefresher>
  );
}

async function UpcomingMatchesList() {
  const matches = await getUpcomingMatches(168);
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No upcoming matches found.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Check back later for new fixtures.</p>
      </div>
    );
  }
  
  const matchesByDate = matches.reduce((acc, { match, competition }) => {
    const date = match.kickoffTime.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push({ match, competition });
    return acc;
  }, {} as Record<string, typeof matches>);
  
  return (
    <div className="space-y-8">
      {Object.entries(matchesByDate).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
            <span className="text-sm font-normal text-muted-foreground">
              ({dayMatches.length} matches)
            </span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dayMatches.map(({ match, competition }) => (
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
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function FinishedMatchesList() {
  const matches = await getFinishedMatches(50);
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No finished matches yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Results will appear here once matches complete.</p>
      </div>
    );
  }
  
  const matchesByDate = matches.reduce((acc, { match, competition }) => {
    const date = match.kickoffTime.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push({ match, competition });
    return acc;
  }, {} as Record<string, typeof matches>);
  
  return (
    <div className="space-y-8">
      {Object.entries(matchesByDate).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
            <span className="text-sm font-normal text-muted-foreground">
              ({dayMatches.length} matches)
            </span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dayMatches.map(({ match, competition }) => (
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
        </div>
      ))}
    </div>
  );
}

async function AllMatchesList() {
  const matches = await getRecentMatches(100);
  
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <List className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No matches found in the database.</p>
      </div>
    );
  }
  
  const matchesByDate = matches.reduce((acc, { match, competition }) => {
    const date = match.kickoffTime.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push({ match, competition });
    return acc;
  }, {} as Record<string, typeof matches>);
  
  return (
    <div className="space-y-8">
      {Object.entries(matchesByDate).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
            <span className="text-sm font-normal text-muted-foreground">
              ({dayMatches.length} matches)
            </span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dayMatches.map(({ match, competition }) => (
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
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-4">
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function LiveMatchCountBadge() {
  const count = await getLiveMatchCount();
  if (count === 0) return null;
  
  return (
    <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
      {count}
    </span>
  );
}

export default function MatchesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Calendar className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Matches</h1>
          <p className="text-muted-foreground">
            Browse fixtures and results
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live" className="space-y-6">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="live" className="gap-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Live
            <Suspense fallback={null}>
              <LiveMatchCountBadge />
            </Suspense>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2 data-[state=active]:bg-primary/10">
            <Clock className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="finished" className="gap-2 data-[state=active]:bg-primary/10">
            <CheckCircle className="h-4 w-4" />
            Finished
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-primary/10">
            <List className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="live">
          <Suspense fallback={<LoadingSkeleton />}>
            <LiveMatchesList />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="upcoming">
          <Suspense fallback={<LoadingSkeleton />}>
            <UpcomingMatchesList />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="finished">
          <Suspense fallback={<LoadingSkeleton />}>
            <FinishedMatchesList />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="all">
          <Suspense fallback={<LoadingSkeleton />}>
            <AllMatchesList />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
