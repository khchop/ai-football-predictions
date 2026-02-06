import { getDb } from '@/lib/db';
import { predictions, matches, competitions } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { HoverPrefetchLink } from '@/components/navigation/hover-prefetch-link';
import { eq, sql } from 'drizzle-orm';

interface LeaguesCoveredWidgetProps {
  modelId: string;
}

export async function LeaguesCoveredWidget({ modelId }: LeaguesCoveredWidgetProps) {
  const db = getDb();

  // Query unique leagues with prediction counts
  const leaguesCovered = await db
    .select({
      competitionId: competitions.id,
      competitionName: competitions.name,
      predictionCount: sql<number>`count(*)::int`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(predictions.modelId, modelId))
    .groupBy(competitions.id, competitions.name)
    .orderBy(sql`count(*) DESC`);

  if (leaguesCovered.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leagues Covered
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {leaguesCovered.map((league) => (
            <HoverPrefetchLink
              key={league.competitionId}
              href={`/leagues/${league.competitionId}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-card hover:bg-accent transition-colors"
            >
              <span className="text-sm font-medium">{league.competitionName}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {league.predictionCount}
              </span>
            </HoverPrefetchLink>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
