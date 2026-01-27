---
phase: 03-stats-ui
plan: "03"
type: execute
subsystem: ui-components
tags: [react, skeleton, modal, comparison, tanstack-table]
---

# Phase 3 Plan 03-03: Comparison Modal and Skeleton Loading Summary

## Objective
Add model comparison modal and skeleton loading states to complete the stats UI phase.

## Key Deliverables

### 1. Skeleton Loading Component
- **File:** `src/components/leaderboard/skeleton.tsx`
- **Purpose:** Provides visual loading placeholder matching table structure
- **Features:**
  - 5 skeleton rows mirroring actual table layout
  - Desktop table skeleton with columns for rank, model, matches, correct, exact, points, avg/match, accuracy, streak
  - Mobile card skeleton with rounded borders and grid layout
  - Uses react-loading-skeleton library

### 2. Comparison Modal
- **File:** `src/components/leaderboard/compare-modal.tsx`
- **Purpose:** Side-by-side comparison of selected models
- **Features:**
  - Radix UI Dialog for accessibility
  - Compares up to 4 models side-by-side
  - Stats compared: Total Points, Avg/Match, Matches, Correct, Exact, Accuracy, Current Streak, Best Streak, Worst Streak
  - Best value in each row highlighted in green
  - Responsive layout with horizontal scroll on small screens

### 3. Row Selection in LeaderboardTable
- **File:** `src/components/leaderboard-table.tsx`
- **Changes:**
  - Added checkbox column for row selection
  - Sticky "Compare Selected" button when rows are selected
  - CompareModal integration
  - Mobile cards include checkboxes for selection

### 4. Skeleton Fallbacks
- **Updated Pages:**
  - `src/app/leaderboard/page.tsx`
  - `src/app/leaderboard/competition/[id]/page.tsx`
  - `src/app/leaderboard/club/[id]/page.tsx`

## Files Created/Modified

### Created
- `src/components/leaderboard/skeleton.tsx` (65 lines)
- `src/components/leaderboard/compare-modal.tsx` (260 lines)

### Modified
- `src/components/leaderboard-table.tsx` (added row selection, comparison modal, checkbox column)
- `src/app/leaderboard/page.tsx` (added LeaderboardTableSkeleton import and usage)
- `src/app/leaderboard/competition/[id]/page.tsx` (added LeaderboardTableSkeleton import and usage)
- `src/app/leaderboard/club/[id]/page.tsx` (added LeaderboardTableSkeleton import and usage)
- `package.json` (added react-loading-skeleton dependency)

## Tech Stack Additions

### Dependencies
- `react-loading-skeleton` - Loading placeholder library

### Patterns Established
- TanStack Table row selection integration
- Radix UI Dialog for modal component
- Responsive skeleton loading with desktop/mobile variants
- Model comparison with best-value highlighting

## Usage

### Selecting Models for Comparison
1. Visit any leaderboard page (/leaderboard, /leaderboard/competition/[id], /leaderboard/club/[id])
2. Use checkboxes to select 2-4 models
3. Click "Compare Selected" button that appears
4. Modal opens with side-by-side comparison

### Skeleton Loading
- Skeleton appears automatically while data fetches
- Mirrors actual table structure to prevent layout shift
- Smooth animation using react-loading-skeleton

## UX Decisions

### Comparison Modal
- Maximum 4 models to prevent horizontal scroll issues
- Best value in each row highlighted green for easy comparison
- Shows both positive and negative streaks (e.g., +3 correct, -2 wrong)
- Empty state with helpful message when no models selected

### Skeleton Design
- 5 placeholder rows (matches typical data density)
- Both desktop table and mobile card variants
- Uses existing design system colors (muted, primary, etc.)

## Verification
- All files created with correct imports and exports
- Integration with TanStack Table rowSelection working
- Suspense fallbacks updated on all leaderboard pages
- Native checkbox inputs (no external component dependency)

## Dependencies
- **Requires:** Plans 03-01 (TanStack Table), 03-02 (LeaderboardTable component) completed
- **Provides:** Complete stats UI phase with loading states and comparison features

---

*Completed: 2026-01-27*
*Duration: Plan execution in Phase 3 wave 2*
