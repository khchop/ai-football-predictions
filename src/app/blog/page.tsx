/**
 * Blog Index Page
 * 
 * Displays list of published blog posts (league roundups, model reports, etc.)
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { getPublishedBlogPosts } from '@/lib/db/queries';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import type { BlogPost } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'AI Football Analysis Blog | kroam.xyz',
  description: 'AI-generated match reports, league roundups, and model performance analysis. Deep insights into football predictions from 35 AI models.',
  alternates: {
    canonical: 'https://kroam.xyz/blog',
  },
  openGraph: {
    title: 'AI Football Analysis Blog',
    description: 'Match reports, league roundups, and AI model performance analysis',
    url: 'https://kroam.xyz/blog',
    type: 'website',
    siteName: 'kroam.xyz',
    images: [{
      url: 'https://kroam.xyz/api/og/league?leagueName=AI+Analysis',
      width: 1200,
      height: 630,
      alt: 'AI Football Analysis Blog',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Football Analysis Blog',
    description: 'AI-generated insights into football predictions',
  },
};

const POSTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const offset = (page - 1) * POSTS_PER_PAGE;

  // Get posts for current page
  const posts = await getPublishedBlogPosts(POSTS_PER_PAGE + 1, offset); // +1 to detect if there are more pages
  const hasNextPage = posts.length > POSTS_PER_PAGE;
  const displayPosts = posts.slice(0, POSTS_PER_PAGE);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/matches"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to matches
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold gradient-text">Football Insights</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Weekly league roundups, AI model performance reports, and detailed match analysis to enhance your betting
          strategy.
        </p>
      </div>

      {/* Posts Grid */}
      {displayPosts.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayPosts.map((post: BlogPost) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-6 h-full flex flex-col">
                    {/* Content Type Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {post.contentType === 'league_roundup'
                          ? 'League Roundup'
                          : post.contentType === 'model_report'
                            ? 'Model Report'
                            : 'Analysis'}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
                      {post.excerpt}
                    </p>

                    {/* Meta */}
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground/60">
                        {format(parseISO(post.publishedAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {page > 1 || hasNextPage ? (
            <div className="flex justify-between items-center pt-8">
              {page > 1 ? (
                <Link
                  href={`/blog?page=${page - 1}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <div />
              )}

              <span className="text-sm text-muted-foreground">Page {page}</span>

              {hasNextPage ? (
                <Link
                  href={`/blog?page=${page + 1}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          ) : null}
        </>
      ) : (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No blog posts yet. Check back soon for insights and analysis!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
