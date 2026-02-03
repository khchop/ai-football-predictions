# Roadmap: AI Football Predictions Platform

## Milestones

- v1.0 Bug Fix Stabilization - Phases 1-4 (shipped 2026-02-01)
- v1.1 Stats Accuracy & SEO - Phases 5-8 (shipped 2026-02-02)
- v1.2 Technical SEO Fixes - Phases 9-12 (shipped 2026-02-02)
- v1.3 Match Page Refresh - Phases 13-16 (shipped 2026-02-02)
- v2.0 UI/UX Overhaul - Phases 17-23 (shipped 2026-02-03)
- **v2.1 Match Page Simplification** - Phases 24-25 (in progress)

## Overview

v2.1 simplifies the match detail page by removing the sticky header, mobile tabs, and unused sections (H2H, standings) while fixing HTML rendering issues in narrative content. Two phases: one for layout/filtering changes (all touch the same page), one for content rendering fixes (different scope).

## Phases

**Phase Numbering:**
- Continues from v2.0 (phases 17-23)
- v2.1 phases: 24-25

- [ ] **Phase 24: Match Page Cleanup** - Remove sticky header, tabs, and hidden sections
- [ ] **Phase 25: Content Rendering Fix** - Strip HTML tags from narrative content

## Phase Details

### Phase 24: Match Page Cleanup
**Goal**: Match page displays as a single scrollable page with unified layout order and no empty/hidden sections
**Depends on**: Phase 23 (v2.0 completion)
**Requirements**: LAYT-01, LAYT-02, LAYT-03, FILT-01, FILT-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):
  1. User scrolls the entire match page naturally without sticky header repositioning
  2. Mobile and desktop users see the same single-column layout (no tab navigation)
  3. Content appears in order: Score, Scorers/Goals, Odds, Pre-match, Prediction, Post-match, Predictions Table, FAQ
  4. H2H and league standings sections are not visible on any match page
  5. Sections with no data are completely hidden (no "unavailable" placeholders)
**Plans**: 2 plans

Plans:
- [ ] 24-01-PLAN.md — Remove sticky header and mobile tabbed navigation
- [ ] 24-02-PLAN.md — Unify layout order and filter unused sections

### Phase 25: Content Rendering Fix
**Goal**: Narrative content displays as clean formatted text without visible HTML tags
**Depends on**: Phase 24
**Requirements**: QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Pre-match, prediction, and post-match narratives display formatted text without raw HTML tags
  2. Database content is clean (no HTML fragments in stored narrative text)
**Plans**: TBD (determined during planning)

Plans:
- [ ] 25-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 24 -> 25

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 24. Match Page Cleanup | v2.1 | 0/2 | Planning complete | - |
| 25. Content Rendering Fix | v2.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-03*
