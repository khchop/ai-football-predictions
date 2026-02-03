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
    slug?: string | null;
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
      slug?: string | null;
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

  // Determine URL - prefer slug-based URL if available
  const matchUrl = match.slug && match.competition.id
    ? `/leagues/${match.competition.id}/${match.slug}`
    : `/matches/${match.id}`;

  return (
    <Link
      href={matchUrl}
      className={cn(
        "group block relative rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 cursor-pointer",
        "hover:bg-card/80 hover:border-border",
        isLive && "border-red-500/50 ring-1 ring-red-500/20",
        showGoalAnimation && "animate-goal-flash"
      )}
    >
        {/* Live indicator bar */}
        {isLive && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
        )}
        
        {/* Compact Header */}
        <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              {match.competition.name}
            </span>
            {match.round && (
              <>
                <span className="text-muted-foreground/30 flex-shrink-0">·</span>
                <span className="text-[11px] text-muted-foreground/60 truncate">{match.round}</span>
              </>
            )}
          </div>
          
          {/* Compact Status Badge */}
          <div className="flex items-center gap-1.5">
            {/* Upset Badge (for finished matches) */}
            {isFinished && match.isUpset && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400">
                UPSET
              </span>
            )}
            <span className={cn(
              "flex-shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold",
              isLive && "bg-red-500 text-white animate-pulse",
              match.status === 'scheduled' && "bg-primary text-primary-foreground",
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

        {/* Compact Match Content */}
        <div className="px-3 py-2">
          {/* Compact Teams and Score - Single Line Layout */}
          <div className="flex items-center justify-between gap-2">
            {/* Home Team - Compact */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex-shrink-0 h-6 w-6 rounded bg-muted/50 flex items-center justify-center overflow-hidden relative">
                {match.homeTeamLogo ? (
                  <Image
                    src={match.homeTeamLogo}
                    alt={`${match.homeTeam} team logo`}
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {match.homeTeam.substring(0, 2).toUpperCase()}
                  </span>
                )}
                {/* Compact Favorite star */}
                {homeFavorite && !isFinished && (
                  <Star className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p 
                  className={cn(
                    "font-medium text-[13px] leading-tight truncate",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && "text-green-400"
                  )}
                  title={match.homeTeam}
                >
                  {match.homeTeam}
                </p>
              </div>
              {/* Compact Injuries indicator */}
              {analysis?.homeInjuriesCount && analysis.homeInjuriesCount > 0 && !isFinished && (
                <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
              )}
            </div>

            {/* Compact Score / VS */}
            <div className="flex-shrink-0 px-2">
              {isFinished || isLive ? (
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-lg font-bold tabular-nums leading-none",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.homeScore > match.awayScore && "text-green-400"
                  )}>
                    {match.homeScore}
                  </span>
                  <span className="text-muted-foreground text-sm leading-none">-</span>
                  <span className={cn(
                    "text-lg font-bold tabular-nums leading-none",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && "text-green-400"
                  )}>
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">vs</span>
              )}
            </div>

            {/* Away Team - Compact */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              {/* Compact Injuries indicator */}
              {analysis?.awayInjuriesCount && analysis.awayInjuriesCount > 0 && !isFinished && (
                <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1 text-right">
                <p 
                  className={cn(
                    "font-medium text-[13px] leading-tight truncate",
                    isFinished && match.homeScore !== null && match.awayScore !== null &&
                    match.awayScore > match.homeScore && "text-green-400"
                  )}
                  title={match.awayTeam}
                >
                  {match.awayTeam}
                </p>
              </div>
              <div className="flex-shrink-0 h-6 w-6 rounded bg-muted/50 flex items-center justify-center overflow-hidden relative">
                {match.awayTeamLogo ? (
                  <Image
                    src={match.awayTeamLogo}
                    alt={`${match.awayTeam} team logo`}
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {match.awayTeam.substring(0, 2).toUpperCase()}
                  </span>
                )}
                {/* Compact Favorite star */}
                {awayFavorite && !isFinished && (
                  <Star className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                )}
              </div>
            </div>
          </div>

          {/* Compact Metadata Row - Odds/Quota + Time */}
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
            {/* Left: Odds or Quota */}
            <div className="flex items-center gap-1.5 min-w-0">
              {analysis?.oddsHome && analysis?.oddsDraw && analysis?.oddsAway && !isFinished ? (
                <>
                  <span className="text-muted-foreground/60 flex-shrink-0">Odds:</span>
                  <span className={cn(
                    "font-mono px-1 py-0.5 rounded text-[10px]",
                    homeFavorite && "bg-primary/10 text-primary"
                  )}>
                    {analysis.oddsHome}
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="font-mono px-1 py-0.5 rounded text-[10px]">
                    {analysis.oddsDraw}
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                  <span className={cn(
                    "font-mono px-1 py-0.5 rounded text-[10px]",
                    awayFavorite && "bg-primary/10 text-primary"
                  )}>
                    {analysis.oddsAway}
                  </span>
                </>
              ) : match.quotaHome && match.quotaDraw && match.quotaAway ? (
                <>
                  <span className={cn(
                    "font-mono px-1 py-0.5 rounded text-[10px]",
                    match.homeScore !== null && match.awayScore !== null && 
                    match.homeScore > match.awayScore && "bg-green-500/20 text-green-400"
                  )}>
                    H:{match.quotaHome}
                  </span>
                  <span className={cn(
                    "font-mono px-1 py-0.5 rounded text-[10px]",
                    match.homeScore !== null && match.awayScore !== null && 
                    match.homeScore === match.awayScore && "bg-green-500/20 text-green-400"
                  )}>
                    D:{match.quotaDraw}
                  </span>
                  <span className={cn(
                    "font-mono px-1 py-0.5 rounded text-[10px]",
                    match.homeScore !== null && match.awayScore !== null && 
                    match.awayScore > match.homeScore && "bg-green-500/20 text-green-400"
                  )}>
                    A:{match.quotaAway}
                  </span>
                </>
              ) : match.venue ? (
                <div className="flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-muted-foreground/60">{match.venue}</span>
                </div>
              ) : null}
            </div>

            {/* Right: Time */}
            <MatchTime 
              dateString={match.kickoffTime} 
              isUpcoming={isUpcoming}
              className="text-[11px] text-muted-foreground/60 flex-shrink-0"
            />
          </div>

          {/* Compact Predictions preview */}
          {showPredictions && predictions.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-border/20">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground/60">AI:</span>
                {predictions.slice(0, 3).map((pred, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      "px-1 py-0.5 rounded text-[10px] font-mono",
                      pred.points === 3 && "bg-green-500/20 text-green-400",
                      pred.points === 1 && "bg-yellow-500/20 text-yellow-400",
                      pred.points === 0 && "bg-muted/50 text-muted-foreground",
                      pred.points === undefined && "bg-primary/10 text-primary"
                    )}
                  >
                    {pred.predictedHomeScore}-{pred.predictedAwayScore}
                  </span>
                ))}
                {predictions.length > 3 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    +{predictions.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
    </Link>
  );
}
