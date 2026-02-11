# Phase 69: UI Components & Match Display - Research

**Researched:** 2026-02-11
**Domain:** React UI components, data visualization, football match presentation
**Confidence:** HIGH

## Summary

Phase 69 builds UI components on top of the foundation established in Phases 67 (data layer) and 68 (routes/SEO). The technical domain is well-understood: React Server Components with client interactivity via TanStack Table v8.21.3, Recharts 3.6.0 for time-series visualization, and Radix UI primitives for accessible UI patterns.

The codebase already has comprehensive patterns for leaderboards (`src/components/leaderboard-table.tsx`), match cards (`src/components/match-card.tsx`), and time-period filtering (`src/components/leaderboard-filters.tsx`). This phase extends these patterns with team-scoped variants.

**Primary recommendation:** Reuse existing component architecture. Create team-specific variants of LeaderboardTable and LeaderboardFilters. Follow the established pattern: Server Component page fetches data via `getLeaderboard()` with team filters, passes to client component for sorting/interaction. Use existing Recharts patterns for accuracy trend visualization.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Interactive tables with sorting, filtering | Industry standard for data tables, already integrated for global leaderboard |
| recharts | ^3.6.0 | Time-series charts for accuracy trends | D3-based React charting library, already used in `accuracy-chart.tsx` |
| @radix-ui/react-tabs | ^1.1.13 | Accessible tab navigation for time periods | Full accessibility, keyboard navigation, used in existing UI |
| lucide-react | ^0.562.0 | Icons for W/D/L indicators, trends | Lightweight icon library, consistent with codebase |
| date-fns | ^4.1.0 | Date range calculations for time filters | Already used in `team-stats.ts` for date filtering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-select | ^2.2.6 | Dropdown filters for time periods | Already used in `leaderboard-filters.tsx` |
| class-variance-authority | ^0.7.1 | Conditional styling for W/D/L badges | Used for result-based color coding |
| next-themes | ^0.4.6 | Dark mode support for charts | Chart color schemes must adapt to theme |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js | Chart.js is more performant but less React-idiomatic. Recharts already integrated. |
| TanStack Table | AG Grid | AG Grid has more features but requires license for production. TanStack Table sufficient for our scale (42 models max). |
| Radix UI Tabs | Headless UI | Both are excellent. Radix UI already used across codebase. |

**Installation:**
Already installed (zero new dependencies required).

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/
│   ├── team/
│   │   ├── team-model-leaderboard.tsx     # Team-scoped leaderboard (client)
│   │   ├── team-accuracy-trend-chart.tsx  # Model accuracy over time (client)
│   │   ├── team-upcoming-matches.tsx      # Upcoming predictions (server)
│   │   ├── team-recent-matches.tsx        # Recent results w/ accuracy (server)
│   │   └── team-form-indicator.tsx        # W/D/L visual timeline (client)
│   └── ui/
│       └── result-badge.tsx                # Reusable W/D/L badge component
└── app/
    └── teams/
        └── [slug]/
            └── page.tsx                     # Server Component orchestrator
```

### Pattern 1: Server Component Data Fetching with Client Interactivity
**What:** Server Component fetches data and passes to client components for sorting/filtering
**When to use:** Team pages, match listings, leaderboards
**Example:**
```typescript
// Source: src/app/leaderboard/page.tsx (lines 61-82)
// Server Component - fetches data
async function LeaderboardContent({ searchParams }) {
  const leaderboard = await getLeaderboardWithTrends(50, 'avgPoints', {
    competitionId,
    season,
    timePeriod,
  });

  return <LeaderboardTable entries={leaderboard} />;
}

// Client Component - handles interactivity
'use client';
export function LeaderboardTable({ entries }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  // ... render
}
```

### Pattern 2: Time-Period Scoped Queries
**What:** Filter queries by date ranges (all-time, season, monthly, weekly)
**When to use:** Team stats, model leaderboards, match history
**Example:**
```typescript
// Source: src/lib/db/queries/stats.ts (lines 251-317)
interface LeaderboardFilters {
  competitionId?: string;
  clubId?: string;
  timePeriod?: 'all' | 'weekly' | 'monthly';
  dateFrom?: string;
  dateTo?: string;
}

// Time period calculation
const now = new Date();
const dateFrom = timePeriod === 'weekly'
  ? format(subDays(now, 7), 'yyyy-MM-dd')
  : timePeriod === 'monthly'
  ? format(subDays(now, 30), 'yyyy-MM-dd')
  : undefined;

// Apply to query
if (filters?.dateFrom) {
  whereConditions.push(gte(matches.kickoffTime, filters.dateFrom));
}
```

### Pattern 3: Responsive Card + Table Dual Layout
**What:** Desktop table view, mobile card view for same data
**When to use:** Data-heavy tables (leaderboards, match lists)
**Example:**
```typescript
// Source: src/components/leaderboard-table.tsx (lines 384-497, 539-609)
return (
  <>
    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto">
      <table>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>...</tr>
        ))}
      </table>
    </div>

    {/* Mobile Card View */}
    <div className="md:hidden space-y-3 p-4">
      {table.getRowModel().rows.map((row, index) => (
        <MobileCard key={row.original.modelId} entry={row.original} index={index} />
      ))}
    </div>
  </>
);
```

### Pattern 4: W/D/L Form Indicator with Color Coding
**What:** Visual timeline of recent results with conditional colors
**When to use:** Team pages, match cards showing recent form
**Example:**
```typescript
// Source: Inferred from match-card.tsx result highlighting pattern
const formIndicator = ['W', 'W', 'L', 'D', 'W'].map((result, i) => (
  <span
    key={i}
    className={cn(
      "h-8 w-8 rounded flex items-center justify-center font-semibold text-xs",
      result === 'W' && "bg-green-500/20 text-green-400",
      result === 'D' && "bg-yellow-500/20 text-yellow-400",
      result === 'L' && "bg-red-500/20 text-red-400"
    )}
  >
    {result}
  </span>
));
```

### Pattern 5: Recharts Time-Series with Theme Support
**What:** Line chart for model accuracy trends over time
**When to use:** Model accuracy over time, trend visualization
**Example:**
```typescript
// Source: src/components/accuracy-chart.tsx (lines 1-92)
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AccuracyTrendChart({ data }) {
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), 'MMM dd'),
    accuracy: d.accuracy,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} label={{ value: 'Accuracy (%)', angle: -90 }} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
        <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side data fetching in Server Components:** Use Server Components for data fetching, pass data to client components for interactivity. Don't fetch in useEffect when page can fetch server-side.
- **Prop drilling through 3+ levels:** Use React Context or composition patterns. Example: Pass `filters` object instead of individual filter props.
- **Hardcoded date calculations in components:** Move date logic to query layer. Components should receive already-filtered data.
- **Building tables from scratch:** Use TanStack Table. Don't reinvent sorting, filtering, pagination.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data tables with sorting/filtering | Custom table with useState for sort | TanStack Table v8 | Handles edge cases: multi-sort, column visibility, pagination state sync, type-safe column definitions. Custom implementation will miss 20+ features. |
| Time-series charts | Canvas-based custom chart | Recharts | Handles responsive resize, tooltip positioning, axis calculations, theme integration. Custom charts break on mobile or dark mode. |
| Date range filtering | Manual date string parsing | date-fns with subDays/format | Timezone bugs, DST edge cases, month boundary errors. date-fns handles all edge cases. |
| Accessible dropdowns | Custom div + onClick | Radix UI Select | Keyboard navigation, screen reader labels, ARIA attributes, focus management. Custom dropdowns fail WCAG 2.1. |
| Form indicators (W/D/L timeline) | Complex state machine | Array.map with conditional classes | Simple data transformation is sufficient. State machine adds unnecessary complexity for static display. |

**Key insight:** UI component libraries solve deceptively complex problems (accessibility, responsive behavior, theme integration, browser quirks). The time saved by using TanStack Table and Radix UI is measured in weeks, not hours. Custom implementations always miss edge cases discovered only in production.

## Common Pitfalls

### Pitfall 1: TanStack Table Client-Server Sorting Confusion
**What goes wrong:** Using client-side sorting with server-side filtered data sorts only the current page, not the full dataset
**Why it happens:** TanStack Table sorts the `data` array passed to it. If data is server-paginated, table only sees one page.
**How to avoid:** Be consistent. If using server-side pagination/filtering, also use server-side sorting (pass `sort` param to API, return pre-sorted data). If data is small (<1000 rows), fetch all data and use client-side everything.
**Warning signs:** Sorting changes order of visible rows but clicking "next page" shows unsorted results. User sorts by accuracy descending but second page starts lower than first page's last entry.

### Pitfall 2: Recharts Re-render Performance with Large Datasets
**What goes wrong:** Chart becomes sluggish when rendering 100+ data points, especially on mobile
**Why it happens:** Recharts renders SVG paths for every data point. High-frequency time series data (hourly, daily) creates thousands of DOM nodes.
**How to avoid:** Limit data points to 30-50 for line charts. For longer time ranges, aggregate by week/month instead of day. Use `ResponsiveContainer` with `debounce={300}` for resize events.
**Warning signs:** Chart stutters on scroll, input lag when switching time periods, mobile browsers show "page unresponsive" warnings.

### Pitfall 3: Time Period Filters Without Cache Invalidation
**What goes wrong:** User switches from "All Time" to "This Week" but sees stale cached data from previous filter
**Why it happens:** Next.js ISR caches page output per URL. If filters are client-side only (useState), cache key doesn't change.
**How to avoid:** Encode filters in URL search params. Use `useRouter().push()` to update URL on filter change. Next.js cache keys include search params.
**Warning signs:** Filter buttons change UI but data doesn't update until hard refresh. Different users see different data for same filter selection.

### Pitfall 4: Date-Fns Timezone Assumptions
**What goes wrong:** "This Week" filter calculates wrong dates for users in different timezones
**Why it happens:** `subDays(new Date(), 7)` uses local browser timezone. Server calculates dates in UTC. Date boundaries mismatch.
**How to avoid:** Always work in UTC on server. Use `new Date().toISOString()` for server queries. Display dates in user's timezone only in client components via `format()`.
**Warning signs:** "Weekly" stats change at midnight UTC instead of user's local midnight. User in PST sees "tomorrow's" matches in "Today" filter.

### Pitfall 5: Radix UI Select Not Controlled Properly
**What goes wrong:** Select dropdown shows wrong selected value after programmatic state change
**Why it happens:** Radix Select requires both `value` and `onValueChange`. Setting only `value` without listener creates one-way binding.
**How to avoid:** Always provide both `value={currentValue}` and `onValueChange={(val) => setCurrentValue(val)}`. For URL-synced filters, use `useSearchParams()` as source of truth.
**Warning signs:** Dropdown shows "All Teams" but URL says `?team=manchester-city`. Clicking dropdown resets to default instead of showing current selection.

### Pitfall 6: Form Indicator Data Shape Mismatch
**What goes wrong:** W/D/L timeline shows wrong results (e.g., showing "W" for a loss)
**Why it happens:** Backend returns form guide in chronological order (oldest first), but UI reverses to show "most recent first". Result: timeline reads backwards.
**How to avoid:** Document order clearly in API contract. If `getTeamFormGuide()` returns `[oldest, ..., newest]`, reverse in component: `formGuide.slice().reverse()`. Add unit tests for order.
**Warning signs:** Form guide shows recent loss as "W", but match detail page confirms it was a loss. Last 5 games on page don't match form indicator.

## Code Examples

Verified patterns from existing codebase:

### Team-Scoped Leaderboard Query
```typescript
// Extend existing getLeaderboard() pattern from src/lib/db/queries/stats.ts
export async function getTeamModelLeaderboard(
  teamName: string,
  options?: {
    timePeriod?: 'all' | 'weekly' | 'monthly' | 'season';
    limit?: number;
  }
): Promise<LeaderboardEntry[]> {
  const db = getDb();

  const now = new Date();
  const dateFrom = options?.timePeriod === 'weekly'
    ? format(subDays(now, 7), 'yyyy-MM-dd')
    : options?.timePeriod === 'monthly'
    ? format(subDays(now, 30), 'yyyy-MM-dd')
    : undefined;

  return getLeaderboard(options?.limit ?? 20, 'avgPoints', {
    clubId: teamName,
    dateFrom,
  });
}
```

### Match Prediction Distribution (Model Consensus)
```typescript
// Pattern: Group predictions by predicted result
interface PredictionDistribution {
  homeWin: number;
  draw: number;
  awayWin: number;
  modelCount: number;
}

export function calculatePredictionDistribution(
  predictions: Array<{ predictedHomeScore: number; predictedAwayScore: number }>
): PredictionDistribution {
  const distribution = predictions.reduce((acc, pred) => {
    if (pred.predictedHomeScore > pred.predictedAwayScore) {
      acc.homeWin++;
    } else if (pred.predictedHomeScore < pred.predictedAwayScore) {
      acc.awayWin++;
    } else {
      acc.draw++;
    }
    return acc;
  }, { homeWin: 0, draw: 0, awayWin: 0 });

  return {
    ...distribution,
    modelCount: predictions.length,
  };
}
```

### W/D/L Form Indicator Component
```typescript
// Client component for visual form timeline
'use client';
import { cn } from '@/lib/utils';

interface FormIndicatorProps {
  form: Array<'W' | 'D' | 'L'>;
  direction?: 'ltr' | 'rtl'; // left-to-right (oldest first) or right-to-left (newest first)
}

export function FormIndicator({ form, direction = 'rtl' }: FormIndicatorProps) {
  const displayForm = direction === 'rtl' ? [...form].reverse() : form;

  return (
    <div className="flex items-center gap-1">
      {displayForm.map((result, i) => (
        <div
          key={i}
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center font-semibold text-xs transition-colors",
            result === 'W' && "bg-green-500/20 text-green-400 border border-green-500/30",
            result === 'D' && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
            result === 'L' && "bg-red-500/20 text-red-400 border border-red-500/30"
          )}
          title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
        >
          {result}
        </div>
      ))}
    </div>
  );
}
```

### Time Period Filter Component
```typescript
// Extend existing LeaderboardFilters pattern for team pages
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TIME_PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'season', label: 'This Season' },
  { value: 'monthly', label: 'Last 30 Days' },
  { value: 'weekly', label: 'Last 7 Days' },
];

export function TeamTimePeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriod = searchParams.get('timePeriod') || 'all';

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('timePeriod');
    } else {
      params.set('timePeriod', value);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Select value={currentPeriod} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Time period" />
      </SelectTrigger>
      <SelectContent>
        {TIME_PERIODS.map((period) => (
          <SelectItem key={period.value} value={period.value}>
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Model Accuracy Trend Chart
```typescript
// Pattern: Line chart showing model accuracy over time for a specific team
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';

interface AccuracyDataPoint {
  date: string; // ISO date string
  accuracy: number; // 0-100
  predictions: number;
}

interface TeamAccuracyTrendProps {
  data: AccuracyDataPoint[];
  modelName: string;
}

export function TeamAccuracyTrendChart({ data, modelName }: TeamAccuracyTrendProps) {
  // Limit to last 30 data points for performance
  const chartData = data.slice(-30).map(d => ({
    date: format(parseISO(d.date), 'MMM dd'),
    accuracy: Math.round(d.accuracy),
    predictions: d.predictions,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))'
          }}
          formatter={(value: number, name: string) => {
            if (name === 'accuracy') return `${value}%`;
            return value;
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Table v7 | TanStack Table v8 | v8 released 2022 | Type-safe column definitions, better tree-shaking, framework-agnostic core. Codebase already uses v8.21.3. |
| Manual responsive tables | TanStack Table + separate mobile card view | 2023+ pattern | Desktop users get sortable tables, mobile users get optimized cards. See `leaderboard-table.tsx` lines 384-609. |
| Static time filters | URL-synced dynamic filters | Next.js 13+ with useSearchParams | Cache-friendly, shareable URLs, no state desync. Implemented in `leaderboard-filters.tsx`. |
| Pie charts for prediction distribution | Horizontal bar chart | 2024+ data viz trend | Easier to read percentages, better mobile display, no label overlap. |
| Client-side date calculations | Server-side date filtering with client display | Next.js App Router pattern | Consistent timezone handling, cacheable results, faster page loads. |

**Deprecated/outdated:**
- **React Table v7**: Replaced by TanStack Table v8. Migration guide available but not needed (codebase already on v8).
- **Recharts `domain="auto"` for time-series**: Use explicit `domain={[dataMin, dataMax]}` for accurate time scaling. See WebSearch finding on category vs number axis type.
- **useState for filter state**: Use URL search params for shareable/cacheable filters. Only use local state for transient UI (modals, tooltips).

## Open Questions

1. **Team logo display**
   - What we know: Team logos exist in DB (`matches.homeTeamLogo`, `matches.awayTeamLogo`)
   - What's unclear: Logo quality, CDN availability, fallback strategy for missing logos
   - Recommendation: Defer logo display to Phase 70. Use team initials fallback (already implemented in `match-card.tsx` lines 152-165).

2. **Model accuracy trend granularity**
   - What we know: Can calculate daily accuracy per team from predictions table
   - What's unclear: Minimum data points needed for meaningful trend (some teams have <10 predictions per model)
   - Recommendation: Require minimum 10 predictions before showing trend chart. Show "Insufficient data" message otherwise.

3. **Time period "season" calculation**
   - What we know: `competitions.season` tracks football seasons (e.g., 2024/2025)
   - What's unclear: Season boundaries vary by competition (EPL starts August, MLS starts March)
   - Recommendation: Use simple cutoff: current season = where `competitions.season` matches most recent season in DB. Add "Current Season" filter option.

4. **Prediction distribution visualization**
   - What we know: Can count home win / draw / away win predictions per match
   - What's unclear: Best visualization (pie chart, bar chart, percentage text)
   - Recommendation: Use horizontal stacked bar chart (like FiveThirtyEight). Shows percentages clearly, reads well on mobile.

## Sources

### Primary (HIGH confidence)
- Codebase analysis:
  - `src/components/leaderboard-table.tsx` - TanStack Table v8 implementation with dual layout pattern
  - `src/components/match-card.tsx` - Match display patterns, result color coding
  - `src/lib/db/queries/stats.ts` - Leaderboard query patterns with time-period filtering
  - `src/lib/db/queries/team-stats.ts` - Team statistics aggregation patterns
  - `src/components/accuracy-chart.tsx` - Recharts integration for time-series data
  - `package.json` - Confirmed library versions: TanStack Table ^8.21.3, Recharts ^3.6.0, Radix UI components

### Secondary (MEDIUM confidence)
- [TanStack Table v8 Sorting Guide](https://tanstack.com/table/v8/docs/guide/sorting) - Sorting patterns and best practices
- [TanStack Table v8 Column Filtering Guide](https://tanstack.com/table/v8/docs/guide/column-filtering) - Filter implementation patterns
- [Create charts using Recharts | Refine](https://refine.dev/blog/recharts/) - Recharts integration patterns
- [Visualize the World Cup: 15 charts to power your football coverage | Flourish](https://flourish.studio/blog/world-cup-euros-football-data-visualization/) - Football stats visualization best practices

### Tertiary (LOW confidence)
- [Form Score — Understanding The New Football Analytics Metric | Medium](https://medium.com/after-the-full-time-whistle/form-score-understanding-the-new-football-analytics-metric-that-measures-a-teams-form-99b82b2b113e) - Advanced form metrics (not required for Phase 69, but useful for future)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and actively used in codebase
- Architecture patterns: HIGH - Existing components provide complete reference implementations
- Time-series visualization: HIGH - Recharts patterns proven in `accuracy-chart.tsx`
- Query patterns: HIGH - `getLeaderboard()` and team stats queries fully functional
- W/D/L visualization: MEDIUM - Pattern inferred from match-card result highlighting, needs validation

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (30 days, stable libraries and established patterns)
