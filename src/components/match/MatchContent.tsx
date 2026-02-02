/**
 * Match Content Section Component
 *
 * Displays 3-section narrative content for match pages:
 * 1. Pre-match (~150-200 words) - market expectations (scheduled only)
 * 2. Betting (~150-200 words) - AI predictions (live/finished)
 * 3. Post-match (~150-200 words) - results & performance (finished only)
 *
 * Content visibility is determined by match status:
 * - scheduled: pre-match only
 * - live: betting only
 * - finished: betting + post-match
 *
 * Shows nothing if no applicable content exists for the current match state.
 */

import { getMatchContent } from '@/lib/content/queries';
import { Card, CardContent } from '@/components/ui/card';
import { ReadMoreText } from '@/components/match/ReadMoreText';

interface MatchContentSectionProps {
  matchId: string;
  matchStatus: 'scheduled' | 'live' | 'finished' | string | null;
}

export async function MatchContentSection({
  matchId,
  matchStatus,
}: MatchContentSectionProps) {
  const content = await getMatchContent(matchId);

  // Hide entire section if no content exists
  if (!content) {
    return null;
  }

  // Normalize match status (null defaults to 'scheduled' behavior)
  const status = matchStatus ?? 'scheduled';

  // Determine which sections to show based on match status
  const showPreMatch = status === 'scheduled' && !!content.preMatchContent;
  const showBetting =
    (status === 'live' || status === 'finished') && !!content.bettingContent;
  const showPostMatch = status === 'finished' && !!content.postMatchContent;

  // Hide if no applicable content for this match state
  if (!showPreMatch && !showBetting && !showPostMatch) {
    return null;
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6 space-y-8">
        {/* Pre-match section (scheduled only) */}
        {showPreMatch && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Market Expectations
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.preMatchContent}
            </p>
            {content.preMatchGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated{' '}
                {new Date(content.preMatchGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Divider between pre-match and betting/post-match */}
        {showPreMatch && (showBetting || showPostMatch) && (
          <div className="border-t border-border/30" />
        )}

        {/* Betting section (live/finished) */}
        {showBetting && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              AI Model Predictions
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.bettingContent}
            </p>
            {content.bettingGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated{' '}
                {new Date(content.bettingGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Divider between betting and post-match */}
        {showBetting && showPostMatch && (
          <div className="border-t border-border/30" />
        )}

        {/* Post-match section (finished only) - with Read More for long content */}
        {showPostMatch && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Match Report
            </h3>
            <ReadMoreText
              text={content.postMatchContent!}
              previewLines={6}
              className="text-sm md:text-base"
            />
            {content.postMatchGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated{' '}
                {new Date(content.postMatchGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
