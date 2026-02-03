import { Card, CardContent } from '@/components/ui/card';
import { MatchAnalysis } from '@/lib/db/schema';
import { TrendingUp, BarChart3 } from 'lucide-react';

export interface RoundupStats {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  xG?: number;
  [key: string]: number | undefined;
}

interface MatchStatsProps {
  analysis: MatchAnalysis | null;
  homeTeam: string;
  awayTeam: string;
  roundupStats?: RoundupStats | null;
  isFinished?: boolean;
}

export function MatchStats({ analysis, homeTeam, awayTeam, roundupStats, isFinished }: MatchStatsProps) {
  // Check if we have meaningful predictions to show
  const hasPredictions = analysis && (analysis.homeWinPct || analysis.oddsHome);

  // Check if we have meaningful roundup stats to show
  const hasRoundupStats = isFinished && roundupStats && (
    roundupStats.possession !== undefined ||
    roundupStats.xG !== undefined ||
    roundupStats.shots !== undefined ||
    roundupStats.corners !== undefined
  );

  // Hide entire component if no predictions and no match stats
  if (!hasPredictions && !hasRoundupStats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Match Predictions */}
      {hasPredictions && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Predictions
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Home Win</span>
                <span className="text-xl font-bold">{analysis?.homeWinPct || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Draw</span>
                <span className="text-xl font-bold">{analysis?.drawPct || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Away Win</span>
                <span className="text-xl font-bold">{analysis?.awayWinPct || 0}%</span>
              </div>
            </div>

            {analysis?.oddsHome && analysis?.oddsDraw && analysis?.oddsAway && (
              <div className="pt-4 border-t border-border/30 space-y-2">
                <p className="text-xs text-muted-foreground uppercase text-center">Odds</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Home</p>
                    <p className="text-sm font-bold">{(parseFloat(analysis.oddsHome) || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Draw</p>
                    <p className="text-sm font-bold">{(parseFloat(analysis.oddsDraw) || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Away</p>
                    <p className="text-sm font-bold">{(parseFloat(analysis.oddsAway) || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Match Statistics (from roundup for finished matches) */}
      {hasRoundupStats && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Match Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {roundupStats.possession !== undefined && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Possession</p>
                  <p className="text-lg font-bold">{roundupStats.possession}%</p>
                </div>
              )}
              {roundupStats.xG !== undefined && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">xG</p>
                  <p className="text-lg font-bold">{roundupStats.xG.toFixed(2)}</p>
                </div>
              )}
              {roundupStats.shots !== undefined && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Shots</p>
                  <p className="text-lg font-bold">{roundupStats.shots}</p>
                </div>
              )}
              {roundupStats.shotsOnTarget !== undefined && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">On Target</p>
                  <p className="text-lg font-bold">{roundupStats.shotsOnTarget}</p>
                </div>
              )}
              {roundupStats.corners !== undefined && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Corners</p>
                  <p className="text-lg font-bold">{roundupStats.corners}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
