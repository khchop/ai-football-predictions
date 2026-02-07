'use client';

import { useMatch } from './use-match';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface PreviewData {
  introduction: string;
  teamFormAnalysis: string;
  headToHead: string | null;
  keyPlayers: string | null;
  tacticalAnalysis: string | null;
  prediction: string;
  bettingInsights: string | null;
}

interface NarrativeContent {
  preMatchContent: string | null;
  postMatchContent: string | null;
  preview: PreviewData | null;
}

/**
 * MatchNarrative - State-aware narrative display component.
 *
 * Displays pre-match or post-match narrative based on match state from context:
 * - Upcoming: Shows structured preview content (form analysis, H2H, key players, etc.)
 * - Live: Shows structured preview content (keep preview visible)
 * - Finished: Shows postMatchContent with "Match Report" heading
 *
 * Falls back to preMatchContent plain text if no preview data is available.
 * If no narrative content is available, displays a placeholder message.
 */
export function MatchNarrative() {
  const { match, matchState } = useMatch();
  const [content, setContent] = useState<NarrativeContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch(`/api/matches/${match.id}/content`);
        if (res.ok) {
          const data = await res.json();
          setContent(data);
        }
      } catch (err) {
        console.error('Failed to fetch narrative:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [match.id]);

  const isFinished = matchState === 'finished';

  // Loading state with skeleton
  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Finished matches: show post-match content
  if (isFinished) {
    const postContent = content?.postMatchContent;
    if (!postContent) {
      return (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Match Report
            </h2>
            <p className="text-muted-foreground italic">
              Match report is being generated.
            </p>
          </CardContent>
        </Card>
      );
    }

    const isHtml = /<[a-z][\s\S]*>/i.test(postContent);
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Match Report
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: postContent }} />
            ) : (
              postContent
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upcoming/Live matches: prefer structured preview over plain preMatchContent
  const preview = content?.preview;
  if (preview) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Match Preview
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p>{preview.introduction}</p>

            <h3>Team Form</h3>
            <p>{preview.teamFormAnalysis}</p>

            {preview.headToHead && (
              <>
                <h3>Head to Head</h3>
                <p>{preview.headToHead}</p>
              </>
            )}

            {preview.keyPlayers && (
              <>
                <h3>Key Players</h3>
                <p>{preview.keyPlayers}</p>
              </>
            )}

            {preview.tacticalAnalysis && (
              <>
                <h3>Tactical Analysis</h3>
                <p>{preview.tacticalAnalysis}</p>
              </>
            )}

            <h3>Prediction</h3>
            <p>{preview.prediction}</p>

            {preview.bettingInsights && (
              <>
                <h3>Betting Insights</h3>
                <p>{preview.bettingInsights}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback: plain preMatchContent text
  const preContent = content?.preMatchContent;
  if (!preContent) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Match Preview
          </h2>
          <p className="text-muted-foreground italic">
            Analysis pending - check back closer to kickoff.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Match Preview
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {preContent}
        </div>
      </CardContent>
    </Card>
  );
}
