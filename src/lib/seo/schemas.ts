/**
 * JSON-LD Schema Generators for SEO and GEO
 * Used by AI crawlers (GPTBot, PerplexityBot, ClaudeBot, etc.)
 */

export interface SportsEventData {
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  venue?: string | null;
  competitionName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ArticleData {
  title: string;
  description: string;
  author?: string;
  publishedAt: string;
  modifiedAt?: string;
  imageUrl?: string;
  url: string;
}

/**
 * Generate SportsEvent schema for match pages
 */
export function generateSportsEventSchema(data: SportsEventData) {
  // Map status to correct EventStatus
  let eventStatus = 'https://schema.org/EventScheduled';
  if (data.status === 'finished') {
    eventStatus = 'https://schema.org/EventCompleted';
  } else if (data.status === 'live') {
    eventStatus = 'https://schema.org/EventInProgress';
  } else if (data.status === 'postponed') {
    eventStatus = 'https://schema.org/EventPostponed';
  } else if (data.status === 'cancelled') {
    eventStatus = 'https://schema.org/EventCancelled';
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${data.homeTeam} vs ${data.awayTeam}`,
    "startDate": data.kickoffTime,
    "eventStatus": eventStatus,
    "sport": "Football",
    "homeTeam": {
      "@type": "SportsTeam",
      "name": data.homeTeam,
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": data.awayTeam,
    },
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": data.homeTeam,
      },
      {
        "@type": "SportsTeam",
        "name": data.awayTeam,
      },
    ],
  };

  if (data.venue) {
    schema.location = {
      "@type": "Place",
      "name": data.venue,
      "address": data.venue, // Google Rich Results requires address
    };
  }

  if (data.homeScore !== null && data.homeScore !== undefined &&
      data.awayScore !== null && data.awayScore !== undefined) {
    schema.homeTeamScore = data.homeScore;
    schema.awayTeamScore = data.awayScore;
  }

  return schema;
}

/**
 * Generate FAQPage schema for pages with FAQ sections
 */
export function generateFAQPageSchema(faqs: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}

/**
 * Generate Organization schema for site-wide branding
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://kroam.xyz#organization",
    "name": "kroam.xyz",
    "url": "https://kroam.xyz",
    "description": "AI football prediction platform comparing 42 AI models on match predictions",
    "logo": "https://kroam.xyz/logo.png",
  };
}

/**
 * Generate Article schema for blog posts
 */
export function generateArticleSchema(data: ArticleData) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": data.url + '#article',
    "headline": data.title,
    "description": data.description,
    "datePublished": data.publishedAt,
    "author": {
      "@type": "Organization",
      "name": data.author || "kroam.xyz",
    },
    "publisher": {
      "@type": "Organization",
      "name": "kroam.xyz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://kroam.xyz/logo.png",
      },
    },
    "url": data.url,
    // Speakable property for voice search optimization (Google Assistant, Alexa)
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "h2", ".article-summary", "blockquote", "p:first-of-type"],
    },
  };

  if (data.modifiedAt) {
    schema.dateModified = data.modifiedAt;
  }

  if (data.imageUrl) {
    schema.image = {
      "@type": "ImageObject",
      "url": data.imageUrl,
    };
  }

  return schema;
}

/**
 * Generate BreadcrumbList schema for navigation
 */
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url,
    })),
  };
}
