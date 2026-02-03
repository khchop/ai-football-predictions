/**
 * MatchPageSchema Component
 *
 * Renders a consolidated Schema.org JSON-LD @graph for match pages.
 * Combines Organization, WebSite, SportsEvent, WebPage, and BreadcrumbList
 * into a single script tag with proper @id cross-references.
 *
 * Benefits:
 * - Single JSON-LD script (eliminates multiple script validation warnings)
 * - Entity relationships via @id cross-references
 * - Better rich result eligibility for AI search engines
 */

import type { Match } from '@/lib/db/schema';
import type { FAQItem } from './match/MatchFAQSchema';

interface MatchPageSchemaProps {
  match: Match;
  competition: {
    name: string;
    slug: string;
  };
  url: string;
  faqs: FAQItem[];
}

/**
 * Maps match status to Schema.org EventStatus URL
 */
function getEventStatus(status: string | null): string {
  switch (status) {
    case 'finished':
      return 'https://schema.org/EventCompleted';
    case 'live':
      return 'https://schema.org/EventInProgress';
    case 'postponed':
      return 'https://schema.org/EventPostponed';
    case 'cancelled':
      return 'https://schema.org/EventCancelled';
    default:
      return 'https://schema.org/EventScheduled';
  }
}

export function MatchPageSchema({ match, competition, url, faqs }: MatchPageSchemaProps) {
  const eventStatus = getEventStatus(match.status);
  const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
  const pageDescription = `AI predictions for ${matchName} (${competition.name}). Compare forecasts from 35+ AI models.`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      // Organization (root entity, referenced by Website)
      {
        '@type': 'Organization',
        '@id': 'https://kroam.xyz#organization',
        name: 'kroam.xyz',
        url: 'https://kroam.xyz',
        logo: 'https://kroam.xyz/logo.png',
      },
      // WebSite (referenced by WebPage)
      {
        '@type': 'WebSite',
        '@id': 'https://kroam.xyz#website',
        name: 'kroam.xyz',
        url: 'https://kroam.xyz',
        publisher: { '@id': 'https://kroam.xyz#organization' },
      },
      // SportsEvent (the match itself)
      {
        '@type': 'SportsEvent',
        '@id': url,
        name: matchName,
        startDate: match.kickoffTime,
        eventStatus,
        location: {
          '@type': 'Place',
          name: match.venue || 'Stadium',
        },
        homeTeam: {
          '@type': 'SportsTeam',
          name: match.homeTeam,
          ...(match.homeTeamLogo && { logo: match.homeTeamLogo }),
        },
        awayTeam: {
          '@type': 'SportsTeam',
          name: match.awayTeam,
          ...(match.awayTeamLogo && { logo: match.awayTeamLogo }),
        },
        sport: 'Football',
        // Add scores only for finished matches
        ...(match.status === 'finished' &&
          match.homeScore !== null &&
          match.awayScore !== null && {
            homeTeamScore: match.homeScore,
            awayTeamScore: match.awayScore,
          }),
      },
      // WebPage (references SportsEvent and Website)
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: `${matchName} Prediction`,
        description: pageDescription,
        isPartOf: { '@id': 'https://kroam.xyz#website' },
        about: { '@id': url },
      },
      // FAQPage - questions from match-specific FAQ
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      // BreadcrumbList (page-specific navigation)
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://kroam.xyz',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Leagues',
            item: 'https://kroam.xyz/leagues',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: competition.name,
            item: `https://kroam.xyz/leagues/${competition.slug}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: matchName,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
