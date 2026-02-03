# Phase 22: Navigation & Internal Linking - Research

**Researched:** 2026-02-03
**Domain:** Mobile navigation, breadcrumbs, content widgets, entity linking, prefetching
**Confidence:** HIGH

## Summary

Phase 22 implements comprehensive navigation and internal linking across the platform. The five requirements (NAVL-01 through NAVL-05) break into distinct domains: mobile navigation (bottom bar), visual breadcrumbs, related content widgets, automated entity linking in content, and prefetch optimization.

The standard approach for 2026 is mobile-first bottom navigation with 3-5 items in the thumb zone, visual breadcrumbs using semantic HTML (`nav` > `ol` > `li` > `a`) with proper ARIA attributes, server-rendered related content widgets (already partially implemented), simple string-matching entity linking using existing entity dictionaries (teams, competitions, models), and hover/touch-triggered prefetching to reduce unnecessary data transfer.

Key finding: Next.js 16 now has built-in `onTouchStart` prefetch handling (merged in PR #38805), making the HoverPrefetchLink pattern effective for both desktop hover and mobile touch. The existing RelatedMatchesWidget, RelatedModelsWidget, and RelatedArticles components from Phase 12/19 provide a foundation - Phase 22 extends this with systematic deployment across all page types.

**Primary recommendation:** Build a native entity linking system using the existing COMPETITIONS array, team names from database, and model display names - no external NLP library needed for structured sports data. Implement HoverPrefetchLink wrapper component for all navigation and internal links to optimize prefetch behavior.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Link | 16.x | Client navigation with prefetch | Built-in, optimized prefetching, App Router integration |
| lucide-react | 0.562+ | Navigation icons | Already installed, tree-shakeable, 1000+ icons |
| React 19 | 19.x | Server Components for widgets | Zero-JS bundle for SEO-critical links |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| schema-dts | 1.1.5 | BreadcrumbList schema | Already installed, type-safe JSON-LD |
| date-fns | existing | Date formatting in widgets | Already used throughout codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom entity linking | compromise.js (NLP) | NLP overkill for structured sports data - simple string matching faster and sufficient |
| Custom prefetch logic | ForesightJS | ForesightJS adds ML-based predictive preloading - complexity not justified for current scale |
| Icon library | Heroicons | lucide-react already installed, comprehensive coverage |

**Installation:**
```bash
# No new packages required - all dependencies already in project
```

## Architecture Patterns

### Recommended Component Structure
```
src/components/
├── navigation/
│   ├── bottom-nav.tsx           # NEW: Mobile bottom navigation bar (client)
│   ├── breadcrumbs.tsx          # NEW: Visual breadcrumb trail (server)
│   └── hover-prefetch-link.tsx  # NEW: Optimized Link wrapper (client)
├── match/
│   ├── related-matches-widget.tsx  # EXISTS: From Phase 12
│   └── entity-linked-content.tsx   # NEW: Content with auto-links (server)
├── model/
│   └── related-models-widget.tsx   # EXISTS: From Phase 12
├── blog/
│   └── related-articles.tsx        # EXISTS: From Phase 19
└── widgets/
    └── related-content-section.tsx # NEW: Unified related content (server)
```

### Pattern 1: Bottom Navigation Bar
**What:** Fixed mobile navigation with 4-5 primary actions positioned in thumb zone (bottom of screen).
**When to use:** Mobile viewports (< 768px), primary site navigation.
**Why 4-5 items:** Research shows 49% of users navigate with thumb only; more than 5 items creates cramped tap targets below 44px minimum.

```typescript
// Source: Mobile Navigation UX Best Practices 2026
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Trophy, FileText, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/matches', label: 'Matches', icon: Calendar },
  { href: '/leaderboard', label: 'Leaders', icon: Trophy },
  { href: '/blog', label: 'Blog', icon: FileText },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md safe-area-pb"
      aria-label="Primary mobile navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px]',
                'text-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Critical CSS for safe area:**
```css
/* In globals.css */
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

### Pattern 2: Accessible Visual Breadcrumbs
**What:** Visual breadcrumb trail with proper HTML semantics and ARIA attributes.
**When to use:** All pages with navigation depth > 1.
**HTML structure:** `nav[aria-label="Breadcrumbs"] > ol > li > a`

```typescript
// Source: Aditus Accessible Breadcrumbs Guide
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumbs" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground truncate max-w-[200px]"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors truncate max-w-[150px]"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

### Pattern 3: HoverPrefetchLink (Intent-Based Prefetching)
**What:** Link component that prefetches only on hover/touch, not viewport entry.
**When to use:** Pages with many links (10+), reducing unnecessary prefetch requests.
**Why:** Next.js 16 default viewport prefetching can trigger 1MB+ of requests on scroll. This pattern limits to links user demonstrates intent to visit.

```typescript
// Source: Next.js Prefetching Guide (October 2025)
'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

type HoverPrefetchLinkProps = ComponentProps<typeof Link>;

export function HoverPrefetchLink({
  children,
  onMouseEnter,
  onTouchStart,
  ...props
}: HoverPrefetchLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);

  const handleInteraction = () => {
    if (!shouldPrefetch) {
      setShouldPrefetch(true);
    }
  };

  return (
    <Link
      {...props}
      prefetch={shouldPrefetch ? undefined : false}
      onMouseEnter={(e) => {
        handleInteraction();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        handleInteraction();
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
```

### Pattern 4: Entity Linking in Content
**What:** Server-side content processor that auto-links entity mentions (teams, competitions, models) in text.
**When to use:** Blog posts, match analysis content, AI-generated roundups.
**Approach:** Simple string matching with existing entity dictionaries - no NLP library needed.

```typescript
// Entity linking using existing data sources
import Link from 'next/link';
import { COMPETITIONS } from '@/lib/football/competitions';

interface Entity {
  name: string;
  aliases: string[];
  href: string;
}

// Build entity dictionary from existing data
function buildEntityDictionary(
  teams: string[],
  models: Array<{ id: string; displayName: string }>
): Entity[] {
  const entities: Entity[] = [];

  // Add competitions
  COMPETITIONS.forEach((comp) => {
    entities.push({
      name: comp.name,
      aliases: comp.aliases || [],
      href: `/leagues/${comp.id}`,
    });
  });

  // Add teams (from match data)
  teams.forEach((team) => {
    entities.push({
      name: team,
      aliases: [],
      href: `/leagues?team=${encodeURIComponent(team)}`, // Search param for team filter
    });
  });

  // Add models
  models.forEach((model) => {
    entities.push({
      name: model.displayName,
      aliases: [],
      href: `/models/${model.id}`,
    });
  });

  // Sort by name length descending (match longer names first)
  return entities.sort((a, b) => b.name.length - a.name.length);
}

// Link entities in text (returns React elements)
export function linkEntitiesInText(
  text: string,
  entities: Entity[],
  maxLinks: number = 5
): React.ReactNode[] {
  let linkedCount = 0;
  const linkedEntities = new Set<string>();
  const result: React.ReactNode[] = [];
  let remainingText = text;
  let lastIndex = 0;

  // Create regex for all entities
  const allNames = entities.flatMap(e => [e.name, ...e.aliases]);
  const pattern = new RegExp(
    `\\b(${allNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (linkedCount >= maxLinks) break;

    const matchedName = match[0];
    const entity = entities.find(
      e => e.name.toLowerCase() === matchedName.toLowerCase() ||
           e.aliases.some(a => a.toLowerCase() === matchedName.toLowerCase())
    );

    if (entity && !linkedEntities.has(entity.name.toLowerCase())) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      // Add linked entity
      result.push(
        <Link
          key={`${entity.name}-${match.index}`}
          href={entity.href}
          className="text-primary hover:underline"
        >
          {matchedName}
        </Link>
      );

      linkedEntities.add(entity.name.toLowerCase());
      linkedCount++;
      lastIndex = match.index + matchedName.length;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}
```

### Anti-Patterns to Avoid

- **Bottom nav on desktop:** Wastes valuable screen real estate, looks out of place. Use `md:hidden` to hide on tablet+.
- **Breadcrumbs without aria-current:** Screen readers don't know which is current page. Always add `aria-current="page"` to last item.
- **Viewport prefetching for all links:** Creates unnecessary network requests (1MB+ on scroll). Use HoverPrefetchLink for link-heavy pages.
- **NLP for structured data:** Using compromise.js or similar for team/competition names is overkill - simple string matching with known entities is faster and more accurate.
- **Client-side entity linking:** Processing text client-side adds JS bundle and delays render. Keep entity linking server-side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prefetch optimization | Custom Intersection Observer + router.prefetch | HoverPrefetchLink pattern | Next.js handles prefetch internals, just control when to enable |
| Entity recognition | ML/NLP entity extraction | Simple string matching with known entities | Sports data is structured - teams, competitions, models are finite known sets |
| Icon library | Custom SVG icon system | lucide-react | Already installed, comprehensive, tree-shakeable |
| Breadcrumb schema | Manual JSON-LD | buildBreadcrumbSchema (exists) | Already implemented in lib/seo/schema/breadcrumb.ts |
| Mobile safe area | Fixed padding values | env(safe-area-inset-bottom) | CSS environment variables handle device variations |

**Key insight:** The platform has structured data (COMPETITIONS array, teams from DB, models table) that makes entity linking a lookup problem, not an NLP problem. No external NLP library needed.

## Common Pitfalls

### Pitfall 1: Bottom Nav Covering Content
**What goes wrong:** Fixed bottom navigation covers page footer or interactive elements.
**Why it happens:** Content doesn't account for nav height (64px) plus safe area inset.
**How to avoid:** Add `pb-20 md:pb-0` to main content wrapper, or use CSS `scroll-padding-bottom`.
**Warning signs:** Footer links unclickable on mobile, content appears cut off.

### Pitfall 2: Breadcrumbs Without Visual Separators Being Read
**What goes wrong:** Screen reader announces "Home Premier League Arsenal vs Chelsea" without context.
**Why it happens:** CSS-only separators (::before/::after) are announced by screen readers.
**How to avoid:** Use actual separator element with `aria-hidden="true"`.
**Warning signs:** Accessibility audit flags "unclear navigation structure".

### Pitfall 3: Entity Linking Creating Duplicate Links
**What goes wrong:** "Barcelona vs Real Madrid in La Liga" links "Barcelona", "Real Madrid", AND "Barcelona" again in "Barcelona".
**Why it happens:** Regex matches overlapping substrings.
**How to avoid:** Sort entities by length (longest first), track linked positions, use word boundaries (`\b`).
**Warning signs:** Same text linked multiple times, broken HTML from overlapping tags.

### Pitfall 4: Over-Linking Content
**What goes wrong:** Every entity mention becomes a link, making text unreadable.
**Why it happens:** No limit on entity links per content block.
**How to avoid:** Limit to 5 links per content block, link only first occurrence of each entity.
**Warning signs:** Content looks like a Wikipedia disambiguation page, high bounce rate on content pages.

### Pitfall 5: Prefetch Storm on Page Load
**What goes wrong:** Page loads slowly due to dozens of prefetch requests.
**Why it happens:** Default viewport prefetching on pages with many links (match lists, leaderboards).
**How to avoid:** Use `prefetch={false}` as default for list views, enable on hover/touch via HoverPrefetchLink.
**Warning signs:** Network tab shows 20+ prefetch requests on load, LCP regression.

## Code Examples

### Bottom Navigation Integration in Layout
```typescript
// src/app/layout.tsx - Add BottomNav before closing body tag
import { BottomNav } from '@/components/navigation/bottom-nav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* ... existing layout ... */}
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
```

### Breadcrumbs with Schema (Combined)
```typescript
// src/components/navigation/breadcrumbs-with-schema.tsx
import { Breadcrumbs } from './breadcrumbs';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { BASE_URL } from '@/lib/seo/constants';

interface BreadcrumbsWithSchemaProps {
  items: Array<{ name: string; href: string }>;
}

export function BreadcrumbsWithSchema({ items }: BreadcrumbsWithSchemaProps) {
  // Convert relative hrefs to absolute URLs for schema
  const schemaItems = items.map((item) => ({
    name: item.name,
    url: item.href.startsWith('http') ? item.href : `${BASE_URL}${item.href}`,
  }));

  return (
    <>
      <BreadcrumbSchema breadcrumbs={schemaItems} />
      <Breadcrumbs items={items} />
    </>
  );
}
```

### Related Content Section (Unified)
```typescript
// src/components/widgets/related-content-section.tsx
import { RelatedMatchesWidget } from '@/components/match/related-matches-widget';
import { RelatedModelsWidget } from '@/components/model/related-models-widget';
import { RelatedArticles } from '@/components/blog/related-articles';

interface RelatedContentSectionProps {
  matchId?: string;
  competitionSlug?: string;
  modelId?: string;
  articles?: Array<{ id: string; slug: string; title: string; excerpt: string | null; publishedAt: string | null; contentType: string | null }>;
}

export function RelatedContentSection({
  matchId,
  competitionSlug,
  modelId,
  articles,
}: RelatedContentSectionProps) {
  return (
    <aside className="space-y-6" aria-label="Related content">
      {matchId && competitionSlug && (
        <RelatedMatchesWidget matchId={matchId} competitionSlug={competitionSlug} />
      )}
      {modelId && (
        <RelatedModelsWidget currentModelId={modelId} />
      )}
      {articles && articles.length > 0 && (
        <RelatedArticles articles={articles} />
      )}
    </aside>
  );
}
```

### Entity-Linked Content Component
```typescript
// src/components/content/entity-linked-content.tsx
import { getActiveModels } from '@/lib/db/queries';
import { linkEntitiesInText, buildEntityDictionary } from '@/lib/content/entity-linking';

interface EntityLinkedContentProps {
  content: string;
  teams: string[];
  maxLinks?: number;
}

export async function EntityLinkedContent({
  content,
  teams,
  maxLinks = 5,
}: EntityLinkedContentProps) {
  // Fetch models for entity dictionary
  const models = await getActiveModels();

  // Build entity dictionary
  const entities = buildEntityDictionary(teams, models);

  // Process content
  const linkedContent = linkEntitiesInText(content, entities, maxLinks);

  return <>{linkedContent}</>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hamburger menu for mobile | Bottom navigation bar | 2023-2024 | 21% faster task completion |
| Viewport prefetching all links | Hover/touch-triggered prefetch | Next.js 16 (2025) | Reduces unnecessary data transfer |
| CSS-only breadcrumb separators | aria-hidden separator elements | WCAG 2.2 (2023) | Better screen reader experience |
| ML-based entity linking | Dictionary-based string matching | N/A (sports-specific) | Faster, more accurate for known entities |

**Deprecated/outdated:**
- **Hamburger menus on mobile:** Hidden navigation reduces discoverability by 45% (NNGroup 2024). Bottom nav superior for primary actions.
- **Generic "More" links:** Google 2025+ algorithm prioritizes descriptive anchor text. Always use entity names as link text.
- **Client-side entity processing:** Adds JS bundle and delays paint. Server-side processing is standard for SEO-critical content.

## Open Questions

1. **Team Name Disambiguation**
   - What we know: Teams like "Barcelona" could mean FC Barcelona or Barcelona Sporting Club
   - What's unclear: How often this creates ambiguous links in practice
   - Recommendation: Link to search page with team filter (`/leagues?team=Barcelona`) rather than assuming specific team

2. **Entity Link Styling**
   - What we know: Links need visual distinction from surrounding text
   - What's unclear: Whether to use underline, color change, or both for inline entity links
   - Recommendation: Use `text-primary` (OKLCH color variable) without underline, add underline on hover

3. **Bottom Nav vs Header Nav Duplication**
   - What we know: Current header nav has same items as proposed bottom nav
   - What's unclear: Whether to keep both or hide header nav items on mobile
   - Recommendation: Keep header with logo + search only on mobile, full nav in bottom bar

4. **Prefetch Strategy for Match Lists**
   - What we know: Match list pages can have 20+ links
   - What's unclear: Optimal number of prefetches to allow
   - Recommendation: Start with HoverPrefetchLink for all list items, monitor performance

## Sources

### Primary (HIGH confidence)
- [Next.js Prefetching Guide](https://nextjs.org/docs/app/guides/prefetching) - HoverPrefetchLink pattern, prefetch prop values
- [Next.js Link Component](https://nextjs.org/docs/app/api-reference/components/link) - onTouchStart prefetch (merged PR #38805)
- [Accessible Breadcrumbs (Aditus)](https://www.aditus.io/patterns/breadcrumbs/) - ARIA attributes, HTML structure
- [React Aria useBreadcrumbs](https://react-spectrum.adobe.com/react-aria/useBreadcrumbs.html) - Accessibility implementation patterns
- [Lucide React Guide](https://lucide.dev/guide/packages/lucide-react) - Icon usage patterns

### Secondary (MEDIUM confidence)
- [Mobile Navigation UX 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) - Bottom nav best practices, 21% faster stat
- [Bottom Navigation Design (Smashing Magazine)](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/) - 3-5 items rule, thumb zone
- [Bottom Navigation Guide 2025](https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/) - 44px touch targets, 24px icons, 10-12px labels
- Phase 12 Research - Internal linking architecture, RelatedMatchesWidget pattern

### Tertiary (LOW confidence)
- [Entity Linking Wikipedia](https://en.wikipedia.org/wiki/Entity_linking) - General entity linking concepts
- [Compromise.js](https://github.com/spencermountain/compromise) - NLP alternative (not recommended for this use case)
- [InLinks Entity SEO Tool](https://inlinks.com/) - Commercial entity linking approach (not applicable to custom implementation)

## Metadata

**Confidence breakdown:**
- Bottom navigation: HIGH - Well-documented pattern with clear accessibility guidelines
- Visual breadcrumbs: HIGH - WCAG 2.2 and React Aria provide authoritative guidance
- Related content widgets: HIGH - Already implemented in Phase 12/19, extending existing patterns
- Entity linking: MEDIUM - Custom implementation using simple approach, may need iteration
- Prefetch optimization: HIGH - Next.js official documentation provides clear pattern

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - navigation patterns stable, Next.js 16 patterns established)
**Dependencies:** Phases 18-21 (navigation must link to rebuilt pages)
**Blocks:** Phase 23 (Performance & Polish)
