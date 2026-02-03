# Phase 27: Hero Component - Research

**Researched:** 2026-02-03
**Domain:** React match hero component with live updates and state management
**Confidence:** HIGH

## Summary

Hero components for match displays follow established design patterns: centered score/VS as visual anchor, team identity (logo + name) on sides, competition and timing metadata below. The key technical challenge is managing multiple match states (upcoming/live/finished/postponed/cancelled/halftime) with appropriate visual treatment for each.

For live updates, React polling with useEffect cleanup is the standard pattern. Polling intervals of 30-60 seconds balance server load with real-time feel for sports scores (WebSockets are overkill for minute-granularity updates). The pattern uses useRef for interval IDs, cleanup functions to prevent memory leaks, and visibility detection to pause when tab is hidden.

The existing codebase already has MatchDataProvider (Phase 26) providing match state via Context, status badge variants in the UI component library, and CSS utility classes for match states. The hero component can consume this via useMatch() hook, avoiding prop drilling while maintaining SSR compatibility.

**Primary recommendation:** Create client component MatchHero that consumes MatchDataProvider context, uses existing Badge variants for status display, and implements useEffect polling for live match minute updates. Keep component minimal per user decisions - no venue, no form, no league position.

## Standard Stack

The established libraries/tools for match hero components:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context API | React 19.2 (built-in) | Match data distribution from provider | Already implemented in Phase 26 (MatchDataProvider) |
| Next.js Image | 15+ (built-in) | Team logo optimization | Built-in, automatic WebP conversion, responsive sizing |
| date-fns | 4.1.0+ | Date/time formatting | Already in codebase, comprehensive formatting patterns |
| Tailwind CSS | 3.4+ | Styling utilities | Already configured with custom match state classes |
| shadcn/ui Badge | Latest | Status badges | Already in codebase with match state variants |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Latest | Icons (Trophy, Calendar, Clock) | Already in codebase for consistent iconography |
| class-variance-authority | Latest | Badge variant management | Already used in Badge component |
| next-themes | 0.4.6 | Dark mode support | Already in codebase, reference pattern for Context providers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling | WebSockets | WebSockets better for sub-second updates, but overkill for match minute (updates every ~60s) |
| Polling | Server-Sent Events (SSE) | Better for one-way server push, but adds complexity for simple periodic checks |
| date-fns | day.js | Smaller bundle but date-fns already in codebase and more comprehensive |
| Custom hook | react-polling library | Library adds dependency, custom useEffect pattern is 15 lines and sufficient |

**Installation:**
```bash
# No new dependencies required
# All needed libraries already in project:
# - react (19.2) - Context, useEffect, useMemo, useRef
# - next (15+) - Image component
# - date-fns (4.1.0+) - format, parseISO
# - lucide-react - icons
# - shadcn/ui Badge component
```

## Architecture Patterns

### Recommended Component Structure
```
src/components/match/
├── match-data-provider.tsx       # Existing - Context provider (Phase 26)
├── use-match.ts                  # Existing - Hook to consume context
├── match-hero.tsx                # NEW - Hero component (this phase)
└── use-live-match-minute.ts      # NEW - Custom hook for polling
```

### Pattern 1: Hero Component Consuming Context

**What:** Client component that consumes MatchDataProvider context for match data, renders centered score/VS with teams on sides.

**When to use:** Single authoritative score display at top of match page, replaces duplicate header components.

**Example:**
```typescript
// src/components/match/match-hero.tsx
'use client';

import { useMatch } from './use-match';
import { useLiveMatchMinute } from './use-live-match-minute';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';

export function MatchHero() {
  const { match, competition, matchState } = useMatch();
  const liveMinute = useLiveMatchMinute(match.externalId, matchState === 'live');
  const kickoff = parseISO(match.kickoffTime);

  return (
    <section className="bg-card border-border border rounded-xl p-6">
      {/* Teams + Score/VS */}
      <div className="flex items-center justify-between gap-8">
        {/* Home Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.homeTeamLogo && (
              <Image
                src={match.homeTeamLogo}
                alt={`${match.homeTeam} logo`}
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            )}
          </div>
          <p className="font-bold text-lg">{match.homeTeam}</p>
        </div>

        {/* Score/VS - Large centered */}
        <div className="text-center">
          {matchState === 'upcoming' ? (
            <p className="text-5xl font-bold gradient-text">VS</p>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-6xl font-bold tabular-nums">
                {match.homeScore}
              </span>
              <span className="text-3xl text-muted-foreground">-</span>
              <span className="text-6xl font-bold tabular-nums">
                {match.awayScore}
              </span>
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.awayTeamLogo && (
              <Image
                src={match.awayTeamLogo}
                alt={`${match.awayTeam} logo`}
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            )}
          </div>
          <p className="font-bold text-lg">{match.awayTeam}</p>
        </div>
      </div>

      {/* Meta Row: Competition • Date/Time */}
      <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border/50">
        <Badge variant="outline">{competition.name}</Badge>
        <span className="text-muted-foreground">•</span>
        <span className="text-sm text-muted-foreground">
          {format(kickoff, 'MMMM d, yyyy')}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-sm text-muted-foreground">
          {matchState === 'live' ? liveMinute : format(kickoff, 'HH:mm')}
        </span>
        <Badge variant={matchState}>{getStatusLabel(matchState, match.status)}</Badge>
      </div>
    </section>
  );
}
```

**Source:** Derived from existing match-header.tsx pattern + Phase 27 user decisions

### Pattern 2: Live Match Minute Polling

**What:** Custom hook that polls for live match minute using useEffect + useRef, cleans up on unmount, pauses when tab hidden.

**When to use:** Live matches that need to display current minute (e.g., "67'", "HT", "90'+2").

**Example:**
```typescript
// src/components/match/use-live-match-minute.ts
'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Poll for live match minute every 30 seconds.
 * Automatically pauses when page hidden to save resources.
 */
export function useLiveMatchMinute(
  externalId: string | null,
  isLive: boolean,
  intervalMs: number = 30000
): string | null {
  const [minute, setMinute] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only poll if match is live and has external ID
    if (!isLive || !externalId) {
      setMinute(null);
      return;
    }

    // Fetch match minute from API
    async function fetchMinute() {
      try {
        const res = await fetch(`/api/match-minute/${externalId}`);
        if (res.ok) {
          const data = await res.json();
          setMinute(data.minute); // e.g., "67'", "HT", "90'+3"
        }
      } catch (error) {
        console.error('Failed to fetch match minute:', error);
      }
    }

    // Initial fetch
    fetchMinute();

    // Set up polling interval
    intervalRef.current = setInterval(fetchMinute, intervalMs);

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, externalId, intervalMs]);

  // Pause polling when page hidden
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (!document.hidden && isLive && externalId) {
        // Resume polling when page visible again
        intervalRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/match-minute/${externalId}`);
            if (res.ok) {
              const data = await res.json();
              setMinute(data.minute);
            }
          } catch (error) {
            console.error('Failed to fetch match minute:', error);
          }
        }, intervalMs);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, externalId, intervalMs]);

  return minute;
}
```

**Source:** [Implementing Polling in React](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7) + [Best Practices for Implementing React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling)

### Pattern 3: Match State Badge Display

**What:** Use existing Badge component with match state variants to display status (LIVE, FT, Upcoming, HT, Postponed, Cancelled).

**When to use:** Always - every match state requires explicit status badge per user decisions.

**Example:**
```typescript
// Mapping match status to badge variant and label
function getStatusBadge(matchState: 'upcoming' | 'live' | 'finished', status: string, minute: string | null) {
  // Halftime special case
  if (status === 'live' && minute === 'HT') {
    return <Badge variant="live">HT</Badge>;
  }

  // Standard states
  if (matchState === 'live') {
    return <Badge variant="live">LIVE</Badge>;
  }

  if (matchState === 'finished') {
    return <Badge variant="finished">FT</Badge>;
  }

  if (matchState === 'upcoming') {
    return <Badge variant="upcoming">Upcoming</Badge>;
  }

  // Special statuses (postponed/cancelled)
  if (status === 'postponed') {
    return <Badge variant="postponed">Postponed</Badge>;
  }

  if (status === 'cancelled') {
    return <Badge variant="cancelled">Cancelled</Badge>;
  }

  return null;
}
```

**Source:** Existing match-badge.tsx component + Phase 27 user decisions

### Pattern 4: Image Optimization for Team Logos

**What:** Use Next.js Image component with priority prop, explicit dimensions, and descriptive alt text.

**When to use:** Always for team logos in hero (above-the-fold critical images).

**Example:**
```typescript
<Image
  src={match.homeTeamLogo}
  alt={`${match.homeTeam} logo`}
  width={64}
  height={64}
  className="object-contain"
  priority  // Load immediately (above-the-fold)
/>
```

**Source:** [Next.js Image Optimization Best Practices](https://nextjs.org/docs/app/api-reference/components/image)

### Anti-Patterns to Avoid

- **Deriving matchState in component:** Already derived in MatchDataProvider, use from context
- **Passing match props down tree:** Use Context via useMatch() hook, not prop drilling
- **No polling cleanup:** Always return cleanup function from useEffect to prevent memory leaks
- **Polling when tab hidden:** Check document.visibilityState, pause polling to save resources
- **Inline date formatting:** Extract to utility function, format patterns should be consistent
- **Hardcoded status labels:** Map status values to labels in utility function for maintainability

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status badges | Custom span with conditional classes | shadcn/ui Badge with variants | Already has live/upcoming/finished/postponed/cancelled variants configured |
| Match minute polling | Manual setInterval/clearInterval | Custom useEffect hook with useRef | Prevents memory leaks, handles cleanup, visibility detection |
| Date formatting | new Date().toLocaleString() | date-fns format() | Consistent patterns, already in codebase, more reliable |
| Team logo optimization | img tag with src | Next.js Image component | Automatic WebP conversion, responsive sizing, lazy loading (except priority) |
| Match data access | Props from parent | useMatch() hook consuming Context | Single source of truth, no prop drilling, type-safe |
| Live score updates | Manual fetch in component | Polling hook with visibility detection | Reusable, prevents duplicate polling, resource-efficient |

**Key insight:** The codebase already has 90% of what's needed (Context provider, Badge variants, Image optimization, date-fns). The hero component is primarily composition of existing patterns, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Polling Without Cleanup Causes Memory Leaks

**What goes wrong:** setInterval continues running after component unmounts, accumulating background processes that fetch data nobody sees.

**Why it happens:** Forgot to return cleanup function from useEffect, or stored interval ID in component state instead of useRef.

**How to avoid:** Always use useRef for interval ID, always return cleanup function that calls clearInterval.

**Warning signs:**
- Network tab shows repeated API calls after navigating away from page
- Browser becomes sluggish after visiting multiple match pages
- React DevTools shows unmounted components still triggering effects

**Example:**
```typescript
// ❌ WRONG - No cleanup, memory leak
function useLiveMinute(id: string) {
  const [minute, setMinute] = useState(null);

  useEffect(() => {
    setInterval(() => {
      fetch(`/api/minute/${id}`).then(r => r.json()).then(setMinute);
    }, 30000);
    // No cleanup! Interval keeps running after unmount
  }, [id]);

  return minute;
}

// ✅ CORRECT - Cleanup function clears interval
function useLiveMinute(id: string) {
  const [minute, setMinute] = useState(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetch(`/api/minute/${id}`).then(r => r.json()).then(setMinute);
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [id]);

  return minute;
}
```

**Source:** [React useEffect cleanups](https://tasoskakour.com/blog/react-use-effect-cleanups/) + [Making setInterval Declarative with React Hooks](https://overreacted.io/making-setinterval-declarative-with-react-hooks/)

### Pitfall 2: Polling When Tab Hidden Wastes Server Resources

**What goes wrong:** Polling continues at full rate even when user switches tabs, wasting API quota and server resources for data nobody sees.

**Why it happens:** No visibility detection, polling runs regardless of whether page is visible.

**How to avoid:** Listen to visibilitychange event, pause polling when document.hidden is true.

**Warning signs:**
- API quota exhausted faster than expected
- Server load remains high even when users aren't actively viewing pages
- Battery drain on mobile devices

**Example:**
```typescript
// ❌ WRONG - Polls even when tab hidden
useEffect(() => {
  const interval = setInterval(fetchData, 30000);
  return () => clearInterval(interval);
}, []);

// ✅ CORRECT - Pauses when tab hidden
useEffect(() => {
  function handleVisibilityChange() {
    if (document.hidden) {
      // Pause polling
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      // Resume polling
      intervalRef.current = setInterval(fetchData, 30000);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

**Source:** [Best Practices for Implementing React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling)

### Pitfall 3: Not Using Priority for Above-Fold Images

**What goes wrong:** Team logos in hero load lazily (default Next.js Image behavior), causing layout shift and poor LCP score.

**Why it happens:** Forgot to add priority prop to images that are above the fold.

**How to avoid:** Add priority prop to all hero images (team logos), they're always visible immediately.

**Warning signs:**
- Layout shift when logos load
- Poor Lighthouse LCP score
- Flash of empty logo containers on initial page load

**Example:**
```typescript
// ❌ WRONG - Lazy loads hero logos
<Image
  src={match.homeTeamLogo}
  alt={`${match.homeTeam} logo`}
  width={64}
  height={64}
/>

// ✅ CORRECT - Priority loads immediately
<Image
  src={match.homeTeamLogo}
  alt={`${match.homeTeam} logo`}
  width={64}
  height={64}
  priority  // Hero images always above fold
/>
```

**Source:** [Next.js Image Optimization Best Practices](https://nextjs.org/docs/app/api-reference/components/image)

### Pitfall 4: Hardcoded Match State Logic in Multiple Places

**What goes wrong:** Status badge logic duplicated across components, logic drift causes inconsistent labels (one component says "FT", another says "Finished").

**Why it happens:** Each component implements its own status-to-label mapping instead of using centralized utility.

**How to avoid:** Extract status mapping to utility function, import and use everywhere.

**Warning signs:**
- Same match shows "FT" in one place, "Full Time" in another
- Adding new status (e.g., "Postponed") requires updating 5+ files
- Conditional logic for status repeated in multiple components

**Example:**
```typescript
// ❌ WRONG - Logic duplicated in component
function MatchHero() {
  const { match } = useMatch();
  const label = match.status === 'live' ? 'LIVE' : match.status === 'finished' ? 'FT' : 'Upcoming';
  return <Badge>{label}</Badge>;
}

// ✅ CORRECT - Centralized utility
// src/lib/match-utils.ts
export function getMatchStatusLabel(status: string, minute?: string): string {
  if (minute === 'HT') return 'HT';
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'FT';
  if (status === 'postponed') return 'POSTPONED';
  if (status === 'cancelled') return 'CANCELLED';
  return 'Upcoming';
}

// Component uses utility
function MatchHero() {
  const { match } = useMatch();
  const label = getMatchStatusLabel(match.status);
  return <Badge>{label}</Badge>;
}
```

**Source:** Pattern derived from existing codebase structure

### Pitfall 5: Forgetting to Handle Postponed/Cancelled States

**What goes wrong:** Hero shows "0-0" score for postponed/cancelled matches instead of status text, confusing users.

**Why it happens:** Only handled upcoming/live/finished states, forgot edge cases.

**How to avoid:** Check for postponed/cancelled status first, replace score display with status text.

**Warning signs:**
- Postponed matches show "0-0" score
- Cancelled matches render normally instead of showing cancellation
- Users confused about whether match happened

**Example:**
```typescript
// ❌ WRONG - No special handling for postponed/cancelled
{matchState === 'upcoming' ? 'VS' : `${match.homeScore}-${match.awayScore}`}

// ✅ CORRECT - Handle all states
{match.status === 'postponed' ? (
  <p className="text-2xl text-muted-foreground italic">POSTPONED</p>
) : match.status === 'cancelled' ? (
  <p className="text-2xl text-destructive line-through">CANCELLED</p>
) : matchState === 'upcoming' ? (
  <p className="text-5xl font-bold">VS</p>
) : (
  <div className="flex gap-4">
    <span className="text-6xl font-bold">{match.homeScore}</span>
    <span className="text-3xl">-</span>
    <span className="text-6xl font-bold">{match.awayScore}</span>
  </div>
)}
```

**Source:** Existing match-badge.tsx + Phase 27 user decisions

## Code Examples

Verified patterns from official sources and existing codebase:

### Example 1: Complete Match Hero Component

```typescript
// src/components/match/match-hero.tsx
'use client';

import { useMatch } from './use-match';
import { useLiveMatchMinute } from './use-live-match-minute';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function MatchHero() {
  const { match, competition, matchState } = useMatch();
  const liveMinute = useLiveMatchMinute(match.externalId, matchState === 'live');
  const kickoff = parseISO(match.kickoffTime);

  // Determine if match is special status
  const isPostponed = match.status === 'postponed';
  const isCancelled = match.status === 'cancelled';
  const isHalftime = liveMinute === 'HT';

  return (
    <section className="bg-card border-border border rounded-xl p-6 md:p-8">
      {/* Live indicator bar */}
      {matchState === 'live' && (
        <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500 -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8 md:mb-8" />
      )}

      {/* Teams + Score/VS */}
      <div className="flex items-center justify-between gap-4 md:gap-8">
        {/* Home Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.homeTeamLogo ? (
              <Image
                src={match.homeTeamLogo}
                alt={`${match.homeTeam} logo`}
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {match.homeTeam.charAt(0)}
              </span>
            )}
          </div>
          <p className={cn(
            "font-bold text-lg md:text-xl",
            matchState === 'finished' && match.homeScore !== null && match.awayScore !== null &&
            match.homeScore > match.awayScore && "text-green-400"
          )}>
            {match.homeTeam}
          </p>
        </div>

        {/* Score/VS - Large centered */}
        <div className="text-center px-4 md:px-8">
          {isPostponed ? (
            <p className="text-2xl md:text-3xl text-muted-foreground italic">POSTPONED</p>
          ) : isCancelled ? (
            <p className="text-2xl md:text-3xl text-destructive line-through">CANCELLED</p>
          ) : matchState === 'upcoming' ? (
            <p className="text-4xl md:text-5xl font-bold gradient-text">VS</p>
          ) : (
            <div className="flex items-center gap-3 md:gap-4">
              <span className={cn(
                "text-5xl md:text-6xl font-bold tabular-nums",
                matchState === 'finished' && match.homeScore !== null && match.awayScore !== null &&
                match.homeScore > match.awayScore && "text-green-400"
              )}>
                {match.homeScore ?? 0}
              </span>
              <span className="text-3xl text-muted-foreground">-</span>
              <span className={cn(
                "text-5xl md:text-6xl font-bold tabular-nums",
                matchState === 'finished' && match.homeScore !== null && match.awayScore !== null &&
                match.awayScore > match.homeScore && "text-green-400"
              )}>
                {match.awayScore ?? 0}
              </span>
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center">
          <div className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl bg-muted/50 flex items-center justify-center">
            {match.awayTeamLogo ? (
              <Image
                src={match.awayTeamLogo}
                alt={`${match.awayTeam} logo`}
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {match.awayTeam.charAt(0)}
              </span>
            )}
          </div>
          <p className={cn(
            "font-bold text-lg md:text-xl",
            matchState === 'finished' && match.homeScore !== null && match.awayScore !== null &&
            match.awayScore > match.homeScore && "text-green-400"
          )}>
            {match.awayTeam}
          </p>
        </div>
      </div>

      {/* Meta Row: Competition • Date • Time/Minute • Status */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-6 border-t border-border/50 text-sm">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-medium">{competition.name}</span>
        </div>

        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {format(kickoff, 'MMMM d, yyyy')}
        </span>

        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {matchState === 'live' && liveMinute ? liveMinute : format(kickoff, 'HH:mm')}
        </span>

        {/* Status Badge */}
        <Badge variant={isHalftime ? 'live' : matchState}>
          {isHalftime ? 'HT' :
           matchState === 'live' ? 'LIVE' :
           matchState === 'finished' ? 'FT' :
           isPostponed ? 'POSTPONED' :
           isCancelled ? 'CANCELLED' :
           'Upcoming'}
        </Badge>
      </div>
    </section>
  );
}
```

**Source:** Derived from existing match-header.tsx + Phase 27 CONTEXT.md decisions

### Example 2: Live Match Minute Polling Hook

```typescript
// src/components/match/use-live-match-minute.ts
'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Poll for live match minute every 30 seconds.
 *
 * Features:
 * - Automatically pauses when page hidden to save resources
 * - Cleanup on unmount prevents memory leaks
 * - Only polls when match is live and has external ID
 *
 * @param externalId - API-Football fixture ID
 * @param isLive - Whether match is currently live
 * @param intervalMs - Polling interval (default 30000ms = 30s)
 * @returns Current match minute (e.g., "67'", "HT", "90'+3") or null
 */
export function useLiveMatchMinute(
  externalId: string | null,
  isLive: boolean,
  intervalMs: number = 30000
): string | null {
  const [minute, setMinute] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only poll if match is live and has external ID
    if (!isLive || !externalId) {
      setMinute(null);
      return;
    }

    // Fetch match minute from API
    async function fetchMinute() {
      try {
        const res = await fetch(`/api/match-minute/${externalId}`);
        if (res.ok) {
          const data = await res.json();
          setMinute(data.minute); // e.g., "67'", "HT", "90'+3"
        }
      } catch (error) {
        console.error('Failed to fetch match minute:', error);
      }
    }

    // Initial fetch
    fetchMinute();

    // Set up polling interval
    intervalRef.current = setInterval(fetchMinute, intervalMs);

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, externalId, intervalMs]);

  // Pause polling when page hidden
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (!document.hidden && isLive && externalId) {
        // Resume polling when page visible again
        intervalRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/match-minute/${externalId}`);
            if (res.ok) {
              const data = await res.json();
              setMinute(data.minute);
            }
          } catch (error) {
            console.error('Failed to fetch match minute:', error);
          }
        }, intervalMs);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, externalId, intervalMs]);

  return minute;
}
```

**Source:** [Implementing Polling in React](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7) + [Best Practices for React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling)

### Example 3: Match Minute API Route

```typescript
// src/app/api/match-minute/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMatchEvents } from '@/lib/football/api-football';
import { formatMatchMinute } from '@/lib/football/api-football';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch fixture status from API-Football
    const events = await getMatchEvents(parseInt(id, 10));

    // Extract status from first event or fetch separately
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${id}`,
      {
        headers: {
          'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
        next: { revalidate: 30 }, // Cache for 30 seconds
      }
    );

    const data = await res.json();
    const fixture = data.response[0];

    if (!fixture) {
      return NextResponse.json({ minute: null }, { status: 404 });
    }

    // Format minute using existing utility
    const minute = formatMatchMinute(fixture.fixture.status);

    return NextResponse.json({ minute }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Failed to fetch match minute:', error);
    return NextResponse.json({ minute: null }, { status: 500 });
  }
}
```

**Source:** Existing API-Football integration patterns + Next.js App Router API routes

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple score displays (header + H1 + hero) | Single hero component as authoritative source | Phase 27 decision (2026-02-03) | Eliminates duplicate score rendering, single source of truth |
| Prop drilling match data 5+ levels | Context API via useMatch() hook | Phase 26 (2026-02-03) | Cleaner component tree, type-safe access |
| WebSockets for all live updates | Polling for minute-granularity updates | Current standard (2024+) | Simpler infrastructure, sufficient for sports scores that update ~60s |
| Manual status badge styling | shadcn/ui Badge with CVA variants | Implemented (v2.0) | Consistent styling, theme-aware, accessible |
| Inline date formatting | date-fns format() with patterns | Project standard | Consistent formatting, i18n-ready, maintainable |
| img tags for logos | Next.js Image component | Next.js 13+ (2023) | Automatic optimization, WebP conversion, responsive |

**Deprecated/outdated:**
- **Multiple score displays**: Phase 27 explicitly eliminates duplicate rendering - hero is now single source
- **Prop drilling for match data**: MatchDataProvider (Phase 26) replaced prop threading pattern
- **Hardcoded status labels**: Badge variants handle all match states consistently

## Open Questions

Things that couldn't be fully resolved:

1. **Exact polling interval for live matches**
   - What we know: User decisions say 30-60 seconds, best practices suggest 30s balances freshness and load
   - What's unclear: Whether 30s feels "live enough" or if 45s would be better
   - Recommendation: Start with 30s (intervalMs param is configurable), adjust based on API quota usage and user feedback

2. **Whether to include prediction consensus indicator**
   - What we know: User marked as "Claude's discretion - if it fits without cluttering"
   - What's unclear: What constitutes "cluttering" - is single badge too much?
   - Recommendation: Defer to later phase, keep Phase 27 minimal per "clean/minimal background" decision

3. **Halftime vs live status display**
   - What we know: User wants "HT" badge instead of "LIVE" during halftime, API-Football provides HT status
   - What's unclear: Whether to show both HT badge AND live indicator bar, or replace live bar with neutral
   - Recommendation: Show HT badge but keep red live indicator bar (match is still in progress, just paused)

4. **API-Football minute format edge cases**
   - What we know: formatMatchMinute utility exists, handles HT/FT/AET/PEN cases
   - What's unclear: All possible status values from API-Football (docs incomplete)
   - Recommendation: Use existing formatMatchMinute utility, log unknown statuses for investigation

## Sources

### Primary (HIGH confidence)
- [React Official Docs - useEffect](https://react.dev/reference/react/useEffect) - Cleanup patterns for intervals
- [Next.js Image Component Docs](https://nextjs.org/docs/app/api-reference/components/image) - Priority prop, optimization
- [date-fns format Documentation](https://date-fns.org/docs/format) - Date formatting patterns
- Existing codebase (match-header.tsx, match-data-provider.tsx, badge.tsx) - Established patterns

### Secondary (MEDIUM confidence)
- [Implementing Polling in React](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7) - Polling patterns with cleanup
- [Best Practices for Implementing React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling) - Visibility detection, resource management
- [React useEffect cleanups](https://tasoskakour.com/blog/react-use-effect-cleanups/) - Memory leak prevention
- [Making setInterval Declarative with React Hooks](https://overreacted.io/making-setinterval-declarative-with-react-hooks/) - Dan Abramov's canonical pattern
- [Next.js Image Optimization](https://www.debugbear.com/blog/nextjs-image-optimization) - Performance best practices

### Tertiary (LOW confidence)
- [Hero Section Design Trends 2026](https://www.perfectafternoon.com/2025/hero-section-design/) - General hero design principles (not sports-specific)
- [Event Badge Design Trends](https://badgego.com/event-badge-design-trends/) - Badge design trends (not UI component patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in codebase, patterns verified in existing components
- Architecture: HIGH - Based on Phase 26 MatchDataProvider foundation and existing match-header.tsx patterns
- Pitfalls: HIGH - Polling cleanup is well-documented React pattern, verified with multiple sources
- Hero design patterns: MEDIUM - User decisions provide clear guidance, but "cluttering" threshold subjective
- Polling interval: MEDIUM - 30-60s is standard for sports scores, but optimal value project-specific

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable React patterns, existing codebase structure unlikely to change)
