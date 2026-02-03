---
phase: 29-faq-seo
plan: 04
subsystem: seo
tags: [faq, together-ai, verification, schema-org]

# Dependency graph
requires:
  - phase: 29-03
    provides: Schema consolidation and accordion FAQ
provides:
  - AI-generated FAQ content using Together AI
  - Match-specific Q&A with real model names and scores
  - Fallback to template FAQs when AI content unavailable
affects: [match-pages, seo]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AI content generation", "graceful fallback"]

key-files:
  created:
    - src/app/api/admin/generate-faq/route.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/content/match-content.ts
    - src/components/match/match-faq.tsx
    - src/app/leagues/[slug]/[match]/page.tsx

key-decisions:
  - "AI FAQs stored in matchContent.faqContent as JSON array"
  - "Fallback to template FAQs when AI content not available"
  - "Together AI (Llama 4 Maverick) generates match-specific Q&A"

patterns-established:
  - "AI content with graceful fallback pattern"
  - "State-aware FAQ generation (different content for finished vs upcoming)"

# Metrics
duration: 45min
completed: 2026-02-03
---

# Phase 29 Plan 04: Visual Verification Summary

**AI-generated FAQ content with Together AI integration and visual verification**

## Performance

- **Duration:** 45 min (including AI FAQ implementation)
- **Started:** 2026-02-03T20:45:00Z
- **Completed:** 2026-02-03T21:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added AI-generated FAQ capability using Together AI (Llama 4 Maverick)
- Created `/api/admin/generate-faq` endpoint for triggering FAQ generation
- Added `faqContent` and `faqGeneratedAt` columns to matchContent table
- Added unique constraint on matchContent.matchId for upsert support
- Updated MatchFAQ component to accept optional `aiFaqs` prop with fallback
- Verified AI FAQs display correctly with match-specific content

## Task Commits

1. **Task 1: Update match page to pass FAQs** - `f0c605c` (fix) - from 29-03
2. **AI FAQ Implementation** - `9aa0d54` (feat) - full AI FAQ feature
3. **Schema fix** - `b677fd0` (fix) - unique constraint for upsert

## Files Created/Modified

- `src/app/api/admin/generate-faq/route.ts` - NEW: API endpoint for FAQ generation
- `src/lib/db/schema.ts` - Added faqContent/faqGeneratedAt columns, unique constraint
- `src/lib/content/match-content.ts` - Added generateFAQContent() and getMatchFAQContent()
- `src/components/match/match-faq.tsx` - Added aiFaqs prop with fallback
- `src/app/leagues/[slug]/[match]/page.tsx` - Fetches and passes AI FAQs

## Decisions Made

- AI FAQs use Together AI's Llama 4 Maverick model for consistency with other content
- FAQs stored as JSON array in matchContent table (same table as other narrative content)
- Graceful fallback: template FAQs display when AI content unavailable
- State-aware: different questions for finished vs upcoming matches

## Deviations from Plan

### Scope Extension

**AI FAQ Implementation**
- **Reason:** User feedback that template FAQs were "useless"
- **Action:** Implemented full AI FAQ generation pipeline
- **Impact:** Significant value-add, matches existing content generation patterns
- **Files added:** API route, content generation function, database columns

## Issues Encountered

1. **Environment variable corruption** - TOGETHER_API_KEY appended without newline
   - Fixed by properly editing .env.local

2. **Missing unique constraint** - onConflictDoUpdate failed without unique constraint on matchId
   - Fixed by adding unique constraint to schema and database

## User Setup Required

- `TOGETHER_API_KEY` must be set in `.env.local` for AI FAQ generation
- Without API key, template FAQs continue working as fallback

## Verification Results

- FAQ section renders with 5 questions in accordion format
- First item expanded by default (defaultValue={['item-0']})
- Multiple items can be open simultaneously (type="multiple")
- AI FAQs show actual match data: "Sunderland won 3-0", model names like "Cogito v2 109B MoE"
- JSON-LD @graph contains FAQPage with matching questions

---
*Phase: 29-faq-seo*
*Completed: 2026-02-03*
