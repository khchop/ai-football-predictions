import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchCard } from '@/components/match-card';
import { getUpcomingMatches, getFinishedMatches, getRecentMatches } from '@/lib/db/queries';
import { Calendar, Clock, CheckCircle, List } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="bg-card/50 border border-border/50">
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
