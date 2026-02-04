# Phase 30: Layout Assembly - Research

**Researched:** 2026-02-04
**Domain:** Next.js layout composition, skeleton loading states, component cleanup
**Confidence:** HIGH

## Summary

This research covers assembling state-aware match page layouts in Next.js 16 with PPR (Partial Prerendering), implementing full-page skeleton loading states, and removing deprecated components. The domain is mature with well-established patterns.

The standard approach leverages Next.js 16's PPR architecture with Suspense boundaries for streaming, client-side Context API for state distribution (already implemented via MatchDataProvider), and simple scrollable layouts with semantic HTML. Skeleton loaders should match the final layout structure exactly to prevent layout shifts. Component cleanup requires identifying all imports, extracting any reusable utilities, and aggressive deletion with git as the safety net.

**Primary recommendation:** Use server components for layout shell, wrap dynamic sections in Suspense with matching skeleton components, assemble sections in state-aware order via conditional rendering, and audit all components/match/ for unused imports before deletion.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.4 | App Router with PPR | Official React framework, PPR enables static shell + dynamic streaming |
| React | 19.2.3 | Component composition | Latest with improved Suspense and concurrent rendering |
| Tailwind CSS | 4.x | Responsive spacing/layout | Utility-first, already in use throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-loading-skeleton | 3.5.0 | Skeleton components | Already installed, provides baseline patterns |
| date-fns | 4.1.0 | Date formatting | Already in use for match times |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom skeleton CSS | react-loading-skeleton library | Library adds bundle size but provides animation, this project uses custom CSS (already implemented) |
| Client-side layout assembly | Server component composition | Server composition is faster initial load, client needed here for matchState-driven conditional rendering |
| Separate loading pages | Inline Suspense boundaries | Loading.tsx creates full-page loading, Suspense allows progressive enhancement (PPR requirement) |

**Installation:**
No new packages required - all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/app/matches/[id]/
├── page.tsx                 # Main page (server component shell)
├── loading.tsx              # Full-page skeleton (optional fallback)
└── error.tsx                # Error boundary with retry button

src/components/match/
├── match-data-provider.tsx  # Context provider (existing)
├── match-layout.tsx         # NEW: State-aware layout orchestrator (client component)
├── match-hero.tsx           # Section component (existing)
├── match-narrative.tsx      # Section component (existing)
├── sortable-predictions-table.tsx  # Section component (existing)
├── match-faq.tsx            # Section component (existing)
└── skeletons/
    ├── hero-skeleton.tsx    # NEW: Hero section placeholder
    ├── narrative-skeleton.tsx # NEW: Narrative section placeholder
    └── full-layout-skeleton.tsx # NEW: Complete page structure
```

### Pattern 1: Server Shell + Client Orchestrator
**What:** Server component fetches data and renders static shell, delegates state-aware layout assembly to client component
**When to use:** When layout structure depends on client-side state (matchState from context)
**Example:**
```typescript
// page.tsx (Server Component)
export default async function MatchPage({ params }: MatchPageProps) {
  const { match, competition, analysis } = await getMatchWithAnalysis(id);

  return (
    <>
      {/* Static schema/breadcrumbs outside provider (SSR optimized) */}
      <script type="application/ld+json" {...} />

      <MatchDataProvider match={match} competition={competition} analysis={analysis}>
        {/* Client component handles state-aware assembly */}
        <MatchLayout />
      </MatchDataProvider>
    </>
  );
}

// match-layout.tsx (Client Component)
'use client';

export function MatchLayout() {
  const { matchState } = useMatch();

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
      <MatchHero />

      {/* Conditional sections based on matchState */}
      {matchState !== 'live' && <MatchNarrative />}

      <section>
        <h2 className="text-2xl font-bold mb-6">Predictions</h2>
        <Suspense fallback={<PredictionsSkeleton />}>
          <SortablePredictionsTable />
        </Suspense>
      </section>

      <MatchFAQ />
    </div>
  );
}
```

### Pattern 2: Full-Page Skeleton (PPR Compatible)
**What:** Skeleton component that matches final layout structure exactly, used as Suspense fallback or loading.tsx
**When to use:** Initial page load before any data is available
**Example:**
```typescript
// skeletons/full-layout-skeleton.tsx
export function FullLayoutSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
      {/* Hero skeleton - matches MatchHero structure */}
      <div className="bg-card border-border border rounded-xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 md:gap-8">
          {/* Home team */}
          <div className="flex-1 text-center space-y-3">
            <Skeleton className="h-20 w-20 md:h-24 md:w-24 mx-auto rounded-xl" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>

          {/* VS/Score */}
          <Skeleton className="h-16 w-16" />

          {/* Away team */}
          <div className="flex-1 text-center space-y-3">
            <Skeleton className="h-20 w-20 md:h-24 md:w-24 mx-auto rounded-xl" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>
        </div>
      </div>

      {/* Narrative skeleton */}
      <div className="bg-card/50 border-border/50 border rounded-xl p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Predictions skeleton */}
      <PredictionsSkeleton />

      {/* FAQ skeleton */}
      <div className="border-t border-border/50 pt-8">
        <Skeleton className="h-8 w-48 mb-6" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-4" />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 3: Conditional Section Rendering
**What:** Show/hide sections based on matchState, always render section heading even if content empty
**When to use:** State-dependent layout variations (Upcoming vs Live vs Finished)
**Example:**
```typescript
// Upcoming: Hero + Narrative + Predictions + FAQ
// Live: Hero + Predictions + FAQ (NO narrative)
// Finished: Hero + Narrative + Predictions + FAQ

export function MatchLayout() {
  const { matchState } = useMatch();

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
      {/* Always visible */}
      <MatchHero />

      {/* Conditional: Hide during live */}
      {matchState !== 'live' && (
        <section>
          <h2 className="text-2xl font-bold mb-6">
            {matchState === 'finished' ? 'Match Report' : 'Match Preview'}
          </h2>
          <MatchNarrative />
        </section>
      )}

      {/* Always visible with heading */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Predictions</h2>
        <SortablePredictionsTable />
      </section>

      {/* Always visible */}
      <MatchFAQ />
    </div>
  );
}
```

### Pattern 4: Error Boundary with Retry
**What:** Next.js error.tsx convention with reset() function for retry button
**When to use:** Route-level error handling with user recovery option
**Example:**
```typescript
// app/matches/[id]/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-[1200px] mx-auto p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-muted-foreground mb-6">
        {error.message || 'Failed to load match data'}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Layout shifts during load:** Skeleton dimensions MUST match final content exactly
- **Prop drilling through Context:** Use useMatch() hook consistently, not prop passing
- **Client boundaries too high:** Keep page.tsx as server component, only MatchLayout needs 'use client'
- **Conditional Suspense:** Don't wrap Suspense in conditionals, wrap conditionals inside or use null fallback
- **Preserving unused code "just in case":** Git is the safety net, delete aggressively

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading skeletons | Custom div soup with manual styling | Existing Skeleton component + shimmer CSS | Project already has shimmer animation in globals.css, consistent visual language |
| Error boundaries | Try-catch in components | Next.js error.tsx convention | File-based routing provides automatic error isolation per route segment |
| Responsive spacing | Media query CSS per component | Tailwind space-y-8 md:space-y-12 | Design system already established in globals.css with spacing scale |
| Max-width containers | Custom wrapper components | Tailwind max-w-[1200px] mx-auto | Matches user decision from CONTEXT.md, semantic HTML over abstraction |
| State-aware rendering | Multiple layout components | Single layout with conditional sections | Reduces complexity, single component easier to reason about |

**Key insight:** This project has mature design system (globals.css) and component library (ui/). Don't create new primitives when existing patterns cover the use case.

## Common Pitfalls

### Pitfall 1: Skeleton Doesn't Match Final Layout
**What goes wrong:** Skeleton shows different structure than final content, causing layout shift when content loads
**Why it happens:** Skeleton built independently without referencing final component structure
**How to avoid:** Build skeleton by copying final component JSX and replacing content with Skeleton components, keeping exact same spacing/sizing classes
**Warning signs:** Content "jumps" when transitioning from skeleton to real data, especially on slower connections

### Pitfall 2: Forgetting Section Headings on Empty States
**What goes wrong:** Heading disappears when section has no content, breaking visual hierarchy
**Why it happens:** Conditional rendering wraps heading + content together instead of just content
**How to avoid:** Always render H2 heading, only conditionally render content inside section
**Warning signs:** User decision in CONTEXT.md explicitly states "Show section heading even if no content"

### Pitfall 3: Deleting Partially-Used Components
**What goes wrong:** Component deleted but small utility function inside was still needed elsewhere
**Why it happens:** Search only checks for component imports, not individual function exports
**How to avoid:** Read entire deprecated file, check if any non-component exports exist, grep for those function names separately, extract to utils/ before deleting component
**Warning signs:** Build errors after deletion about missing imports from a file you thought was unused

### Pitfall 4: Client Component Wrapping Server Data Fetch
**What goes wrong:** Using 'use client' at page level forces client-side data fetching, losing PPR benefits
**Why it happens:** Seeing Context Provider usage and assuming whole tree must be client-side
**How to avoid:** Keep page.tsx as server component, fetch data there, pass to Provider, only MatchLayout (child of Provider) needs 'use client'
**Warning signs:** No static prerendering happening, all data fetched client-side, slower initial load

### Pitfall 5: Not Testing All Match States
**What goes wrong:** Layout tested with one match state, breaks for others (especially live matches missing narrative)
**Why it happens:** Developer testing with single example match
**How to avoid:** Test layout with upcoming match (shows all sections), live match (no narrative), finished match (all sections with scores), manually change matchState in dev
**Warning signs:** User decision shows different section ordering per state, must verify each combination

## Code Examples

Verified patterns from codebase and official sources:

### Responsive Container with Vertical Spacing
```typescript
// Source: User's existing design system (globals.css spacing scale)
<div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
  {/* Sections here - 32px gap on mobile, 48px on desktop */}
</div>
```

### Skeleton with Shimmer Animation
```typescript
// Source: src/components/match/predictions-skeleton.tsx (existing pattern)
<div className="skeleton-wrapper bg-muted/50 rounded-xl p-6">
  <div className="shimmer" />
  <div className="space-y-3">
    <Skeleton className="h-6 w-32" />
    <Skeleton className="h-4 w-full" />
  </div>
</div>
```

### Section Heading Always Visible
```typescript
// Source: User decision in CONTEXT.md
<section className="space-y-6">
  <h2 className="text-2xl font-bold">Predictions</h2>
  {predictions.length > 0 ? (
    <SortablePredictionsTable predictions={predictions} />
  ) : (
    <p className="text-muted-foreground italic">No predictions available yet</p>
  )}
</section>
```

### State-Aware Section Visibility
```typescript
// Source: User decision CONTEXT.md + existing NAR-002 decision
const { matchState } = useMatch();

// Live matches skip narrative section entirely
{matchState !== 'live' && (
  <section>
    <h2 className="text-2xl font-bold mb-6">
      {matchState === 'finished' ? 'Match Report' : 'Match Preview'}
    </h2>
    <MatchNarrative />
  </section>
)}
```

### Suspense Boundary with Matching Skeleton
```typescript
// Source: Official Next.js docs + existing src/app/matches/[id]/page.tsx pattern
<Suspense fallback={<PredictionsSkeleton />}>
  <PredictionsSection matchId={id} />
</Suspense>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loading.tsx for all routes | Suspense boundaries with PPR | Next.js 16 (2025) | Granular streaming, static shell with dynamic holes |
| Force-dynamic for any dynamic data | PPR with Cache Components | Next.js 16 (2025) | Partial static rendering, faster initial loads |
| Prop drilling match data | Context API with hooks | v2.2 (this milestone) | Cleaner component APIs, single source of truth |
| Tabs for content organization | Single-scroll layout | v2.1 (previous milestone) | Mobile-first, no hidden content |
| react-loading-skeleton library | Custom CSS with Skeleton component | Project standard | Lighter bundle, consistent with design system |

**Deprecated/outdated:**
- **match-header.tsx**: Replaced by match-hero.tsx (new design, better state handling)
- **match-tabs-mobile.tsx**: Removed entirely (single-scroll layout, no tabs)
- **tab-content/*.tsx files**: All tab content files deprecated (analysis-tab, predictions-tab, stats-tab, summary-tab)
- **force-dynamic export**: PPR handles static/dynamic split automatically via Suspense
- **experimental_ppr flag**: Next.js 16 uses Cache Components configuration instead

## Open Questions

Things that couldn't be fully resolved:

1. **Visual separation between sections**
   - What we know: User decision leaves this to Claude's discretion, existing components use card backgrounds with border-border/50
   - What's unclear: Whether to use cards, dividers, or pure whitespace between sections
   - Recommendation: Use whitespace + subtle border-t divider for FAQ (already exists in match-faq.tsx line 28), whitespace only for other sections (matches hero/narrative existing styles)

2. **Where to relocate extracted utilities from deleted files**
   - What we know: User decision says "extract used parts elsewhere, delete the file"
   - What's unclear: Which deleted components contain reusable utilities
   - Recommendation: Audit during deletion - if utility functions exist, move to src/lib/utils/ before deleting component file

3. **Exact skeleton pulse animation timing**
   - What we know: Existing PredictionsSkeleton uses shimmer animation (globals.css line 528-535), Skeleton component uses animate-pulse
   - What's unclear: Whether to standardize on one animation or use both
   - Recommendation: Use shimmer for full sections (matches existing PredictionsSkeleton), animate-pulse for individual elements (matches ui/skeleton.tsx)

## Sources

### Primary (HIGH confidence)
- [Next.js Official Documentation - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Official Documentation - Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
- [Next.js Official Documentation - Error Handling](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- Existing codebase components: match-data-provider.tsx, match-hero.tsx, match-narrative.tsx, predictions-skeleton.tsx
- Project globals.css design system (spacing scale, shimmer animation, max-width containers)

### Secondary (MEDIUM confidence)
- [Next.js 15 Advanced Patterns: App Router, Server Actions, and Caching Strategies for 2026](https://johal.in/next-js-15-advanced-patterns-app-router-server-actions-and-caching-strategies-for-2026/)
- [Material UI Skeleton component documentation](https://mui.com/material-ui/react-skeleton/)
- [React Loading Skeleton - LogRocket](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)
- [Skeletons: The Pinnacle of Loading States in React 19](https://balevdev.medium.com/skeletons-the-pinnacle-of-loading-states-in-react-19-427cbb5a1f48)
- [Tailwind CSS Dividers Documentation](https://tw-elements.com/docs/standard/content-styles/dividers/)

### Tertiary (LOW confidence)
- [React component refactoring best practices 2026](https://technostacks.com/blog/react-best-practices/) - General guidance, not specific to this codebase
- [CSS spacing patterns](https://ishadeed.com/article/spacing-in-css/) - Design principles, project already has design system

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed, Next.js 16 PPR officially documented
- Architecture: HIGH - Patterns verified in existing codebase (page.tsx, MatchDataProvider) and official Next.js docs
- Pitfalls: MEDIUM - Derived from codebase patterns and user decisions, but actual issues only revealed during implementation

**Research date:** 2026-02-04
**Valid until:** 2026-03-06 (30 days - Next.js stable, React stable, no breaking changes expected)
