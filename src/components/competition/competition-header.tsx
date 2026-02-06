import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Trophy } from 'lucide-react';
import { COMPETITIONS, getCompetitionById } from '@/lib/football/competitions';
import type { Competition } from '@/lib/db/schema';

interface CompetitionHeaderProps {
  competitionId: string;
  matchCount: number;
  nextMatchTime?: string;
}

export async function CompetitionHeader({ competitionId, matchCount, nextMatchTime }: CompetitionHeaderProps) {
  // Get competition config for display info
  const config = getCompetitionById(competitionId);
  
  // Get competition from database for name (optional - config is primary source)
  const { getCompetitionById: dbGetCompetition } = await import('@/lib/db/queries');
  const competition = await dbGetCompetition(competitionId);
  
  // Use config as primary source, DB as fallback
  const displayName = config?.name || competition?.name || competitionId;
  const icon = config?.icon || '⚽';
  const color = config?.color || '#3D195B';
  const season = config?.season || competition?.season || new Date().getFullYear();
  
  return (
    <Card className="mb-6 overflow-hidden">
      <div 
        className="h-1.5 w-full" 
        style={{ backgroundColor: color }}
      />
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center w-16 h-16 rounded-xl text-3xl"
              style={{ backgroundColor: `${color}20` }}
            >
              {icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {displayName} Predictions
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color
                  }}
                >
                  {season}-{season + 1}
                </span>
              </h1>
              <p className="text-muted-foreground text-sm">
                {matchCount} matches tracked
              </p>
            </div>
          </div>
          
          {nextMatchTime && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Next Match</p>
                <p className="text-sm font-medium">
                  {new Date(nextMatchTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              <span>AI Predictions</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
