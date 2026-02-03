---
phase: 19-blog-page-rebuild
plan: 03
subsystem: blog-discovery
tags: [related-articles, content-similarity, tag-matching, card-grid]

dependency_graph:
  requires:
    - 19-01 (heading extraction)
    - 19-02 (FAQ extraction)
  provides:
    - findRelatedArticles utility
    - RelatedArticles component
    - getRecentBlogPosts query
  affects:
    - 19-04 (blog page integration)
    - 19-05 (if exists)

tech-stack:
  added: []
  patterns:
    - Tag-based content similarity with competition matching
    - Recency tiebreaker for equal scores
    - Responsive card grid (1/2/3 columns)

file-tracking:
  key-files:
    created:
      - src/lib/blog/related-articles.ts
      - src/components/blog/related-articles.tsx
    modified:
      - src/lib/db/queries.ts

decisions:
  - id: scoring-weights
    choice: Competition +5, ContentType +3, Tag +1
    rationale: Competition is strongest signal for football content

metrics:
  duration: 4m 26s
  completed: 2026-02-03
---

# Phase 19 Plan 03: Related Articles Widget Summary

Tag-based similarity algorithm with competition matching, rendering as responsive card grid.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create related articles utility | 794f191 | src/lib/blog/related-articles.ts |
| 2 | Add getRecentBlogPosts query | dce02e6 | src/lib/db/queries.ts |
| 3 | Create RelatedArticles component | f303c18 | src/components/blog/related-articles.tsx |

## Implementation Details

### Related Articles Utility (`src/lib/blog/related-articles.ts`)

Content similarity scoring algorithm:

1. **Competition match: +5 points** - Strongest signal for football content. Posts about the same league/competition are most likely to interest readers.

2. **Content type match: +3 points** - Posts of the same type (league_roundup, model_report, analysis) share reader intent.

3. **Tag overlap: +1 point per tag** - Fine-grained topical matching for posts with tag metadata.

4. **Recency tiebreaker** - For equal scores, prefer newer posts.

5. **Backfill logic** - If fewer than limit posts score > 0, backfill with recent posts to always show something.

```typescript
export function findRelatedArticles(
  currentPost: BlogPost,
  allPosts: BlogPost[],
  limit?: number
): RelatedArticle[]
```

### Query Function (`src/lib/db/queries.ts`)

Added `getRecentBlogPosts(limit = 20)` for fetching the candidate pool for similarity calculation. Default limit of 20 is sufficient for tag-based similarity without fetching entire blog history.

### RelatedArticles Component (`src/components/blog/related-articles.tsx`)

Card grid following blog index page design pattern:

- **Responsive columns:** 1 (mobile), 2 (tablet), 3 (desktop)
- **Card content:** Type badge, title (line-clamp-2), excerpt (line-clamp-3), date
- **Empty state:** Returns null (no section rendered)
- **Partial state:** Shows 1-2 cards if that's all available

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring weights | Competition +5, Type +3, Tag +1 | Competition matching is most relevant for football content |
| Default limit | 3 articles | Per user decision in CONTEXT.md |
| Candidate pool | 20 posts | Sufficient for similarity without over-fetching |
| Section title | "You might also like" | More engaging than "Related Articles" |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commit incomplete blog page changes**

- **Found during:** Task 1 setup
- **Issue:** Previous session left uncommitted changes to blog/[slug]/page.tsx and untracked blog-faq.tsx
- **Fix:** Committed as `febc72d` to unblock build verification
- **Files modified:** src/app/blog/[slug]/page.tsx, src/components/blog/blog-faq.tsx

## Verification

All success criteria met:

1. `npm run build` succeeds without TypeScript errors
2. `findRelatedArticles` correctly scores by contentType and competitionId
3. `RelatedArticles` component renders 1-3 cards responsively
4. Empty array input results in no rendered section

## Next Phase Readiness

Ready for integration in blog post page (19-04 or similar plan):

```typescript
import { findRelatedArticles } from '@/lib/blog/related-articles';
import { RelatedArticles } from '@/components/blog/related-articles';
import { getRecentBlogPosts, getBlogPostBySlug } from '@/lib/db/queries';

// In blog post page:
const post = await getBlogPostBySlug(slug);
const allPosts = await getRecentBlogPosts(20);
const relatedArticles = findRelatedArticles(post, allPosts, 3);

// In JSX:
<RelatedArticles articles={relatedArticles} />
```
