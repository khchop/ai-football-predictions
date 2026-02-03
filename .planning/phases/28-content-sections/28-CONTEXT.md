# Phase 28: Content Sections - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver narrative content and predictions table that render correctly based on match state. Pre-match narrative for upcoming matches, post-match narrative for finished matches, predictions table displaying all 35 models with sortable columns, and finished match predictions showing actual result and points earned per model.

</domain>

<decisions>
## Implementation Decisions

### Narrative Presentation
- Same visual styling for pre-match and post-match narratives — content itself distinguishes context
- Always show full narrative (no truncation or "Read more")
- State-specific headings: "Match Preview" for upcoming, "Match Report" for finished
- Live matches show the pre-match narrative (keep preview visible during match)

### Predictions Table Layout
- Default sort by performance ranking (best-performing models at top)
- Columns: Model name, Prediction, Points (finished matches only)
- Scrollable table on mobile (all 35 rows visible via scroll)
- Sortable columns — users can click headers to re-sort

### State-Aware Content
- Upcoming matches: Show both narrative + predictions table (both required)
- Live matches: Show pre-match narrative + predictions table
- Finished matches: Narrative first ("Match Report"), then predictions table with results
- Missing narrative: Show placeholder message ("Analysis pending" or similar)

### Points & Results Display
- Header row in predictions table showing actual result for finished matches
- Visual highlight (green background) for models that got exact score
- Color-coded points: 4 pts green, 3 pts yellow, 2 pts orange, 0 pts gray
- Summary above or below table: "X models got exact score, Y got winner, Z got nothing"

### Claude's Discretion
- Exact placeholder message wording for missing narratives
- Table styling details (borders, row spacing, hover states)
- Summary placement and exact wording
- Typography and spacing within sections

</decisions>

<specifics>
## Specific Ideas

No specific product references — decisions above establish the implementation direction.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-content-sections*
*Context gathered: 2026-02-03*
