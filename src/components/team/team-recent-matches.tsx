import Link from 'next/link';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RecentMatchWithAccuracy } from '@/lib/db/queries/team-stats';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

interface TeamRecentMatchesProps {
  matches: RecentMatchWithAccuracy[];
  teamName: string;
}

export function TeamRecentMatches({ matches, teamName }: TeamRecentMatchesProps) {
  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground">No recent results</p>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const matchUrl = match.slug && match.competitionId
          ? `/leagues/${match.competitionId}/${match.slug}`
          : null;
        const homeConfig = getTeamByIdOrAlias(match.homeTeam);
        const awayConfig = getTeamByIdOrAlias(match.awayTeam);

        // Determine accuracy bar color
        const accuracyColor = match.accuracyPct >= 70
          ? 'bg-green-500'
          : match.accuracyPct >= 40
            ? 'bg-yellow-500'
            : 'bg-red-500';

        return (
          <div key={match.matchId} className="relative">
            <Card className={cn(
              "bg-card/50 border-border/50",
              matchUrl && "hover:bg-card/80 hover:border-border transition-colors"
            )}>
              {matchUrl && (
                <a href={matchUrl} className="absolute inset-0 z-0" aria-label={`View ${match.homeTeam} vs ${match.awayTeam} match details`} />
              )}
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center justify-between gap-4">
                  {/* Left side: Teams and score */}
                  <div className="flex items-center gap-3 flex-1">
                    {/* Result badge */}
                    <div
                      className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
                        match.result === 'W' && 'bg-green-500/20 text-green-400 border border-green-500/40',
                        match.result === 'D' && 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
                        match.result === 'L' && 'bg-red-500/20 text-red-400 border border-red-500/40'
                      )}
                    >
                      {match.result}
                    </div>

                    {/* Teams with logos */}
                    <div className="flex items-center gap-2 flex-1">
                      {/* Home team logo */}
                      {match.homeTeamLogo ? (
                        <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <Image
                            src={match.homeTeamLogo}
                            alt={`${match.homeTeam} logo`}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-muted-foreground">
                            {match.homeTeam.substring(0, 1)}
                          </span>
                        </div>
                      )}

                      {/* Score and team names */}
                      <div className="flex items-center gap-2">
                        {homeConfig ? (
                          <Link
                            href={`/teams/${homeConfig.slug}`}
                            className={cn(
                              "text-sm hover:text-primary transition-colors hover:underline relative",
                              match.homeTeam === teamName && "font-bold"
                            )}
                          >
                            {match.homeTeam}
                          </Link>
                        ) : (
                          <span className={cn(
                            "text-sm",
                            match.homeTeam === teamName && "font-bold"
                          )}>
                            {match.homeTeam}
                          </span>
                        )}
                        <span className="font-mono font-bold">
                          {match.homeScore} - {match.awayScore}
                        </span>
                        {awayConfig ? (
                          <Link
                            href={`/teams/${awayConfig.slug}`}
                            className={cn(
                              "text-sm hover:text-primary transition-colors hover:underline relative",
                              match.awayTeam === teamName && "font-bold"
                            )}
                          >
                            {match.awayTeam}
                          </Link>
                        ) : (
                          <span className={cn(
                            "text-sm",
                            match.awayTeam === teamName && "font-bold"
                          )}>
                            {match.awayTeam}
                          </span>
                        )}
                      </div>

                      {/* Away team logo */}
                      {match.awayTeamLogo ? (
                        <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <Image
                            src={match.awayTeamLogo}
                            alt={`${match.awayTeam} logo`}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-muted-foreground">
                            {match.awayTeam.substring(0, 1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(parseISO(match.kickoffTime), 'MMM d')}
                    </span>
                  </div>

                  {/* Right side: AI accuracy */}
                  <div className="flex flex-col items-end gap-1 min-w-[120px]">
                    {match.predictionCount > 0 ? (
                      <>
                        {/* Accuracy bar */}
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full transition-all", accuracyColor)}
                            style={{ width: `${match.accuracyPct}%` }}
                          />
                        </div>

                        {/* Accuracy text */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {match.correctPredictions}/{match.predictionCount} models ({match.accuracyPct}%)
                          </span>
                          {match.exactScoreCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                              Exact: {match.exactScoreCount}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No predictions</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
