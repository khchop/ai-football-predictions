---
phase: 27-hero-component
plan: 01
subsystem: match-display
tags: [react, context, polling, hero-component, live-updates]
completed: 2026-02-03

requires:
  - 26-01: MatchDataProvider context foundation
  - 26-02: useMatch hook for context consumption

provides:
  - MatchHero component (single authoritative score/VS display)
  - useLiveMatchMinute hook (polling with cleanup and visibility detection)
  - match-minute API route (returns current minute for live matches)

affects:
  - 27-02: Match page layout integration (will use MatchHero)
  - Future match pages (MatchHero is canonical score display)

tech-stack:
  added: []
  patterns:
    - React polling with useRef (memory leak prevention)
    - Visibility API for resource-efficient polling
    - Context consumption via custom hooks

key-files:
  created:
    - src/components/match/match-hero.tsx
    - src/components/match/use-live-match-minute.ts
    - src/app/api/match-minute/[id]/route.ts
  modified: []

decisions:
  - id: HERO-001
    decision: "LIVE badge has NO animation (animate-none override)"
    rationale: "User explicitly rejected pulsing/animation - 'classic solid red, no pulsing/animation' per 27-CONTEXT.md"
    impact: "Badge component has animate-pulse on variant='live', but MatchHero overrides with className='animate-none'"

  - id: HERO-002
    decision: "Polling interval set to 30s (30000ms)"
    rationale: "User decision: 30-60s range, 30s balances freshness with API quota usage"
    impact: "Configurable via intervalMs parameter for future adjustment"

  - id: HERO-003
    decision: "Visibility detection pauses polling when tab hidden"
    rationale: "Save API quota and server resources - no value in polling data user can't see"
    impact: "Polling resumes when user returns to tab (automatic fresh fetch)"

duration: 2.5min
---

# Phase 27 Plan 01: Hero Component Summary

**One-liner:** Single authoritative MatchHero component with live minute polling via useRef-based hook and visibility detection

## Objective

Created the MatchHero component as the canonical score/VS display for match pages, consuming MatchDataProvider context and supporting all match states (upcoming/live/finished/postponed/cancelled) with appropriate visual treatment and live minute updates.

## What Was Delivered

### Core Components

1. **MatchHero Component** (`src/components/match/match-hero.tsx`)
   - Consumes MatchDataProvider context via useMatch() hook (no prop drilling)
   - Renders teams with logo + name on sides, score/VS centered and large
   - Supports all match states with explicit badges
   - Live matches show current minute from polling hook
   - Winner highlighting (green) for finished matches
   - Minimal design: no venue, no form, no league position (per user decisions)
   - **CRITICAL:** LIVE badge has NO animation (animate-none override per user decision)

2. **useLiveMatchMinute Hook** (`src/components/match/use-live-match-minute.ts`)
   - Polls match minute every 30s for live matches
   - Uses useRef for interval ID (prevents memory leaks)
   - Cleanup function clears interval on unmount
   - Visibility detection: pauses when tab hidden, resumes on visibility
   - Returns string | null (e.g., "67'", "HT", "90'+3")

3. **Match Minute API Route** (`src/app/api/match-minute/[id]/route.ts`)
   - Fetches fixture status from API-Football
   - Uses formatMatchMinute utility for consistent formatting
   - 30s cache revalidation (next: { revalidate: 30 })
   - Returns { minute: string | null } JSON response
   - Graceful error handling (returns null on failure)

## Implementation Decisions

### Visual Hierarchy
- Score/VS is visual anchor: text-5xl/6xl, centered, tabular-nums for digits
- Teams flank score: logo (h-20 w-20 md:h-24 w-24) + name below
- Meta row below: Competition • Date • Time/Minute • Status badge
- Live indicator bar: gradient red-to-orange, 1px height at top of hero

### State Handling
- **Upcoming:** "VS" text with gradient-text class, "Upcoming" badge
- **Live:** Score display, live minute (from polling), "LIVE" badge (NO animation)
- **Finished:** Score display, winner in green, "FT" badge
- **Halftime:** Score display, "HT" badge instead of "LIVE"
- **Postponed:** "POSTPONED" text replaces score, italic styling
- **Cancelled:** "CANCELLED" text replaces score, line-through + destructive color

### User Decision Compliance
From 27-CONTEXT.md:
- ✅ "Red 'LIVE' badge - classic solid red, no pulsing/animation" → animate-none override applied
- ✅ "No venue in hero - keep minimal" → No venue field
- ✅ "No form or league position in hero" → Not included
- ✅ "Always show match date for all states" → format(kickoff, 'MMMM d, yyyy')
- ✅ "Polling update for match minute - auto-refresh every 30-60 seconds" → 30s interval

## Verification Results

All verification checks passed:

```bash
✓ All files exist and compile
✓ MatchHero uses useMatch() (not props)
✓ Polling hook has cleanup (clearInterval in useEffect return)
✓ LIVE badge has NO animation (animate-none class applied)
```

## Technical Architecture

### Context Consumption Pattern
```typescript
// MatchHero consumes context (no prop drilling)
const { match, competition, matchState } = useMatch();
const liveMinute = useLiveMatchMinute(match.externalId, matchState === 'live');
```

### Polling Pattern
```typescript
// useRef prevents memory leaks, cleanup ensures interval cleared
const intervalRef = useRef<NodeJS.Timeout | null>(null);
useEffect(() => {
  intervalRef.current = setInterval(fetchMinute, intervalMs);
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [isLive, externalId, intervalMs]);
```

### Visibility Detection Pattern
```typescript
// Pause polling when tab hidden, resume when visible
useEffect(() => {
  function handleVisibilityChange() {
    if (document.hidden && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (!document.hidden && isLive && externalId) {
      // Resume with fresh fetch + interval
      fetchMinute();
      intervalRef.current = setInterval(fetchMinute, intervalMs);
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [isLive, externalId, intervalMs]);
```

## Deviations from Plan

None - plan executed exactly as written.

All tasks completed:
1. ✅ Created useLiveMatchMinute polling hook with cleanup and visibility detection
2. ✅ Created match-minute API route using formatMatchMinute utility
3. ✅ Created MatchHero component consuming context with all match states supported

## Dependencies & Integration

### Consumes
- MatchDataProvider context (from Phase 26)
- useMatch() hook (from Phase 26)
- Badge component (existing UI library)
- formatMatchMinute utility (existing API-Football module)

### Provides
- MatchHero component (single authoritative score display)
- useLiveMatchMinute hook (reusable polling pattern)
- /api/match-minute/[id] endpoint

### Integration Points
- MatchHero must be wrapped in MatchDataProvider (will throw if not)
- API route requires API_FOOTBALL_KEY environment variable
- Badge variant="live" has animate-pulse by default - MatchHero overrides with animate-none

## Next Phase Readiness

**Status:** ✅ Ready for Phase 27 Plan 02 (Match Page Layout Integration)

**What's needed:**
- Replace existing match-header.tsx with MatchHero in match page layouts
- Wrap MatchHero in MatchDataProvider on match pages
- Verify no duplicate score displays remain (header, H1, etc.)

**Known considerations:**
- MatchHero is client component ('use client') - cannot be used in pure SSR context
- Polling only activates when matchState === 'live' (no wasted API calls for upcoming/finished)
- Badge animation override (animate-none) is intentional per user decision - do not remove

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| f38fe6e | feat(27-01): add useLiveMatchMinute polling hook | use-live-match-minute.ts |
| 734a88a | feat(27-01): add match-minute API route | api/match-minute/[id]/route.ts |
| d5764f2 | feat(27-01): add MatchHero component | match-hero.tsx |

---

**Phase:** 27-hero-component
**Plan:** 01
**Completed:** 2026-02-03
**Duration:** 2.5 minutes
