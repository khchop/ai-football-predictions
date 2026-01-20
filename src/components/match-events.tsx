'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

interface MatchEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

interface MatchEventsProps {
  events: MatchEvent[];
  homeTeam: string;
  awayTeam: string;
}

// Format event time (e.g., "45'" or "90'+3")
function formatTime(time: { elapsed: number; extra: number | null }): string {
  if (time.extra) {
    return `${time.elapsed}'+${time.extra}`;
  }
  return `${time.elapsed}'`;
}

// Get icon for event type
function getEventIcon(type: string, detail: string): string {
  if (type === 'Goal') return '⚽';
  if (type === 'Card' && detail.includes('Red')) return '🟥';
  if (type === 'Card' && detail.includes('Yellow')) return '🟨';
  if (type === 'subst') return '🔄';
  if (type === 'Var') return '📺';
  return '•';
}

export function MatchEvents({ events, homeTeam, awayTeam }: MatchEventsProps) {
  // Filter to only show goals and cards (skip substitutions for cleaner display)
  const significantEvents = events.filter(e => 
    e.type === 'Goal' || 
    (e.type === 'Card' && e.detail.includes('Red')) ||
    (e.type === 'Var' && e.detail.includes('Goal'))
  );

  // Sort by time
  const sortedEvents = [...significantEvents].sort((a, b) => {
    const timeA = a.time.elapsed + (a.time.extra || 0) * 0.01;
    const timeB = b.time.elapsed + (b.time.extra || 0) * 0.01;
    return timeA - timeB;
  });

  if (sortedEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {sortedEvents.map((event, index) => {
        const isHome = event.team.name === homeTeam || 
          event.team.name.toLowerCase().includes(homeTeam.toLowerCase().split('/')[0]);
        const isGoal = event.type === 'Goal';
        const isDisallowed = event.type === 'Var' && event.detail.includes('Disallowed');
        const isRedCard = event.type === 'Card' && event.detail.includes('Red');

        return (
          <div
            key={`${event.time.elapsed}-${event.player.id || index}-${event.type}`}
            className={cn(
              "flex items-center gap-3 py-2 px-3 rounded-lg",
              isHome ? "flex-row" : "flex-row-reverse",
              isGoal && !isDisallowed && "bg-green-500/10",
              isDisallowed && "bg-muted/30 opacity-60",
              isRedCard && "bg-red-500/10"
            )}
          >
            {/* Time */}
            <span className="text-sm font-mono text-muted-foreground w-12 text-center flex-shrink-0">
              {formatTime(event.time)}
            </span>

            {/* Event Icon */}
            <span className="text-lg flex-shrink-0">
              {getEventIcon(event.type, event.detail)}
            </span>

            {/* Team Logo */}
            <div className="w-5 h-5 flex-shrink-0">
              <Image
                src={event.team.logo}
                alt={event.team.name}
                width={20}
                height={20}
                className="object-contain"
              />
            </div>

            {/* Player & Detail */}
            <div className={cn(
              "flex-1 min-w-0",
              isHome ? "text-left" : "text-right"
            )}>
              <span className={cn(
                "font-medium text-sm",
                isDisallowed && "line-through text-muted-foreground"
              )}>
                {event.player.name || 'Unknown'}
              </span>
              {isGoal && event.assist.name && !isDisallowed && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({event.assist.name})
                </span>
              )}
              {isDisallowed && (
                <span className="text-xs text-muted-foreground ml-1">
                  - Disallowed
                </span>
              )}
              {isRedCard && (
                <span className="text-xs text-red-400 ml-1">
                  - Red Card
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
