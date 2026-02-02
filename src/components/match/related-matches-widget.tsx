import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { getRelatedMatches } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

interface RelatedMatchesWidgetProps {
  matchId: string;
  competitionSlug: string;
}

export async function RelatedMatchesWidget({ matchId, competitionSlug }: RelatedMatchesWidgetProps) {
  const relatedMatches = await getRelatedMatches(matchId, 5);

  if (relatedMatches.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Related Matches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relatedMatches.map(({ match, competition }) => {
            const kickoff = parseISO(match.kickoffTime);
            const matchUrl = match.slug
              ? `/leagues/${competition.slug || competition.id}/${match.slug}`
              : `/matches/${match.id}`;

            return (
              <Link
                key={match.id}
                href={matchUrl}
                className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors min-h-[44px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">
                      {match.homeTeam} vs {match.awayTeam}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {competition.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    {format(kickoff, 'MMM d')}
                  </div>
                </div>
                {match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    Final: {match.homeScore}-{match.awayScore}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
