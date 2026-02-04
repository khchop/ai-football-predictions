---
phase: 30-layout-assembly
plan: 01
subsystem: match-page
tags: [react, context, layout, client-component]
dependency-graph:
  requires:
    - 26-context-architecture
    - 27-hero-component
    - 28-narrative-predictions
    - 29-faq-seo
  provides:
    - state-aware-layout-orchestrator
  affects:
    - 30-02 (page integration)
    - 30-03 (data wiring)
tech-stack:
  added: []
  patterns:
    - context-driven-rendering
    - conditional-section-visibility
key-files:
  created:
    - src/components/match/match-layout.tsx
  modified: []
decisions:
  - id: LAYOUT-001
    description: MatchNarrative hidden during live matches (no preview during play)
  - id: LAYOUT-002
    description: PredictionsSection as internal component with H2 heading wrapper
metrics:
  duration: ~1 minute
  completed: 2026-02-04
---

# Phase 30 Plan 01: MatchLayout Component Summary

State-aware layout orchestrator using useMatch() context hook to conditionally render sections based on matchState.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MatchLayout component | 289e62a | src/components/match/match-layout.tsx |

## Changes Made

### MatchLayout Component (`src/components/match/match-layout.tsx`)

Created the central layout orchestrator that:

1. **Consumes context**: Uses `useMatch()` hook to get `match`, `competition`, and `matchState`

2. **Section ordering by state**:
   - **Upcoming**: Hero + Narrative + Predictions + FAQ
   - **Live**: Hero + Predictions + FAQ (NO narrative)
   - **Finished**: Hero + Narrative + Predictions + FAQ

3. **Props interface**:
   ```tsx
   interface MatchLayoutProps {
     predictions: Prediction[];
     faqs?: FAQItem[] | null;
   }
   ```

4. **Internal PredictionsSection**: Wraps `SortablePredictionsTable` with H2 heading per CONTEXT.md requirement ("Every section has a visible H2 heading")

5. **Layout container**: `max-w-[1200px] mx-auto space-y-8 md:space-y-12` for consistent spacing

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| LAYOUT-001 | Hide MatchNarrative during live matches | Per CONTEXT.md: "NO narrative during live play" - users want real-time score focus |
| LAYOUT-002 | PredictionsSection as internal component | Encapsulates H2 heading + table together for cleaner main component |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compiles without errors (pre-existing test file errors unrelated)
- MatchLayout export verified
- useMatch() hook consumption verified
- Conditional live state rendering verified

## Next Phase Readiness

Ready for Plan 02 (Page Integration):
- MatchLayout component exports correctly
- Props interface documented for page-level data passing
- Component ready to be wrapped by MatchDataProvider on page

## Artifacts

```
src/components/match/match-layout.tsx  # NEW - State-aware layout orchestrator
```
