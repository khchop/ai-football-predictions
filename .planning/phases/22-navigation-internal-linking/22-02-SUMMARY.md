---
phase: 22-navigation-internal-linking
plan: 02
subsystem: ui
tags: [breadcrumbs, accessibility, aria, navigation, schema-org, lucide-react]

# Dependency graph
requires:
  - phase: 17-design-system
    provides: Design tokens and component patterns
provides:
  - Breadcrumbs visual component with accessibility attributes
  - BreadcrumbsWithSchema combining visual + JSON-LD schema
  - Builder utilities for match, league, blog, model, leaderboard pages
affects: [22-03 (page integration), 18-match-page, 19-blog-page, 20-league-page, 21-leaderboard-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [nav > ol > li breadcrumb structure, aria-current="page" for active item]

key-files:
  created:
    - src/components/navigation/breadcrumbs.tsx
    - src/lib/navigation/breadcrumb-utils.ts
  modified: []

key-decisions:
  - "ChevronRight from lucide-react as separator with aria-hidden"
  - "Last item uses span with aria-current='page' (not a link)"
  - "Truncation: 200px max on last item, 150px on others"
  - "Empty href string for current page breadcrumb items"

patterns-established:
  - "Breadcrumb building: Always start with Home, end with empty href"
  - "BreadcrumbsWithSchema for pages needing both visual + SEO"

# Metrics
duration: 3min
completed: 2026-02-03
---

# Phase 22 Plan 02: Breadcrumbs UI Summary

**Visual breadcrumbs component with nav/ol/li structure, aria attributes, and builder utilities for all page types**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-03T10:04:58Z
- **Completed:** 2026-02-03T10:07:59Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Accessible Breadcrumbs component with proper HTML semantics (nav > ol > li)
- BreadcrumbsWithSchema that combines visual display with JSON-LD schema injection
- Five builder utilities covering all major page types for consistent breadcrumb generation
- Complete accessibility: aria-label, aria-current="page", aria-hidden on decorative separator

## Task Commits

Each task was committed atomically:

1. **Task 1: Create visual Breadcrumbs component** - `a2e479c` (feat)
2. **Task 2: Create breadcrumb builder utilities** - `19618d7` (feat)

## Files Created/Modified
- `src/components/navigation/breadcrumbs.tsx` - Breadcrumbs and BreadcrumbsWithSchema components
- `src/lib/navigation/breadcrumb-utils.ts` - Builder functions for match, league, blog, model, leaderboard pages

## Decisions Made
- Used ChevronRight from lucide-react as separator (matches existing icon usage)
- Last breadcrumb item rendered as span with aria-current="page" (not a link)
- Truncation widths: 200px for last item, 150px for intermediate items
- Empty string href indicates current page in builder utilities
- BreadcrumbsWithSchema converts relative hrefs to absolute URLs for schema

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Breadcrumbs components ready for integration into pages (22-03)
- Builder utilities provide consistent patterns for each page type
- Integrates with existing BreadcrumbSchema component for JSON-LD

---
*Phase: 22-navigation-internal-linking*
*Completed: 2026-02-03*
