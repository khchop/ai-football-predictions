# Phase 26: Context Foundation - Research

**Researched:** 2026-02-03
**Domain:** React Context API with Next.js 16 App Router
**Confidence:** HIGH

## Summary

React Context API is the standard pattern for sharing data across component trees without prop drilling. In Next.js App Router, Context providers must be Client Components marked with `"use client"`, but can wrap Server Components through the children pattern. For match data distribution, Context is ideal because match data is relatively static (fetched once per page), infrequently changing (no rapid updates like animations), and environment-level (scoped to a single match page).

The established pattern is: fetch data in Server Components (page.tsx), pass as props to a Client Component Context Provider, and distribute via useContext hook to child components. This avoids hydration mismatches while maintaining SSR benefits.

React 19.2's compiler automatically optimizes many memoization patterns, but Context values containing objects still require useMemo/useCallback to prevent unnecessary re-renders. The key insight: Context automatically re-renders ALL consumers when value changes, so object identity matters.

**Primary recommendation:** Create MatchDataProvider as Client Component, fetch match data in page.tsx (Server Component), pass data as props to provider, memoize context value with useMemo.

## Standard Stack

The established libraries/tools for React Context data providers:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context API | React 19.2 (built-in) | State distribution across component tree | Native React solution, zero dependencies, SSR-compatible |
| next-themes | 0.4.6 | Reference pattern for Context in Next.js | Already in codebase, demonstrates "use client" + children pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-error-boundary | 6.1.0 | Error boundary wrapper for Context providers | Already in codebase, pattern for wrapping providers |
| React DevTools | Latest | Verify memoization (Memo sparkle emoji badge) | Development-time verification of compiler optimizations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Context API | Zustand | Better for high-frequency updates, but match data is static |
| Context API | Redux Toolkit | Better for complex state logic, but overkill for single data source |
| Context API | TanStack Query | Better for server state sync, but adds complexity for SSR hydration |
| Context API | Prop drilling | Simpler but couples components and requires threading props through 5+ levels |

**Installation:**
```bash
# No installation required - React Context API is built-in
# Existing dependencies already include patterns:
# - next-themes@0.4.6 (Context provider pattern reference)
# - react-error-boundary@6.1.0 (Provider wrapping pattern)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── matches/[id]/
│   │   └── page.tsx              # Server Component - fetches data
│   └── leagues/[slug]/[match]/
│       └── page.tsx              # Server Component - fetches data
├── components/
│   ├── match/
│   │   ├── match-data-provider.tsx   # Client Component - Context provider
│   │   └── use-match.ts              # Hook - useContext wrapper
│   └── providers.tsx             # Existing pattern reference
```

### Pattern 1: Server Component Data Fetch + Client Context Provider

**What:** Fetch data in Server Component (page.tsx), pass as props to Client Component Context Provider, children remain Server Components.

**When to use:** When you need to distribute server-fetched data to deeply nested client components without prop drilling.

**Example:**
```typescript
// src/app/matches/[id]/page.tsx (Server Component)
import { MatchDataProvider } from '@/components/match/match-data-provider';
import { getMatchWithAnalysis } from '@/lib/db/queries';

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition, analysis } = result;

  return (
    <MatchDataProvider
      match={match}
      competition={competition}
      analysis={analysis}
    >
      {/* These children remain Server Components */}
      <MatchHeader />
      <MatchOddsPanel />
      <PredictionsSection />
    </MatchDataProvider>
  );
}
```

**Source:** [Next.js Official Docs - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Pattern 2: Memoized Context Value (Object Identity)

**What:** Wrap Context value object with useMemo to prevent unnecessary re-renders caused by new object creation on every render.

**When to use:** Always when Context value is an object (not a primitive). React uses referential equality (===) to detect Context changes.

**Example:**
```typescript
// src/components/match/match-data-provider.tsx
'use client';

import { createContext, useMemo } from 'react';
import type { Match, Competition, MatchAnalysis } from '@/types';

interface MatchContextValue {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  matchState: 'upcoming' | 'live' | 'finished';
}

const MatchContext = createContext<MatchContextValue | null>(null);

interface MatchDataProviderProps {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  children: React.ReactNode;
}

export function MatchDataProvider({
  match,
  competition,
  analysis,
  children
}: MatchDataProviderProps) {
  // Derive match state once
  const matchState = useMemo(() => {
    if (match.status === 'finished') return 'finished';
    if (match.status === 'live') return 'live';
    return 'upcoming';
  }, [match.status]);

  // Memoize context value to prevent unnecessary re-renders
  // Dependencies: only re-create if actual data changes
  const contextValue = useMemo<MatchContextValue>(() => ({
    match,
    competition,
    analysis,
    matchState,
  }), [match, competition, analysis, matchState]);

  return (
    <MatchContext value={contextValue}>
      {children}
    </MatchContext>
  );
}
```

**Source:** [React Official Docs - useContext Performance](https://react.dev/reference/react/useContext)

### Pattern 3: Custom Hook Wrapper (Type Safety + Null Check)

**What:** Wrap useContext in a custom hook that enforces non-null context and provides better error messages.

**When to use:** Always - prevents runtime null errors and improves DX.

**Example:**
```typescript
// src/components/match/use-match.ts
import { useContext } from 'react';
import { MatchContext } from './match-data-provider';

export function useMatch() {
  const context = useContext(MatchContext);

  if (!context) {
    throw new Error(
      'useMatch must be used within MatchDataProvider. ' +
      'Make sure your component is wrapped with <MatchDataProvider>.'
    );
  }

  return context;
}
```

**Source:** [React Official Docs - useContext Best Practices](https://react.dev/reference/react/useContext)

### Pattern 4: Provider Depth Optimization

**What:** Render providers as deep as possible in the component tree, not at root layout.

**When to use:** Always - allows Next.js to optimize static parts of Server Components.

**Example:**
```typescript
// ✅ CORRECT - Provider at page level
// src/app/matches/[id]/page.tsx
export default async function MatchPage() {
  const data = await fetchData();
  return (
    <MatchDataProvider data={data}>
      <MatchContent />
    </MatchDataProvider>
  );
}

// ❌ WRONG - Provider at root layout
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MatchDataProvider> {/* Too high in tree */}
          {children}
        </MatchDataProvider>
      </body>
    </html>
  );
}
```

**Source:** [Next.js Official Docs - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Anti-Patterns to Avoid

- **Creating Context value inline:** `<Context value={{ data }}>` creates new object every render, triggers re-renders
- **Splitting unrelated data into one Context:** Changes to any field re-render all consumers
- **Using Context for high-frequency updates:** Context re-renders ALL consumers; use local state or Zustand for rapid changes
- **Not memoizing derived values:** Derive matchState in provider, not in every consumer component
- **Provider in Server Component:** `createContext()` throws error in Server Components; must be Client Component

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe Context | Manual type assertions in every component | Custom hook wrapper (useMatch) with non-null assertion | Official React pattern, prevents runtime errors, better DX |
| Provider error boundaries | try/catch around Context creation | react-error-boundary (already in codebase) | Handles async errors, provides reset functionality, already integrated |
| Re-render optimization | Manual shouldComponentUpdate logic | useMemo for Context value + React 19 Compiler | React Compiler auto-optimizes in React 19, useMemo handles object identity |
| Nested provider composition | Custom wrapper combining multiple providers | Existing Providers pattern in src/app/providers.tsx | Already established pattern in codebase (ThemeProvider) |

**Key insight:** React Context's re-render behavior (ALL consumers update) is by design. Don't try to build "selective Context updates" - split into multiple Contexts instead.

## Common Pitfalls

### Pitfall 1: Context Value Object Identity Causes Unnecessary Re-renders

**What goes wrong:** Creating a new object literal on every render causes all Context consumers to re-render, even if data hasn't changed.

**Why it happens:** React uses referential equality (===) to detect Context changes. New object reference = Context changed.

**How to avoid:** Wrap Context value with useMemo, dependencies should be the actual data values.

**Warning signs:**
- Components re-render when unrelated data changes
- React DevTools shows re-renders on every parent update
- Performance issues with many Context consumers

**Example:**
```typescript
// ❌ WRONG - New object every render
function MatchDataProvider({ match, children }) {
  return (
    <MatchContext value={{ match }}>  // New object reference every time
      {children}
    </MatchContext>
  );
}

// ✅ CORRECT - Memoized value
function MatchDataProvider({ match, children }) {
  const value = useMemo(() => ({ match }), [match]);
  return (
    <MatchContext value={value}>
      {children}
    </MatchContext>
  );
}
```

**Source:** [Optimizing React Context for Performance](https://www.tenxdeveloper.com/blog/optimizing-react-context-performance)

### Pitfall 2: Provider Not in Component Tree (Runtime Error)

**What goes wrong:** useContext returns null if no provider exists in parent tree, causing "Cannot read property of null" errors.

**Why it happens:** Forgot to wrap component, provider rendered in wrong location, or component outside provider scope.

**How to avoid:** Always use custom hook wrapper (useMatch) that throws descriptive error if context is null.

**Warning signs:**
- Runtime error: "Cannot read property 'match' of null"
- React DevTools shows no provider in component tree
- Hook called in component at same level as provider (not as child)

**Example:**
```typescript
// ❌ WRONG - No error checking
export function useMatch() {
  const context = useContext(MatchContext);
  return context; // Could be null!
}

// ✅ CORRECT - Throws descriptive error
export function useMatch() {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within MatchDataProvider');
  }
  return context;
}
```

**Source:** [React Official Docs - useContext Troubleshooting](https://react.dev/reference/react/useContext)

### Pitfall 3: Using Context in Server Component

**What goes wrong:** Next.js throws build-time error: "createContext only works in Client Components".

**Why it happens:** Server Components don't support Context API - they render once on server with no re-render lifecycle.

**How to avoid:** Mark Context provider file with `"use client"` directive at top. Server Components can RENDER providers (as children), but cannot CREATE or CONSUME Context.

**Warning signs:**
- Build error about createContext in Server Component
- `"use client"` directive missing from provider file
- Trying to useContext in a Server Component

**Example:**
```typescript
// ❌ WRONG - Server Component using Context
// src/components/match/match-provider.tsx
import { createContext } from 'react'; // Error!

// ✅ CORRECT - Client Component with directive
// src/components/match/match-provider.tsx
'use client';

import { createContext } from 'react';
```

**Source:** [Next.js Error - createContext in Server Component](https://nextjs.org/docs/messages/context-in-server-component)

### Pitfall 4: Monolithic Context with Unrelated Data

**What goes wrong:** Putting all match page data in one Context causes components to re-render when they don't need to (e.g., theme settings change triggers match data consumers to re-render).

**Why it happens:** Context re-renders ALL consumers when value changes, regardless of which field changed.

**How to avoid:** Split contexts by update frequency and concern. Match data (static), live score updates (dynamic), and user preferences (separate) should be different Contexts.

**Warning signs:**
- Components re-render for unrelated data changes
- Context value has 10+ properties
- Context mixing data and actions (getters and setters)

**Example:**
```typescript
// ❌ WRONG - Monolithic context
const PageContext = createContext({
  match: matchData,
  user: userData,
  theme: themeData,
  liveScore: scoreData, // Rapid updates
});

// ✅ CORRECT - Split by concern and update frequency
const MatchDataContext = createContext(matchData);    // Static
const UserPrefsContext = createContext(userData);     // Rare updates
const LiveScoreContext = createContext(scoreData);    // Frequent updates
```

**Source:** [Pitfalls of Overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/)

### Pitfall 5: Deriving State in Every Consumer Instead of Provider

**What goes wrong:** Each component that uses Context derives the same computed values (like matchState), wasting CPU cycles and causing inconsistent derived state.

**Why it happens:** Putting raw data in Context and letting consumers compute what they need seems flexible, but duplicates work.

**How to avoid:** Derive values ONCE in the provider, include them in Context value. Consumers get pre-computed values.

**Warning signs:**
- Multiple components have identical useMemo calculations
- Same derived value computed in 5+ places
- Logic drift between components computing "same" value

**Example:**
```typescript
// ❌ WRONG - Derive in every consumer
function MatchHeader() {
  const { match } = useMatch();
  const isFinished = match.status === 'finished'; // Computed every time
  const isLive = match.status === 'live';        // Duplicated logic
}

function MatchOdds() {
  const { match } = useMatch();
  const isFinished = match.status === 'finished'; // Same computation
}

// ✅ CORRECT - Derive once in provider
function MatchDataProvider({ match, children }) {
  const matchState = useMemo(() => {
    if (match.status === 'finished') return 'finished';
    if (match.status === 'live') return 'live';
    return 'upcoming';
  }, [match.status]);

  const value = useMemo(() => ({
    match,
    matchState, // Pre-computed, consistent everywhere
  }), [match, matchState]);

  return <MatchContext value={value}>{children}</MatchContext>;
}
```

**Source:** [Common Mistakes with React Context](https://greenonsoftware.com/articles/react/common-mistakes-in-using-react-context-api/)

## Code Examples

Verified patterns from official sources:

### Example 1: Complete MatchDataProvider Implementation

```typescript
// src/components/match/match-data-provider.tsx
'use client';

import { createContext, useMemo } from 'react';
import type { Match, Competition, MatchAnalysis } from '@/types';

// 1. Define Context value type
interface MatchContextValue {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  matchState: 'upcoming' | 'live' | 'finished';
}

// 2. Create Context with null default (checked by hook)
export const MatchContext = createContext<MatchContextValue | null>(null);

// 3. Provider props interface
interface MatchDataProviderProps {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  children: React.ReactNode;
}

// 4. Provider component
export function MatchDataProvider({
  match,
  competition,
  analysis,
  children
}: MatchDataProviderProps) {
  // Derive match state once (single source of truth)
  const matchState = useMemo<'upcoming' | 'live' | 'finished'>(() => {
    if (match.status === 'finished') return 'finished';
    if (match.status === 'live') return 'live';
    return 'upcoming';
  }, [match.status]);

  // Memoize entire context value (prevent re-renders on object identity)
  const contextValue = useMemo<MatchContextValue>(() => ({
    match,
    competition,
    analysis,
    matchState,
  }), [match, competition, analysis, matchState]);

  return (
    <MatchContext value={contextValue}>
      {children}
    </MatchContext>
  );
}
```

**Source:** [React Official Docs - useContext](https://react.dev/reference/react/useContext)

### Example 2: Type-Safe Custom Hook

```typescript
// src/components/match/use-match.ts
import { useContext } from 'react';
import { MatchContext } from './match-data-provider';

/**
 * Hook to access match data from MatchDataProvider.
 *
 * @throws {Error} If used outside MatchDataProvider
 * @returns Match context value (guaranteed non-null)
 */
export function useMatch() {
  const context = useContext(MatchContext);

  if (!context) {
    throw new Error(
      'useMatch must be used within MatchDataProvider. ' +
      'Ensure your component is wrapped with <MatchDataProvider>.'
    );
  }

  return context;
}
```

**Source:** [React Official Docs - useContext Best Practices](https://react.dev/reference/react/useContext)

### Example 3: Server Component Integration

```typescript
// src/app/matches/[id]/page.tsx (Server Component)
import { notFound } from 'next/navigation';
import { MatchDataProvider } from '@/components/match/match-data-provider';
import { MatchHeader } from '@/components/match/match-header';
import { getMatchWithAnalysis } from '@/lib/db/queries';

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  // 1. Fetch data in Server Component (SSR)
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition, analysis } = result;

  // 2. Pass data to Client Component provider via props
  // 3. Children can be Server Components (they render before provider hydrates)
  return (
    <MatchDataProvider
      match={match}
      competition={competition}
      analysis={analysis}
    >
      {/* These remain Server Components */}
      <MatchHeader />
      <MatchOddsPanel />
      <PredictionsSection matchId={id} />
    </MatchDataProvider>
  );
}
```

**Source:** [Next.js Official Docs - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Example 4: Consumer Component Using Hook

```typescript
// src/components/match/match-header.tsx
'use client';

import { useMatch } from './use-match';

export function MatchHeader() {
  // Access match data from Context
  const { match, competition, matchState } = useMatch();

  return (
    <header>
      <h1>{match.homeTeam} vs {match.awayTeam}</h1>
      <p>{competition.name}</p>
      <span className={matchState === 'live' ? 'text-red-500' : ''}>
        {matchState.toUpperCase()}
      </span>
    </header>
  );
}
```

**Source:** Pattern derived from [React Official Docs](https://react.dev/reference/react/useContext)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prop drilling through 5+ components | React Context API | React 16.3 (2018) | Standard pattern for environment-level data |
| Manual memoization with React.memo everywhere | React 19 Compiler auto-memoization | React 19 (2024) | Reduced need for manual useMemo/useCallback in most cases |
| useContext returns undefined when no provider | Custom hook with error throw | Community best practice (2020+) | Better DX, clearer error messages |
| Context + useReducer for all state | Context for static, Zustand for dynamic | 2022-2023 pattern shift | Right tool for right job - Context not for high-frequency updates |
| Provider at root layout (_app.js) | Provider deep in tree (page level) | Next.js 13 App Router (2023) | Better RSC optimization, smaller client bundles |

**Deprecated/outdated:**
- **Redux for all global state**: Context API + hooks replaced Redux for simple global state (2019+). Redux Toolkit still valid for complex multi-team apps.
- **Context with class components**: Functional components + useContext replaced Consumer pattern (2019+)
- **Manual Context splitting hacks**: React 18 concurrent rendering made Context more efficient, less need for elaborate splitting (2022+)

## Open Questions

Things that couldn't be fully resolved:

1. **React 19 Compiler effectiveness with Context**
   - What we know: Compiler auto-optimizes many patterns, but "Context is still going to be a pain" per community feedback
   - What's unclear: Exact scenarios where compiler helps vs. doesn't help with Context re-renders
   - Recommendation: Use useMemo for Context values regardless of compiler - explicit is better than implicit, zero downside

2. **Server Component children inside Client Component providers**
   - What we know: Next.js docs say children can remain Server Components when passed to Client Component providers
   - What's unclear: Edge cases where this breaks (async Server Components? Suspense boundaries?)
   - Recommendation: Test with actual match components, expect it to work based on official docs, but verify with React DevTools

3. **Optimal Context splitting strategy**
   - What we know: Split by update frequency and concern
   - What's unclear: Exact threshold - is 3 properties too many? 5? 10?
   - Recommendation: For Phase 26, single MatchDataContext is sufficient (all data static). Split later if live score updates added.

## Sources

### Primary (HIGH confidence)
- [Next.js Official Docs - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Context provider pattern with App Router
- [React Official Docs - useContext](https://react.dev/reference/react/useContext) - Performance optimization, memoization patterns
- [Next.js Error Docs - createContext in Server Component](https://nextjs.org/docs/messages/context-in-server-component) - Server/Client Component boundaries
- [Vercel KB - React Context with Next.js](https://vercel.com/kb/guide/react-context-state-management-nextjs) - Official guidance from Next.js maintainers

### Secondary (MEDIUM confidence)
- [React Stack Patterns 2026](https://www.patterns.dev/react/react-2026/) - Current patterns and state management guidance
- [React 19 Context API - Improved State Management](https://medium.com/@ignatovich.dm/react-19-state-management-with-improved-context-api-82bba332bb69) - React 19 compiler impact on Context
- [Optimizing React Context Performance](https://www.tenxdeveloper.com/blog/optimizing-react-context-performance) - Re-render pitfalls and solutions
- [Common Mistakes with React Context](https://greenonsoftware.com/articles/react/common-mistakes-in-using-react-context-api/) - Anti-patterns catalog

### Tertiary (LOW confidence)
- [React Compiler Deep Dive](https://www.developerway.com/posts/react-compiler-soon) - Compiler limitations with Context (anecdotal "still a pain" comment)
- [Context API Performance Pitfalls](https://stevekinney.com/courses/react-performance/context-api-performance-pitfalls) - Performance course material (author credibility high but not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React Context is built-in, officially recommended, verified in Next.js docs
- Architecture: HIGH - Patterns from official Next.js and React documentation, verified with codebase structure
- Pitfalls: HIGH - Cross-referenced multiple sources, verified with official docs troubleshooting sections
- React 19 Compiler: MEDIUM - Feature is new (2024), limited real-world production data, "Context still a pain" comment unverified

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - React/Next.js stable, slow-moving APIs)
