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
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${data.homeTeam} vs ${data.awayTeam}`,
    "startDate": data.kickoffTime,
    "eventStatus": data.status === 'finished' ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
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
    };
  }

  if (data.homeScore !== null && data.homeScore !== undefined && 
      data.awayScore !== null && data.awayScore !== undefined) {
    schema.eventStatus = "https://schema.org/EventCompleted";
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
    "name": "kroam.xyz",
    "url": "https://kroam.xyz",
    "description": "AI football prediction platform comparing 30 AI models on match predictions",
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
