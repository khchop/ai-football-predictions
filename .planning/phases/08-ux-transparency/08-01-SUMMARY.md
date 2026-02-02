---
phase: 08-ux-transparency
plan: 01
subsystem: UI Components
tags: [tooltip, radix-ui, component-library, ux]
requires:
  - 07-03 (SEO Finalization - foundation complete)
provides:
  - Radix tooltip primitives (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent)
  - AccuracyDisplay component with denominator format
  - Global tooltip configuration in layout
affects:
  - 08-02 (Model Leaderboard Integration - will use AccuracyDisplay)
  - 08-03 (Match Details Integration - will use AccuracyDisplay)
tech-stack:
  added:
    - "@radix-ui/react-tooltip@1.2.8"
  patterns:
    - shadcn/ui component pattern
    - Radix primitive wrapping
    - Global provider pattern
key-files:
  created:
    - src/components/ui/tooltip.tsx
    - src/components/accuracy-display.tsx
  modified:
    - src/app/layout.tsx
    - package.json
decisions:
  - id: tooltip-provider-placement
    decision: "Place TooltipProvider in layout.tsx wrapping Navigation/main/Footer"
    rationale: "Single provider at app level avoids nesting providers in child components"
    alternatives: "Per-page providers would require duplication and configuration drift"
  - id: denominator-format
    decision: "Show accuracy as 'X/Y (Z%)' with font-mono for numbers"
    rationale: "Transparency requires showing denominator; monospace improves number readability"
    alternatives: "Percentage-only format hides sample size information"
  - id: tooltip-delays
    decision: "delayDuration=300ms, skipDelayDuration=100ms"
    rationale: "Balance between responsive tooltips and avoiding accidental triggers"
    alternatives: "Lower delays feel twitchy; higher delays feel sluggish"
metrics:
  duration: "2.1 minutes"
  completed: "2026-02-02"
---

# Phase 8 Plan 01: Tooltip Infrastructure Summary

**One-liner:** Radix tooltip primitives with AccuracyDisplay component showing "X/Y (Z%)" format and methodology tooltips

## What Was Built

Created foundational tooltip infrastructure for UX transparency phase:

1. **Tooltip Primitives** (`src/components/ui/tooltip.tsx`)
   - Installed @radix-ui/react-tooltip@1.2.8
   - Wrapped Radix primitives following shadcn/ui pattern
   - Inverted color scheme (bg-foreground, text-background)
   - Smooth animations: fade, zoom, slide-in from each direction
   - Exports: TooltipProvider, Tooltip, TooltipTrigger, TooltipContent

2. **AccuracyDisplay Component** (`src/components/accuracy-display.tsx`)
   - Shows accuracy in "X/Y (Z%)" format with denominator visible
   - Props: `correct`, `total`, `showBar?`, `size?`, `className?`
   - HelpCircle icon indicates interactive tooltip
   - Tooltip content:
     - Bold title: "Tendency Accuracy"
     - Description: "{correct} correct predictions out of {total} scored matches"
     - Link to /methodology page
   - Size variants: sm, md (default), lg
   - Optional progress bar for visual representation
   - Safe division: handles total=0 without division errors

3. **Global Configuration** (`src/app/layout.tsx`)
   - TooltipProvider wraps Navigation, main, and Footer
   - Configured delays: 300ms initial, 100ms skip between tooltips
   - Single provider at app level for consistent behavior

## Decisions Made

### Tooltip Provider Placement
**Decision:** Place TooltipProvider in layout.tsx wrapping all interactive content

**Rationale:** Radix tooltips require a single provider at the app level. Wrapping Navigation/main/Footer ensures all tooltips work without needing providers in child components.

**Alternatives Considered:**
- Per-page providers: Would require duplication and risk configuration drift
- Multiple nested providers: Could cause unexpected behavior with Radix

**Impact:** All tooltips in app will have consistent 300ms delay and 100ms skip delay

### Denominator Format
**Decision:** Display accuracy as "X/Y (Z%)" with font-mono for numbers

**Rationale:** Transparency requires showing the denominator (sample size). A model with 1/2 (50%) is very different from 81/160 (50.6%). Monospace font improves number alignment and readability.

**Alternatives Considered:**
- Percentage-only: Hides critical sample size information
- "X out of Y" text: More verbose, less scannable
- Bar-only visualization: Loses precision

**Impact:** Users can evaluate statistical significance of accuracy metrics

### Tooltip Delays
**Decision:** delayDuration=300ms, skipDelayDuration=100ms

**Rationale:** 300ms prevents tooltips from appearing on accidental hovers. 100ms skip delay creates smooth experience when moving between multiple tooltips (e.g., scanning leaderboard).

**Alternatives Considered:**
- Lower delays (100-200ms): Feel twitchy, tooltips pop up too easily
- Higher delays (500+ms): Feel sluggish, users assume tooltips don't exist
- No skip delay: Jarring when moving between tooltips

**Impact:** Balanced UX - responsive but not distracting

## Verification Results

All verification checks passed:

1. **Installation**: @radix-ui/react-tooltip@1.2.8 installed
2. **TypeScript**: No compilation errors
3. **Build**: Production build succeeds (`npm run build`)
4. **Exports**: All four tooltip primitives available for import
5. **Component**: AccuracyDisplay handles edge cases (total=0)

## Files Changed

**Created:**
- `src/components/ui/tooltip.tsx` (31 lines) - Radix tooltip primitives
- `src/components/accuracy-display.tsx` (79 lines) - AccuracyDisplay component

**Modified:**
- `src/app/layout.tsx` - Added TooltipProvider wrapper
- `package.json` - Added @radix-ui/react-tooltip dependency

## Commits

| Hash    | Message                                    | Files                                        |
|---------|--------------------------------------------|----------------------------------------------|
| 6dc8a52 | feat(08-01): add Radix tooltip primitives  | package.json, tooltip.tsx                    |
| 041989b | feat(08-01): create AccuracyDisplay        | accuracy-display.tsx                         |
| c8883b8 | feat(08-01): add TooltipProvider to layout | layout.tsx                                   |

## Next Phase Readiness

**Ready for Plan 02**: Model leaderboard integration

**Foundation Established:**
- Tooltip infrastructure globally available
- AccuracyDisplay component ready for integration
- Methodology link embedded in tooltip
- Size variants support different UI contexts

**No Blockers**

## Deviations from Plan

None - plan executed exactly as written.

## Performance Notes

**Execution Time:** ~2.1 minutes

**Build Impact:**
- Package size: +178 packages (@radix-ui/react-tooltip and dependencies)
- Build time: No noticeable impact (6.3s)
- Bundle size: Radix primitives are tree-shakeable

**Runtime Performance:**
- Tooltips render on-demand (no mounting overhead)
- Animations use CSS (GPU-accelerated)
- Provider is lightweight (no re-render triggers)

## Testing Notes

**Manual Testing Required in Plan 02:**
1. Hover over accuracy display - tooltip appears after 300ms
2. Move between multiple tooltips - skip delay of 100ms
3. Click methodology link in tooltip - navigates to /methodology
4. Test keyboard navigation - tooltip appears on focus
5. Test all size variants (sm, md, lg)
6. Test with showBar prop enabled
7. Test edge case: total=0 shows "0/0 (0%)" without error

**Accessibility:**
- Radix tooltips handle keyboard navigation automatically
- aria-describedby connects trigger to content
- Focus management built into primitives
