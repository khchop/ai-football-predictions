import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Goal, Users, CircleX } from 'lucide-react';

interface CompetitionStatsData {
  totalMatches: number;
  finishedMatches: number;
  scheduledMatches: number;
  liveMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
}

interface CompetitionStatsProps {
  stats: CompetitionStatsData;
}

function StatItem({ 
  label, 
  value, 
  icon: Icon, 
  subtext,
  highlight = false 
}: { 
  label: string; 
  value: string | number; 
  icon: any;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/10' : 'bg-muted'}`}>
        <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-semibold ${highlight ? 'text-primary' : ''}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtext && (
          <p className="text-xs text-muted-foreground">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export async function CompetitionStats({ stats }: CompetitionStatsProps) {
  if (!stats || stats.totalMatches === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Competition Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No match data available for this competition yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Calculate percentages for result distribution
  const finished = Number(stats.finishedMatches) || 1;
  const homeWinPct = (Number(stats.homeWins) / finished) * 100;
  const awayWinPct = (Number(stats.awayWins) / finished) * 100;
  const drawPct = (Number(stats.draws) / finished) * 100;
  
  // Create a simple bar visualization
  const barWidth = 100;
  const homeWidth = (homeWinPct / 100) * barWidth;
  const drawWidth = (drawPct / 100) * barWidth;
  const awayWidth = (awayWinPct / 100) * barWidth;
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Competition Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Result Distribution Bar */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Result Distribution</p>
          <div className="flex h-6 rounded-lg overflow-hidden">
            <div 
              className="flex items-center justify-center text-xs font-medium text-white bg-green-600"
              style={{ width: `${homeWidth}%` }}
            >
              {homeWinPct > 10 ? `${Math.round(homeWinPct)}%` : ''}
            </div>
            <div 
              className="flex items-center justify-center text-xs font-medium text-white bg-yellow-500"
              style={{ width: `${drawWidth}%` }}
            >
              {drawPct > 10 ? `${Math.round(drawPct)}%` : ''}
            </div>
            <div 
              className="flex items-center justify-center text-xs font-medium text-white bg-red-600"
              style={{ width: `${awayWidth}%` }}
            >
              {awayWinPct > 10 ? `${Math.round(awayWinPct)}%` : ''}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Home {Math.round(homeWinPct)}%</span>
            <span className="flex items-center gap-1"><CircleX className="h-3 w-3" /> Draw {Math.round(drawPct)}%</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Away {Math.round(awayWinPct)}%</span>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem 
            label="Matches Played" 
            value={stats.finishedMatches} 
            icon={Goal}
            subtext={`${stats.scheduledMatches} scheduled`}
          />
          <StatItem 
            label="Total Goals" 
            value={stats.totalGoals} 
            icon={Goal}
            subtext={`${stats.avgGoalsPerMatch} per match`}
          />
          <StatItem 
            label="Home Wins" 
            value={stats.homeWins} 
            icon={Users}
            highlight
          />
          <StatItem 
            label="Away Wins" 
            value={stats.awayWins} 
            icon={Users}
          />
        </div>
        
        {stats.liveMatches > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-600 font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              {stats.liveMatches} match{stats.liveMatches > 1 ? 'es' : ''} currently live
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
