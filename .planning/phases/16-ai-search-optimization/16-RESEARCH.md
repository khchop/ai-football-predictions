# Phase 16: AI Search Optimization - Research

**Researched:** 2026-02-02
**Domain:** AI Search / Generative Engine Optimization (GEO)
**Confidence:** HIGH

## Summary

This phase focuses on optimizing match pages for AI search engines (ChatGPT, Perplexity, Claude, Gemini) through four key areas: robots.txt configuration for AI crawlers, llms.txt structured content, consolidated Schema.org JSON-LD graphs, and ensuring AI-generated content renders server-side.

The codebase already has strong foundations: robots.txt allows most AI crawlers (missing Amazonbot), llms.txt and llms-full.txt exist with comprehensive content, and Schema.org markup exists but uses multiple separate script tags instead of a consolidated `@graph` array. The main SSR issue is that `MatchRoundup` component is client-only (`'use client'`), meaning AI crawlers cannot see post-match analysis content.

**Primary recommendation:** Consolidate existing Schema.org scripts into a single `@graph` array per page, add Amazonbot to robots.txt, and ensure all AI-generated content (pre-match, post-match narratives) renders server-side. The new league-based match pages (`/leagues/[slug]/[match]/page.tsx`) already handle most content server-side via `MatchContentSection`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.x | Dynamic robots.ts, route handlers | Native support for metadata API |
| schema-dts | 1.x | TypeScript types for Schema.org | Type-safe structured data |
| JSON-LD | Native | Structured data format | Google's recommended format |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Rich Results Test | - | Validate rich result eligibility | Testing structured data |
| Schema.org Validator | - | Validate against schema.org spec | Comprehensive validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single @graph | Multiple script tags | Multiple tags cause validation warnings and fragmented entity relationships |
| Dynamic llms.txt | Static file | Dynamic allows real-time model count; static is simpler |

**Installation:**
No additional packages needed - existing stack is sufficient.

## Architecture Patterns

### Recommended Schema.org Structure

**Current (problematic):**
```
<script type="application/ld+json">{ "@type": "SportsEvent"... }</script>
<script type="application/ld+json">{ "@type": "WebPage"... }</script>
<script type="application/ld+json">{ "@type": "BreadcrumbList"... }</script>
```

**Target (consolidated):**
```
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "SportsEvent", "@id": "...", ... },
    { "@type": "WebPage", "@id": "...", ... },
    { "@type": "BreadcrumbList", ... }
  ]
}
</script>
```

### Project Structure for Schema
```
src/lib/seo/
├── schema/
│   ├── graph.ts           # @graph consolidation (EXISTS, needs update)
│   ├── sports-event.ts    # SportsEvent builder (EXISTS)
│   ├── article.ts         # NewsArticle builder (EXISTS)
│   ├── breadcrumb.ts      # BreadcrumbList builder (EXISTS)
│   └── webpage.ts         # WebPage builder (NEW)
└── types.ts               # Shared SEO types (EXISTS)
```

### Pattern 1: Consolidated Graph Schema
**What:** Single JSON-LD script with `@graph` array containing all page entities
**When to use:** Every page with multiple Schema.org types
**Example:**
```typescript
// Source: Existing graph.ts pattern + industry best practice
export function buildPageGraphSchema(options: {
  sportsEvent?: SportsEvent;
  webPage?: WebPage;
  breadcrumbs?: BreadcrumbItem[];
  organization?: Organization;
}): object {
  const graphItems: unknown[] = [];

  if (options.organization) graphItems.push(options.organization);
  if (options.sportsEvent) graphItems.push(options.sportsEvent);
  if (options.webPage) graphItems.push(options.webPage);
  if (options.breadcrumbs) {
    graphItems.push(buildBreadcrumbSchema(options.breadcrumbs));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graphItems,
  };
}
```

### Pattern 2: Server-Side Content Rendering
**What:** Fetch AI-generated content server-side, not client-side
**When to use:** Any content that should be visible to crawlers
**Example:**
```typescript
// GOOD: Server component fetches data
export async function MatchContentSection({ matchId }: Props) {
  const content = await getMatchContent(matchId); // Server-side fetch
  return <div>{content.preMatchContent}</div>;    // Renders in HTML
}

// BAD: Client component fetches data (invisible to crawlers)
'use client';
export function MatchRoundup({ matchId }: Props) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(...) }, []); // Client-only, crawlers miss this
  return <div>{data?.content}</div>;
}
```

### Anti-Patterns to Avoid
- **Multiple JSON-LD script tags:** Creates validation errors about "expected array"; use single `@graph` instead
- **Client-side content fetching:** AI crawlers don't execute JavaScript; use server components or SSR
- **Generic robots.txt rules:** AI crawlers have specific user-agents; list them explicitly
- **Outdated crawler lists:** AI crawler landscape evolves; include Amazonbot, SearchGPT, Claude-SearchBot

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema.org types | Custom type definitions | schema-dts package | Type-safe, auto-updated with spec |
| JSON-LD escaping | Manual string replace | JSON.stringify + XSS escaping | Edge cases handled correctly |
| robots.txt generation | Static file | Next.js robots.ts | Dynamic rules, type-safe |
| Sitemap for AI | Separate AI sitemap | llms.txt links to existing sitemap | Spec recommends single source |

**Key insight:** The llms.txt specification is additive to existing SEO infrastructure, not a replacement. It links to your existing sitemap, robots.txt, and content structure.

## Common Pitfalls

### Pitfall 1: Client-Side AI Content
**What goes wrong:** AI-generated narratives (pre-match, post-match) only visible after JavaScript execution
**Why it happens:** Using `'use client'` components with `useEffect` to fetch content
**How to avoid:** Use async server components; fetch content in `page.tsx` and pass as props
**Warning signs:** Content missing in "View Source" but visible in rendered page

### Pitfall 2: Multiple JSON-LD Scripts
**What goes wrong:** Google Rich Results Test shows warnings; entities not properly linked
**Why it happens:** Adding new schema types in separate script tags for simplicity
**How to avoid:** Use single `@graph` array with `@id` cross-references between entities
**Warning signs:** Multiple `<script type="application/ld+json">` tags per page

### Pitfall 3: Missing AI Crawler User-Agents
**What goes wrong:** Content not indexed by specific AI platforms
**Why it happens:** AI crawler landscape changes frequently; new bots emerge
**How to avoid:** Maintain explicit allow rules for all major AI crawlers; review quarterly
**Warning signs:** Traffic from AI search engines lower than expected

### Pitfall 4: llms.txt Without Links
**What goes wrong:** AI systems can't navigate to detailed content
**Why it happens:** Creating llms.txt as prose without structured URL lists
**How to avoid:** Follow spec: H1, blockquote summary, then H2 sections with markdown links
**Warning signs:** llms.txt is informative but doesn't help AI systems crawl efficiently

### Pitfall 5: EventCompleted vs EventScheduled
**What goes wrong:** Schema.org shows finished events as "EventScheduled"
**Why it happens:** Incorrect status mapping in SportsEvent schema
**How to avoid:** Map match status to correct EventStatus (EventScheduled, EventInProgress, EventCompleted)
**Warning signs:** Finished matches still show as upcoming in rich results

## Code Examples

Verified patterns from official sources and codebase:

### robots.ts with AI Crawlers
```typescript
// Source: Next.js docs + current codebase + AI crawler research
import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/_next/', '/static/'],
      },
      // OpenAI crawlers
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      // Anthropic crawlers
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-SearchBot', allow: '/' },
      { userAgent: 'Anthropic-AI', allow: '/' },
      // Perplexity
      { userAgent: 'PerplexityBot', allow: '/' },
      // Amazon
      { userAgent: 'Amazonbot', allow: '/' },
      // Google AI
      { userAgent: 'Google-Extended', allow: '/' },
      // Common Crawl (training data)
      { userAgent: 'CCBot', allow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

### Consolidated JSON-LD Graph
```typescript
// Source: Industry best practice (Yoast approach) + existing graph.ts
interface PageSchemaOptions {
  match: MatchSeoData;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  matchSlug: string;
}

export function buildMatchPageGraph(options: PageSchemaOptions): object {
  const matchUrl = `${BASE_URL}/leagues/${options.competitionSlug}/${options.matchSlug}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      // Organization (referenced by other entities)
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}#organization`,
        name: 'kroam.xyz',
        url: BASE_URL,
        logo: `${BASE_URL}/logo.png`,
      },
      // SportsEvent
      {
        '@type': 'SportsEvent',
        '@id': matchUrl,
        name: `${options.match.homeTeam} vs ${options.match.awayTeam}`,
        startDate: options.match.startDate,
        eventStatus: mapEventStatus(options.match.status),
        // ... rest of event properties
      },
      // WebPage
      {
        '@type': 'WebPage',
        '@id': `${matchUrl}#webpage`,
        url: matchUrl,
        name: `${options.match.homeTeam} vs ${options.match.awayTeam} Prediction`,
        isPartOf: { '@id': `${BASE_URL}#website` },
        about: { '@id': matchUrl }, // Reference to SportsEvent
      },
      // BreadcrumbList
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Leagues', item: `${BASE_URL}/leagues` },
          { '@type': 'ListItem', position: 3, name: options.competitionName, item: `${BASE_URL}/leagues/${options.competitionSlug}` },
          { '@type': 'ListItem', position: 4, name: `${options.match.homeTeam} vs ${options.match.awayTeam}`, item: matchUrl },
        ],
      },
    ],
  };
}
```

### llms.txt Structure
```markdown
# Source: llmstxt.org specification

# Site Name

> Brief summary with key information about the site

## Key Features
- Feature 1
- Feature 2

## Documentation
- [Getting Started](https://example.com/docs/start): Introduction guide
- [API Reference](https://example.com/docs/api): Full API documentation

## Optional
- [Blog](https://example.com/blog): Latest updates
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| robots.txt only | robots.txt + llms.txt | 2024-2025 | llms.txt provides AI-specific guidance |
| Block AI crawlers | Allow AI crawlers | 2024-2025 | AI citation drives traffic from Perplexity, ChatGPT |
| Multiple JSON-LD | Single @graph array | 2023+ | Better entity relationships, fewer validation errors |
| SDTT validation | Rich Results Test + Schema Validator | 2021 | Google deprecated SDTT |

**Deprecated/outdated:**
- Google Structured Data Testing Tool (SDTT): Deprecated 2021, use Rich Results Test or Schema.org Validator
- Blocking GPTBot: Reduces visibility in ChatGPT search and Perplexity citations
- EventStatus hardcoding: Should dynamically map from match status

## Open Questions

Things that couldn't be fully resolved:

1. **llms.txt Adoption by AI Crawlers**
   - What we know: Major sites implement it (Anthropic, Cloudflare, Stripe); 844k+ sites have it
   - What's unclear: Whether GPTBot, ClaudeBot, PerplexityBot actually read it (evidence suggests they don't yet)
   - Recommendation: Implement anyway - low cost, potential future value, signals AI-friendliness

2. **AI Crawler Rate Limiting**
   - What we know: AI crawlers can be aggressive; Perplexity crawls more than GPTBot
   - What's unclear: Optimal rate limits that balance visibility vs server load
   - Recommendation: Monitor server logs for AI crawler traffic patterns before limiting

3. **SearchGPT vs GPTBot**
   - What we know: OAI-SearchBot is newer (late 2024); GPTBot is for training
   - What's unclear: Whether to allow both or differentiate treatment
   - Recommendation: Allow both - OAI-SearchBot drives citation traffic

## Sources

### Primary (HIGH confidence)
- [Next.js robots.ts documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) - Official Next.js API
- [llmstxt.org specification](https://llmstxt.org/) - Official llms.txt spec
- [Schema.org SportsEvent](https://schema.org/SportsEvent) - Official schema type
- Codebase analysis: `src/app/robots.ts`, `src/app/llms.txt/route.ts`, `src/lib/seo/schema/*`

### Secondary (MEDIUM confidence)
- [Momentic AI Crawlers List](https://momenticmarketing.com/blog/ai-search-crawlers-bots) - Comprehensive 2025 crawler directory
- [Yoast Schema Specification](https://developer.yoast.com/features/schema/functional-specification/) - Industry-standard @graph approach
- [Cloudflare AI Bot Analysis](https://blog.cloudflare.com/from-googlebot-to-gptbot-whos-crawling-your-site-in-2025/) - 226 crawlers identified
- [Dennis Camilo @graph Guide](https://www.denniscamilo.com/how-to-combine-nest-multiple-json-ld-schema/) - Practical consolidation examples

### Tertiary (LOW confidence)
- [llms.txt adoption skepticism](https://www.longato.ch/llms-recommendation-2025-august/) - Claims major bots don't read llms.txt yet
- WebSearch results for GEO best practices - Varies by source

## Metadata

**Confidence breakdown:**
- robots.txt: HIGH - Official Next.js docs + verified crawler user-agents
- llms.txt: MEDIUM - Spec is clear but adoption uncertain
- Schema.org @graph: HIGH - Industry standard (Yoast), Google recommended
- SSR requirements: HIGH - Verified by testing "View Source" vs rendered page

**Research date:** 2026-02-02
**Valid until:** 2026-05-02 (AI crawler landscape evolves; review quarterly)

---

## Appendix: Current Codebase State

### Files to Modify
| File | Current State | Required Change |
|------|---------------|-----------------|
| `src/app/robots.ts` | Missing Amazonbot, OAI-SearchBot, Claude-SearchBot | Add missing AI crawlers |
| `src/app/llms.txt/route.ts` | Complete but could add URL lists | Add H2 section with page URLs |
| `src/app/leagues/[slug]/[match]/page.tsx` | Uses separate SportsEventSchema + WebPageSchema | Consolidate to single @graph |
| `src/components/SportsEventSchema.tsx` | Standalone script tag | Integrate into graph builder |
| `src/components/WebPageSchema.tsx` | Standalone script tag | Integrate into graph builder |
| `src/components/match/MatchRoundup.tsx` | `'use client'` with useEffect | Replace with server-side fetch (already done in new page) |

### Already Correct
- `src/components/match/MatchContent.tsx` - Server component, renders SSR
- `src/app/llms-full.txt/route.ts` - Comprehensive AI context
- `src/lib/seo/schema/graph.ts` - Has @graph pattern (used by old match pages)
- Sitemap structure - Already includes all match URLs
