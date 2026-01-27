---
phase: 03-stats-ui
verified: 2026-01-27T13:45:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "Filter component has season selector"
    status: failed
    reason: "LeaderboardFilters component has no season selector UI. Season is accepted as URL parameter but no dropdown exists."
    artifacts:
      - path: "src/components/leaderboard-filters.tsx"
        issue: "No season selector component - only competition, club, timeRange, minPredictions filters exist"
    missing:
      - "Season selector dropdown in LeaderboardFilters component"
      - "SEASON_OPTIONS constant (similar to TIME_RANGE_OPTIONS)"
      - "Season filter update in updateParams callback"
  - truth: "Filter component has model selector"
    status: failed
    reason: "LeaderboardFilters has no model selector. Only minPredictions filter exists (line 159-176)."
    artifacts:
      - path: "src/components/leaderboard-filters.tsx"
        issue: "No model selector - only minPredictions (how many predictions, not which model) filter exists"
    missing:
      - "Model selector dropdown to filter by specific LLM model"
      - "MODEL_OPTIONS constant with model choices"
      - "Model filter update in updateParams callback"
---

# Phase 3: Stats UI Verification Report

**Phase Goal:** Leaderboard pages with sortable tables, filtering UI, and responsive design.

**Verified:** 2026-01-27
**Status:** gaps_found
**Score:** 3/5 must-haves verified

---

## Goal Achievement

### Observable Truths

| #   | Truth                                           | Status     | Evidence                                          |
| --- | ------------------------------------------------ | ---------- | ------------------------------------------------- |
| 1   | Sortable table UI with TanStack Table            | ✓ VERIFIED | `useReactTable` at line 7, `getSortedRowModel` at line 9 in leaderboard-table.tsx |
| 2   | Competition-specific leaderboard pages exist     | ✓ VERIFIED | `src/app/leaderboard/competition/[id]/page.tsx` (235 lines) exists and is fully implemented |
| 3   | Club-specific leaderboard pages exist            | ✓ VERIFIED | `src/app/leaderboard/club/[id]/page.tsx` (236 lines) exists and is fully implemented |
| 4   | Filter component: Season selector                | ✗ FAILED   | No season selector in leaderboard-filters.tsx. Pages accept `season` param but no UI control |
| 5   | Filter component: Competition selector           | ✓ VERIFIED | Lines 96-115 in leaderboard-filters.tsx with COMPETITION_OPTIONS |
| 6   | Filter component: Club selector                  | ✓ VERIFIED | Lines 117-136 in leaderboard-filters.tsx with CLUB_OPTIONS |
| 7   | Filter component: Model selector                 | ✗ FAILED   | No model selector. Only `minPredictions` filter exists (lines 159-176) |
| 8   | Filter component: Date range picker              | ✓ VERIFIED | TIME_RANGE_OPTIONS at lines 30-35 with dropdown selector (time period, not date range picker) |
| 9   | Responsive design                                | ✓ VERIFIED | `hidden md:block` at line 507, `md:hidden` at line 572, MobileCard component at line 361 |

### Required Artifacts

| Artifact                                              | Expected    | Status      | Details                                             |
| ----------------------------------------------------- | ----------- | ----------- | --------------------------------------------------- |
| `src/components/leaderboard-table.tsx`                | TanStack Table | ✓ VERIFIED  | 580 lines, `useReactTable` with sorting, row selection |
| `src/app/leaderboard/competition/[id]/page.tsx`       | Competition page | ✓ VERIFIED  | Full implementation with API fetching, filters, skeleton |
| `src/app/leaderboard/club/[id]/page.tsx`              | Club page   | ✓ VERIFIED  | Full implementation with API fetching, filters, skeleton |
| `src/components/leaderboard-filters.tsx`              | Filters UI  | ✓ VERIFIED  | 180 lines with competition, club, timeRange, minPredictions |
| `src/app/leaderboard/page.tsx`                        | Overall page | ✓ VERIFIED  | 207 lines with leaderboard table, filters, FAQ schema |

### Key Link Verification

| From                      | To                           | Via                          | Status      | Details                                           |
| ------------------------- | ---------------------------- | ---------------------------- | ----------- | ------------------------------------------------- |
| `LeaderboardTable`        | `LeaderboardFilters`         | URL params (`sort`, `order`) | ✓ WIRED     | Sorting synced to URL, filter params preserved    |
| `competition/[id]/page`   | `/api/stats/competition/{id}`| `fetchCompetitionStats()`    | ✓ WIRED     | Full API integration with auth header             |
| `club/[id]/page`          | `/api/stats/club/{id}`       | `fetchClubStats()`           | ✓ WIRED     | Full API integration with auth header             |
| `leaderboard-filters`     | URL                          | `router.push()`              | ✓ WIRED     | Updates URL params without page reload            |
| `LeaderboardTable`        | Mobile view                  | `md:hidden` classes          | ✓ WIRED     | Responsive MobileCard component for small screens |

### Requirements Coverage (from ROADMAP.md)

| Requirement                        | Status     | Notes                                                    |
| ---------------------------------- | ---------- | -------------------------------------------------------- |
| STATS-14: Sortable table UI        | ✓ SATISFIED | TanStack Table with full sorting implementation          |
| Overall leaderboard page           | ✓ SATISFIED | `/leaderboard/page.tsx` with all metrics                 |
| Competition-specific leaderboards  | ✓ SATISFIED | `/leaderboard/competition/[id]/page.tsx`                 |
| Club-specific leaderboard pages    | ✓ SATISFIED | `/leaderboard/club/[id]/page.tsx`                        |
| Filter: Season selector            | ✗ BLOCKED  | API accepts season param, but no UI selector             |
| Filter: Competition selector       | ✓ SATISFIED | Full selector with 11 competition options                |
| Filter: Club selector              | ✓ SATISFIED | Full selector with 19 club options                       |
| Filter: Model selector             | ✗ BLOCKED  | No model selector UI                                     |
| Filter: Date range picker          | ✓ SATISFIED | TIME_RANGE_OPTIONS dropdown (All Time, 7d, 30d, 90d)     |

### Anti-Patterns Found

| File                    | Line | Pattern         | Severity | Impact                                        |
| ----------------------- | ---- | --------------- | -------- | --------------------------------------------- |
| -                       | -    | No anti-patterns found | -        | -                                             |

**Note:** The codebase is clean. No TODO/FIXME stubs, no empty implementations, no placeholder content.

### Human Verification Required

None required. All features can be verified programmatically.

---

## Gaps Summary

### Gap 1: Missing Season Selector

**Issue:** The `LeaderboardFilters` component does not have a season selector dropdown. While the API and pages accept a `season` parameter via URL searchParams, there's no UI control for users to select seasons.

**Current state:**
- Pages read `searchParams.season` but no selector exists
- `TIME_RANGE_OPTIONS` provides time-based filtering but not season-based
- No `SEASON_OPTIONS` constant defined

**Fix needed:**
Add season selector component similar to time range selector with:
```typescript
const SEASON_OPTIONS = [
  { value: '2024-2025', label: '2024/25' },
  { value: '2023-2024', label: '2023/24' },
  // ...
];
```

### Gap 2: Missing Model Selector

**Issue:** The `LeaderboardFilters` component has a `minPredictions` filter (how many predictions a model must have) but no `model` selector to filter by specific LLM model.

**Current state:**
- Only `minPredictions` dropdown (0, 3+, 5+, 10+ predictions)
- No way to select and view a specific model's performance
- No `MODEL_OPTIONS` constant

**Fix needed:**
Add model selector to filter leaderboard by specific model:
```typescript
// Would require fetching available models or hardcoding popular ones
const MODEL_OPTIONS = [
  { id: 'model-1', name: 'GPT-4o' },
  { id: 'model-2', name: 'Claude 3.5 Sonnet' },
  // ...
];
```

---

## Status: GAPS_FOUND

Phase 3 goal is **partially achieved**. Core functionality exists:
- ✅ Sortable TanStack Table implementation
- ✅ Competition-specific pages
- ✅ Club-specific pages
- ✅ Competition selector
- ✅ Club selector
- ✅ Time period filter
- ✅ Responsive design

**Blocking gaps:**
- ❌ No season selector UI (API supports it, but users can't select)
- ❌ No model selector UI (only min predictions filter)

These gaps should be addressed before considering the phase complete.

---

_Verified: 2026-01-27T13:45:00Z_
_Verifier: Claude (gsd-verifier)_
