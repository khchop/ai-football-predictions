/**
 * Team Content Generation Worker
 *
 * Generates AI-powered content for team pages (analysis + FAQs).
 * Uses DeepSeek V3.1 via OpenRouter with anti-hallucination prompts.
 *
 * Rate limiting: 15 jobs/min (2 API calls per team = 30 req/min, under OpenRouter's limit)
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, getWorkerLockDuration } from '../index';
import { generateTeamAnalysis, generateTeamFAQs } from '@/lib/content/team-content';
import { TEAMS } from '@/lib/football/teams';
import { loggers } from '@/lib/logger/modules';
import {
  recordQueueRateLimitError,
  recordQueueSuccess,
} from '../circuit-breaker/queue-circuit-breaker';

interface TeamContentPayload {
  type: 'generate_team_content' | 'refresh_all_teams';
  data?: {
    teamName?: string;
  };
}

export function createTeamContentWorker() {
  return new Worker<TeamContentPayload>(
    QUEUE_NAMES.TEAM_CONTENT,
    async (job: Job<TeamContentPayload>) => {
      const { type, data } = job.data;
      const log = loggers.contentWorker.child({ jobId: job.id, jobName: job.name, type });

      // Setup heartbeat to extend lock for long-running jobs
      const heartbeatInterval = setInterval(async () => {
        try {
          if (job.token) {
            await job.extendLock(job.token, 30000);
            log.debug({ jobId: job.id }, 'Extended job lock');
          }
        } catch (err) {
          log.warn({ jobId: job.id, err }, 'Lock extension failed');
        }
      }, 30000); // Every 30s (well before lock expiry)

      try {
        log.info(`Processing team content job: ${type}`);

        // Execute job and track success
        const result = await (async () => {
          if (type === 'generate_team_content') {
            const teamName = data?.teamName;
            if (!teamName) {
              throw new Error('teamName is required for generate_team_content job');
            }

            log.info({ teamName }, 'Generating team content');

            // Generate analysis (independent of FAQs)
            let analysisSuccess = false;
            try {
              await generateTeamAnalysis(teamName);
              analysisSuccess = true;
              log.info({ teamName }, 'Team analysis generated');
            } catch (err) {
              log.error({ teamName, err }, 'Team analysis generation failed');
              // Continue to FAQs even if analysis fails
            }

            // Generate FAQs (independent of analysis)
            let faqsSuccess = false;
            try {
              await generateTeamFAQs(teamName);
              faqsSuccess = true;
              log.info({ teamName }, 'Team FAQs generated');
            } catch (err) {
              log.error({ teamName, err }, 'Team FAQs generation failed');
            }

            // At least one must succeed for job to be successful
            if (!analysisSuccess && !faqsSuccess) {
              throw new Error(`Both analysis and FAQs failed for team ${teamName}`);
            }

            return {
              success: true,
              teamName,
              analysisGenerated: analysisSuccess,
              faqsGenerated: faqsSuccess,
            };
          } else if (type === 'refresh_all_teams') {
            log.info({ teamCount: TEAMS.length }, 'Refreshing all teams');

            // Queue each team for generation with staggered delays
            const { teamContentQueue } = await import('../index');

            let queuedCount = 0;
            let failedCount = 0;
            const failedTeams: Array<{ teamId: string; error: string }> = [];

            for (let i = 0; i < TEAMS.length; i++) {
              const team = TEAMS[i];

              try {
                await teamContentQueue.add(
                  'generate_team_content',
                  {
                    type: 'generate_team_content',
                    data: { teamName: team.id },
                  },
                  {
                    jobId: `team-content-${team.id}-${Date.now()}`, // Unique ID per refresh cycle
                    delay: i * 4000, // Stagger: 4s between teams (15 teams/min)
                    attempts: 3,
                    backoff: {
                      type: 'exponential',
                      delay: 60000, // 1m, 2m, 4m
                    },
                  }
                );
                queuedCount++;
                log.debug({ teamId: team.id, delay: i * 4000 }, 'Queued team content generation');
              } catch (error: any) {
                failedCount++;
                failedTeams.push({
                  teamId: team.id,
                  error: error.message || String(error),
                });
                log.error({ teamId: team.id, err: error }, 'Failed to queue team');
              }
            }

            log.info({ total: TEAMS.length, queued: queuedCount, failed: failedCount }, 'Team refresh complete');

            // If ALL teams failed to queue, throw to trigger retry
            if (failedCount > 0 && queuedCount === 0) {
              throw new Error(`All ${failedCount} teams failed to queue for content generation`);
            }

            return {
              success: true,
              total: TEAMS.length,
              queued: queuedCount,
              failed: failedCount,
              partialSuccess: failedCount > 0 && queuedCount > 0,
              failedTeams: failedTeams.slice(0, 10), // Cap to prevent huge payloads
            };
          } else {
            throw new Error(`Unknown team content job type: ${type}`);
          }
        })();

        // Record successful job completion to reset rate limit counter
        recordQueueSuccess(QUEUE_NAMES.TEAM_CONTENT);

        return result;
      } catch (error) {
        log.error({ err: error }, `Error processing team content job: ${type}`);

        // Check if this is a rate limit error and notify circuit breaker
        if (
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.toLowerCase().includes('rate limit'))
        ) {
          await recordQueueRateLimitError(QUEUE_NAMES.TEAM_CONTENT);
        }

        Sentry.captureException(error, {
          level: 'error',
          tags: {
            worker: 'team-content',
            job_type: type,
          },
          extra: {
            jobId: job.id,
            data,
          },
        });
        throw error;
      } finally {
        clearInterval(heartbeatInterval);
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Serial processing to respect rate limits
      limiter: {
        max: 15, // Max 15 jobs per minute (30 API calls = under OpenRouter's 20 req/min with margin)
        duration: 60000, // Per minute
      },
      lockDuration: getWorkerLockDuration(QUEUE_NAMES.TEAM_CONTENT), // 3 minutes
      stalledInterval: 30000, // Check for stalled jobs every 30s
      maxStalledCount: 1, // Fail after 1 stall detection
    }
  );
}
