import type { Article, ItemList, ListItem, BreadcrumbList } from 'schema-dts';
import { BASE_URL } from '../constants';
import type { BlogPost } from '@/lib/db/schema';
import { buildBreadcrumbSchema } from './breadcrumb';

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  competitionId: string;
  slug: string;
}

/**
 * Build Article + ItemList schema for blog roundup posts
 * Used for league roundup posts that cover multiple matches
 */
export function buildRoundupSchema(post: BlogPost, matches?: Match[]): object {
  const postUrl = `${BASE_URL}/blog/${post.slug}`;

  // Build Article schema
  const article: Article = {
    '@type': 'Article',
    '@id': `${postUrl}#article`,
    headline: post.title,
    description: post.excerpt || post.title,
    datePublished: post.publishedAt || new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: post.generatedBy || 'kroam.xyz',
    },
    publisher: {
      '@type': 'Organization',
      name: 'kroam.xyz',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
    url: postUrl,
  };

  // Build BreadcrumbList
  const breadcrumb: BreadcrumbList = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
    { name: post.title, url: postUrl },
  ]);

  const graph: Array<Article | ItemList | BreadcrumbList> = [article, breadcrumb];

  // Build ItemList schema when matches provided
  if (matches && matches.length > 0) {
    const itemListElements: ListItem[] = matches.map((match, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SportsEvent',
        '@id': `${BASE_URL}/matches/${match.id}`,
        name: `${match.homeTeam} vs ${match.awayTeam}`,
        startDate: match.kickoffTime,
        url: `${BASE_URL}/matches/${match.id}`,
      },
    }));

    const itemList: ItemList = {
      '@type': 'ItemList',
      '@id': `${postUrl}#matches`,
      itemListElement: itemListElements,
    };

    graph.push(itemList);
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export default buildRoundupSchema;
