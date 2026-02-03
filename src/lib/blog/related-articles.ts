/**
 * Related Articles Utility
 *
 * Finds contextually relevant blog posts using tag-based similarity
 * with recency tiebreaker. Per research recommendation: "tag-based
 * similarity is sufficient for small content sets (<100 posts)".
 */

import type { BlogPost } from '@/lib/db/schema';

export interface RelatedArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentType: string | null;
  publishedAt: string | null;
}

interface ScoredArticle {
  post: BlogPost;
  score: number;
}

/**
 * Parse comma-separated tags string into Set
 */
function parseTags(tagsString: string | null): Set<string> {
  if (!tagsString) return new Set();
  return new Set(
    tagsString
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Calculate similarity score between two posts
 *
 * Scoring algorithm (per research):
 * 1. Competition match: +5 points (strongest signal)
 * 2. Content type match: +3 points (league_roundup, model_report, analysis)
 * 3. Tag overlap: +1 point per matching tag
 */
function calculateSimilarityScore(
  currentPost: BlogPost,
  candidatePost: BlogPost
): number {
  let score = 0;

  // Primary: Competition match (strongest signal for football content)
  if (
    currentPost.competitionId &&
    candidatePost.competitionId &&
    currentPost.competitionId === candidatePost.competitionId
  ) {
    score += 5;
  }

  // Secondary: Content type match
  if (
    currentPost.contentType &&
    candidatePost.contentType &&
    currentPost.contentType === candidatePost.contentType
  ) {
    score += 3;
  }

  // Tertiary: Tag overlap
  const currentTags = parseTags(currentPost.tags);
  const candidateTags = parseTags(candidatePost.tags);

  for (const tag of currentTags) {
    if (candidateTags.has(tag)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Sort by score (descending), then by recency (descending) as tiebreaker
 */
function sortByScoreAndRecency(a: ScoredArticle, b: ScoredArticle): number {
  // First by score (higher is better)
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  // Tiebreaker: recency (newer is better)
  const aDate = a.post.publishedAt
    ? new Date(a.post.publishedAt).getTime()
    : 0;
  const bDate = b.post.publishedAt
    ? new Date(b.post.publishedAt).getTime()
    : 0;
  return bDate - aDate;
}

/**
 * Find related articles based on content similarity
 *
 * @param currentPost - The post to find related articles for
 * @param allPosts - Pool of posts to search (should be published posts)
 * @param limit - Maximum number of related articles to return (default: 3)
 * @returns Array of related articles, may be fewer than limit if not enough exist
 */
export function findRelatedArticles(
  currentPost: BlogPost,
  allPosts: BlogPost[],
  limit: number = 3
): RelatedArticle[] {
  // Filter: exclude current post and non-published posts
  const candidates = allPosts.filter(
    (post) => post.id !== currentPost.id && post.status === 'published'
  );

  if (candidates.length === 0) {
    return [];
  }

  // Score all candidates
  const scored: ScoredArticle[] = candidates.map((post) => ({
    post,
    score: calculateSimilarityScore(currentPost, post),
  }));

  // Sort by score and recency
  scored.sort(sortByScoreAndRecency);

  // Take top N with score > 0
  const related = scored.filter((s) => s.score > 0).slice(0, limit);

  // If fewer than limit with score > 0, backfill with recent posts
  if (related.length < limit) {
    const relatedIds = new Set(related.map((r) => r.post.id));
    const backfill = scored
      .filter((s) => !relatedIds.has(s.post.id))
      .slice(0, limit - related.length);
    related.push(...backfill);
  }

  // Map to RelatedArticle (only fields needed for display)
  return related.map((r) => ({
    id: r.post.id,
    slug: r.post.slug,
    title: r.post.title,
    excerpt: r.post.excerpt,
    contentType: r.post.contentType,
    publishedAt: r.post.publishedAt,
  }));
}
