import { notFound, permanentRedirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { MatchEvents } from '@/components/match-events';
import { MatchContentSection } from '@/components/match/MatchContent';
import { getMatchBySlug, getMatchWithAnalysis, getPredictionsForMatchWithDetails, getNextMatchesForTeams, getMatchRoundup, getActiveModels } from '@/lib/db/queries';
import { RelatedMatchesWidget } from '@/components/match/related-matches-widget';
import { getMatchEvents } from '@/lib/football/api-football';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';
import { ArrowLeft, Trophy, Target, ChevronRight, Compass } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PredictionTable } from '@/components/prediction-table';
import { MatchPageSchema } from '@/components/MatchPageSchema';
import { MatchStats, type RoundupStats } from '@/components/match/MatchStats';
import { TopPerformers } from '@/components/match/top-performers';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { mapMatchToSeoData } from '@/lib/seo/types';
import { MatchH1 } from '@/components/match/match-h1';
import { MatchPageHeader } from '@/components/match/match-page-header';
import { MatchTLDR } from '@/components/match/match-tldr';
import { MatchFAQ } from '@/components/match/match-faq';
import { generateMatchFAQs } from '@/components/match/MatchFAQSchema';
import { getMatchFAQContent } from '@/lib/content/match-content';
import { BreadcrumbsWithSchema } from '@/components/navigation/breadcrumbs';
import { buildMatchBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';
import { MatchDataProvider } from '@/components/match/match-data-provider';


interface MatchPageProps {
  params: Promise<{ 
    slug: string;
    match: string;
  }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { slug, match } = await params;

  // Check if slug is an alias and get competition config
  const competitionConfig = getCompetitionByIdOrAlias(slug);

  // Use competition ID for database query if alias was used
  const competitionSlug = competitionConfig?.id || slug;
  const result = await getMatchBySlug(competitionSlug, match);

  if (!result) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    };
  }

  const { match: matchData, competition } = result;

  // Get analysis for predicted scores (with graceful degradation)
  const analysisData = await getMatchWithAnalysis(matchData.id).catch(() => null);
  const analysis = analysisData?.analysis;

  // Map to SEO data
  const seoData = mapMatchToSeoData(matchData);

  // Extract predicted scores from analysis if available
  if (analysis?.likelyScores) {
    try {
      const likelyScores = JSON.parse(analysis.likelyScores);
      if (likelyScores[0]) {
        const [homeScore, awayScore] = likelyScores[0].score.split('-').map(Number);
        seoData.predictedHomeScore = homeScore;
        seoData.predictedAwayScore = awayScore;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Use centralized metadata builder
  return buildMatchMetadata(seoData);
}

function renderPredictionAnalysis(predictions: Array<{ predictedHome: number | null; predictedAway: number | null }>) {
  const homeAvg = predictions.reduce((sum, p) => sum + (p.predictedHome ?? 0), 0) / predictions.length;
  const awayAvg = predictions.reduce((sum, p) => sum + (p.predictedAway ?? 0), 0) / predictions.length;
  
  return { homeAvg, awayAvg };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, match } = await params;

  // Check if slug is an alias and get competition config
  const competitionConfig = getCompetitionByIdOrAlias(slug);

  // Redirect to canonical URL if slug is an alias
  if (competitionConfig && slug !== competitionConfig.id) {
    permanentRedirect(`/leagues/${competitionConfig.id}/${match}`);
  }

  // Use competition ID for database query (either canonical or original slug)
  const competitionSlug = competitionConfig?.id || slug;

  // Stage 1: Critical path - match data (needed for conditionals and existence check)
  let result;
  try {
    result = await getMatchBySlug(competitionSlug, match);
  } catch (error) {
    console.error('Match page database error:', error);
    notFound(); // Graceful degradation to 404 instead of 500
  }

  if (!result) {
    notFound();
  }

  const { match: matchData, competition } = result;
  const isFinished = matchData.status === 'finished';
  const isLive = matchData.status === 'live';

  // Stage 2: Parallel fetch all remaining data (eliminates waterfall)
  const [
    analysisData,
    predictions,
    matchEvents,
    nextMatches,
    roundup,
    activeModels
  ] = await Promise.all([
    getMatchWithAnalysis(matchData.id).catch(err => {
      console.error('Failed to fetch analysis:', err);
      return null;
    }),
    getPredictionsForMatchWithDetails(matchData.id).catch(err => {
      console.error('Failed to fetch predictions:', err);
      return [] as Awaited<ReturnType<typeof getPredictionsForMatchWithDetails>>;
    }),
    (isFinished || isLive) && matchData.externalId
      ? getMatchEvents(parseInt(matchData.externalId, 10)).catch(err => {
          console.error('Failed to fetch match events:', err);
          return [] as Awaited<ReturnType<typeof getMatchEvents>>;
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getMatchEvents>>),
    getNextMatchesForTeams([matchData.homeTeam, matchData.awayTeam], 4).catch(err => {
      console.error('Failed to fetch next matches:', err);
      return [] as Awaited<ReturnType<typeof getNextMatchesForTeams>>;
    }),
    isFinished
      ? getMatchRoundup(matchData.id).catch(err => {
          console.error('Failed to fetch match roundup:', err);
          return null;
        })
      : Promise.resolve(null),
    getActiveModels().catch(err => {
      console.error('Failed to fetch active models:', err);
      return [] as Awaited<ReturnType<typeof getActiveModels>>;
    })
  ]);

  const analysis = analysisData?.analysis ?? null;
  const kickoff = parseISO(matchData.kickoffTime);

  // Build breadcrumbs
  const matchTitle = `${matchData.homeTeam} vs ${matchData.awayTeam}`;
  const breadcrumbs = buildMatchBreadcrumbs(
    competition.name,
    competitionSlug,
    matchTitle,
    matchData.slug || ''
  );

  // Fetch AI-generated FAQs if available, fall back to template-based
  const aiFaqs = await getMatchFAQContent(matchData.id);
  const faqs = aiFaqs && aiFaqs.length > 0 ? aiFaqs : generateMatchFAQs(matchData, competition);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MatchPageSchema
        match={matchData}
        competition={{ name: competition.name, slug: competitionSlug }}
        url={`https://kroam.xyz/leagues/${competitionSlug}/${matchData.slug}`}
        faqs={faqs}
      />
      <BreadcrumbsWithSchema items={breadcrumbs} />

      <MatchDataProvider
        match={matchData}
        competition={competition}
        analysis={analysis}
      >
        <MatchH1
          homeTeam={matchData.homeTeam}
          awayTeam={matchData.awayTeam}
          status={matchData.status}
          homeScore={matchData.homeScore}
          awayScore={matchData.awayScore}
        />
        <Link
          href={`/leagues/${competitionSlug}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to league
        </Link>

        {/* TL;DR Summary - State-aware summary at top (MTCH-02) */}
        <MatchTLDR match={matchData} competition={competition} />

        {/* Hero + Sticky Header - Score appears here only (MTCH-01) */}
        <MatchPageHeader
          match={matchData}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />

        {/* Unified Layout - Single column for all devices */}
        <div className="space-y-8">

        {(isFinished || isLive) && matchEvents.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Match Events</h2>
              <MatchEvents
                events={matchEvents}
                homeTeam={matchData.homeTeam}
                awayTeam={matchData.awayTeam}
              />
            </CardContent>
          </Card>
        )}

        <MatchStats
          analysis={analysis || null}
          homeTeam={matchData.homeTeam}
          awayTeam={matchData.awayTeam}
          roundupStats={roundup?.stats ? JSON.parse(roundup.stats) as RoundupStats : null}
          isFinished={isFinished}
        />

        <MatchContentSection
          matchId={matchData.id}
          matchStatus={matchData.status}
          teams={[matchData.homeTeam, matchData.awayTeam]}
          models={activeModels.map(m => ({ id: m.id, displayName: m.displayName }))}
        />

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              AI Model Predictions
            </h2>

            <PredictionTable
              predictions={predictions.map(p => ({
                id: p.predictionId,
                modelId: p.modelId,
                modelDisplayName: p.modelDisplayName,
                provider: p.provider,
                predictedHomeScore: p.predictedHome,
                predictedAwayScore: p.predictedAway,
                points: p.totalPoints,
                isExact: p.exactScoreBonus !== null && p.exactScoreBonus > 0,
                isCorrectResult: p.tendencyPoints !== null && p.tendencyPoints > 0,
              }))}
              homeTeam={matchData.homeTeam}
              awayTeam={matchData.awayTeam}
              isFinished={isFinished}
            />

            {predictions.length > 0 && (() => {
              const { homeAvg, awayAvg } = renderPredictionAnalysis(predictions);
              return (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <p className="text-sm text-muted-foreground">Avg Predicted</p>
                    <p className="text-lg font-bold">{homeAvg.toFixed(1)} - {awayAvg.toFixed(1)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <p className="text-sm text-muted-foreground">Models</p>
                    <p className="text-lg font-bold">{predictions.length}</p>
                  </div>
                </div>
              );
            })()}

            {isFinished && roundup?.topPerformers && (
              <div className="pt-4 border-t border-border/50">
                <TopPerformers
                  topPerformers={JSON.parse(roundup.topPerformers)}
                  compact
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Explore More
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Competition link */}
              <Link
                href={`/leagues/${competitionSlug}`}
                className="group flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">All {competition.name}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>

              {/* Next fixtures for these teams */}
              {nextMatches.filter(m => m.match.id !== matchData.id).slice(0, 2).map((m) => {
                const matchCompConfig = m.competition.slug ? getCompetitionByIdOrAlias(m.competition.slug) : null;
                const matchCompSlug = matchCompConfig?.id || m.competition.slug || m.competition.id;
                return (
                  <Link
                    key={m.match.id}
                    href={`/leagues/${matchCompSlug}/${m.match.slug}`}
                    className="group flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.match.homeTeam} vs {m.match.awayTeam}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(m.match.kickoffTime), 'MMM d, HH:mm')}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Related Matches - SEO Internal Linking */}
        <RelatedMatchesWidget matchId={matchData.id} competitionSlug={competitionSlug} />

        {/* FAQ Section - SEO enhancement with JSON-LD schema (MTCH-06) */}
        <MatchFAQ match={matchData} competition={competition} aiFaqs={aiFaqs} />
        </div>
      </MatchDataProvider>
    </div>
  );
}
