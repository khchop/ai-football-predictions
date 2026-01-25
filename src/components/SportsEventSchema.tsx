import type { Match } from '@/lib/db/schema';

interface SportsEventSchemaProps {
  match: Match;
}

export function SportsEventSchema({ match }: SportsEventSchemaProps) {
  // Map match status to valid Schema.org EventStatus values
  const eventStatus = match.status === 'finished' 
    ? 'https://schema.org/EventCompleted'
    : match.status === 'live'
    ? 'https://schema.org/EventInProgress'
    : 'https://schema.org/EventScheduled';

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': `${match.homeTeam} vs ${match.awayTeam}`,
    'startDate': match.kickoffTime,
    'eventStatus': eventStatus,
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
    'sport': 'Football',
    'competitor': [
      {
        '@type': 'SportsTeam',
        'name': match.homeTeam,
      },
      {
        '@type': 'SportsTeam',
        'name': match.awayTeam,
      },
    ],
  };

  // Add final scores if match is finished
  if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null) {
    schema.homeTeamScore = match.homeScore;
    schema.awayTeamScore = match.awayScore;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
