import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { PredictionTable } from '@/components/prediction-table';
import { MatchEvents } from '@/components/match-events';
import { getMatchWithAnalysis, getMatchById } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { calculateEnhancedScores } from '@/lib/utils/scoring';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { KeyInjury, LikelyScore } from '@/types';
import type { Metadata } from 'next';
import { Collapsible } from '@/components/ui/collapsible';

// Helper to get team abbreviation (3-4 chars)
function getTeamAbbr(teamName: string): string {
  // Common abbreviations
  const abbrevMap: Record<string, string> = {
    'manchester united': 'MUN',
    'manchester city': 'MCI',
    'liverpool': 'LIV',
    'arsenal': 'ARS',
    'chelsea': 'CHE',
    'tottenham': 'TOT',
    'newcastle': 'NEW',
    'west ham': 'WHU',
    'aston villa': 'AVL',
    'brighton': 'BHA',
    'real madrid': 'RMA',
    'barcelona': 'BAR',
    'atletico madrid': 'ATM',
    'atlético madrid': 'ATM',
    'sevilla': 'SEV',
    'bayern munich': 'BAY',
    'bayern münchen': 'BAY',
    'borussia dortmund': 'BVB',
    'dortmund': 'BVB',
    'rb leipzig': 'RBL',
    'juventus': 'JUV',
    'inter milan': 'INT',
    'inter': 'INT',
    'ac milan': 'MIL',
    'milan': 'MIL',
    'napoli': 'NAP',
    'roma': 'ROM',
    'paris saint-germain': 'PSG',
    'paris saint germain': 'PSG',
    'psg': 'PSG',
    'marseille': 'OM',
    'olympique marseille': 'OM',
    'lyon': 'OL',
    'olympique lyonnais': 'OL',
    'ajax': 'AJA',
    'psv': 'PSV',
    'feyenoord': 'FEY',
    'galatasaray': 'GAL',
    'fenerbahce': 'FEN',
    'benfica': 'BEN',
    'porto': 'POR',
    'sporting': 'SCP',
  };
  
  const normalized = teamName.toLowerCase().trim();
  if (abbrevMap[normalized]) return abbrevMap[normalized];
  
  // Default: first 3 letters uppercase
  return teamName.slice(0, 3).toUpperCase();
}

// Helper to find the lowest odds (favorite)
function getLowestOdds(home: string, draw: string, away: string): 'home' | 'draw' | 'away' {
  const h = parseFloat(home);
  const d = parseFloat(draw);
  const a = parseFloat(away);
  if (h <= d && h <= a) return 'home';
  if (a <= d && a <= h) return 'away';
  return 'draw';
}

// Helper to format lineup players into a cleaner list
function formatLineup(lineup: string | null): string[] {
  if (!lineup) return [];
  return lineup.split(',').map(p => p.trim()).filter(Boolean);
}

export const dynamic = 'force-dynamic';

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getMatchById(id);
  
  if (!result) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    };
  }
  
  const { match, competition } = result;
  const kickoff = format(parseISO(match.kickoffTime), 'MMM d, yyyy HH:mm');
  
  return {
    title: `${match.homeTeam} vs ${match.awayTeam} - AI Predictions`,
    description: `AI predictions for ${match.homeTeam} vs ${match.awayTeam} in ${competition.name}. Kickoff: ${kickoff}. See what 30 AI models predict for this match.`,
    openGraph: {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description: `AI predictions for ${competition.name} match`,
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

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition, analysis, predictions } = result;
  const kickoff = parseISO(match.kickoffTime);
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';

  // Parse analysis data
  const keyInjuries = parseJson<KeyInjury[]>(analysis?.keyInjuries ?? null) || [];
  const likelyScores = parseJson<LikelyScore[]>(analysis?.likelyScores ?? null) || [];




  // Fetch match events for finished/live matches
  const matchEvents = (isFinished || isLive) && match.externalId 
    ? await getMatchEvents(parseInt(match.externalId, 10))
    : [];

  const predictionsWithPoints = predictions.map(({ prediction, model }) => {
    // Check if we have enhanced scoring data stored
    const hasEnhancedScoring = prediction.pointsTotal !== null && prediction.pointsTotal !== undefined;
    
    let points = prediction.pointsTotal ?? null;
    let isExact = (prediction.pointsExactScore || 0) > 0;
    let isCorrectResult = (prediction.pointsResult || 0) > 0;

    // If no stored scores, calculate on the fly (for backward compatibility)
    if (!hasEnhancedScoring && isFinished && match.homeScore !== null && match.awayScore !== null) {
      const scoring = calculateEnhancedScores({
        predictedHome: prediction.predictedHomeScore,
        predictedAway: prediction.predictedAwayScore,
        actualHome: match.homeScore,
        actualAway: match.awayScore,
        homeWinPct: analysis?.homeWinPct ?? null,
        awayWinPct: analysis?.awayWinPct ?? null,
      });
      points = scoring.total;
      isExact = scoring.exactScoreBonus > 0;
      isCorrectResult = scoring.tendencyPoints > 0;
    }

    return {
      id: prediction.id,
      modelId: model.id,
      modelDisplayName: model.displayName,
      provider: model.provider,
      predictedHomeScore: prediction.predictedHomeScore,
      predictedAwayScore: prediction.predictedAwayScore,
      confidence: prediction.confidence,
      points,
      isExact,
      isCorrectResult,
      // Enhanced scoring breakdown
      pointsExactScore: prediction.pointsExactScore ?? undefined,
      pointsResult: prediction.pointsResult ?? undefined,
      pointsGoalDiff: prediction.pointsGoalDiff ?? undefined,
      pointsOverUnder: prediction.pointsOverUnder ?? undefined,
      pointsBtts: prediction.pointsBtts ?? undefined,
      pointsUpsetBonus: prediction.pointsUpsetBonus ?? undefined,
      pointsTotal: prediction.pointsTotal ?? undefined,
    };
  });

  const exactCount = predictionsWithPoints.filter(p => p.isExact).length;
  const correctResultCount = predictionsWithPoints.filter(p => p.isCorrectResult && !p.isExact).length;
  const wrongCount = predictionsWithPoints.filter(p => p.points !== null && p.points === 0).length;

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

      {/* Pre-Match Analysis Panel */}
      {analysis && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Pre-Match Analysis
            </h2>
            
            {/* Row 1: Betting Odds + Head-to-Head */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Betting Odds */}
              {analysis.oddsHome && analysis.oddsDraw && analysis.oddsAway && (() => {
                const favorite = getLowestOdds(analysis.oddsHome, analysis.oddsDraw, analysis.oddsAway);
                return (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Betting Odds</h3>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex-1 text-center py-3 px-2 rounded-lg transition-colors",
                        favorite === 'home'
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/50"
                      )}>
                        <p className="text-xl font-bold font-mono">{analysis.oddsHome}</p>
                        <p className="text-xs text-muted-foreground mt-1">Home</p>
                      </div>
                      <div className={cn(
                        "flex-1 text-center py-3 px-2 rounded-lg transition-colors",
                        favorite === 'draw'
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/50"
                      )}>
                        <p className="text-xl font-bold font-mono">{analysis.oddsDraw}</p>
                        <p className="text-xs text-muted-foreground mt-1">Draw</p>
                      </div>
                      <div className={cn(
                        "flex-1 text-center py-3 px-2 rounded-lg transition-colors",
                        favorite === 'away'
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/50"
                      )}>
                        <p className="text-xl font-bold font-mono">{analysis.oddsAway}</p>
                        <p className="text-xs text-muted-foreground mt-1">Away</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Head-to-Head */}
              {analysis.h2hTotal && analysis.h2hTotal > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Head-to-Head ({analysis.h2hTotal} matches)
                  </h3>
                  <div className="space-y-3">
                    {/* Visual bar showing win distribution */}
                    {(() => {
                      const total = analysis.h2hTotal;
                      const homeWins = analysis.h2hHomeWins || 0;
                      const draws = analysis.h2hDraws || 0;
                      const awayWins = analysis.h2hAwayWins || 0;
                      const homePct = Math.round((homeWins / total) * 100);
                      const drawPct = Math.round((draws / total) * 100);
                      const awayPct = Math.round((awayWins / total) * 100);
                      
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-xs font-bold text-primary">{getTeamAbbr(match.homeTeam)}</span>
                            <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-muted/30">
                              {homePct > 0 && (
                                <div 
                                  className="h-full bg-primary flex items-center justify-center"
                                  style={{ width: `${homePct}%` }}
                                >
                                  {homePct >= 15 && <span className="text-[10px] font-bold text-white">{homeWins}</span>}
                                </div>
                              )}
                              {drawPct > 0 && (
                                <div 
                                  className="h-full bg-muted-foreground/40 flex items-center justify-center"
                                  style={{ width: `${drawPct}%` }}
                                >
                                  {drawPct >= 15 && <span className="text-[10px] font-bold">{draws}</span>}
                                </div>
                              )}
                              {awayPct > 0 && (
                                <div 
                                  className="h-full bg-accent flex items-center justify-center"
                                  style={{ width: `${awayPct}%` }}
                                >
                                  {awayPct >= 15 && <span className="text-[10px] font-bold text-white">{awayWins}</span>}
                                </div>
                              )}
                            </div>
                            <span className="w-10 text-xs font-bold text-accent text-right">{getTeamAbbr(match.awayTeam)}</span>
                          </div>
                          
                          {/* Legend */}
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{homeWins} wins</span>
                            <span>{draws} draws</span>
                            <span>{awayWins} wins</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Likely Scores */}
            {likelyScores.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Likely Scores</h3>
                <div className="flex flex-wrap gap-2">
                  {likelyScores.slice(0, 4).map((score, i) => (
                    <span key={i} className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-mono",
                      i === 0 ? "bg-primary/15 border border-primary/30" : "bg-muted/50"
                    )}>
                      {score.score} <span className="text-muted-foreground text-xs">@{score.odds}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible: Lineups */}
            {analysis.lineupsAvailable && analysis.homeStartingXI && analysis.awayStartingXI && (
              <Collapsible
                title={`Confirmed Lineups`}
                icon={<Users className="h-4 w-4" />}
                defaultOpen={false}
                className="mt-4"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{match.homeTeam}</span>
                      {analysis.homeFormation && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 rounded-full text-primary">
                          {analysis.homeFormation}
                        </span>
                      )}
                    </div>
                    {analysis.homeCoach && (
                      <p className="text-xs text-muted-foreground mb-3">Coach: {analysis.homeCoach}</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      {formatLineup(analysis.homeStartingXI).map((player, i) => (
                        <span key={i} className="text-xs text-muted-foreground py-0.5">
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{match.awayTeam}</span>
                      {analysis.awayFormation && (
                        <span className="text-xs px-2 py-0.5 bg-accent/10 rounded-full text-accent">
                          {analysis.awayFormation}
                        </span>
                      )}
                    </div>
                    {analysis.awayCoach && (
                      <p className="text-xs text-muted-foreground mb-3">Coach: {analysis.awayCoach}</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      {formatLineup(analysis.awayStartingXI).map((player, i) => (
                        <span key={i} className="text-xs text-muted-foreground py-0.5">
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Collapsible>
            )}

            {/* Collapsible: Key Absences */}
            {keyInjuries.length > 0 && (
              <Collapsible
                title={`Key Absences (${(analysis.homeInjuriesCount || 0) + (analysis.awayInjuriesCount || 0)})`}
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                defaultOpen={false}
                className="mt-0"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium mb-2">{match.homeTeam} ({analysis.homeInjuriesCount || 0})</p>
                    <div className="space-y-1.5">
                      {keyInjuries
                        .filter(i => i.teamName === match.homeTeam)
                        .slice(0, 5)
                        .map((injury, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{injury.playerName}</span>
                            <span className="text-red-400">- {injury.reason}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">{match.awayTeam} ({analysis.awayInjuriesCount || 0})</p>
                    <div className="space-y-1.5">
                      {keyInjuries
                        .filter(i => i.teamName === match.awayTeam)
                        .slice(0, 5)
                        .map((injury, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{injury.playerName}</span>
                            <span className="text-red-400">- {injury.reason}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prediction Results Summary */}
      {isFinished && predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{exactCount}</p>
            <p className="text-sm text-muted-foreground">Exact Scores</p>
          </div>
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{correctResultCount}</p>
            <p className="text-sm text-muted-foreground">Correct Result</p>
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{wrongCount}</p>
            <p className="text-sm text-muted-foreground">Wrong Result</p>
          </div>
        </div>
      )}

      {/* Predictions Table */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">AI Predictions</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {predictions.length > 0 
              ? `${predictions.length} AI models predicted this match`
              : 'Predictions are generated when lineups are confirmed (~1 hour before kickoff)'}
          </p>
          <PredictionTable
            predictions={predictionsWithPoints}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            isFinished={isFinished}
          />
        </CardContent>
      </Card>
    </div>
  );
}
