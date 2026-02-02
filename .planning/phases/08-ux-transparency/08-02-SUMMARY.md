---
phase: 08-ux-transparency
plan: 02
subsystem: ui-components
status: complete
completed: 2026-02-02
duration: 3 min
tags: [ui, tooltip, accuracy, transparency, user-trust]
requires: ["08-01"]
provides: ["accuracy-display-integration"]
affects: ["leaderboard", "model-pages", "stats-displays"]
key-files:
  created: []
  modified:
    - src/components/leaderboard-table.tsx
    - src/app/models/[id]/page.tsx
    - src/components/model-stats-grid.tsx
    - src/components/model-competition-breakdown.tsx
decisions: []
tech-stack:
  patterns:
    - "Radix UI tooltips for interactive help"
    - "Consistent accuracy display format: X/Y (Z%)"
    - "Monospace font for number readability"
---

# Phase 08 Plan 02: Accuracy Display Integration Summary

**One-liner:** Integrated AccuracyDisplay component across all accuracy displays in app (leaderboard, model pages, stats grids) showing "X/Y (Z%)" format with methodology tooltips

## What Was Delivered

### Core Implementation

**1. Leaderboard Table Integration** (src/components/leaderboard-table.tsx)
- Updated desktop table accuracy column to use AccuracyDisplay
- Updated mobile card accuracy section with AccuracyDisplay
- Retained progress bar gradient for visual continuity
- Removed title attributes from streak indicators (prepare for future Radix tooltips)
- Accuracy now shows "81/160 (50.6%)" instead of just "50.6%"

**2. Model Detail Page Hero** (src/app/models/[id]/page.tsx)
- Replaced percentage-only tendencyAccuracy display with AccuracyDisplay
- Uses size="lg" for prominence in hero stats card
- Correct denominator: correctTendencies / scoredPredictions
- Numbers match leaderboard exactly for consistency

**3. Model Stats Grid** (src/components/model-stats-grid.tsx)
- Added conditional rendering for Accuracy stat card
- Uses AccuracyDisplay with size="md" and centered layout
- Integrates seamlessly with other stat cards

**4. Competition Breakdown Table** (src/components/model-competition-breakdown.tsx)
- Replaced accuracy percentage cell with AccuracyDisplay
- Uses size="sm" for table density
- Shows denominator for each competition's accuracy

### Data Correctness Verification

**Confirmed totalPredictions = scoredPredictions:**
- Verified getLeaderboard() query in src/lib/db/queries/stats.ts (lines 362-365)
- Query uses: `leftJoin(predictions, and(eq(predictions.modelId, models.id), eq(predictions.status, 'scored')))`
- Therefore: `totalPredictions = COUNT(predictions.id)` only counts scored predictions
- This is the CORRECT denominator for accuracy calculation

**Accuracy formula consistently applied:**
```typescript
accuracy = Math.round((correctTendencies / totalPredictions) * 100)
```
Where totalPredictions = COUNT of predictions with status='scored'

## User Experience Impact

**Before this plan:**
- Users saw "50.6%" with no context
- No way to verify accuracy claims
- Sample size hidden
- No explanation of methodology

**After this plan:**
- Users see "81/160 (50.6%)" - denominator reveals sample size
- Hover shows tooltip: "81 correct predictions out of 160 scored matches"
- Link to /methodology for full explanation
- HelpCircle icon signals interactive help
- Consistent format across all accuracy displays

**Trust-building mechanics:**
1. **Denominator visibility** - Users can verify accuracy themselves: 81/160 = 50.6% ✓
2. **Tooltip education** - Explains "tendency accuracy" vs other metrics
3. **Methodology link** - Full transparency on calculation approach
4. **Consistency** - Same format everywhere reduces cognitive load

## Technical Details

### Component Integration Pattern

All components now use AccuracyDisplay with appropriate size variants:

```tsx
// Leaderboard table (compact)
<AccuracyDisplay correct={correct} total={total} size="sm" />

// Stats grid (medium)
<AccuracyDisplay correct={stats.correctTendencies} total={stats.totalPredictions} size="md" />

// Model page hero (prominent)
<AccuracyDisplay correct={predictionStats?.correctTendencies || 0} total={scoredPredictions} size="lg" />
```

### Size Variants
- **sm:** text-xs (leaderboard table, competition breakdown)
- **md:** text-sm (stats grid, default)
- **lg:** text-base (model page hero, requires className="text-4xl" override for prominence)

### Tooltip Content Structure
1. **Bold title:** "Tendency Accuracy"
2. **Contextual explanation:** "{correct} correct predictions out of {total} scored matches"
3. **Learn more link:** Links to /methodology page

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 8c13f94 | feat(08-02): integrate AccuracyDisplay in leaderboard table | src/components/leaderboard-table.tsx |
| c267d4e | feat(08-02): integrate AccuracyDisplay in model detail hero | src/app/models/[id]/page.tsx |
| 1dd1a18 | feat(08-02): integrate AccuracyDisplay in stats grid and competition breakdown | src/components/model-stats-grid.tsx, src/components/model-competition-breakdown.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

**Build verification:** ✅
```bash
npm run build  # Success - no errors
```

**Visual verification locations:**
1. /leaderboard - Desktop table and mobile cards show "X/Y (Z%)"
2. /models/[id] - Hero stats accuracy card shows "X/Y (Z%)"
3. /models/[id] - Stats grid accuracy card shows "X/Y (Z%)"
4. /models/[id] - Competition breakdown table shows "X/Y (Z%)" per league

**Tooltip verification:**
- Hover on any accuracy display → tooltip appears
- Tooltip shows "Tendency Accuracy" title
- Tooltip shows contextual explanation
- "Learn how we calculate accuracy" link present
- Link goes to /methodology

**Cross-page consistency check:**
For any model (e.g., gpt-4o):
1. Leaderboard shows "81/160 (50.6%)"
2. Model page hero shows "81/160 (50.6%)"
3. Stats grid shows "81/160 (50.6%)"
4. Numbers match exactly (same data source)

## Success Criteria

- [x] All accuracy displays show "X/Y (Z%)" format (UX-01)
- [x] All accuracy displays have hover tooltip explaining methodology (UX-02)
- [x] Leaderboard accuracy matches model page accuracy for same model (UX-03)
- [x] Accuracy percentage = correctTendencies / totalPredictions * 100 (verified via query)
- [x] Tooltip links to /methodology page for full explanation
- [x] Build passes and no visual regressions

## Next Phase Readiness

**Phase 8 Plan 03 can proceed immediately:**
- Tooltip infrastructure complete (08-01)
- AccuracyDisplay integrated everywhere (08-02)
- Ready for data loading states and error boundaries (08-03)

**No blockers identified.**

## Metrics

- **Execution time:** 3 minutes
- **Files modified:** 4
- **Commits:** 3 (atomic per task)
- **Build time:** ~60s (no regressions)

## Key Learnings

1. **Data source verification critical** - Confirmed totalPredictions = scoredPredictions before implementation
2. **Size variants matter** - Different contexts need different text sizes (sm/md/lg)
3. **Visual continuity preserved** - Kept progress bar in leaderboard for gradient effect
4. **Title attributes removed** - Prepare for future Radix tooltip standardization

## Documentation References

- Tooltip infrastructure: `.planning/phases/08-ux-transparency/08-01-SUMMARY.md`
- Methodology page: `/methodology` (created in Phase 6)
- Accuracy calculation: `src/lib/db/queries/stats.ts` getLeaderboard() lines 362-365
- Component API: `src/components/accuracy-display.tsx`

---

*Summary created: 2026-02-02 | Phase 8 Plan 02 | Accuracy Display Integration*
