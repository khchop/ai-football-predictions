---
phase: 47-structured-data-validation
plan: 03
subsystem: seo-schema
tags: [schema-org, json-ld, structured-data, seo, consolidation]
requires:
  - 47-01-root-schema-module
  - 47-02-sports-event-article-validation
provides:
  - page-level-schema-consolidation
  - no-duplicate-entities
  - single-graph-pattern
affects:
  - 47-04-validation-pass-extension
tech-stack:
  added: []
  patterns:
    - "@id cross-references for WebSite entity"
    - "Single @graph per page instead of multiple JSON-LD scripts"
    - "Strip @context from sub-schemas before adding to @graph"
key-files:
  created: []
  modified:
    - src/components/WebPageSchema.tsx
    - src/components/FaqSchema.tsx
    - src/components/SportsEventSchema.tsx
    - src/app/models/[id]/page.tsx
    - src/app/leaderboard/page.tsx
    - src/app/blog/[slug]/page.tsx
    - src/app/leagues/[slug]/page.tsx
key-decisions:
  - decision: "WebPageSchema component uses @id reference to WEBSITE_ID instead of inline WebSite object"
    rationale: "Eliminates duplicate WebSite entities on every page using the component (SCHEMA-01 compliance)"
    impact: "All pages now reference root WebSite via @id, no duplication"
  - decision: "FaqSchema requires minimum 2 FAQs to render (changed from 0)"
    rationale: "Google recommends minimum 2 questions for FAQ rich results eligibility"
    impact: "Better compliance with Google guidelines, prevents FAQ markup on single-question pages"
  - decision: "SportsEventSchema component marked as deprecated"
    rationale: "Superseded by MatchPageSchema.tsx which uses consolidated @graph pattern"
    impact: "Component kept for reference but not actively used in codebase"
  - decision: "Model, leaderboard, blog, and league pages consolidated to 1 JSON-LD script per page"
    rationale: "Reduces redundancy, improves schema maintainability, ensures single source of truth"
    impact: "Model page: 2→1 scripts, Leaderboard: 2→1, Blog: 2→1 (non-roundup), League: already 1 (fixed @context nesting)"
  - decision: "Strip @context from sub-schemas (FAQPage) before adding to @graph"
    rationale: "Nested @context inside @graph is invalid - @graph provides single @context at root"
    impact: "Valid schema.org JSON-LD structure, prevents validation errors"
duration: 214
completed: 2026-02-06
---

# Phase 47 Plan 03: Page-Level Schema Consolidation Summary

**One-liner:** Consolidated all page-level JSON-LD to single @graph patterns with @id references, eliminating duplicate Organization/WebSite entities across model, leaderboard, blog, and league pages.

## Performance

- **Duration:** 214 seconds (~3.6 minutes)
- **Started:** 2026-02-06T12:10:03Z
- **Completed:** 2026-02-06T12:13:37Z
- **Tasks completed:** 2/2
- **Files modified:** 7
- **Build status:** Passed (webpack fallback due to local Turbopack WASM limitation)

## What Was Accomplished

### Task 1: Updated Schema Components to Use @id References
- **WebPageSchema.tsx:** Import `WEBSITE_ID` from root schema module and use `{ "@id": WEBSITE_ID }` for `isPartOf` property instead of inline WebSite object with name/url
- **FaqSchema.tsx:** Changed guard from `faqs.length === 0` to `faqs.length < 2` per Google rich results recommendation
- **SportsEventSchema.tsx:** Added `@deprecated` JSDoc comment indicating superseded by MatchPageSchema with @graph pattern (component not imported anywhere in codebase)

**Impact:** WebPageSchema no longer renders duplicate WebSite entities. Every page using it now references root WebSite via @id.

### Task 2: Consolidated Page-Level JSON-LD
Reduced multiple separate JSON-LD script tags to single @graph per page:

**Model page (src/app/models/[id]/page.tsx):**
- **Before:** 2 separate scripts (BreadcrumbList @graph + WebPageSchema component)
- **After:** 1 consolidated @graph with WebPage (using WEBSITE_ID reference) and BreadcrumbList
- **Change:** Removed WebPageSchema component usage, built WebPage schema inline with @id reference

**Leaderboard page (src/app/leaderboard/page.tsx):**
- **Before:** 2 separate scripts (BreadcrumbList @graph + FAQPage schema inside LeaderboardContent)
- **After:** 1 consolidated @graph with BreadcrumbList and FAQPage (stripped @context)
- **Change:** Moved FAQ generation to parent, stripped @context before adding to @graph

**Blog page (src/app/blog/[slug]/page.tsx):**
- **Before:** 2 separate scripts for non-roundup posts (Article @graph + WebPageSchema component)
- **After:** 1 consolidated @graph (Article + BreadcrumbList already consolidated)
- **Change:** Removed WebPageSchema component usage (already had @graph consolidation)

**League page (src/app/leagues/[slug]/page.tsx):**
- **Before:** Already 1 script but nested @context inside @graph (invalid)
- **After:** 1 script with proper @graph (stripped @context from FAQPage before adding)
- **Change:** Strip @context from `generateFAQPageSchema()` result before adding to @graph

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 | 0be57d8 | refactor | update schema components to use @id references |
| 2 | 4724557 | feat | consolidate page-level JSON-LD to single @graph per page |

## Files Created

None (pure refactor of existing files).

## Files Modified

1. **src/components/WebPageSchema.tsx** - Import WEBSITE_ID, use @id reference for isPartOf
2. **src/components/FaqSchema.tsx** - Require minimum 2 FAQs (Google recommendation)
3. **src/components/SportsEventSchema.tsx** - Mark as deprecated
4. **src/app/models/[id]/page.tsx** - Consolidate to 1 JSON-LD script with WebPage + BreadcrumbList @graph
5. **src/app/leaderboard/page.tsx** - Consolidate to 1 JSON-LD script with BreadcrumbList + FAQPage @graph
6. **src/app/blog/[slug]/page.tsx** - Remove WebPageSchema component (already had @graph)
7. **src/app/leagues/[slug]/page.tsx** - Strip @context from FAQPage before adding to @graph

## Decisions Made

### Schema Component Refactoring
**Decision:** WebPageSchema uses @id reference to WEBSITE_ID instead of inline WebSite object.

**Context:** Every page using WebPageSchema was rendering a duplicate WebSite entity with `{"@type": "WebSite", "name": "kroam.xyz", "url": "https://kroam.xyz"}`. This violated SCHEMA-01 (no duplicate entities).

**Implementation:** Import `WEBSITE_ID` from `@/lib/seo/schema/root` and use `"isPartOf": { "@id": WEBSITE_ID }` instead of inline object.

**Validation:** `grep '"WebSite"' src/components/WebPageSchema.tsx` returns no matches after change.

### FAQ Rich Results Compliance
**Decision:** FaqSchema requires minimum 2 FAQs to render (changed threshold from 0 to 2).

**Rationale:** Google recommends minimum 2 questions for FAQ rich results eligibility. Single-question pages don't qualify for FAQ rich snippets.

**Implementation:** Changed guard from `if (!faqs || faqs.length === 0)` to `if (!faqs || faqs.length < 2)`.

### Page-Level Consolidation Pattern
**Decision:** All page types (model, leaderboard, blog, league) render single JSON-LD script with @graph containing multiple entities.

**Pattern established:**
1. Build all schema entities as separate objects (BreadcrumbList, WebPage, FAQPage, etc.)
2. Strip @context from sub-schemas generated by helper functions (e.g., `generateFAQPageSchema`)
3. Combine into single @graph with @context at root level
4. Render once via single `<script type="application/ld+json">`

**Benefits:**
- Single source of truth per page
- No duplicate entities
- Easier to maintain and validate
- Correct schema.org @graph structure (no nested @context)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

### Local Turbopack Build Failure (Non-blocking)
**Issue:** `npm run build` failed with `turbo.createProject is not supported by the wasm bindings` on local environment (macOS ARM64 without SWC native binary).

**Resolution:** Used `npx next build --webpack` as fallback - build succeeded. Production (Coolify/Nixpacks) uses native Turbopack binary and will build successfully.

**Impact:** None on production. Local verification used webpack fallback successfully.

## Validation Results

### Verification Checklist (All Passed)
- ✅ Build passes: `npx next build --webpack` succeeded
- ✅ Model page has 1 JSON-LD script (verified via grep)
- ✅ Leaderboard page has 1 JSON-LD script (verified via grep)
- ✅ Blog page has 1 JSON-LD script (verified via grep)
- ✅ League page has 1 JSON-LD script (verified via grep)
- ✅ No inline `"@type": "WebSite"` objects in any page (grep returned no matches)
- ✅ No inline `"@type": "Organization"` objects in any page (grep returned no matches)
- ✅ WebPageSchema component imports and uses WEBSITE_ID
- ✅ FaqSchema has `length < 2` guard

### SCHEMA-01 Compliance Status
**Before:** Model, leaderboard, and blog pages rendered duplicate WebSite entities via WebPageSchema component inline object.

**After:** All pages use `{ "@id": WEBSITE_ID }` reference. Root layout provides single WebSite entity, all pages reference it.

**Result:** SCHEMA-01 FULLY RESOLVED - No duplicate Organization or WebSite on any page.

### SCHEMA-04 BreadcrumbList Validation
All pages already had valid BreadcrumbList with `item` property on every position (including last). No changes required for this criterion.

## Next Phase Readiness

### For Phase 47-04 (Validation Pass Extension)
**Ready:** All page-level schemas consolidated with @id references. Build-time validation can now verify:
1. No page renders multiple JSON-LD scripts for the same entity type
2. All WebSite/Organization references use @id (not inline objects)
3. No nested @context inside @graph arrays

**Recommendation:** Extend Pass 5 (JSON-LD validation) to:
- Parse rendered HTML for JSON-LD scripts
- Count scripts per page (expect 2: 1 from root layout + 1 from page)
- Validate @graph structure (no nested @context, all @id references resolve)
- Check for duplicate entity definitions

### Platform Status After Completion
- 17 leagues operational
- 42 active models (29 Together + 13 Synthetic)
- All page types use consolidated @graph patterns
- Root schema module (ORGANIZATION_ID, WEBSITE_ID) used across all pages
- No duplicate Organization/WebSite entities site-wide

## Self-Check: PASSED

### Key Files Verification
All modified files exist:
- ✅ src/components/WebPageSchema.tsx
- ✅ src/components/FaqSchema.tsx
- ✅ src/components/SportsEventSchema.tsx
- ✅ src/app/models/[id]/page.tsx
- ✅ src/app/leaderboard/page.tsx
- ✅ src/app/blog/[slug]/page.tsx
- ✅ src/app/leagues/[slug]/page.tsx

### Commits Verification
All task commits exist:
- ✅ 0be57d8 (Task 1)
- ✅ 4724557 (Task 2)

---
*Phase 47 Plan 03 complete - Page-level schema consolidation with @id references successfully implemented across all page types*
