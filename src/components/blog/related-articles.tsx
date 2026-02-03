/**
 * Related Articles Widget
 *
 * Displays a grid of related blog posts for content discovery.
 * Card design matches blog index page for visual consistency.
 *
 * Features:
 * - Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
 * - Content type badge (league_roundup, model_report, analysis)
 * - Title with line-clamp-2 for consistent height
 * - Excerpt with line-clamp-3 and muted text
 * - Publish date at bottom
 * - Returns null if no articles (don't show empty section)
 * - Shows 1-3 articles based on what's available
 */

import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { RelatedArticle } from '@/lib/blog/related-articles';
import { HoverPrefetchLink } from '@/components/navigation/hover-prefetch-link';

interface RelatedArticlesProps {
  articles: RelatedArticle[];
}

/**
 * Format content type for display
 */
function formatContentType(contentType: string | null): string {
  switch (contentType) {
    case 'league_roundup':
      return 'League Roundup';
    case 'model_report':
      return 'Model Report';
    case 'analysis':
      return 'Analysis';
    default:
      return 'Article';
  }
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  // Don't render section if no articles
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">You might also like</h2>

      {/* Card grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <HoverPrefetchLink key={article.id} href={`/blog/${article.slug}`}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-5 h-full flex flex-col">
                {/* Content Type Badge */}
                <span className="inline-block w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
                  {formatContentType(article.contentType)}
                </span>

                {/* Title */}
                <h3 className="text-base font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>

                {/* Excerpt */}
                {article.excerpt && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3 flex-grow">
                    {article.excerpt}
                  </p>
                )}

                {/* Publish Date */}
                {article.publishedAt && (
                  <p className="text-xs text-muted-foreground/60 mt-auto">
                    {format(parseISO(article.publishedAt), 'MMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>
          </HoverPrefetchLink>
        ))}
      </div>
    </section>
  );
}
