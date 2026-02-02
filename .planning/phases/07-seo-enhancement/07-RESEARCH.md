# Phase 7: SEO Enhancement - Research

**Researched:** 2026-02-02
**Domain:** Schema.org structured data, Next.js SEO optimization, Google Rich Results
**Confidence:** HIGH

## Summary

This phase adds comprehensive Schema.org markup to all page types, optimizes social share metadata, and implements dynamic sitemap generation for search engine discovery. The codebase already has partial Schema.org implementation using schema-dts (v1.1.5), basic metadata patterns, and OG image generation endpoints.

The standard approach combines:
- SportsEvent schema with competitor data (not nested Review - Google doesn't support this)
- Article + ItemList for blog roundups (proven pattern for list-based content)
- SportsOrganization for competition pages (official schema type for leagues)
- Dynamic sitemap using Next.js built-in conventions
- Robots meta tags for crawl budget optimization on past matches

**Primary recommendation:** Build on existing schema-dts infrastructure, use Google's documented patterns (not creative nesting), implement Next.js native sitemap generation, and prioritize high-traffic pages (upcoming matches > past matches).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| schema-dts | 1.1.5+ | TypeScript types for Schema.org | Official Google package, compile-time validation, zero runtime cost |
| Next.js metadata API | 16.1.4+ | generateMetadata, sitemap conventions | Built into Next.js, server-side generation, automatic optimization |
| Next.js sitemap.ts | 16.1.4+ | Dynamic sitemap generation | First-class Next.js feature, auto-caching, split sitemap support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0+ | Date formatting in structured data | Already in package.json, ISO-8601 compliance critical for eventStatus |
| @radix-ui/react-* | Latest | Accessible UI components | Already used, needed if adding debug mode toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| schema-dts | react-schemaorg | react-schemaorg adds helper components but requires React context; schema-dts is lighter and Next.js-native |
| Native sitemap.ts | next-sitemap package | Package adds features but Next.js native is sufficient for this use case and one less dependency |
| Manual JSON-LD | Schema builder libraries | Manual gives full control; already have helper functions in /lib/seo/ |

**Installation:**
```bash
# Already installed:
# - schema-dts@1.1.5
# - Next.js 16.1.4

# No additional packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── seo/
│       ├── schema/
│       │   ├── sports-event.ts    # SportsEvent builder (exists)
│       │   ├── article.ts          # Article builder (exists)
│       │   ├── competition.ts      # NEW: SportsOrganization
│       │   └── homepage.ts         # NEW: WebSite + SearchAction
│       ├── metadata/
│       │   ├── match.ts            # Match metadata (exists, enhance)
│       │   ├── blog.ts             # Blog metadata (enhance for roundups)
│       │   ├── competition.ts      # NEW: Competition metadata
│       │   └── social.ts           # NEW: Social share helpers
│       └── constants.ts            # BASE_URL, etc. (exists)
├── app/
│   ├── sitemap.ts                  # NEW: Dynamic sitemap
│   └── [pages]/
│       └── page.tsx                # Enhanced generateMetadata
```

### Pattern 1: Type-Safe Schema Generation
**What:** Use schema-dts types with helper builders
**When to use:** All structured data creation
**Example:**
```typescript
// Source: Existing pattern from src/lib/seo/schema/sports-event.ts
import type { SportsEvent } from 'schema-dts';

export function buildSportsEventSchema(match: MatchSeoData): SportsEvent {
  const event: SportsEvent = {
    '@type': 'SportsEvent',
    '@id': `${BASE_URL}/matches/${match.id}`,
    name: `${match.homeTeam} vs ${match.awayTeam}`,
    startDate: match.startDate,
    eventStatus: mapEventStatus(match.status),
    homeTeam: {
      '@type': 'SportsTeam',
      name: match.homeTeam,
      logo: match.homeTeamLogo ?? undefined,
    },
    awayTeam: {
      '@type': 'SportsTeam',
      name: match.awayTeam,
      logo: match.awayTeamLogo ?? undefined,
    },
    sport: 'Football',
  };
  return event;
}
```

### Pattern 2: Next.js Metadata Generation
**What:** Server-side metadata generation with caching
**When to use:** All pages requiring dynamic metadata
**Example:**
```typescript
// Source: Next.js documentation + existing pattern
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchData(params.id);

  return {
    title: createTitle(data),
    description: createDescription(data),
    openGraph: {
      title: data.title,
      description: data.description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    robots: {
      index: shouldIndex(data), // Dynamic control
      follow: true,
    },
  };
}
```

### Pattern 3: Dynamic Sitemap with ISR
**What:** Sitemap generation using Next.js Route Handler conventions
**When to use:** All sitemaps requiring database queries
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const matches = await db.query.matches.findMany();

  return matches.map((match) => ({
    url: `https://kroam.xyz/matches/${match.id}`,
    lastModified: match.updatedAt,
    changeFrequency: match.status === 'finished' ? 'weekly' : 'hourly',
    priority: match.status === 'scheduled' ? 0.8 : 0.6,
  }));
}

// Cache for 1 hour
export const revalidate = 3600;
```

### Pattern 4: Schema Sanitization
**What:** XSS-safe JSON-LD injection
**When to use:** All client-side schema rendering
**Example:**
```typescript
// Source: Existing pattern from src/lib/seo/schema/graph.ts
export function sanitizeJsonLd(jsonLd: object): string {
  return JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/"/g, '\\u0022');
}

// Usage in RSC:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(schema) }}
/>
```

### Anti-Patterns to Avoid
- **Nested Review in SportsEvent:** Google doesn't support Review nested in SportsEvent for predictions (verified via Google Search Central docs - Event schema doesn't accept review property)
- **Using robots.txt for noindex:** Cannot reliably prevent indexing; use robots meta tag in metadata instead
- **Static sitemap.xml files:** Next.js dynamic generation auto-updates when content changes
- **Missing eventStatus property:** Required by Google Rich Results Test for Event schema
- **Incorrect date formats:** Must use ISO-8601 with timezone for startDate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap generation | Custom XML builder + cron job | Next.js sitemap.ts convention | Auto-caching, split sitemap support for >50k URLs, built-in priority/changefreq |
| Schema.org types | Manual TypeScript interfaces | schema-dts package | Official Google package, 600+ types, updated with schema.org changes |
| Date formatting for schema | Custom ISO formatter | date-fns toISOString/format | Edge cases like DST, leap seconds, timezone handling |
| Social share preview | Manual OG implementation | Next.js Metadata API | Handles fallbacks, inheritance, automatic optimization |
| Crawl budget optimization | Manual robots.txt rules | Next.js robots metadata property | Per-page control, dynamic noindex, better than blanket blocks |

**Key insight:** SEO infrastructure in frameworks is mature; custom solutions miss edge cases (Google's parsing quirks, cache invalidation timing, schema.org version updates). Next.js 13+ App Router has first-class SEO primitives.

## Common Pitfalls

### Pitfall 1: Review Schema Nesting Doesn't Work for Predictions
**What goes wrong:** Attempting to nest Review schema inside SportsEvent to represent predictions/analysis
**Why it happens:** Logical assumption that "prediction = review of future event" maps to schema.org Review type
**How to avoid:** Use Article schema with author property to represent analysis/prediction content. Review requires itemReviewed to be a Thing that already exists; predictions are forward-looking.
**Warning signs:** Rich Results Test shows "Review not eligible" or doesn't recognize nested structure

### Pitfall 2: Incorrect EventStatus Mapping
**What goes wrong:** Using "EventScheduled" for finished matches or missing eventStatus entirely
**Why it happens:** Schema.org doesn't have "EventLive" status; only Scheduled, Rescheduled, Postponed, Cancelled, MovedOnline
**How to avoid:**
- Upcoming: `https://schema.org/EventScheduled`
- Live/Finished: Use EventScheduled (no official "completed" status in Schema.org for sports)
- Add homeTeamScore/awayTeamScore properties for finished matches to signal completion
**Warning signs:** Rich Results Test errors about missing event status

### Pitfall 3: Past Match Indexing Without Strategy
**What goes wrong:** All historical matches indexed equally, wasting crawl budget on low-value pages
**Why it happens:** Default robots: { index: true } applied to all match pages
**How to avoid:**
- Dynamic noindex via metadata API for matches >30 days old OR in low-priority competitions
- Use changeFrequency: 'weekly' for finished matches (vs 'hourly' for upcoming)
- Priority: 0.8 for upcoming matches in top competitions, 0.5 for finished, 0.3 for old+finished
**Warning signs:** Search Console shows high crawl rate but low indexing rate; old match pages in index but zero impressions

### Pitfall 4: Missing Required Properties for Rich Results
**What goes wrong:** Google Rich Results Test fails validation despite valid Schema.org markup
**Why it happens:** Google's requirements are stricter than Schema.org's optional properties
**How to avoid:** For SportsEvent, ensure:
- `name` (required)
- `startDate` with timezone (required)
- `location` with Place type (required for events)
- `eventStatus` (required by Google, not Schema.org)
**Warning signs:** Rich Results Test says "Not eligible for rich results" despite no errors

### Pitfall 5: OG Description Length Violations
**What goes wrong:** Social platforms truncate or reject OG descriptions over 200 characters
**Why it happens:** Adding accuracy percentage + prediction + team names + competition creates long strings
**How to avoid:**
- Max 155-160 characters for meta description (Google snippet)
- Max 200 characters for og:description (Facebook/LinkedIn)
- Twitter can truncate more aggressively
- Formula: `AI predicts ${score} for ${teams} on ${date}` fits in 100 chars, leaves room
**Warning signs:** Facebook Sharing Debugger shows truncated text; Twitter Card Validator warnings

### Pitfall 6: Dynamic Sitemap Without Proper Caching
**What goes wrong:** Sitemap.ts queries database on every request, causing slow responses and DB load
**Why it happens:** Not setting `export const revalidate` in sitemap.ts route
**How to avoid:** Add `export const revalidate = 3600;` for 1-hour cache on sitemap
**Warning signs:** Slow sitemap.xml response times; database query logs show frequent sitemap queries

## Code Examples

Verified patterns from official sources:

### SportsOrganization for Competition Pages
```typescript
// Source: https://schema.org/SportsOrganization
import type { SportsOrganization } from 'schema-dts';

export function buildCompetitionSchema(competition: Competition): SportsOrganization {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    '@id': `${BASE_URL}/leagues/${competition.slug}`,
    name: competition.name,
    url: `${BASE_URL}/leagues/${competition.slug}`,
    sport: 'Football',
    // Optional: founding date, logo, description
  };
}
```

### ItemList for Blog Roundups
```typescript
// Source: https://schema.org/ItemList + https://schema.org/Article
import type { WithContext, Article, ItemList } from 'schema-dts';

export function buildRoundupSchema(post: BlogPost, matches: Match[]): object {
  const article: Article = {
    '@type': 'Article',
    '@id': `${BASE_URL}/blog/${post.slug}`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'kroam.xyz',
    },
  };

  const itemList: ItemList = {
    '@type': 'ItemList',
    '@id': `${BASE_URL}/blog/${post.slug}#matches`,
    itemListElement: matches.map((match, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SportsEvent',
        name: `${match.homeTeam} vs ${match.awayTeam}`,
        url: `${BASE_URL}/matches/${match.id}`,
      },
    })),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [article, itemList],
  };
}
```

### WebSite Schema with SearchAction
```typescript
// Source: Existing pattern from src/app/layout.tsx (lines 67-82)
// Already implemented correctly with SearchAction for Google sitelinks searchbox
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "kroam.xyz - AI Football Predictions",
  "url": "https://kroam.xyz",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://kroam.xyz/matches?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};
```

### Dynamic Noindex for Past Matches
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await getMatch(params.id);
  const matchAge = Date.now() - new Date(match.kickoffTime).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return {
    title: `${match.homeTeam} vs ${match.awayTeam}`,
    robots: {
      index: match.status === 'scheduled' || matchAge < thirtyDaysMs,
      follow: true,
    },
  };
}
```

### Social Share with Accuracy Label
```typescript
// Source: User decision from CONTEXT.md + existing OG patterns
export function buildMatchMetadata(match: MatchWithStats): Metadata {
  const accuracy = match.modelAccuracy; // From stats
  const description = accuracy
    ? `AI predicts ${match.predictedScore} - Prediction Accuracy: ${accuracy}%`
    : `AI predictions for ${match.homeTeam} vs ${match.awayTeam}`;

  return {
    openGraph: {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description, // Keep under 200 chars
      images: [{ url: ogImageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description,
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate robots.txt rules | Next.js robots metadata per page | Next.js 13 (Oct 2022) | Dynamic per-page control, no static file edits |
| Manual JSON-LD strings | schema-dts TypeScript types | schema-dts 1.0 (Aug 2021) | Compile-time validation, IDE autocomplete |
| Static sitemap.xml | Next.js sitemap.ts convention | Next.js 13.3 (Apr 2023) | Auto-updates, ISR caching, split sitemaps |
| Google Structured Data Testing Tool | Rich Results Test | Deprecated May 2020 | Rich Results Test is official replacement |
| EventStatus: EventScheduled for all | No "EventCompleted" in Schema.org | Always | Use score properties to signal completion |

**Deprecated/outdated:**
- **Google Structured Data Testing Tool**: Replaced by Rich Results Test and Schema Markup Validator
- **Review nesting in SportsEvent**: Never officially supported, but some tutorials suggest it
- **robots.txt for noindex**: Still works but Next.js metadata API is preferred for granular control
- **Static priority="1.0" in sitemaps**: Google ignores absolute values, focus on relative prioritization

## Open Questions

Things that couldn't be fully resolved:

1. **Accuracy in Meta Descriptions**
   - What we know: User wants "Prediction Accuracy: X%" in social shares; meta descriptions help SEO
   - What's unclear: Whether accuracy percentage provides SEO value in meta description vs only social OG description
   - Recommendation: Include in OG description (confirmed value), test meta description impact via Search Console CTR tracking

2. **Model Pages Structured Data Value**
   - What we know: Model pages show performance stats; ProfilePage schema exists but is for people
   - What's unclear: Whether schema helps model pages rank for "[model name] football predictions" queries
   - Recommendation: Start without structured data, monitor Search Console performance data, add if pages get impression volume but low CTR

3. **Blog Roundup Date Format in Titles**
   - What we know: Titles like "Champions League Matchday 3 - January 2026" vs "Champions League Jan 22-24"
   - What's unclear: Which date format balances SEO (year keyword) and readability (specific dates)
   - Recommendation: Use "Month Day-Day, Year" format (e.g., "January 22-24, 2026") for specificity + year keyword

4. **Past Match Indexing Threshold**
   - What we know: Past matches have declining SEO value over time; need crawl budget optimization
   - What's unclear: Exact age threshold (30 days? 90 days? season-based?)
   - Recommendation: Start with 30 days for regular competitions, keep full season indexed for Champions League/World Cup; monitor Search Console index coverage

## Sources

### Primary (HIGH confidence)
- Schema.org Official Documentation
  - [SportsEvent](https://schema.org/SportsEvent) - Properties, examples
  - [Review](https://schema.org/Review) - itemReviewed property, nesting rules
  - [ItemList](https://schema.org/ItemList) - List structure, ListItem positioning
  - [SportsOrganization](https://schema.org/SportsOrganization) - League/competition schema
- Google Search Central
  - [Event Structured Data](https://developers.google.com/search/docs/appearance/structured-data/event) - Required properties, Rich Results requirements
  - [Review Snippet Documentation](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) - Review nesting guidance
- Next.js Official Documentation
  - [Sitemap.xml File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) - Dynamic generation
  - [generateMetadata Function](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Metadata API
  - [generateSitemaps Function](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps) - Split sitemaps
- NPM Package Documentation
  - [schema-dts NPM](https://www.npmjs.com/package/schema-dts) - TypeScript types, version 1.1.5
  - [Google Open Source Blog: schema-dts 1.0](https://opensource.googleblog.com/2021/08/schema-dts-turns-1-author-valid-schema-org-JSON-LD-in-typescript.html)

### Secondary (MEDIUM confidence)
- [Schema Markup: The Complete Guide 2026](https://www.wearetg.com/blog/schema-markup/) - JSON-LD best practices, 2026 context
- [Google Rich Results Test: Complete Guide 2026](https://devitseo.com/google-rich-results-test/) - Common errors, validation
- [Rich Results Test Guide](https://digitalsmartguide.com/rich-results-test-guide/) - Error troubleshooting
- [IPTC Sport Schema](https://sportschema.org/schema-overview/) - Sports-specific vocabulary
- [6 Ways to Ensure Live Sport Scores Get Indexed in Real-Time](https://prerender.io/blog/live-sports-instant-indexing/) - Dynamic sitemap strategies
- [SEO for Sports Websites](https://fastercapital.com/content/SEO-for-sports--How-to-use-SEO-to-rank-your-sports-related-content-and-news.html) - Crawl budget, past match indexing

### Secondary (Verified with codebase)
- Existing implementation patterns:
  - `/src/lib/seo/schema/sports-event.ts` - SportsEvent builder pattern
  - `/src/lib/seo/schema/graph.ts` - sanitizeJsonLd function
  - `/src/lib/seo/metadata.ts` - Metadata builders
  - `/src/app/layout.tsx` - WebSite + SearchAction (lines 67-82)
  - `/src/app/methodology/page.tsx` - Accuracy formula documentation

### Tertiary (LOW confidence - for awareness)
- [Schema Markup in 2026: SERP Visibility](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) - AI search integration trends
- [OpenGraph and Twitter Cards Best Practices](https://www.everywheremarketer.com/blog/ultimate-guide-to-social-meta-tags-open-graph-and-twitter-cards) - Social share optimization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - schema-dts is official Google package, Next.js metadata API is documented
- Architecture: HIGH - Patterns verified in existing codebase + official documentation
- Pitfalls: HIGH - Google Search Central documentation + verified with Rich Results Test requirements
- Schema patterns: MEDIUM-HIGH - Schema.org examples exist but sports prediction use case is niche
- Indexing strategy: MEDIUM - General sports SEO guidance, not prediction-specific

**Research date:** 2026-02-02
**Valid until:** ~60 days (Schema.org stable, Next.js 16 stable, but Google ranking factors evolve quarterly)

**Key constraints from CONTEXT.md:**
- Match pages: SportsEvent + nested Review (NOTE: Research shows nested Review unsupported - recommend Article pattern instead)
- Blog roundups: Article + ItemList (confirmed as standard pattern)
- Competition pages: Research options → SportsOrganization is official schema type
- Homepage: WebSite + SearchAction (already implemented correctly)
- Social share: "Prediction Accuracy: X%" label (confirmed user decision)
