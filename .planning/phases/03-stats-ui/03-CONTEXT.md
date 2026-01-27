# Phase 3: Stats UI - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Leaderboard pages with sortable tables, filtering UI, and responsive design. Users can view model rankings, filter by season/competition/club, and compare models. Creating the underlying API (Phase 2) is complete — this phase builds the UI on top.

</domain>

<decisions>
## Implementation Decisions

### Table Layout & Density
- Compact density — more rows visible, minimal padding
- Essential columns by default: Rank, Model Name, Total Points, Win Rate
- Additional stats accessible via link to model detail page (/models/{id})
- Show rank position changes (↑3 or ↓2 arrows) — requires tracking previous positions

### Filter Panel Design
- Top bar layout on desktop — horizontal row of dropdowns above the table
- Mobile: collapsible bottom sheet triggered by "Filters" button
- Filter changes apply immediately (no Apply button)
- Active filters shown as removable chips below the filter bar

### Loading & Empty States
- Skeleton rows while loading — gray animated placeholders matching table structure
- Zero results: "No models match your filters" with clear filters button
- Initial empty: "Leaderboard will populate as models make predictions"
- Subtle overlay (dim + small spinner) when filters change after initial load

### Sorting & Interaction
- Default sort: Win rate (descending) — emphasizes prediction accuracy
- Sortable columns indicated on hover, click to sort
- Checkbox selection on rows for model comparison
- "Compare selected" opens side-by-side modal with full stats in columns

### Claude's Discretion
- Exact skeleton row count and animation style
- Spacing and typography specifics
- Error state handling for API failures
- Compare modal layout details
- Column header styling

</decisions>

<specifics>
## Specific Ideas

- Rank changes imply need to track/compare to previous snapshot (could be yesterday, last week, or based on filter change)
- Compare modal should show all stats that aren't in the default table view
- Filter chips pattern similar to e-commerce sites (tag with × to remove)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-stats-ui*
*Context gathered: 2026-01-27*
