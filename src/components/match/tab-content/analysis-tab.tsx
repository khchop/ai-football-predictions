import { Card, CardContent } from '@/components/ui/card';
import { MatchContentSection } from '@/components/match/MatchContent';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface RoundupData {
  title: string;
  narrative: string;
  events?: Event[];
  stats?: Stats;
  topPerformers?: TopPerformer[];
}

interface AnalysisTabProps {
  matchId: string;
  matchStatus: 'scheduled' | 'live' | 'finished' | string | null;
  roundup?: RoundupData | null;
}

export async function AnalysisTab({
  matchId,
  matchStatus,
  roundup,
}: AnalysisTabProps) {
  return (
    <div className="space-y-6">
      {/* AI-generated content narratives */}
      <MatchContentSection matchId={matchId} matchStatus={matchStatus} />

      {/* Roundup narrative (if available and match finished) */}
      {roundup && matchStatus === 'finished' && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <BookOpen className="h-5 w-5 text-primary" />
              {roundup.title}
            </h3>
            <div
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: roundup.narrative }}
            />
          </CardContent>
        </Card>
      )}

      {/* Top Performers (if roundup has them and match is finished) */}
      {roundup &&
        matchStatus === 'finished' &&
        roundup.topPerformers &&
        roundup.topPerformers.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">Top Performing Models</h3>
              <div className="space-y-3">
                {roundup.topPerformers.map((performer, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      index === 0 &&
                        'bg-yellow-500/10 border-yellow-500/30',
                      index === 1 && 'bg-gray-500/10 border-gray-500/30',
                      index === 2 &&
                        'bg-orange-500/10 border-orange-500/30',
                      index > 2 && 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {index < 3 && (
                        <span
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            index === 0 && 'bg-yellow-500 text-black',
                            index === 1 && 'bg-gray-400 text-black',
                            index === 2 && 'bg-orange-500 text-black'
                          )}
                        >
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
    </div>
  );
}
