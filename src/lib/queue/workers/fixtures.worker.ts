/**
 * Fixtures Worker
 * 
 * Fetches upcoming fixtures from API-Football and schedules jobs for new matches.
 * Runs every 6 hours via repeatable job.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { FetchFixturesPayload } from '../types';
import { getUpcomingFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { upsertMatch, upsertCompetition } from '@/lib/db/queries';
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
            
            try {
              const matchId = uuidv4();
              
              // Generate SEO-friendly slug
              const slug = generateMatchSlug(
                fixture.teams.home.name,
                fixture.teams.away.name,
                fixture.fixture.date
              );
              
              // Save match to DB
              await upsertMatch({
                id: matchId,
                externalId: String(fixture.fixture.id),
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
              
              // Schedule jobs for this match (only if status is 'scheduled')
              if (mapFixtureStatus(fixture.fixture.status.short) === 'scheduled') {
                const scheduled = await scheduleMatchJobs({
                  match: {
                    id: matchId,
                    externalId: String(fixture.fixture.id),
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
              }
            } catch (error: any) {
               const errorMsg = `Failed to process fixture ${fixture.fixture.id}: ${error.message}`;
               log.error({ err: error }, errorMsg);
               errors.push(errorMsg);
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
         log.error({ err: error }, 'Error');
         throw error; // Let BullMQ handle retry
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one fixtures fetch at a time
    }
  );
}
