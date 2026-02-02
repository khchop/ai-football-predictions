# Phase 8: UX Transparency - Research

**Researched:** 2026-02-02
**Domain:** Accessible tooltips, statistics display patterns, React UI components
**Confidence:** HIGH

## Summary

This phase enhances user trust by displaying accuracy statistics with denominators (e.g., "81/160 (50.6%)") and adding tooltips explaining calculation methodology. The codebase already has:
- Stats service with `scoredPredictions` and `correctTendencies` available
- `/methodology` page with detailed accuracy explanation
- Partial Radix UI installation (missing `@radix-ui/react-tooltip`)
- Native `title` attributes for basic hover hints

The standard approach combines:
- Radix UI Tooltip (via shadcn/ui pattern) for accessible, interactive tooltips
- Consistent "X/Y (Z%)" format across all accuracy displays
- Link to `/methodology` page within tooltips for users wanting full details
- TooltipProvider at app layout level for global configuration

**Primary recommendation:** Install `@radix-ui/react-tooltip`, create `src/components/ui/tooltip.tsx` following shadcn/ui pattern, then systematically update all accuracy displays to show denominator format with methodology-linking tooltips.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-tooltip | ^1.1.8 | Accessible tooltip primitives | Already using Radix for dialog/select/tabs; WAI-ARIA compliant; keyboard navigable |
| tailwind-merge | 3.4.0 | Existing - class merging | Already in package.json |
| class-variance-authority | 0.7.1 | Existing - variant styling | Already in package.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562.0 | Info icons for tooltips | Already installed; use `Info` or `HelpCircle` icon |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Tooltip | Native `title` attribute | Native title has no styling, no keyboard navigation, inconsistent delay across browsers; already used for streaks but inadequate for methodology explanations |
| Radix Tooltip | react-tooltip | react-tooltip is good but Radix ecosystem already in use; consistency > adding another tooltip library |
| Tooltip component | Inline expandable text | Tooltips are better for dense data tables; expandable text takes more space |

**Installation:**
```bash
npm install @radix-ui/react-tooltip
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── ui/
│       └── tooltip.tsx        # NEW: Radix tooltip with shadcn/ui pattern
├── components/
│   ├── accuracy-display.tsx   # NEW: Reusable "X/Y (Z%)" + tooltip
│   ├── leaderboard-table.tsx  # UPDATE: Use AccuracyDisplay
│   └── model-stats-grid.tsx   # UPDATE: Use AccuracyDisplay
├── app/
│   └── layout.tsx             # UPDATE: Add TooltipProvider wrapper
```

### Pattern 1: Tooltip Component (shadcn/ui Style)
**What:** Radix tooltip wrapped with Tailwind styling
**When to use:** All hover/focus information displays
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/tooltip
// File: src/components/ui/tooltip.tsx
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

### Pattern 2: Reusable AccuracyDisplay Component
**What:** Consistent accuracy display with denominator and methodology tooltip
**When to use:** All places showing accuracy percentages
**Example:**
```typescript
// File: src/components/accuracy-display.tsx
"use client"

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'

interface AccuracyDisplayProps {
  correct: number
  total: number
  showBar?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function AccuracyDisplay({
  correct,
  total,
  showBar = false,
  size = 'md',
  className,
}: AccuracyDisplayProps) {
  const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-1 cursor-help",
          sizeClasses[size],
          className
        )}>
          <span className="font-mono">
            {correct}/{total}
          </span>
          <span className="text-muted-foreground">
            ({accuracy}%)
          </span>
          <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Tendency Accuracy</p>
        <p className="text-muted-foreground mb-2">
          {correct} correct predictions out of {total} scored matches.
        </p>
        <Link
          href="/methodology"
          className="text-primary hover:underline text-xs"
        >
          Learn how we calculate accuracy
        </Link>
      </TooltipContent>
    </Tooltip>
  )
}
```

### Pattern 3: TooltipProvider at Layout Level
**What:** Global tooltip configuration for consistent delays
**When to use:** Once in app layout
**Example:**
```typescript
// File: src/app/layout.tsx (update)
import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  )
}
```

### Pattern 4: Metric-Specific Tooltips
**What:** Different tooltip content for different metrics
**When to use:** Leaderboard columns, stats cards
**Example:**
```typescript
// Tooltip content varies by metric type
const METRIC_TOOLTIPS = {
  accuracy: {
    title: "Tendency Accuracy",
    description: "Percentage of correct match outcome predictions (home win, draw, away win).",
    formula: "Correct Tendencies / Scored Predictions × 100",
  },
  avgPoints: {
    title: "Average Points per Match",
    description: "Mean points earned across all scored predictions using Kicktipp quota system.",
    formula: "Total Points / Scored Predictions",
  },
  exactScores: {
    title: "Exact Score Predictions",
    description: "Number of predictions where the model correctly predicted the exact final score.",
    formula: "Count where exactScoreBonus = 3",
  },
} as const
```

### Anti-Patterns to Avoid
- **Nested TooltipProvider:** Don't wrap each tooltip in its own Provider; causes performance issues
- **Title + Tooltip:** Remove native `title` attributes when adding Radix tooltips; screen readers announce both
- **Tooltip on non-focusable elements:** Always use `asChild` with focusable trigger or wrap in `<button>`
- **Long tooltip content:** Keep tooltips concise; link to /methodology for details
- **Missing forwardRef:** Custom components used with `asChild` must forward refs

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hover information | Custom CSS hover state | Radix Tooltip | Keyboard accessibility, focus management, portal rendering, collision detection |
| Tooltip positioning | Manual `position: absolute` | Radix Tooltip | Handles viewport boundaries, scroll containers, RTL |
| Delayed appearance | Custom setTimeout | TooltipProvider delayDuration | Coordinated delays across tooltips, skip delay on quick moves |
| Screen reader support | Manual aria attributes | Radix Tooltip | aria-describedby automatically managed, focus handling |

**Key insight:** Tooltip accessibility is deceptively complex. Radix handles: focus management, escape key dismissal, pointer/keyboard triggers, delayed open/close, portal rendering, collision detection, and ARIA attributes. Custom solutions invariably miss edge cases.

## Common Pitfalls

### Pitfall 1: Duplicate TooltipProvider
**What goes wrong:** Performance degradation, inconsistent tooltip behavior
**Why it happens:** Each Tooltip wrapped in its own Provider (from copy-pasted examples)
**How to avoid:** Single TooltipProvider in layout.tsx, never wrap individual tooltips
**Warning signs:** Slow tooltip appearance, tooltips competing with each other

### Pitfall 2: Native Title + Radix Tooltip Collision
**What goes wrong:** Screen readers announce information twice
**Why it happens:** Existing `title` attributes left in place when adding tooltips
**How to avoid:** Remove all `title` attributes from elements that get Radix tooltips
**Warning signs:** NVDA/VoiceOver users report duplicate announcements

### Pitfall 3: Non-Focusable Tooltip Triggers
**What goes wrong:** Keyboard users cannot access tooltip content
**Why it happens:** Wrapping tooltip around `<span>` or `<div>` without making focusable
**How to avoid:** Use `asChild` with `<button>` or add `tabIndex={0}` to custom elements
**Warning signs:** Tab key skips over tooltipped elements

### Pitfall 4: Inconsistent Denominator Source
**What goes wrong:** Different pages show different totals for same model
**Why it happens:** Some queries use `totalPredictions`, others use `scoredPredictions`
**How to avoid:** ALWAYS use `scoredPredictions` for accuracy denominator (matches canonical formula)
**Warning signs:** Model page shows 52% but leaderboard shows 48% for same model

### Pitfall 5: Missing Tooltip on Mobile
**What goes wrong:** Mobile users cannot see tooltip content
**Why it happens:** Tooltips designed for hover; no tap-to-show behavior
**How to avoid:** Radix Tooltip works on focus too; ensure triggers are focusable
**Warning signs:** Mobile users report "what does this percentage mean?"

## Code Examples

Verified patterns from official sources:

### Leaderboard Accuracy Column Update
```typescript
// Source: Existing leaderboard-table.tsx pattern + new AccuracyDisplay
// Before:
<span className="text-xs text-muted-foreground font-mono w-10 text-right">
  {accuracy}%
</span>

// After:
<AccuracyDisplay
  correct={entry.correctTendencies}
  total={entry.totalPredictions} // NOTE: Should be scoredPredictions from API
  showBar={true}
  size="sm"
/>
```

### Model Page Stats Card Update
```typescript
// Source: Existing model page pattern
// Before (models/[id]/page.tsx line 257):
<p className="text-4xl font-bold font-mono">{tendencyAccuracy}%</p>

// After:
<AccuracyDisplay
  correct={predictionStats.correctTendencies}
  total={predictionStats.scoredPredictions}
  size="lg"
/>
```

### Column Header with Metric Tooltip
```typescript
// Source: TanStack Table column definitions
{
  id: 'accuracy',
  header: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="flex items-center gap-1 hover:text-foreground">
          Accuracy
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Percentage of correct tendency predictions</p>
        <p className="text-muted-foreground text-xs mt-1">
          Formula: Correct / Scored × 100
        </p>
      </TooltipContent>
    </Tooltip>
  ),
  // ... cell definition
}
```

### Info Icon Pattern for Dense UIs
```typescript
// For stats cards where space is limited
<div className="flex items-center gap-2 mb-2">
  <Sparkles className="h-4 w-4 text-primary" />
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    Accuracy
  </p>
  <Tooltip>
    <TooltipTrigger asChild>
      <button className="p-0.5 rounded hover:bg-muted/50">
        <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[200px]">
      <p>Correct tendency predictions divided by total scored predictions.</p>
      <Link href="/methodology" className="text-primary text-xs hover:underline">
        Learn more
      </Link>
    </TooltipContent>
  </Tooltip>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Native `title` attribute | Radix UI Tooltip | Radix 1.0 (2022) | Full accessibility, consistent styling, controlled delays |
| Percentage only (52%) | Denominator format (81/160) | UX research 2024+ | Users trust numbers they can verify |
| Tooltip with no link | Tooltip linking to methodology | Progressive disclosure pattern | Users can self-serve deeper understanding |

**Deprecated/outdated:**
- **react-tooltip v4**: v5 is current, but Radix is preferred when already using Radix ecosystem
- **CSS-only hover effects**: Cannot achieve keyboard accessibility without JS
- **Percentage without context**: Modern data UX requires showing sample size for trust

## Open Questions

Things that couldn't be fully resolved:

1. **Leaderboard scoredPredictions availability**
   - What we know: API returns `totalPredictions` and `correctTendencies`, but accuracy formula uses `scoredPredictions`
   - What's unclear: Need to verify if `totalPredictions` in leaderboard query is actually scored-only or includes pending
   - Recommendation: Check `getLeaderboard` query; if needed, add `scoredPredictions` to return type

2. **Mobile tooltip interaction pattern**
   - What we know: Radix tooltip works on focus, but dense tables may be hard to tap
   - What's unclear: Whether tap-to-toggle is needed or if focus suffices
   - Recommendation: Test with actual users; if issues arise, consider tap-to-toggle variant

3. **Tooltip content length for i18n**
   - What we know: English tooltip content fits well in 200px width
   - What's unclear: Future localization may need longer text
   - Recommendation: Use `max-w-xs` (320px) to accommodate longer translations

## Sources

### Primary (HIGH confidence)
- [Radix UI Tooltip Documentation](https://www.radix-ui.com/primitives/docs/components/tooltip) - Official API, accessibility features
- [shadcn/ui Tooltip Component](https://ui.shadcn.com/docs/components/tooltip) - Implementation pattern, styling
- [WAI-ARIA Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) - Accessibility requirements
- Existing codebase:
  - `/src/lib/services/stats.ts` - Canonical accuracy formula
  - `/src/app/methodology/page.tsx` - Methodology explanation content
  - `/src/components/leaderboard-table.tsx` - Current accuracy display pattern

### Secondary (MEDIUM confidence)
- [Creating an accessible tooltip - ustwo engineering](https://engineering.ustwo.com/articles/creating-an-accessible-tooltip/) - Mobile considerations
- [Data Visualizations Accessibility - USWDS](https://designsystem.digital.gov/components/data-visualizations/) - Denominator display rationale
- [Mastering Tooltip Shadcn](https://ones.com/blog/mastering-tooltip-shadcn-enhance-ui-sleek-hover-interactions/) - Implementation patterns

### Tertiary (LOW confidence - for awareness)
- [Lazy Tooltip Performance](https://next.jqueryscript.net/shadcn-ui/lazy-tooltip/) - Performance optimization if needed for large tables

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Radix is already in use, shadcn/ui pattern is documented
- Architecture: HIGH - Patterns verified in existing codebase and official docs
- Pitfalls: HIGH - Based on official Radix documentation and accessibility standards
- Mobile behavior: MEDIUM - Needs user testing validation

**Research date:** 2026-02-02
**Valid until:** ~90 days (Radix stable, patterns well-established)

**Key requirements from phase description:**
- UX-01: Display accuracy with denominator (e.g., "81/160 (50.6%)") - Pattern defined in AccuracyDisplay component
- UX-02: Add tooltips explaining metrics - Radix tooltip + methodology link pattern
- UX-03: Leaderboard shows correct numbers - Verify scoredPredictions in query, use canonical formula
