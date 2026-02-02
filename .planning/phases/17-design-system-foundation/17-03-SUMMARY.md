---
phase: 17-design-system-foundation
plan: 03
subsystem: design-system
tags: [cva, components, badges, match-state, accuracy]

dependency_graph:
  requires: ["17-01"]
  provides: ["MatchBadge", "AccuracyBadge", "extended Badge variants"]
  affects: ["18", "19", "20", "21"]

tech_stack:
  added: []
  patterns: ["CVA component variants", "semantic color tokens", "dark mode support"]

key_files:
  created:
    - src/components/ui/match-badge.tsx
    - src/components/ui/accuracy-badge.tsx
  modified:
    - src/components/ui/badge.tsx

decisions:
  - id: "17-03-01"
    decision: "Separate MatchBadge component for structured props, Badge variants for simple usage"
    rationale: "MatchBadge provides type-safe outcome/status/size props; Badge variants enable quick one-off usage"
  - id: "17-03-02"
    decision: "Accuracy thresholds: <40% red, 40-70% amber, >70% green"
    rationale: "Intuitive color coding matching user expectations from previous discussions"
  - id: "17-03-03"
    decision: "Use tabular-nums for AccuracyBadge"
    rationale: "Ensures consistent number alignment when percentages update"

metrics:
  duration: "4 minutes"
  completed: "2026-02-02"
---

# Phase 17 Plan 03: Component Variants Summary

Type-safe CVA component variants for match states and accuracy display using semantic color tokens.

## What Was Built

### MatchBadge Component (`src/components/ui/match-badge.tsx`)

New component with CVA variants for match states:

**Outcome variants:**
- `win` - Green semantic color for wins
- `draw` - Amber semantic color for draws
- `loss` - Red semantic color for losses
- `none` - Muted color for undetermined

**Status variants:**
- `live` - Pulsing destructive for live matches
- `upcoming` - Primary color for scheduled
- `finished` - Muted for completed
- `postponed` - Muted with italic styling
- `cancelled` - Destructive with strikethrough

**Size variants:** sm, md, lg

### AccuracyBadge Component (`src/components/ui/accuracy-badge.tsx`)

New component for displaying accuracy percentages with gradient color coding:

- `< 40%`: Red (loss color) - low accuracy
- `40-70%`: Amber (draw color) - mid accuracy
- `> 70%`: Green (win color) - high accuracy

Features:
- Configurable decimal places (default: 1)
- Optional percent sign display (default: true)
- `tabular-nums` for consistent number alignment

### Extended Badge Variants (`src/components/ui/badge.tsx`)

Added match state variants to existing Badge component:

```typescript
// Outcome variants
win: "bg-win/10 text-win border-win/20 dark:bg-win/20"
draw: "bg-draw/10 text-draw border-draw/20 dark:bg-draw/20"
loss: "bg-loss/10 text-loss border-loss/20 dark:bg-loss/20"

// Status variants
live: "bg-destructive text-white border-destructive animate-pulse"
upcoming: "bg-primary/10 text-primary border-primary/20"
finished: "bg-muted text-muted-foreground border-border"
```

## Usage Examples

```tsx
// MatchBadge - structured props
<MatchBadge outcome="win" size="lg">Home Win</MatchBadge>
<MatchBadge status="live">LIVE</MatchBadge>
<MatchBadge outcome="draw" status="finished">Draw</MatchBadge>

// AccuracyBadge - automatic color coding
<AccuracyBadge percentage={75.5} />  // Green
<AccuracyBadge percentage={55.2} />  // Amber
<AccuracyBadge percentage={25.0} />  // Red

// Badge - simple variant usage
<Badge variant="win">Home Win</Badge>
<Badge variant="live">LIVE</Badge>
```

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MatchBadge component with CVA variants | b8670b0 | match-badge.tsx |
| 2 | Create AccuracyBadge component | 4f86f5b | accuracy-badge.tsx |
| 3 | Extend Badge with match state variants | 932da58 | badge.tsx |

## Verification Results

1. `npm run build` - Completed without TypeScript errors
2. MatchBadge exports both `MatchBadge` and `matchBadgeVariants`
3. AccuracyBadge uses `tabular-nums` for number alignment
4. Badge preserves existing variants (default, secondary, destructive, outline)
5. All components use semantic color tokens (win/draw/loss)

## Deviations from Plan

None - plan executed exactly as written.

## Phase 17 Completion Status

| Plan | Name | Status |
|------|------|--------|
| 01 | Color Tokens & Dark Mode | Complete |
| 02 | Typography & Spacing Tokens | Complete |
| 03 | Component Variants | Complete |

**Phase 17 complete.** Design system foundation ready for page rebuilds in Phases 18-23.

## Next Phase Readiness

Phase 17 provides foundation for:
- **Phase 18 (Match Page)**: MatchBadge for outcomes, AccuracyBadge for prediction stats
- **Phase 19 (Blog Page)**: Badge variants for categories
- **Phase 20 (League Page)**: MatchBadge for recent results
- **Phase 21 (Leaderboard)**: AccuracyBadge for model performance

All semantic color tokens, typography scale, and component variants available for immediate use.
