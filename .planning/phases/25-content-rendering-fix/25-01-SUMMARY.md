---
phase: 25-content-rendering-fix
plan: 01
subsystem: ui
tags: [dompurify, html-sanitization, narrative-content, server-components]

# Dependency graph
requires:
  - phase: 24-match-page-cleanup
    provides: Simplified match page layout with narrative sections
provides:
  - HTML stripping utility for SSR-compatible content sanitization
  - Clean text rendering in all narrative sections
affects: []

# Tech tracking
tech-stack:
  added: [isomorphic-dompurify]
  patterns: [content-sanitization-at-render-time]

key-files:
  created:
    - src/lib/utils/strip-html.ts
  modified:
    - src/components/match/MatchContent.tsx
    - src/components/match/narrative-preview.tsx

key-decisions:
  - "Used isomorphic-dompurify for SSR compatibility with Next.js App Router"
  - "Applied stripping at render time rather than storage time for flexibility"

patterns-established:
  - "stripHtml utility: Use for any LLM-generated content that may contain HTML tags"

# Metrics
duration: 8min
completed: 2026-02-03
---

# Phase 25 Plan 01: Content Rendering Fix Summary

**HTML stripping for narrative content using isomorphic-dompurify, ensuring clean text display in all match page sections**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-03T11:30:00Z
- **Completed:** 2026-02-03T11:38:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created reusable stripHtml utility with SSR-compatible isomorphic-dompurify
- Applied HTML stripping to all narrative sections in MatchContentSection
- Updated NarrativePreview to strip HTML before word counting for accurate truncation
- Build passes with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install isomorphic-dompurify and create stripHtml utility** - `26d4286` (feat)
2. **Task 2: Apply HTML stripping to MatchContentSection and NarrativePreview** - `8d362c3` (feat)

## Files Created/Modified
- `src/lib/utils/strip-html.ts` - Utility to strip HTML tags while preserving text content
- `src/components/match/MatchContent.tsx` - Applied stripHtml to all narrative sections (pre-match, betting, post-match)
- `src/components/match/narrative-preview.tsx` - Applied stripHtml before word splitting for accurate truncation
- `package.json` - Added isomorphic-dompurify dependency

## Decisions Made
- **isomorphic-dompurify over DOMPurify:** Selected isomorphic-dompurify because raw DOMPurify requires browser DOM APIs, incompatible with Next.js Server Components
- **Strip at render time:** Applied stripping when rendering rather than at storage time, preserving original content in database for flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 25 complete with this single plan
- All content quality issues (QUAL-01) resolved
- Match page narrative sections now display clean text regardless of source HTML tags

---
*Phase: 25-content-rendering-fix*
*Completed: 2026-02-03*
