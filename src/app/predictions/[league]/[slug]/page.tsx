import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { MatchEvents } from '@/components/match-events';
import { MatchContentSection } from '@/components/match/MatchContent';
import { getMatchBySlug, getMatchWithAnalysis, getPredictionsForMatchWithDetails } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, Target } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LikelyScore } from '@/types';
import type { Metadata } from 'next';
import { PredictionTable } from '@/components/prediction-table';

// Helper to find the lowest odds (favorite)
function getLowestOdds(home: string, draw: string, away: string): 'home' | 'draw' | 'away' {
  const h = parseFloat(home);
  const d = parseFloat(draw);
  const a = parseFloat(away);
  if (h <= d && h <= a) return 'home';
  if (a <= d && a <= h) return 'away';
  return 'draw';
}

export const dynamic = 'force-dynamic';

interface MatchPageProps {
  params: Promise<{ 
    league: string;
    slug: string;
  }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { league, slug } = await params;
  const result = await getMatchBySlug(league, slug);
  
  if (!result) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    };
  }
  
  const { match, competition } = result;
  const kickoff = format(parseISO(match.kickoffTime), 'MMM d, yyyy HH:mm');
  
  return {
    title: `${match.homeTeam} vs ${match.awayTeam} - AI Score Predictions`,
    description: `AI score predictions for ${match.homeTeam} vs ${match.awayTeam} in ${competition.name}. Kickoff: ${kickoff}. See model predictions and Kicktipp scoring.`,
    openGraph: {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description: `AI score predictions for ${competition.name} match`,
      type: 'website',
    },
  };
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

export default async function PredictionPage({ params }: MatchPageProps) {
  const { league, slug } = await params;
  const result = await getMatchBySlug(league, slug);

  if (!result) {
    notFound();
  }

  const { match, competition } = result;
  
  // Get full analysis data using match ID
  const analysisData = await getMatchWithAnalysis(match.id);
  const analysis = analysisData?.analysis;
  
  // Fetch predictions for this match
  const predictions = await getPredictionsForMatchWithDetails(match.id);
  const kickoff = parseISO(match.kickoffTime);
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  // Parse likely scores
  const likelyScores = parseJson<LikelyScore[]>(analysis?.likelyScores ?? null) || [];

  // Fetch match events for finished/live matches
  const matchEvents = (isFinished || isLive) && match.externalId 
    ? await getMatchEvents(parseInt(match.externalId, 10))
    : [];

  // Check if we have any analysis data
  const hasAnalysis = analysis && (
    analysis.oddsHome || analysis.homeWinPct || analysis.advice
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Link */}
      <Link 
        href="/matches" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to matches
      </Link>

      {/* Match Header Card */}
      <Card className={cn(
        "bg-card/50 border-border/50 overflow-hidden",
        isLive && "border-red-500/50"
      )}>
        {isLive && (
          <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" />
        )}
        
        <CardContent className="p-6 md:p-8">
          {/* Competition & Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{competition.name}</span>
              {match.round && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-sm text-muted-foreground">{match.round}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFinished && match.isUpset && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-500/20 text-orange-400">
                  UPSET
                </span>
              )}
              <span className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold",
                isLive && "status-live text-white",
                match.status === 'scheduled' && "status-upcoming text-white",
                isFinished && "status-finished text-muted-foreground"
              )}>
                {isLive ? 'LIVE' : isFinished ? 'Full Time' : 'Upcoming'}
              </span>
            </div>
          </div>

          {/* Teams & Score */}
          <div className="flex items-center justify-between gap-4 md:gap-8">
            {/* Home Team */}
            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {match.homeTeamLogo ? (
                  <Image
                    src={match.homeTeamLogo}
                    alt={match.homeTeam}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {match.homeTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && match.homeScore !== null && match.awayScore !== null &&
                match.homeScore > match.awayScore && "text-green-400"
              )}>
                {match.homeTeam}
              </p>
              <p className="text-sm text-muted-foreground">Home</p>
            </div>

            {/* Score */}
            <div className="text-center px-4 md:px-8">
              {isFinished || isLive ? (
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && "text-green-400"
                  )}>
                    {match.homeScore}
                  </span>
                  <span className="text-3xl text-muted-foreground">-</span>
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && "text-green-400"
                  )}>
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <p className="text-4xl md:text-5xl font-bold gradient-text">VS</p>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {match.awayTeamLogo ? (
                  <Image
                    src={match.awayTeamLogo}
                    alt={match.awayTeam}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {match.awayTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && match.homeScore !== null && match.awayScore !== null &&
                match.awayScore > match.homeScore && "text-green-400"
              )}>
                {match.awayTeam}
              </p>
              <p className="text-sm text-muted-foreground">Away</p>
            </div>
          </div>

          {/* Match Info */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-border/50 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(kickoff, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {format(kickoff, 'HH:mm')}
            </div>
            {match.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {match.venue}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Events (for finished/live matches) */}
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

       {/* Match Content Section */}
       <MatchContentSection matchId={match.id} />

      {/* AI Model Predictions */}
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
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            isFinished={isFinished}
          />
        </CardContent>
      </Card>
    </div>
  );
}
