/**
 * Content Completeness Monitoring
 *
 * Checks for finished matches missing content and alerts via Sentry.
 * Helps detect content generation gaps before users notice.
 */

import * as Sentry from '@sentry/nextjs';
import { loggers } from '@/lib/logger/modules';
import { getMatchesMissingPostMatchContent } from '@/lib/content/queries';

export interface ContentCompletenessResult {
  finishedMatchesWithoutContent: number;
  matchIds: string[];
  alertTriggered: boolean;
  checkTime: number;
}

/**
 * Check content completeness for finished matches
 *
 * Alerts when finished matches have scored predictions but no post-match content.
 * Uses existing getMatchesMissingPostMatchContent() which filters to matches
 * finished within the last N days that have predictions but lack content.
 *
 * @returns ContentCompletenessResult with match counts and alert status
 */
export async function checkContentCompleteness(): Promise<ContentCompletenessResult> {
  const log = loggers.content;
  const now = Date.now();

  try {
    // Get matches finished in last 7 days without post-match content
    // The query already handles the time window and filters by prediction status
    const missingContent = await getMatchesMissingPostMatchContent(7);

    // Alert if any matches are missing content
    // Note: In future, could add 24h grace period by checking match finish time
    const shouldAlert = missingContent.length > 0;

    if (shouldAlert) {
      log.warn(
        {
          count: missingContent.length,
          matchIds: missingContent.slice(0, 10).map((m) => m.matchId),
        },
        'Finished matches missing content detected'
      );

      Sentry.captureMessage(
        `${missingContent.length} finished matches have no post-match content`,
        {
          level: 'warning',
          tags: { feature: 'content-completeness' },
          extra: {
            matchCount: missingContent.length,
            sampleMatches: missingContent.slice(0, 5).map((m) => ({
              matchId: m.matchId,
              teams: `${m.homeTeam} vs ${m.awayTeam}`,
            })),
          },
        }
      );
    } else {
      log.debug({ matchCount: missingContent.length }, 'Content completeness check passed');
    }

    return {
      finishedMatchesWithoutContent: missingContent.length,
      matchIds: missingContent.map((m) => m.matchId),
      alertTriggered: shouldAlert,
      checkTime: now,
    };
  } catch (error) {
    log.error({ err: error }, 'Failed to check content completeness');
    throw error;
  }
}
