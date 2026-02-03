---
phase: 23
plan: 03
subsystem: infrastructure
tags: [ppr, next.js, performance, streaming, view-transitions]
dependency-graph:
  requires: [23-01]
  provides: [ppr-enabled, streaming-ux]
  affects: [all-pages]
tech-stack:
  added: []
  patterns: [partial-prerendering, suspense-boundaries, connection-signal]
key-files:
  created: []
  modified:
    - next.config.ts
    - src/app/layout.tsx
    - src/lib/cache/redis.ts
    - src/lib/db/queries.ts
decisions:
  - id: 23-03-01
    choice: "Wrap Navigation/BottomNav in Suspense"
    reason: "usePathname requires client boundary, PPR needs Suspense for client components"
  - id: 23-03-02
    choice: "Add connection() to withCache and getUpcomingMatches"
    reason: "Date.now()/new Date() before data access violates PPR static analysis"
  - id: 23-03-03
    choice: "Skeleton fallbacks for navigation during streaming"
    reason: "Match actual navigation layout to prevent layout shift"
metrics:
  duration: 19m
  completed: 2026-02-03
---

# Phase 23 Plan 03: Enable PPR Configuration Summary

**One-liner:** Enabled cacheComponents for PPR with Suspense boundaries on client navigation components and connection() signals for time-dependent code.

## What Was Done

### Task 1: Enable cacheComponents in Next.js config

1. **Added `cacheComponents: true`** at top level of nextConfig (not under experimental)
2. **Removed TODO comment** - PPR now active
3. **Kept `experimental.viewTransition: true`** for smooth page transitions

### Blocking Issues Fixed (Rule 3)

The initial build failed with "Uncached data was accessed outside of Suspense" errors. Root causes and fixes:

**Issue 1: Client components using usePathname**
- `Navigation` and `BottomNav` use `usePathname()` hook
- Fix: Wrapped both in `<Suspense>` boundaries with skeleton fallbacks

**Issue 2: ErrorBoundaryProvider client component**
- Uses `useEffect` for Sentry error reporting
- Fix: Wrapped in `<Suspense>` boundary

**Issue 3: Date.now() in cache layer**
- `shouldUseRedis()` calls `Date.now()` before any data access
- Fix: Added `await connection()` at start of `withCache()`

**Issue 4: new Date() in query functions**
- `getUpcomingMatches()` uses `new Date()` for time filtering
- Fix: Added `await connection()` before date access

### Build Output Verification

Build completed successfully with PPR enabled:
```
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content

Route (app)
├ ◐ /
├ ◐ /blog
├ ◐ /blog/[slug]
├ ◐ /leaderboard
├ ◐ /matches
├ ◐ /models/[id]
└ ...
```

All key pages show `◐` indicating static shell + streaming dynamic content.

## Technical Details

### PPR Pattern Applied

```typescript
// Layout now wraps client components in Suspense
<Suspense fallback={<NavigationSkeleton />}>
  <Navigation />
</Suspense>

// Dynamic code uses connection() signal
export async function withCache<T>(...) {
  await connection(); // PPR: Signal request-time data access
  if (shouldUseRedis()) { // Now safe to use Date.now()
    ...
  }
}
```

### Skeleton Components Added

```typescript
// NavigationSkeleton - matches header layout
const NavigationSkeleton = () => (
  <header className="sticky top-0 z-50 ...">
    <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
    ))}
  </header>
);

// BottomNavSkeleton - matches mobile nav layout
const BottomNavSkeleton = () => (
  <nav className="fixed bottom-0 ...">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex flex-col items-center gap-1">
        <div className="h-5 w-5 rounded bg-muted animate-pulse" />
        <div className="h-3 w-12 rounded bg-muted animate-pulse" />
      </div>
    ))}
  </nav>
);
```

## Files Changed

| File | Change |
|------|--------|
| next.config.ts | Added `cacheComponents: true` |
| src/app/layout.tsx | Suspense boundaries + skeleton fallbacks |
| src/lib/cache/redis.ts | Added `connection()` import and call in withCache |
| src/lib/db/queries.ts | Added `connection()` import and call in getUpcomingMatches |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Navigation Suspense boundaries**
- **Found during:** Task 1 build verification
- **Issue:** usePathname in Navigation/BottomNav caused PPR build failure
- **Fix:** Wrapped in Suspense with skeleton fallbacks
- **Files modified:** src/app/layout.tsx
- **Commit:** 75d1852

**2. [Rule 3 - Blocking] ErrorBoundaryProvider Suspense**
- **Found during:** Task 1 build verification
- **Issue:** Client component with useEffect outside Suspense
- **Fix:** Wrapped in Suspense boundary
- **Files modified:** src/app/layout.tsx
- **Commit:** 75d1852

**3. [Rule 3 - Blocking] Cache layer Date.now() usage**
- **Found during:** Task 1 build verification
- **Issue:** shouldUseRedis() uses Date.now() before data access
- **Fix:** Added connection() call at start of withCache()
- **Files modified:** src/lib/cache/redis.ts
- **Commit:** 75d1852

**4. [Rule 3 - Blocking] Query function new Date() usage**
- **Found during:** Task 1 build verification
- **Issue:** getUpcomingMatches() uses new Date() before database query
- **Fix:** Added connection() call before date creation
- **Files modified:** src/lib/db/queries.ts
- **Commit:** 75d1852

## Verification Results

- Build succeeds with no PPR-related errors
- No "uncached data" warnings
- All key pages marked as Partial Prerender (◐)
- User approved PPR and View Transitions behavior

## Commits

| Hash | Message |
|------|---------|
| 75d1852 | feat(23-03): enable PPR via cacheComponents in Next.js config |

## Next Steps

- Plan 23-04: Final polish and performance validation
- Monitor production for any PPR-related issues
- Consider adding more granular Suspense boundaries for improved streaming
