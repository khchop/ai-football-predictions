---
phase: 33-html-sanitization
plan: 01
subsystem: content
tags: [html-to-text, he, sanitization, llm-prompts, plain-text]

# Dependency graph
requires:
  - phase: 32-make-failures-visible
    provides: Content generation pipeline with BullMQ workers
provides:
  - HTML sanitization utility functions (sanitizeContent, validateNoHtml)
  - Plain text output instructions in all LLM prompts
affects: [33-02, 33-03, content-generation, match-content]

# Tech tracking
tech-stack:
  added: [html-to-text, he, @types/html-to-text, @types/he]
  patterns: [pre-save-sanitization, defense-in-depth-prompts]

key-files:
  created: [src/lib/content/sanitization.ts]
  modified: [src/lib/content/match-content.ts, src/lib/content/prompts.ts, package.json]

key-decisions:
  - "Use html-to-text for HTML-to-plain-text conversion (npm standard with 1344+ dependents)"
  - "Use he library for HTML entity decoding (npm standard with 2535+ dependents)"
  - "Defense-in-depth approach: prompts request plain text AND runtime sanitization available"
  - "buildPostMatchRoundupPrompt switched from HTML to plain text format"

patterns-established:
  - "Prompt plain text instructions: OUTPUT FORMAT with plain text requirements"
  - "Sanitization before save: sanitizeContent() before database insert"

# Metrics
duration: 6min
completed: 2026-02-04
---

# Phase 33 Plan 01: HTML Sanitization Foundation Summary

**HTML sanitization utilities with html-to-text/he libraries plus plain text instructions in all LLM content prompts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-04T15:03:38Z
- **Completed:** 2026-02-04T15:09:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created sanitization.ts module with sanitizeContent() and validateNoHtml() functions
- Installed html-to-text and he packages with TypeScript types
- Updated all 4 content prompts in match-content.ts with plain text output instructions
- Updated all 4 prompt builders in prompts.ts to request plain text output
- Converted buildPostMatchRoundupPrompt from HTML format to plain text format

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create sanitization module** - `5689310` (feat)
2. **Task 2: Update prompts to request plain text output** - `e218f98` (feat)

## Files Created/Modified
- `src/lib/content/sanitization.ts` - New module with sanitizeContent() and validateNoHtml() exports
- `src/lib/content/match-content.ts` - Added plain text instructions to pre-match, betting, post-match, FAQ prompts
- `src/lib/content/prompts.ts` - Updated all prompt builders with plain text requirements
- `package.json` - Added html-to-text, he dependencies and @types packages

## Decisions Made
- Used html-to-text library (npm standard) rather than regex-based stripping
- Used he library (npm standard) for HTML entity decoding
- Applied defense-in-depth: prompts request plain text AND sanitization available for runtime cleanup
- Changed PostMatchRoundupPrompt from HTML table format to plain text summary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/he dev dependency**
- **Found during:** Task 1 (Build verification)
- **Issue:** TypeScript build failed - he module has no declaration file
- **Fix:** Ran `npm install --save-dev @types/he`
- **Files modified:** package.json, package-lock.json
- **Verification:** npm run build passes
- **Committed in:** 5689310 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor - types package needed for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sanitization functions ready for integration in 33-02-PLAN.md
- All prompts now request plain text output
- Build passes, no breaking changes

---
*Phase: 33-html-sanitization*
*Completed: 2026-02-04*
