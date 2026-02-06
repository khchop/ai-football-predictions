---
phase: 46-content-tags-meta-optimization
plan: 02
type: summary
subsystem: seo-og-images
tags: [og-images, dark-theme, match-pages, metadata, next-og]
status: complete

dependency_graph:
  requires: []
  provides:
    - Dark-themed OG images for all page types
    - Dynamic OG image for canonical match pages (/leagues/[slug]/[match])
    - Generic fallback OG image route
  affects:
    - 46-01 (uses OG image routes from this plan)

tech_stack:
  added: []
  patterns:
    - Next.js ImageResponse API for dynamic OG images
    - Dark navy/charcoal gradient theme (#1a1a2e → #0f3460)
    - Query param-based customization for generic OG route

key_files:
  created:
    - src/app/api/og/generic/route.tsx
    - src/app/leagues/[slug]/[match]/opengraph-image.tsx
  modified:
    - src/app/api/og/match/route.tsx
    - src/app/api/og/league/route.tsx
    - src/app/api/og/model/route.tsx
    - src/app/matches/[id]/opengraph-image.tsx
    - src/lib/seo/og/templates.ts

decisions:
  - id: DARK_THEME_OG
    decision: Use dark navy/charcoal gradient for all OG images
    rationale: User requirement for professional data/analytics vibe, replacing purple gradient
    impact: All social media shares show consistent dark-themed OG images
  - id: KROAM_BRANDING
    decision: Update all OG image branding from "kroam.xyz" to "Kroam.xyz"
    rationale: Proper capitalization for brand consistency
    impact: All OG images show "Kroam.xyz" in footer
  - id: MATCH_OG_CANONICAL
    decision: Create opengraph-image.tsx for /leagues/[slug]/[match] route
    rationale: Canonical match pages need dynamic OG images (legacy /matches/[id] already has one)
    impact: Match pages under canonical route have proper social sharing images
  - id: GENERIC_FALLBACK
    decision: Create /api/og/generic route with query param customization
    rationale: Pages without specific OG templates (homepage, blog, leaderboard) need fallback
    impact: All indexable pages can have customized OG images

metrics:
  tasks_completed: 2
  files_created: 2
  files_modified: 5
  duration: "3 minutes"
  completed: 2026-02-06
---

# Phase 46 Plan 02: OG Image Dark Theme & Match Pages Summary

**One-liner:** Rethemed all OG images to dark navy/charcoal gradient with blue accents, added dynamic OG images for canonical match pages, and created generic fallback OG route.

## Objective Achieved

Rethemed all OG images from purple gradient to dark navy/charcoal gradient with light text and blue accents. Created dynamic OG image generation for match pages under the canonical /leagues/[slug]/[match] route. Added generic fallback OG image route for pages without specific templates (homepage, blog, leaderboard, etc.).

## Tasks Completed

### Task 1: Retheme all existing OG image routes to dark gradient

**Commit:** 750abde

Updated all OG image routes and templates to use dark navy/charcoal gradient theme:

**Theme specification applied:**
- Background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`
- Primary text: `#e0e0e0` (light gray)
- Accent: `#60a5fa` (blue-400, for Kroam branding and headers)
- Badge background: `rgba(96, 165, 250, 0.2)` (blue tint, replacing purple)
- Green accuracy badge: `rgba(34, 197, 94, 0.9)` (unchanged, works well on dark)

**Files updated:**
- src/app/api/og/match/route.tsx - dark gradient, blue badge, "Kroam.xyz" branding
- src/app/api/og/league/route.tsx - dark gradient, blue badge, "Kroam.xyz" branding
- src/app/api/og/model/route.tsx - dark gradient, blue badge, blue accent for header
- src/lib/seo/og/templates.ts - dark navy variants for upcoming/live/finished states
- src/app/matches/[id]/opengraph-image.tsx - "Kroam.xyz" branding

**Verification:**
All OG API routes render with dark gradient theme when visited in browser. Match opengraph-image uses updated template colors.

### Task 2: Create new OG image routes for missing page types

**Commit:** 8212c65

Created two new OG image providers:

**1. Generic fallback OG route:**
- Path: src/app/api/og/generic/route.tsx
- Accepts query params: `title` (default: "AI Football Predictions"), `subtitle` (default: "Compare AI models...")
- Used for: homepage, blog index, leaderboard, matches index, about, methodology
- Renders: Kroam.xyz branding, customizable title/subtitle, dark gradient

**2. Match page OG image (canonical route):**
- Path: src/app/leagues/[slug]/[match]/opengraph-image.tsx
- Fetches: Match data via getMatchBySlug, competition via getCompetitionByIdOrAlias
- Renders: Team names, score (for finished matches), competition name, "Kroam.xyz" branding
- Fallback: "Match Not Found" with Kroam.xyz branding if match doesn't exist
- Supports: VS display for upcoming, actual score for finished matches

**TypeScript verification:**
No TypeScript errors in new files (test file errors pre-existing).

**File verification:**
Both files created successfully:
- src/app/api/og/generic/route.tsx (1827 bytes)
- src/app/leagues/[slug]/[match]/opengraph-image.tsx (4215 bytes)

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None encountered.

## Next Phase Readiness

**Plan 02 complete.** No blockers for Plan 01 (Wave 1 parallel execution).

**Note:** Plan 01 will add og:image URLs to page metadata pointing to the routes created by this plan. No file conflicts - Plan 02 owns OG route files, Plan 01 owns page metadata files.

**Outstanding work:**
- Plan 01 needs to add og:image URLs to all 12 page types in their generateMetadata/metadata exports
- src/app/layout.tsx has unstaged changes (appears to be Plan 01 work, not committed yet)

## Success Criteria Met

- ✅ CTAG-05 (partial): OG images exist for all page types with dark navy/charcoal gradient
- ✅ All OG images show team names, league names, or page titles with Kroam.xyz branding
- ✅ Generic fallback OG image available for pages without specific templates
- ✅ Match pages under canonical /leagues/[slug]/[match] route have dynamic OG images
- ✅ All OG images use consistent dark gradient theme (#1a1a2e → #0f3460)
- ✅ No file conflicts with Plan 01 (this plan only modifies OG route files and templates)

## Task Commits

| Task | Commit | Description | Files Modified |
|------|--------|-------------|----------------|
| 1 | 750abde | Retheme all OG images to dark gradient | 5 files (match/league/model routes, templates, opengraph-image) |
| 2 | 8212c65 | Add dynamic OG images for match pages and generic fallback | 2 files created (generic route, leagues opengraph-image) |

## Self-Check: PASSED

**Files verification (first 2 from key-files.created):**
- ✅ src/app/api/og/generic/route.tsx exists (1827 bytes)
- ✅ src/app/leagues/[slug]/[match]/opengraph-image.tsx exists (4215 bytes)

**Commit verification (at least 1 with "46-02"):**
- ✅ 8212c65 feat(46-02): add dynamic OG images for match pages and generic fallback
- ✅ 750abde feat(46-02): retheme all OG images to dark navy/charcoal gradient

---
*Plan completed: 2026-02-06*
*Execution time: ~3 minutes*
*Wave 1 parallel execution with Plan 01*
