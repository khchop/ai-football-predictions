'use client';

import { useMatch } from './use-match';
import { useLiveMatchMinute } from './use-live-match-minute';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * MatchHero - Single authoritative score/VS display for match pages.
 *
 * Features:
 * - Renders score/VS exactly once (eliminates duplicate displays)
 * - Shows teams with logo + name on left/right, score centered
 * - Live matches display current minute via polling
 * - All states have explicit badges (LIVE, FT, Upcoming, HT, POSTPONED, CANCELLED)
 * - LIVE badge has NO animation per user decision (animate-none override)
 *
 * @example
 * ```tsx
 * <MatchDataProvider match={match} competition={competition} analysis={analysis}>
 *   <MatchHero />
 * </MatchDataProvider>
 * ```
 */
export function MatchHero() {
  const { match, competition, matchState } = useMatch();
  const liveMinute = useLiveMatchMinute(match.externalId, matchState === 'live');
  const kickoff = parseISO(match.kickoffTime);

  // Determine special statuses
  const isPostponed = match.status === 'postponed';
  const isCancelled = match.status === 'cancelled';
  const isHalftime = liveMinute === 'HT';

  return (
    <section className="bg-card border-border border rounded-xl p-6 md:p-8 overflow-hidden">
      {/* Live indicator bar */}
      {matchState === 'live' && (
        <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500 -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8 md:mb-8" />
      )}

      {/* Teams + Score/VS */}
      <div className="flex items-center justify-between gap-4 md:gap-8">
        {/* Home Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.homeTeamLogo ? (
              <Image
                src={match.homeTeamLogo}
                alt={`${match.homeTeam} logo`}
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {match.homeTeam.charAt(0)}
              </span>
            )}
          </div>
          <p
            className={cn(
              'font-bold text-lg md:text-xl',
              matchState === 'finished' &&
                match.homeScore !== null &&
                match.awayScore !== null &&
                match.homeScore > match.awayScore &&
                'text-green-400'
            )}
          >
            {match.homeTeam}
          </p>
        </div>

        {/* Score/VS - Large centered */}
        <div className="text-center px-4 md:px-8">
          {isPostponed ? (
            <p className="text-2xl md:text-3xl text-muted-foreground italic">
              POSTPONED
            </p>
          ) : isCancelled ? (
            <p className="text-2xl md:text-3xl text-destructive line-through">
              CANCELLED
            </p>
          ) : matchState === 'upcoming' ? (
            <p className="text-4xl md:text-5xl font-bold gradient-text">VS</p>
          ) : (
            <div className="flex items-center gap-3 md:gap-4">
              <span
                className={cn(
                  'text-5xl md:text-6xl font-bold tabular-nums',
                  matchState === 'finished' &&
                    match.homeScore !== null &&
                    match.awayScore !== null &&
                    match.homeScore > match.awayScore &&
                    'text-green-400'
                )}
              >
                {match.homeScore ?? 0}
              </span>
              <span className="text-3xl text-muted-foreground">-</span>
              <span
                className={cn(
                  'text-5xl md:text-6xl font-bold tabular-nums',
                  matchState === 'finished' &&
                    match.homeScore !== null &&
                    match.awayScore !== null &&
                    match.awayScore > match.homeScore &&
                    'text-green-400'
                )}
              >
                {match.awayScore ?? 0}
              </span>
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.awayTeamLogo ? (
              <Image
                src={match.awayTeamLogo}
                alt={`${match.awayTeam} logo`}
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {match.awayTeam.charAt(0)}
              </span>
            )}
          </div>
          <p
            className={cn(
              'font-bold text-lg md:text-xl',
              matchState === 'finished' &&
                match.homeScore !== null &&
                match.awayScore !== null &&
                match.awayScore > match.homeScore &&
                'text-green-400'
            )}
          >
            {match.awayTeam}
          </p>
        </div>
      </div>

      {/* Meta Row: Competition • Date • Time/Minute • Status */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-6 border-t border-border/50 text-sm">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-medium">{competition.name}</span>
        </div>

        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {format(kickoff, 'MMMM d, yyyy')}
        </span>

        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {matchState === 'live' && liveMinute ? liveMinute : format(kickoff, 'HH:mm')}
        </span>

        {/* Status Badge - CRITICAL: animate-none override per user decision */}
        <Badge
          variant={isHalftime ? 'live' : matchState}
          className={cn(
            isHalftime && 'animate-none',
            matchState === 'live' && !isHalftime && 'animate-none'
          )}
        >
          {isHalftime
            ? 'HT'
            : matchState === 'live'
              ? 'LIVE'
              : matchState === 'finished'
                ? 'FT'
                : isPostponed
                  ? 'POSTPONED'
                  : isCancelled
                    ? 'CANCELLED'
                    : 'Upcoming'}
        </Badge>
      </div>
    </section>
  );
}
