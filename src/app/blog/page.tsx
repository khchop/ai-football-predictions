/**
 * Blog Index Page
 *
 * Displays list of published blog posts (league roundups, model reports, etc.)
 * PPR-compatible: Static shell (header) prerenders, posts list streams via Suspense.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { getPublishedBlogPosts, getOverallStats } from '@/lib/db/queries';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, ArrowRight, Filter } from 'lucide-react';
import type { Metadata } from 'next';
import type { BlogPost } from '@/lib/db/schema';
import { COMPETITIONS } from '@/lib/football/competitions';
import { BlogListSkeleton } from '@/components/blog/blog-list-skeleton';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';
import { BASE_URL } from '@/lib/seo/constants';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getOverallStats();
  const modelCount = stats.activeModels;

  return {
    title: buildGenericTitle('AI Football Analysis Blog'),
    description: buildGenericDescription(`AI-generated match reports, league roundups, and model performance analysis. Deep insights into football predictions from ${modelCount} AI models.`),
    alternates: {
      canonical: `${BASE_URL}/blog`,
    },
    openGraph: {
      title: 'AI Football Analysis Blog | Kroam',
      description: 'Match reports, league roundups, and AI model performance analysis',
      url: `${BASE_URL}/blog`,
      type: 'website',
      siteName: 'Kroam',
      images: [{
        url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Football Analysis Blog')}`,
        width: 1200,
        height: 630,
        alt: 'AI Football Analysis Blog',
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Football Analysis Blog | Kroam',
      description: 'AI-generated insights into football predictions',
      images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('AI Football Analysis Blog')}`],
    },
  };
}

const POSTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ page?: string; competition?: string }>;
}

/**
 * BlogPostsList - Dynamic content component
 *
 * Awaits searchParams inside the component (PPR pattern).
 * Renders competition filter pills, posts grid, empty state, and pagination.
 */
async function BlogPostsList({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; competition?: string }>;
}) {
  const { page: pageParam, competition } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const offset = (page - 1) * POSTS_PER_PAGE;

  const posts = await getPublishedBlogPosts(POSTS_PER_PAGE + 1, offset);
  const hasNextPage = posts.length > POSTS_PER_PAGE;
  const displayPosts = competition
    ? posts.filter((post: BlogPost) => {
        const competitionFromSlug = post.slug?.split('-vs-')[0];
        return competitionFromSlug === competition;
      }).slice(0, POSTS_PER_PAGE)
    : posts.slice(0, POSTS_PER_PAGE);

  const selectedCompetition = competition
    ? COMPETITIONS.find(c => c.id === competition)
    : null;

  return (
    <>
      {/* Competition Filter - Active filter indicator */}
      {competition && (
        <div className="mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <Filter className="h-4 w-4" />
            {selectedCompetition?.icon} {selectedCompetition?.name}
            <span className="ml-1 text-xs opacity-60">(Clear)</span>
          </Link>
        </div>
      )}

      {/* Competition Pills - Show when no filter active */}
      {competition === undefined && (
        <div className="flex flex-wrap gap-2 mb-8">
          {COMPETITIONS.filter(c => c.category === 'club-domestic' || c.category === 'club-europe').map(comp => (
            <Link
              key={comp.id}
              href={`/blog?competition=${comp.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors text-sm"
            >
              <span>{comp.icon}</span>
              <span>{comp.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Posts Grid */}
      {displayPosts.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayPosts.map((post: BlogPost) => {
              const competitionFromSlug = post.slug?.split('-vs-')[0];
              const postCompetition = COMPETITIONS.find(c => c.id === competitionFromSlug);

              return (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-6 h-full flex flex-col">
                      {/* Content Type & Competition */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {post.contentType === 'league_roundup'
                            ? 'League Roundup'
                            : post.contentType === 'model_report'
                              ? 'Model Report'
                              : 'Analysis'}
                        </span>
                        {postCompetition && (
                          <span className="text-sm">{postCompetition.icon}</span>
                        )}
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
              );
            })}
          </div>

          {/* Pagination */}
          {page > 1 || hasNextPage ? (
            <div className="flex justify-between items-center pt-8">
              {page > 1 ? (
                <Link
                  href={`/blog?page=${page - 1}${competition ? `&competition=${competition}` : ''}`}
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
                  href={`/blog?page=${page + 1}${competition ? `&competition=${competition}` : ''}`}
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
            <p className="text-muted-foreground">No blog posts found for this competition.</p>
            {competition && (
              <Link href="/blog" className="inline-flex items-center gap-2 mt-4 text-primary hover:underline">
                View all posts
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * BlogPage - PPR-compatible page component
 *
 * Static shell (header, title, description) prerenders.
 * Dynamic content (posts list) streams via Suspense boundary.
 */
export default function BlogPage({ searchParams }: PageProps) {
  // NO await here - static shell prerendered for PPR
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Static: prerendered shell */}
      <div className="space-y-3">
        <Link
          href="/matches"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to matches
        </Link>

        <div>
          <h1 className="text-4xl md:text-5xl font-bold gradient-text">Football Insights</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mt-2">
            Weekly league roundups, AI model performance reports, and detailed match analysis.
          </p>
        </div>
      </div>

      {/* Dynamic: streams with searchParams */}
      <Suspense fallback={<BlogListSkeleton />}>
        <BlogPostsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
