import type { WithContext, SportsEvent, SportsOrganization, Place } from 'schema-dts';
import { BASE_URL } from '../constants';
import type { MatchSeoData, MatchStatus } from '../types';
import { isMatchFinished, isMatchLive, isMatchUpcoming } from '../types';

// Map match status to schema.org EventStatus
// Note: schema.org only has EventScheduled for all events - no EventCompleted
// Finished matches signal completion via scores (homeTeamScore/awayTeamScore properties)
function mapEventStatus(status: MatchStatus): 'https://schema.org/EventScheduled' {
  return 'https://schema.org/EventScheduled';
}

export function buildSportsEventSchema(match: MatchSeoData, competitionId?: string): SportsEvent {
  const matchUrl = `${BASE_URL}/matches/${match.id}`;

  // Build SportsEvent
  const event: SportsEvent = {
    '@type': 'SportsEvent',
    '@id': matchUrl,
    name: `${match.homeTeam} vs ${match.awayTeam}`,
    startDate: match.startDate,
    eventStatus: mapEventStatus(match.status),
    location: {
      '@type': 'Place',
      name: match.venue ?? 'Unknown Venue',
      // Google Rich Results requires Place @type explicitly
      address: match.venue ?? 'Unknown Venue',
    },
    homeTeam: {
      '@type': 'SportsTeam',
      '@id': `${matchUrl}#homeTeam`,
      name: match.homeTeam,
      logo: match.homeTeamLogo ?? undefined,
    },
    awayTeam: {
      '@type': 'SportsTeam',
      '@id': `${matchUrl}#awayTeam`,
      name: match.awayTeam,
      logo: match.awayTeamLogo ?? undefined,
    },
    competitor: [
      {
        '@type': 'SportsTeam',
        '@id': `${matchUrl}#homeTeam`,
        name: match.homeTeam,
      },
      {
        '@type': 'SportsTeam',
        '@id': `${matchUrl}#awayTeam`,
        name: match.awayTeam,
      },
    ],
    sport: 'Football',
    description: createEventDescription(match),
  };

  // Add scores for finished matches to signal completion
  if (isMatchFinished(match.status) && match.homeScore !== null && match.awayScore !== null) {
    // @ts-expect-error - schema-dts types don't include these, but they're valid schema.org properties
    event.homeTeamScore = match.homeScore;
    // @ts-expect-error - schema-dts types don't include these, but they're valid schema.org properties
    event.awayTeamScore = match.awayScore;
  }

  // Add competition reference if provided
  // Note: superEvent expects an Event, but we can use type assertion for valid schema.org usage
  if (competitionId) {
    // @ts-expect-error - schema-dts expects Event, but SportsOrganization is valid per schema.org docs
    event.superEvent = {
      '@type': 'SportsOrganization',
      '@id': `${BASE_URL}/leagues/${competitionId}`,
    };
  }

  return event;
}

function createEventDescription(match: MatchSeoData): string {
  if (isMatchUpcoming(match.status)) {
    return `Preview of ${match.homeTeam} vs ${match.awayTeam} in ${match.competition}. Get AI-powered predictions before kickoff.`;
  }
  
  if (isMatchLive(match.status)) {
    return `Live coverage of ${match.homeTeam} vs ${match.awayTeam} in ${match.competition}. Track real-time match events and AI predictions.`;
  }
  
  // Finished
  const score = match.homeScore !== null && match.awayScore !== null
    ? ` ${match.homeScore}-${match.awayScore}`
    : '';
  return `Match report: ${match.homeTeam}${score} ${match.awayTeam} in ${match.competition}. View AI prediction analysis and model performance.`;
}

export { buildSportsEventSchema as default };