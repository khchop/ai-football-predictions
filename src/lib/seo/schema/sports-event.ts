import type { WithContext, SportsEvent, SportsOrganization, Place } from 'schema-dts';
import { BASE_URL } from '../constants';
import type { MatchSeoData, MatchStatus } from '../types';
import { isMatchFinished, isMatchLive, isMatchUpcoming } from '../types';

// Map match status to schema.org EventStatus
function mapEventStatus(status: MatchStatus): 'https://schema.org/EventScheduled' | 'https://schema.org/EventRescheduled' {
  if (isMatchUpcoming(status)) {
    return 'https://schema.org/EventScheduled';
  }
  // Live and finished both use rescheduled as there's no "live" status in schema.org for events
  return 'https://schema.org/EventRescheduled';
}

export function buildSportsEventSchema(match: MatchSeoData): SportsEvent {
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