# Phase 18: Match Page Rebuild - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Match pages display content clearly without duplication, optimized for speed and AI citations. This includes:
- Pre-match AI narratives and prediction grids
- Post-match roundups and accuracy results
- Score deduplication (hero + sticky header only)
- PPR infrastructure for fast initial render
- GEO structure for AI search engine citations

Out of scope: Navigation changes (Phase 22), new content types, live match WebSocket updates.

</domain>

<decisions>
## Implementation Decisions

### Content Visibility
- Upcoming matches: AI narrative preview (150 words) + predictions grid visible above the fold
- "Read More" link jumps to full narrative section further down page (not inline expand)
- Finished matches: Final score + AI roundup summary (2-3 sentences) with link to full analysis
- Prediction explanations collapsed by default — show prediction scores only, expand on click

### Score Deduplication
- Score appears in two places: large in hero section, compact in sticky header
- Clear visual hierarchy — hero is primary, sticky is reference
- Remove score from all other sections (stats, roundup, etc.) — exactly two occurrences only
- Sticky header shows: team names + score + match status (Live 45', FT, Upcoming)
- Sticky header appears after hero section scrolls out of viewport

### GEO Structure
- Lead with TL;DR answer at top (1-2 sentence summary)
- TL;DR format: Claude's discretion based on match state (natural sentence or structured)
- Auto-generated FAQ section based on match data
- FAQ questions like "Who is predicted to win?", "What was the final score?"
- FAQ placement: bottom of page (supplementary for SEO, not primary UX)

### PPR Boundaries
- Static shell: Hero (teams, competition, nav) + skeleton placeholders
- Predictions and content stream in dynamically
- Loading skeletons: shimmer animation (modern pattern)
- Live match updates: Hybrid approach — ISR for initial load, client polling only when match status is 'Live'
- Suspense boundary optimization: Claude's discretion for optimal perceived load time

### Claude's Discretion
- TL;DR format (natural sentence vs structured template)
- Optimal Suspense boundaries for prediction grid
- Shimmer skeleton design details
- FAQ question selection and wording

</decisions>

<specifics>
## Specific Ideas

- Sticky header trigger: appears exactly when hero scrolls out (not always visible, not on scroll-up only)
- Deduplication is aggressive — if score appears anywhere outside hero/sticky, remove it
- FAQ is for SEO value, not primary user navigation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-match-page-rebuild*
*Context gathered: 2026-02-02*
