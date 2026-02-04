# Phase 30: Layout Assembly - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Assemble state-aware match page layouts using components from Phases 26-29 (Hero, Narrative, Predictions, FAQ), then remove all deprecated match page components. The final layout is a single scrollable page with no tabs on any device.

</domain>

<decisions>
## Implementation Decisions

### Section ordering by state

**Upcoming matches:**
- Hero (VS display) + Preview Narrative + Predictions Table + FAQ
- All four sections, in order

**Live matches:**
- Hero (live score/minute) + Predictions Table + FAQ
- NO narrative during live play

**Finished matches:**
- Hero (final score) + Post-match Report + Predictions Table + FAQ
- All four sections, in order

**Empty section handling:**
- Show section heading even if no content
- Heading visible, content area empty/minimal

### Spacing & visual hierarchy

- Every section has a visible H2 heading ("Match Preview", "Predictions", "FAQ")
- Max-width container (~1200px), content centered
- Visual separation style: Claude's discretion (whitespace, dividers, or cards)
- Mobile vs desktop layout: Claude's discretion on responsive adaptations

### Deprecated code removal

- Aggressive cleanup: delete anything unused by new layout
- Full audit of components/match/ directory to identify all deprecated code
- Partially used components: extract used parts elsewhere, delete the file
- No preservation beyond git history — delete completely

### Loading states

- Full page skeleton layout while match data loads
- Skeleton shows placeholder shapes matching final layout
- Pulse animation (opacity fade in/out)
- Error state: show error message with retry button

### Claude's Discretion
- Visual separation between sections (whitespace, dividers, or cards)
- Mobile layout adaptations (same content, responsive widths)
- Exact skeleton component design
- Where to relocate extracted utility functions from deleted files

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing design system.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-layout-assembly*
*Context gathered: 2026-02-04*
