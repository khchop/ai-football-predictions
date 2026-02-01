# Phase 4: UX Polish - Research

**Researched:** 2026-02-01
**Domain:** Frontend UX - Mobile Responsiveness, Real-Time Updates, Error Handling
**Confidence:** HIGH

## Summary

Phase 4 addresses three distinct UX requirements: mobile-responsive prediction cards, real-time leaderboard updates, and comprehensive error boundaries. The existing codebase already has partial implementations for all three areas, reducing scope to enhancement rather than greenfield development.

Mobile responsiveness requires refactoring the `PredictionTable` component to use a stacked card layout on small screens (already implemented in `LeaderboardTable`). Real-time leaderboard updates can leverage the existing `LiveTabRefresher` component pattern with 30-second polling via `router.refresh()`. Error boundaries need the `react-error-boundary` library to catch async errors that Next.js's built-in `error.tsx` files cannot handle.

**Primary recommendation:** Extend existing patterns (mobile cards in leaderboard, LiveTabRefresher for polling) to prediction cards and leaderboard pages; add react-error-boundary for async error catching.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-error-boundary | ^4.x | Catch async errors, reset state | Official React recommendation, 4.5M weekly downloads, handles useErrorBoundary hook |
| Tailwind CSS | ^4.x | Responsive utilities | Already in stack, mobile-first breakpoint system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | ^8.21.3 | Table responsiveness | Already used in LeaderboardTable with mobile card view |
| SWR | ^2.x | Alternative polling | Only if router.refresh() proves insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-error-boundary | Built-in error.tsx only | error.tsx cannot catch async/event handler errors |
| router.refresh() polling | SWR refreshInterval | SWR adds bundle size, router.refresh() already works in codebase |
| Tailwind responsive classes | CSS media queries | Tailwind already in stack, consistent with existing code |

**Installation:**
```bash
npm install react-error-boundary
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── prediction-card.tsx      # Mobile-first prediction card (NEW)
│   ├── prediction-table.tsx     # Desktop table with mobile cards (MODIFY)
│   └── error-boundary-provider.tsx  # Async error catching wrapper (NEW)
├── app/
│   ├── error.tsx                # Root error boundary (EXISTS)
│   ├── global-error.tsx         # Fatal error handler (EXISTS)
│   └── leaderboard/
│       └── page.tsx             # Add LiveTabRefresher (MODIFY)
└── hooks/
    └── use-async-error.ts       # Wrapper for showBoundary (NEW)
```

### Pattern 1: Mobile Card Transformation
**What:** Transform horizontal table rows to vertical stacked cards on mobile
**When to use:** Any data table with more than 3 columns
**Example:**
```typescript
// Source: Existing pattern in src/components/leaderboard-table.tsx:361-465
// The LeaderboardTable already implements this pattern with MobileCard component

// Desktop: hidden md:block table
<div className="hidden md:block overflow-x-auto">
  <table>...</table>
</div>

// Mobile: md:hidden stacked cards
<div className="md:hidden space-y-3 p-4">
  {items.map((item, index) => (
    <MobileCard key={item.id} item={item} index={index} />
  ))}
</div>
```

### Pattern 2: LiveTabRefresher Polling
**What:** Client-side polling using router.refresh() with visibility awareness
**When to use:** Pages showing time-sensitive data (leaderboard, live scores)
**Example:**
```typescript
// Source: Existing pattern in src/app/matches/live-refresher.tsx:11-65
// Already implements: 30s polling, visibility check, tab focus detection

<LiveTabRefresher refreshInterval={30000}>
  <LeaderboardContent />
</LiveTabRefresher>
```

### Pattern 3: Async Error Boundary with react-error-boundary
**What:** Catch errors from async operations (fetch, event handlers) that built-in error.tsx misses
**When to use:** Components with async data fetching, user interactions that can fail
**Example:**
```typescript
// Source: https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react
'use client';

import { ErrorBoundary } from 'react-error-boundary';
import { useErrorBoundary } from 'react-error-boundary';

// Wrap async components
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => queryClient.clear()}
  resetKeys={[matchId]}
>
  <AsyncComponent />
</ErrorBoundary>

// Inside async components, catch and propagate
function AsyncComponent() {
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(showBoundary); // Propagates to nearest ErrorBoundary
  }, []);
}
```

### Anti-Patterns to Avoid
- **Fixed pixel widths on mobile:** Use `w-full`, `min-w-0`, `max-w-full` instead of `w-[200px]`
- **Horizontal scrolling tables:** Transform to cards on mobile, never force scroll
- **Silent async failures:** Always use showBoundary or state for error display
- **Polling without visibility check:** Wastes resources when tab not visible

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Catching async errors | Custom try/catch state management | react-error-boundary useErrorBoundary | Integrates with React error boundary tree, handles reset |
| Responsive breakpoints | CSS media queries | Tailwind md:/lg: prefixes | Already in stack, mobile-first by default |
| Tab visibility polling | Custom visibility API logic | LiveTabRefresher component | Already implemented, handles edge cases |
| Table-to-card transformation | Complex CSS grid switching | hidden/md:block pattern | Simple, proven in LeaderboardTable |

**Key insight:** The codebase already has working implementations of most patterns needed. Extend existing code rather than building new abstractions.

## Common Pitfalls

### Pitfall 1: Error Boundaries Not Catching Async Errors
**What goes wrong:** Built-in error.tsx files only catch errors during render phase
**Why it happens:** React error boundaries are synchronous by design - async errors occur outside render
**How to avoid:** Use react-error-boundary's useErrorBoundary hook to propagate async errors
**Warning signs:** White screens after failed API calls, no error UI shown for fetch failures

### Pitfall 2: Polling Continues When Tab Hidden
**What goes wrong:** Network requests continue when user switches tabs, wasting bandwidth
**Why it happens:** setInterval runs regardless of page visibility
**How to avoid:** Check `document.visibilityState === 'visible'` before refreshing (LiveTabRefresher does this)
**Warning signs:** High network traffic from backgrounded tabs, API rate limits hit

### Pitfall 3: Mobile Layout Horizontal Overflow
**What goes wrong:** Elements with fixed widths cause horizontal scrollbar on narrow screens
**Why it happens:** Using px widths or min-w values that exceed viewport
**How to avoid:** Use `min-w-0` to allow shrinking, `overflow-hidden truncate` for text
**Warning signs:** Horizontal scroll on any mobile view, content cut off at edges

### Pitfall 4: Error Boundary Reset Not Clearing State
**What goes wrong:** Clicking "Try again" shows same error immediately
**Why it happens:** Application state (React Query cache, component state) still has error data
**How to avoid:** Use onReset callback to clear relevant state, pass resetKeys prop
**Warning signs:** Error persists after reset button click

### Pitfall 5: Inconsistent Error UI Across Routes
**What goes wrong:** Different routes show different error styles/behaviors
**Why it happens:** Each route has its own error.tsx with different implementations
**How to avoid:** Create shared ErrorFallback component used by all error boundaries
**Warning signs:** User confusion from inconsistent error experiences

## Code Examples

Verified patterns from official sources and existing codebase:

### Mobile-Responsive Prediction Card
```typescript
// Source: Pattern from src/components/leaderboard-table.tsx, adapted for predictions
// Tailwind mobile-first: https://tailwindcss.com/docs/responsive-design

interface PredictionCardProps {
  prediction: Prediction;
  homeTeam: string;
  awayTeam: string;
  isFinished: boolean;
}

function MobilePredictionCard({ prediction, homeTeam, awayTeam, isFinished }: PredictionCardProps) {
  return (
    <div className={cn(
      "rounded-lg border border-border/50 p-4 space-y-3",
      prediction.isExact && "bg-green-500/5 border-green-500/30",
      prediction.isCorrectResult && !prediction.isExact && "bg-yellow-500/5 border-yellow-500/30"
    )}>
      {/* Model info row */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{prediction.modelDisplayName}</p>
          <p className="text-xs text-muted-foreground capitalize">{prediction.provider}</p>
        </div>
        {isFinished && (
          <div className="ml-3 px-3 py-1 rounded-lg bg-muted text-sm font-semibold">
            {prediction.points ?? 0} pts
          </div>
        )}
      </div>

      {/* Score prediction row - stacked vertical on mobile */}
      <div className="flex justify-center items-center gap-4 text-center">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground truncate">{homeTeam}</p>
          <p className="text-3xl font-bold font-mono">{prediction.predictedHomeScore}</p>
        </div>
        <span className="text-2xl text-muted-foreground">-</span>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground truncate">{awayTeam}</p>
          <p className="text-3xl font-bold font-mono">{prediction.predictedAwayScore}</p>
        </div>
      </div>
    </div>
  );
}
```

### Leaderboard with Auto-Refresh
```typescript
// Source: Pattern from src/app/matches/live-refresher.tsx
// Apply to leaderboard page

// In src/app/leaderboard/page.tsx
import { LiveTabRefresher } from '@/app/matches/live-refresher';

export default async function LeaderboardPage({ searchParams }: PageProps) {
  return (
    <LiveTabRefresher refreshInterval={30000}> {/* 30 seconds */}
      <div className="space-y-8">
        <LeaderboardHeader />
        <Suspense fallback={<LeaderboardTableSkeleton />}>
          <LeaderboardContent searchParams={resolvedParams} />
        </Suspense>
      </div>
    </LiveTabRefresher>
  );
}
```

### Async Error Boundary with react-error-boundary
```typescript
// Source: https://blog.logrocket.com/react-error-handling-react-error-boundary/
'use client';

import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

// Shared fallback component for consistent UI
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
      >
        Try again
      </button>
    </div>
  );
}

// Hook for async error catching
function useAsyncError() {
  const { showBoundary } = useErrorBoundary();

  return useCallback((promise: Promise<unknown>) => {
    return promise.catch(showBoundary);
  }, [showBoundary]);
}

// Usage in component
function DataComponent() {
  const catchError = useAsyncError();

  useEffect(() => {
    catchError(fetchData().then(setData));
  }, []);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Class-based Error Boundaries | react-error-boundary hooks | 2022 (v4.0) | Functional components can catch async errors |
| CSS media queries | Tailwind responsive prefixes | 2020+ | Consistent mobile-first approach |
| setInterval polling | router.refresh() + visibility | 2023 (Next.js 13+) | Preserves RSC benefits, no client-side refetch logic |
| Manual error state management | useErrorBoundary hook | 2022 | Automatic propagation to nearest boundary |

**Deprecated/outdated:**
- `useErrorHandler` (replaced by `useErrorBoundary` in v4)
- Client-side SWR for RSC pages (router.refresh() preserves server rendering)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal polling interval for leaderboard**
   - What we know: 30 seconds works for live matches, settlement can happen any time after match ends
   - What's unclear: Whether 30s is too aggressive for leaderboard (higher traffic)
   - Recommendation: Start with 30s, monitor API load, increase if needed

2. **Error boundary scope granularity**
   - What we know: Can wrap individual components or entire pages
   - What's unclear: Optimal balance between granular recovery and maintenance overhead
   - Recommendation: Start with page-level ErrorBoundary around Suspense, add component-level only for critical async operations

## Sources

### Primary (HIGH confidence)
- Next.js Error Handling docs - https://nextjs.org/docs/app/getting-started/error-handling
- Existing codebase: `src/components/leaderboard-table.tsx` (mobile card pattern)
- Existing codebase: `src/app/matches/live-refresher.tsx` (polling pattern)
- Existing codebase: `src/app/error.tsx`, `src/app/global-error.tsx` (error boundary pattern)

### Secondary (MEDIUM confidence)
- Kent C. Dodds react-error-boundary guide - https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react
- LogRocket react-error-boundary tutorial - https://blog.logrocket.com/react-error-handling-react-error-boundary/
- Tailwind responsive design docs - https://tailwindcss.com/docs/responsive-design

### Tertiary (LOW confidence)
- SWR revalidation patterns (may not be needed if router.refresh suffices)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Minimal additions needed, extends existing patterns
- Architecture: HIGH - Patterns already exist in codebase, just need extension
- Pitfalls: HIGH - Well-documented in official Next.js/React docs

**Research date:** 2026-02-01
**Valid until:** 30 days (stable patterns, no fast-moving dependencies)
