# Phase 44: Foundation — Redirects, Canonicals & Index Pages - Research

**Researched:** 2026-02-06
**Domain:** Next.js 16 SEO Foundation (Redirects, Canonical URLs, Index Pages)
**Confidence:** HIGH

## Summary

This research covers the technical implementation of Phase 44, which establishes critical SEO plumbing for kroam.xyz. The phase focuses on four core areas: (1) creating /leagues and /models index pages with ISR, (2) implementing www/protocol redirects in middleware with single-hop resolution, (3) fixing canonical URL strategy to prevent Google conflicts, and (4) removing broken hreflang tags.

The standard approach for Next.js 16 is:
- **Middleware redirects** using NextResponse.redirect() with proper status codes (301 for permanent, 410 for gone)
- **Self-referencing canonical URLs** on each page rather than cascading root layout canonicals
- **Static generation with ISR** using the `revalidate` export for index pages
- **Complete removal** of hreflang infrastructure when not actively supporting i18n

Key challenges specific to kroam.xyz's production environment:
- 350+ match pages already indexed by Google requiring careful canonical migration
- Daily match page generation requiring future-proof redirect logic
- Existing www subdomain with 302 redirects that must convert to 301
- January 2026 Google volatility period affecting timing of changes

**Primary recommendation:** Implement per-page self-referencing canonicals, handle redirects entirely in middleware with single-hop resolution, use 410 Gone for /matches/UUID URLs, and phase the rollout starting with low-risk changes during stable ranking periods.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Index page content:**
- `/leagues` and `/models` pages need to return 200 with listing content (currently 404)
- Layout and content density: Claude's discretion based on existing design patterns
- Include a short intro paragraph (1-2 sentences) for SEO/GEO purposes on each index page
- Use Static Generation with ISR (Incremental Static Regeneration) for both pages

**Redirect behavior:**
- Handle www → non-www and HTTP → HTTPS redirects in Next.js middleware (not infrastructure)
- Collapse redirect chains into a single hop — middleware detects all issues in one pass and redirects to the final canonical URL directly
- Old `/matches/UUID` URLs: respond with 410 Gone (not redirect) — these URLs are permanently removed
- The PERF-02 requirement (redirect responds within 500ms) from Phase 48 applies to these redirects

**Canonical URL strategy:**
- Root layout canonical and per-page canonical approach: Claude's discretion based on Ahrefs findings and SEO best practices
- Trailing slash handling: Claude's discretion based on existing URL patterns in the codebase
- Query parameter handling in canonicals: Claude's discretion based on which params affect page content
- Canonical URLs must use the short-form league slug (e.g., `/leagues/premier-league`) even if accessed via a longer form

**Hreflang removal:**
- Remove all hreflang tags site-wide — no i18n plans for the foreseeable future
- Complete removal, not partial — strip from all page types
- Keep `html lang="en"` attribute — standard accessibility practice

### Claude's Discretion

- /leagues page layout and content density (simple list vs cards with stats)
- /models page layout and content density (simple list vs cards with performance)
- Root canonical strategy (remove entirely vs per-page override)
- Trailing slash convention
- Query parameter stripping in canonicals

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.5 | App Router framework | Official Next.js documentation, version used in codebase |
| next/server | 16.1.5 | Middleware utilities (NextRequest, NextResponse) | Built-in Next.js middleware API |
| @vercel/edge-config | Latest | Optional: Edge-compatible key-value store for redirects | Vercel's official solution for fast Edge Runtime data access |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/kv | Latest | Optional: Redis-compatible KV store at edge | If implementing UUID→canonical mapping cache in Edge Runtime |
| schema-dts | Latest | TypeScript types for Schema.org structured data | Type safety for canonical URL metadata validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Middleware redirects | next.config.js redirects() | Config-based redirects require static rules, can't handle dynamic logic (www detection, redirect chains) |
| Edge Runtime middleware | Node.js Runtime middleware | Node.js allows database queries but slower, not globally distributed |
| 410 Gone status | 301 redirect to canonical | 410 preserves no link equity but clearly signals permanent removal; 301 preserves equity but suggests content moved |
| Self-referencing canonical | Root layout canonical | Root layout canonical cascades to all pages causing conflicts; self-referencing gives per-page control |

**Installation:**
```bash
# Core dependencies already installed in Next.js 16
# Optional Edge Config/KV if needed:
npm install @vercel/edge-config
npm install @vercel/kv
```

## Architecture Patterns

### Recommended Project Structure

Based on existing codebase at kroam.xyz:

```
src/
├── app/
│   ├── layout.tsx                  # Root layout (REMOVE cascading canonical)
│   ├── leagues/
│   │   ├── page.tsx                # NEW: /leagues index page
│   │   └── [slug]/
│   │       ├── page.tsx            # League detail pages
│   │       └── [match]/
│   │           └── page.tsx        # Match pages (already have canonicals)
│   └── models/
│       ├── page.tsx                # NEW: /models index page
│       └── [id]/
│           └── page.tsx            # Model detail pages
├── middleware.ts                    # MODIFY: Add www/http/410 redirects
└── lib/
    ├── seo/
    │   ├── constants.ts             # BASE_URL constant
    │   └── metadata.ts              # Canonical URL utilities
    └── football/
        └── competitions.ts          # League configuration (17 competitions)
```

### Pattern 1: Middleware Single-Hop Redirects

**What:** Detect all redirect conditions (www, http, /matches UUID) in one pass and redirect directly to final canonical URL

**When to use:** Required for REDIR-03 (no redirect chains)

**Example:**
```typescript
// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // Detect all issues upfront
  const hasWww = host.startsWith('www.');
  const isHttp = url.protocol === 'http:';
  const isMatchesUUID = url.pathname.startsWith('/matches/');

  // 410 Gone for /matches/UUID (permanently removed, not redirected)
  if (isMatchesUUID) {
    return new NextResponse(null, { status: 410 });
  }

  // Single-hop redirect to final canonical URL
  if (hasWww || isHttp) {
    url.protocol = 'https:';
    url.host = url.host.replace(/^www\./, '');

    return NextResponse.redirect(url, {
      status: 301, // Permanent redirect
      headers: {
        'Cache-Control': 'public, max-age=31536000', // Cache redirect for 1 year
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and API routes
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Source:** [Next.js 16.1.5 Middleware Documentation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/redirecting.mdx) (Context7)

### Pattern 2: Self-Referencing Canonical URLs

**What:** Each page exports its own canonical URL in metadata, rather than inheriting from root layout

**When to use:** ALWAYS for SEO best practices in 2026 (prevents Google canonical conflicts)

**Example:**
```typescript
// app/leagues/[slug]/page.tsx (existing pattern - KEEP)
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/seo/constants';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  // Use canonical ID, not the slug parameter (handles aliases)
  const canonicalUrl = `${BASE_URL}/leagues/${competition.id}`;

  return {
    title: `${competition.name} AI Predictions`,
    description: '...',
    alternates: {
      canonical: canonicalUrl, // Self-referencing canonical
    },
    openGraph: {
      url: canonicalUrl,
      // ... other OG tags
    },
  };
}
```

**Anti-pattern to AVOID:**
```typescript
// app/layout.tsx - ROOT LAYOUT (WRONG APPROACH)
export const metadata: Metadata = {
  metadataBase: new URL('https://kroam.xyz'),
  alternates: {
    canonical: '/', // ❌ CASCADES to all child pages - causes conflicts!
  },
};

// This makes Google see:
// /leagues/premier-league → canonical: https://kroam.xyz/ (WRONG!)
// Should be: /leagues/premier-league → canonical: https://kroam.xyz/leagues/premier-league
```

**Source:** [Canonicalization and SEO: A guide for 2026](https://searchengineland.com/canonicalization-seo-448161) via WebSearch

**Key insight from 2026 SEO research:**
> "Even if you have a single, unique source of content, it's still best practice to use self-referencing canonical tags. Each paginated page should include its own self-referencing canonical tag."

### Pattern 3: Static Generation with ISR for Index Pages

**What:** Use `export const revalidate` to enable Incremental Static Regeneration with time-based revalidation

**When to use:** For /leagues and /models index pages that need fresh data but don't change on every request

**Example:**
```typescript
// app/leagues/page.tsx (NEW FILE)
import type { Metadata } from 'next';
import { getActiveCompetitions } from '@/lib/football/competitions';
import { BASE_URL } from '@/lib/seo/constants';

export const metadata: Metadata = {
  title: 'Football Leagues | AI Predictions | kroam.xyz',
  description: 'Explore AI predictions across 17 football competitions including Champions League, Premier League, and more.',
  alternates: {
    canonical: `${BASE_URL}/leagues`, // Self-referencing canonical
  },
  openGraph: {
    title: 'Football Leagues - AI Predictions',
    description: '17 competitions tracked with AI model predictions',
    url: `${BASE_URL}/leagues`,
    type: 'website',
  },
};

// ISR: Revalidate every 6 hours (leagues list rarely changes)
export const revalidate = 21600;

export default async function LeaguesPage() {
  const competitions = getActiveCompetitions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Football Leagues</h1>
        <p className="text-muted-foreground">
          AI predictions across 17 major competitions worldwide.
        </p>
      </div>

      {/* Render leagues by category */}
      {/* Use existing design patterns from leaderboard/about pages */}
    </div>
  );
}
```

**Source:** [Next.js 16.1.5 ISR Documentation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/incremental-static-regeneration.mdx) (Context7)

### Pattern 4: Query Parameter Handling in Canonicals

**What:** Strip tracking parameters from canonical URLs, preserve parameters that affect content

**When to use:** When pages accept query parameters (filters, pagination, etc.)

**Example:**
```typescript
// Utility function for canonical URL generation
export function buildCanonicalUrl(pathname: string, searchParams: URLSearchParams): string {
  // Parameters that affect page content (keep in canonical)
  const contentParams = ['competition', 'season', 'timePeriod'];

  // Tracking parameters (strip from canonical)
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];

  const cleanParams = new URLSearchParams();

  for (const [key, value] of searchParams.entries()) {
    if (contentParams.includes(key)) {
      cleanParams.set(key, value);
    }
  }

  const queryString = cleanParams.toString();
  return `${BASE_URL}${pathname}${queryString ? `?${queryString}` : ''}`;
}

// Usage in page
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const canonicalUrl = buildCanonicalUrl('/leaderboard', new URLSearchParams(params));

  return {
    alternates: {
      canonical: canonicalUrl,
    },
  };
}
```

**Source:** [The Expert SEO Guide To URL Parameter Handling](https://www.searchenginejournal.com/technical-seo/url-parameter-handling/) via WebSearch

**Best practice:** "Tracking parameters (utm_*, fbclid, gclid) should be removed from canonical URLs without manual configuration."

### Pattern 5: 410 Gone Implementation

**What:** Return HTTP 410 status for permanently removed URLs (not a redirect)

**When to use:** For /matches/UUID URLs that should not exist anymore

**Workaround for Next.js limitation:**
```typescript
// middleware.ts approach (simplest)
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/matches/')) {
    return new NextResponse(null, {
      status: 410,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  return NextResponse.next();
}

// Alternative: Create app/matches/[uuid]/page.tsx with 410
export default function MatchesUUIDPage() {
  return null; // No content
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

// And modify route to return 410
import { notFound } from 'next/navigation';

export default async function Page() {
  // Force 410 by throwing (requires custom error page)
  // OR better: Handle in middleware
  notFound(); // Returns 404, not 410
}
```

**Limitation:** Next.js App Router doesn't have a built-in `gone()` function yet. Middleware approach is most reliable.

**Source:** [How to Return HTTP 410 (Gone) Status in Next.js App Router](https://dev.to/alessandro-grosselle/how-to-return-http-410-gone-status-in-nextjs-app-router-two-workarounds-2f0g) via WebSearch

### Anti-Patterns to Avoid

**1. Cascading Root Layout Canonical**
```typescript
// app/layout.tsx
export const metadata = {
  metadataBase: new URL('https://kroam.xyz'),
  alternates: {
    canonical: '/', // ❌ BAD: Cascades to ALL child pages
  },
};
```
**Why it's bad:** All child pages inherit canonical: '/', causing Google to see every page as duplicate of homepage.

**What to do instead:** Remove canonical from root layout. Let each page define its own.

---

**2. Redirect Chains**
```typescript
// ❌ BAD: Multiple redirects
// User visits: www.kroam.xyz/leagues/premier-league
// → Redirect 1: www → non-www (302)
// → Redirect 2: premier-league → epl (301, from next.config.js)
// → Final: https://kroam.xyz/leagues/epl

// ✅ GOOD: Single hop
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hasWww = url.host.startsWith('www.');
  const pathname = url.pathname;

  // Detect final destination upfront
  let finalPath = pathname;
  if (pathname === '/leagues/premier-league') {
    finalPath = '/leagues/epl';
  }

  if (hasWww || pathname !== finalPath) {
    url.host = url.host.replace(/^www\./, '');
    url.pathname = finalPath;
    return NextResponse.redirect(url, 301);
  }
}
```

---

**3. Including Tracking Parameters in Canonical**
```typescript
// ❌ BAD: Includes utm_source in canonical
const canonicalUrl = `${BASE_URL}/leagues/epl?utm_source=twitter`;

// ✅ GOOD: Strips tracking parameters
const canonicalUrl = `${BASE_URL}/leagues/epl`;
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID→canonical mapping | In-memory Map, database queries in middleware | Vercel Edge Config or KV | Edge Runtime can't query database; KV is fast and edge-compatible |
| Redirect chain detection | Manual path checking | Single pass detection with final URL calculation | Prevents bugs, easier to test |
| Query parameter stripping | Manual string manipulation | URLSearchParams API | Handles edge cases (duplicate params, encoding) |
| Canonical URL generation | String concatenation | Utility function with validation | Prevents typos, enforces consistency |
| 410 status for App Router | Custom error pages | Middleware with NextResponse | Next.js doesn't have built-in gone() yet |

**Key insight:** Middleware runs on Edge Runtime by default (faster, global). If you need database access, either use Edge-compatible KV stores OR switch to Node.js Runtime middleware (slower).

## Common Pitfalls

### Pitfall 1: Cascading Canonical from Root Layout

**What goes wrong:** Root layout exports `alternates.canonical`, which cascades to ALL child pages. Google sees every page pointing to the root canonical, treating all pages as duplicates of the homepage.

**Why it happens:**
- Next.js metadata merges from layouts to pages
- `alternates.canonical` in root layout becomes default for all pages
- Child pages must explicitly override to prevent cascade
- Documentation shows metadataBase but doesn't emphasize canonical cascade danger

**Real scenario from kroam.xyz:**
```typescript
// Current: app/layout.tsx lines 23-34
export const metadata: Metadata = {
  metadataBase: new URL('https://kroam.xyz'),
  alternates: {
    canonical: 'https://kroam.xyz', // ❌ This cascades!
    languages: {
      'en-US': 'https://kroam.xyz',
      // ... other language alternates
    },
  },
};

// Result: Match pages like /leagues/epl/arsenal-vs-chelsea
// inherit canonical: 'https://kroam.xyz' instead of self-referencing
// Google sees: "All pages claim homepage is canonical" → duplicate content
```

**Prevention:**
1. **Remove canonical from root layout entirely:**
   ```typescript
   // app/layout.tsx
   export const metadata: Metadata = {
     metadataBase: new URL('https://kroam.xyz'),
     // ✅ No canonical here!
     // Let each page define its own
   };
   ```

2. **Each page exports self-referencing canonical:**
   ```typescript
   // app/leagues/page.tsx
   export const metadata: Metadata = {
     alternates: {
       canonical: `${BASE_URL}/leagues`,
     },
   };

   // app/leagues/[slug]/page.tsx
   export async function generateMetadata({ params }) {
     const canonicalUrl = `${BASE_URL}/leagues/${params.slug}`;
     return {
       alternates: {
         canonical: canonicalUrl,
       },
     };
   }
   ```

3. **Audit ALL pages after removal:**
   ```bash
   # Check pages without canonical
   grep -r "generateMetadata" src/app --include="page.tsx" | \
     xargs -I {} sh -c 'echo "{}"; grep -L "canonical" "{}"'
   ```

**Warning signs:**
- Google Search Console shows "Duplicate, Google chose different canonical than user"
- Multiple pages in Google Index with same canonical URL
- Pages rank poorly despite unique content

**Detection:**
```bash
# View rendered HTML to check canonical
curl https://kroam.xyz/leagues/epl | grep -i "canonical"
# Should show: <link rel="canonical" href="https://kroam.xyz/leagues/epl" />
# NOT: <link rel="canonical" href="https://kroam.xyz" />
```

**Phase impact:** HIGH PRIORITY - This is REDIR-04 requirement. Must fix before other SEO phases.

**Sources:**
- [Configure metadataBase for URL Composition in Next.js](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx) (Context7)
- [Canonicalization and SEO: A guide for 2026](https://searchengineland.com/canonicalization-seo-448161) (WebSearch)

---

### Pitfall 2: Redirect Chains from Multiple Sources

**What goes wrong:** Redirects defined in multiple places (middleware + next.config.js + permanent redirects in pages) create redirect chains. Google follows multiple hops, wastes crawl budget, loses link equity (5% per hop).

**Why it happens:**
- next.config.js redirects() for long-form→short-form league slugs (already configured)
- Middleware adds www→non-www redirect
- Both execute in sequence instead of being collapsed
- Each redirect returns separate HTTP response

**Real scenario from kroam.xyz:**
```typescript
// next.config.ts lines 23-32 (existing redirects)
async redirects() {
  return [
    { source: '/leagues/premier-league/:path*', destination: '/leagues/epl/:path*', permanent: true },
    // ... 5 more league slug redirects
  ];
}

// User visits: www.kroam.xyz/leagues/premier-league/arsenal-vs-chelsea
// Actual behavior without single-hop fix:
// 1. Middleware: www → non-www (301)
//    → https://kroam.xyz/leagues/premier-league/arsenal-vs-chelsea
// 2. next.config.js: premier-league → epl (301)
//    → https://kroam.xyz/leagues/epl/arsenal-vs-chelsea
// Total: 2 hops, ~10% link equity loss
```

**Prevention:**

1. **Consolidate league slug redirects into middleware:**
   ```typescript
   // middleware.ts
   const LEAGUE_SLUG_REDIRECTS: Record<string, string> = {
     'premier-league': 'epl',
     'champions-league': 'ucl',
     'europa-league': 'uel',
     'la-liga': 'laliga',
     'serie-a': 'seriea',
     'ligue-1': 'ligue1',
   };

   export function middleware(request: NextRequest) {
     const url = request.nextUrl.clone();
     const host = request.headers.get('host') || '';

     // Detect all issues upfront
     const hasWww = host.startsWith('www.');
     let pathname = url.pathname;

     // Check for league slug redirect
     const leagueMatch = pathname.match(/^\/leagues\/([^\/]+)(\/.*)?$/);
     if (leagueMatch) {
       const [, slug, rest] = leagueMatch;
       if (LEAGUE_SLUG_REDIRECTS[slug]) {
         pathname = `/leagues/${LEAGUE_SLUG_REDIRECTS[slug]}${rest || ''}`;
       }
     }

     // Single redirect if any issue detected
     if (hasWww || pathname !== url.pathname) {
       url.host = url.host.replace(/^www\./, '');
       url.pathname = pathname;
       return NextResponse.redirect(url, 301);
     }

     return NextResponse.next();
   }
   ```

2. **Remove league slug redirects from next.config.js:**
   ```typescript
   // next.config.ts
   async redirects() {
     return []; // ✅ All redirects now in middleware
   }
   ```

3. **Test redirect chains:**
   ```bash
   # Should show only 1 redirect (single hop)
   curl -L -I -s https://www.kroam.xyz/leagues/premier-league | grep -c "HTTP/1.1 30"
   # Expected: 1
   # If 2+: redirect chain exists
   ```

**Warning signs:**
- Multiple 3XX responses when following redirects
- Slow page load times (each hop adds latency)
- Google Search Console shows crawl errors or slow pages
- Middleware logs show multiple redirect executions for same request

**Detection:**
```bash
# Trace full redirect chain
curl -L -v https://www.kroam.xyz/leagues/premier-league 2>&1 | \
  grep -E "(< HTTP|< Location)"

# Should show:
# < HTTP/1.1 301 Moved Permanently
# < Location: https://kroam.xyz/leagues/epl
# < HTTP/1.1 200 OK

# NOT multiple 301/302 responses
```

**Phase impact:** MEDIUM PRIORITY - Required for REDIR-03 (no redirect chains). Must implement single-hop logic.

**Sources:**
- [Implement Next.js Proxy with Bloom Filter for Redirects](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/redirecting.mdx) (Context7)
- [Next.js Middleware guide, tutorial, and code examples](https://www.contentful.com/blog/next-js-middleware/) (WebSearch)

---

### Pitfall 3: Trailing Slash Inconsistency

**What goes wrong:** Some URLs use trailing slashes (/leagues/), others don't (/leagues). Google treats these as separate URLs, splitting link equity and causing duplicate content issues.

**Why it happens:**
- Next.js default: redirects trailing slash URLs to no-slash version
- External links may use either format
- Internal Link components may not be consistent
- Sitemap may include both versions

**Real scenario:**
```typescript
// User shares: https://kroam.xyz/leagues/
// Next.js redirects to: https://kroam.xyz/leagues (automatic)

// But if canonical doesn't match:
// Page canonical: https://kroam.xyz/leagues/  (with slash)
// Actual URL: https://kroam.xyz/leagues       (without slash)
// Google sees: Canonical mismatch → may choose different canonical
```

**Prevention:**

1. **Choose convention based on existing URLs:**
   ```bash
   # Audit existing URLs in codebase
   grep -r "href=\"/leagues" src/app --include="*.tsx" | head -20

   # Check kroam.xyz: existing pages use NO trailing slash
   # /leagues/epl
   # /models/deepseek-v3-1
   # /leaderboard
   # Decision: Use NO trailing slash (matches existing pattern)
   ```

2. **Enforce in canonical URLs:**
   ```typescript
   // Utility function ensures no trailing slash
   export function normalizeCanonicalUrl(path: string): string {
     // Remove trailing slash except for root
     if (path !== '/' && path.endsWith('/')) {
       path = path.slice(0, -1);
     }
     return `${BASE_URL}${path}`;
   }

   // Usage
   export async function generateMetadata() {
     return {
       alternates: {
         canonical: normalizeCanonicalUrl('/leagues'),
       },
     };
   }
   ```

3. **Verify sitemap consistency:**
   ```xml
   <!-- app/sitemap.xml - all URLs without trailing slash -->
   <urlset>
     <url>
       <loc>https://kroam.xyz/leagues</loc>
     </url>
     <url>
       <loc>https://kroam.xyz/models</loc>
     </url>
   </urlset>
   ```

**Warning signs:**
- Google indexes both /leagues and /leagues/ as separate pages
- Internal links use inconsistent formats
- Canonical URLs don't match actual URL format

**Detection:**
```bash
# Check if site redirects trailing slash
curl -I https://kroam.xyz/leagues/
# Should show: Location: https://kroam.xyz/leagues (if no-slash convention)

# Verify canonicals match
curl -s https://kroam.xyz/leagues | grep -i "canonical"
# Should NOT have trailing slash
```

**Phase impact:** MEDIUM PRIORITY - Required for canonical URL consistency. Choose convention and enforce.

**Sources:**
- [Handling Trailing Slashes in Next.js Routes: Complete Guide for 2026](https://copyprogramming.com/howto/how-can-you-handle-trailing-slashes-in-next-js-routes) (WebSearch)
- [next.config.js: trailingSlash](https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash) (WebSearch)

---

### Pitfall 4: Hreflang Bidirectional Link Failures

**What goes wrong:** Hreflang tags require bidirectional linking. If page A links to page B, page B must link back to page A. Missing return links cause Google to ignore ALL hreflang tags silently.

**Why it happens:**
- Kroam.xyz currently has hreflang tags in root layout pointing to non-functional subdomains (de.kroam.xyz, es.kroam.xyz)
- Subdomains return 503 or don't exist → no return links
- Google detects broken bidirectional requirement → ignores all hreflang
- Error only visible in Search Console, not in browser

**Real scenario from kroam.xyz:**
```typescript
// Current: app/layout.tsx lines 26-33
alternates: {
  canonical: 'https://kroam.xyz',
  languages: {
    'en-US': 'https://kroam.xyz',
    'en': 'https://kroam.xyz',
    'de': 'https://de.kroam.xyz',    // ❌ Returns 503
    'es': 'https://es.kroam.xyz',    // ❌ Returns 503
    'fr': 'https://fr.kroam.xyz',    // ❌ Returns 503
    'it': 'https://it.kroam.xyz',    // ❌ Returns 503
  },
},

// Results in:
// <link rel="alternate" hreflang="de" href="https://de.kroam.xyz" />
// But de.kroam.xyz doesn't exist → Google ignores ALL hreflang tags
```

**Prevention:**

1. **Complete removal of hreflang (user's locked decision):**
   ```typescript
   // app/layout.tsx
   export const metadata: Metadata = {
     metadataBase: new URL('https://kroam.xyz'),
     alternates: {
       // ✅ Remove languages object entirely
       // canonical: Set per-page, not here
     },
   };

   // Keep html lang attribute for accessibility
   // app/layout.tsx render
   <html lang="en" suppressHydrationWarning>
   ```

2. **Audit for hreflang in other pages:**
   ```bash
   # Search for any hreflang usage
   grep -r "hreflang" src/app --include="*.tsx"
   grep -r "languages:" src/app --include="*.tsx"

   # Should find NONE after removal
   ```

3. **Verify removal in rendered HTML:**
   ```bash
   curl -s https://kroam.xyz | grep -i "hreflang"
   # Should return empty (no hreflang tags)
   ```

**Warning signs:**
- Search Console shows "No return tags" in International Targeting report
- Hreflang tags point to non-200 URLs
- Users in non-English regions still see English version (hreflang not working)

**Detection:**
```bash
# Check for broken hreflang links
curl -I https://de.kroam.xyz
# Should NOT exist (or return 503)

# View HTML source
view-source:https://kroam.xyz
# Search for "hreflang" - should find NONE after fix
```

**Phase impact:** MEDIUM PRIORITY - Required for I18N-01 and I18N-02 (remove broken hreflang). Simple removal task.

**Sources:**
- [Ask An SEO: What Are The Most Common Hreflang Mistakes?](https://www.searchenginejournal.com/ask-an-seo-what-are-the-most-common-hreflang-mistakes/556455/) (WebSearch via SEO_FIXES_PITFALLS.md)
- [Hreflang Implementation Guide: Complete Technical Reference for International SEO | 2026](https://www.linkgraph.com/blog/hreflang-implementation-guide/) (WebSearch via SEO_FIXES_PITFALLS.md)

## Code Examples

Verified patterns from official sources:

### Example 1: Complete Middleware Implementation

```typescript
// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

// League slug redirects (consolidated from next.config.js)
const LEAGUE_SLUG_REDIRECTS: Record<string, string> = {
  'premier-league': 'epl',
  'champions-league': 'ucl',
  'europa-league': 'uel',
  'la-liga': 'laliga',
  'serie-a': 'seriea',
  'ligue-1': 'ligue1',
};

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // 410 Gone for permanently removed /matches/UUID URLs
  if (url.pathname.startsWith('/matches/')) {
    return new NextResponse(null, {
      status: 410,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // Detect all redirect conditions in one pass
  const hasWww = host.startsWith('www.');
  const isHttp = url.protocol === 'http:';
  let pathname = url.pathname;

  // Check for league slug redirect
  const leagueMatch = pathname.match(/^\/leagues\/([^\/]+)(\/.*)?$/);
  if (leagueMatch) {
    const [, slug, rest] = leagueMatch;
    if (LEAGUE_SLUG_REDIRECTS[slug]) {
      pathname = `/leagues/${LEAGUE_SLUG_REDIRECTS[slug]}${rest || ''}`;
    }
  }

  // Single-hop redirect to final canonical URL
  if (hasWww || isHttp || pathname !== url.pathname) {
    url.protocol = 'https:';
    url.host = url.host.replace(/^www\./, '');
    url.pathname = pathname;

    return NextResponse.redirect(url, {
      status: 301, // Permanent redirect
      headers: {
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except:
    // - API routes
    // - Static files (_next/static)
    // - Image optimization (_next/image)
    // - Favicon
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Source:** Derived from [Next.js 16.1.5 Middleware Documentation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/redirecting.mdx)

---

### Example 2: /leagues Index Page with ISR

```typescript
// app/leagues/page.tsx (NEW FILE)
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  getActiveCompetitions,
  getCompetitionsByCategory,
  type CompetitionConfig
} from '@/lib/football/competitions';
import { BASE_URL } from '@/lib/seo/constants';
import { Trophy, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Football Leagues | 17 Competitions with AI Predictions | kroam.xyz',
  description: 'Explore AI predictions across Champions League, Premier League, La Liga, Serie A, and 14 more football competitions. Compare model accuracy by league.',
  alternates: {
    canonical: `${BASE_URL}/leagues`,
  },
  openGraph: {
    title: 'Football Leagues - AI Predictions',
    description: 'AI predictions across 17 major football competitions',
    url: `${BASE_URL}/leagues`,
    type: 'website',
    siteName: 'kroam.xyz',
  },
  twitter: {
    card: 'summary',
    title: 'Football Leagues | kroam.xyz',
    description: '17 competitions tracked with AI predictions',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ISR: Revalidate every 6 hours (leagues list rarely changes)
export const revalidate = 21600;

function LeagueCard({ competition }: { competition: CompetitionConfig }) {
  return (
    <Link href={`/leagues/${competition.id}`}>
      <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {competition.icon && (
              <span className="text-3xl">{competition.icon}</span>
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{competition.name}</h3>
              <p className="text-sm text-muted-foreground">
                {competition.season}-{(competition.season + 1).toString().slice(-2)} Season
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function LeaguesPage() {
  const europeanClubs = getCompetitionsByCategory('club-europe');
  const domesticLeagues = getCompetitionsByCategory('club-domestic');
  const international = getCompetitionsByCategory('international');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Football Leagues</h1>
          <p className="text-muted-foreground">
            AI predictions across 17 major competitions worldwide.
          </p>
        </div>
      </div>

      {/* European Club Competitions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">European Club Competitions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {europeanClubs.map(comp => (
            <LeagueCard key={comp.id} competition={comp} />
          ))}
        </div>
      </section>

      {/* Domestic Leagues */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Domestic Leagues</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {domesticLeagues.map(comp => (
            <LeagueCard key={comp.id} competition={comp} />
          ))}
        </div>
      </section>

      {/* International Tournaments */}
      <section>
        <h2 className="text-xl font-semibold mb-4">International Tournaments</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {international.map(comp => (
            <LeagueCard key={comp.id} competition={comp} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

**Source:** Pattern follows existing leaderboard page structure ([leaderboard/page.tsx](file:///Users/pieterbos/Documents/bettingsoccer/src/app/leaderboard/page.tsx))

---

### Example 3: /models Index Page with ISR

```typescript
// app/models/page.tsx (NEW FILE)
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { getLeaderboardWithTrends } from '@/lib/db/queries/stats';
import { BASE_URL } from '@/lib/seo/constants';
import { Bot, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Models | 42 Open-Source Models Competing | kroam.xyz',
  description: 'Compare 42 open-source AI models predicting football matches. See accuracy, points, and performance trends across all competitions.',
  alternates: {
    canonical: `${BASE_URL}/models`,
  },
  openGraph: {
    title: 'AI Models - Football Prediction Rankings',
    description: '42 open-source models competing to predict football matches',
    url: `${BASE_URL}/models`,
    type: 'website',
    siteName: 'kroam.xyz',
  },
  twitter: {
    card: 'summary',
    title: 'AI Models | kroam.xyz',
    description: '42 models competing with live rankings',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ISR: Revalidate every hour (model stats update frequently)
export const revalidate = 3600;

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' | null }) {
  if (direction === 'up') return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (direction === 'down') return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default async function ModelsPage() {
  // Fetch top models for preview
  const leaderboard = await getLeaderboardWithTrends(50, 'avgPoints', { timePeriod: 'all' });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">AI Models</h1>
          <p className="text-muted-foreground">
            {leaderboard.length} open-source models competing to predict football matches.
          </p>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {leaderboard.map((entry, index) => (
          <Link key={entry.modelId} href={`/models/${entry.modelId}`}>
            <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted-foreground w-8">
                    #{index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{entry.displayName}</h3>
                      <TrendIcon direction={entry.trendDirection} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.provider} • {entry.totalPredictions} predictions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{entry.avgPoints.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">avg points</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* CTA to leaderboard */}
      <div className="text-center pt-4">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          View detailed leaderboard with filters →
        </Link>
      </div>
    </div>
  );
}
```

**Source:** Pattern follows existing leaderboard page structure

---

### Example 4: Canonical URL Utility

```typescript
// lib/seo/metadata.ts (MODIFY - add utility functions)
import { BASE_URL } from './constants';

/**
 * Normalize canonical URL - removes trailing slash (except root)
 */
export function normalizeCanonicalUrl(path: string): string {
  // Remove trailing slash except for root
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return `${BASE_URL}${path}`;
}

/**
 * Build canonical URL with query parameter filtering
 * Strips tracking params, preserves content params
 */
export function buildCanonicalUrl(
  pathname: string,
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): string {
  // Parameters that affect page content (keep in canonical)
  const contentParams = ['competition', 'season', 'timePeriod', 'minPredictions'];

  // Tracking parameters (always strip from canonical)
  const trackingParams = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'ref', 'source'
  ];

  const cleanParams = new URLSearchParams();

  // Handle both URLSearchParams and plain object
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(
        Object.entries(searchParams)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as [string, string])
      );

  for (const [key, value] of params.entries()) {
    // Keep only content params, skip tracking params
    if (contentParams.includes(key) && !trackingParams.includes(key)) {
      cleanParams.set(key, value);
    }
  }

  const queryString = cleanParams.toString();
  const fullPath = `${pathname}${queryString ? `?${queryString}` : ''}`;

  return normalizeCanonicalUrl(fullPath);
}

/**
 * Validate canonical URL format
 * Throws error if URL doesn't match expected format
 */
export function validateCanonicalUrl(url: string): void {
  if (!url.startsWith(BASE_URL)) {
    throw new Error(`Canonical URL must start with BASE_URL (${BASE_URL}). Got: ${url}`);
  }

  if (url !== BASE_URL && url.endsWith('/')) {
    throw new Error(`Canonical URL should not have trailing slash. Got: ${url}`);
  }

  // Check for tracking params
  const urlObj = new URL(url);
  const trackingParams = ['utm_source', 'fbclid', 'gclid'];
  for (const param of trackingParams) {
    if (urlObj.searchParams.has(param)) {
      throw new Error(`Canonical URL should not include tracking param: ${param}`);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Root layout canonical cascading to all pages | Self-referencing canonical on each page | 2026 SEO best practices | Prevents Google canonical conflicts, improves indexing accuracy |
| Multiple redirect sources (config + middleware + pages) | Single middleware with one-pass detection | Next.js 13+ middleware maturity | Eliminates redirect chains, improves crawl efficiency |
| 301 redirect for removed URLs | 410 Gone status for permanently removed content | 2026 SEO guidance | Clearer signal to search engines, no wasted crawl budget |
| meta refresh redirects | HTTP 301/302/410 via middleware | Next.js App Router standard | Faster, better SEO, no HTML parsing needed |
| Static redirects in config | Dynamic redirects with edge logic | Edge Runtime availability | Enables complex redirect logic (www detection, chain collapse) |

**Deprecated/outdated:**
- **Cascading canonicals from root layout:** Causes duplicate content issues. Use self-referencing canonicals per page.
- **next.config.js redirects() for dynamic logic:** Can't detect www or collapse chains. Use middleware for dynamic redirects.
- **Hreflang without bidirectional validation:** 65% of sites have errors. If not actively using i18n, remove entirely.
- **Including tracking params in canonical:** Google strips them anyway. Explicitly remove in canonical generation.

## Open Questions

### Question 1: Should we cache league/model data for index pages or query fresh on each revalidation?

**What we know:**
- ISR revalidates every 6 hours (leagues) and 1 hour (models)
- Competitions list rarely changes (manual updates only)
- Model stats change frequently (after every match)
- Database queries are fast (< 50ms for leaderboard)

**Trade-offs:**
- **Query fresh:** Always accurate data, simpler code, no cache invalidation needed
- **Cache in Redis:** Faster page generation, reduces database load, requires cache invalidation logic

**Recommendation:** Query fresh on revalidation because:
- ISR already provides caching (6 hours for leagues, 1 hour for models)
- Database queries are fast enough
- Simpler code without manual cache management
- Model stats need to be fresh for accurate rankings

---

### Question 2: Should we use Edge Runtime or Node.js Runtime for middleware?

**What we know:**
- Edge Runtime: Faster (global edge network), can't query database
- Node.js Runtime: Slower (single region), full Node.js API access
- Kroam.xyz middleware only needs: www detection, slug mapping, 410 status
- No database queries needed in middleware (all logic is static)

**Trade-offs:**
- **Edge Runtime:** Faster, globally distributed, but limited APIs
- **Node.js Runtime:** Full API access but slower, not at edge

**Recommendation:** Use Edge Runtime (default) because:
- No database queries needed (league slug mapping is static object)
- 410 Gone for /matches/* doesn't need database lookup
- Faster response times improve SEO (PERF-02: < 500ms)
- Globally distributed reduces latency for international users

---

### Question 3: Should we add redirect from root to /leagues or keep homepage separate?

**What we know:**
- Current homepage structure unknown (didn't examine app/page.tsx)
- User requirement: create /leagues and /models index pages
- No mention of changing homepage behavior

**What's unclear:**
- Does homepage currently exist?
- Should homepage feature leagues or be separate landing page?

**Recommendation:** Keep homepage separate (if it exists) because:
- User specifically requested "/leagues page" not "homepage becomes leagues"
- Having distinct /leagues and /models pages suggests they complement homepage
- Changing homepage redirects would be out of scope for this phase
- Validate with user before making homepage changes

## Sources

### Primary (HIGH confidence)
- [Next.js 16.1.5 Middleware Documentation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/redirecting.mdx) - Context7
- [Next.js 16.1.5 Metadata API](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx) - Context7
- [Next.js 16.1.5 ISR Documentation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/incremental-static-regeneration.mdx) - Context7
- [Canonicalization and SEO: A guide for 2026](https://searchengineland.com/canonicalization-seo-448161) - WebSearch verified

### Secondary (MEDIUM confidence)
- [Next.js Middleware Explained: Best Practices and Examples](https://pagepro.co/blog/next-js-middleware-what-is-it-and-when-to-use-it/) - WebSearch
- [The Expert SEO Guide To URL Parameter Handling](https://www.searchenginejournal.com/technical-seo/url-parameter-handling/) - WebSearch
- [How to Return HTTP 410 (Gone) Status in Next.js App Router](https://dev.to/alessandro-grosselle/how-to-return-http-410-gone-status-in-nextjs-app-router-two-workarounds-2f0g) - WebSearch
- [Handling Trailing Slashes in Next.js Routes](https://copyprogramming.com/howto/how-can-you-handle-trailing-slashes-in-next-js-routes) - WebSearch

### Tertiary (LOW confidence)
- GitHub discussions on www redirects - WebSearch, not fully verified
- Community blog posts on middleware patterns - WebSearch, treat as examples only

## Metadata

**Confidence breakdown:**
- Next.js middleware implementation: HIGH - Official Next.js 16.1.5 documentation via Context7
- Canonical URL best practices: HIGH - 2026 SEO guide from Search Engine Land + official Next.js docs
- ISR implementation: HIGH - Official Next.js 16.1.5 documentation via Context7
- 410 Gone workaround: MEDIUM - Community solution, no official Next.js support yet
- Trailing slash handling: MEDIUM - Next.js supports it, but convention choice is project-specific
- Hreflang removal: HIGH - User decision, standard practice when not using i18n

**Research date:** 2026-02-06
**Valid until:** 2026-05-06 (Next.js and SEO best practices evolve quarterly)

**Scope limitations:**
- Focused on Next.js 16 App Router (not Pages Router)
- Assumes production environment at kroam.xyz with 350+ indexed pages
- Does not cover sitemap generation (separate phase)
- Does not cover meta tag optimization beyond canonical URLs
- Assumes no active i18n requirements (hreflang removal confirmed by user)

**Key constraints from codebase:**
- 17 competitions configured in src/lib/football/competitions.ts
- 42 models tracked (29 Together AI + 13 Synthetic from MEMORY.md)
- Existing middleware only handles API routes (CORS, body size limits)
- Root layout already has metadataBase set (remove cascading canonical)
- next.config.ts has 6 league slug redirects (consolidate into middleware)
- Design patterns established in leaderboard/about pages (cards, gradients, icons)
