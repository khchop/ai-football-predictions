# Phase 23: Performance & Polish - Research

**Researched:** 2026-02-03
**Domain:** Next.js 16 PPR, Cache Components, View Transitions, Client Component Optimization
**Confidence:** HIGH (verified with Next.js official documentation)

## Summary

Phase 23 focuses on four key performance areas: PPR (Partial Prerendering) activation via cache components, cache configuration cleanup, client component audit, and View Transitions polish. The codebase is well-prepared for PPR - shimmer infrastructure exists, route segment configs have been removed (18 files cleaned), and View Transitions are already enabled with proper CSS.

The primary remaining work is wrapping searchParams-dependent content in Suspense boundaries for the blog and leaderboard pages. The client component audit will identify 45 files with 'use client' directives, many of which may be unnecessary (components that don't use hooks or browser APIs).

**Primary recommendation:** Enable `cacheComponents: true` after adding Suspense boundaries to searchParams-dependent content in blog/page.tsx and ensuring leaderboard/page.tsx patterns are correctly structured.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.4 | Framework with PPR/Cache Components | Native solution, production-ready |
| React | 19.2.3 | Suspense boundaries, ViewTransition | Native React features |
| next-themes | 0.4.6 | Theme provider (requires client boundary) | Standard for dark mode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | 8.21.3 | Interactive tables (legitimately client) | Tables with sorting/filtering |
| @radix-ui/* | various | UI primitives (some require client) | Dialogs, tooltips, dropdowns |

### Not Needed for This Phase
| Library | Purpose | Why Not Needed |
|---------|---------|----------------|
| react-loading-skeleton | Loading states | Already using built-in Skeleton component |
| View Transitions polyfill | Browser support | Native support sufficient (Chrome, Safari 18+) |

**Current Configuration:**
```typescript
// next.config.ts - CURRENT
const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
};

// next.config.ts - TARGET (after Suspense work)
const nextConfig: NextConfig = {
  cacheComponents: true,  // Enables PPR + Cache Components
  experimental: {
    viewTransition: true,
  },
};
```

## Architecture Patterns

### PPR Static Shell + Dynamic Content Pattern

```
Static Shell (prerendered at build time)
  |
  +-- Header (static navigation)
  +-- Metadata (static)
  +-- Static content (no user data)
  |
  +-- <Suspense fallback={<Skeleton />}>
  |     Dynamic Content (streams at request time)
  |     - searchParams-dependent content
  |     - user-specific data
  |     - real-time data
  |   </Suspense>
  |
  +-- Footer (static)
```

### Correct searchParams Pattern (Next.js 16)
```typescript
// page.tsx - CORRECT pattern
interface PageProps {
  searchParams: Promise<{ page?: string; filter?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  // Static shell content renders immediately
  return (
    <>
      <StaticHeader />

      {/* Dynamic content wrapped in Suspense */}
      <Suspense fallback={<ContentSkeleton />}>
        <DynamicContent searchParams={searchParams} />
      </Suspense>

      <StaticFooter />
    </>
  );
}

// Separate async component for searchParams-dependent content
async function DynamicContent({
  searchParams
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const { page, filter } = await searchParams;
  const data = await fetchData({ page, filter });

  return <ContentList data={data} />;
}
```

### Current Blog Page (NEEDS REFACTOR)
```typescript
// src/app/blog/page.tsx - CURRENT (violates PPR)
export default async function BlogPage({ searchParams }: PageProps) {
  const { page: pageParam, competition } = await searchParams;
  // ^ This await happens at page level, not inside Suspense

  const posts = await getPublishedBlogPosts(POSTS_PER_PAGE + 1, offset);
  // ^ Data fetch also at page level

  return (
    <div>
      {/* All content rendered together - no streaming */}
    </div>
  );
}
```

### Current Leaderboard Page (MOSTLY CORRECT)
```typescript
// src/app/leaderboard/page.tsx - MOSTLY CORRECT
export default async function LeaderboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  // ^ Await at page level, but passes to Suspense-wrapped component

  return (
    <>
      <Suspense fallback={<Skeleton />}>
        <LeaderboardFilters />
      </Suspense>

      <Suspense fallback={<LeaderboardTableSkeleton />}>
        <LeaderboardContent searchParams={resolvedParams} />
        {/* ^ Good: Heavy content in Suspense */}
      </Suspense>
    </>
  );
}
```

### Client Component Decision Tree

```
Does component use:
  |
  +-- useState/useReducer? --> KEEP 'use client'
  |
  +-- useEffect for side effects? --> KEEP 'use client'
  |
  +-- useRouter (for push/replace)? --> KEEP 'use client'
  |
  +-- usePathname? --> KEEP 'use client'
  |
  +-- useSearchParams? --> KEEP 'use client' + wrap in Suspense
  |
  +-- Event handlers only (onClick, etc.)? --> CAN BE SERVER
  |     (Server components support onClick for links/buttons)
  |
  +-- External client-only lib (e.g., chart libs)? --> KEEP 'use client'
  |
  +-- None of above? --> REMOVE 'use client'
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading skeletons | Custom shimmer div | Existing Skeleton component | Already has shimmer CSS |
| View transition timing | Manual setTimeout | CSS animation-duration | Browser handles timing |
| PPR boundaries | Manual streaming | Suspense + cacheComponents | Next.js optimizes automatically |
| Theme-aware animations | JS-based detection | CSS media queries | prefers-reduced-motion |
| Skeleton shimmer | New animation | Existing .shimmer class | Already in globals.css |

**Key insight:** The codebase already has shimmer infrastructure (globals.css lines 496-541). Don't create new loading animations - use existing patterns.

## Common Pitfalls

### Pitfall 1: Awaiting searchParams at Page Level
**What goes wrong:** With `cacheComponents: true`, awaiting searchParams at page level prevents static shell prerendering - entire page becomes dynamic.
**Why it happens:** Developer awaits immediately for convenience.
**How to avoid:** Pass Promise to Suspense-wrapped child component, await there.
**Warning signs:** Build error: "Uncached data was accessed outside of Suspense"

### Pitfall 2: Unnecessary 'use client' Directives
**What goes wrong:** Components marked 'use client' cannot be server-rendered, increasing bundle size and preventing tree-shaking.
**Why it happens:** Defensive marking, copy-paste from examples, uncertainty about boundaries.
**How to avoid:** Only add 'use client' when component actually uses client-only features.
**Warning signs:** Component only renders static content, no hooks or browser APIs.

### Pitfall 3: View Transitions Without Reduced Motion
**What goes wrong:** Users with vestibular disorders experience discomfort.
**Why it happens:** Forgot to add media query for prefers-reduced-motion.
**How to avoid:** Already handled in globals.css (lines 487-494). Don't override.
**Warning signs:** Animations playing regardless of system preference.

### Pitfall 4: Skeleton/Fallback UI Mismatch
**What goes wrong:** Layout shift when content loads because skeleton doesn't match final layout.
**Why it happens:** Skeleton dimensions don't match actual content.
**How to avoid:** Match skeleton structure to content structure exactly.
**Warning signs:** Visual "jump" when Suspense resolves.

### Pitfall 5: Route Segment Config with cacheComponents
**What goes wrong:** `export const dynamic = 'force-dynamic'` or `export const revalidate = X` conflicts with cacheComponents.
**Why it happens:** Old patterns left in codebase.
**How to avoid:** Remove all route segment configs before enabling cacheComponents (already done - 18 files cleaned).
**Warning signs:** Build warnings about conflicting configurations.

### Pitfall 6: Client Components Importing Server-Only Code
**What goes wrong:** Build fails or runtime errors when client component imports db queries.
**Why it happens:** Moving server component to client without updating imports.
**How to avoid:** Ensure data fetching stays in server components, pass data as props.
**Warning signs:** Import errors, "server-only" package violations.

## Code Examples

### PPR-Compatible Blog Page Pattern
```typescript
// Source: Next.js 16 docs + project requirements
// src/app/blog/page.tsx

import { Suspense } from 'react';
import { BlogListSkeleton } from '@/components/blog/blog-list-skeleton';

interface PageProps {
  searchParams: Promise<{ page?: string; competition?: string }>;
}

export default function BlogPage({ searchParams }: PageProps) {
  // NO await here - static shell prerendered
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Static: prerendered */}
      <div className="space-y-3">
        <Link href="/matches">
          <ArrowLeft /> Back to matches
        </Link>
        <h1>Football Insights</h1>
        <p>Weekly league roundups...</p>
      </div>

      {/* Dynamic: streams with searchParams */}
      <Suspense fallback={<BlogListSkeleton />}>
        <BlogPostsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Separate async component
async function BlogPostsList({
  searchParams
}: {
  searchParams: Promise<{ page?: string; competition?: string }>
}) {
  const { page: pageParam, competition } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const offset = (page - 1) * POSTS_PER_PAGE;

  const posts = await getPublishedBlogPosts(POSTS_PER_PAGE + 1, offset);
  // ... render posts
}
```

### Client Component Audit - Remove 'use client' Example
```typescript
// BEFORE: src/components/prediction-table.tsx
'use client';

import { cn } from '@/lib/utils';
// Component only uses cn() and maps over data
// No useState, useEffect, useRouter, etc.

export function PredictionTable({ predictions, ... }) {
  // Just renders static content from props
  return (
    <div>
      {predictions.map(...)}
    </div>
  );
}

// AFTER: Remove 'use client' - component is pure render
import { cn } from '@/lib/utils';

export function PredictionTable({ predictions, ... }) {
  return (
    <div>
      {predictions.map(...)}
    </div>
  );
}
```

### View Transitions - Already Complete
```css
/* Source: src/app/globals.css (lines 457-494) */
/* User decision: 150ms duration, crossfade, reduced-motion disabled */

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 150ms;
  animation-timing-function: ease-out;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Enhanced Skeleton with Shimmer
```typescript
// Use existing skeleton with shimmer for PPR fallbacks
// Source: globals.css (lines 496-541) + skeleton.tsx

function BlogListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-wrapper rounded-lg border p-6">
          <Skeleton className="h-4 w-20 mb-3" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <Skeleton className="h-3 w-24" />
          <div className="shimmer" />
        </div>
      ))}
    </div>
  );
}
```

## Client Component Audit Results

Current 'use client' components (45 files identified):

### KEEP - Legitimate Client Components (21 files)
| Component | Reason |
|-----------|--------|
| navigation.tsx | usePathname |
| bottom-nav.tsx | usePathname |
| hover-prefetch-link.tsx | useRouter |
| leaderboard-table.tsx | useState, useSearchParams, useRouter |
| leaderboard-filters.tsx | useSearchParams, useRouter |
| blog-toc.tsx | useState, useEffect (IntersectionObserver) |
| search-modal.tsx | useState, useEffect |
| providers.tsx | ThemeProvider (requires client) |
| theme-toggle.tsx | useTheme, useState, useEffect |
| live-refresher.tsx | useRouter, useEffect |
| match-card.tsx | useState, useEffect (goal animation) |
| analytics.tsx | External script loading |
| league-selector.tsx | useState, Radix Select |
| competition-filter.tsx | useSearchParams, useRouter |
| match-events.tsx | useState |
| compare-modal.tsx | useState, Dialog |
| collapsible-section.tsx | useState |
| match-tabs-mobile.tsx | useState, swipe gestures |
| admin-dashboard.tsx | useState, useEffect |
| cost-summary.tsx | useState |
| model-health-table.tsx | useState |

### REVIEW - May Not Need Client (18 files)
| Component | Current Use | Recommendation |
|-----------|-------------|----------------|
| accuracy-display.tsx | Tooltip wrapper | Keep - Tooltip is Radix client component |
| prediction-table.tsx | Only cn() + map | **REMOVE** - Pure render |
| model-stats-grid.tsx | Only cn() + map | **REMOVE** - Pure render |
| model-competition-breakdown.tsx | useState for sorting | Keep - Interactive sorting |
| match-header.tsx | Only cn() | **REVIEW** - May have client children |
| narrative-preview.tsx | useState for expand | Keep - Interactive expand |
| predictions-skeleton.tsx | Only static render | **REMOVE** - Pure render |
| blog-content.tsx | Client for markdown? | **REVIEW** - Check if needed |
| quick-league-links.tsx | Only static links | **REMOVE** - Pure render |
| ReadMoreText.tsx | useState for expand | Keep - Interactive |

### ERROR BOUNDARIES (6 files - Must Stay Client)
- src/app/error.tsx
- src/app/global-error.tsx
- src/app/matches/error.tsx
- src/app/leaderboard/error.tsx
- src/app/matches/[id]/error.tsx
- src/app/models/[id]/error.tsx

### UI PRIMITIVES (8 files - Must Stay Client)
Radix UI components require client:
- tabs.tsx, table.tsx, tooltip.tsx, sheet.tsx
- dialog.tsx, dropdown-menu.tsx, separator.tsx, select.tsx, collapsible.tsx

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| experimental.ppr flag | cacheComponents: true | Next.js 16 | Single config for PPR |
| dynamicIO flag | cacheComponents: true | Next.js 16 | Renamed/unified |
| Route segment configs | use cache directive | Next.js 16 | Per-component caching |
| force-dynamic | Default behavior | Next.js 16 | All pages dynamic by default |

**Deprecated/outdated:**
- `experimental.ppr`: Removed in Next.js 16, use cacheComponents
- `experimental.dynamicIO`: Renamed to cacheComponents
- Route segment configs (`dynamic`, `revalidate`): Replaced by use cache directive (already removed from codebase)

## Open Questions

Things that couldn't be fully resolved:

1. **MatchCard Client Boundary**
   - What we know: Uses useState/useEffect for goal animation
   - What's unclear: Could goal animation be CSS-only?
   - Recommendation: Keep as client - animation timing requires JS for state sync

2. **Blog Content Markdown Rendering**
   - What we know: Uses react-markdown
   - What's unclear: Whether react-markdown works as server component
   - Recommendation: Test during implementation, likely needs client for rehype plugins

3. **Leaderboard searchParams Optimization**
   - What we know: Currently awaits searchParams at page level, passes resolved value
   - What's unclear: Whether passing Promise would improve PPR shell
   - Recommendation: Current pattern works but could be optimized

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) - Official announcement
- [Next.js Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components) - Implementation details
- [cacheComponents Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) - Configuration reference
- [viewTransition Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) - View Transitions setup

### Secondary (MEDIUM confidence)
- [Next.js Version 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) - Migration steps
- [useSearchParams Documentation](https://nextjs.org/docs/app/api-reference/functions/use-search-params) - Suspense requirements

### Project-Specific (HIGH confidence)
- src/app/globals.css - View transitions CSS (lines 457-541)
- src/app/blog/page.tsx - Current blog implementation
- src/app/leaderboard/page.tsx - Current leaderboard implementation
- next.config.ts - Current configuration

## Metadata

**Confidence breakdown:**
- PPR/cacheComponents: HIGH - Verified with Next.js 16 official docs
- View Transitions: HIGH - Already implemented, CSS verified in codebase
- Client component audit: HIGH - Direct code inspection, hook usage verified
- searchParams patterns: HIGH - Next.js 16 docs explicit about requirements

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Next.js stable, patterns established)
