# Phase 9: Critical SEO Errors - Research

**Researched:** 2026-02-02
**Domain:** Next.js routing, database slug system, SEO
**Confidence:** HIGH

## Summary

The SEO errors stem from a **slug system mismatch** between three layers:

1. **Static config** (`src/lib/football/competitions.ts`): Uses short IDs like `epl`, `ucl`, `seriea`
2. **Database** (`competitions.slug` column): Uses long-form slugs like `premier-league`, `champions-league`
3. **App routing** (`/leagues/[slug]/page.tsx`): Looks up by static config ID, not database slug

This mismatch causes:
- Sitemap generates `/leagues/premier-league` (from DB slug) but the route only accepts `/leagues/epl`
- Internal links built from `competition.slug` point to non-existent pages
- Redirects from `/matches/[id]` send users to broken URLs

**Primary recommendation:** Make the league page route accept BOTH short IDs (epl) AND long-form slugs (premier-league) by adding a slug alias lookup.

## Root Cause Analysis

### The Slug Data Flow

```
1. Fixtures Worker runs
   ↓
2. generateCompetitionSlug("UEFA Champions League") → "champions-league"
   ↓
3. upsertCompetition({ id: "ucl", slug: "champions-league", ... })
   ↓
4. Database stores:
   - competitions.id = "ucl"
   - competitions.slug = "champions-league"
   ↓
5. Sitemap reads competitions.slug → outputs /leagues/champions-league
   ↓
6. League page receives "champions-league", calls getCompetitionById("champions-league")
   ↓
7. getCompetitionById searches COMPETITIONS array for id: "champions-league"
   ↓
8. NOT FOUND → 404
```

### Key Files and Their Roles

| File | Role | Issue |
|------|------|-------|
| `src/lib/football/competitions.ts` | Static competition config with short IDs | Source of truth for `getCompetitionById()` |
| `src/lib/utils/slugify.ts` | Generates long-form slugs | `generateCompetitionSlug()` removes UEFA/FIFA prefixes |
| `src/lib/queue/workers/fixtures.worker.ts` | Populates DB competitions | Stores long-form slug in `competitions.slug` |
| `src/app/sitemap/leagues.xml/route.ts` | Generates league sitemap | Uses `competitions.slug` from DB (long-form) |
| `src/app/sitemap/matches/[id]/route.ts` | Generates match sitemap | Uses `competitions.slug` from DB (long-form) |
| `src/app/leagues/[slug]/page.tsx` | League page route | Calls `getCompetitionById(slug)` which only matches short IDs |
| `src/components/match-card.tsx` | Match card links | Uses `competition.slug` from DB for URLs |
| `src/app/matches/[id]/page.tsx` | Legacy match page | Redirects to broken `/leagues/{db-slug}/{match-slug}` |

### Current Slug Mapping

| Competition | Static ID | DB slug | Valid Route |
|-------------|-----------|---------|-------------|
| Champions League | `ucl` | `champions-league` | `/leagues/ucl` |
| Europa League | `uel` | `europa-league` | `/leagues/uel` |
| Premier League | `epl` | `premier-league` | `/leagues/epl` |
| La Liga | `laliga` | `la-liga` | `/leagues/laliga` |
| Bundesliga | `bundesliga` | `bundesliga` | `/leagues/bundesliga` |
| Serie A | `seriea` | `serie-a` | `/leagues/seriea` |
| Ligue 1 | `ligue1` | `ligue-1` | `/leagues/ligue1` |

## 500 Error Investigation

The 500 error on `/leagues/seriea/genoa-vs-bologna-2026-01-25` was reported in the Ahrefs audit but currently returns 404.

**Analysis:**
- The route exists at `src/app/leagues/[slug]/[match]/page.tsx`
- It calls `getMatchBySlug(slug, match)` which queries by `competitions.slug` AND `matches.slug`
- If the match doesn't exist in DB, it returns `notFound()` (404)
- The 500 may have been a transient database/connection error

**Verification needed:** Check if the match exists in the database with that slug combination.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug aliases | Custom redirect map | Add `aliases` field to competition config | Single source of truth |
| URL normalization | Manual string matching | Next.js middleware with redirects | Standard pattern |
| Sitemap generation | New sitemap logic | Fix DB query to use correct slugs | Already have infrastructure |

## Solution Architecture

### Option 1: Slug Alias System (Recommended)

Add `aliases` array to `CompetitionConfig`:

```typescript
// src/lib/football/competitions.ts
export interface CompetitionConfig {
  id: string;
  name: string;
  apiFootballId: number;
  season: number;
  category: 'club-europe' | 'club-domestic' | 'international';
  aliases?: string[]; // NEW: alternative slugs that resolve to this competition
  // ...
}

export const COMPETITIONS: CompetitionConfig[] = [
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    aliases: ['champions-league'],
    // ...
  },
  {
    id: 'epl',
    name: 'Premier League',
    aliases: ['premier-league'],
    // ...
  },
  // ...
];

// Add new lookup function
export function getCompetitionByIdOrAlias(slug: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c =>
    c.id === slug ||
    c.aliases?.includes(slug)
  );
}
```

**Pros:**
- Single source of truth
- Works without DB migration
- Preserves existing short URLs
- SEO-friendly (both URLs work)

**Cons:**
- Manual mapping required

### Option 2: Redirect Long-Form to Short-Form

Add redirects in `next.config.ts`:

```typescript
async redirects() {
  return [
    { source: '/leagues/premier-league/:path*', destination: '/leagues/epl/:path*', permanent: true },
    { source: '/leagues/champions-league/:path*', destination: '/leagues/ucl/:path*', permanent: true },
    // ...
  ];
}
```

**Pros:**
- Quick fix
- Explicit redirect signals to search engines

**Cons:**
- Redirect chains affect page speed
- Must maintain separate redirect config
- Duplicates slug knowledge

### Option 3: Update DB Slugs to Match Static IDs

Migration to change `competitions.slug` to match `competitions.id`:

```sql
UPDATE competitions SET slug = id;
```

**Pros:**
- Single slug system
- No lookup changes needed

**Cons:**
- Requires redirect for existing indexed URLs
- Must update sitemap immediately
- Risk of data inconsistency during migration

### Recommended Approach: Option 1 + Option 2

1. Add alias system (Option 1) for immediate fix
2. Add redirects (Option 2) for legacy URL support
3. Update sitemap to use canonical short slugs
4. Update internal link generation to use canonical slugs

## Code Examples

### Adding Alias Lookup

```typescript
// src/lib/football/competitions.ts

export function getCompetitionByIdOrAlias(slug: string): CompetitionConfig | undefined {
  // First try exact ID match
  const byId = COMPETITIONS.find(c => c.id === slug);
  if (byId) return byId;

  // Then try alias match
  return COMPETITIONS.find(c => c.aliases?.includes(slug));
}
```

### Updating League Page Route

```typescript
// src/app/leagues/[slug]/page.tsx

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;

  // Try both ID and alias
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) {
    notFound();
  }

  // Canonical redirect: if accessed via alias, redirect to canonical ID
  if (slug !== competition.id) {
    redirect(`/leagues/${competition.id}`, 301);
  }

  // ... rest of page
}
```

### Fixing Internal Links in MatchCard

```typescript
// src/components/match-card.tsx

// Change from:
const matchUrl = match.slug && match.competition.slug
  ? `/leagues/${match.competition.slug}/${match.slug}`
  : `/matches/${match.id}`;

// To:
const matchUrl = match.slug && match.competition.id
  ? `/leagues/${match.competition.id}/${match.slug}`  // Use ID, not DB slug
  : `/matches/${match.id}`;
```

### Updating Sitemap Generation

```typescript
// src/app/sitemap/leagues.xml/route.ts

import { COMPETITIONS } from '@/lib/football/competitions';

export async function GET(): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  // Use static config IDs, not DB slugs
  const urls = COMPETITIONS
    .filter(comp => comp.category !== 'international') // Optional: exclude some
    .map(comp => ({
      url: `${BASE_URL}/leagues/${comp.id}`,
      lastmod: today,
      changefreq: 'hourly',
      priority: 0.9,
    }));

  // ... generate XML
}
```

## Common Pitfalls

### Pitfall 1: Inconsistent Slug Sources

**What goes wrong:** Different parts of the app use different slug sources (static config vs DB)
**Why it happens:** Historical evolution - DB slug was added later for SEO
**How to avoid:** Standardize on static config IDs as canonical, DB slug as alias only
**Warning signs:** URLs that sometimes work and sometimes don't

### Pitfall 2: Redirect Chains

**What goes wrong:** Long-form redirects to short-form, which may redirect elsewhere
**Why it happens:** Multiple redirect layers added over time
**How to avoid:** Single redirect from alias to canonical
**Warning signs:** More than one 301 in sequence

### Pitfall 3: Sitemap/Route Mismatch

**What goes wrong:** Sitemap lists URLs that return 404
**Why it happens:** Sitemap reads from DB, routes use static config
**How to avoid:** Generate sitemap from same source as routes
**Warning signs:** Ahrefs/Search Console showing 404s for indexed pages

## Files to Modify

### Primary Changes

| File | Change | Complexity |
|------|--------|------------|
| `src/lib/football/competitions.ts` | Add `aliases` field, `getCompetitionByIdOrAlias()` | Low |
| `src/app/leagues/[slug]/page.tsx` | Use new lookup, add canonical redirect | Low |
| `src/app/leagues/[slug]/[match]/page.tsx` | Use new lookup for competition resolution | Low |
| `src/components/match-card.tsx` | Use `competition.id` instead of `competition.slug` | Low |
| `src/app/sitemap/leagues.xml/route.ts` | Generate from static config | Low |
| `src/app/sitemap/matches/[id]/route.ts` | Use competition ID from DB instead of slug | Low |

### Secondary Changes

| File | Change | Complexity |
|------|--------|------------|
| `src/app/matches/[id]/page.tsx` | Fix redirect URL to use competition.id | Low |
| `src/lib/seo/schema/breadcrumb.ts` | Ensure canonical URLs in structured data | Low |
| `src/app/leagues/[slug]/league-hub-content.tsx` | Pass competition.id to MatchCard | Low |

## Verification Checklist

After implementation:

- [ ] `/leagues/epl` returns 200
- [ ] `/leagues/premier-league` redirects to `/leagues/epl` (301)
- [ ] `/leagues/ucl` returns 200
- [ ] `/leagues/champions-league` redirects to `/leagues/ucl` (301)
- [ ] Sitemap at `/sitemap/leagues.xml` lists canonical URLs only
- [ ] Match card links use `/leagues/{id}/{slug}` format
- [ ] No redirect chains (single hop maximum)
- [ ] `getMatchBySlug()` can find matches using competition ID

## Open Questions

1. **500 Error Investigation**
   - What we know: Ahrefs reported 500 on Genoa vs Bologna page, now returns 404
   - What's unclear: Whether this is a data issue or was transient
   - Recommendation: Check database for match existence, add error logging

2. **DB Slug Column Future**
   - What we know: DB has redundant `competitions.slug` column
   - What's unclear: Whether to deprecate or repurpose
   - Recommendation: Keep for now, document as "alias storage"

## Sources

### Primary (HIGH confidence)
- Codebase investigation: All files listed in "Files to Modify" section
- Direct code tracing from route to database query

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Root cause analysis | HIGH | Direct code tracing verified |
| Solution architecture | HIGH | Standard Next.js patterns |
| File changes needed | HIGH | Full codebase review completed |
| 500 error cause | LOW | Could not reproduce, may be transient |

## Metadata

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable codebase patterns)
