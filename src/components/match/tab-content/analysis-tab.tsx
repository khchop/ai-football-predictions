import { Card, CardContent } from '@/components/ui/card';
import { MatchContentSection } from '@/components/match/MatchContent';
import { TopPerformers, type TopPerformer } from '@/components/match/top-performers';
import { BookOpen } from 'lucide-react';

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
              <TopPerformers topPerformers={roundup.topPerformers} />
            </CardContent>
          </Card>
        )}
    </div>
  );
}
