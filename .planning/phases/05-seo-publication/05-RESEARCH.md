# Phase 05: SEO + Publication - Research

**Researched:** 2026-01-27
**Domain:** Next.js 16 SEO, Open Graph images, JSON-LD structured data, ISR
**Confidence:** HIGH

## Summary

This research covers the implementation approach for Phase 05: SEO + Publication in a Next.js 16 application. The phase requires dynamic SEO metadata, Open Graph images, JSON-LD structured data (SportsEvent schema), ISR page generation with 60s revalidation, and sitemap auto-generation.

**Primary recommendation:** Use Next.js 16's native Metadata API for all SEO tags (replacing next-seo), leverage the built-in `next/og` ImageResponse API for OG image generation, implement JSON-LD via script tags using the `@graph` pattern for combining multiple schemas, and use Next.js native sitemap file conventions with `generateSitemaps` for chunking large sitemaps.

**Key insight:** The Next.js 16 ecosystem has converged on specific patterns that should be followed. Mixing approaches (like using next-seo alongside the native Metadata API) is a common anti-pattern. The framework now provides first-class support for all SEO requirements without third-party libraries.

## Standard Stack

The established libraries and tools for Next.js 16 SEO implementation:

### Core
| Library/Feature | Version/Purpose | Why Standard |
|-----------------|-----------------|--------------|
| Next.js Metadata API | Built-in (16+) | Official, type-safe, integrated with App Router. Replaces react-helmet, next-seo. |
| next/og ImageResponse | Built-in | Vercel's official OG image generation. Edge Runtime support. |
| Next.js Sitemap API | Built-in | Native sitemap.ts/js file convention with type support. |
| JSON-LD script injection | Native `<script>` | Next.js official recommendation. Type-safe with schema-dts. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-sitemap | ^4.2 | Sitemap config + CLI generation | Complex configurations, robots.txt generation, build-time sitemap |
| schema-dts | ^1.0 | TypeScript types for JSON-LD | Type safety when constructing schema.org types |
| serialize-javascript | ^6.0 | JSON sanitization | Scrub HTML from JSON-LD to prevent XSS |

### Installation
```bash
npm install next-sitemap schema-dts serialize-javascript
```

### What NOT to Use
- **next-seo**: Mixing with Metadata API causes conflicts. The Metadata API in Next.js 16 is complete and supersedes this library.
- **react-helmet**: Deprecated pattern. Metadata API replaced this.
- **Custom OG image generators**: The `next/og` ImageResponse API handles this natively.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── sitemap.ts                    # Main sitemap generator
│   ├── robots.ts                     # Robots.txt generator
│   ├── matches/
│   │   ├── [id]/
│   │   │   ├── page.tsx              # Match detail page with SEO
│   │   │   ├── opengraph-image.tsx   # Dynamic OG image
│   │   │   └── layout.tsx            # Match-specific layout
│   │   └── stats/
│   │       └── [id]/
│   │           └── page.tsx          # Stats page with SEO
│   └── layout.tsx                    # Global layout (org schema)
├── lib/
│   ├── seo/
│   │   ├── metadata.ts               # Reusable metadata builders
│   │   ├── schema/
│   │   │   ├── sports-event.ts       # SportsEvent schema builder
│   │   │   ├── article.ts            # Article schema builder
│   │   │   └── graph.ts              # @graph combiner
│   │   └── og/
│   │       └── templates.ts          # OG image templates
│   └── constants.ts                  # BASE_URL, etc.
└── components/
    └── seo/
        └── json-ld.tsx               # Schema injection component
```

### Pattern 1: Dynamic Metadata with App Router

**What:** Use the `export const metadata` pattern in page.tsx files for dynamic SEO tags.

**When to use:** Every dynamic route page (/matches/{id}, /matches/{id}/stats).

**Example:**
```typescript
// Source: Next.js 16 official docs
import type { Metadata } from 'next'
import { getMatch } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const match = await getMatch(id)

  if (!match) {
    return { title: 'Match Not Found' }
  }

  const title = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} | Match Analysis & Predictions`
  const description = generateMatchDescription(match)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/matches/${id}`,
      type: 'article',
      images: [
        {
          url: `/matches/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/matches/${id}/opengraph-image`],
    },
    alternates: {
      canonical: `/matches/${id}`,
    },
  }
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params
  const match = await getMatch(id)
  // Render page content...
}
```

### Pattern 2: ISR with 60-Second Revalidation

**What:** Use `export const revalidate = 60` for Incremental Static Regeneration.

**When to use:** Match pages that need fresh content without full rebuilds.

**Example:**
```typescript
// Source: Next.js 16 ISR documentation
import type { Metadata } from 'next'

// Revalidate every 60 seconds
export const revalidate = 60

// Pre-render known match IDs at build time
export async function generateStaticParams() {
  const matches = await getAllMatchIds()
  return matches.map((id) => ({ id: String(id) }))
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params
  const match = await getMatch(id)
  // ISR: Page regenerated on demand after 60s
}
```

**How it works:**
1. During build, all known match pages are pre-rendered
2. Requests are cached and serve instantly
3. After 60 seconds, next request serves stale content while regenerating
4. Regenerated page replaces cached version
5. Unknown match IDs generated on-demand (opt-out with `dynamicParams = false`)

### Pattern 3: JSON-LD @graph for Multiple Schemas

**What:** Combine SportsEvent, Article, Person schemas in single @graph structure.

**When to use:** Match detail pages with analysis content, multiple entity types.

**Example:**
```typescript
// Source: Schema.org + Next.js JSON-LD guide
import { Person, SportsEvent, SportsOrganization, Article, WithContext } from 'schema-dts'

interface MatchData {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  startDate: string
  competition: string
  homeTeamLogo: string
  awayTeamLogo: string
  venue: string
  articleHeadline: string
  articlePublished: string
  articleAuthor: string
}

function buildMatchSchema(match: MatchData): WithContext<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!
  const matchUrl = `${baseUrl}/matches/${match.id}`
  
  // Build entities with @id for linking
  const homeTeam: SportsOrganization = {
    '@type': 'SportsTeam',
    '@id': `${matchUrl}#homeTeam`,
    name: match.homeTeam,
    logo: match.homeTeamLogo,
  }
  
  const awayTeam: SportsOrganization = {
    '@type': 'SportsTeam',
    '@id': `${matchUrl}#awayTeam`,
    name: match.awayTeam,
    logo: match.awayTeamLogo,
  }
  
  const event: SportsEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': matchUrl,
    name: `${match.homeTeam} vs ${match.awayTeam}`,
    startDate: match.startDate,
    eventStatus: match.eventStatus,
    location: {
      '@type': 'Place',
      name: match.venue,
    },
    homeTeam: { '@id': `${matchUrl}#homeTeam` },
    awayTeam: { '@id': `${matchUrl}#awayTeam` },
    competitor: [
      { '@id': `${matchUrl}#homeTeam` },
      { '@id': `${matchUrl}#awayTeam` },
    ],
  }
  
  const article: Article = {
    '@type': 'Article',
    '@id': `${matchUrl}#article`,
    headline: match.articleHeadline,
    datePublished: match.articlePublished,
    author: {
      '@type': 'Person',
      '@id': `${baseUrl}#author`,
      name: match.articleAuthor,
    },
    about: { '@id': matchUrl },
  }
  
  const author: Person = {
    '@type': 'Person',
    '@id': `${baseUrl}#author`,
    name: match.articleAuthor,
  }
  
  // Combine in @graph
  return {
    '@context': 'https://schema.org',
    '@graph': [homeTeam, awayTeam, event, article, author],
  } as WithContext<unknown>
}

// In page.tsx
export default async function MatchPage({ params }: Props) {
  const match = await getMatch(params.id)
  const jsonLd = buildMatchSchema(match)
  
  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {/* Page content */}
    </section>
  )
}
```

### Pattern 4: Dynamic OG Image Generation

**What:** Use opengraph-image.tsx file convention with ImageResponse API.

**When to use:** Match detail pages needing dynamic OG images with team scores.

**Example:**
```typescript
// Source: Next.js 16 opengraph-image documentation
import { ImageResponse } from 'next/og'
import { getMatch } from '@/lib/db'

export const alt = 'Match Preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: Props) {
  const { id } = await params
  const match = await getMatch(id)
  
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const template = isFinished ? 'finished' : isLive ? 'live' : 'upcoming'
  
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: template === 'finished' 
            ? 'linear-gradient(to bottom, #1a1a2e, #16213e)'
            : template === 'live'
            ? 'linear-gradient(to bottom, #2d1f3d, #1a1a2e)'
            : 'linear-gradient(to bottom, #1f4037, #99b993)',
          padding: '60px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header with competition */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
          <span style={{ color: 'white', fontSize: '24px' }}>{match.competition}</span>
          <span style={{ 
            color: template === 'live' ? '#ff4444' : 'white',
            fontSize: '24px',
            fontWeight: 'bold',
          }}>
            {isLive ? '● LIVE' : isFinished ? 'FINAL' : match.startDate}
          </span>
        </div>
        
        {/* Teams and score */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
          {/* Home team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={match.homeTeamLogo} style={{ width: 100, height: 100, borderRadius: '50%' }} />
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', marginTop: '16px' }}>
              {match.homeTeam}
            </span>
            {isFinished && (
              <span style={{ color: 'white', fontSize: '64px', fontWeight: 'bold' }}>
                {match.homeScore}
              </span>
            )}
          </div>
          
          {/* VS or score separator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!isFinished && (
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '28px' }}>VS</span>
            )}
          </div>
          
          {/* Away team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={match.awayTeamLogo} style={{ width: 100, height: 100, borderRadius: '50%' }} />
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', marginTop: '16px' }}>
              {match.awayTeam}
            </span>
            {isFinished && (
              <span style={{ color: 'white', fontSize: '64px', fontWeight: 'bold' }}>
                {match.awayScore}
              </span>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '40px',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '20px',
        }}>
          Match Analysis & Predictions
        </div>
      </div>
    ),
    { ...size }
  )
}
```

### Pattern 5: Dynamic Sitemap with Chunking

**What:** Use sitemap.ts with generateSitemaps for large sitemaps.

**When to use:** Applications with >50,000 match URLs.

**Example:**
```typescript
// Source: Next.js 16 sitemap documentation
import type { MetadataRoute } from 'next'
import { getAllMatches, getMatchCount } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

export async function generateSitemaps() {
  const totalMatches = await getMatchCount()
  const sitemapCount = Math.ceil(totalMatches / 50000)
  
  return Array.from({ length: sitemapCount }, (_, i) => ({
    id: i.toString(),
  }))
}

export default async function sitemap({ params }: Props): Promise<MetadataRoute.Sitemap> {
  const { id } = await params
  const sitemapId = parseInt(id)
  const start = sitemapId * 50000
  const end = start + 50000
  
  const matches = await getAllMatches({ range: [start, end] })
  
  return matches.map((match) => ({
    url: `${BASE_URL}/matches/${match.id}`,
    lastModified: match.updatedAt,
    changeFrequency: 'daily' as const,
    priority: match.status === 'live' ? 0.9 : 0.7,
  }))
}
```

**Structure:**
- Main sitemap: `/sitemap.xml` (auto-generated index)
- Chunks: `/matches/sitemap/[id].xml` (e.g., `/matches/sitemap/0.xml`, `/matches/sitemap/1.xml`)

### Pattern 6: SportsEvent Schema Builder

**What:** Reusable function to construct SportsEvent JSON-LD.

**When to use:** Every match detail page.

**Example:**
```typescript
// src/lib/seo/schema/sports-event.ts
import { SportsEvent, SportsOrganization, WithContext } from 'schema-dts'

interface BuildSportsEventParams {
  matchId: string
  homeTeam: { name: string; logo: string }
  awayTeam: { name: string; logo: string }
  homeScore?: number
  awayScore?: number
  startDate: string
  venue: string
  competition: string
  status: 'upcoming' | 'live' | 'finished'
}

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    upcoming: 'https://schema.org/EventScheduled',
    live: 'https://schema.org/EventScheduled',
    finished: 'https://schema.org/EventRescheduled',
  }
  return statusMap[status] || 'https://schema.org/EventScheduled'
}

export function buildSportsEventSchema(params: BuildSportsEventParams): WithContext<SportsEvent> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!
  const matchUrl = `${baseUrl}/matches/${params.matchId}`
  
  const homeTeam: SportsOrganization = {
    '@type': 'SportsTeam',
    '@id': `${matchUrl}#homeTeam`,
    name: params.homeTeam.name,
    logo: params.homeTeam.logo,
  }
  
  const awayTeam: SportsOrganization = {
    '@type': 'SportsTeam',
    '@id': `${matchUrl}#awayTeam`,
    name: params.awayTeam.name,
    logo: params.awayTeam.logo,
  }
  
  const event: SportsEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': matchUrl,
    name: `${params.homeTeam.name} vs ${params.awayTeam.name}`,
    startDate: params.startDate,
    eventStatus: mapStatus(params.status),
    location: {
      '@type': 'Place',
      name: params.venue,
    },
    homeTeam: { '@id': `${matchUrl}#homeTeam` },
    awayTeam: { '@id': `${matchUrl}#awayTeam` },
    competitor: [
      { '@id': `${matchUrl}#homeTeam` },
      { '@id': `${matchUrl}#awayTeam` },
    ],
  }
  
  return {
    '@context': 'https://schema.org',
    '@graph': [homeTeam, awayTeam, event],
  } as WithContext<SportsEvent>
}
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap generation | Custom XML construction | Next.js sitemap.ts + generateSitemaps | Handles chunking, caching, type safety, index sitemaps |
| OG image generation | Canvas/sharp-based service | next/og ImageResponse | Edge Runtime, no cold starts, integrated caching |
| JSON-LD construction | String concatenation | schema-dts + build functions | Type safety, validation, @graph support |
| Metadata management | next-seo + custom hooks | Native Metadata API | First-party support, App Router integration, no conflicts |
| XSS in JSON-LD | Custom sanitization | serialize-javascript or replace pattern | Proven sanitization, escape `<` as `\u003c` |
| robots.txt generation | Custom file generation | Next.js robots.ts | Type-safe, dynamic generation, cached |

**Key insight:** The Next.js 16 Metadata API and built-in features cover 95% of SEO requirements. Building custom solutions introduces maintenance burden, type unsafety, and misses edge cases (caching, chunking, validation).

## Common Pitfalls

### Pitfall 1: Mixing next-seo with Metadata API

**What goes wrong:** Duplicate meta tags, conflicting values, hydration warnings.

**Why it happens:** next-seo was designed for older Next.js patterns. The Metadata API in 16 supersedes it entirely.

**How to avoid:** Use ONLY the native Metadata API. Do not install or use next-seo.

**Warning signs:**
- Duplicate og:title, og:description tags in HTML
- Hydration mismatch warnings
- Metadata not updating on dynamic routes

### Pitfall 2: JSON-LD Not Rendering

**What goes wrong:** Structured data missing from page source, no rich results.

**Why it happens:** Injecting JSON-LD in layout.tsx instead of page.tsx, or using wrong component type.

**How to avoid:** Always inject JSON-LD in page.tsx (not layout), use `<script type="application/ld+json">`.

**Warning signs:**
- Schema Markup Validator shows no structured data
- Google Rich Results Test fails
- Console errors about invalid script type

### Pitfall 3: ISR Cache Stampede

**What goes wrong:** High traffic after cache expiry causes multiple simultaneous regenerations.

**Why it happens:** All users hit stale page at once, triggering many regeneration attempts.

**How to avoid:** Use revalidate > 60s for match pages, or implement on-demand revalidation with tags.

**Warning signs:**
- Spike in server response times at regular intervals
- Multiple regeneration logs for same page
- 504 errors during regeneration

### Pitfall 4: Live Match Data in ISR

**What goes wrong:** Live scores don't update during matches due to 60s revalidation lag.

**Why it happens:** ISR is designed for content that changes on minute/hour scales, not second scales.

**How to avoid:** Use hybrid approach: SSR for live matches (ISR disabled), ISR for finished/upcoming matches. Or implement on-demand revalidation via API route triggered by score updates.

**Warning signs:**
- "Live" match shows outdated score
- Users see "Match in progress" for hours after final whistle
- Complaints about stale live data

### Pitfall 5: Large Sitemap Timeout

**What goes wrong:** Sitemap generation times out or exceeds size limits.

**Why it happens:** Fetching all match data in single query, no pagination, no chunking.

**How to avoid:** Use generateSitemaps with 50,000 URL chunks, paginated database queries, and background generation.

**Warning signs:**
- Sitemap request hangs >30s
- Generated sitemap exceeds 50MB
- Some URLs missing from sitemap

### Pitfall 6: OG Image Not Generated

**What goes wrong:** 404 or blank OG images on social media sharing.

**Why it happens:** Missing opengraph-image.tsx, incorrect ImageResponse usage, no error handling.

**How to avoid:** Implement opengraph-image.tsx in every dynamic route folder, add alt export, test with OG image preview tools.

**Warning signs:**
- Social media share cards show blank images
- `opengraph-image.tsx` missing from route segment
- ImageResponse errors in console

### Pitfall 7: XSS in JSON-LD

**What goes wrong:** Malicious user input in match data executes as JavaScript.

**Why it happens:** Directly stringifying JSON-LD without sanitizing HTML characters.

**How to avoid:** Always escape `<` and `>` characters in JSON-LD content:
```typescript
dangerouslySetInnerHTML={{
  __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}}
```

**Warning signs:**
- Security scanner flags potential XSS
- User input appears in page source as unescaped HTML
- CSP violations in browser console

## Code Examples

### Match Metadata Builder
```typescript
// src/lib/seo/metadata.ts
import type { Metadata } from 'next'

interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: 'upcoming' | 'live' | 'finished'
  competition: string
  startDate: string
}

function generateMatchTitle(match: Match): string {
  const score = match.status === 'upcoming' 
    ? 'vs' 
    : `${match.homeScore}-${match.awayScore}`
  return `${match.homeTeam} ${score} ${match.awayTeam} | Match Analysis & Predictions`
}

function generateMatchDescription(match: Match): string {
  const stateDescriptions = {
    upcoming: `Preview and predictions for ${match.homeTeam} vs ${match.awayTeam} in ${match.competition}. Get AI-powered analysis before the match.`,
    live: `Follow the live action as ${match.homeTeam} takes on ${match.awayTeam} in ${match.competition}. Real-time updates and analysis.`,
    finished: `Full match analysis: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} in ${match.competition}. LLM insights and key moments.`,
  }
  return stateDescriptions[match.status]
}

export function buildMatchMetadata(match: Match): Metadata {
  const title = generateMatchTitle(match)
  const description = generateMatchDescription(match)
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/matches/${match.id}`,
      images: [
        {
          url: `/matches/${match.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `/matches/${match.id}`,
    },
  }
}
```

### JSON-LD Graph Builder
```typescript
// src/lib/seo/schema/graph.ts
import { WithContext } from 'schema-dts'

export function buildGraphSchema<T extends WithContext<unknown>>(
  entities: WithContext<unknown>[]
): WithContext<T> {
  return {
    '@context': 'https://schema.org',
    '@graph': entities,
  } as WithContext<T>
}

export function sanitizeJsonLd(jsonLd: object): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}
```

### OG Image Template Registry
```typescript
// src/lib/seo/og/templates.ts
interface OGTemplateConfig {
  name: string
  background: string
  textColor: string
  accentColor: string
}

export const OG_TEMPLATES = {
  upcoming: {
    name: 'preview',
    background: 'linear-gradient(to bottom, #1f4037, #99b993)',
    textColor: '#ffffff',
    accentColor: '#4ade80',
  } as OGTemplateConfig,
  
  live: {
    name: 'live',
    background: 'linear-gradient(to bottom, #2d1f3d, #1a1a2e)',
    textColor: '#ffffff',
    accentColor: '#ef4444',
  } as OGTemplateConfig,
  
  finished: {
    name: 'result',
    background: 'linear-gradient(to bottom, #1a1a2e, #16213e)',
    textColor: '#ffffff',
    accentColor: '#fbbf24',
  } as OGTemplateConfig,
}

export function getOGTemplate(status: Match['status']): OGTemplateConfig {
  return OG_TEMPLATES[status]
}
```

### On-Demand Revalidation Route
```typescript
// src/app/api/revalidate-match/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  const { matchId, secret } = await request.json()
  
  // Validate webhook secret
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }
  
  // Revalidate both match pages
  revalidatePath(`/matches/${matchId}`)
  revalidatePath(`/matches/${matchId}/stats`)
  
  return NextResponse.json({ 
    revalidated: true, 
    now: Date.now(),
    paths: [`/matches/${matchId}`, `/matches/${matchId}/stats`],
  })
}
```

### Sitemap Index Generator
```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next'
import { getRecentMatches, getActiveCompetitions } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

export default function sitemap(): MetadataRoute.Sitemap {
  const basePages = [
    { url: BASE_URL, priority: 1.0 },
    { url: `${BASE_URL}/matches`, priority: 0.9 },
    { url: `${BASE_URL}/leaderboard`, priority: 0.7 },
    { url: `${BASE_URL}/models`, priority: 0.6 },
  ]
  
  return basePages.map((page) => ({
    url: page.url,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: page.priority,
  }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-helmet | Next.js Metadata API | Next.js 13+ | First-party support, App Router integration |
| next-seo plugin | Native Metadata API | Next.js 16 | No conflicts, complete feature coverage |
| Custom OG images | next/og ImageResponse | Next.js 13+ | Edge Runtime, built-in caching, no cold starts |
| Static sitemap.xml | sitemap.ts + generateSitemaps | Next.js 13.3+ | Dynamic generation, type safety, chunking |
| String JSON-LD | schema-dts + script tags | 2024+ | Type safety, validation, maintainability |
| Build-time ISR | On-demand revalidation | 2024+ | Instant updates, no build triggers |

**Deprecated/outdated:**
- `next-seo`: Use native Metadata API instead
- `react-helmet`: Deprecated, use Metadata API
- `<Head>` component: Removed in App Router
- Static export for dynamic sitemaps: Use server-side sitemap.ts

**Current best practices (2025):**
- Use Metadata API for all SEO tags
- Use next/og for all OG images
- Use schema-dts for type-safe JSON-LD
- Use on-demand revalidation for live content
- Use sitemap.ts with generateSitemaps for large sitemaps

## Open Questions

1. **Live Match Updates with ISR**
   - What we know: ISR with 60s revalidation creates lag for live scores
   - What's unclear: Optimal hybrid strategy (SSR + ISR fallback)
   - Recommendation: Implement on-demand revalidation via webhook from score provider, fallback to 60s ISR

2. **Person Schema for Authors**
   - What we know: Need Person schema for LLM model attribution
   - What's unclear: How to structure multiple models as "authors" vs single author per article
   - Recommendation: Create separate @id for each model, link via author property

3. **Competition Logo Handling**
   - What we know: SportsEvent can link to competition via superEvent
   - What's unclear: Whether competition logos in OG images violate any licensing
   - Recommendation: Use text-based competition names in OG templates, verify licensing before using logos

## Sources

### Primary (HIGH confidence)
- Next.js 16 official documentation - Metadata API, ISR, Sitemap, OG images
- Schema.org official documentation - SportsEvent, Person, Article, @graph patterns
- Vercel official docs - @vercel/og ImageResponse API

### Secondary (MEDIUM confidence)
- next-sitemap GitHub - Dynamic sitemap patterns, generateSitemaps examples
- Schema.org examples - SportsEvent JSON-LD implementations
- Community guides - JSON-LD @graph patterns, on-demand revalidation

### Tertiary (LOW confidence)
- Stack Overflow - JSON-LD @id linking patterns
- GitHub discussions - ISR with live data edge cases

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Based on official Next.js 16 docs and modern best practices
- Architecture: HIGH - Verified with Next.js official examples and Schema.org
- Pitfalls: MEDIUM - Community-reported issues, some verified with official docs

**Research date:** 2026-01-27
**Valid until:** 2026-07-27 (6 months for stable SEO patterns)
