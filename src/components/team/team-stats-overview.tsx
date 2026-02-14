import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TeamStats } from '@/lib/db/queries/team-stats';

interface TeamStatsOverviewProps {
  stats: TeamStats;
}

function StatItem({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div>
      <div className={cn('text-lg font-bold tabular-nums', className)}>{value}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function TeamStatsOverview({ stats }: TeamStatsOverviewProps) {
  const winRate = stats.totalMatches > 0
    ? Math.round((stats.wins / stats.totalMatches) * 100)
    : 0;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          <StatItem
            label="Record (W-D-L)"
            value={`${stats.wins}-${stats.draws}-${stats.losses}`}
          />
          <StatItem
            label="Win Rate"
            value={`${winRate}%`}
          />
          <StatItem
            label="Goals Scored"
            value={stats.goalsScored}
          />
          <StatItem
            label="Goals Conceded"
            value={stats.goalsConceded}
          />
          <StatItem
            label="Goal Diff"
            value={`${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}`}
            className={cn(
              stats.goalDifference > 0 && 'text-green-400',
              stats.goalDifference < 0 && 'text-red-400'
            )}
          />
          <StatItem
            label="Clean Sheets"
            value={stats.cleanSheets}
          />
          <StatItem
            label="Home (W-D-L)"
            value={`${stats.homeWins}-${stats.homeDraws}-${stats.homeLosses}`}
          />
          <StatItem
            label="Away (W-D-L)"
            value={`${stats.awayWins}-${stats.awayDraws}-${stats.awayLosses}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
