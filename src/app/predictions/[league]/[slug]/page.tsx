import { notFound } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { MatchEvents } from '@/components/match-events';
import { getMatchBySlug, getMatchWithAnalysis, getBetsForMatchWithDetails } from '@/lib/db/queries';
import { getMatchEvents } from '@/lib/football/api-football';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, TrendingUp, Target, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LikelyScore } from '@/types';
import type { Metadata } from 'next';

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
    title: `${match.homeTeam} vs ${match.awayTeam} - AI Betting Predictions`,
    description: `AI betting predictions for ${match.homeTeam} vs ${match.awayTeam} in ${competition.name}. Kickoff: ${kickoff}. See odds and AI model bets.`,
    openGraph: {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description: `AI betting predictions for ${competition.name} match`,
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
  
  // Fetch bets for this match
  const bets = await getBetsForMatchWithDetails(match.id);
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

      {/* Betting Odds & Predictions Panel */}
      {hasAnalysis ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Betting Odds & Predictions
            </h2>
            
            <div className="space-y-6">
              {/* API-Football Prediction */}
              {(analysis.advice || analysis.homeWinPct) && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">API-Football Prediction</span>
                  </div>
                  
                  {analysis.advice && (
                    <p className="text-lg font-semibold mb-4">{analysis.advice}</p>
                  )}
                  
                  {analysis.homeWinPct && analysis.drawPct && analysis.awayWinPct && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-sm text-muted-foreground">Home</span>
                        <div className="flex-1 h-8 rounded-full overflow-hidden bg-muted/30">
                          <div 
                            className="h-full bg-primary flex items-center justify-end pr-2"
                            style={{ width: `${analysis.homeWinPct}%` }}
                          >
                            <span className="text-xs font-bold text-white">{analysis.homeWinPct}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-sm text-muted-foreground">Draw</span>
                        <div className="flex-1 h-8 rounded-full overflow-hidden bg-muted/30">
                          <div 
                            className="h-full bg-muted-foreground/50 flex items-center justify-end pr-2"
                            style={{ width: `${analysis.drawPct}%` }}
                          >
                            <span className="text-xs font-bold">{analysis.drawPct}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-sm text-muted-foreground">Away</span>
                        <div className="flex-1 h-8 rounded-full overflow-hidden bg-muted/30">
                          <div 
                            className="h-full bg-accent flex items-center justify-end pr-2"
                            style={{ width: `${analysis.awayWinPct}%` }}
                          >
                            <span className="text-xs font-bold text-white">{analysis.awayWinPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Match Result (1X2) Odds */}
              {analysis.oddsHome && analysis.oddsDraw && analysis.oddsAway && (() => {
                const favorite = getLowestOdds(analysis.oddsHome, analysis.oddsDraw, analysis.oddsAway);
                return (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Match Result (1X2)</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className={cn(
                        "text-center py-4 px-3 rounded-lg transition-colors",
                        favorite === 'home'
                          ? "bg-primary/15 border-2 border-primary/40"
                          : "bg-muted/50 border-2 border-transparent"
                      )}>
                        <p className="text-2xl font-bold font-mono">{analysis.oddsHome}</p>
                        <p className="text-xs text-muted-foreground mt-1">Home Win</p>
                      </div>
                      <div className={cn(
                        "text-center py-4 px-3 rounded-lg transition-colors",
                        favorite === 'draw'
                          ? "bg-primary/15 border-2 border-primary/40"
                          : "bg-muted/50 border-2 border-transparent"
                      )}>
                        <p className="text-2xl font-bold font-mono">{analysis.oddsDraw}</p>
                        <p className="text-xs text-muted-foreground mt-1">Draw</p>
                      </div>
                      <div className={cn(
                        "text-center py-4 px-3 rounded-lg transition-colors",
                        favorite === 'away'
                          ? "bg-primary/15 border-2 border-primary/40"
                          : "bg-muted/50 border-2 border-transparent"
                      )}>
                        <p className="text-2xl font-bold font-mono">{analysis.oddsAway}</p>
                        <p className="text-xs text-muted-foreground mt-1">Away Win</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Double Chance Odds */}
              {analysis.odds1X && analysis.oddsX2 && analysis.odds12 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Double Chance</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center py-3 px-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold font-mono">{analysis.odds1X}</p>
                      <p className="text-xs text-muted-foreground mt-1">Home or Draw</p>
                    </div>
                    <div className="text-center py-3 px-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold font-mono">{analysis.oddsX2}</p>
                      <p className="text-xs text-muted-foreground mt-1">Draw or Away</p>
                    </div>
                    <div className="text-center py-3 px-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold font-mono">{analysis.odds12}</p>
                      <p className="text-xs text-muted-foreground mt-1">Home or Away</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Over/Under Goals */}
              {(analysis.oddsOver15 || analysis.oddsOver25 || analysis.oddsOver35) && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Over/Under Goals</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {analysis.oddsOver05 && analysis.oddsUnder05 && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">0.5 Goals</p>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono">O {analysis.oddsOver05}</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-mono">U {analysis.oddsUnder05}</span>
                        </div>
                      </div>
                    )}
                    {analysis.oddsOver15 && analysis.oddsUnder15 && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">1.5 Goals</p>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono">O {analysis.oddsOver15}</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-mono">U {analysis.oddsUnder15}</span>
                        </div>
                      </div>
                    )}
                    {analysis.oddsOver25 && analysis.oddsUnder25 && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">2.5 Goals</p>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono">O {analysis.oddsOver25}</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-mono">U {analysis.oddsUnder25}</span>
                        </div>
                      </div>
                    )}
                    {analysis.oddsOver35 && analysis.oddsUnder35 && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">3.5 Goals</p>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono">O {analysis.oddsOver35}</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-mono">U {analysis.oddsUnder35}</span>
                        </div>
                      </div>
                    )}
                    {analysis.oddsOver45 && analysis.oddsUnder45 && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-1">4.5 Goals</p>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono">O {analysis.oddsOver45}</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-mono">U {analysis.oddsUnder45}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Both Teams To Score */}
              {analysis.oddsBttsYes && analysis.oddsBttsNo && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Both Teams To Score</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center py-3 px-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold font-mono">{analysis.oddsBttsYes}</p>
                      <p className="text-xs text-muted-foreground mt-1">Yes</p>
                    </div>
                    <div className="text-center py-3 px-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold font-mono">{analysis.oddsBttsNo}</p>
                      <p className="text-xs text-muted-foreground mt-1">No</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Likely Scores */}
              {likelyScores.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Likely Scores</h3>
                  <div className="flex flex-wrap gap-2">
                    {likelyScores.slice(0, 6).map((score, i) => (
                      <span key={i} className={cn(
                        "px-4 py-2 rounded-lg text-sm font-mono",
                        i === 0 ? "bg-primary/15 border border-primary/30 font-semibold" : "bg-muted/50"
                      )}>
                        {score.score} <span className="text-muted-foreground text-xs">@{score.odds}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : !isFinished && !isLive && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Pre-match analysis and betting odds will be available closer to kickoff (~6 hours before the match).
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Model Bets */}
      {bets && bets.length > 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              AI Model Bets
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {bets.length} bet{bets.length !== 1 ? 's' : ''} placed by AI models
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-2 font-medium">Model</th>
                    <th className="text-left py-3 px-2 font-medium">Bet Type</th>
                    <th className="text-left py-3 px-2 font-medium">Selection</th>
                    <th className="text-right py-3 px-2 font-medium">Odds</th>
                    <th className="text-right py-3 px-2 font-medium">Stake</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.betId} className="border-b border-border/30">
                      <td className="py-3 px-2">
                        <Link href={`/models/${bet.modelId}`} className="hover:text-primary transition-colors">
                          {bet.modelDisplayName}
                        </Link>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {bet.betType}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-medium">{bet.selection}</td>
                      <td className="text-right py-3 px-2 font-mono">{bet.odds?.toFixed(2)}</td>
                      <td className="text-right py-3 px-2 font-mono">€{bet.stake?.toFixed(2)}</td>
                      <td className="text-center py-3 px-2">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          bet.status === 'won' && "bg-green-500/20 text-green-400",
                          bet.status === 'lost' && "bg-red-500/20 text-red-400",
                          bet.status === 'pending' && "bg-yellow-500/20 text-yellow-400",
                          bet.status === 'void' && "bg-muted text-muted-foreground"
                        )}>
                          {bet.status}
                        </span>
                      </td>
                      <td className={cn(
                        "text-right py-3 px-2 font-mono font-medium",
                        (bet.profit ?? 0) > 0 && "text-green-400",
                        (bet.profit ?? 0) < 0 && "text-red-400"
                      )}>
                        {bet.profit !== null ? (
                          <>{bet.profit >= 0 ? '+' : ''}€{bet.profit.toFixed(2)}</>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !isFinished && !isLive && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-8 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2 font-medium">
              AI model bets will be placed approximately 1 hour before kickoff
            </p>
            <p className="text-sm text-muted-foreground/70">
              Bets are generated when team lineups are confirmed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
