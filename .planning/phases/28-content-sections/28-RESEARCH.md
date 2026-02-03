# Phase 28: Content Sections - Research

**Researched:** 2026-02-03
**Domain:** React state-aware content rendering, table sorting, conditional display
**Confidence:** HIGH

## Summary

Researched implementing narrative content and predictions table that render correctly based on match state (upcoming/live/finished). The codebase already has TanStack Table v8.21.3 installed, react-markdown for content rendering, isomorphic-dompurify for HTML sanitization, and MatchDataProvider context providing matchState derived once at page level.

The standard approach centers on client-side table sorting with useState/useMemo patterns, react-markdown for narrative rendering (auto-sanitizes by default), and conditional rendering based on matchState from context. The existing PredictionTable component already handles finished match display with points/highlights, but needs extension for sortable columns and state-aware content variations.

Key findings from user context: narrative content stored in matchContent table (preMatchContent/postMatchContent fields), matchRoundups table has full narrative field, same visual styling for both narrative types (content distinguishes context), predictions table default sort by performance ranking, color-coded points (4 pts green, 3 pts yellow, 2 pts orange, 0 pts gray), and missing narrative shows placeholder message.

**Primary recommendation:** Use useState for sort column/direction with useMemo to cache sorted array, render narratives via react-markdown (already in use for blog content), conditionally display content sections based on matchState from MatchDataProvider, extend existing PredictionTable to accept sortable prop and onSort handler, and ensure color-coded points meet WCAG contrast requirements with additional visual indicators (icons) per accessibility standards.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Table | 8.21.3 | Table state management | Already installed, headless design allows custom UI, handles sorting/filtering/pagination logic |
| react-markdown | 10.1.0 | Markdown rendering | Already installed, auto-sanitizes content, prevents XSS attacks by default |
| isomorphic-dompurify | 2.35.0 | HTML sanitization | Already installed, SSR-compatible, strips dangerous HTML when needed |
| MatchDataProvider | Custom | Match state distribution | Already implemented (Phase 26), provides single source of truth for matchState |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562.0 | Icon library | Already in use, provides Trophy/Target/X icons for visual indicators |
| date-fns | 4.1.0 | Date formatting | Already in use, formats timestamps in narratives |
| clsx/cn | 2.1.1 | Conditional classNames | Already in use, applies color-coded styles based on points |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Custom sorting | TanStack handles edge cases (multi-column, type-aware sorting), custom = reinvent wheel |
| react-markdown | dangerouslySetInnerHTML | dangerouslySetInnerHTML requires manual sanitization, XSS risk if forgotten |
| Client-side sorting | Server-side sorting | 35 rows is small dataset, client sorting = instant response, no network latency |
| useState | URL-based sorting | URL params good for bookmarkable state, overkill for single-page table interaction |

**Installation:**
```bash
# All dependencies already installed
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── match/
│       ├── match-data-provider.tsx     # Context provider (exists - Phase 26)
│       ├── use-match.ts                # Context hook (exists)
│       ├── match-narrative.tsx         # NEW: State-aware narrative display
│       ├── predictions-table.tsx       # EXTEND: Add sortable columns
│       └── prediction-table.tsx        # EXISTS: Current implementation
└── lib/
    └── db/
        └── queries.ts                  # Add narrative fetching queries
```

### Pattern 1: Client-Side Table Sorting with useMemo

**What:** Track sort state with useState, compute sorted array with useMemo
**When to use:** Small to medium datasets (<1000 rows) where instant sorting matters
**Example:**
```tsx
// Source: Verified pattern from LogRocket Blog and TanStack Table docs
// https://blog.logrocket.com/creating-react-sortable-table/
// https://tanstack.com/table/latest/docs/guide/sorting

'use client';

import { useState, useMemo } from 'react';

type SortConfig = {
  column: 'model' | 'prediction' | 'points';
  direction: 'asc' | 'desc';
} | null;

interface Prediction {
  id: string;
  modelDisplayName: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number | null;
}

export function SortablePredictionsTable({ predictions }: { predictions: Prediction[] }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'points',
    direction: 'desc', // Default: best performers first
  });

  // Memoize sorted array - only recomputes when predictions or sortConfig changes
  const sortedPredictions = useMemo(() => {
    if (!sortConfig) return predictions;

    return [...predictions].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.column) {
        case 'model':
          aVal = a.modelDisplayName.toLowerCase();
          bVal = b.modelDisplayName.toLowerCase();
          break;
        case 'points':
          aVal = a.points ?? -1; // Null points go last
          bVal = b.points ?? -1;
          break;
        case 'prediction':
          // Sort by predicted winner (home/away/draw)
          const aDiff = a.predictedHomeScore - a.predictedAwayScore;
          const bDiff = b.predictedHomeScore - b.predictedAwayScore;
          aVal = aDiff;
          bVal = bDiff;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [predictions, sortConfig]);

  const handleSort = (column: SortConfig['column']) => {
    setSortConfig((prev) => ({
      column,
      direction: prev?.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => handleSort('model')}>
            Model {sortConfig?.column === 'model' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
          </th>
          <th onClick={() => handleSort('prediction')}>
            Prediction {sortConfig?.column === 'prediction' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
          </th>
          <th onClick={() => handleSort('points')}>
            Points {sortConfig?.column === 'points' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedPredictions.map(p => (
          <tr key={p.id}>
            <td>{p.modelDisplayName}</td>
            <td>{p.predictedHomeScore}-{p.predictedAwayScore}</td>
            <td>{p.points ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Key insight:** useMemo prevents re-sorting on every render. Only recalculates when predictions or sortConfig changes.

### Pattern 2: State-Aware Content Display

**What:** Conditionally render different content based on matchState from context
**When to use:** Content structure/visibility varies by match status
**Example:**
```tsx
// Source: React official docs - Conditional Rendering
// https://react.dev/learn/conditional-rendering

'use client';

import { useMatch } from './use-match';
import ReactMarkdown from 'react-markdown';

export function MatchNarrative() {
  const { matchState, analysis } = useMatch();

  // Determine which narrative to show
  const narrative = matchState === 'finished'
    ? analysis?.postMatchContent
    : analysis?.preMatchContent;

  // Heading varies by state
  const heading = matchState === 'finished'
    ? 'Match Report'
    : matchState === 'live'
      ? 'Match Preview' // Live shows pre-match narrative
      : 'Match Preview';

  // Placeholder for missing content
  if (!narrative) {
    return (
      <section className="p-6 bg-muted/20 rounded-xl border border-dashed">
        <p className="text-muted-foreground text-center">
          Analysis pending — check back closer to kickoff
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">{heading}</h2>
      <ReactMarkdown className="prose prose-neutral dark:prose-invert max-w-none">
        {narrative}
      </ReactMarkdown>
    </section>
  );
}
```

**Key insight:** Same component, different content/headings based on state. No need for separate components.

### Pattern 3: Markdown Rendering with Auto-Sanitization

**What:** Use react-markdown to render narrative content safely
**When to use:** Rendering AI-generated or user-provided markdown content
**Example:**
```tsx
// Source: react-markdown documentation (already in use in BlogContent component)
// src/components/blog/blog-content.tsx

import ReactMarkdown from 'react-markdown';

// react-markdown sanitizes by default - NO dangerouslySetInnerHTML needed
<ReactMarkdown
  components={{
    h2: ({ children }) => <h2 className="text-2xl font-bold mb-3">{children}</h2>,
    p: ({ children }) => <p className="text-foreground leading-relaxed mb-4">{children}</p>,
    // ... custom styling for other elements
  }}
>
  {narrative}
</ReactMarkdown>
```

**Key insight:** react-markdown prevents XSS by default. Only use isomorphic-dompurify when rendering raw HTML strings.

### Pattern 4: Color-Coded Points with Accessibility

**What:** Use background colors for visual hierarchy, icons for accessibility
**When to use:** Displaying categorized/scored data in tables
**Example:**
```tsx
// Source: WCAG 2.1 guidelines - Use of Color (1.4.1)
// Don't rely on color alone - add icons/text for colorblind users

import { Trophy, Target, Minus } from 'lucide-react';

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return <span className="text-muted-foreground">-</span>;

  // Color + Icon = accessible to all users
  if (points >= 4) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400">
        <Trophy className="h-4 w-4" />
        <span className="font-semibold">{points} pts</span>
      </div>
    );
  }

  if (points >= 2) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400">
        <Target className="h-4 w-4" />
        <span className="font-semibold">{points} pts</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
      <Minus className="h-4 w-4" />
      <span className="font-semibold">{points} pts</span>
    </div>
  );
}
```

**Key insight:** Icons provide non-color cue. Meets WCAG 1.4.1 (Use of Color) and 1.4.11 (Non-text Contrast).

### Anti-Patterns to Avoid

- **Inline sort functions:** Creating new functions on every render causes child component re-renders. Use useCallback.
- **Sorting in render:** `predictions.sort()` mutates array and runs on every render. Use useMemo with spread operator `[...predictions].sort()`.
- **Index as key in sorted lists:** When sorting changes order, React confuses which element is which. Always use stable IDs (`prediction.id`).
- **Color-only indicators:** Colorblind users can't distinguish. Add icons, labels, or patterns.
- **dangerouslySetInnerHTML without sanitization:** XSS vulnerability. Use react-markdown or sanitize with isomorphic-dompurify.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting logic | Custom sort state management | TanStack Table or useMemo pattern | Type-aware sorting (strings vs numbers), multi-column sorting, sort stability |
| Markdown rendering | Manual HTML parsing | react-markdown | XSS prevention, extensibility, custom component mapping |
| HTML sanitization | Regex-based stripping | isomorphic-dompurify | Handles edge cases (nested tags, malformed HTML, entities) |
| Conditional class names | Template literal concatenation | clsx or cn utility | Handles undefined/null, conditional merging, Tailwind conflicts |

**Key insight:** Table sorting has edge cases (null values, type coercion, stability). react-markdown prevents entire classes of XSS vulnerabilities. isomorphic-dompurify works in SSR/SSG environments.

## Common Pitfalls

### Pitfall 1: Mutating Arrays During Sort

**What goes wrong:** Using `predictions.sort()` directly mutates the original array and triggers extra renders
**Why it happens:** JavaScript's `.sort()` modifies array in-place
**How to avoid:** Always spread array first: `[...predictions].sort()`
**Warning signs:** Predictions appear to "jump" when switching pages, React warning about changing controlled component

### Pitfall 2: Duplicate Keys in Sorted Tables

**What goes wrong:** "Warning: Each child in a list should have a unique 'key' prop"
**Why it happens:** Using array index as key in sortable lists - when order changes, React confuses elements
**How to avoid:** Always use stable unique IDs from data: `key={prediction.id}` not `key={index}`
**Warning signs:** React console warnings, incorrect row highlighting after sort, component state mixing between rows

**Source verification:** [Sentry - Unique Key Prop](https://sentry.io/answers/unique-key-prop/), [React Docs - Rendering Lists](https://react.dev/learn/rendering-lists)

### Pitfall 3: Unnecessary Re-Renders from Inline Functions

**What goes wrong:** Creating sort handlers inline (`onClick={() => sort('column')}`) creates new function each render
**Why it happens:** Arrow functions in JSX create new reference every time
**How to avoid:** Use useCallback or single handler with event target data
**Warning signs:** Performance lag when sorting large tables, React DevTools shows excessive renders

```tsx
// BAD: Creates new function every render
<th onClick={() => handleSort('model')}>Model</th>

// GOOD: Stable function reference
const handleSort = useCallback((column: string) => {
  setSortConfig(prev => ({ column, direction: toggle(prev.direction) }));
}, []);

<th onClick={() => handleSort('model')}>Model</th>
```

### Pitfall 4: Color-Only Information Display

**What goes wrong:** Colorblind users can't distinguish between green/yellow/orange/gray point badges
**Why it happens:** Relying solely on background color to convey information (violates WCAG 1.4.1)
**How to avoid:** Add icons (Trophy/Target/X) and text labels alongside colors
**Warning signs:** Accessibility audit failures, user feedback about unclear status

**Source verification:** WCAG 2.1 Success Criterion 1.4.1 - Use of Color

### Pitfall 5: XSS Vulnerability from Unsanitized HTML

**What goes wrong:** Using `dangerouslySetInnerHTML` with AI-generated or database content without sanitization
**Why it happens:** Trusting content source without verification, or forgetting to sanitize
**How to avoid:** Use react-markdown for markdown content, isomorphic-dompurify for raw HTML
**Warning signs:** Script tags appearing in rendered content, console errors from injected code

```tsx
// BAD: XSS vulnerability
<div dangerouslySetInnerHTML={{ __html: narrative }} />

// GOOD: Auto-sanitized
<ReactMarkdown>{narrative}</ReactMarkdown>

// GOOD: Manual sanitization when needed
import DOMPurify from 'isomorphic-dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

### Pitfall 6: Missing Null Checks for Conditional Content

**What goes wrong:** Runtime errors when accessing `analysis?.preMatchContent` on null/undefined
**Why it happens:** Assuming content always exists, or forgetting edge case (match without analysis)
**How to avoid:** Always check for null/undefined before rendering, provide placeholder UI
**Warning signs:** Console errors "Cannot read property of null", blank sections on page

```tsx
// BAD: Crashes if analysis is null
<ReactMarkdown>{analysis.preMatchContent}</ReactMarkdown>

// GOOD: Null-safe with fallback
const narrative = analysis?.preMatchContent;
if (!narrative) return <PlaceholderMessage />;
return <ReactMarkdown>{narrative}</ReactMarkdown>;
```

## Code Examples

Verified patterns from codebase and official sources:

### Extending Existing PredictionTable

```tsx
// Source: Existing src/components/prediction-table.tsx + TanStack Table patterns
// Extend current implementation to support sorting

interface PredictionTableProps {
  predictions: Prediction[];
  homeTeam: string;
  awayTeam: string;
  isFinished: boolean;
  sortable?: boolean; // NEW: Enable column sorting
}

export function PredictionTable({
  predictions,
  homeTeam,
  awayTeam,
  isFinished,
  sortable = true,
}: PredictionTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'points',
    direction: 'desc',
  });

  // EXISTING: Sort by points for finished, model name for upcoming
  const sortedPredictions = useMemo(() => {
    if (!sortable) {
      // Default sorting (existing behavior)
      return [...predictions].sort((a, b) => {
        if (isFinished && a.points !== null && b.points !== null) {
          return (b.points || 0) - (a.points || 0);
        }
        return a.modelDisplayName.localeCompare(b.modelDisplayName);
      });
    }

    // NEW: Custom sorting based on user interaction
    return [...predictions].sort((a, b) => {
      // Sorting logic from Pattern 1
    });
  }, [predictions, isFinished, sortable, sortConfig]);

  // EXISTING: Desktop/mobile card rendering (keep as-is)
  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block space-y-3">
        {/* Add onClick handlers to headers if sortable */}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Existing card rendering */}
      </div>
    </>
  );
}
```

### Fetching Narrative Content

```tsx
// Source: Existing database schema (matchContent table)
// src/lib/db/queries.ts

import { db } from './index';
import { matchContent } from './schema';
import { eq } from 'drizzle-orm';

export async function getMatchNarrative(matchId: string) {
  const content = await db
    .select()
    .from(matchContent)
    .where(eq(matchContent.matchId, matchId))
    .limit(1);

  return content[0] ?? null;
}
```

### State-Aware Section Rendering

```tsx
// Source: Existing MatchDataProvider pattern + conditional rendering
// NEW: src/components/match/match-narrative.tsx

'use client';

import { useMatch } from './use-match';
import ReactMarkdown from 'react-markdown';

export function MatchNarrative({ content }: { content: MatchContent | null }) {
  const { matchState } = useMatch();

  // Determine content and heading based on state
  const narrative = matchState === 'finished'
    ? content?.postMatchContent
    : content?.preMatchContent;

  const heading = matchState === 'finished' ? 'Match Report' : 'Match Preview';

  if (!narrative) {
    return (
      <section className="p-6 bg-muted/20 rounded-xl border border-dashed">
        <p className="text-muted-foreground text-center">
          Analysis pending — check back closer to kickoff
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">{heading}</h2>
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown>{narrative}</ReactMarkdown>
      </div>
    </section>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Table v7 | TanStack Table v8 | 2023 | New hooks API, better TypeScript support, smaller bundle |
| dangerouslySetInnerHTML | react-markdown | Ongoing | Auto-sanitization, no XSS vulnerabilities by default |
| Inline styles for colors | Tailwind utility classes | Established | Consistent design system, easier maintenance |
| Props drilling | React Context | React 16.3 (2018) | Single source of truth, less prop passing |

**Deprecated/outdated:**
- **react-table v7**: Renamed to TanStack Table v8 with breaking API changes (useTable → useReactTable)
- **Manual HTML sanitization**: Use react-markdown or isomorphic-dompurify instead of regex/custom parsers
- **Array index as key**: Always use stable IDs, especially for sortable/filterable lists

## Open Questions

Things that couldn't be fully resolved:

1. **Narrative content format in database**
   - What we know: Schema has `preMatchContent` and `postMatchContent` fields (text type)
   - What's unclear: Are they markdown or HTML? matchRoundups.narrative is "Full HTML content"
   - Recommendation: Check actual data format in database, use react-markdown for markdown or DOMPurify.sanitize for HTML

2. **Default sort for upcoming matches**
   - What we know: User wants "default sort by performance ranking (best-performing models at top)"
   - What's unclear: Performance ranking for models without finished match data yet
   - Recommendation: Sort by model leaderboard position from global stats, or alphabetically if no ranking available

3. **Summary stats calculation**
   - What we know: User wants "X models got exact score, Y got winner, Z got nothing"
   - What's unclear: Where to calculate (component vs database query)
   - Recommendation: Calculate in component from predictions array - simple reduce(), no additional query

## Sources

### Primary (HIGH confidence)
- TanStack Table v8 GitHub repository and documentation
- React official documentation - Conditional Rendering: https://react.dev/learn/conditional-rendering
- react-markdown package (already in use in codebase at src/components/blog/blog-content.tsx)
- isomorphic-dompurify package (already in use at src/lib/utils/strip-html.ts)
- Existing codebase patterns: MatchDataProvider (Phase 26), PredictionTable component

### Secondary (MEDIUM confidence)
- [LogRocket Blog - Creating a React Sortable Table](https://blog.logrocket.com/creating-react-sortable-table/)
- [TanStack Table Sorting Guide](https://tanstack.com/table/latest/docs/guide/sorting) (redirects encountered, verified via search results)
- [Sentry - Unique Key Prop Warning](https://sentry.io/answers/unique-key-prop/)
- [React Docs - Rendering Lists](https://react.dev/learn/rendering-lists)

### Tertiary (LOW confidence)
- WebSearch results for table sorting patterns (multiple sources agree on useMemo + useState pattern)
- WebSearch results for WCAG color accessibility (principle confirmed but specific 2026 updates unavailable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use, verified via package.json
- Architecture: HIGH - Patterns verified in existing codebase (MatchDataProvider, PredictionTable, BlogContent)
- Pitfalls: MEDIUM - Common React patterns confirmed by official docs, specific examples from search results

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - React and Next.js stable, TanStack Table v8 mature)

**Notes:**
- All core dependencies already installed (no new packages needed)
- Existing PredictionTable component provides foundation - extend rather than rebuild
- Database schema has both matchContent (pre/post sections) and matchRoundups (full narrative) - clarify which to use
- User decisions from CONTEXT.md fully incorporated: state-specific headings, default sort, color-coding, placeholder messages
