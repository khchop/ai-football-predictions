import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Clock, MapPin, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface MatchEvent {
  minute: number;
  type: string;
  description: string;
  team?: string;
}

interface SummaryTabProps {
  match: {
    homeTeam: string;
    awayTeam: string;
    competition: string;
    venue?: string;
    kickoff?: string;
  };
  competition?: {
    name: string;
    country?: string;
  };
  isLive: boolean;
  isFinished: boolean;
  matchEvents?: MatchEvent[];
}

export function SummaryTab({
  match,
  competition,
  isLive,
  isFinished,
  matchEvents = [],
}: SummaryTabProps) {
  return (
    <div className="space-y-4">
      {/* Match Info Card */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Match Information
          </h3>

          <div className="space-y-3">
            {/* Competition */}
            <div className="flex items-center gap-3">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Competition</p>
                <p className="font-medium">
                  {competition?.name || match.competition}
                  {competition?.country && (
                    <span className="text-muted-foreground ml-1">
                      ({competition.country})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Kickoff Time */}
            {match.kickoff && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isFinished ? 'Kicked Off' : isLive ? 'Started' : 'Kickoff'}
                  </p>
                  <p className="font-medium">
                    {format(parseISO(match.kickoff), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(match.kickoff), 'HH:mm')}
                  </p>
                </div>
              </div>
            )}

            {/* Venue */}
            {match.venue && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="font-medium">{match.venue}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Events (if any) */}
      {matchEvents.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Match Events
            </h3>

            <div className="space-y-3">
              {matchEvents
                .sort((a, b) => a.minute - b.minute)
                .map((event, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border',
                      event.type === 'goal' &&
                        'bg-green-500/10 border-green-500/30',
                      event.type === 'yellow_card' &&
                        'bg-yellow-500/10 border-yellow-500/30',
                      event.type === 'red_card' &&
                        'bg-red-500/10 border-red-500/30',
                      event.type === 'substitution' &&
                        'bg-blue-500/10 border-blue-500/30',
                      !['goal', 'yellow_card', 'red_card', 'substitution'].includes(
                        event.type
                      ) && 'bg-muted/30 border-border/50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-12 text-sm font-mono font-semibold',
                        event.type === 'goal' && 'text-green-400',
                        event.type === 'yellow_card' && 'text-yellow-400',
                        event.type === 'red_card' && 'text-red-400',
                        event.type === 'substitution' && 'text-blue-400'
                      )}
                    >
                      {event.minute}&apos;
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{event.description}</p>
                      {event.team && (
                        <p className="text-xs text-muted-foreground">
                          {event.team}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
