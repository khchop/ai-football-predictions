import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { MatchEvents } from '@/components/match-events';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import type { Metadata } from 'next';
import type { LikelyScore } from '@/types';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { buildMatchGraphSchema, sanitizeJsonLd } from '@/lib/seo/schema/graph';
import { mapMatchToSeoData } from '@/lib/seo/types';
import { MatchHeader } from '@/components/match/match-header';
import { MatchOddsPanel } from '@/components/match/match-odds';
import { PredictionsSection } from '@/components/match/predictions-section';
import { PredictionsSkeleton } from '@/components/match/predictions-skeleton';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);
  
  if (!result) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    };
  }
  
  const { match, competition } = result;
  
  // Map match to SEO data format
  const seoData = mapMatchToSeoData(match);
  
  // Use the SEO utility builder for dynamic metadata based on match state
  return buildMatchMetadata(seoData);
}

// Helper to parse JSON safely
function parseJson<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition, analysis } = result;

  // Redirect to new slug-based URL if slugs exist (permanent redirect for SEO)
  if (match.slug && competition.slug) {
    redirect(`/leagues/${competition.slug}/${match.slug}`);
  }

  const kickoff = parseISO(match.kickoffTime);
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  // Parse likely scores
  const likelyScores = parseJson<LikelyScore[]>(analysis?.likelyScores ?? null) || [];

  // Fetch match events for finished/live matches
  const matchEvents = (isFinished || isLive) && match.externalId
    ? await getMatchEvents(parseInt(match.externalId, 10))
    : [];

  // Build JSON-LD structured data for the match
  const jsonLd = buildMatchGraphSchema(mapMatchToSeoData(match));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: sanitizeJsonLd(jsonLd),
        }}
      />
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Match Header - Fast render */}
        <MatchHeader
          match={match}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />

        {/* Match Events (for finished/live matches) - Fast render */}
        {(isFinished || isLive) && matchEvents.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Match Events</h2>
              <MatchEvents
                events={matchEvents}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
              />
            </CardContent>
          </Card>
        )}

        {/* Betting Odds & Predictions Panel - Fast render */}
        <MatchOddsPanel
          analysis={analysis}
          likelyScores={likelyScores}
          isFinished={isFinished}
          isLive={isLive}
        />

        {/* AI Predictions - Streams in with Suspense */}
        <Suspense fallback={<PredictionsSkeleton />}>
          <PredictionsSection
            matchId={id}
            match={match}
            isFinished={isFinished}
          />
        </Suspense>
      </div>
    </>
  );
}
