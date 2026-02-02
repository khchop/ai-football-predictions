/**
 * Blog Post Page
 * 
 * Displays individual blog post with markdown rendering
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { getBlogPostBySlug } from '@/lib/db/queries';
import { generateArticleSchema } from '@/lib/seo/schemas';
import { buildRoundupSchema } from '@/lib/seo/schema/roundup';
import { buildBreadcrumbSchema } from '@/lib/seo/schema/breadcrumb';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Metadata } from 'next';
import { WebPageSchema } from '@/components/WebPageSchema';
import { getDb } from '@/lib/db';
import { matches } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { BASE_URL } from '@/lib/seo/constants';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
      description: 'The requested blog post could not be found.',
    };
  }

  const baseUrl = 'https://kroam.xyz';
  const url = `${baseUrl}/blog/${slug}`;

  // Determine which OG image to use based on content type
  let ogImageUrl: string;
  let ogDescription = post.excerpt || post.title;

  if (post.contentType === 'model_report') {
    // Use model OG image for model reports
    const modelOgUrl = new URL(`${baseUrl}/api/og/model`);
    modelOgUrl.searchParams.set('modelName', post.title);
    modelOgUrl.searchParams.set('accuracy', '0');
    modelOgUrl.searchParams.set('rank', '—');
    ogImageUrl = modelOgUrl.toString();
  } else if (post.contentType === 'league_roundup') {
    // Use league OG image for league roundups
    const leagueOgUrl = new URL(`${baseUrl}/api/og/league`);
    leagueOgUrl.searchParams.set('leagueName', post.title);
    leagueOgUrl.searchParams.set('matchCount', '0');
    leagueOgUrl.searchParams.set('upcomingCount', '0');
    ogImageUrl = leagueOgUrl.toString();

    // Enhanced OG description for roundups: include "AI predictions" and competition if available
    if (post.competitionId) {
      const { getCompetitionById } = await import('@/lib/football/competitions');
      const competition = getCompetitionById(post.competitionId);
      if (competition) {
        ogDescription = `AI predictions and match analysis for ${competition.name}. See predictions from 35 models.`;
      } else {
        ogDescription = `AI predictions and match analysis. Compare predictions from 35 competing models.`;
      }
    } else {
      ogDescription = `AI predictions and match analysis. Compare predictions from 35 competing models.`;
    }
  } else {
    // Generic fallback for analysis posts
    const genericUrl = new URL(`${baseUrl}/api/og/league`);
    genericUrl.searchParams.set('leagueName', 'AI Analysis');
    genericUrl.searchParams.set('matchCount', '0');
    genericUrl.searchParams.set('upcomingCount', '0');
    ogImageUrl = genericUrl.toString();
  }

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    keywords: post.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description: ogDescription,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      url: url,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: ogDescription,
      images: [ogImageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Determine schema type based on content type
  let schema: object;

  if (post.contentType === 'league_roundup') {
    // For roundups, try to extract match data
    let matchData: Array<{ id: string; homeTeam: string; awayTeam: string; kickoffTime: string; competitionId: string; slug: string | null }> = [];

    // Primary path: Check if matchId field contains a match ID (single match)
    if (post.matchId) {
      const db = getDb();
      const matchResults = await db
        .select({
          id: matches.id,
          homeTeam: matches.homeTeam,
          awayTeam: matches.awayTeam,
          kickoffTime: matches.kickoffTime,
          competitionId: matches.competitionId,
          slug: matches.slug,
        })
        .from(matches)
        .where(inArray(matches.id, [post.matchId]))
        .limit(10);
      matchData = matchResults;
    }

    // Fallback: Parse markdown content for /matches/ links
    if (matchData.length === 0) {
      const matchIdPattern = /\/matches\/([a-zA-Z0-9-]+)/g;
      const matchIds = new Set<string>();
      let match;
      while ((match = matchIdPattern.exec(post.content)) !== null) {
        matchIds.add(match[1]);
      }

      if (matchIds.size > 0) {
        const db = getDb();
        const matchResults = await db
          .select({
            id: matches.id,
            homeTeam: matches.homeTeam,
            awayTeam: matches.awayTeam,
            kickoffTime: matches.kickoffTime,
            competitionId: matches.competitionId,
            slug: matches.slug,
          })
          .from(matches)
          .where(inArray(matches.id, Array.from(matchIds)))
          .limit(10);
        matchData = matchResults;
      }
    }

    schema = buildRoundupSchema(post, matchData.length > 0 ? matchData : undefined);
  } else {
    // For other content types: Keep existing Article schema
    schema = {
      '@context': 'https://schema.org',
      '@graph': [
        generateArticleSchema({
          title: post.title,
          description: post.excerpt || post.title,
          author: post.generatedBy || 'kroam.xyz',
          publishedAt: post.publishedAt || new Date().toISOString(),
          url: `${BASE_URL}/blog/${slug}`,
        }),
        buildBreadcrumbSchema([
          { name: 'Home', url: BASE_URL },
          { name: 'Blog', url: `${BASE_URL}/blog` },
          { name: post.title, url: `${BASE_URL}/blog/${slug}` },
        ]),
      ],
    };
  }

   return (
     <div className="max-w-3xl mx-auto space-y-8">
       {/* Article Schema for search engines */}
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
       />

       <WebPageSchema
         name={post.title}
         description={post.excerpt || post.title}
         url={`${BASE_URL}/blog/${post.slug}`}
         datePublished={post.publishedAt || undefined}
         breadcrumb={[
           { name: 'Home', url: BASE_URL },
           { name: 'Blog', url: `${BASE_URL}/blog` },
           { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
         ]}
       />

       {/* Back Link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to blog
      </Link>

      {/* Article Card */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-8 md:p-12">
          {/* Header */}
          <div className="space-y-4 mb-8">
            {/* Content Type Badge */}
            <div>
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
                {post.contentType === 'league_roundup'
                  ? 'League Roundup'
                  : post.contentType === 'model_report'
                    ? 'Model Report'
                    : 'Analysis'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold gradient-text leading-tight">{post.title}</h1>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {post.publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(post.publishedAt), 'MMMM d, yyyy')}
                </div>
              )}
              {post.generatedBy && (
                <div className="text-xs">
                  Generated by: <span className="font-medium">{post.generatedBy}</span>
                </div>
              )}
            </div>

            {/* Excerpt */}
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">{post.excerpt}</p>
          </div>

          {/* Divider */}
          <div className="border-t border-border/30 my-8" />

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-4">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-3xl font-bold mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-bold mb-3 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-semibold mb-3 mt-4">{children}</h3>,
                p: ({ children }) => <p className="text-foreground leading-relaxed mb-4">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="bg-muted/50 rounded px-2 py-1 font-mono text-sm">{children}</code>
                ),
                table: ({ children }) => <table className="w-full border-collapse border border-border/30 my-4">{children}</table>,
                thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border border-border/30">{children}</tr>,
                td: ({ children }) => <td className="border border-border/30 p-3">{children}</td>,
                th: ({ children }) => <th className="border border-border/30 p-3 text-left font-semibold">{children}</th>,
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Footer */}
          <div className="border-t border-border/30 mt-12 pt-8 text-sm text-muted-foreground/60">
            {post.generationCost && (
              <p>Generation cost: ${post.generationCost}</p>
            )}
            {post.promptTokens && post.completionTokens && (
              <p>Tokens: {post.promptTokens.toLocaleString()} input + {post.completionTokens.toLocaleString()} output</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Related Posts Link */}
      <div className="text-center">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          More insights
        </Link>
      </div>
    </div>
  );
}
