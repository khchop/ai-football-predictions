/**
 * Match Content Section Component
 * 
 * Displays 3-section narrative content for match pages:
 * 1. Pre-match (~150-200 words) - market expectations
 * 2. Betting (~150-200 words) - AI predictions
 * 3. Post-match (~150-200 words) - results & performance
 * 
 * Shows nothing if content is not available (progressive generation).
 */

import { getMatchContent } from '@/lib/content/queries';
import { Card, CardContent } from '@/components/ui/card';

interface MatchContentSectionProps {
  matchId: string;
}

export async function MatchContentSection({ matchId }: MatchContentSectionProps) {
  const content = await getMatchContent(matchId);

  // Show nothing if no content exists
  if (!content || (!content.preMatchContent && !content.bettingContent && !content.postMatchContent)) {
    return null;
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6 space-y-8">
        {/* Pre-match section */}
        {content.preMatchContent && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Market Expectations
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.preMatchContent}
            </p>
            {content.preMatchGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated {new Date(content.preMatchGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Divider */}
        {content.preMatchContent && (content.bettingContent || content.postMatchContent) && (
          <div className="border-t border-border/30" />
        )}

        {/* Betting section */}
        {content.bettingContent && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              AI Model Predictions
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.bettingContent}
            </p>
            {content.bettingGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated {new Date(content.bettingGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Divider */}
        {(content.preMatchContent || content.bettingContent) && content.postMatchContent && (
          <div className="border-t border-border/30" />
        )}

        {/* Post-match section */}
        {content.postMatchContent && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Match Report
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.postMatchContent}
            </p>
            {content.postMatchGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated {new Date(content.postMatchGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
