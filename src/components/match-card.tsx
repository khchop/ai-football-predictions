'use client';

import Link from 'next/link';
import Image from 'next/image';
import { format, parseISO, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { MapPin, Star, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MatchTime } from '@/components/client-date';

interface MatchCardProps {
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
    homeScore: number | null;
    awayScore: number | null;
    kickoffTime: string;
    status: string;
    matchMinute?: string | null;
    round?: string | null;
    venue?: string | null;
    isUpset?: boolean | null;
    // Kicktipp quota scoring
    quotaHome?: number | null;
    quotaDraw?: number | null;
    quotaAway?: number | null;
    competition: {
      id: string;
      name: string;
    };
  };
  analysis?: {
    homeWinPct: number | null;
    awayWinPct: number | null;
    oddsHome: string | null;
    oddsDraw: string | null;
    oddsAway: string | null;
    homeInjuriesCount: number | null;
    awayInjuriesCount: number | null;
    favoriteTeamName: string | null;
  } | null;
  showPredictions?: boolean;
  predictions?: Array<{
    modelDisplayName: string;
    predictedHomeScore: number;
    predictedAwayScore: number;
    points?: number | null;
  }>;
}

export function MatchCard({ match, analysis, showPredictions = false, predictions = [] }: MatchCardProps) {
  const kickoff = parseISO(match.kickoffTime);
  const isUpcoming = isAfter(kickoff, new Date());
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  
  // Determine favorite team
  const homeFavorite = analysis?.homeWinPct && analysis?.awayWinPct && analysis.homeWinPct > analysis.awayWinPct;
  const awayFavorite = analysis?.homeWinPct && analysis?.awayWinPct && analysis.awayWinPct > analysis.homeWinPct;

  // Track score changes for goal animation
  const [prevScore, setPrevScore] = useState({ home: match.homeScore, away: match.awayScore });
  const [showGoalAnimation, setShowGoalAnimation] = useState(false);

  useEffect(() => {
    // Check if score changed (goal scored)
    if (
      isLive &&
      (match.homeScore !== prevScore.home || match.awayScore !== prevScore.away) &&
      prevScore.home !== null // Don't animate on initial load
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGoalAnimation(true);
      const timer = setTimeout(() => setShowGoalAnimation(false), 2000);
      setPrevScore({ home: match.homeScore, away: match.awayScore });
      return () => clearTimeout(timer);
    }
    setPrevScore({ home: match.homeScore, away: match.awayScore });
  }, [match.homeScore, match.awayScore, isLive, prevScore.home, prevScore.away]);

  return (
    <Link href={`/matches/${match.id}`}>
      <div 
        className={cn(
          "group relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200",
          "hover:bg-card/80 hover:border-border",
          isLive && "border-red-500/50 ring-1 ring-red-500/20",
          showGoalAnimation && "animate-goal-flash"
        )}
      >
        {/* Live indicator bar */}
        {isLive && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
        )}
        
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xs font-medium text-muted-foreground truncate">
              {match.competition.name}
            </span>
            {match.round && (
              <>
                <span className="text-muted-foreground/30 flex-shrink-0">·</span>
                <span className="text-xs text-muted-foreground/60 truncate">{match.round}</span>
              </>
            )}
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {/* Upset Badge (for finished matches) */}
            {isFinished && match.isUpset && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400">
                UPSET
              </span>
            )}
            <span className={cn(
              "flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold",
              isLive && "bg-red-500 text-white animate-pulse",
              match.status === 'scheduled' && "bg-primary text-white",
              isFinished && "bg-muted text-muted-foreground"
            )}>
              {isLive 
                ? (match.matchMinute || 'LIVE')
                : isFinished 
                  ? 'FT' 
                  : format(kickoff, 'HH:mm')}
            </span>
          </div>
        </div>

        {/* Match Content */}
        <div className="p-4">
          {/* Teams and Score - Stacked Layout */}
          <div className="flex items-center justify-between gap-3">
            {/* Home Team */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden relative">
                  {match.homeTeamLogo ? (
                    <Image
                      src={match.homeTeamLogo}
                      alt={match.homeTeam}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {match.homeTeam.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  {/* Favorite star indicator */}
                  {homeFavorite && !isFinished && (
                    <Star className="absolute -top-1 -right-1 h-3 w-3 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p 
                    className={cn(
                      "font-medium text-sm leading-tight line-clamp-2",
                      isFinished && match.homeScore !== null && match.awayScore !== null &&
                      match.homeScore > match.awayScore && "text-green-400"
                    )}
                    title={match.homeTeam}
                  >
                    {match.homeTeam}
                  </p>
                  {/* Injuries indicator */}
                  {analysis?.homeInjuriesCount && analysis.homeInjuriesCount > 0 && !isFinished && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {analysis.homeInjuriesCount} out
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Score / VS */}
            <div className="flex-shrink-0 text-center px-2">
              {isFinished || isLive ? (
                <div className="flex items-center justify-center gap-1.5">
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && "text-green-400"
                  )}>
                    {match.homeScore}
                  </span>
                  <span className="text-muted-foreground text-lg">-</span>
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && "text-green-400"
                  )}>
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">vs</span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-end">
                <div className="min-w-0 flex-1 text-right">
                  <p 
                    className={cn(
                      "font-medium text-sm leading-tight line-clamp-2",
                      isFinished && match.homeScore !== null && match.awayScore !== null &&
                      match.awayScore > match.homeScore && "text-green-400"
                    )}
                    title={match.awayTeam}
                  >
                    {match.awayTeam}
                  </p>
                  {/* Injuries indicator */}
                  {analysis?.awayInjuriesCount && analysis.awayInjuriesCount > 0 && !isFinished && (
                    <p className="text-xs text-red-400 flex items-center gap-1 justify-end mt-0.5">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {analysis.awayInjuriesCount} out
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden relative">
                  {match.awayTeamLogo ? (
                    <Image
                      src={match.awayTeamLogo}
                      alt={match.awayTeam}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {match.awayTeam.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  {/* Favorite star indicator */}
                  {awayFavorite && !isFinished && (
                    <Star className="absolute -top-1 -left-1 h-3 w-3 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Odds row (for upcoming matches with analysis) */}
          {analysis?.oddsHome && analysis?.oddsDraw && analysis?.oddsAway && !isFinished && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              <span className="text-muted-foreground">Odds:</span>
              <span className={cn(
                "font-mono px-1.5 py-0.5 rounded",
                homeFavorite && "bg-primary/10 text-primary"
              )}>
                {analysis.oddsHome}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="font-mono px-1.5 py-0.5 rounded">
                {analysis.oddsDraw}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className={cn(
                "font-mono px-1.5 py-0.5 rounded",
                awayFavorite && "bg-primary/10 text-primary"
              )}>
                {analysis.oddsAway}
              </span>
            </div>
          )}

          {/* Quota display (for finished matches with quotas) */}
          {isFinished && match.quotaHome && match.quotaDraw && match.quotaAway && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              <span className="text-muted-foreground">Quota:</span>
              <span className={cn(
                "font-mono px-1.5 py-0.5 rounded",
                match.homeScore !== null && match.awayScore !== null && 
                match.homeScore > match.awayScore && "bg-green-500/20 text-green-400"
              )}>
                H:{match.quotaHome}
              </span>
              <span className={cn(
                "font-mono px-1.5 py-0.5 rounded",
                match.homeScore !== null && match.awayScore !== null && 
                match.homeScore === match.awayScore && "bg-green-500/20 text-green-400"
              )}>
                D:{match.quotaDraw}
              </span>
              <span className={cn(
                "font-mono px-1.5 py-0.5 rounded",
                match.homeScore !== null && match.awayScore !== null && 
                match.awayScore > match.homeScore && "bg-green-500/20 text-green-400"
              )}>
                A:{match.quotaAway}
              </span>
            </div>
          )}

          {/* Time info */}
          <div className="mt-3 text-center">
            <MatchTime 
              dateString={match.kickoffTime} 
              isUpcoming={isUpcoming}
              className="text-xs text-muted-foreground"
            />
          </div>

          {/* Predictions preview */}
          {showPredictions && predictions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">AI:</span>
                {predictions.slice(0, 4).map((pred, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-mono",
                      pred.points === 3 && "bg-green-500/20 text-green-400",
                      pred.points === 1 && "bg-yellow-500/20 text-yellow-400",
                      pred.points === 0 && "bg-muted/50 text-muted-foreground",
                      pred.points === undefined && "bg-primary/10 text-primary"
                    )}
                  >
                    {pred.predictedHomeScore}-{pred.predictedAwayScore}
                  </span>
                ))}
                {predictions.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{predictions.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Venue */}
          {match.venue && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/60">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{match.venue}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
