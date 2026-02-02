---
phase: 17-design-system-foundation
plan: 02
subsystem: design-system
tags: [typography, spacing, tokens, css, typescript]
requires: []
provides: [typography-scale, spacing-system, numeric-utilities, design-tokens]
affects: [18-match-page, 19-blog-page, 20-league-page, 21-leaderboard-page]
tech-stack:
  added: []
  patterns: [css-custom-properties, design-tokens, font-variant-numeric]
key-files:
  created:
    - src/lib/design-tokens.ts
  modified:
    - src/app/globals.css
decisions:
  - system-fonts-primary: "System font stack for fast loading and native feel"
  - type-scale-1-2: "Minor Third (1.2) ratio for balanced hierarchy"
  - spacing-4-8: "4px/8px rhythm for consistent component spacing"
metrics:
  duration: 2m
  completed: 2026-02-02
---

# Phase 17 Plan 02: Typography & Spacing Tokens Summary

**One-liner:** 1.2 ratio type scale with system fonts and 4px/8px spacing rhythm as CSS custom properties with TypeScript exports.

## What Changed

### CSS Additions (globals.css)

**Typography tokens:**
- System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- Type scale (1.2 ratio): `--text-xs` through `--text-4xl`
- Line heights: `--leading-tight`, `--leading-normal`, `--leading-relaxed`
- Font weights: `--font-normal` through `--font-bold`

**Spacing tokens:**
- Scale: `--spacing-0` through `--spacing-24` (4px/8px rhythm)
- Half units for fine-tuning: `--spacing-0-5`, `--spacing-1-5`, `--spacing-2-5`

**Utility classes:**
- `.tabular-nums` - Equal-width digits for alignment
- `.proportional-nums` - Natural digit spacing
- `.slashed-zero` - Distinguished zero character
- `.table-nums` - Combined tabular + slashed-zero for data tables

**Prose rhythm:**
- Consistent margins for `.prose` headings and paragraphs

### TypeScript Exports (design-tokens.ts)

```typescript
import { spacing, typography, colors } from '@/lib/design-tokens'
```

Provides autocomplete and type safety for:
- `SpacingKey` - Valid spacing values
- `FontSizeKey` - Valid font sizes
- `LineHeightKey` - Valid line heights
- `FontWeightKey` - Valid font weights

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Font stack | System fonts | Fast loading, native feel, no FOUT |
| Type ratio | 1.2 (Minor Third) | Balanced hierarchy for content-heavy pages |
| Base size | 16px (1rem) | Browser default, accessible |
| Spacing rhythm | 4px/8px | Common pattern, easy mental model |

## Commits

| Hash | Message |
|------|---------|
| 4941e84 | feat(17-02): add typography scale tokens to globals.css |
| 7abaf9d | feat(17-02): add spacing tokens and numeric utilities |
| b4001a1 | feat(17-02): create TypeScript design token exports |

## Files Modified

| File | Changes |
|------|---------|
| `src/app/globals.css` | +83 lines: typography scale, spacing tokens, numeric utilities, prose rhythm |
| `src/lib/design-tokens.ts` | +69 lines: TypeScript token exports with types |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Downstream phases can now use:**
- `var(--text-lg)` through `var(--text-4xl)` for headings
- `var(--spacing-*)` for consistent component padding/margins
- `.tabular-nums` class for numeric data tables
- TypeScript imports for programmatic token access

**Integration notes:**
- Plan 01 (color tokens) runs in parallel - both modify globals.css
- No merge conflicts expected (different sections of @theme block)
