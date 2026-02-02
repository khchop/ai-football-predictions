import type { BreadcrumbList, ListItem } from 'schema-dts';
import { BASE_URL } from '../constants';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbList {
  const listItems: ListItem[] = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  }));

  return {
    '@type': 'BreadcrumbList',
    itemListElement: listItems,
  };
}

export function buildMatchBreadcrumbs(
  competition: string,
  competitionSlug: string,
  matchName: string,
  matchSlug: string
): BreadcrumbItem[] {
  return [
    {
      name: 'Home',
      url: BASE_URL,
    },
    {
      name: 'Leagues',
      url: `${BASE_URL}/leagues`,
    },
    {
      name: competition,
      url: `${BASE_URL}/leagues/${competitionSlug}`,
    },
    {
      name: matchName,
      url: `${BASE_URL}/leagues/${competitionSlug}/${matchSlug}`,
    },
  ];
}

export { buildBreadcrumbSchema as default };
