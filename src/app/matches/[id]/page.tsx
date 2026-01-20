import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { PredictionTable } from '@/components/prediction-table';
import { MatchEvents } from '@/components/match-events';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { calculateEnhancedScores } from '@/lib/utils/scoring';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, AlertTriangle, Users, Target } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { KeyInjury, LikelyScore } from '@/types';
import { Collapsible } from '@/components/ui/collapsible';

// Helper to parse form percentage string (e.g., "60%" -> 60)
function parseFormPercent(form: string | null): number | null {
  if (!form) return null;
  const match = form.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
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
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column: Odds & Prediction */}
              <div className="space-y-6">
                {/* Betting Odds */}
                {analysis.oddsHome && analysis.oddsDraw && analysis.oddsAway && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Betting Odds</h3>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex-1 text-center py-3 px-2 rounded-lg transition-colors",
                        analysis.homeWinPct && analysis.awayWinPct && analysis.homeWinPct > analysis.awayWinPct
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/50"
                      )}>
                        <p className="text-xl font-bold font-mono">{analysis.oddsHome}</p>
                        <p className="text-xs text-muted-foreground mt-1">Home</p>
                      </div>
                      <div className="flex-1 text-center py-3 px-2 rounded-lg bg-muted/50">
                        <p className="text-xl font-bold font-mono">{analysis.oddsDraw}</p>
                        <p className="text-xs text-muted-foreground mt-1">Draw</p>
                      </div>
                      <div className={cn(
                        "flex-1 text-center py-3 px-2 rounded-lg transition-colors",
                        analysis.homeWinPct && analysis.awayWinPct && analysis.awayWinPct > analysis.homeWinPct
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/50"
                      )}>
                        <p className="text-xl font-bold font-mono">{analysis.oddsAway}</p>
                        <p className="text-xs text-muted-foreground mt-1">Away</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Win Percentages */}
                {analysis.homeWinPct && analysis.awayWinPct && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Win Probability</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono w-12">{analysis.homeWinPct}%</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${analysis.homeWinPct}%` }}
                        />
                        <div 
                          className="h-full bg-muted-foreground/40 transition-all"
                          style={{ width: `${analysis.drawPct || 0}%` }}
                        />
                        <div 
                          className="h-full bg-accent transition-all"
                          style={{ width: `${analysis.awayWinPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold font-mono w-12 text-right">{analysis.awayWinPct}%</span>
                    </div>
                    {analysis.advice && (
                      <p className="text-xs text-primary/80 mt-3 italic">&quot;{analysis.advice}&quot;</p>
                    )}
                  </div>
                )}

                {/* Likely Scores */}
                {likelyScores.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Likely Scores</h3>
                    <div className="flex flex-wrap gap-2">
                      {likelyScores.slice(0, 4).map((score, i) => (
                        <span key={i} className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-mono",
                          i === 0 ? "bg-primary/15 border border-primary/30" : "bg-muted/50"
                        )}>
                          {score.score} <span className="text-muted-foreground text-xs">({score.odds})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Team Stats */}
              <div className="space-y-6">
                {/* Team Comparison Bars */}
                {analysis.formHomePct && analysis.formAwayPct && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Team Comparison</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-14 font-medium">Form</span>
                        <span className="w-10 text-right font-mono">{analysis.formHomePct}%</span>
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${analysis.formHomePct}%` }} />
                        </div>
                        <span className="w-10 font-mono">{analysis.formAwayPct}%</span>
                      </div>
                      {analysis.attackHomePct && analysis.attackAwayPct && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="w-14 font-medium">Attack</span>
                          <span className="w-10 text-right font-mono">{analysis.attackHomePct}%</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${analysis.attackHomePct}%` }} />
                          </div>
                          <span className="w-10 font-mono">{analysis.attackAwayPct}%</span>
                        </div>
                      )}
                      {analysis.defenseHomePct && analysis.defenseAwayPct && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="w-14 font-medium">Defense</span>
                          <span className="w-10 text-right font-mono">{analysis.defenseHomePct}%</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${analysis.defenseHomePct}%` }} />
                          </div>
                          <span className="w-10 font-mono">{analysis.defenseAwayPct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Form - Now shows percentage progress bar */}
                {(analysis.homeTeamForm || analysis.awayTeamForm) && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Form (Last 5)</h3>
                    <div className="space-y-2">
                      {analysis.homeTeamForm && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs w-28 truncate font-medium">{match.homeTeam}</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all" 
                              style={{ width: `${parseFormPercent(analysis.homeTeamForm) || 0}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono w-10 text-right">{analysis.homeTeamForm}</span>
                          {analysis.homeGoalsScored !== null && analysis.homeGoalsConceded !== null && (
                            <span className="text-xs text-muted-foreground w-12">
                              ({analysis.homeGoalsScored}:{analysis.homeGoalsConceded})
                            </span>
                          )}
                        </div>
                      )}
                      {analysis.awayTeamForm && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs w-28 truncate font-medium">{match.awayTeam}</span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all" 
                              style={{ width: `${parseFormPercent(analysis.awayTeamForm) || 0}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono w-10 text-right">{analysis.awayTeamForm}</span>
                          {analysis.awayGoalsScored !== null && analysis.awayGoalsConceded !== null && (
                            <span className="text-xs text-muted-foreground w-12">
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
