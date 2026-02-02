/**
 * RoundupViewer Component
 * 
 * Displays complete match roundup content including:
 * - Scoreboard header
 * - Match events timeline
 * - Statistics grid
 * - Model predictions table (HTML)
 * - Top performers list
 * - Full narrative content (HTML)
 * - Keywords for SEO
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Trophy, Clock, MapPin, Target, TrendingUp, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface Scoreboard {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  venue?: string;
  kickoff?: string;
}

interface Event {
  minute: number;
  type: string;
  description: string;
}

interface Stats {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  xG?: number;
  [key: string]: number | undefined;
}

interface TopPerformer {
  modelName: string;
  prediction: string;
  points: number;
}

interface RoundupViewerProps {
  title: string;
  scoreboard: Scoreboard;
  events: Event[];
  stats: Stats;
  modelPredictions: string; // HTML table string
  topPerformers: TopPerformer[];
  narrative: string; // HTML content
  keywords: string[];
  className?: string;
}

export function RoundupViewer({
  title,
  scoreboard,
  events,
  stats,
  modelPredictions,
  topPerformers,
  narrative,
  keywords,
  className,
}: RoundupViewerProps) {
  const isFinished = scoreboard.homeScore !== undefined && scoreboard.awayScore !== undefined;
  
  return (
    <div className={cn("space-y-8", className)}>
      {/* SEO Keywords (hidden visually, for metadata) */}
      {keywords.length > 0 && (
        <div className="sr-only" aria-hidden="true">
          {keywords.join(', ')}
        </div>
      )}
      
      {/* Title Section */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>
        {keywords.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Keywords: {keywords.join(', ')}
          </p>
        )}
      </div>
      
      {/* Scoreboard Header */}
      <Card className="bg-card/80 border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{scoreboard.competition}</span>
            </div>
            {isFinished && (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
                Full Time
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-4 md:gap-8">
            {/* Home Team */}
            <div className="flex-1 text-center">
              <div className="h-16 w-16 md:h-20 md:w-20 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-bold text-muted-foreground">
                  {scoreboard.homeTeam.charAt(0)}
                </span>
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && scoreboard.homeScore > scoreboard.awayScore && "text-green-400"
              )}>
                {scoreboard.homeTeam}
              </p>
            </div>
            
            {/* Score */}
            <div className="text-center px-4">
              {isFinished ? (
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-4xl md:text-5xl font-bold tabular-nums",
                    scoreboard.homeScore > scoreboard.awayScore && "text-green-400"
                  )}>
                    {scoreboard.homeScore}
                  </span>
                  <span className="text-2xl text-muted-foreground">-</span>
                  <span className={cn(
                    "text-4xl md:text-5xl font-bold tabular-nums",
                    scoreboard.awayScore > scoreboard.homeScore && "text-green-400"
                  )}>
                    {scoreboard.awayScore}
                  </span>
                </div>
              ) : (
                <p className="text-3xl md:text-4xl font-bold gradient-text">VS</p>
              )}
            </div>
            
            {/* Away Team */}
            <div className="flex-1 text-center">
              <div className="h-16 w-16 md:h-20 md:w-20 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-bold text-muted-foreground">
                  {scoreboard.awayTeam.charAt(0)}
                </span>
              </div>
              <p className={cn(
                "font-bold text-lg md:text-xl",
                isFinished && scoreboard.awayScore > scoreboard.homeScore && "text-green-400"
              )}>
                {scoreboard.awayTeam}
              </p>
            </div>
          </div>
          
          {/* Venue & Time */}
          {(scoreboard.venue || scoreboard.kickoff) && (
            <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t border-border/50 text-sm text-muted-foreground">
              {scoreboard.kickoff && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{format(parseISO(scoreboard.kickoff), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
              {scoreboard.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{scoreboard.venue}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Events Timeline */}
      {events.length > 0 && (
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Match Events
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events
                .sort((a, b) => a.minute - b.minute)
                .map((event, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg",
                      event.type === 'goal' && "bg-green-500/10",
                      event.type === 'yellow_card' && "bg-yellow-500/10",
                      event.type === 'red_card' && "bg-red-500/10",
                      event.type === 'substitution' && "bg-blue-500/10",
                      "border border-border/50"
                    )}
                  >
                    <span className={cn(
                      "w-12 text-sm font-mono font-semibold",
                      event.type === 'goal' && "text-green-400",
                      event.type === 'yellow_card' && "text-yellow-400",
                      event.type === 'red_card' && "text-red-400"
                    )}>
                      {event.minute}&apos;
                    </span>
                    <span className="flex-1">{event.description}</span>
                    <span className="text-xs text-muted-foreground uppercase">{event.type}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Stats Grid */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Match Statistics
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Possession */}
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">Possession</p>
              <p className="text-2xl font-bold">{stats.possession ?? '-'}%</p>
            </div>

            {/* Shots */}
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">Shots</p>
              <p className="text-2xl font-bold">{stats.shots ?? '-'}</p>
            </div>

            {/* Shots on Target */}
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">On Target</p>
              <p className="text-2xl font-bold">{stats.shotsOnTarget ?? '-'}</p>
            </div>

            {/* Corners */}
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">Corners</p>
              <p className="text-2xl font-bold">{stats.corners ?? '-'}</p>
            </div>

            {/* xG */}
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">xG</p>
              <p className="text-2xl font-bold">{stats.xG?.toFixed(2) ?? '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Model Predictions Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Model Predictions
          </h2>
        </CardHeader>
        <CardContent>
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: modelPredictions }}
          />
        </CardContent>
      </Card>
      
      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card className="bg-card/80 border-border/60">
          <CardHeader>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Top Performers
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    index === 0 && "bg-yellow-500/10 border border-yellow-500/30",
                    index === 1 && "bg-gray-500/10 border border-gray-500/30",
                    index === 2 && "bg-orange-500/10 border border-orange-500/30",
                    "border border-border/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {index < 3 && (
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        index === 0 && "bg-yellow-500 text-black",
                        index === 1 && "bg-gray-400 text-black",
                        index === 2 && "bg-orange-500 text-black"
                      )}>
                        {index + 1}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold">{performer.modelName}</p>
                      <p className="text-sm text-muted-foreground">
                        Predicted: {performer.prediction}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {performer.points} pts
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Narrative Content */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Match Analysis
          </h2>
        </CardHeader>
        <CardContent>
          <div 
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: narrative }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
