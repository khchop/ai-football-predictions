/**
 * WebPage Schema Builder
 *
 * Builds Schema.org WebPage entity with @id cross-references for use in @graph arrays.
 * Designed to integrate with consolidated JSON-LD graphs where entities reference each other.
 */

export interface WebPageSchemaOptions {
  url: string;
  name: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
}

/**
 * Builds a WebPage schema entity for inclusion in @graph arrays.
 *
 * @param options - WebPage configuration
 * @returns Schema.org WebPage object with @id cross-references
 *
 * @example
 * const webpage = buildWebPageSchema({
 *   url: 'https://kroam.xyz/leagues/premier-league/man-city-vs-arsenal',
 *   name: 'Manchester City vs Arsenal Prediction',
 *   description: 'AI predictions for Manchester City vs Arsenal...',
 * });
 */
export function buildWebPageSchema(options: WebPageSchemaOptions): object {
  return {
    '@type': 'WebPage',
    '@id': `${options.url}#webpage`,
    url: options.url,
    name: options.name,
    description: options.description,
    isPartOf: { '@id': 'https://kroam.xyz#website' },
    about: { '@id': options.url }, // Reference to SportsEvent @id
    ...(options.datePublished && { datePublished: options.datePublished }),
    ...(options.dateModified && { dateModified: options.dateModified }),
  };
}
