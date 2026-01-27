---
phase: 03-stats-ui
plan: "01"
subsystem: stats-ui
tags: ["tanstack-table", "react-table", "leaderboard", "refactoring"]
---

# Phase 3 Plan 1: TanStack Table Integration Summary

**Plan:** 03-01 TanStack Table Integration  
**Completed:** 2026-01-27  
**Tasks:** 3/3

## Objective

Refactor existing leaderboard table to use TanStack Table v8 for maintainable column definitions and sorting logic.

## Key Decisions Made

### Column Definition Strategy

Chose to define columns inline within the component for simplicity and to avoid circular dependency issues with React components like `Link`. The column definitions include:

- **9 total columns**: Rank, Model, Matches, Correct, Exact, Points, Avg/Match, Accuracy, Streak
- **Computed accuracy column**: Calculates `(correctTendencies / totalPredictions) * 100` with visual progress bar
- **Mixed accessor types**: Some use `accessorKey`, others use `accessorFn` for computed values
- **Sortable columns**: Rank and Streak are display-only; all others are sortable

### URL State Synchronization

Preserved existing URL-based sort state pattern:
- Read initial sort from URL params (`sort` and `order`)
- Update URL when user clicks column headers
- Default sort: `averagePoints` descending

### Mobile View Preservation

Kept mobile card view completely unchanged and integrated it with TanStack Table by using `table.getRowModel().rows` for both desktop table and mobile cards. This ensures consistent sorting behavior across both views.

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added `@tanstack/react-table@8.21.3` dependency |
| `src/lib/table/columns.tsx` | Created with 9 TanStack Table column definitions |
| `src/components/leaderboard-table.tsx` | Refactored to use useReactTable hook |

## Column Definitions Structure

```typescript
// 9 columns created with createColumnHelper pattern
- Rank: Display column, shows Trophy/Medal/Award icons for top 3
- Model: Accessor for displayName, renders Link to /models/{modelId}
- Matches: Accessor for totalPredictions
- Correct: Accessor function for correctTendencies ?? correctResults
- Exact: Accessor for exactScores
- Points: Accessor for totalPoints
- Avg/Match: Accessor for averagePoints with color-coded styling
- Accuracy: Computed column with progress bar visualization
- Streak: Display column showing flame/snowflake icons for streaks
```

## Integration Approach

### TanStack Table Hook Usage

```typescript
const table = useReactTable({
  data: entries,
  columns,
  state: { sorting },
  onSortingChange: onSortingChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

### Header Rendering with flexRender

```typescript
{headerGroup.headers.map(header => (
  <th onClick={header.column.getToggleSortingHandler()}>
    <div className="flex items-center">
      {flexRender(header.column.columnDef.header, header.getContext())}
      {getSortIcon(header.column.id)}
    </div>
  </th>
))}
```

### Row Rendering

```typescript
{table.getRowModel().rows.map((row, index) => (
  <tr className={cn(index < 3 && "bg-.../5")}>
    {row.getVisibleCells().map(cell => (
      <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
    ))}
  </tr>
))}
```

## Gotchas & Edge Cases Handled

1. **TypeScript `unknown` types**: Accessor functions return `unknown`, required explicit casting in cell renderers
2. **Null/undefined values**: Used nullish coalescing (`??`) for optional fields like `exactScores`, `correctTendencies`
3. **Circular dependencies**: Avoided importing React components in column definitions by defining them inline
4. **URL sync**: TanStack Table's sorting state syncs with Next.js router for bookmarkable URLs
5. **Mobile card integration**: Both views use same sorted data source (`table.getRowModel().rows`)

## Tech Stack Changes

- **Added**: `@tanstack/react-table` v8.21.3

## Future Extensibility

With TanStack Table integration, adding new columns is now straightforward:
1. Add column definition to the columns array
2. Optionally add to separate columns.ts file for reusability
3. Sorting and filtering work automatically for accessor-based columns

## Verification Steps

- [x] TypeScript compilation succeeds
- [x] useReactTable hook imported and used
- [x] 9 column definitions created
- [x] Desktop table renders with flexRender
- [x] Mobile card view preserved
- [x] URL state sync works
- [x] All icons and visual indicators preserved
