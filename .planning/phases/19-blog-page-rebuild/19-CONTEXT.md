# Phase 19: Blog Page Rebuild - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Blog posts readable and optimized for GEO with proper typography and navigation. Includes comfortable reading width, clear heading hierarchy, table of contents for long articles, FAQ section with schema, and related articles widget. Comment systems, social sharing, and newsletter signup are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Reading experience
- Max line width: 70-75 characters (~700px) for balanced readability
- Code blocks: Constrained to content width (700px), horizontal scroll if needed
- Images: Match content width (700px), never wider than text column
- Consistent visual container — code and images align with text

### Table of contents
- Position: Fixed sidebar on desktop, collapses to mobile-appropriate format
- Visibility trigger: Only show TOC for articles 500+ words
- Auto-generated from heading structure

### FAQ presentation
- Style: Accordion (collapsed) — questions visible, answers expand on click
- Position: After main content, before related articles widget
- Source: Auto-generated from content (extract questions from headings/content programmatically)

### Related articles
- Display: Card grid with 2-3 cards (visual cards with thumbnail, title, excerpt)
- Count: 3 articles target
- Fallback: Show what exists (1-2 if that's all available, don't hide section)

### Claude's Discretion
- Reading time estimate (show or not based on typical patterns)
- TOC scroll spy (active section highlighting)
- TOC heading depth (H2 only vs H2+H3)
- FAQ TL;DR question inclusion (based on GEO patterns)
- Related articles selection algorithm (tag-based, recency, hybrid)
- Paragraph spacing and font size scaling
- Mobile TOC collapse pattern (dropdown, bottom sheet, etc.)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-blog-page-rebuild*
*Context gathered: 2026-02-03*
