# Requirements: v2.2 Match Page Rewrite

**Defined:** 2026-02-03
**Core Value:** Match pages must be clean, readable, and optimized for AI citations with zero duplicate content.

## v2.2 Requirements

Requirements for match page rewrite. Each maps to roadmap phases.

### Layout

- [ ] **LAYT-01**: Match page renders as single scrollable page (no tabs on any device)
- [ ] **LAYT-02**: Score displays exactly once in a single hero section
- [ ] **LAYT-03**: Layout adapts to match state (Upcoming/Live/Finished)
- [ ] **LAYT-04**: Sections follow consistent order: Match Info -> Narrative -> Predictions -> FAQ
- [ ] **LAYT-05**: Mobile layout identical to desktop (no hidden/collapsed content)

### Content

- [ ] **CONT-01**: Match hero shows teams, competition, kickoff time, and score (if applicable)
- [ ] **CONT-02**: Pre-match narrative renders for upcoming matches
- [ ] **CONT-03**: Post-match narrative renders for finished matches
- [ ] **CONT-04**: Predictions table shows all 35 models in sortable format
- [ ] **CONT-05**: Finished match predictions table shows actual result and points earned
- [ ] **CONT-06**: FAQ section auto-generates 5-7 questions from match data
- [ ] **CONT-07**: Live match shows current score and match time

### SEO/GEO

- [ ] **SGEO-01**: Single consolidated JSON-LD @graph with SportsEvent + FAQPage
- [ ] **SGEO-02**: FAQPage schema contains same questions as visible FAQ section
- [ ] **SGEO-03**: eventStatus correctly maps to all states (scheduled/live/finished/postponed/cancelled)
- [ ] **SGEO-04**: Content uses semantic H2/H3 headings matching FAQ questions
- [ ] **SGEO-05**: Answer-first paragraph structure (key info in opening sentences)

### Architecture

- [ ] **ARCH-01**: Single MatchDataProvider context supplies data to all components
- [ ] **ARCH-02**: No component fetches match data independently (single source of truth)
- [ ] **ARCH-03**: Match state derived once at page level, passed via context
- [ ] **ARCH-04**: Deprecated components removed (match-header.tsx, tab components)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Tabs on mobile | User explicitly rejected; hides content from AI crawlers |
| Sticky header | Removed in v2.1; user prefers natural scroll |
| H2H section | Removed in v2.1; not core value |
| League standings | Removed in v2.1; clutters page |
| Multiple score displays | Primary problem to solve |
| Collapsible sections | Hides content from crawlers |
| Swipe gestures | Only needed for tabs, which are excluded |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 26 | Complete |
| ARCH-02 | Phase 26 | Complete |
| ARCH-03 | Phase 26 | Complete |
| LAYT-02 | Phase 27 | Pending |
| CONT-01 | Phase 27 | Pending |
| CONT-07 | Phase 27 | Pending |
| CONT-02 | Phase 28 | Pending |
| CONT-03 | Phase 28 | Pending |
| CONT-04 | Phase 28 | Pending |
| CONT-05 | Phase 28 | Pending |
| CONT-06 | Phase 29 | Pending |
| SGEO-01 | Phase 29 | Pending |
| SGEO-02 | Phase 29 | Pending |
| SGEO-03 | Phase 29 | Pending |
| SGEO-04 | Phase 29 | Pending |
| SGEO-05 | Phase 29 | Pending |
| LAYT-01 | Phase 30 | Pending |
| LAYT-03 | Phase 30 | Pending |
| LAYT-04 | Phase 30 | Pending |
| LAYT-05 | Phase 30 | Pending |
| ARCH-04 | Phase 30 | Pending |

**Coverage:**
- v2.2 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after roadmap creation*
