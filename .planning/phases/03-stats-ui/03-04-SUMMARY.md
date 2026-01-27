---
phase: 03-stats-ui
plan: 04
subsystem: ui
tags: [leaderboard, filters, url-state]
completed: 2026-01-27
duration: "2m"
---

# Phase 3 Plan 4: Season and Model Selectors Summary

## Objective
Add missing Season and Model selectors to LeaderboardFilters to complete Phase 3 requirements identified in VERIFICATION.md gaps.

## One-Liner
Season and model dropdown filters added to LeaderboardFilters with URL state sync.

## Files Modified

| File | Changes |
|------|---------|
| `src/components/leaderboard-filters.tsx` | Added SEASON_OPTIONS, MODEL_OPTIONS, season selector, model selector |

## Key Files Created

None - existing component extended.

## Dependency Graph

- **Requires:** Phase 3 plans 03-01, 03-02, 03-03 (LeaderboardFilters baseline)
- **Provides:** Season and model filtering capability for leaderboard pages
- **Affects:** All leaderboard pages (`/leaderboard`, `/leaderboard/competition/:id`, `/leaderboard/club/:id`)

## Tech Stack Updates

### Added Libraries
None - existing dependencies used.

### Established Patterns
- URL searchParams pattern for filter state management
- disabledFilters prop for conditional filter availability
- Lucide icon usage for filter type indication

## Season Selector Structure

```typescript
const SEASON_OPTIONS = [
  { value: 'all', label: 'All Seasons' },
  { value: '2024-2025', label: '2024/25' },
  { value: '2023-2024', label: '2023/24' },
  { value: '2022-2023', label: '2022/23' },
  { value: '2021-2022', label: '2021/22' },
];
```

- **Position:** Between Club selector and Time Range selector
- **Icon:** Calendar (reused from time range)
- **Default:** 'all' (reads from `searchParams.get('season') || 'all'`)
- **Disabled support:** Respects `disabledFilters.includes('season')`

## Model Selector Structure

```typescript
const MODEL_OPTIONS = [
  { value: 'all', label: 'All Models' },
  { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B' },
  { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B' },
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { value: 'openai/gpt-4o-2024-08-06', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini-2024-07-18', label: 'GPT-4o Mini' },
  { value: 'google/gemini-1.5-flash-002', label: 'Gemini 1.5 Flash' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
];
```

- **Position:** After Min Predictions filter (end of filter row)
- **Icon:** Cpu (new import from lucide-react)
- **Default:** 'all' (reads from `searchParams.get('model') || 'all'`)
- **Disabled support:** Respects `disabledFilters.includes('model')`

## URL State Sync Pattern

Both selectors use the existing `updateParams` callback which:

1. Reads current searchParams
2. If value === 'all', deletes the param
3. Otherwise sets the param value
4. Preserves sort/order params
5. Updates URL without page scroll

```typescript
// Generic handler used for all filters including new ones
const updateParams = useCallback((key: string, value: string) => {
  const params = new URLSearchParams(searchParams.toString());
  if (value === 'all' || value === '0') {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  // ... preserve sort params
  router.push(`/leaderboard${queryString ? `?${queryString}` : ''}`, { scroll: false });
}, [router, searchParams]);
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Reuse Calendar icon for season | Consistent with time period filtering, both temporal filters |
| Add Cpu icon for model | Visual distinction from competition/club (Trophy/Home) and time (Calendar) |
| Position season between club and timeRange | Logical grouping: entity (competition/club) → season → time range |
| Position model at end | Last filter, doesn't fit semantic grouping with others |

## Deviations from Plan

**None** - Plan executed exactly as written.

## Authentication Gates

None - all work done locally with existing codebase.

## Verification Results

| Check | Result |
|-------|--------|
| SEASON_OPTIONS constant present | ✓ |
| MODEL_OPTIONS constant present | ✓ |
| Season Select component present | ✓ |
| Model Select component present | ✓ |
| Calendar icon imported | ✓ |
| Cpu icon imported | ✓ |
| URL state sync via updateParams | ✓ (generic handler) |
| File size (was 180, now 245) | ✓ |
| npm run build | ✓ (no new errors) |

## Next Phase Readiness

Phase 3 completion blockers:
- None - All gap closure tasks complete

Ready for:
- Phase 4: Analytics Dashboard
- Or continuation of Phase 3 if additional gaps identified
