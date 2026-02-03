---
phase: 22-navigation-internal-linking
plan: 01
subsystem: navigation
tags: [navigation, mobile, prefetch, accessibility]

dependency-graph:
  requires:
    - Phase 17 (design tokens, OKLCH colors)
    - Phase 18-21 (rebuilt pages for navigation targets)
  provides:
    - HoverPrefetchLink component for intent-based prefetching
    - BottomNav component for mobile navigation
    - Safe area CSS utility
  affects:
    - Plan 22-04 (BottomNav integration in layout.tsx)
    - All pages with navigation links

tech-stack:
  added: []
  patterns:
    - Intent-based prefetching (hover/touch triggers)
    - Mobile-first bottom navigation
    - Safe area CSS environment variables

key-files:
  created:
    - src/components/navigation/hover-prefetch-link.tsx
    - src/components/navigation/bottom-nav.tsx
  modified:
    - src/app/globals.css

decisions:
  - id: NAVL-01-prefetch
    choice: "Prefetch on hover/touch, not viewport entry"
    rationale: "Research shows viewport prefetching can trigger 1MB+ on scroll"
  - id: NAVL-01-mobile-nav
    choice: "4 items: Home, Matches, Leaderboard, Blog"
    rationale: "Matches existing header nav, 3-5 items optimal for thumb zone"

metrics:
  duration: ~5 minutes
  completed: 2026-02-03
---

# Phase 22 Plan 01: Core Navigation Components Summary

**Intent-based prefetch wrapper and mobile bottom navigation with 44px touch targets**

## Tasks Completed

### Task 1: HoverPrefetchLink Component
Created `/src/components/navigation/hover-prefetch-link.tsx`:
- Client component wrapping Next.js Link
- Defaults to `prefetch={false}`, enables on mouseEnter or touchStart
- Forwards all Link props via `ComponentProps<typeof Link>`
- Custom event handlers preserved via callback composition

**Key code:**
```typescript
const [shouldPrefetch, setShouldPrefetch] = useState(false);
return (
  <Link
    {...props}
    prefetch={shouldPrefetch ? undefined : false}
    onMouseEnter={(e) => { handleInteraction(); onMouseEnter?.(e); }}
    onTouchStart={(e) => { handleInteraction(); onTouchStart?.(e); }}
  >
```

### Task 2: BottomNav Component + Safe Area CSS
Created `/src/components/navigation/bottom-nav.tsx`:
- Mobile-only visibility (`md:hidden`)
- 4 navigation items matching header nav
- Uses lucide-react icons (Home, Calendar, Trophy, FileText)
- 44px minimum touch targets (`min-h-[44px]`)
- Active state styling with aria-current="page"
- Uses HoverPrefetchLink for all navigation links

Added to `/src/app/globals.css`:
```css
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation | Pass (ESLint clean) |
| HoverPrefetchLink exports | Pass |
| BottomNav uses HoverPrefetchLink | Pass |
| BottomNav has md:hidden | Pass |
| Touch targets 44px minimum | Pass |
| Safe area CSS utility | Pass |

## Deviations from Plan

None - plan executed exactly as written.

## What's Ready for Integration

- **HoverPrefetchLink** can be used anywhere Link is used
- **BottomNav** ready for layout.tsx integration (Plan 22-04)
- **Safe area CSS** available for any fixed bottom elements

## Next Phase Readiness

Plan 22-02 (Breadcrumbs) can proceed - no blockers. Plan 22-04 will integrate BottomNav into layout.tsx after other navigation components are built.
