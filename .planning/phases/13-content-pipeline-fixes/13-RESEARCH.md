# Phase 13: Content Pipeline Fixes - Research

**Researched:** 2026-02-02
**Domain:** Content rendering, database query patterns, UI progressive disclosure
**Confidence:** HIGH

## Summary

Phase 13 addresses a critical content rendering gap: LLM-generated content exists in the database but doesn't display on match pages due to dual-table writes (`matchContent` vs `matchRoundups`) and query misalignment. The solution requires implementing a unified content query system, ensuring content renders in the correct match state (pre-match/betting/post-match), and adding "Read More" progressive disclosure for long-form narrative content.

The project uses:
- **Next.js App Router** with React Server Components
- **Drizzle ORM** for type-safe database queries
- **PostgreSQL** with two content tables requiring unified queries
- **React functional components** with modern hooks patterns

**Current State:** Content generation works (3-section match content and full roundups exist in DB), but display layer fails to query and render correctly. MatchContentSection component exists but may not be called, or queries return null.

**Primary recommendation:** Create a unified `getMatchContentUnified()` query function using Drizzle's COALESCE pattern to merge matchContent (short sections) and matchRoundups (long narratives) into a single result, then implement React client components with useState for "Read More" expansion, using CSS line-clamp for initial truncation with full accessibility compliance.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Latest | Type-safe database queries | Already in project; supports UNION, COALESCE, and SQL template literals for complex queries |
| Next.js App Router | 14+ | Server Components rendering | Already in project; enables server-side data fetching close to DB without API layer |
| React | 18+ | UI components | Already in project; useState + functional components for progressive disclosure |
| PostgreSQL | Current | Database | Already in project; reliable COALESCE and UNION query support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS line-clamp | Native CSS | Text truncation | Multi-line text truncation before "Read More" expansion (accessibility-aware) |
| Promise.all | Native JS | Parallel queries | Fetch match data, content, predictions simultaneously to avoid waterfalls |
| Suspense | React 18+ | Loading states | Progressive content rendering while unified query executes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle UNION | Raw SQL with db.execute() | Less type safety, more boilerplate, same performance |
| CSS line-clamp | JS height detection | More complex, worse performance, same accessibility issues |
| Server Components | Client-side fetching | Exposes DB secrets, slower TTFB, worse SEO |

**Installation:**
```bash
# No new packages needed - all tools already in project
npm install # Existing: drizzle-orm, next, react
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db/
│   │   ├── schema.ts              # Existing tables: matchContent, matchRoundups
│   │   └── queries.ts             # ADD: getMatchContentUnified()
│   └── content/
│       └── queries.ts             # UPDATE: existing getMatchContent() to use unified
├── components/
│   └── match/
│       ├── MatchContent.tsx       # UPDATE: ensure renders on match pages
│       └── ReadMoreText.tsx       # ADD: client component for truncation
└── app/
    └── leagues/[slug]/[match]/
        └── page.tsx               # UPDATE: ensure MatchContentSection included
```

### Pattern 1: Unified Content Query (COALESCE)
**What:** Single query that returns content from either table, prioritizing matchRoundups (full narrative) over matchContent (short sections)
**When to use:** Any time match content is needed for display
**Example:**
```typescript
// Source: Drizzle ORM Set Operations docs + SQL COALESCE pattern
// https://orm.drizzle.team/docs/set-operations
// https://www.w3schools.com/sql/func_sqlserver_coalesce.asp

import { sql } from 'drizzle-orm';
import { matchContent, matchRoundups } from '@/lib/db/schema';

export async function getMatchContentUnified(matchId: string) {
  const db = getDb();

  // Query both tables with left joins, use COALESCE to prioritize roundups
  const result = await db
    .select({
      matchId: matchContent.matchId,
      // COALESCE prefers roundup narrative over matchContent sections
      preMatchContent: sql`COALESCE(${matchContent.preMatchContent}, '')`.as('pre_match'),
      bettingContent: sql`COALESCE(${matchContent.bettingContent}, '')`.as('betting'),
      postMatchContent: sql`COALESCE(
        ${matchRoundups.narrative},
        ${matchContent.postMatchContent},
        ''
      )`.as('post_match'),
      hasRoundup: sql`${matchRoundups.id} IS NOT NULL`.as('has_roundup'),
    })
    .from(matchContent)
    .leftJoin(matchRoundups, eq(matchContent.matchId, matchRoundups.matchId))
    .where(eq(matchContent.matchId, matchId))
    .limit(1);

  return result[0] || null;
}
```

### Pattern 2: Progressive Disclosure with "Read More"
**What:** Client component that truncates long text with CSS line-clamp, expands on button click
**When to use:** Post-match narrative content exceeding 150-200 words (typically 800+ characters)
**Example:**
```typescript
// Source: React useState patterns + CSS line-clamp accessibility
// https://plainenglish.io/blog/creating-a-read-more-collapsible-component-in-reactjs-6d55fbc4ff0f
// https://www.sitelint.com/blog/truncating-text-and-making-it-accessible

'use client';

import { useState } from 'react';

interface ReadMoreTextProps {
  text: string;
  previewLength?: number; // Characters to show before truncation
  className?: string;
}

export function ReadMoreText({
  text,
  previewLength = 600,
  className
}: ReadMoreTextProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = text.length > previewLength;

  if (!shouldTruncate) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div className={className}>
      <div className={expanded ? '' : 'line-clamp-6'}>
        {text}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-primary hover:underline mt-2 text-sm font-medium"
        aria-expanded={expanded}
        aria-label={expanded ? 'Show less content' : 'Read full content'}
      >
        {expanded ? 'Show Less' : 'Read More'}
      </button>
    </div>
  );
}
```

### Pattern 3: Parallel Data Fetching
**What:** Use Promise.all to fetch match data, content, and predictions simultaneously
**When to use:** Server Components that need multiple data sources
**Example:**
```typescript
// Source: Next.js Data Fetching Patterns
// https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns

export default async function MatchPage({ params }) {
  const { id } = await params;

  // Fetch all data in parallel (no waterfalls)
  const [matchData, content, predictions] = await Promise.all([
    getMatchWithAnalysis(id),
    getMatchContentUnified(id),
    getPredictionsForMatch(id),
  ]);

  return (
    <>
      <MatchHeader match={matchData} />
      <MatchContentSection content={content} />
      <PredictionsTable predictions={predictions} />
    </>
  );
}
```

### Anti-Patterns to Avoid
- **Sequential queries**: Fetching matchContent, then checking if null, then fetching matchRoundups creates waterfalls
- **Client-side content fetching**: Content should be server-rendered for SEO/GEO (AI crawlers need visible HTML)
- **Missing accessibility**: "Read More" without aria-expanded/aria-label fails WCAG 1.3.1
- **Character-only truncation**: Splitting text mid-sentence; use CSS line-clamp for natural word breaks
- **No null checks**: Content may legitimately not exist yet (match not started, predictions not scored) - gracefully hide component

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text truncation | Custom JavaScript character counting | CSS `line-clamp` with overflow hidden | Native browser support, better performance, respects word boundaries |
| Read More state | Complex visibility logic | React useState with single boolean | Simple, predictable, follows React best practices |
| Multi-table queries | Manual result merging in JS | SQL COALESCE in Drizzle query | Type-safe, single round-trip, database-optimized |
| Content visibility detection | useEffect height measurements | CSS line-clamp with conditional rendering | Avoids layout thrashing, no useLayoutEffect needed |
| Accessibility attributes | Custom aria implementation | Standard aria-expanded + aria-label | WCAG-compliant, screen reader tested |

**Key insight:** CSS line-clamp handles truncation complexity (word boundaries, ellipsis, responsive reflow) better than JavaScript height detection. Drizzle's SQL template literal support (`sql\`COALESCE(...)\``) provides type safety while allowing raw SQL patterns for edge cases.

## Common Pitfalls

### Pitfall 1: Content Null Despite Database Records
**What goes wrong:** Queries return null even though content exists, users see blank sections
**Why it happens:** Query joins fail when only one table has data (matchContent XOR matchRoundups), or wrong conflict resolution on upserts
**How to avoid:**
- Use LEFT JOINs not INNER JOINs (allow null from either table)
- Use COALESCE to prefer roundup narrative if exists, fallback to matchContent post-match
- Check generator.ts writes are using correct onConflictDoUpdate targets
**Warning signs:** Content visible in database but not on match pages, null errors in query results

### Pitfall 2: CSS Line-Clamp Without Accessibility
**What goes wrong:** Screen readers read full text, visual users see truncated text with no expand option
**Why it happens:** CSS line-clamp hides content visually but not semantically (text still in DOM)
**How to avoid:**
- Always provide "Read More" button when text is clamped
- Use aria-expanded to indicate current state
- Use aria-label to describe action ("Read full content" not just "Read More")
- Test with screen readers (VoiceOver, NVDA)
**Warning signs:** Users report content "cut off", WCAG 1.3.1 failures, find-in-page confusion

### Pitfall 3: Sequential Query Waterfalls
**What goes wrong:** Page load takes 800ms+ with multiple round-trips to database
**Why it happens:** Fetching matchContent, checking if null, then fetching matchRoundups sequentially
**How to avoid:**
- Use unified query that joins both tables in single round-trip
- Use Promise.all for independent queries (match data + content + predictions)
- Leverage Next.js Suspense boundaries for progressive rendering
**Warning signs:** Slow TTFB, database logs showing sequential identical matchId queries

### Pitfall 4: Missing Match State Logic
**What goes wrong:** Pre-match content shows on finished matches, or post-match content shows before match ends
**Why it happens:** Component doesn't check match status before rendering content sections
**How to avoid:**
- Check match.status before deciding which content to display
- Scheduled → show preMatchContent only
- Live/Finished → show bettingContent + postMatchContent
- Hide sections gracefully if content null (don't show empty cards)
**Warning signs:** Wrong content type visible, stale content after match finishes

### Pitfall 5: Force-Dynamic Breaking ISR Strategy
**What goes wrong:** Match pages use force-dynamic, preventing any caching, causing slow loads
**Why it happens:** Developer assumed all match data is dynamic, didn't consider finished match caching
**How to avoid:**
- Use ISR with conditional revalidation (v1.3 Phase 15 will address)
- Finished matches can cache for 3600s (1 hour)
- Scheduled matches revalidate every 60s
- Live matches revalidate every 30s
**Warning signs:** Every page load hits database, TTFB consistently high, cache headers show no-store

## Code Examples

Verified patterns from official sources:

### Unified Content Query with Type Safety
```typescript
// Source: Drizzle ORM SQL template + COALESCE pattern
// https://orm.drizzle.team/docs/sql
// https://support.microsoft.com/en-us/office/use-a-union-query-to-combine-multiple-queries-into-a-single-result

import { getDb, matchContent, matchRoundups } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

export async function getMatchContentUnified(matchId: string) {
  const db = getDb();

  const result = await db
    .select({
      matchId: matchContent.matchId,
      preMatchContent: matchContent.preMatchContent,
      bettingContent: matchContent.bettingContent,
      // Prefer roundup narrative (long-form), fallback to matchContent post-match (short)
      postMatchContent: sql<string>`
        COALESCE(
          ${matchRoundups.narrative},
          ${matchContent.postMatchContent}
        )
      `.as('post_match_content'),
      postMatchGeneratedAt: sql<string>`
        CASE
          WHEN ${matchRoundups.id} IS NOT NULL THEN ${matchRoundups.publishedAt}
          ELSE ${matchContent.postMatchGeneratedAt}
        END
      `.as('post_match_generated_at'),
      hasFullRoundup: sql<boolean>`${matchRoundups.id} IS NOT NULL`.as('has_full_roundup'),
    })
    .from(matchContent)
    .leftJoin(matchRoundups, eq(matchContent.matchId, matchRoundups.matchId))
    .where(eq(matchContent.matchId, matchId))
    .limit(1);

  return result[0] || null;
}
```

### Read More Component with Accessibility
```typescript
// Source: React useState patterns + Accessibility best practices
// https://hurricanejay.medium.com/truncating-text-with-read-more-read-less-button-9fa6c33a8c1
// https://www.sitelint.com/blog/truncating-text-and-making-it-accessible

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ReadMoreTextProps {
  text: string;
  previewLines?: number; // CSS line-clamp value
  className?: string;
}

export function ReadMoreText({
  text,
  previewLines = 6,
  className
}: ReadMoreTextProps) {
  const [expanded, setExpanded] = useState(false);

  // Rough heuristic: 150-200 words ≈ 6 lines at normal font size
  const CHARS_PER_LINE = 100;
  const shouldTruncate = text.length > (previewLines * CHARS_PER_LINE);

  if (!shouldTruncate) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div>
      <div
        className={cn(
          className,
          !expanded && `line-clamp-${previewLines}`
        )}
      >
        {text}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-primary hover:underline mt-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse content to preview' : 'Expand to read full content'}
        type="button"
      >
        {expanded ? '← Show Less' : 'Read More →'}
      </button>
    </div>
  );
}
```

### Updated MatchContentSection with State Logic
```typescript
// Source: Next.js Server Components + React patterns
// https://nextjs.org/docs/app/getting-started/server-and-client-components

import { getMatchContentUnified } from '@/lib/db/queries';
import { Card, CardContent } from '@/components/ui/card';
import { ReadMoreText } from '@/components/match/ReadMoreText';
import type { Match } from '@/lib/db/schema';

interface MatchContentSectionProps {
  matchId: string;
  matchStatus: Match['status']; // 'scheduled' | 'live' | 'finished'
}

export async function MatchContentSection({
  matchId,
  matchStatus
}: MatchContentSectionProps) {
  const content = await getMatchContentUnified(matchId);

  // Hide entire section if no content exists
  if (!content) {
    return null;
  }

  const showPreMatch = matchStatus === 'scheduled' && content.preMatchContent;
  const showBetting = (matchStatus === 'live' || matchStatus === 'finished') && content.bettingContent;
  const showPostMatch = matchStatus === 'finished' && content.postMatchContent;

  // Hide if no applicable content for this match state
  if (!showPreMatch && !showBetting && !showPostMatch) {
    return null;
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6 space-y-8">
        {/* Pre-match section (scheduled only) */}
        {showPreMatch && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Market Expectations
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.preMatchContent}
            </p>
          </div>
        )}

        {/* Divider */}
        {showPreMatch && showBetting && (
          <div className="border-t border-border/30" />
        )}

        {/* Betting section (live/finished) */}
        {showBetting && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              AI Model Predictions
            </h3>
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              {content.bettingContent}
            </p>
          </div>
        )}

        {/* Divider */}
        {showBetting && showPostMatch && (
          <div className="border-t border-border/30" />
        )}

        {/* Post-match section (finished only) - with Read More */}
        {showPostMatch && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Match Report
            </h3>
            <ReadMoreText
              text={content.postMatchContent}
              previewLines={6}
              className="text-foreground leading-relaxed text-sm md:text-base"
            />
            {content.postMatchGeneratedAt && (
              <p className="text-xs text-muted-foreground/60 mt-2">
                Generated {new Date(content.postMatchGeneratedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate queries for matchContent/matchRoundups | Unified query with COALESCE | v1.3 Phase 13 | Single round-trip, prioritized content source |
| Client-side text truncation (useEffect) | CSS line-clamp with useState toggle | 2023+ | Better performance, fewer re-renders, native word breaks |
| Sequential data fetching | Promise.all parallel queries | Next.js 13+ App Router | Eliminates waterfalls, faster page loads |
| force-dynamic on all pages | ISR with conditional revalidation | v1.3 Phase 15 | Finished matches cache, live matches stay fresh |
| Character-based truncation | Line-based truncation (line-clamp) | 2022+ CSS standard | Respects layout, handles responsive reflow |

**Deprecated/outdated:**
- `-webkit-line-clamp` (now standard `line-clamp` property, but webkit prefix still needed for compatibility)
- Class components for progressive disclosure (use functional components + useState)
- useLayoutEffect for height detection (CSS line-clamp handles this natively)
- INNER JOIN for optional content (use LEFT JOIN + COALESCE)

## Open Questions

Things that couldn't be fully resolved:

1. **Roundup vs MatchContent Priority**
   - What we know: Both tables can have post-match content, roundups are longer/richer
   - What's unclear: Should we ALWAYS prefer roundup narrative, or only if matchContent post-match is null?
   - Recommendation: COALESCE(roundup.narrative, matchContent.postMatchContent) - prefer roundup, fallback to short-form

2. **Preview Length for Read More**
   - What we know: Requirement says "150-200 words", CSS line-clamp uses line count
   - What's unclear: Optimal line count for mobile vs desktop (6 lines? 8 lines?)
   - Recommendation: Use 6 lines (≈150-180 words at 14px font), test on actual content length distribution

3. **Truncation on HTML vs Plain Text**
   - What we know: Post-match content may contain HTML (from roundup generation)
   - What's unclear: Does CSS line-clamp work correctly with HTML elements, or strip to plain text first?
   - Recommendation: Test with actual HTML roundup content; may need dangerouslySetInnerHTML if HTML formatting needed

4. **ISR Revalidation Strategy**
   - What we know: Phase 15 will implement ISR, Phase 13 fixes content display
   - What's unclear: Should Phase 13 add ISR immediately or wait for Phase 15?
   - Recommendation: Keep force-dynamic for now (Phase 13 scope creep risk), let Phase 15 handle caching strategy

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Set Operations](https://orm.drizzle.team/docs/set-operations) - UNION, COALESCE patterns
- [Drizzle ORM SQL Template](https://orm.drizzle.team/docs/sql) - Raw SQL with type safety
- [Next.js Data Fetching Patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns) - Parallel queries, Server Components
- [Next.js Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Server vs client rendering
- [CSS line-clamp MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp) - Standard truncation property
- [Truncating Text Accessibility](https://www.sitelint.com/blog/truncating-text-and-making-it-accessible) - WCAG compliance for truncation

### Secondary (MEDIUM confidence)
- [SQL COALESCE Function](https://www.w3schools.com/sql/func_sqlserver_coalesce.asp) - First non-null value pattern
- [React Read More Component Patterns](https://plainenglish.io/blog/creating-a-read-more-collapsible-component-in-reactjs-6d55fbc4ff0f) - useState toggle implementation
- [Progressive Disclosure UX](https://www.algolia.com/blog/ux/information-density-and-progressive-disclosure-search-ux) - When to use read more patterns
- [CSS Line Clamp Tutorial](https://blog.logrocket.com/css-line-clamp/) - Multi-line truncation examples

### Tertiary (LOW confidence)
- [Drizzle ORM Union Issues](https://github.com/drizzle-team/drizzle-orm/issues/2490) - Known limitations with 3+ unions
- [React Show More Libraries](https://www.npmjs.com/package/react-show-more-text) - Alternative to custom implementation (not needed, simple useState sufficient)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in project, official documentation verified
- Architecture: HIGH - Patterns verified with official Drizzle/Next.js docs and current codebase
- Pitfalls: HIGH - Derived from common database query patterns and accessibility standards

**Research date:** 2026-02-02
**Valid until:** ~30 days (stable stack, no fast-moving dependencies)
