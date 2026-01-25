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
import { pingIndexNow } from '@/lib/utils/indexnow';

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
        const newMatchUrls: string[] = [];

        for (const { competition, fixtures } of fixturesByCompetition) {
          const competitionSlug = generateCompetitionSlug(competition.name);
          // Ensure competition exists in DB
          await upsertCompetition({
            id: competition.id,
            name: competition.name,
            apiFootballId: competition.apiFootballId,
            season: competition.season,
            active: true,
            slug: competitionSlug,
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
               const existingMatch = await getMatchByExternalId(externalId);
               const proposedMatchId = existingMatch?.id || uuidv4();
               const isNewMatch = !existingMatch;
               
               // Save match to DB and get the actual ID (in case of conflict on externalId)
               const { id: actualMatchId } = await upsertMatch({
                 id: proposedMatchId,
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
               
               // Schedule jobs for NEW scheduled matches only
               if (isNewMatch && mapFixtureStatus(fixture.fixture.status.short) === 'scheduled') {
                 newMatchUrls.push(`https://kroam.xyz/predictions/${competitionSlug}/${slug}`);
                 const scheduled = await scheduleMatchJobs({
                   match: {
                     id: actualMatchId,
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
                    slug: competitionSlug,
                    createdAt: null,
                  },
                });
                
                jobsScheduled += scheduled;
              }
             } catch (error: any) {
                const errorMsg = `${fixture.teams.home.name} vs ${fixture.teams.away.name}: ${error.message}`;
                errors.push(errorMsg);
                Sentry.captureException(error);
              }
          }
        }

        // Ping IndexNow for new matches
        if (newMatchUrls.length > 0) {
          await pingIndexNow(newMatchUrls);
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
            log.error({ manual, err: error }, `Error fetching fixtures`);
            throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  );
}
