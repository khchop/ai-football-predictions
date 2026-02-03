# Phase 27: Hero Component - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Create single authoritative score/VS display that renders match info exactly once. Eliminates duplicate score displays in header, H1, or elsewhere. Hero shows teams, competition, kickoff time, and handles all match states (upcoming/live/finished/postponed/cancelled).

</domain>

<decisions>
## Implementation Decisions

### Visual hierarchy
- Score/VS centered as visual anchor — teams on left/right, score large and centered
- Team identity: Logo + full name (team badge with full team name)
- Competition and kickoff time appear below the hero (teams/score first)
- No form or league position in hero — keep it clean

### State presentation
- Upcoming shows "VS" text, finished shows actual score — minimal other visual differences
- Explicit status badges for ALL states: "LIVE", "FT", "Upcoming"
- Halftime shows "HT" badge instead of "LIVE"
- Postponed/cancelled: replace score with status text ("POSTPONED", "CANCELLED")

### Information density
- No venue in hero — keep minimal, venue belongs elsewhere
- Always show match date for all states (upcoming, live, finished)
- Clean/minimal background — solid or subtle gradient, focus on content

### Live indicators
- Red "LIVE" badge — classic solid red, no pulsing/animation
- Match minute replaces kickoff time slot during live matches
- Polling update for match minute — auto-refresh every 30-60 seconds
- No animation on score changes — score just updates

### Claude's Discretion
- Whether to include a small prediction consensus indicator (if it fits without cluttering)
- Exact polling interval for live updates
- Spacing and typography details

</decisions>

<specifics>
## Specific Ideas

- Layout: Team [logo+name] — Score/VS (large, centered) — Team [logo+name]
- Meta row below: Competition • Date/Time
- Live matches: LIVE badge (red) + current minute where time normally appears

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-hero-component*
*Context gathered: 2026-02-03*
