# Roadmap: v2.2 Match Page Rewrite

## Overview

Complete rewrite of match detail pages from scratch with clean layout, zero duplicate content, and SEO/GEO optimization. This milestone establishes a context-driven architecture where data flows from a single source, then delivers a hero component that renders score exactly once, content sections for narratives and predictions, FAQ with schema markup, and finally assembles state-aware layouts while removing deprecated code.

## Milestones

- v1.0 Bug Fix Stabilization - Phases 1-4 (shipped 2026-02-01)
- v1.1 Stats Accuracy & SEO - Phases 5-8 (shipped 2026-02-02)
- v1.2 Technical SEO Fixes - Phases 9-12 (shipped 2026-02-02)
- v1.3 Match Page Refresh - Phases 13-16 (shipped 2026-02-02)
- v2.0 UI/UX Overhaul - Phases 17-23 (shipped 2026-02-03)
- v2.1 Match Page Simplification - Phases 24-25 (shipped 2026-02-03)
- **v2.2 Match Page Rewrite** - Phases 26-30 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (26, 27, 28, 29, 30): Planned milestone work
- Decimal phases (27.1, 27.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 26: Context Foundation** - Establish single source of truth for match data
- [x] **Phase 27: Hero Component** - Single score render point eliminating duplication
- [ ] **Phase 28: Content Sections** - Narrative and predictions content display
- [ ] **Phase 29: FAQ & SEO** - Auto-generated FAQ with Schema.org integration
- [ ] **Phase 30: Layout Assembly** - State-aware layouts and deprecated code cleanup

## Phase Details

### Phase 26: Context Foundation
**Goal**: Establish data flow architecture where match data is fetched once and distributed via React Context
**Depends on**: Nothing (first phase of v2.2)
**Requirements**: ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. MatchDataProvider context exists and wraps match page content
  2. useMatch() hook returns normalized match data from context
  3. Match state (upcoming/live/finished) is derived once at page level
  4. No component fetches match data independently (verified by code review)
**Plans**: 2 plans

Plans:
- [x] 26-01-PLAN.md — Create MatchDataProvider component and useMatch hook
- [x] 26-02-PLAN.md — Integrate MatchDataProvider into match pages (matches/[id] and leagues/[slug]/[match])

### Phase 27: Hero Component
**Goal**: Create single authoritative score/VS display that renders match info exactly once
**Depends on**: Phase 26 (needs context for data)
**Requirements**: LAYT-02, CONT-01, CONT-07
**Success Criteria** (what must be TRUE):
  1. Score displays exactly once on the page (no duplicates in header, H1, or elsewhere)
  2. Match hero shows teams, competition, kickoff time correctly
  3. Live matches display current score and match minute
  4. Upcoming matches show "VS" instead of score
**Plans**: 2 plans

Plans:
- [x] 27-01-PLAN.md — Create MatchHero component with useLiveMatchMinute polling hook and API route
- [x] 27-02-PLAN.md — Visual verification of hero component across all match states

### Phase 28: Content Sections
**Goal**: Deliver narrative content and predictions table that render correctly based on match state
**Depends on**: Phase 27 (hero provides visual anchor)
**Requirements**: CONT-02, CONT-03, CONT-04, CONT-05
**Success Criteria** (what must be TRUE):
  1. Pre-match narrative renders only for upcoming matches
  2. Post-match narrative renders only for finished matches
  3. Predictions table displays all 35 models in sortable format
  4. Finished match predictions show actual result and points earned per model
**Plans**: 3 plans

Plans:
- [ ] 28-01-PLAN.md — Create MatchNarrative component with state-aware display
- [ ] 28-02-PLAN.md — Create SortablePredictionsTable with sorting and color-coded points
- [ ] 28-03-PLAN.md — Visual verification of content sections across all match states

### Phase 29: FAQ & SEO
**Goal**: Auto-generate FAQ from match data with proper Schema.org FAQPage markup
**Depends on**: Phase 28 (FAQ content derives from match data)
**Requirements**: CONT-06, SGEO-01, SGEO-02, SGEO-03, SGEO-04, SGEO-05
**Success Criteria** (what must be TRUE):
  1. FAQ section auto-generates 5-7 match-specific questions
  2. Single JSON-LD @graph contains both SportsEvent and FAQPage schemas
  3. FAQPage schema questions match visible FAQ section exactly
  4. eventStatus correctly maps to scheduled/live/finished/postponed/cancelled
  5. Content uses semantic H2/H3 headings with answer-first paragraph structure
**Plans**: TBD

Plans:
- [ ] 29-01: TBD

### Phase 30: Layout Assembly
**Goal**: Assemble state-aware layouts and remove all deprecated match page components
**Depends on**: Phase 29 (all components ready for assembly)
**Requirements**: LAYT-01, LAYT-03, LAYT-04, LAYT-05, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Match page renders as single scrollable page (no tabs on any device)
  2. Layout adapts correctly to match state (Upcoming/Live/Finished show different content)
  3. Sections follow order: Match Info -> Narrative -> Predictions -> FAQ
  4. Mobile layout identical to desktop (no hidden or collapsed content)
  5. Deprecated components removed (match-header.tsx, tab components, old layouts)
**Plans**: TBD

Plans:
- [ ] 30-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29 -> 30

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 26. Context Foundation | 2/2 | Complete | 2026-02-03 |
| 27. Hero Component | 2/2 | Complete | 2026-02-03 |
| 28. Content Sections | 0/3 | Ready to execute | - |
| 29. FAQ & SEO | 0/? | Not started | - |
| 30. Layout Assembly | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Milestone: v2.2 Match Page Rewrite*
*Requirements: 21 total, 100% mapped*
