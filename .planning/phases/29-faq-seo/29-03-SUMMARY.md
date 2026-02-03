---
phase: 29-faq-seo
plan: 03
subsystem: seo
tags: [json-ld, schema.org, faq, accordion, radix-ui]

# Dependency graph
requires:
  - phase: 29-01
    provides: Radix Accordion component with animation keyframes
  - phase: 29-02
    provides: generateMatchFAQs function returning 5 state-specific questions
provides:
  - FAQPage schema integrated into MatchPageSchema @graph
  - Accordion-based FAQ visual component
  - Single source of truth for FAQ content (schema matches visible text)
affects: [29-04, 29-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["@graph consolidation for JSON-LD", "Component re-export pattern for shared data"]

key-files:
  created: []
  modified:
    - src/components/MatchPageSchema.tsx
    - src/components/match/match-faq.tsx
    - src/app/leagues/[slug]/[match]/page.tsx

key-decisions:
  - "FAQPage added to existing @graph (not separate script) per SGEO-01"
  - "FAQs generated once in page, passed to both schema and visual component (SGEO-02)"
  - "Re-export pattern allows page-level FAQ generation while component handles display"

patterns-established:
  - "@graph consolidation: All schema types in single JSON-LD script"
  - "Single source of truth: Same data feeds both schema and visual display"

# Metrics
duration: 2min
completed: 2026-02-03
---

# Phase 29 Plan 03: Schema Consolidation Summary

**FAQPage schema consolidated into MatchPageSchema @graph with Radix Accordion visual component**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-03T20:40:49Z
- **Completed:** 2026-02-03T20:43:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- FAQPage added to MatchPageSchema @graph (single JSON-LD script now contains SportsEvent + FAQPage)
- MatchFAQ refactored from native `<details>` to Radix Accordion with type="multiple" and first-item-open default
- FAQ data generated once at page level, shared between schema and visual display (SGEO-02 compliance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FAQPage to MatchPageSchema @graph** - `84321ca` (feat)
2. **Task 2: Update match-faq.tsx to use Radix Accordion** - `75bcbc8` (feat)

**Blocking fix:** `eaa1ada` (fix) - Wire FAQs to MatchPageSchema in match page

## Files Created/Modified

- `src/components/MatchPageSchema.tsx` - Added FAQItem import, faqs prop, FAQPage to @graph
- `src/components/match/match-faq.tsx` - Replaced details with Accordion, added re-export
- `src/app/leagues/[slug]/[match]/page.tsx` - Generate FAQs and pass to MatchPageSchema

## Decisions Made

- FAQPage placed after WebPage, before BreadcrumbList in @graph array (maintains logical grouping)
- Used re-export pattern (`export { generateMatchFAQs }`) to allow page-level FAQ generation
- Added 'use client' directive to match-faq.tsx for Accordion interactivity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wire FAQs to MatchPageSchema in page.tsx**
- **Found during:** Task 2 verification
- **Issue:** MatchPageSchema now requires faqs prop, but page.tsx wasn't passing it
- **Fix:** Import generateMatchFAQs, generate FAQs in page, pass to MatchPageSchema
- **Files modified:** src/app/leagues/[slug]/[match]/page.tsx
- **Verification:** TypeScript compiles, build passes
- **Committed in:** eaa1ada

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Required to complete schema integration. No scope creep.

## Issues Encountered

None - plan executed smoothly after blocking fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FAQPage schema integrated and ready for Rich Results testing (Plan 04)
- Accordion visual component complete with proper accessibility
- Schema and visual FAQ sourced from same generateMatchFAQs function (SGEO-02 satisfied)

---
*Phase: 29-faq-seo*
*Completed: 2026-02-03*
