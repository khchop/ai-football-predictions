# Phase 17: Design System Foundation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish design tokens, component patterns, and infrastructure for all subsequent visual work. This phase creates the foundation (color tokens, typography scale, dark mode, View Transitions, PPR infrastructure) that Phases 18-23 will use. No page rebuilds in this phase — just the system they depend on.

</domain>

<decisions>
## Implementation Decisions

### Color tokens & match states
- Neutral gray palette for base theme — clean, professional, let data colors pop
- Traditional green/red/amber for match outcomes (win/loss/draw) — universally understood
- Accuracy percentages use gradient color scale: red (low) → amber (mid) → green (high)

### Typography scale
- System fonts (-apple-system, Segoe UI, etc.) — fast loading, native feel
- Balanced type scale using 1.2 ratio — good for mixed content/data
- 16px base font size on mobile — browser default, accessible

### Dark mode behavior
- Default to system preference (prefers-color-scheme detection)
- Theme choice persists in localStorage across sessions
- Instant switch, no animation on theme toggle

### View Transitions
- Crossfade style for page transitions — simple, universally understood
- Snappy 150ms duration — quick and efficient
- Disable transitions entirely for prefers-reduced-motion users
- No fallback for unsupported browsers — instant navigation instead

### Claude's Discretion
- Dark mode color adjustments for semantic colors (WCAG contrast compliance)
- Dark mode toggle placement (based on mobile navigation structure from Phase 22)
- Number styling per context (tabular figures for tables, proportional for prose)

</decisions>

<specifics>
## Specific Ideas

No specific product references mentioned — standard approaches are appropriate.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-design-system-foundation*
*Context gathered: 2026-02-02*
