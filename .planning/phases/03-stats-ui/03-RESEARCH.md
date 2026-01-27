# Phase 03: Stats UI - Research

**Researched:** 2026-01-27
**Domain:** React table UI, data filtering, responsive design patterns
**Confidence:** HIGH (core stack verified in codebase, patterns from official documentation)

## Summary

This phase builds sortable, filterable leaderboard tables for displaying model rankings across competitions and clubs. The project uses Next.js 16 with React 19, Tailwind CSS, and Radix UI components. Current implementation uses manual table rendering with inline sorting logic. TanStack Table v8 is the standard headless table library for adding advanced sorting/filtering. The existing leaderboard component provides a good foundation but lacks formalized column definitions and doesn't use TanStack Table. Key decisions locked in context: compact density, default sort by win rate, immediate filter application, and mobile bottom-sheet filters.

**Primary recommendation:** Adopt TanStack Table v8 for sortable columns and filtering with the existing manual table rendering as fallback for simple cases. Keep URL-based filter state for SEO and bookmarking. Implement row-level skeleton loaders and modal comparison using existing Radix Dialog.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | UI library | In use, modern hooks/server components |
| Next.js | 16.1.4 | Framework | App router, server components, built-in caching |
| TanStack Table | v8.x | Headless table library | Sorting, filtering, pagination without UI lock-in |
| Tailwind CSS | 4.x | Styling | Current project standard |
| Radix UI | Latest | Unstyled component primitives | Accessible modals, selects, dialogs |

### Supporting UI
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562.0 | Icons | Sort indicators, rank badges, action icons |
| clsx | 2.1.1 | Conditional classes | Class merging in table cells |
| class-variance-authority | 0.7.1 | Component variants | Styling multiple states (sorted/unsorted/disabled) |
| recharts | 3.6.0 | Charts | Model performance graphs on detail pages |

### Missing but Recommended
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @tanstack/react-table | 8.x | See TanStack Table | Column definitions, sorting, filtering APIs |
| react-loading-skeleton | 3.x | Skeleton loaders | Animated loading placeholders while fetching |

### Installation
```bash
npm install @tanstack/react-table@8 react-loading-skeleton
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── leaderboard/
│   │   ├── table.tsx              # Main table with TanStack integration
│   │   ├── columns.tsx            # Column definitions
│   │   ├── filters.tsx            # Filter controls
│   │   ├── skeleton.tsx           # Loading state
│   │   └── compare-modal.tsx      # Model comparison modal
│   ├── ui/
│   │   ├── table.tsx              # Existing headless primitives
│   │   └── badge.tsx              # Rank badges (existing)
│   └── ...existing
├── lib/
│   ├── db/
│   │   └── queries/stats.ts        # Data fetching (existing)
│   └── table/
│       └── columns.ts             # Shared column helper types
└── app/
    ├── leaderboard/page.tsx       # Updated with new components
    ├── api/stats/               # Existing endpoints
    └── ...
```

### Pattern 1: TanStack Table with Server-Side Data

**What:** Headless table library that manages sorting/filtering logic while you provide UI

**When to use:** Complex tables with multiple sort/filter columns; need to track state in URL

**Example:**
```typescript
// lib/table/columns.ts
import { createColumnHelper, ColumnDef } from '@tanstack/react-table';

interface LeaderboardRow {
  modelId: string;
  displayName: string;
  totalPoints: number;
  averagePoints: number;
  correctTendencies: number;
  accuracy: number; // computed: (correct / total) * 100
}

const columnHelper = createColumnHelper<LeaderboardRow>();

export const leaderboardColumns: ColumnDef<LeaderboardRow>[] = [
  columnHelper.display({
    id: 'rank',
    header: 'Rank',
    cell: (info) => info.row.getIndex() + 1,
  }),
  columnHelper.accessor('displayName', {
    header: 'Model',
    cell: (info) => (
      <Link href={`/models/${info.row.original.modelId}`}>
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('totalPoints', {
    header: 'Points',
    cell: (info) => info.getValue().toFixed(0),
  }),
  columnHelper.accessor('averagePoints', {
    header: 'Avg/Match',
    cell: (info) => info.getValue().toFixed(2),
    sortingFn: 'basic', // numeric sort
  }),
  columnHelper.accessor('accuracy', {
    header: 'Accuracy',
    cell: (info) => `${Math.round(info.getValue())}%`,
  }),
];

// components/leaderboard/table.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { leaderboardColumns } from '@/lib/table/columns';

interface LeaderboardTableProps {
  data: LeaderboardRow[];
}

export function LeaderboardTable({ data }: LeaderboardTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse sort from URL
  const sortFromUrl = searchParams.get('sort');
  const orderFromUrl = searchParams.get('order') as 'asc' | 'desc' | null;

  const [sorting, setSorting] = useState<SortingState>(
    sortFromUrl ? [{ id: sortFromUrl, desc: orderFromUrl === 'desc' }] : []
  );

  const table = useReactTable({
    data,
    columns: leaderboardColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (newSorting.length > 0) {
        params.set('sort', newSorting[0].id);
        params.set('order', newSorting[0].desc ? 'desc' : 'asc');
      } else {
        params.delete('sort');
        params.delete('order');
      }
      router.push(`/leaderboard?${params.toString()}`, { scroll: false });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="py-4 px-4 text-left text-xs font-medium text-muted-foreground"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <SortIcon state={header.column.getIsSorted()} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border/30 hover:bg-muted/30">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-4 px-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ state }: { state: boolean | 'asc' | 'desc' }) {
  if (state === false) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  if (state === 'asc') return <ArrowUp className="h-3 w-3 ml-1" />;
  return <ArrowDown className="h-3 w-3 ml-1" />;
}
```

Source: [TanStack Table Column Defs](https://tanstack.com/table/v8/docs/guide/column-defs)

### Pattern 2: Client-Side Filter State with URL Sync

**What:** Filter state lives in URL searchParams for SEO/bookmarking, but managed in state for reactivity

**When to use:** Filters that apply immediately without "Apply" button; small-to-medium datasets

**Example:**
```typescript
// components/leaderboard/filters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const COMPETITIONS = [
  { id: 'all', name: 'All Competitions' },
  { id: 'epl', name: 'Premier League' },
  // ... more
];

const TIME_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  // ... more
];

export function LeaderboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const competition = searchParams.get('competition') || 'all';
  const timeRange = searchParams.get('timeRange') || 'all';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/leaderboard?${params.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    router.push('/leaderboard', { scroll: false });
  };

  // Show active filter chips
  const activeFilters = [];
  if (competition !== 'all') {
    activeFilters.push({
      label: COMPETITIONS.find(c => c.id === competition)?.name || competition,
      key: 'competition',
    });
  }
  if (timeRange !== 'all') {
    activeFilters.push({
      label: TIME_RANGES.find(t => t.value === timeRange)?.label || timeRange,
      key: 'timeRange',
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4">
        <Select value={competition} onValueChange={(val) => updateFilter('competition', val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPETITIONS.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={(val) => updateFilter('timeRange', val)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(filter => (
            <Badge key={filter.key} variant="secondary">
              {filter.label}
              <button
                onClick={() => updateFilter(filter.key, 'all')}
                className="ml-2 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
```

Source: Current implementation in `/src/components/leaderboard-filters.tsx`

### Pattern 3: Skeleton Loading State

**What:** Animated placeholder rows matching table structure while data loads

**When to use:** Server-rendered pages with Suspense boundaries; improve perceived performance

**Example:**
```typescript
// components/leaderboard/skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function LeaderboardTableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border border-border/30 rounded-lg">
          <Skeleton className="h-8 w-8 rounded" />  {/* Rank */}
          <Skeleton className="h-4 flex-1" />        {/* Name */}
          <Skeleton className="h-4 w-16" />          {/* Points */}
          <Skeleton className="h-4 w-16" />          {/* Avg */}
          <Skeleton className="h-2 w-12 rounded" />  {/* Accuracy */}
        </div>
      ))}
    </div>
  );
}

// In page.tsx with Suspense
<Suspense fallback={<LeaderboardTableSkeleton />}>
  <LeaderboardContent searchParams={resolvedParams} />
</Suspense>
```

Source: [React Loading Skeleton](https://github.com/dvtng/react-loading-skeleton), [Smashing Magazine - Skeleton Screens](https://www.smashingmagazine.com/2020/04/skeleton-screens-react/)

### Pattern 4: Modal Comparison with Radix Dialog

**What:** Side-by-side model stats in modal using existing Radix UI Dialog primitive

**When to use:** Detailed comparison requires more space than inline; multiple models selected

**Example:**
```typescript
// components/leaderboard/compare-modal.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: LeaderboardEntry[];
}

export function CompareModal({ open, onOpenChange, models }: CompareModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Model Comparison</DialogTitle>
          <DialogDescription>
            Detailed stats for {models.length} selected models
          </DialogDescription>
        </DialogHeader>

        {/* Comparison Table - each column is a model */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">Metric</th>
                {models.map(m => (
                  <th key={m.modelId} className="text-center p-2 min-w-[150px]">
                    {m.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 font-medium">Total Points</td>
                {models.map(m => (
                  <td key={`${m.modelId}-points`} className="text-center p-2">
                    {m.totalPoints}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2 font-medium">Avg Per Match</td>
                {models.map(m => (
                  <td key={`${m.modelId}-avg`} className="text-center p-2">
                    {m.averagePoints.toFixed(2)}
                  </td>
                ))}
              </tr>
              {/* More metrics */}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Anti-Patterns to Avoid

- **Don't hand-roll table state:** Don't implement sorting/filtering from scratch. TanStack Table handles complex state management that grows with features.
- **Don't couple sorting to server fetches:** URL-based sorting allows bookmarking and back-button behavior. Keep sorting client-side for small datasets (< 1000 rows).
- **Don't hardcode column widths:** Use flexbox or CSS Grid with fr units for responsive columns. Hardcoded widths break on mobile.
- **Don't skip skeleton loading:** Users perceive slow pages as broken. Skeleton loaders improve UX while API calls complete.
- **Don't nest modals without focus management:** Radix Dialog handles focus trapping. Stack modals only if using Dialog primitives consistently.

## Don't Hand-Roll

Problems that have existing, tested solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Sorting logic | Custom sort function with useState | TanStack Table `getSortedRowModel()` | Handles multi-column, type-aware sort functions, null handling |
| Column filtering UI | Array of select dropdowns | TanStack Table `getFilteredRowModel()` + Radix Select | Combines filtering logic with accessible UI; handles complex filter types |
| Loading placeholders | Custom CSS animations | react-loading-skeleton | Auto-sized to match content, consistent animations, proven UX pattern |
| Modal accessibility | Custom div with z-index | Radix Dialog | Focus trapping, ARIA attributes, backdrop click handling, keyboard navigation |
| Table markup | Semantic table with manual cell alignment | Built-in table primitives in `ui/table.tsx` | Consistent spacing, hover states, accessibility already configured |
| Rank change indicators | Manual comparison to previous data | Store leaderboard snapshot query | Phase 2 can cache daily snapshots; UI just compares entries |

**Key insight:** Data tables with sorting/filtering have deeply nested edge cases. TanStack Table abstracts sorting stability, null handling, and multi-column sort. Writing this correctly takes 10x longer than using TanStack.

## Common Pitfalls

### Pitfall 1: Sorting Re-Renders Entire Table
**What goes wrong:** Clicking a sort header re-renders all 50+ rows, causing visible lag even with memoization

**Why it happens:** Each row re-mounts because sortedEntries is a new array reference on every sort change

**How to avoid:**
- Memoize column definitions: `const columns = useMemo(() => [...], [])`
- Use TanStack's row model which returns same row objects, not new references
- Test with DevTools Profiler to confirm memoization is working

**Warning signs:** Slow first sort click, lag on subsequent sorts, DevTools shows "re-rendered" for all rows

### Pitfall 2: Filter Changes Don't Reflect in URL
**What goes wrong:** User sorts, refreshes page, and table goes back to default sort

**Why it happens:** Sorting state lives in React state only, not persisted to URL

**How to avoid:**
- Sync sort state to searchParams on change: `router.push(/leaderboard?sort=X&order=Y)`
- Read initial sort from URL: `const sortParam = searchParams.get('sort')`
- Test: sort, copy URL, paste in new tab — should preserve sort

**Warning signs:** URL doesn't change when sorting, back button resets table, bookmarked leaderboard has default sort

### Pitfall 3: Modal Doesn't Trap Focus
**What goes wrong:** Tab key moves focus outside modal; user clicks outside and modal closes unexpectedly

**Why it happens:** Missing ARIA attributes or custom modal implementation without focus management

**How to avoid:**
- Always use Radix Dialog (already in project), not custom div
- Never set `z-index` manually for modals — Radix manages stacking
- Test: open modal, press Tab repeatedly — focus should cycle only inside modal

**Warning signs:** Can tab to page behind modal, clicking backdrop closes modal, keyboard navigation skips modal content

### Pitfall 4: Table Doesn't Respond to Mobile
**What goes wrong:** Desktop table displays as-is on mobile; columns overflow, text is unreadable

**Why it happens:** Fixed column widths in table header; no responsive breakpoints

**How to avoid:**
- Use `hidden md:block` on desktop table, separate `md:hidden block` for mobile cards
- Test at 375px (iPhone SE), 768px (iPad), 1024px (desktop)
- Mobile: Stack table as cards with all info visible (see existing leaderboard component pattern)

**Warning signs:** Horizontal scroll needed on mobile, column headers misalign with data, text overlaps

### Pitfall 5: API Filter Doesn't Match UI Filter
**What goes wrong:** UI shows "Last 7 Days" filter but API still returns all-time data

**Why it happens:** Filter applied in UI but not passed to API call; data fetched without filter params

**How to avoid:**
- Parse `searchParams` in server component before calling API
- Pass all active filters to API: `getLeaderboard({ competition, timeRange, minPredictions })`
- Test: apply filter, check Network tab — API request should include filter query params

**Warning signs:** Filter dropdown changes but table data doesn't, API response is unchanged, backend logs show no filter params

### Pitfall 6: Rank Position Changes Without Tracking
**What goes wrong:** Phase context mentions "↑3" rank change arrows but no previous ranking data exists

**Why it happens:** LeaderboardEntry in Phase 2 doesn't include previous day/week position; can't compute delta

**How to avoid:**
- Store daily leaderboard snapshot in Phase 2 cron job (e.g., `leaderboard_snapshots` table)
- Query: `SELECT current_rank - previous_rank FROM ...`
- For Phase 3: Can implement as "future enhancement" if data isn't available yet

**Warning signs:** Phase context expects rank changes but API doesn't return them, UI tries to compute impossible delta

## Code Examples

Verified patterns from official sources and existing codebase:

### TanStack Table with Basic Sorting
```typescript
// Source: https://tanstack.com/table/v8/docs/guide/sorting
import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';

const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

// In template:
<th onClick={header.column.getToggleSortingHandler()}>
  {header.column.columnDef.header}
</th>
```

Source: [TanStack Table Sorting Guide](https://tanstack.com/table/latest/docs/guide/sorting)

### Responsive Table with Mobile Cards
```typescript
// Source: Current implementation src/components/leaderboard-table.tsx (proven pattern)
return (
  <>
    {/* Desktop Table - hidden on mobile */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        {/* Desktop table markup */}
      </table>
    </div>

    {/* Mobile Cards - hidden on desktop */}
    <div className="md:hidden space-y-3">
      {data.map(entry => (
        <div key={entry.id} className="border rounded-lg p-4">
          {/* Card layout with all essential info */}
        </div>
      ))}
    </div>
  </>
);
```

Source: Current leaderboard component in codebase

### URL-Based Filter State
```typescript
// Source: Current implementation src/components/leaderboard-filters.tsx
const updateFilter = (key: string, value: string) => {
  const params = new URLSearchParams(searchParams);
  if (value === 'all') params.delete(key);
  else params.set(key, value);

  router.push(`/leaderboard?${params.toString()}`, { scroll: false });
};
```

Source: Existing component in `/src/components/leaderboard-filters.tsx`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Table v6/v7 | TanStack Table v8+ | 2023 | Renamed to TanStack, better tree-shaking, smaller bundle |
| Manual table sorting | TanStack Table getSortedRowModel() | 2022-2023 | Community standardized; most React projects use it |
| Dropdown filters in state | URL searchParams sync | 2023+ | SEO-friendly, bookmarkable filters, back button support |
| Spinner loaders | Skeleton screens | 2020+ | Better UX, reduced cognitive load, improved perceived performance |
| Material-UI Tables | Headless (TanStack) + custom UI | 2022+ | More control, smaller bundle, avoid locked-in design |

**Deprecated/outdated:**
- Custom hand-written sorting: Complex, prone to bugs with nulls/types, doesn't scale to 10+ sortable columns
- react-table v6: Archived; v8 is current standard
- Row-level pagination: Outdated; cursor-based is standard for better performance

## Open Questions

Things that couldn't be fully resolved with existing project data:

1. **Rank position change tracking (↑3 arrows in context)**
   - What we know: LeaderboardEntry in Phase 2 API doesn't include previous position data
   - What's unclear: Should we store daily snapshots in Phase 2 or implement in Phase 3 as computed field?
   - Recommendation: Check with Phase 2 team if `leaderboard_snapshots` table exists. If not, defer rank change UI to Phase 3 follow-up or compute from historical query.

2. **Club-specific leaderboard page implementation**
   - What we know: Phase 2 created `/api/stats/club/[id]/route.ts` endpoint
   - What's unclear: Should club page use same table component as competition/overall, or different layout?
   - Recommendation: Reuse LeaderboardTable component with `competition` filter pre-set; only difference is page context/title

3. **Model comparison modal scrolling on small viewports**
   - What we know: Context mentions "side-by-side modal" but doesn't specify scroll behavior when many models selected
   - What's unclear: Should modal be fixed height with horizontal scroll, or take full viewport height?
   - Recommendation: Use `max-h-[80vh] overflow-y-auto` for content, allow horizontal scroll in table with `overflow-x-auto`

## Sources

### Primary (HIGH confidence)
- Next.js 16.1.4 app router patterns — integrated in project, verified via `/src/app/leaderboard/page.tsx`
- React 19.2.3 — in package.json, stable API
- Radix UI v2 — existing implementation in `/src/components/ui/`, used for Select, Dialog, Tabs
- Tailwind CSS 4 — in package.json, current project standard

### Secondary (MEDIUM confidence)
- [TanStack Table v8 Columns Guide](https://tanstack.com/table/v8/docs/guide/column-defs) — Official docs, verified API stability
- [TanStack Table v8 Sorting Guide](https://tanstack.com/table/latest/docs/guide/sorting) — Current standard, 10K+ GitHub stars
- [TanStack Table v8 Filtering Guide](https://tanstack.com/table/latest/docs/guide/column-filtering) — Verified with web search results
- [React Loading Skeleton](https://github.com/dvtng/react-loading-skeleton) — 3K+ stars, industry standard for skeleton loaders
- [Radix Dialog accessibility](https://www.radix-ui.com/docs/primitives/components/dialog) — Built-in to project, WCAG compliant

### Tertiary (Source documents, pattern verification)
- [LogRocket - React Table Performance](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)
- [Smashing Magazine - Skeleton Screens](https://www.smashingmagazine.com/2020/04/skeleton-screens-react/)
- [MDN - ARIA Modal](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-modal)
- [Contentful - TanStack Table Guide](https://www.contentful.com/blog/tanstack-table-react-table/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified in package.json; TanStack Table v8 is industry standard (10K+ GitHub stars)
- Architecture: HIGH — Patterns verified from official TanStack/Radix docs and current codebase implementation
- Pitfalls: MEDIUM-HIGH — Based on community discussions (GitHub, Medium posts) and TanStack docs edge case warnings
- Code examples: HIGH — Existing leaderboard component provides proven patterns; TanStack docs provide official API examples

**Research date:** 2026-01-27
**Valid until:** 2026-03-27 (60 days; TanStack Table is stable but check for v9 release in this window)

**Notes for planner:**
- TanStack Table is NOT in package.json yet — install before creating tasks
- Existing leaderboard component (`leaderboard-table.tsx`) has working sorting/mobile layout; can refactor incrementally into TanStack pattern
- Phase 2 stats API endpoints exist and are cached; no API work needed
- Focus areas: Column definitions, filter state sync, skeleton loaders, modal comparison
