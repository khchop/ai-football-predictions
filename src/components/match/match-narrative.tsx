'use client';

import { useMatch } from './use-match';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface NarrativeContent {
  preMatchContent: string | null;
  postMatchContent: string | null;
}

/**
 * MatchNarrative - State-aware narrative display component.
 *
 * Displays pre-match or post-match narrative based on match state from context:
 * - Upcoming: Shows preMatchContent with "Match Preview" heading
 * - Live: Shows preMatchContent with "Match Preview" heading (keep preview visible)
 * - Finished: Shows postMatchContent with "Match Report" heading
 *
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

  // Determine which content to show based on matchState
  // Live and upcoming both show pre-match content
  const isFinished = matchState === 'finished';
  const narrativeText = isFinished
    ? content?.postMatchContent
    : content?.preMatchContent;
  const heading = isFinished ? 'Match Report' : 'Match Preview';

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

  // Show placeholder if no narrative available
  if (!narrativeText) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {heading}
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
          {heading}
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {narrativeText}
        </div>
      </CardContent>
    </Card>
  );
}
