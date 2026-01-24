/**
 * Fixtures Worker
 * 
 * Fetches upcoming fixtures from API-Football and schedules jobs for new matches.
 * Runs every 6 hours via repeatable job.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { FetchFixturesPayload } from '../types';
import { getUpcomingFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { upsertMatch, upsertCompetition, getMatchByExternalId } from '@/lib/db/queries';
import { scheduleMatchJobs } from '../scheduler';
import { v4 as uuidv4 } from 'uuid';
import { generateMatchSlug, generateCompetitionSlug } from '@/lib/utils/slugify';
import { loggers } from '@/lib/logger/modules';

export function createFixturesWorker() {
  return new Worker<FetchFixturesPayload>(
    QUEUE_NAMES.FIXTURES,
    async (job: Job<FetchFixturesPayload>) => {
      const { manual = false } = job.data;
      const log = loggers.fixturesWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Starting fetch (manual: ${manual})...`);
      
      try {
        // Fetch fixtures for the next 36 hours
        const fixturesByCompetition = await getUpcomingFixtures(36);
        
        let totalFixtures = 0;
        let savedFixtures = 0;
        let jobsScheduled = 0;
        const errors: string[] = [];

        for (const { competition, fixtures } of fixturesByCompetition) {
          // Ensure competition exists in DB
          await upsertCompetition({
            id: competition.id,
            name: competition.name,
            apiFootballId: competition.apiFootballId,
            season: competition.season,
            active: true,
            slug: generateCompetitionSlug(competition.name),
          });

          for (const fixture of fixtures) {
            totalFixtures++;
            
            // Generate SEO-friendly slug before try block for error logging
            const slug = generateMatchSlug(
              fixture.teams.home.name,
              fixture.teams.away.name,
              fixture.fixture.date
            );
            
            try {
              const externalId = String(fixture.fixture.id);
              
              // Check if match already exists - use existing ID if so
              // This prevents UUID mismatch where jobs are scheduled with non-existent IDs
              const existingMatch = await getMatchByExternalId(externalId);
              const matchId = existingMatch?.id || uuidv4();
              const isNewMatch = !existingMatch;
              
              // Save match to DB
              await upsertMatch({
                id: matchId,
                externalId,
                competitionId: competition.id,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                homeTeamLogo: fixture.teams.home.logo,
                awayTeamLogo: fixture.teams.away.logo,
                kickoffTime: fixture.fixture.date,
                homeScore: fixture.goals.home,
                awayScore: fixture.goals.away,
                status: mapFixtureStatus(fixture.fixture.status.short),
                round: fixture.league.round,
                venue: fixture.fixture.venue.name,
                slug,
              });
              
              savedFixtures++;
              
              // Debug logging for successful save
              log.debug({ 
                fixtureId: fixture.fixture.id,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                matchId,
                slug,
                isNewMatch,
              }, 'Saved fixture');
              
              // Schedule jobs for NEW scheduled matches only
              // (existing matches already have jobs scheduled from previous sync)
              if (isNewMatch && mapFixtureStatus(fixture.fixture.status.short) === 'scheduled') {
                const scheduled = await scheduleMatchJobs({
                  match: {
                    id: matchId,
                    externalId,
                    competitionId: competition.id,
                    homeTeam: fixture.teams.home.name,
                    awayTeam: fixture.teams.away.name,
                    homeTeamLogo: fixture.teams.home.logo,
                    awayTeamLogo: fixture.teams.away.logo,
                    kickoffTime: fixture.fixture.date,
                    homeScore: fixture.goals.home,
                    awayScore: fixture.goals.away,
                    status: mapFixtureStatus(fixture.fixture.status.short),
                    round: fixture.league.round,
                    venue: fixture.fixture.venue.name,
                    slug,
                    matchMinute: null,
                    isUpset: false,
                    quotaHome: null,
                    quotaDraw: null,
                    quotaAway: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  competition: {
                    id: competition.id,
                    name: competition.name,
                    apiFootballId: competition.apiFootballId,
                    season: competition.season,
                    active: true,
                    slug: generateCompetitionSlug(competition.name),
                    createdAt: null,
                  },
                });
                
                jobsScheduled += scheduled;
                log.debug({ matchId, jobsScheduled: scheduled }, 'Scheduled jobs for new match');
              } else if (!isNewMatch) {
                log.debug({ matchId, externalId }, 'Skipped job scheduling for existing match');
              }
             } catch (error: any) {
                const errorContext = {
                  fixtureId: fixture.fixture.id,
                  externalId: String(fixture.fixture.id),
                  competitionId: competition.apiFootballId,
                  competitionName: competition.name,
                  homeTeam: fixture.teams.home.name,
                  awayTeam: fixture.teams.away.name,
                  kickoffTime: fixture.fixture.date,
                  apiStatus: fixture.fixture.status.short,
                  slug,
                  // Database error details
                  errorCode: error.code,
                  errorConstraint: error.constraint,
                  errorDetail: error.detail,
                  errorTable: error.table,
                  errorColumn: error.column,
                };
                
                log.error({ 
                  ...errorContext,
                  err: error,
                  stack: error.stack,
                }, `Failed to save fixture: ${error.message}`);
                
                const errorMsg = `${fixture.teams.home.name} vs ${fixture.teams.away.name}: ${error.message}`;
                errors.push(errorMsg);
                
                // Report to Sentry for visibility
                Sentry.captureException(error, {
                  level: 'warning',
                  tags: { 
                    worker: 'fixtures',
                    operation: 'upsertMatch',
                    competition: competition.name,
                  },
                  extra: errorContext,
                });
              }
          }
        }

        log.info(`✓ Fetched ${totalFixtures} fixtures, saved ${savedFixtures}, scheduled ${jobsScheduled} jobs`);

        return {
          success: true,
          competitions: fixturesByCompetition.length,
          fixtures: totalFixtures,
          saved: savedFixtures,
          jobsScheduled,
          errors: errors.length > 0 ? errors : undefined,
        };
       } catch (error: any) {
           log.error({ 
             manual,
             attemptsMade: job.attemptsMade,
             err: error 
           }, `Error fetching fixtures`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'fixtures',
             },
             extra: {
               jobId: job.id,
               attempt: job.attemptsMade,
               manual,
             },
           });
           
           throw error; // Let BullMQ handle retry
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one fixtures fetch at a time
    }
  );
}
