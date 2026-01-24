import { Card, CardContent } from '@/components/ui/card';
import { MatchAnalysis, LeagueStanding } from '@/lib/db/schema';
import { H2HMatch } from '@/types';
import { cn } from '@/lib/utils';
import { Trophy, History, TrendingUp } from 'lucide-react';

interface MatchStatsProps {
  analysis: MatchAnalysis | null;
  homeStanding: LeagueStanding | null;
  awayStanding: LeagueStanding | null;
  homeTeam: string;
  awayTeam: string;
}

export function MatchStats({ analysis, homeStanding, awayStanding, homeTeam, awayTeam }: MatchStatsProps) {
  const h2hResults = analysis?.h2hResults ? JSON.parse(analysis.h2hResults) as H2HMatch[] : [];
  
  // Check if this is a cup match (teams not in same league standings)
  const isCupMatch = !homeStanding || !awayStanding;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Standings & Form */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            League Context
          </h3>
          
          {isCupMatch ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm italic">
              Cup Match - No league standings
            </div>
          ) : (
            <div className="space-y-4">
              {/* Home Team Standing */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{homeStanding?.teamName || 'Home Team'}</span>
                  <span className="text-xs text-muted-foreground">Position: {homeStanding?.position || 'N/A'}</span>
                </div>
                <div className="flex gap-1">
                  {(homeStanding?.form || '').split('').map((char, i) => (
                    <FormBadge key={i} result={char} />
                  ))}
                </div>
              </div>

              {/* Away Team Standing */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{awayStanding?.teamName || 'Away Team'}</span>
                  <span className="text-xs text-muted-foreground">Position: {awayStanding?.position || 'N/A'}</span>
                </div>
                <div className="flex gap-1">
                  {(awayStanding?.form || '').split('').map((char, i) => (
                    <FormBadge key={i} result={char} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* H2H History */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Head-to-Head
          </h3>

          {h2hResults.length > 0 ? (
            <div className="space-y-3">
              {h2hResults.slice(0, 5).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded-lg">
                  <span className="text-xs text-muted-foreground">
                    {m.date ? new Date(m.date).getFullYear() : ''}
                  </span>
                  <div className="flex-1 flex items-center justify-center gap-3">
                    <span className={cn("font-medium", m.homeScore > m.awayScore && "text-primary")}>{m.homeTeam}</span>
                    <span className="font-bold bg-muted px-2 py-0.5 rounded">{m.homeScore}-{m.awayScore}</span>
                    <span className={cn("font-medium", m.awayScore > m.homeScore && "text-primary")}>{m.awayTeam}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm italic">
              No recent head-to-head records found.
            </div>
          )}

          {analysis?.h2hTotal && analysis.h2hTotal > 0 && (
            <div className="pt-2 text-xs text-center text-muted-foreground">
              Total meetings: {analysis.h2hTotal}
              {(analysis.h2hHomeWins ?? 0) > (analysis.h2hAwayWins ?? 0)
                ? ` - ${homeTeam} leads ${analysis.h2hHomeWins}-${analysis.h2hAwayWins}` 
                : (analysis.h2hAwayWins ?? 0) > (analysis.h2hHomeWins ?? 0)
                  ? ` - ${awayTeam} leads ${analysis.h2hAwayWins}-${analysis.h2hHomeWins}`
                  : ' - All square'}
              {(analysis.h2hDraws ?? 0) > 0 && ` with ${analysis.h2hDraws} draw${(analysis.h2hDraws ?? 0) > 1 ? 's' : ''}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Predictions */}
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
    </div>
  );
}

function FormBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    'W': 'bg-green-500/20 text-green-500 border-green-500/30',
    'D': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    'L': 'bg-red-500/20 text-red-500 border-red-500/30',
  };

  return (
    <span className={cn(
      "w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold border",
      colors[result] || 'bg-muted text-muted-foreground border-border'
    )}>
      {result}
    </span>
  );
}
