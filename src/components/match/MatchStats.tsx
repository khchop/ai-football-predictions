import { Card, CardContent } from '@/components/ui/card';
import { MatchAnalysis, LeagueStanding } from '@/lib/db/schema';
import { H2HMatch } from '@/types';
import { cn } from '@/lib/utils';
import { Trophy, History, TrendingUp } from 'lucide-react';

interface MatchStatsProps {
  analysis: MatchAnalysis | null;
  homeStanding: LeagueStanding | null;
  awayStanding: LeagueStanding | null;
}

export function MatchStats({ analysis, homeStanding, awayStanding }: MatchStatsProps) {
  const h2hResults = analysis?.h2hResults ? JSON.parse(analysis.h2hResults) as H2HMatch[] : [];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Standings & Form */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            League Context
          </h3>
          
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

          <div className="pt-4 border-t border-border/30 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Home Win %</p>
              <p className="text-xl font-bold">{analysis?.homeWinPct || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Away Win %</p>
              <p className="text-xl font-bold">{analysis?.awayWinPct || 0}%</p>
            </div>
          </div>
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

          {analysis?.h2hTotal && (
            <div className="pt-2 text-xs text-center text-muted-foreground">
              Total meetings: {analysis.h2hTotal} ({analysis.h2hHomeWins}W, {analysis.h2hDraws}D, {analysis.h2hAwayWins}L)
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
