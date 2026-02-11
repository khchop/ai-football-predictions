import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TeamStats } from '@/lib/db/queries/team-stats';

interface TeamStatsOverviewProps {
  stats: TeamStats;
}

export function TeamStatsOverview({ stats }: TeamStatsOverviewProps) {
  const winRate = stats.totalMatches > 0
    ? Math.round((stats.wins / stats.totalMatches) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Core stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Record */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {stats.wins}-{stats.draws}-{stats.losses}
            </div>
            <p className="text-sm text-muted-foreground">Record (W-D-L)</p>
          </CardContent>
        </Card>

        {/* Goals Scored */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.goalsScored}</div>
            <p className="text-sm text-muted-foreground">Goals Scored</p>
          </CardContent>
        </Card>

        {/* Goals Conceded */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.goalsConceded}</div>
            <p className="text-sm text-muted-foreground">Goals Conceded</p>
          </CardContent>
        </Card>

        {/* Clean Sheets */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.cleanSheets}</div>
            <p className="text-sm text-muted-foreground">Clean Sheets</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Averages and derived stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Goal Difference */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className={cn(
              "text-2xl font-bold",
              stats.goalDifference > 0 && "text-green-400",
              stats.goalDifference < 0 && "text-red-400"
            )}>
              {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
            </div>
            <p className="text-sm text-muted-foreground">Goal Difference</p>
          </CardContent>
        </Card>

        {/* Avg Goals Scored */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.avgGoalsScored.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Avg Goals Scored</p>
          </CardContent>
        </Card>

        {/* Avg Goals Conceded */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.avgGoalsConceded.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Avg Goals Conceded</p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{winRate}%</div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Home/Away splits */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Home Record */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {stats.homeWins}-{stats.homeDraws}-{stats.homeLosses}
            </div>
            <p className="text-sm text-muted-foreground">Home Record</p>
          </CardContent>
        </Card>

        {/* Away Record */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {stats.awayWins}-{stats.awayDraws}-{stats.awayLosses}
            </div>
            <p className="text-sm text-muted-foreground">Away Record</p>
          </CardContent>
        </Card>

        {/* Total Matches */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
            <p className="text-sm text-muted-foreground">Total Matches</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
