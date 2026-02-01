import Image from 'next/image';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin, Calendar, Clock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Match, Competition } from '@/lib/db/schema';

interface MatchHeaderProps {
  match: Match;
  competition: Competition;
  isLive: boolean;
  isFinished: boolean;
}

export function MatchHeader({ match, competition, isLive, isFinished }: MatchHeaderProps) {
  const kickoff = parseISO(match.kickoffTime);

  return (
    <>
      {/* Back Link */}
      <Link
        href="/matches"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to matches
      </Link>

      {/* Match Header Card */}
      <Card className={cn(
        "bg-card/50 border-border/50 overflow-hidden",
        isLive && "border-red-500/50"
      )}>
        {isLive && (
          <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" />
        )}

        <CardContent className="p-6 md:p-8">
          {/* Competition & Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{competition.name}</span>
              {match.round && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-sm text-muted-foreground">{match.round}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFinished && match.isUpset && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-500/20 text-orange-400">
                  UPSET
                </span>
              )}
              <span className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold",
                isLive && "status-live text-white",
                match.status === 'scheduled' && "status-upcoming text-white",
                isFinished && "status-finished text-muted-foreground"
              )}>
                {isLive ? 'LIVE' : isFinished ? 'Full Time' : 'Upcoming'}
              </span>
            </div>
          </div>

          {/* Teams & Score */}
          <div className="flex items-center justify-between gap-4 md:gap-8">
            {/* Home Team */}
            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {match.homeTeamLogo ? (
                  <Image
                    src={match.homeTeamLogo}
                    alt={`${match.homeTeam} team logo`}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {match.homeTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && match.homeScore !== null && match.awayScore !== null &&
                match.homeScore > match.awayScore && "text-green-400"
              )}>
                {match.homeTeam}
              </p>
              <p className="text-sm text-muted-foreground">Home</p>
            </div>

            {/* Score */}
            <div className="text-center px-4 md:px-8">
              {isFinished || isLive ? (
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && "text-green-400"
                  )}>
                    {match.homeScore}
                  </span>
                  <span className="text-3xl text-muted-foreground">-</span>
                  <span className={cn(
                    "text-5xl md:text-6xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && "text-green-400"
                  )}>
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <p className="text-4xl md:text-5xl font-bold gradient-text">VS</p>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center">
              <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                {match.awayTeamLogo ? (
                  <Image
                    src={match.awayTeamLogo}
                    alt={`${match.awayTeam} team logo`}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {match.awayTeam.charAt(0)}
                  </span>
                )}
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && match.homeScore !== null && match.awayScore !== null &&
                match.awayScore > match.homeScore && "text-green-400"
              )}>
                {match.awayTeam}
              </p>
              <p className="text-sm text-muted-foreground">Away</p>
            </div>
          </div>

          {/* Match Info */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-border/50 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(kickoff, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {format(kickoff, 'HH:mm')}
            </div>
            {match.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {match.venue}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
