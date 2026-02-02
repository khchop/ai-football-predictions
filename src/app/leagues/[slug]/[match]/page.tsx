import { notFound, permanentRedirect } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { MatchEvents } from '@/components/match-events';
import { MatchContentSection } from '@/components/match/MatchContent';
import { MatchFAQSchema } from '@/components/match/MatchFAQSchema';
import { PredictionInsightsBlockquote } from '@/components/match/PredictionInsightsBlockquote';
import { getMatchBySlug, getMatchWithAnalysis, getPredictionsForMatchWithDetails, getStandingsForTeams, getNextMatchesForTeams, getMatchRoundup } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, Target, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { PredictionTable } from '@/components/prediction-table';
import { SportsEventSchema } from '@/components/SportsEventSchema';
import { MatchStats } from '@/components/match/MatchStats';
import { WebPageSchema } from '@/components/WebPageSchema';
import { RoundupViewer } from '@/components/match/roundup-viewer';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { mapMatchToSeoData } from '@/lib/seo/types';

export const dynamic = 'force-dynamic';

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

  // Get analysis for predicted scores
  const analysisData = await getMatchWithAnalysis(matchData.id);
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

  // Defensive error handling to prevent 500 errors from database issues
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

  // Additional defensive error handling for related queries
  let analysisData, predictions;
  try {
    analysisData = await getMatchWithAnalysis(matchData.id);
    predictions = await getPredictionsForMatchWithDetails(matchData.id);
  } catch (error) {
    console.error('Match page data loading error:', error);
    // Continue with null data rather than failing completely
    analysisData = null;
    predictions = [];
  }

  const analysis = analysisData?.analysis;
  const kickoff = parseISO(matchData.kickoffTime);
  const isFinished = matchData.status === 'finished';
  const isLive = matchData.status === 'live';

  // Defensive error handling for external API and supplementary data
  let matchEvents = [];
  let teamStandings = [];
  let nextMatches = [];
  let roundup = null;

  try {
    matchEvents = (isFinished || isLive) && matchData.externalId
      ? await getMatchEvents(parseInt(matchData.externalId, 10))
      : [];
  } catch (error) {
    console.error('Failed to fetch match events:', error);
  }

  try {
    teamStandings = await getStandingsForTeams(competition.apiFootballId, [matchData.homeTeam, matchData.awayTeam], competition.season);
  } catch (error) {
    console.error('Failed to fetch team standings:', error);
  }

  const homeStanding = teamStandings.find(s => s.teamName === matchData.homeTeam) || null;
  const awayStanding = teamStandings.find(s => s.teamName === matchData.awayTeam) || null;

  try {
    nextMatches = await getNextMatchesForTeams([matchData.homeTeam, matchData.awayTeam], 4);
  } catch (error) {
    console.error('Failed to fetch next matches:', error);
  }

  // Fetch roundup data (only for finished matches)
  try {
    roundup = isFinished ? await getMatchRoundup(matchData.id) : null;
  } catch (error) {
    console.error('Failed to fetch match roundup:', error);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <SportsEventSchema match={matchData} />
      <WebPageSchema
        name={`${matchData.homeTeam} vs ${matchData.awayTeam} Prediction`}
        description={`AI predictions for ${matchData.homeTeam} vs ${matchData.awayTeam} (${competition.name}). Compare forecasts from 35+ AI models.`}
        url={`https://kroam.xyz/leagues/${competitionSlug}/${matchData.slug}`}
        breadcrumb={[
          { name: 'Home', url: 'https://kroam.xyz' },
          { name: 'Leagues', url: 'https://kroam.xyz/leagues' },
          { name: competition.name, url: `https://kroam.xyz/leagues/${competitionSlug}` },
          { name: `${matchData.homeTeam} vs ${matchData.awayTeam}`, url: `https://kroam.xyz/leagues/${competitionSlug}/${matchData.slug}` },
        ]}
      />
      <Link
        href={`/leagues/${competitionSlug}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to league
      </Link>

      <Card className={cn(
        "bg-card/50 border-border/50 overflow-hidden",
        isLive && "border-red-500/50"
      )}>
        {isLive && (
          <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" />
        )}
        
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{competition.name}</span>
              {matchData.round && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-sm text-muted-foreground">{matchData.round}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFinished && matchData.isUpset && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-500/20 text-orange-400">
                  UPSET
                </span>
              )}
              <span className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold",
                isLive && "status-live text-white",
                matchData.status === 'scheduled' && "status-upcoming text-white",
                isFinished && "status-finished text-muted-foreground"
              )}>
                {isLive ? 'LIVE' : isFinished ? 'Full Time' : 'Upcoming'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 md:gap-8">
            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {matchData.homeTeamLogo ? (
                  <Image
                    src={matchData.homeTeamLogo}
                    alt={`${matchData.homeTeam} team logo`}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {matchData.homeTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && matchData.homeScore !== null && matchData.awayScore !== null &&
                matchData.homeScore > matchData.awayScore && "text-green-400"
              )}>
                {matchData.homeTeam}
              </p>
              <p className="text-sm text-muted-foreground">Home</p>
            </div>

            <div className="text-center px-4 md:px-8">
              {isFinished || isLive ? (
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && matchData.homeScore !== null && matchData.awayScore !== null &&
                    matchData.homeScore > matchData.awayScore && "text-green-400"
                  )}>
                    {matchData.homeScore}
                  </span>
                  <span className="text-3xl text-muted-foreground">-</span>
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && matchData.homeScore !== null && matchData.awayScore !== null &&
                    matchData.awayScore > matchData.homeScore && "text-green-400"
                  )}>
                    {matchData.awayScore}
                  </span>
                </div>
              ) : (
                <p className="text-4xl md:text-5xl font-bold gradient-text">VS</p>
              )}
            </div>

            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {matchData.awayTeamLogo ? (
                  <Image
                    src={matchData.awayTeamLogo}
                    alt={`${matchData.awayTeam} team logo`}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {matchData.awayTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && matchData.homeScore !== null && matchData.awayScore !== null &&
                matchData.awayScore > matchData.homeScore && "text-green-400"
              )}>
                {matchData.awayTeam}
              </p>
              <p className="text-sm text-muted-foreground">Away</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-border/50 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(kickoff, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {format(kickoff, 'HH:mm')}
            </div>
            {matchData.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {matchData.venue}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
        homeStanding={homeStanding}
        awayStanding={awayStanding}
        homeTeam={matchData.homeTeam}
        awayTeam={matchData.awayTeam}
      />
      
      <MatchContentSection matchId={matchData.id} />
      
      {/* Match Roundup (for finished matches with roundup available) */}
      {roundup && (
        <section>
          <h2 className="text-2xl font-bold mb-6">Match Roundup</h2>
          <RoundupViewer
            title={roundup.title}
            scoreboard={JSON.parse(roundup.scoreboard)}
            events={roundup.events ? JSON.parse(roundup.events) : []}
            stats={JSON.parse(roundup.stats)}
            modelPredictions={roundup.modelPredictions}
            topPerformers={JSON.parse(roundup.topPerformers)}
            narrative={roundup.narrative}
            keywords={roundup.keywords ? roundup.keywords.split(',').map(k => k.trim()) : []}
          />
        </section>
      )}
      
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
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
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">AI Analysis & Insights</h2>
          </div>
          
          {predictions.length > 0 && (() => {
            const { homeAvg, awayAvg } = renderPredictionAnalysis(predictions);
            
            return (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Based on {predictions.length} AI model predictions for this match:
                </p>
                
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm text-muted-foreground">Avg Predicted Score</p>
                    <p className="text-lg font-bold">
                      {homeAvg.toFixed(1)}
                      {' - '}
                      {awayAvg.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm text-muted-foreground">Prediction Count</p>
                    <p className="text-lg font-bold">{predictions.length} models</p>
                  </div>
                </div>

                <PredictionInsightsBlockquote 
                  predictions={predictions} 
                  homeAvg={homeAvg} 
                  awayAvg={awayAvg} 
                />
              </div>
            );
          })()}

          <MatchFAQSchema 
            match={matchData}
            competition={competition}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Explore {competition.name}</h3>
            <Link
              href={`/leagues/${competitionSlug}`}
              className="group flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-primary" />
                <span>View all {competition.name} matches</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Upcoming Fixtures</h3>
            <div className="space-y-3">
              {nextMatches.filter(m => m.match.id !== matchData.id).slice(0, 2).map((m) => {
                // Get canonical competition ID for link
                const matchCompConfig = m.competition.slug ? getCompetitionByIdOrAlias(m.competition.slug) : null;
                const matchCompSlug = matchCompConfig?.id || m.competition.slug || m.competition.id;
                return (
                  <Link
                    key={m.match.id}
                    href={`/leagues/${matchCompSlug}/${m.match.slug}`}
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                  >
                    <span className="truncate">{m.match.homeTeam} vs {m.match.awayTeam}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  </Link>
                );
              })}
              {nextMatches.length <= 1 && (
                <p className="text-sm text-muted-foreground italic">No other upcoming matches found for these teams.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">More {competition.name} Matches</h3>
            <div className="space-y-3">
              {nextMatches.slice(0, 3).map((m) => {
                // Get canonical competition ID for link
                const matchCompConfig = m.competition.slug ? getCompetitionByIdOrAlias(m.competition.slug) : null;
                const matchCompSlug = matchCompConfig?.id || m.competition.slug || m.competition.id;
                return (
                  <Link
                    key={m.match.id}
                    href={`/leagues/${matchCompSlug}/${m.match.slug}`}
                    className="group flex items-start justify-between p-3 rounded-lg bg-muted/20 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.match.homeTeam} vs {m.match.awayTeam}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(m.match.kickoffTime), 'MMM d, HH:mm')}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-1" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Popular Models</h3>
            <div className="space-y-3">
              {predictions.slice(0, 3).map((p) => (
                <Link 
                  key={p.modelId}
                  href={`/models/${p.modelId}`}
                  className="group flex items-start justify-between p-3 rounded-lg bg-muted/20 hover:bg-primary/10 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.modelDisplayName}</p>
                    <p className="text-xs text-muted-foreground">Provider: {p.provider}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-1" />
                </Link>
              ))}
              {predictions.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No model predictions available yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
