# Phase 46: Content Tags & Meta Optimization - Research

**Researched:** 2026-02-06
**Domain:** Next.js 16 metadata optimization, OG image generation, structured data, build-time validation
**Confidence:** HIGH

## Summary

Phase 46 optimizes on-page SEO elements across all page types to pass Ahrefs audit checks. Research confirms that Google's 2026 best practices align with user-specified constraints: title tags under 60 characters (51-55 optimal to avoid rewrites), meta descriptions 100-160 characters (desktop shows more than mobile), and exactly one H1 per page (modern HTML5 allows multiple but single H1 maintains clear hierarchy). Next.js 16's `generateMetadata` function handles dynamic metadata with automatic fetch memoization, and the `next/og` package (preferred over `@vercel/og`) enables dynamic OG image generation using JSX/CSS with Satori rendering engine. CollectionPage structured data properly identifies index pages as collections with nested ItemList elements. Build-time validation requires custom TypeScript scripts to audit rendered HTML since Next.js lacks native meta tag validation.

**Key findings:**
- Next.js 16 `generateMetadata` must await `params` promise; fetch requests auto-memoize across segments
- Satori (next/og engine) supports flexbox, gradients, fonts but NOT CSS Grid, calc(), transforms
- Google rewrites 60-70% of meta descriptions in 2026 but original still matters for 30-40% of queries
- Single H1 per page remains best practice despite HTML5 allowing multiple (avoids signal dilution)
- CollectionPage + ItemList structured data requires three-tier hierarchy for category pages

**Primary recommendation:** Update all `generateMetadata` functions with user-specified title/description formulas, create dynamic OG image routes using `next/og` with dark gradient theme for all page types (match, league, model, blog, homepage, leaderboard), extend existing Phase 45 audit script to validate meta tag lengths and H1 count, add CollectionPage structured data to /leagues and /models index pages, and ensure all titles/descriptions comply with length limits at generation time (truncate with suffix removal for titles, pad with generic text for short descriptions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Title tag formulas:**
- Match pages: `{Home} vs {Away} Prediction | Kroam`
- League pages: `{League} AI Predictions | Kroam`
- Model pages: `{Model} Football Predictions | Kroam`
- All titles must stay under 60 characters
- When title exceeds 60 chars due to long names, drop the ` | Kroam` suffix rather than abbreviating names

**Meta description formulas:**
- Match pages: AI prediction focus — template like "Get AI predictions for {Home} vs {Away} from 42 models. See scores, analysis, and betting insights for {League}."
- Descriptions must be 100-160 characters
- When descriptions would be too short (under 100 chars), pad with generic supplementary text to reach minimum length
- Blog posts, league pages, model pages all follow the same 100-160 char rule

**H1 tag strategy:**
- Match pages: `{Home} vs {Away} Prediction`
- League pages: `{League} Predictions`
- Model pages: `{Model} Football Predictions`
- Strict one H1 per page — audit all pages and demote any extra H1s to H2
- Blog posts must also have exactly one H1 (the post title)

**Open Graph images:**
- Dynamic OG image generation for ALL page types (match, league, model, blog, leaderboard, homepage)
- Text-on-gradient style — page title/key info overlaid on a branded gradient background
- Dark theme: navy/charcoal gradient with light text — professional, data/analytics vibe
- Pages without a dynamic template fall back to a generic Kroam branded image
- Use @vercel/og or Next.js built-in OG image generation

**OG tag completeness:**
- All indexable pages must have: og:title, og:description, og:image, og:url
- og:title and og:description should match the page's title and meta description
- og:url should be the canonical URL

**Build-time validation:**
- Extend existing Phase 45 audit script to validate meta tag lengths
- Check title tags (max 60 chars), meta descriptions (100-160 chars)
- Check H1 count (exactly 1 per page type)
- Fail build on violations (same severity model as sitemap audit)

**Blog content enforcement:**
- Blog posts follow the same title (60 char) and description (100-160 char) limits as all other pages
- LLM-generated blog content must comply — truncate or adjust at generation time if needed

### Claude's Discretion

- Exact gradient colors and OG image typography/spacing
- How to structure the @vercel/og route handlers
- CollectionPage structured data schema details for /leagues and /models
- Homepage and leaderboard H1 text (follow same keyword patterns)
- Specific padding text templates for short descriptions

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/og | Built-in (Next.js 16.1.4) | Dynamic OG image generation | Preferred over @vercel/og for Next.js projects, maintained as part of framework |
| ImageResponse | next/og export | JSX/CSS to PNG converter | Official Next.js API for OG images, uses Satori + resvg under the hood |
| schema-dts | 1.1.5 | TypeScript types for Schema.org structured data | Already installed, provides type safety for CollectionPage schema |
| Drizzle ORM | 0.45.1 | Query database for metadata (model count, match data) | Existing project ORM |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cheerio | ^1.0.0 | HTML parsing for meta tag audit | Build-time validation — parse rendered HTML to extract meta tags and H1 count |
| tsx | 4.21.0 | Run TypeScript audit scripts | Already installed, executes build-time validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next/og | @vercel/og standalone | next/og is preferred for Next.js 16+, better integration and maintenance |
| Satori | Puppeteer for screenshots | Satori is faster, runs on Edge functions, supports SSR; Puppeteer requires headless browser |
| Build-time validation | Runtime meta tag checks | Build-time catches issues before deployment, prevents bad metadata from reaching production |
| CollectionPage | ItemList only | CollectionPage is more semantic for index/category pages, signals page purpose to search engines |

**Installation:**
```bash
npm install cheerio  # Only new dependency needed
```

**Note:** `next/og` is built into Next.js 16.1.4, no additional installation required.

## Architecture Patterns

### Next.js Metadata API Structure

**Static metadata** (for pages with no dynamic data):
```typescript
// src/app/leagues/page.tsx
export const metadata: Metadata = {
  title: 'Football Leagues | AI Predictions | Kroam',
  description: '...',
  openGraph: {
    title: '...',
    description: '...',
    images: ['/api/og/leagues'], // Dynamic OG route
  },
};
```

**Dynamic metadata** (for pages with route params or database data):
```typescript
// src/app/leagues/[slug]/[match]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, match } = await params; // MUST await params in Next.js 16

  const matchData = await getMatchBySlug(slug, match); // Auto-memoized
  const title = buildTitle(matchData); // Apply user formulas
  const description = buildDescription(matchData); // Apply user formulas

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/leagues/${slug}/${match}/opengraph-image`], // Dynamic route
      url: `${BASE_URL}/leagues/${slug}/${match}`,
    },
    alternates: {
      canonical: `/leagues/${slug}/${match}`,
    },
  };
}
```

### Dynamic OG Image Route Pattern

**File-based route** (Next.js convention):
```
src/app/
├── leagues/
│   ├── [slug]/
│   │   └── [match]/
│   │       ├── page.tsx
│   │       └── opengraph-image.tsx  # Dynamic OG image for match pages
├── models/
│   └── [id]/
│       └── opengraph-image.tsx      # Dynamic OG image for model pages
└── api/
    └── og/
        ├── leagues/route.ts          # OG image for /leagues index
        └── homepage/route.ts         # Fallback generic OG image
```

**Implementation** (match page OG image):
```typescript
// src/app/leagues/[slug]/[match]/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string; match: string }> }) {
  const { slug, match } = await params;
  const matchData = await getMatchBySlug(slug, match); // Fetch data

  if (!matchData) {
    return new ImageResponse(/* fallback */);
  }

  // JSX with inline styles (Satori-compatible CSS)
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', // Dark gradient
          color: '#ffffff',
          fontFamily: 'system-ui',
        }}
      >
        {/* Header with league name */}
        <div style={{ display: 'flex', padding: '40px 60px' }}>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{matchData.competition}</span>
        </div>

        {/* Center: Team names and score */}
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', gap: 40 }}>
          <span style={{ fontSize: 48, fontWeight: 700 }}>{matchData.homeTeam}</span>
          <span style={{ fontSize: 80, fontWeight: 800 }}>vs</span>
          <span style={{ fontSize: 48, fontWeight: 700 }}>{matchData.awayTeam}</span>
        </div>

        {/* Footer branding */}
        <div style={{ display: 'flex', padding: '30px 60px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: 24, opacity: 0.9 }}>Kroam.xyz</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**Satori CSS Support** (confirmed for next/og):
- ✅ Flexbox layout (display: flex, flexDirection, justifyContent, alignItems)
- ✅ Linear/radial gradients (background: linear-gradient(...))
- ✅ Basic typography (fontSize, fontWeight, lineHeight)
- ✅ Borders, shadows, padding, margin
- ✅ Absolute positioning
- ❌ CSS Grid (use flexbox instead)
- ❌ calc(), CSS variables, transforms, animations

### CollectionPage Structured Data Pattern

**Three-tier hierarchy** (CollectionPage → ItemList → Products/Items):
```typescript
// src/app/leagues/page.tsx
export default function LeaguesPage() {
  const competitions = getCompetitionsByCategory(); // 17 leagues

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Football Leagues',
    description: 'AI predictions across 17 major football competitions.',
    url: 'https://kroam.xyz/leagues',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: competitions.length,
      itemListElement: competitions.map((comp, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Thing', // or 'SportsEvent' for sports leagues
          name: comp.name,
          url: `https://kroam.xyz/leagues/${comp.id}`,
          description: `AI predictions for ${comp.name}`,
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      {/* Page content */}
    </>
  );
}
```

### Build-Time Meta Tag Audit Pattern

**Extend existing Phase 45 audit script** (scripts/audit-internal-links.ts):
```typescript
// Add Pass 4: Meta Tag Validation
async function pass4MetaTagValidation(baseUrl: string): Promise<AuditResult> {
  const result = { pass: true, failures: [], warnings: [] };

  // Fetch sitemap to get all URLs
  const sitemapUrls = await fetchSitemapUrls(baseUrl);

  // Sample URLs to audit (all or subset for speed)
  const urlsToAudit = sampleUrls ? sitemapUrls.slice(0, 50) : sitemapUrls;

  for (const url of urlsToAudit) {
    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);

    // Validate title length (CTAG-04)
    const title = $('title').text();
    if (title.length > 60) {
      result.failures.push(`Title too long (${title.length} chars): ${url}`);
      result.pass = false;
    }

    // Validate meta description length (CTAG-02, CTAG-03)
    const description = $('meta[name="description"]').attr('content') || '';
    if (description.length < 100) {
      result.failures.push(`Description too short (${description.length} chars): ${url}`);
      result.pass = false;
    }
    if (description.length > 160) {
      result.failures.push(`Description too long (${description.length} chars): ${url}`);
      result.pass = false;
    }

    // Validate H1 count (CTAG-01, CTAG-06)
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      result.failures.push(`No H1 tag found: ${url}`);
      result.pass = false;
    } else if (h1Count > 1) {
      result.failures.push(`Multiple H1 tags (${h1Count}): ${url}`);
      result.pass = false;
    }

    // Validate OG tag completeness (CTAG-05)
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogUrl = $('meta[property="og:url"]').attr('content');

    if (!ogTitle || !ogDescription || !ogImage || !ogUrl) {
      result.warnings.push(`Incomplete OG tags: ${url}`);
    }
  }

  return result;
}
```

**Integration with npm build script**:
```json
// package.json
{
  "scripts": {
    "build": "tsx scripts/audit-internal-links.ts && next build"
  }
}
```

### Pattern: Title/Description Formula Helper

**Centralized metadata builder** (extends existing src/lib/seo/metadata.ts):
```typescript
// src/lib/seo/metadata.ts
const MAX_TITLE_LENGTH = 60;
const MIN_DESCRIPTION_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 160;

export function buildMatchTitle(homeTeam: string, awayTeam: string): string {
  const baseTitle = `${homeTeam} vs ${awayTeam} Prediction`;
  const withBrand = `${baseTitle} | Kroam`;

  // Drop suffix if too long (user decision)
  return withBrand.length <= MAX_TITLE_LENGTH ? withBrand : baseTitle;
}

export function buildMatchDescription(
  homeTeam: string,
  awayTeam: string,
  league: string,
  modelCount: number
): string {
  const base = `Get AI predictions for ${homeTeam} vs ${awayTeam} from ${modelCount} models. See scores, analysis, and betting insights for ${league}.`;

  // Pad if too short (user decision)
  if (base.length < MIN_DESCRIPTION_LENGTH) {
    const padding = ' Compare forecasts, track accuracy, and explore model performance.';
    return (base + padding).substring(0, MAX_DESCRIPTION_LENGTH);
  }

  // Truncate if too long
  return base.length <= MAX_DESCRIPTION_LENGTH
    ? base
    : base.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
}

export function buildLeagueTitle(leagueName: string): string {
  const baseTitle = `${leagueName} AI Predictions`;
  const withBrand = `${baseTitle} | Kroam`;

  return withBrand.length <= MAX_TITLE_LENGTH ? withBrand : baseTitle;
}

export function buildModelTitle(modelName: string): string {
  const baseTitle = `${modelName} Football Predictions`;
  const withBrand = `${baseTitle} | Kroam`;

  return withBrand.length <= MAX_TITLE_LENGTH ? withBrand : baseTitle;
}
```

### Anti-Patterns to Avoid

- **Multiple H1s per page:** Dilutes primary heading signal, confuses page hierarchy
- **Keyword stuffing in meta tags:** Google ignores or penalizes; focus on natural language
- **Ignoring mobile preview:** Mobile shows ~120 chars of description vs desktop ~160
- **Static OG images for dynamic content:** Match pages need dynamic scores/teams, not generic image
- **Abbreviating team names in titles:** User decision is to drop suffix instead
- **Leaving descriptions under 100 chars:** Looks incomplete in search results, pad to minimum

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Converting JSX to PNG images | Custom headless browser + screenshot logic | `next/og` (ImageResponse) | Satori rendering is faster, runs on Edge, no browser overhead |
| Parsing HTML for meta tags | Regex on HTML strings | cheerio (jQuery-like API) | HTML is not regular, cheerio handles nested tags, attributes, edge cases |
| Structured data validation | Manual JSON-LD checks | schema-dts TypeScript types | Type safety catches schema errors at compile time |
| Meta description truncation | Hard substring cutoff | truncateWithEllipsis at word boundaries | Avoids cutting mid-word, maintains readability |
| OG image caching | Custom CDN or file storage | Next.js automatic static optimization | Generated images cached at build time, no manual cache logic needed |

**Key insight:** Next.js provides battle-tested primitives for metadata and OG images. Leverage them instead of building custom solutions. The framework handles caching, optimization, and edge cases.

## Common Pitfalls

### Pitfall 1: Not Awaiting `params` Promise in Next.js 16

**What goes wrong:** `generateMetadata` receives `params` as a Promise in Next.js 15+. Accessing properties without awaiting causes `undefined` errors or incorrect metadata.

**Why it happens:** Breaking change from Next.js 14 where `params` was synchronous. Legacy code fails silently or throws at runtime.

**How to avoid:**
```typescript
// ❌ Wrong (Next.js 14 pattern)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await getMatchBySlug(params.slug, params.match); // params not awaited
}

// ✅ Correct (Next.js 15+ pattern)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, match } = await params; // Await first
  const matchData = await getMatchBySlug(slug, match);
}
```

**Warning signs:** TypeScript error "Property 'slug' does not exist on type 'Promise'", or metadata showing undefined values.

### Pitfall 2: Using CSS Grid in Satori/next/og

**What goes wrong:** OG images fail to render or display incorrectly. Satori doesn't support `display: grid`, only flexbox.

**Why it happens:** Satori uses a limited CSS subset for performance. Modern CSS features aren't available.

**How to avoid:** Use flexbox for all layouts. Convert grid patterns to nested flex containers.

```typescript
// ❌ Wrong (CSS Grid not supported)
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>

// ✅ Correct (Flexbox alternative)
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
  <div style={{ flex: '1 1 30%' }}>...</div>
  <div style={{ flex: '1 1 30%' }}>...</div>
  <div style={{ flex: '1 1 30%' }}>...</div>
</div>
```

**Warning signs:** OG image endpoint returns 500 error, or images render with blank sections.

### Pitfall 3: Padding Meta Descriptions with Irrelevant Text

**What goes wrong:** Short descriptions get padded to 100 chars with generic fluff that doesn't add value. Google may ignore or rewrite them.

**Why it happens:** Mechanical compliance with length rule without considering user intent or readability.

**How to avoid:** Pad with contextually relevant supplementary information. Example patterns:
- Match pages: Add model count, competition details, or date context
- League pages: Add season info, number of teams, or competition format
- Model pages: Add provider info, accuracy stats, or league coverage

```typescript
// ❌ Wrong (generic padding)
const desc = `${shortDesc} This page provides detailed information.`;

// ✅ Correct (contextual padding)
const desc = `${shortDesc} Compare ${modelCount} AI models across 17 leagues.`;
```

**Warning signs:** High Google rewrite rate (>80% of descriptions changed), low click-through rate from search.

### Pitfall 4: Forgetting to Validate H1 Count in Components

**What goes wrong:** Page renders multiple H1 tags because component hierarchies aren't audited. Blog post title is H1, page title is also H1.

**Why it happens:** Components render independently without awareness of parent context. Easy to nest H1s accidentally.

**How to avoid:**
- Use H1 ONLY for page-level primary heading
- All component headings should be H2-H6
- Pass heading level as prop if component needs dynamic hierarchy

```typescript
// ❌ Wrong (component creates second H1)
function BlogPostHeader({ title }: Props) {
  return <h1>{title}</h1>; // Could be nested under page H1
}

// ✅ Correct (component uses H2 or accepts level prop)
function BlogPostHeader({ title, level = 2 }: Props) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag>{title}</Tag>;
}
```

**Warning signs:** Build audit reports multiple H1s, SEO tools flag heading hierarchy issues.

### Pitfall 5: Hardcoding OG Image URLs Instead of Using Dynamic Routes

**What goes wrong:** OG images show stale data or generic content. Updating match scores doesn't update social previews.

**Why it happens:** Static OG image paths are easier initially but don't scale for dynamic content.

**How to avoid:** Use Next.js file-based `opengraph-image.tsx` routes or API routes. They regenerate on each request or at build time.

```typescript
// ❌ Wrong (static image, never updates)
openGraph: {
  images: ['/static/match-og.png'],
}

// ✅ Correct (dynamic route, generates per match)
openGraph: {
  images: [`/leagues/${slug}/${match}/opengraph-image`],
}
```

**Warning signs:** Social media previews show wrong team names, outdated scores, or generic images for specific matches.

## Code Examples

Verified patterns from official sources and existing implementation:

### Example 1: generateMetadata with Title/Description Formulas

```typescript
// Source: Next.js docs + user decisions
// File: src/app/leagues/[slug]/page.tsx

import type { Metadata } from 'next';
import { buildLeagueTitle, buildLeagueDescription } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; // Next.js 16 requirement

  const competition = getCompetitionById(slug);
  const activeModels = await getActiveModelCount();

  const title = buildLeagueTitle(competition.name); // User formula
  const description = buildLeagueDescription(competition.name, activeModels);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/api/og/league?name=${encodeURIComponent(competition.name)}`],
      url: `https://kroam.xyz/leagues/${slug}`,
    },
    alternates: {
      canonical: `/leagues/${slug}`,
    },
  };
}
```

### Example 2: Dynamic OG Image with Dark Gradient Theme

```typescript
// Source: next/og docs + Satori CSS support
// File: src/app/models/[id]/opengraph-image.tsx

import { ImageResponse } from 'next/og';
import { getModelById } from '@/lib/db/queries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await getModelById(id);

  if (!model) {
    // Fallback for missing model
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#1a1a2e' }} />
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', // Dark navy/charcoal gradient
          color: '#e0e0e0', // Light text
          fontFamily: 'system-ui',
          padding: '60px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: '#60a5fa', // Accent color
            }}
          >
            AI Model Performance
          </div>
        </div>

        {/* Model name (main focus) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.2 }}>
            {model.displayName}
          </div>
          <div style={{ fontSize: 32, fontWeight: 400, color: '#9ca3af', marginTop: 20 }}>
            Football Predictions
          </div>
        </div>

        {/* Footer branding */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid rgba(255,255,255,0.1)',
            paddingTop: 30,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>
            Kroam.xyz
          </div>
          <div style={{ fontSize: 20, color: '#6b7280' }}>
            AI-Powered Predictions
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### Example 3: CollectionPage Structured Data for /leagues

```typescript
// Source: Schema.org docs + user decisions
// File: src/app/leagues/page.tsx

import { COMPETITIONS } from '@/lib/football/competitions';

export default function LeaguesPage() {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Football Leagues',
    description: 'AI predictions across 17 major football competitions including Champions League, Premier League, La Liga, and more.',
    url: 'https://kroam.xyz/leagues',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: COMPETITIONS.length,
      itemListElement: COMPETITIONS.map((comp, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'SportsEvent', // More specific than 'Thing' for sports content
          name: comp.name,
          url: `https://kroam.xyz/leagues/${comp.id}`,
          description: `AI predictions for ${comp.name} from 42 models`,
          sport: 'Football',
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <h1>Football Leagues</h1>
      {/* Page content */}
    </>
  );
}
```

### Example 4: Build-Time Meta Tag Audit (Pass 4)

```typescript
// Source: Existing Phase 45 audit script pattern + cheerio docs
// File: scripts/audit-internal-links.ts (extend existing)

import cheerio from 'cheerio';

interface MetaAuditResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
  stats: {
    totalChecked: number;
    titleViolations: number;
    descriptionViolations: number;
    h1Violations: number;
    ogIncomplete: number;
  };
}

async function pass4MetaTagValidation(baseUrl: string): Promise<MetaAuditResult> {
  const result: MetaAuditResult = {
    pass: true,
    failures: [],
    warnings: [],
    stats: { totalChecked: 0, titleViolations: 0, descriptionViolations: 0, h1Violations: 0, ogIncomplete: 0 },
  };

  // Fetch sitemap URLs (reuse Pass 1 logic)
  const urls = await fetchAllSitemapUrls(baseUrl);

  // Sample for faster builds (or audit all for thorough check)
  const urlsToCheck = process.env.AUDIT_SAMPLE ? urls.slice(0, 50) : urls;

  for (const url of urlsToCheck) {
    result.stats.totalChecked++;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        result.warnings.push(`Failed to fetch ${url}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Check 1: Title length (CTAG-04)
      const title = $('title').text();
      if (title.length > 60) {
        result.failures.push(`[CTAG-04] Title too long (${title.length} chars): ${url}`);
        result.stats.titleViolations++;
        result.pass = false;
      }

      // Check 2: Meta description length (CTAG-02, CTAG-03)
      const description = $('meta[name="description"]').attr('content') || '';
      if (description.length < 100) {
        result.failures.push(`[CTAG-02] Description too short (${description.length} chars): ${url}`);
        result.stats.descriptionViolations++;
        result.pass = false;
      } else if (description.length > 160) {
        result.failures.push(`[CTAG-03] Description too long (${description.length} chars): ${url}`);
        result.stats.descriptionViolations++;
        result.pass = false;
      }

      // Check 3: H1 count (CTAG-01, CTAG-06)
      const h1Count = $('h1').length;
      if (h1Count === 0) {
        result.failures.push(`[CTAG-01/06] No H1 tag: ${url}`);
        result.stats.h1Violations++;
        result.pass = false;
      } else if (h1Count > 1) {
        result.failures.push(`[CTAG-01/06] Multiple H1 tags (${h1Count}): ${url}`);
        result.stats.h1Violations++;
        result.pass = false;
      }

      // Check 4: OG tag completeness (CTAG-05)
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      const ogUrl = $('meta[property="og:url"]').attr('content');

      if (!ogTitle || !ogDescription || !ogImage || !ogUrl) {
        const missing = [
          !ogTitle && 'og:title',
          !ogDescription && 'og:description',
          !ogImage && 'og:image',
          !ogUrl && 'og:url',
        ].filter(Boolean).join(', ');

        result.warnings.push(`[CTAG-05] Incomplete OG tags (missing: ${missing}): ${url}`);
        result.stats.ogIncomplete++;
      }

    } catch (error) {
      result.warnings.push(`Error auditing ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

// Add to main audit flow
async function runAudit() {
  console.log('=== Meta Tag & Content Audit ===\n');

  const baseUrl = process.env.AUDIT_BASE_URL || 'http://localhost:3000';

  // ... existing passes 1-3 ...

  // Pass 4: Meta Tag Validation
  console.log('Pass 4: Meta Tag Validation');
  const pass4 = await pass4MetaTagValidation(baseUrl);

  if (pass4.pass) {
    console.log(`  ✓ ${pass4.stats.totalChecked} pages checked`);
    console.log(`  ✓ All titles under 60 characters`);
    console.log(`  ✓ All descriptions 100-160 characters`);
    console.log(`  ✓ All pages have exactly 1 H1`);
    if (pass4.stats.ogIncomplete === 0) {
      console.log(`  ✓ All pages have complete OG tags`);
    }
  } else {
    pass4.failures.forEach(f => console.log(`  ✗ ${f}`));
  }

  pass4.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');

  // Aggregate and exit
  const allFailures = [...pass1.failures, ...pass2.failures, ...pass3.failures, ...pass4.failures];
  const passed = allFailures.length === 0;

  process.exit(passed ? 0 : 1);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @vercel/og package | next/og (built-in) | Next.js 13.3+ | Better integration, automatic tree-shaking, maintained with framework |
| Static OG images only | Dynamic ImageResponse | Next.js 13+ | Personalized social previews, scalable for 1000s of pages without storage |
| Manual meta tag management | Metadata API + generateMetadata | Next.js 13+ | Type-safe, automatic head injection, streaming support |
| priority/changefreq in sitemaps | lastmod only | Google 2024+ guidance | Google ignores priority/changefreq, focus on lastmod timestamps |
| Multiple H1s acceptable | Single H1 best practice | HTML5 introduced sections but SEO community converged 2020+ | Clear hierarchy preferred even though HTML5 technically allows multiple |
| Meta descriptions 150-160 chars | 100-160 chars (desktop), 120 mobile | Google mobile-first indexing 2018+ | Mobile shows less, but desktop still shows full 160 |

**Deprecated/outdated:**
- `@vercel/og` package: Use `next/og` for Next.js projects (still works but not preferred)
- `metadataBase` in every layout: Set once in root layout, children inherit
- Synchronous `params` access: Next.js 15+ requires `await params`
- `revalidate` exports for metadata: Use PPR or dynamic functions instead

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal H1 text for homepage and leaderboard**
   - What we know: User wants keyword patterns like league/model pages
   - What's unclear: Exact phrasing that balances SEO keywords vs. natural language
   - Recommendation: Homepage H1 = "AI Football Predictions", Leaderboard H1 = "AI Model Leaderboard" (matches existing metadata patterns)

2. **Generic padding text templates for short descriptions**
   - What we know: Must pad to 100 chars minimum with contextual info
   - What's unclear: Exact templates per page type
   - Recommendation: Create 3-5 padding snippets per page type (e.g., " Track accuracy, compare models, explore performance" for model pages) and rotate or combine based on length needed

3. **Gradient color palette for dark OG images**
   - What we know: Navy/charcoal, professional data/analytics vibe, light text
   - What's unclear: Exact hex codes for brand consistency
   - Recommendation: Use existing dark theme colors from Tailwind config as basis (e.g., `bg-slate-900` → `#0f172a`, `bg-slate-800` → `#1e293b`) or define in SEO constants file

4. **CollectionPage vs ItemList for /models page**
   - What we know: User wants CollectionPage structured data for /leagues and /models
   - What's unclear: Whether models are "products" or generic "things" in ItemList
   - Recommendation: Use `@type: 'SoftwareApplication'` for AI models in ItemList (more semantic than 'Thing'), signals they're computational tools

## Sources

### Primary (HIGH confidence)

- [Next.js generateMetadata API Reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Official docs on async metadata generation, params handling
- [Next.js Metadata and OG Images Getting Started](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) - Official guide on ImageResponse and next/og usage
- [Schema.org CollectionPage](https://schema.org/CollectionPage) - Official schema definition
- [Schema.org ItemList](https://schema.org/ItemList) - Official schema definition for lists
- [Vercel OG Image Generation Docs](https://vercel.com/docs/og-image-generation) - Official guide on ImageResponse and Satori
- [GitHub: vercel/satori](https://github.com/vercel/satori) - Official Satori CSS support documentation

### Secondary (MEDIUM confidence)

- [Meta Title/Description Guide: 2026 Best Practices](https://www.stanventures.com/blog/meta-title-length-meta-description-length/) - Confirmed 60 char title, 100-160 char description limits
- [Next.js SEO Optimization Guide (2026 Edition)](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition) - Best practices for metadata optimization
- [Title Tags vs H1 Tags: The Ultimate Guide to Boost Rankings in 2026](https://www.clickrank.ai/title-tags-vs-h1-tags/) - Single H1 best practice confirmation
- [How To Write Title Tags and Meta Descriptions for SEO in 2025](https://thesmcollective.com/blog/seo-title-tags-meta-descriptions/) - Google rewrite rates (60-70%)
- [Cheerio.js Official Site](https://cheerio.js.org/) - HTML parsing library documentation
- [Testing meta tags with Playwright](https://scottspence.com/posts/testing-meta-tags-with-playwright) - Build-time validation patterns

### Tertiary (LOW confidence)

- Web search results on OG image fallback strategies (generalized guidance, not Next.js specific)
- Community discussions on H1 tag SEO value (consensus but not Google official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next/og is official Next.js API, cheerio is industry standard for HTML parsing
- Architecture: HIGH - Patterns verified in Next.js docs and existing project implementation
- Pitfalls: HIGH - Based on Next.js official docs, Satori CSS limitations, and Phase 45 learnings
- User constraints: HIGH - Directly from CONTEXT.md, locked decisions from user discussion

**Research date:** 2026-02-06
**Valid until:** 90 days (Next.js metadata API is stable, SEO best practices evolve slowly)
