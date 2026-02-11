# Phase 47: Structured Data Validation - Research

**Researched:** 2026-02-06
**Domain:** Schema.org JSON-LD validation, structured data deduplication, Google Rich Results
**Confidence:** HIGH

## Summary

Phase 47 focuses on fixing structured data validation errors and deduplication issues. The platform currently has 4365 schema.org validation errors (documented in .planning/research/FEATURES.md) stemming from duplicate Organization/WebSite schemas on pages and incomplete/invalid SportsEvent, Article, and FAQPage schemas. The root cause is multiple components rendering standalone JSON-LD scripts instead of using a single consolidated @graph approach.

The standard solution is a single source of truth pattern: root layout provides Organization and WebSite schemas once with stable @id references, and page-level components add page-specific schemas (SportsEvent, Article, FAQPage, BreadcrumbList) that reference the root entities via @id stubs. This eliminates duplication while maintaining entity relationships.

The build-time audit system (scripts/audit-internal-links.ts) already validates meta tags via cheerio HTML parsing (Pass 4). Extending this with Pass 5 for JSON-LD validation provides automated regression prevention without external API dependencies.

**Primary recommendation:** Centralize Organization/WebSite schemas in root layout with @id cross-references, extend build-time audit with JSON-LD extraction and validation, use schema-dts TypeScript types for compile-time safety.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| schema-dts | ^1.1.2 | TypeScript types for Schema.org | Official Google package, provides type safety for JSON-LD, already installed |
| cheerio | ^1.0.0+ | HTML parsing for validation | Industry standard for server-side HTML parsing, already in use for Pass 4 meta validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Rich Results Test | API/Manual | Rich results eligibility testing | Manual spot-checks during development, not for automated CI |
| Schema.org Validator | Web-based | Full schema.org compliance check | Final validation before deployment, catches edge cases |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| schema-dts | Manual typing | Lose compile-time safety, higher error rate |
| Cheerio extraction | External API validation | Requires API keys, rate limits, network dependency breaks CI |
| Build-time validation | Runtime validation only | Errors ship to production before discovery |

**Installation:**
```bash
# Already installed - no new dependencies required
npm list schema-dts  # ^1.1.2
npm list cheerio     # ^1.0.0-rc.12
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/seo/schema/
│   ├── root.ts              # Organization/WebSite single source
│   ├── sports-event.ts      # Already exists, needs validation fixes
│   ├── article.ts           # Already exists, needs validation fixes
│   ├── breadcrumb.ts        # Already exists, likely valid
│   ├── competition.ts       # Already exists (SportsOrganization)
│   └── graph.ts             # Already exists, needs deduplication
├── app/layout.tsx           # Render Organization/WebSite once
└── components/
    └── MatchPageSchema.tsx  # Already consolidated, may have duplication
scripts/
└── audit-internal-links.ts  # Extend with Pass 5 JSON-LD validation
```

### Pattern 1: Single Source of Truth for Organization/WebSite

**What:** Root layout renders Organization and WebSite schemas once with stable @id values. Page-level components reference these via @id stubs.

**When to use:** Always for site-wide entities (Organization, WebSite). Never duplicate these on child pages.

**Example:**
```typescript
// Source: schema-dts documentation + platform adaptation
// src/lib/seo/schema/root.ts
import type { Organization, WebSite } from 'schema-dts';

export const ORGANIZATION_ID = 'https://kroam.xyz#organization';
export const WEBSITE_ID = 'https://kroam.xyz#website';

export function buildRootOrganizationSchema(): Organization {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Kroam',
    url: 'https://kroam.xyz',
    logo: 'https://kroam.xyz/logo.png',
    description: 'AI football prediction platform comparing 42 models',
  };
}

export function buildRootWebSiteSchema(): WebSite {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Kroam',
    url: 'https://kroam.xyz',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://kroam.xyz/matches?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
```

```typescript
// src/app/layout.tsx - Render once at root
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const rootGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      buildRootOrganizationSchema(),
      buildRootWebSiteSchema(),
    ],
  };

  return (
    <html>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rootGraph) }}
        />
        {children}
      </body>
    </html>
  );
}
```

### Pattern 2: Page-Level Schema References Root Entities

**What:** Page-specific schemas (SportsEvent, Article, FAQPage) reference root Organization/WebSite via @id stubs instead of duplicating them.

**When to use:** All page-level schemas that need to reference the publisher or parent website.

**Example:**
```typescript
// Source: schema-dts @graph documentation
// Page-level component references root entities
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/seo/schema/root';

const pageGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SportsEvent',
      '@id': url,
      name: matchName,
      // ... event properties
    },
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: title,
      author: { '@id': ORGANIZATION_ID },      // Reference, not duplicate
      publisher: { '@id': ORGANIZATION_ID },   // Reference, not duplicate
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      isPartOf: { '@id': WEBSITE_ID },         // Reference, not duplicate
      about: { '@id': url },                    // Reference to SportsEvent
    },
  ],
};
```

### Pattern 3: Build-Time JSON-LD Validation

**What:** Extend existing build-time audit (Pass 4 meta tags) with Pass 5 that extracts JSON-LD scripts, parses them, and validates for duplication and required properties.

**When to use:** Every build before deployment. Catches regressions immediately.

**Example:**
```typescript
// Source: Existing Pass 4 implementation + cheerio JSON-LD extraction patterns
// scripts/audit-internal-links.ts - Add Pass 5
async function pass5JsonLdValidation(baseUrl: string): Promise<Pass5Result> {
  // Fetch sample URLs from sitemap
  // For each URL:
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract all JSON-LD scripts
  const jsonLdScripts: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        jsonLdScripts.push(JSON.parse(content));
      }
    } catch (error) {
      result.failures.push(`Invalid JSON-LD at ${url}: ${error.message}`);
    }
  });

  // Validation 1: Check for duplicate Organization/WebSite (SCHEMA-01)
  const orgCount = countSchemaType(jsonLdScripts, 'Organization');
  if (orgCount > 1) {
    result.failures.push(`Duplicate Organization (${orgCount} found): ${url}`);
    result.pass = false;
  }

  // Validation 2: SportsEvent required properties (SCHEMA-02)
  const sportsEvents = findSchemaType(jsonLdScripts, 'SportsEvent');
  sportsEvents.forEach(event => {
    if (!event.name || !event.startDate || !event.location) {
      result.failures.push(`Invalid SportsEvent (missing required): ${url}`);
      result.pass = false;
    }
  });

  // Validation 3: Article required properties (SCHEMA-03)
  const articles = findSchemaType(jsonLdScripts, ['Article', 'NewsArticle']);
  articles.forEach(article => {
    if (!article.headline || !article.author || !article.publisher) {
      result.failures.push(`Invalid Article (missing required): ${url}`);
      result.pass = false;
    }
  });

  return result;
}
```

### Anti-Patterns to Avoid

- **Duplicating Organization on every page:** Creates 4365+ validation errors. Use @id references instead.
- **Multiple JSON-LD scripts for same entity:** Google may pick arbitrary version. Use single @graph instead.
- **Missing @id on reusable entities:** Prevents cross-referencing. Always add @id to Organization, WebSite, main entities.
- **Inline nested objects for shared entities:** Duplicates data. Use @id stubs for entities referenced from multiple places.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript types for Schema.org | Manual interfaces | schema-dts | Google maintains it, covers 900+ types, updated with schema.org releases |
| HTML parsing for validation | Regex extraction | cheerio | Battle-tested, handles malformed HTML, jQuery-like API familiar to developers |
| Schema.org validation | Custom property checker | Schema.org Validator API | Official validator knows edge cases, updated with schema.org spec changes |
| JSON-LD deduplication | Manual @graph merging | Single source pattern + @id | Well-documented pattern, prevents drift, enforced at architecture level |

**Key insight:** Schema.org has 900+ types with complex inheritance. Manual validation misses edge cases that official tools catch. The time saved building custom validation is lost debugging production issues.

## Common Pitfalls

### Pitfall 1: Duplicate Organization Schemas on Every Page

**What goes wrong:** Root layout renders Organization, child pages also render Organization in their @graph, causing duplicate entity warnings and 4365+ validation errors.

**Why it happens:** Components built in isolation without awareness of root layout schemas. Copy-paste patterns from examples that assume standalone usage.

**How to avoid:**
- Single source: Only root layout renders Organization/WebSite
- Export constant @id values from root schema module
- Page components import @id constants and use stubs: `{ '@id': ORGANIZATION_ID }`
- Build-time validation (Pass 5) fails on duplicate Organization/WebSite

**Warning signs:**
- Search Console shows "Duplicate structured data" warnings
- Google Rich Results Test shows multiple Organization entities
- Validation tools report 4365+ errors

### Pitfall 2: Missing Required Properties on SportsEvent

**What goes wrong:** SportsEvent missing `location.address` or using incomplete Place object causes Rich Results Test failures.

**Why it happens:** schema-dts types allow optional properties, but Google Rich Results requires location with address. Platform code uses `venue` string but needs full Place object.

**How to avoid:**
- Always include location with @type Place and address property
- Validate SportsEvent schemas in Pass 5 build audit
- Reference: Google enforces location requirements per Search Console warnings

**Warning signs:**
- Rich Results Test shows "Missing field 'location.address'"
- Search Console event rich results errors
- Match pages don't show event rich snippets

### Pitfall 3: Article Schema Missing Publisher Logo

**What goes wrong:** Article/NewsArticle requires publisher.logo as ImageObject with url. Missing or string-only logo causes validation failures.

**Why it happens:** publisher.logo shortcut uses string instead of full ImageObject. schema-dts types allow string OR ImageObject, but Google requires ImageObject.

**How to avoid:**
```typescript
// WRONG - string logo
publisher: {
  '@type': 'Organization',
  logo: 'https://kroam.xyz/logo.png',  // Google rejects this
}

// CORRECT - ImageObject logo
publisher: {
  '@type': 'Organization',
  logo: {
    '@type': 'ImageObject',
    url: 'https://kroam.xyz/logo.png',
  },
}
```

**Warning signs:**
- Rich Results Test: "Missing field 'publisher.logo.url'"
- Article rich results not appearing in search

### Pitfall 4: BreadcrumbList Missing item URLs on Last Position

**What goes wrong:** Last breadcrumb (current page) often omits `item` property, but schema.org requires it on all ListItem entries.

**Why it happens:** Assumption that current page doesn't need URL since user is already there. Schema.org spec requires item on all positions.

**How to avoid:**
- Include `item` property on all breadcrumb positions including last
- Pass 5 validation checks: all BreadcrumbList > itemListElement have `item` property
- Platform implementation in breadcrumb.ts already correct (line 14: `item: item.url`)

**Warning signs:**
- Schema.org validator: "Missing 'item' on ListItem"
- Breadcrumb rich results inconsistent

### Pitfall 5: FAQPage with Single Question

**What goes wrong:** FAQPage with 1 question causes validation warning. Google recommends minimum 2 questions for FAQ rich results.

**Why it happens:** Content generators create FAQ sections without checking question count minimum.

**How to avoid:**
- Conditional rendering: only output FAQPage schema if 2+ questions
- Pass 5 validation warns on single-question FAQPage
- Platform FAQ generators (generateLeagueFAQs, generateMatchFAQs) already create 3-5 questions

**Warning signs:**
- Rich Results Test warning: "Recommended to have 2+ questions"
- FAQ rich results not appearing

## Code Examples

Verified patterns from official sources and platform codebase:

### Extracting JSON-LD from HTML with Cheerio
```typescript
// Source: https://webscraping.ai/faq/cheerio/how-do-you-extract-structured-data-like-json-ld-or-microdata-using-cheerio
// Already used in Pass 4, extend for Pass 5
import * as cheerio from 'cheerio';

function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  const schemas: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const content = $(element).html();
      if (content) {
        const parsed = JSON.parse(content);
        schemas.push(parsed);
      }
    } catch (error) {
      // Invalid JSON-LD - collect for error reporting
      console.error('Failed to parse JSON-LD:', error);
    }
  });

  return schemas;
}
```

### Validating Schema Required Properties
```typescript
// Source: Platform pattern + schema.org spec
function validateSportsEvent(event: unknown): string[] {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    return ['Not an object'];
  }

  const e = event as Record<string, unknown>;

  // Required: name, startDate, location
  if (!e.name) errors.push('Missing required property: name');
  if (!e.startDate) errors.push('Missing required property: startDate');

  // location must be Place with address
  if (!e.location) {
    errors.push('Missing required property: location');
  } else if (typeof e.location === 'object') {
    const loc = e.location as Record<string, unknown>;
    if (loc['@type'] !== 'Place') {
      errors.push('location must be @type Place');
    }
    if (!loc.address && !loc.name) {
      errors.push('location.Place requires address or name');
    }
  }

  return errors;
}
```

### Detecting Duplicate Schemas in @graph
```typescript
// Source: Build-time validation pattern
function detectDuplicateSchemas(schemas: unknown[]): Map<string, number> {
  const typeCounts = new Map<string, number>();

  schemas.forEach(schema => {
    if (typeof schema !== 'object' || !schema) return;

    const s = schema as Record<string, unknown>;

    // Handle @graph arrays
    if (s['@graph'] && Array.isArray(s['@graph'])) {
      s['@graph'].forEach((item: unknown) => {
        countType(item, typeCounts);
      });
    } else {
      countType(schema, typeCounts);
    }
  });

  return typeCounts;
}

function countType(item: unknown, counts: Map<string, number>): void {
  if (typeof item !== 'object' || !item) return;

  const obj = item as Record<string, unknown>;
  const type = obj['@type'];

  if (typeof type === 'string') {
    counts.set(type, (counts.get(type) || 0) + 1);
  }
}
```

### Using schema-dts Types for Compile-Time Safety
```typescript
// Source: https://github.com/google/schema-dts/blob/main/README.md
import type { SportsEvent, Place, SportsTeam } from 'schema-dts';

export function buildSportsEventSchema(data: MatchData): SportsEvent {
  // TypeScript enforces correct property names and types
  const event: SportsEvent = {
    '@type': 'SportsEvent',
    '@id': data.url,
    name: `${data.homeTeam} vs ${data.awayTeam}`,
    startDate: data.kickoffTime,
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: data.venue,
      address: data.venue, // Google requires address
    } satisfies Place,
    homeTeam: {
      '@type': 'SportsTeam',
      name: data.homeTeam,
    } satisfies SportsTeam,
    awayTeam: {
      '@type': 'SportsTeam',
      name: data.awayTeam,
    } satisfies SportsTeam,
    sport: 'Football',
  };

  return event;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple standalone JSON-LD scripts | Single @graph with @id cross-references | 2024-2025 | Eliminates duplication, enables entity relationships |
| Runtime validation only | Build-time + runtime validation | 2025-2026 | Catches errors before deployment, fails CI on regressions |
| Manual type checking | schema-dts TypeScript types | 2023+ | Compile-time safety, autocomplete, fewer typos |
| External API validation in CI | Cheerio HTML parsing + local validation | 2025-2026 | No rate limits, faster builds, no network dependency |
| String-based logo URLs | ImageObject with @type and url | 2024 Google requirement | Required for Article rich results eligibility |

**Deprecated/outdated:**
- Google Structured Data Testing Tool: Deprecated 2020, replaced by Rich Results Test
- schema.org/docs/old_validator.html: Superseded by validator.schema.org
- Multiple JSON-LD scripts per entity: Creates ambiguity, use single @graph instead

## Current Platform State

### What Works
- **MatchPageSchema.tsx** already uses @graph consolidation (lines 58-179)
- **Build-time audit** exists (Pass 1-4) with cheerio HTML parsing
- **schema-dts** installed (v1.1.2) for TypeScript safety
- **Individual schema builders** exist in src/lib/seo/schema/

### What's Broken
- **Root layout duplicates Organization/WebSite** (layout.tsx lines 62-103)
- **MatchPageSchema duplicates Organization/WebSite** in @graph (lines 60-75)
- **League pages** render separate @graph without deduplication (leagues/[slug]/page.tsx lines 174-177)
- **4365 validation errors** from duplicate entities across site

### Root Cause
Multiple components independently render Organization/WebSite instead of referencing single source. No build-time validation to catch duplication before deployment.

## Open Questions

1. **How many pages have duplicate Organization schemas?**
   - Need to crawl site and extract JSON-LD from all pages
   - Estimate: All pages (root layout + page component both render Organization)
   - Resolution: Audit Pass 5 will measure exact count

2. **Are there @id collisions between pages?**
   - MatchPageSchema uses `url` as SportsEvent @id (line 79)
   - If two pages reference same match with different URLs, @id conflicts occur
   - Resolution: Audit Pass 5 checks for non-unique @id values across sampled URLs

3. **Should FAQPage be in root @graph or page @graph?**
   - FAQs are page-specific (match FAQs, league FAQs differ)
   - Recommendation: Page-level @graph (current approach correct)
   - Verify: No duplicate FAQPage entities across pages

4. **How to handle scores in SportsEvent eventStatus?**
   - Current code uses EventScheduled for all (sports-event.ts line 10)
   - Finished matches should use EventCompleted (MatchPageSchema.tsx uses this pattern line 34)
   - Recommendation: Unify to MatchPageSchema pattern (EventCompleted for finished)

## Sources

### Primary (HIGH confidence)
- [schema-dts GitHub documentation](https://github.com/google/schema-dts) - TypeScript types, @graph patterns
- [Google Rich Results Test](https://developers.google.com/search/docs/appearance/structured-data/event) - Event/SportsEvent requirements
- [Schema.org SportsEvent specification](https://schema.org/SportsEvent) - Official property definitions
- Platform codebase analysis (MatchPageSchema.tsx, layout.tsx, audit script)

### Secondary (MEDIUM confidence)
- [Google Search Central - Event Schema](https://developers.google.com/search/docs/appearance/structured-data/event) - Location requirements enforcement
- [Schema.org Validator documentation](https://validator.schema.org/) - Validation approach
- [Cheerio JSON-LD extraction guide](https://webscraping.ai/faq/cheerio/how-do-you-extract-structured-data-like-json-ld-or-microdata-using-cheerio) - Implementation pattern
- [Schema Markup in 2026 best practices](https://medium.com/@deepakparmaronline/mastering-schema-markup-in-2026-ai-ready-strategies-entity-optimization-and-proven-f92655aa2bb8) - @graph usage patterns

### Tertiary (LOW confidence)
- [Schema validation tools comparison 2026](https://www.testsprite.com/use-cases/en/the-best-schema-checker-tools) - Tool landscape, not specific guidance
- [Organization Schema guide](https://aubreyyung.com/organization-schema/) - General patterns, not platform-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - schema-dts and cheerio already in use, well-documented
- Architecture: HIGH - @graph pattern documented in schema-dts, platform already uses it partially
- Pitfalls: HIGH - Directly observed in platform code (4365 errors, duplication in layout.tsx + MatchPageSchema.tsx)
- Validation approach: HIGH - Pass 4 audit exists, cheerio extraction patterns verified

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain, schema.org evolves slowly)
