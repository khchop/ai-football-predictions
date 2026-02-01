import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchAnalysis } from '@/lib/db/schema';
import type { LikelyScore } from '@/types';

// Helper to find the lowest odds (favorite)
function getLowestOdds(home: string, draw: string, away: string): 'home' | 'draw' | 'away' {
  const h = parseFloat(home);
  const d = parseFloat(draw);
  const a = parseFloat(away);
  if (h <= d && h <= a) return 'home';
  if (a <= d && a <= h) return 'away';
  return 'draw';
}

interface MatchOddsPanelProps {
  analysis: MatchAnalysis | null;
  likelyScores: LikelyScore[];
  isFinished: boolean;
  isLive: boolean;
}

export function MatchOddsPanel({ analysis, likelyScores, isFinished, isLive }: MatchOddsPanelProps) {
  // Check if we have any analysis data
  const hasAnalysis = analysis && (
    analysis.oddsHome || analysis.homeWinPct || analysis.advice
  );

  // Show placeholder if no analysis and match is upcoming
  if (!hasAnalysis && !isFinished && !isLive) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Pre-match analysis and betting odds will be available closer to kickoff (~6 hours before the match).
          </p>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no analysis
  if (!hasAnalysis) {
    return null;
  }

  return (
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
  );
}
