import { cn } from '@/lib/utils';
import type { Match, Competition } from '@/lib/db/schema';
import { MatchHeader } from './match-header';

interface MatchHeaderStickyProps {
  match: Match;
  competition: Competition;
  isLive: boolean;
  isFinished: boolean;
}

export function MatchHeaderSticky({
  match,
  competition,
  isLive,
  isFinished,
}: MatchHeaderStickyProps) {
  return (
    <>
      {/* Mobile: Compact sticky header with score */}
      <header
        className={cn(
          'sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b md:hidden',
          isLive && 'border-red-500/50'
        )}
      >
        <div className="px-4 py-3 max-h-[60px]">
          <div className="flex items-center justify-between gap-2">
            {/* Home team + score */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold truncate text-sm">
                {match.homeTeam}
              </span>
              {(isFinished || isLive) && (
                <span className="text-2xl font-bold tabular-nums">
                  {match.homeScore}
                </span>
              )}
            </div>

            {/* Separator */}
            <span className="text-muted-foreground px-1 text-sm">
              {isFinished || isLive ? '-' : 'vs'}
            </span>

            {/* Away score + team */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              {(isFinished || isLive) && (
                <span className="text-2xl font-bold tabular-nums">
                  {match.awayScore}
                </span>
              )}
              <span className="font-semibold truncate text-sm">
                {match.awayTeam}
              </span>
            </div>
          </div>

          {/* Live indicator - subtle pulsing border effect already handled above */}
          {isLive && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" />
          )}
        </div>
      </header>

      {/* Desktop: Full existing MatchHeader component */}
      <div className="hidden md:block">
        <MatchHeader
          match={match}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />
      </div>
    </>
  );
}
