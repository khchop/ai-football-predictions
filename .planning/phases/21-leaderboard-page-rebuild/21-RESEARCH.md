# Phase 21: Leaderboard Page Rebuild - Research

**Researched:** 2026-02-03
**Domain:** Leaderboard SEO optimization, time period filtering, trend indicators, performance comparison
**Confidence:** HIGH

## Summary

Research confirms that leaderboard pages benefit significantly from SEO optimization (FAQPage schema, dynamic metadata), time period filtering (weekly/monthly/all-time views), and visual trend indicators (up/down arrows, color coding). The existing codebase already has strong foundations: the leaderboard page exists with FAQ schema support, filter components (LeaderboardFilters), and sortable table infrastructure (TanStack Table). A CSS-only trend chart component (LeagueTrendChart) was implemented in Phase 20, providing a proven pattern for visualization without JavaScript library overhead.

The primary enhancements needed are: (1) enriching FAQ content with dynamic leaderboard statistics, (2) implementing time period filters (weekly/monthly/all-time) in the existing LeaderboardFilters component, (3) adding trend indicators showing rank changes (up/down arrows with color coding), and (4) calculating period-over-period performance deltas using SQL window functions (LAG/LEAD). The existing design system provides accuracy colors, chart colors, and lucide-react icons (ArrowUp, ArrowDown, Minus) that can power trend visualization.

**Primary recommendation:** Extend existing patterns (FAQ schema, LeaderboardFilters, LeaderboardTable) with time period filtering and trend calculation. Add rank change indicators using lucide-react icons with semantic color coding. Calculate trends using SQL window functions comparing current period vs previous period rankings.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.x | Sortable leaderboard table | Already in use (leaderboard-table.tsx), supports sorting/filtering |
| lucide-react | 0.562.0 | Trend icons (ArrowUp, ArrowDown, Minus) | Already in package.json, used for Trophy, Medal icons |
| schema-dts | 1.1.5 | TypeScript types for FAQPage schema | Already in package.json, type-safe structured data |
| SQL Window Functions | Native | Rank change calculation (LAG/LEAD) | Native to PostgreSQL/MySQL, no library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `<details>`/`<summary>` | HTML5 | FAQ accordions | Already used in blog/league FAQs, zero-JS |
| CSS Custom Properties | Native | Trend color coding (--win, --loss, --draw) | Already established in globals.css |
| Date-fns or Native Date | Native | ISO week calculation for weekly filters | Native Date API sufficient for week grouping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL window functions | Client-side rank comparison | Window functions are performant and accurate; client-side is error-prone |
| Lucide-react icons | Custom SVG trend indicators | Lucide icons are consistent with existing UI; custom SVGs add maintenance |
| Time period query params | Separate routes (/weekly, /monthly) | Query params preserve filter state; separate routes increase complexity |

**Installation:**
```bash
# No new dependencies required - all tools already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── leaderboard-table.tsx         # (exists) Enhance with trend column
│   ├── leaderboard-filters.tsx       # (exists) Add time period filter
│   ├── leaderboard/
│   │   ├── trend-indicator.tsx       # New: Rank change arrows
│   │   └── skeleton.tsx              # (exists) Loading state
│   └── FaqSchema.tsx                 # (exists) Schema injection
├── lib/
│   ├── db/queries/
│   │   └── stats.ts                  # (exists) Add getLeaderboardWithTrends()
│   ├── leaderboard/
│   │   ├── calculate-rank-changes.ts # New: Period-over-period rank delta
│   │   └── generate-leaderboard-faqs.ts # New: Dynamic FAQ generation
│   └── seo/
│       └── schemas.ts                # (exists) generateFAQPageSchema
└── app/
    └── leaderboard/
        └── page.tsx                  # (exists) Enhance with time filters, trends
```

### Pattern 1: Time Period Filtering with Query Params
**What:** Add time period filter to LeaderboardFilters, preserve state via URL params
**When to use:** Every leaderboard page
**Example:**
```typescript
// components/leaderboard-filters.tsx (enhanced)
const TIME_PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
];

export function LeaderboardFilters({ className, disabledFilters = [] }: LeaderboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTimePeriod = searchParams.get('timePeriod') || 'all';

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`/leaderboard${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [router, searchParams]);

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentTimePeriod}
          onValueChange={(value: string) => updateParams('timePeriod', value)}
        >
          <SelectTrigger className="w-[150px] bg-card/50 border-border/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Existing filters... */}
    </div>
  );
}
```

### Pattern 2: Rank Change Calculation with SQL Window Functions
**What:** Calculate previous period rank using LAG() window function, compute delta
**When to use:** Leaderboard query with time period filtering
**Example:**
```sql
-- lib/db/queries/stats.ts (getLeaderboardWithTrends)
WITH current_period AS (
  SELECT
    model_id,
    SUM(points) AS total_points,
    COUNT(*) AS total_predictions,
    ROUND(AVG(points)::numeric, 2) AS avg_points,
    RANK() OVER (ORDER BY AVG(points) DESC) AS current_rank
  FROM predictions
  WHERE
    status = 'scored'
    AND scored_at >= $1  -- Start of current period (e.g., this week)
    AND scored_at < $2   -- End of current period
  GROUP BY model_id
),
previous_period AS (
  SELECT
    model_id,
    RANK() OVER (ORDER BY AVG(points) DESC) AS previous_rank
  FROM predictions
  WHERE
    status = 'scored'
    AND scored_at >= $3  -- Start of previous period (e.g., last week)
    AND scored_at < $4   -- End of previous period
  GROUP BY model_id
)
SELECT
  c.model_id,
  c.total_points,
  c.total_predictions,
  c.avg_points,
  c.current_rank,
  p.previous_rank,
  CASE
    WHEN p.previous_rank IS NULL THEN 'new'
    WHEN p.previous_rank > c.current_rank THEN 'rising'
    WHEN p.previous_rank < c.current_rank THEN 'falling'
    ELSE 'stable'
  END AS trend_direction,
  COALESCE(p.previous_rank - c.current_rank, 0) AS rank_change
FROM current_period c
LEFT JOIN previous_period p ON c.model_id = p.model_id
ORDER BY c.current_rank ASC;
```

### Pattern 3: Trend Indicator Component
**What:** Visual indicator showing rank change (up/down arrows, color coded)
**When to use:** Leaderboard table trend column
**Example:**
```typescript
// components/leaderboard/trend-indicator.tsx
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrendIndicatorProps {
  direction: 'rising' | 'falling' | 'stable' | 'new';
  rankChange: number;
}

/**
 * Trend indicator showing rank change with semantic colors
 * - Rising: Green arrow up
 * - Falling: Red arrow down
 * - Stable: Gray minus
 * - New: Blue badge
 */
export function TrendIndicator({ direction, rankChange }: TrendIndicatorProps) {
  if (direction === 'new') {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
          New
        </span>
      </div>
    );
  }

  if (direction === 'stable') {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">-</span>
      </div>
    );
  }

  const isRising = direction === 'rising';
  const Icon = isRising ? ArrowUp : ArrowDown;
  const colorClass = isRising ? 'text-win' : 'text-loss';

  return (
    <div className={cn("flex items-center gap-1", colorClass)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">
        {Math.abs(rankChange)}
      </span>
    </div>
  );
}
```

### Pattern 4: Dynamic Leaderboard FAQ Generation
**What:** Auto-generate FAQs with current leaderboard statistics
**When to use:** Leaderboard page metadata generation
**Example:**
```typescript
// lib/leaderboard/generate-leaderboard-faqs.ts
import type { FAQItem } from '@/lib/seo/schemas';

interface LeaderboardStats {
  totalModels: number;
  totalPredictions: number;
  topModel: {
    name: string;
    avgPoints: number;
  };
  timePeriod: 'all' | 'weekly' | 'monthly';
}

export function generateLeaderboardFAQs(stats: LeaderboardStats): FAQItem[] {
  const periodLabel = stats.timePeriod === 'weekly' ? 'this week' :
                      stats.timePeriod === 'monthly' ? 'this month' :
                      'all time';

  return [
    {
      question: `What determines AI model ranking on this leaderboard?`,
      answer: `Models are ranked by average points per prediction using the Kicktipp scoring system. Points are awarded for correct tendency (2-6 points based on rarity), goal difference (+1 bonus), and exact scores (+3 bonus). Maximum 10 points per match. The leaderboard tracks ${stats.totalModels} AI models across ${stats.totalPredictions} predictions.`,
    },
    {
      question: `Which AI model is currently performing best?`,
      answer: `${stats.topModel.name} leads the leaderboard ${periodLabel} with ${stats.topModel.avgPoints.toFixed(2)} average points per match. Performance varies by time period—use the weekly/monthly filters to see recent trends versus long-term consistency.`,
    },
    {
      question: `What do the trend indicators (arrows) mean?`,
      answer: `Trend indicators show how each model's rank has changed compared to the previous ${stats.timePeriod === 'weekly' ? 'week' : stats.timePeriod === 'monthly' ? 'month' : 'period'}. Green up arrows indicate rising rank, red down arrows indicate falling rank, and gray minus signs indicate stable position. "New" badges mark models that recently started making predictions.`,
    },
    {
      question: `How often is the leaderboard updated?`,
      answer: `The leaderboard updates automatically after each match is scored, typically within minutes of the final whistle. Rankings reflect the most recent match results. Weekly and monthly views reset at the start of each period, providing fresh competitive cycles.`,
    },
    {
      question: `Can I filter leaderboard by time period or competition?`,
      answer: `Yes. Use the time period filter to view all-time, monthly, or weekly rankings. Competition filters show model performance for specific leagues (Premier League, Champions League, etc.). Combine filters to find the best model for your preferred league and timeframe.`,
    },
  ];
}
```

### Pattern 5: Enhanced Leaderboard Table with Trend Column
**What:** Add trend column to existing TanStack Table configuration
**When to use:** Leaderboard table with period-over-period data
**Example:**
```typescript
// components/leaderboard-table.tsx (enhanced columns)
const columns = useMemo<ColumnDef<LeaderboardEntryWithTrend>[]>(() => [
  // Existing columns: select, rank, model, matches, correct, exact, points, avg, accuracy...

  // New: Trend column (after accuracy, before streak)
  {
    id: 'trend',
    header: 'Trend',
    accessorFn: (row) => row.rankChange,
    cell: ({ row }) => (
      <TrendIndicator
        direction={row.original.trendDirection}
        rankChange={row.original.rankChange}
      />
    ),
    size: 80,
    meta: { align: 'center' as const },
  },

  // Existing streak column...
], []);
```

### Anti-Patterns to Avoid
- **Client-side rank comparison:** Don't calculate rank changes in React. Use SQL window functions for accuracy and performance.
- **Separate routes for time periods:** Don't create `/leaderboard/weekly` routes. Use query params to preserve filter state.
- **Hardcoded FAQ content:** Don't write static FAQs. Generate dynamically with current top model and statistics.
- **Missing previous period handling:** Don't show empty trends for new models. Mark as "new" when previous rank doesn't exist.
- **Icon-only indicators:** Don't rely solely on color/icons. Include numeric rank change for accessibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time period filtering | Custom date range picker | Predefined periods (all/monthly/weekly) | User decision: weekly/monthly/all-time (not arbitrary ranges) |
| Rank change calculation | Client-side array comparison | SQL LAG() window function | Database handles pagination correctly; client-side breaks with filtering |
| Trend arrows | Custom SVG paths | lucide-react (ArrowUp, ArrowDown, Minus) | Already in package.json, consistent with existing icons |
| FAQ rendering | Custom accordion | Native `<details>`/`<summary>` (existing pattern) | Zero-JS, accessible, proven in blog/league FAQs |
| FAQ schema | Manual JSON construction | generateFAQPageSchema() from schemas.ts | Type-safe, already tested |
| Week calculation | Custom week counter | ISO week (DATE_TRUNC('week'), EXTRACT(week)) | Standard SQL date functions handle edge cases |

**Key insight:** The leaderboard infrastructure already exists (filters, table, FAQ schema). Phase 21 is about adding time dimensions (weekly/monthly views) and trend indicators (rank change arrows), not rebuilding core components.

## Common Pitfalls

### Pitfall 1: Week Boundaries and ISO Week Numbers
**What goes wrong:** Week filtering uses incorrect boundaries (Sunday vs Monday start), causing data misalignment.
**Why it happens:** Different week numbering standards (ISO 8601 vs locale-specific).
**How to avoid:** Use ISO week standard (Monday start) consistently: `DATE_TRUNC('week', date)` in PostgreSQL, `EXTRACT(isoyear)` and `EXTRACT(week)` for ISO year/week.
**Warning signs:** Weekly leaderboard shows matches from previous/next week, data doesn't match calendar.

### Pitfall 2: Previous Period Missing for New Models
**What goes wrong:** Trend indicators show errors or empty states for models without previous period data.
**Why it happens:** New models don't have previous rank to compare against.
**How to avoid:** LEFT JOIN previous period data, handle NULL with "new" badge: `CASE WHEN p.previous_rank IS NULL THEN 'new'`.
**Warning signs:** Null pointer errors, missing trend indicators for recently added models.

### Pitfall 3: Rank Ties and Change Calculation
**What goes wrong:** Two models have identical avg points (same rank), but rank change calculation shows different values.
**Why it happens:** RANK() vs DENSE_RANK() behavior differs for ties.
**How to avoid:** Use RANK() consistently (standard competition ranking: 1, 2, 2, 4). Document tie-handling in FAQ: "Tied models share the same rank."
**Warning signs:** Users confused why Model A shows +2 rank change when they moved "one position."

### Pitfall 4: Time Period Filter Doesn't Reset Pagination
**What goes wrong:** User switches from "all time" (500 models) to "weekly" (50 models) but sees "Page 10 of 2" error.
**Why it happens:** Filter change doesn't reset page number in URL params.
**How to avoid:** Reset page param when timePeriod changes: `params.delete('page')` in updateParams callback.
**Warning signs:** Empty leaderboard after filter change, pagination errors.

### Pitfall 5: Stale FAQ Statistics
**What goes wrong:** FAQ says "35 models tracked" but leaderboard shows 50 models.
**Why it happens:** FAQ content generated once at build time, data changes after deployment.
**How to avoid:** Generate FAQs dynamically in page component with current data: `generateLeaderboardFAQs({ totalModels: leaderboard.length, ... })`.
**Warning signs:** Users report FAQ information doesn't match visible data.

### Pitfall 6: Trend Arrow Color Accessibility
**What goes wrong:** Color-blind users can't distinguish red (falling) vs green (rising) arrows.
**Why it happens:** Relying on color alone without shape/direction cues.
**How to avoid:** Use arrow direction (up vs down) as primary indicator, color as enhancement. Include numeric rank change.
**Warning signs:** WCAG 2.1 Level AA failures, accessibility audit flags color-only indicators.

## Code Examples

Verified patterns from official sources and existing codebase:

### ISO Week Filtering (SQL)
```sql
-- Source: PostgreSQL documentation, ISO 8601 standard
-- Weekly leaderboard: current ISO week
WHERE
  DATE_TRUNC('week', scored_at) = DATE_TRUNC('week', CURRENT_DATE)

-- Monthly leaderboard: current month
WHERE
  DATE_TRUNC('month', scored_at) = DATE_TRUNC('month', CURRENT_DATE)

-- ISO week extraction for grouping
SELECT
  EXTRACT(isoyear FROM scored_at) AS year,
  EXTRACT(week FROM scored_at) AS week_number,
  ...
FROM predictions
GROUP BY year, week_number
ORDER BY year DESC, week_number DESC;
```

### Time Period Query Param Handling
```typescript
// Source: Existing leaderboard-filters.tsx pattern (verified)
const updateParams = useCallback((key: string, value: string) => {
  const params = new URLSearchParams(searchParams.toString());

  if (value === 'all') {
    params.delete(key);
  } else {
    params.set(key, value);
  }

  // Reset page when changing filters
  params.delete('page');

  // Preserve sort params if they exist
  const sortParam = searchParams.get('sort');
  const orderParam = searchParams.get('order');
  if (sortParam) params.set('sort', sortParam);
  if (orderParam) params.set('order', orderParam);

  const queryString = params.toString();
  router.push(`/leaderboard${queryString ? `?${queryString}` : ''}`, { scroll: false });
}, [router, searchParams]);
```

### Rank Icon with Trophy/Medal (Existing Pattern)
```typescript
// Source: src/components/leaderboard-table.tsx (verified)
const getRankIcon = (index: number) => {
  switch (index) {
    case 0:
      return <Trophy className="h-5 w-5 text-yellow-400" />;
    case 1:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 2:
      return <Award className="h-5 w-5 text-orange-400" />;
    default:
      return <span className="text-muted-foreground font-mono">{index + 1}</span>;
  }
};
```

### Semantic Color Classes (Existing Tokens)
```typescript
// Source: src/app/globals.css (verified OKLCH tokens)
const trendColorClass = cn(
  direction === 'rising' && "text-win",      // --win: oklch(0.55 0.17 162.5) green
  direction === 'falling' && "text-loss",    // --loss: oklch(0.55 0.22 25.3) red
  direction === 'stable' && "text-muted-foreground"
);
```

### Combined Schema Graph (Existing Pattern)
```typescript
// Source: Existing leaderboard page.tsx (verified)
const breadcrumbs = buildBreadcrumbSchema([
  { name: 'Home', url: BASE_URL },
  { name: 'Leaderboard', url: `${BASE_URL}/leaderboard` },
]);
const faqSchema = generateFAQPageSchema(faqs);

const schema = {
  '@context': 'https://schema.org',
  '@graph': [breadcrumbs, faqSchema],
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static all-time leaderboards | Time period filters (weekly/monthly) | 2020+ best practice | Increases engagement, shows recent performance vs consistency |
| Rank number only | Rank change indicators (arrows, colors) | 2018+ analytics dashboards | Provides trend context, highlights rising/falling performers |
| Client-side rank comparison | SQL window functions (LAG/LEAD) | Always (SQL capability) | Accurate with pagination, performant for large datasets |
| Static FAQ content | Dynamic FAQ generation with live stats | 2024-2026 GEO optimization | Fresh content for AI crawlers, accurate information |
| Google FAQ rich snippets | AI platform citation (ChatGPT, Perplexity) | August 2023 restriction | FAQ schema now targets GEO/AEO, not just rich results |

**Deprecated/outdated:**
- **All-time-only leaderboards:** Modern leaderboards provide multiple time views (weekly/monthly/all-time) to show both recent trends and long-term performance. Weekly views create "fresh start" engagement cycles.
- **Rank number without context:** Showing rank position alone misses trend context. Modern analytics dashboards always include period-over-period comparison (arrows, percentage change).
- **Static leaderboard pages:** Dynamic filtering (competition, time period, minimum predictions) is now expected. Users want to slice data by their interests.

## Open Questions

Things that couldn't be fully resolved:

1. **Week Start Convention**
   - What we know: ISO 8601 uses Monday as week start, but some locales use Sunday
   - What's unclear: Project convention for "weekly" leaderboards
   - Recommendation: Use ISO week standard (Monday start) for consistency with PostgreSQL DATE_TRUNC('week'). Document in FAQ.

2. **Monthly Rollover Timing**
   - What we know: Monthly leaderboards should reset each month
   - What's unclear: Timezone handling for month boundaries (UTC vs user timezone)
   - Recommendation: Use UTC consistently for server-side queries. Monthly leaderboard runs calendar month in UTC.

3. **"New" Badge Threshold**
   - What we know: Models without previous period rank should show "new" badge
   - What's unclear: How many periods until no longer "new"? (1 week? 1 month?)
   - Recommendation: Mark as "new" only when previous period has NULL rank. After one period with rank, show normal trend. Simple and clear.

4. **Trend Indicator for Filtered Views**
   - What we know: Rank change makes sense for time periods, less clear for competition filters
   - What's unclear: Should competition filter ("Premier League only") show rank changes within that competition, or globally?
   - Recommendation: Rank change always applies to current view. If filtered to Premier League + weekly, show rank change within "Premier League this week" context.

5. **Mobile Trend Display**
   - What we know: Mobile card layout already exists in leaderboard-table.tsx
   - What's unclear: Best placement for trend indicator in mobile view (header, stats row, separate line?)
   - Recommendation: Add trend next to rank icon in mobile card header. Follows existing pattern of rank icon + name in single row.

## Sources

### Primary (HIGH confidence)
- [Schema Markup in 2026: Why It's Now Critical for SERP Visibility](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) - Current structured data practices
- [Why FAQs Matter for SEO & AI Search](https://www.globalreach.com/global-reach-media/blog/2025/10/16/why-faqs-matter-for-seo-ai-search) - FAQ schema for GEO/AEO optimization
- [How to Analyze a Time Series in SQL](https://learnsql.com/blog/how-to-analyze-time-series-in-sql/) - SQL window functions for period-over-period analysis
- [Week-over-week comparison SQL](https://campus.datacamp.com/courses/reporting-in-sql/complex-calculations?ex=11) - LAG() pattern for weekly comparisons
- [Bump Charts Explained: How to Visualize Rank Changes Over Time](https://www.domo.com/learn/charts/bump-charts) - Rank change visualization
- Existing codebase: `src/components/leaderboard-table.tsx`, `src/components/leaderboard-filters.tsx`, `src/app/leaderboard/page.tsx`, `src/components/league/league-trend-chart.tsx` - Verified implementation patterns

### Secondary (MEDIUM confidence)
- [Leaderboard design pattern - UI Patterns](https://ui-patterns.com/patterns/leaderboard) - Leaderboard UX best practices
- [Increase Competitiveness in Users with Leader Boards - IxDF](https://www.interaction-design.org/literature/article/increase-competitiveness-in-users-with-leader-boards) - Dynamic updates, ranking changes
- [Trend Indicators - up or down arrows - Qlik Community](https://community.qlik.com/t5/Visualization-and-Usability/Trend-Indicators-up-or-down-arrows/td-p/1648560) - Arrow indicator best practices
- [Rankings Change Metrics Overview - AgencyAnalytics](https://help.agencyanalytics.com/en/articles/4800259-rankings-change-metrics-overview) - Rank change calculation formulas
- [Why FAQs in SEO Matter in 2026: A Hidden Ranking Powerhouse](https://seizemarketingagency.com/faqs-in-seo/) - FAQ impact on AI search platforms
- [The rise and fall of FAQ schema – Search Engine Land](https://searchengineland.com/faq-schema-rise-fall-seo-today-463993) - Google's August 2023 restriction context

### Tertiary (LOW confidence)
- WebSearch results for "time period filters weekly monthly all-time" - General guidance, not leaderboard-specific
- [UI/UX Design Trends That Will Dominate 2026](https://www.index.dev/blog/ui-ux-design-trends) - General UI trends, not data visualization-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, SQL window functions are native PostgreSQL
- Architecture: HIGH - Patterns directly extend existing implementations (leaderboard-table.tsx, leaderboard-filters.tsx)
- Time period filtering: HIGH - SQL DATE_TRUNC and ISO week are standard, well-documented
- Trend calculation: HIGH - LAG() window function is established pattern for period comparison
- Pitfalls: MEDIUM - Based on SQL documentation and common leaderboard issues, some project-specific

**Research date:** 2026-02-03
**Valid until:** ~30 days (stable domain - leaderboard patterns and SQL window functions are mature)
