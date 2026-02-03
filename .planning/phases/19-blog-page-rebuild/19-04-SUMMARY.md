---
phase: 19-blog-page-rebuild
plan: 04
subsystem: blog-ui
tags: [toc, intersection-observer, scroll-spy, accessibility]

dependency-graph:
  requires: ["19-01"]
  provides: ["BlogTOC component with scroll spy"]
  affects: ["19-05"]

tech-stack:
  added: []
  patterns:
    - "Intersection Observer for scroll tracking"
    - "Map-based visibility tracking (avoid state re-renders)"
    - "prefers-reduced-motion support"

key-files:
  created:
    - src/components/blog/blog-toc.tsx
  modified: []

decisions:
  - "Used Intersection Observer with rootMargin '-80px 0px -80% 0px' to trigger near top of viewport accounting for sticky header"
  - "Used Map for visibility tracking instead of state to avoid re-renders on each intersection"
  - "Combined Tasks 1 and 2 since click handling is core to component functionality"
  - "threshold: 0 instead of 0.5 for better sensitivity with varying heading sizes"

metrics:
  duration: "1 minute"
  completed: "2026-02-03"
---

# Phase 19 Plan 04: Table of Contents Component Summary

BlogTOC component with Intersection Observer scroll spy, sticky sidebar on desktop, smooth scroll with reduced-motion support

## What Was Built

### BlogTOC Component (`src/components/blog/blog-toc.tsx`)

Client component providing table of contents with scroll tracking:

**Core Features:**
- Intersection Observer for efficient scroll position tracking
- Sticky positioning on desktop (`top-24`, `max-h-[calc(100vh-6rem)]`)
- Hidden on mobile via `hidden lg:block`
- Active section highlighted with `text-primary font-medium`

**Scroll Spy Implementation:**
```typescript
// Map-based visibility tracking (per research anti-pattern advice)
const visibilityMap = new Map<string, boolean>();

observerRef.current = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      visibilityMap.set(entry.target.id, entry.isIntersecting);
    });
    // Find first visible heading in document order
    const firstVisible = headings.find(h => visibilityMap.get(h.id));
    if (firstVisible) setActiveId(firstVisible.id);
  },
  { rootMargin: '-80px 0px -80% 0px', threshold: 0 }
);
```

**Smooth Scroll with Accessibility:**
- Click handlers use `scrollIntoView({ behavior: 'smooth' })`
- Respects `prefers-reduced-motion` media query
- Updates URL hash via `history.pushState` without scroll jump

**ARIA Support:**
- `aria-label="Table of contents"` on nav element
- `aria-current="location"` on active link

**Empty State:**
- Returns `null` if headings array is empty

### Integration Pattern

```tsx
// In blog page
import { extractHeadings } from '@/lib/blog/extract-headings';
import { BlogTOC } from '@/components/blog/blog-toc';

const headings = extractHeadings(markdown);
// Only show for 500+ word articles (per CONTEXT.md)
{headings.length > 0 && <BlogTOC headings={headings} />}
```

## Commits

| Hash | Message |
|------|---------|
| 7b991d7 | feat(19-04): create BlogTOC component with scroll spy |

## Verification

- [x] `npm run build` succeeds
- [x] BlogTOC uses Intersection Observer (not scroll event listener)
- [x] Observer properly disconnects on unmount
- [x] Component hidden on mobile, sticky on desktop
- [x] Active state styling applies to current section

## Deviations from Plan

None - plan executed as written. Combined Tasks 1 and 2 since click handling was included in initial component creation.

## Next Phase Readiness

Plan 19-05 (Integration) can now integrate BlogTOC into blog pages:
- Import `BlogTOC` from `@/components/blog/blog-toc`
- Pass headings from `extractHeadings()` (Plan 01)
- Add conditional rendering for 500+ word articles
- Position in grid layout alongside main content
