import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { PredictionTable } from '@/components/prediction-table';
import { MatchEvents } from '@/components/match-events';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { calculateEnhancedScores } from '@/lib/utils/scoring';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { KeyInjury, LikelyScore } from '@/types';

export const dynamic = 'force-dynamic';

interface MatchPageProps {
  params: Promise<{ id: string }>;
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
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Pre-Match Analysis
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Odds & Prediction */}
              <div className="space-y-4">
                {/* Betting Odds */}
                {analysis.oddsHome && analysis.oddsDraw && analysis.oddsAway && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Betting Odds</h3>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex-1 text-center p-2 rounded-lg",
                        analysis.homeWinPct && analysis.awayWinPct && analysis.homeWinPct > analysis.awayWinPct
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/50"
                      )}>
                        <p className="text-lg font-bold font-mono">{analysis.oddsHome}</p>
                        <p className="text-xs text-muted-foreground">Home</p>
                      </div>
                      <div className="flex-1 text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold font-mono">{analysis.oddsDraw}</p>
                        <p className="text-xs text-muted-foreground">Draw</p>
                      </div>
                      <div className={cn(
                        "flex-1 text-center p-2 rounded-lg",
                        analysis.homeWinPct && analysis.awayWinPct && analysis.awayWinPct > analysis.homeWinPct
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/50"
                      )}>
                        <p className="text-lg font-bold font-mono">{analysis.oddsAway}</p>
                        <p className="text-xs text-muted-foreground">Away</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Win Percentages */}
                {analysis.homeWinPct && analysis.awayWinPct && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Win Probability</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono w-10">{analysis.homeWinPct}%</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${analysis.homeWinPct}%` }}
                        />
                        <div 
                          className="h-full bg-muted-foreground/30 transition-all"
                          style={{ width: `${analysis.drawPct || 0}%` }}
                        />
                        <div 
                          className="h-full bg-accent transition-all"
                          style={{ width: `${analysis.awayWinPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono w-10 text-right">{analysis.awayWinPct}%</span>
                    </div>
                    {analysis.advice && (
                      <p className="text-xs text-muted-foreground mt-2 italic">&quot;{analysis.advice}&quot;</p>
                    )}
                  </div>
                )}

                {/* Likely Scores */}
                {likelyScores.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Likely Scores</h3>
                    <div className="flex flex-wrap gap-2">
                      {likelyScores.slice(0, 4).map((score, i) => (
                        <span key={i} className="px-2 py-1 bg-muted/50 rounded text-sm font-mono">
                          {score.score} <span className="text-muted-foreground">({score.odds})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Team Form & Comparison */}
              <div className="space-y-4">
                {/* Team Comparison */}
                {analysis.formHomePct && analysis.formAwayPct && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Team Comparison</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-16">Form</span>
                        <span className="w-8 text-right">{analysis.formHomePct}%</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-primary" style={{ width: `${analysis.formHomePct}%` }} />
                        </div>
                        <span className="w-8">{analysis.formAwayPct}%</span>
                      </div>
                      {analysis.attackHomePct && analysis.attackAwayPct && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-16">Attack</span>
                          <span className="w-8 text-right">{analysis.attackHomePct}%</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-green-500" style={{ width: `${analysis.attackHomePct}%` }} />
                          </div>
                          <span className="w-8">{analysis.attackAwayPct}%</span>
                        </div>
                      )}
                      {analysis.defenseHomePct && analysis.defenseAwayPct && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-16">Defense</span>
                          <span className="w-8 text-right">{analysis.defenseHomePct}%</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-blue-500" style={{ width: `${analysis.defenseHomePct}%` }} />
                          </div>
                          <span className="w-8">{analysis.defenseAwayPct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Form */}
                {(analysis.homeTeamForm || analysis.awayTeamForm) && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent Form</h3>
                    <div className="space-y-1">
                      {analysis.homeTeamForm && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 truncate">{match.homeTeam}</span>
                          <div className="flex gap-1">
                            {analysis.homeTeamForm.split('').map((r, i) => (
                              <span key={i} className={cn(
                                "w-5 h-5 rounded text-xs flex items-center justify-center font-bold",
                                r === 'W' && "bg-green-500/20 text-green-400",
                                r === 'D' && "bg-yellow-500/20 text-yellow-400",
                                r === 'L' && "bg-red-500/20 text-red-400"
                              )}>
                                {r}
                              </span>
                            ))}
                          </div>
                          {analysis.homeGoalsScored !== null && analysis.homeGoalsConceded !== null && (
                            <span className="text-xs text-muted-foreground">
                              ({analysis.homeGoalsScored}:{analysis.homeGoalsConceded})
                            </span>
                          )}
                        </div>
                      )}
                      {analysis.awayTeamForm && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 truncate">{match.awayTeam}</span>
                          <div className="flex gap-1">
                            {analysis.awayTeamForm.split('').map((r, i) => (
                              <span key={i} className={cn(
                                "w-5 h-5 rounded text-xs flex items-center justify-center font-bold",
                                r === 'W' && "bg-green-500/20 text-green-400",
                                r === 'D' && "bg-yellow-500/20 text-yellow-400",
                                r === 'L' && "bg-red-500/20 text-red-400"
                              )}>
                                {r}
                              </span>
                            ))}
                          </div>
                          {analysis.awayGoalsScored !== null && analysis.awayGoalsConceded !== null && (
                            <span className="text-xs text-muted-foreground">
                              ({analysis.awayGoalsScored}:{analysis.awayGoalsConceded})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lineups */}
            {analysis.lineupsAvailable && analysis.homeStartingXI && analysis.awayStartingXI && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Confirmed Lineups
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {match.homeTeam} {analysis.homeFormation && `(${analysis.homeFormation})`}
                    </p>
                    {analysis.homeCoach && (
                      <p className="text-xs text-muted-foreground mb-2">Coach: {analysis.homeCoach}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{analysis.homeStartingXI}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {match.awayTeam} {analysis.awayFormation && `(${analysis.awayFormation})`}
                    </p>
                    {analysis.awayCoach && (
                      <p className="text-xs text-muted-foreground mb-2">Coach: {analysis.awayCoach}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{analysis.awayStartingXI}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Key Injuries */}
            {keyInjuries.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Key Absences ({(analysis.homeInjuriesCount || 0) + (analysis.awayInjuriesCount || 0)})
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">{match.homeTeam} ({analysis.homeInjuriesCount || 0})</p>
                    <div className="space-y-1">
                      {keyInjuries
                        .filter(i => i.teamName === match.homeTeam)
                        .slice(0, 5)
                        .map((injury, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {injury.playerName} - <span className="text-red-400">{injury.reason}</span>
                          </p>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">{match.awayTeam} ({analysis.awayInjuriesCount || 0})</p>
                    <div className="space-y-1">
                      {keyInjuries
                        .filter(i => i.teamName === match.awayTeam)
                        .slice(0, 5)
                        .map((injury, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {injury.playerName} - <span className="text-red-400">{injury.reason}</span>
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
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
              : 'Predictions are made 12 hours before kickoff'}
          </p>
          <PredictionTable
            predictions={predictionsWithPoints}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            actualHomeScore={match.homeScore}
            actualAwayScore={match.awayScore}
            isFinished={isFinished}
          />
        </CardContent>
      </Card>
    </div>
  );
}
