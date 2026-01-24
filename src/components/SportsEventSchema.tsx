import type { Match, Competition } from '@/lib/db/schema';

interface SportsEventSchemaProps {
  match: Match;
  competition: Competition;
}

export function SportsEventSchema({ match, competition }: SportsEventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': `${match.homeTeam} vs ${match.awayTeam}`,
    'startDate': match.kickoffTime,
    'location': {
      '@type': 'Place',
      'name': match.venue || 'Stadium'
    },
    'homeTeam': {
      '@type': 'SportsTeam',
      'name': match.homeTeam,
      'logo': match.homeTeamLogo
    },
    'awayTeam': {
      '@type': 'SportsTeam',
      'name': match.awayTeam,
      'logo': match.awayTeamLogo
    },
    'eventStatus': match.status === 'finished' 
      ? 'https://schema.org/EventPostponed' // This is wrong, let's fix it
      : match.status === 'live'
      ? 'https://schema.org/EventScheduled' // Simplified
      : 'https://schema.org/EventScheduled',
  };

  // Correction for eventStatus and adding results if finished
  const eventStatus = match.status === 'finished' 
    ? 'https://schema.org/MatchStatusFinished' 
    : match.status === 'live'
    ? 'https://schema.org/MatchStatusInPlay'
    : 'https://schema.org/MatchStatusScheduled';

  const fullSchema = {
    ...schema,
    'eventStatus': eventStatus,
    ...(match.status === 'finished' && match.homeScore !== null && match.awayScore !== null ? {
      'result': `${match.homeScore}-${match.awayScore}`
    } : {})
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(fullSchema) }}
    />
  );
}
