import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { getMatchesByCompetitionId } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar } from 'lucide-react';

interface RecentPredictionsWidgetProps {
  competitionId: string;
}

export async function RecentPredictionsWidget({ competitionId }: RecentPredictionsWidgetProps) {
  // Get recent 5 matches - reuse existing query
  const matchesData = await getMatchesByCompetitionId(competitionId, 5);

  if (matchesData.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Recent Predictions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {matchesData.map(({ match, competition }) => {
            const kickoff = parseISO(match.kickoffTime);
            const matchUrl = match.slug
              ? `/leagues/${competition.id}/${match.slug}`
              : `/matches/${match.id}`;

            return (
              <Link
                key={match.id}
                href={matchUrl}
                className="block p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">
                      {match.homeTeam} vs {match.awayTeam}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(kickoff, 'MMM d, yyyy')}
                    </div>
                  </div>
                  {match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono font-bold">
                        {match.homeScore}-{match.awayScore}
                      </p>
                      <p className="text-xs text-muted-foreground">Final</p>
                    </div>
                  )}
                  {match.status === 'scheduled' && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {format(kickoff, 'HH:mm')}
                      </p>
                    </div>
                  )}
                  {match.status === 'live' && (
                    <div className="text-right flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
