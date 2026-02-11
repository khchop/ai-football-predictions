import Link from 'next/link';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { UpcomingMatchWithPredictions } from '@/lib/db/queries/team-stats';

interface TeamUpcomingMatchesProps {
  matches: UpcomingMatchWithPredictions[];
  teamName: string;
}

export function TeamUpcomingMatches({ matches, teamName }: TeamUpcomingMatchesProps) {
  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground">No upcoming matches scheduled</p>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const matchUrl = match.slug ? `/matches/${match.slug}` : null;

        const cardContent = (
          <Card className={cn(
            "bg-card/50 border-border/50",
            matchUrl && "hover:bg-card/80 hover:border-border cursor-pointer transition-colors"
          )}>
            <CardContent className="p-4">
                {/* Teams and logos */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Home team */}
                    <div className="flex items-center gap-2 flex-1">
                      {match.homeTeamLogo ? (
                        <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center overflow-hidden">
                          <Image
                            src={match.homeTeamLogo}
                            alt={`${match.homeTeam} logo`}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-bold text-muted-foreground">
                            {match.homeTeam.substring(0, 1)}
                          </span>
                        </div>
                      )}
                      <span className={cn(
                        "font-medium",
                        match.homeTeam === teamName && "font-semibold"
                      )}>
                        {match.homeTeam}
                      </span>
                    </div>

                    <span className="text-muted-foreground px-2">vs</span>

                    {/* Away team */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className={cn(
                        "font-medium",
                        match.awayTeam === teamName && "font-semibold"
                      )}>
                        {match.awayTeam}
                      </span>
                      {match.awayTeamLogo ? (
                        <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center overflow-hidden">
                          <Image
                            src={match.awayTeamLogo}
                            alt={`${match.awayTeam} logo`}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-bold text-muted-foreground">
                            {match.awayTeam.substring(0, 1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kickoff time */}
                <div className="text-sm text-muted-foreground mb-3">
                  {format(parseISO(match.kickoffTime), 'EEE, MMM d, h:mm a')}
                </div>

                {/* Prediction distribution */}
                {match.predictionCount > 0 ? (
                  <>
                    {/* Stacked bar */}
                    <div className="relative h-6 rounded-full overflow-hidden bg-muted mb-2">
                      <div className="absolute inset-0 flex">
                        {match.homeWinPct > 0 && (
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${match.homeWinPct}%` }}
                          />
                        )}
                        {match.drawPct > 0 && (
                          <div
                            className="bg-yellow-500 transition-all"
                            style={{ width: `${match.drawPct}%` }}
                          />
                        )}
                        {match.awayWinPct > 0 && (
                          <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${match.awayWinPct}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>Home {match.homeWinPct}%</span>
                      <span>Draw {match.drawPct}%</span>
                      <span>Away {match.awayWinPct}%</span>
                    </div>

                    {/* Average predicted score */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Avg predicted score: </span>
                      <span className="font-mono font-semibold">
                        {match.avgPredictedHome.toFixed(1)} - {match.avgPredictedAway.toFixed(1)}
                      </span>
                    </div>

                    {/* Model count */}
                    <div className="text-xs text-muted-foreground mt-1">
                      {match.predictionCount} AI model{match.predictionCount !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Predictions pending
                  </div>
                )}
              </CardContent>
            </Card>
          );

        return matchUrl ? (
          <Link key={match.matchId} href={matchUrl}>
            {cardContent}
          </Link>
        ) : (
          <div key={match.matchId}>
            {cardContent}
          </div>
        );
      })}
    </div>
  );
}
