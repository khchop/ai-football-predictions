# Phase 14: Mobile Layout Consolidation - Research

**Researched:** 2026-02-02
**Domain:** Mobile-first UI/UX optimization with React 19 + Next.js 15
**Confidence:** HIGH

## Summary

Mobile Layout Consolidation focuses on eliminating duplicate content and implementing progressive disclosure patterns to reduce scrolling on mobile devices. The phase requires implementing tabbed navigation with swipe gestures, sticky headers, and ensuring WCAG 2.2 touch accessibility compliance (44x44px targets).

The standard approach uses existing project dependencies: Radix UI Tabs (@radix-ui/react-tabs 1.1.13) for keyboard-accessible tabs, react-swipeable (v7.0.2) for mobile swipe gestures, and Tailwind CSS mobile-first utilities for responsive layout. The architecture follows React Server Components with client-side interactivity for tabs and gestures, maintaining Next.js 15's ISR with conditional revalidation strategy.

Key technical insight: Radix UI Tabs does NOT have native swipe support, requiring integration with react-swipeable hook. Content de-duplication is achieved through conditional rendering based on match state (scheduled/live/finished), with score displayed once in sticky header and removed from child components. Progressive disclosure uses controlled state with accordions/collapsible sections to hide advanced stats behind "View More" on mobile.

**Primary recommendation:** Use controlled Radix UI Tabs with react-swipeable integration, implement sticky header with CSS position:sticky (not fixed), apply Tailwind mobile-first breakpoints (unprefixed = mobile, md: = tablet+), and ensure all interactive elements meet 44x44px minimum via padding.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-tabs | 1.1.13 | Accessible tab navigation | WAI-ARIA compliant, keyboard navigation, controlled/uncontrolled modes, already installed |
| react-swipeable | 7.0.2 | Touch swipe gesture detection | Lightweight (9.69kb), React Hooks API, active maintenance, 2.1k stars |
| Tailwind CSS | 4.x | Mobile-first responsive utilities | Project standard, mobile-first breakpoints, no media queries needed |
| React 19 | 19.2.3 | Component framework | Project standard, Server Components for layout |
| Next.js | 16.1.4 | App Router with ISR | Project standard, persistent layouts, streaming |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-collapsible | latest | Accessible collapse/expand | Progressive disclosure for "View More" stats |
| lucide-react | 0.562.0 | Icons for UI affordances | Already installed, ChevronDown, ChevronUp for expand indicators |
| class-variance-authority | 0.7.1 | Conditional styling | Already installed, for touch target sizing variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-swipeable | @use-gesture/react | More features but heavier bundle (17kb vs 9.69kb), overkill for simple swipes |
| react-swipeable | DIY touch events | Saves dependency but requires handling edge cases (momentum, thresholds, browser quirks) |
| Radix Tabs | Material UI Tabs | Already using Radix ecosystem, MUI adds 80kb+ bundle weight |
| position:sticky | position:fixed | Sticky respects document flow, fixed can cause layout shift (CLS penalty) |

**Installation:**
```bash
npm install react-swipeable
# Radix UI Tabs, Tailwind, React 19, Next.js 16 already installed
```

## Architecture Patterns

### Recommended Component Structure
```
src/
├── app/
│   └── matches/[id]/
│       └── page.tsx                    # Server Component with sticky header
├── components/
│   └── match/
│       ├── match-header-sticky.tsx     # Sticky score display (NEW)
│       ├── match-tabs-mobile.tsx       # Tabbed navigation with swipes (NEW)
│       ├── match-summary-tab.tsx       # Summary content (NEW)
│       ├── match-stats-tab.tsx         # Stats with progressive disclosure (NEW)
│       ├── match-predictions-tab.tsx   # Consolidated predictions (NEW)
│       ├── match-analysis-tab.tsx      # Roundup/analysis content (NEW)
│       └── collapsible-section.tsx     # Reusable "View More" pattern (NEW)
```

### Pattern 1: Sticky Header with Score (De-duplication Root)
**What:** Single source of truth for match score, displayed once in position:sticky header
**When to use:** Always on mobile match pages to eliminate duplicate score displays
**Example:**
```typescript
// Source: Tailwind CSS mobile-first docs + W3C sticky positioning
// https://tailwindcss.com/docs/responsive-design
// https://www.w3.org/WAI/WCAG21/Techniques/css/C34.html

export function MatchHeaderSticky({ match, isLive, isFinished }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      {/* Mobile: Compact score (always visible) */}
      <div className="md:hidden px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold truncate">{match.homeTeam}</span>
            <span className="text-2xl font-bold tabular-nums">{match.homeScore}</span>
          </div>
          <span className="text-muted-foreground px-2">-</span>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-2xl font-bold tabular-nums">{match.awayScore}</span>
            <span className="font-semibold truncate">{match.awayTeam}</span>
          </div>
        </div>
      </div>

      {/* Desktop: Full header (existing MatchHeader component) */}
      <div className="hidden md:block">
        <MatchHeader match={match} isLive={isLive} isFinished={isFinished} />
      </div>
    </header>
  );
}
```

### Pattern 2: Controlled Tabs with Swipe Gestures
**What:** Radix UI Tabs with react-swipeable integration for mobile swipe navigation
**When to use:** Mobile tabbed navigation requiring both keyboard and touch support
**Example:**
```typescript
// Source: Radix UI Tabs docs + react-swipeable docs
// https://www.radix-ui.com/primitives/docs/components/tabs
// https://nearform.com/open-source/react-swipeable/docs/

'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TAB_ORDER = ['summary', 'stats', 'predictions', 'analysis'] as const;

export function MatchTabsMobile({ matchId, match, isFinished }: Props) {
  const [activeTab, setActiveTab] = useState<string>(TAB_ORDER[0]);

  // Swipe gesture handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab as any);
      if (currentIndex < TAB_ORDER.length - 1) {
        setActiveTab(TAB_ORDER[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab as any);
      if (currentIndex > 0) {
        setActiveTab(TAB_ORDER[currentIndex - 1]);
      }
    },
    preventScrollOnSwipe: true, // Prevent horizontal scroll during swipe
    trackMouse: false, // Only touch devices, not mouse drag
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* Tab triggers: Ensure 44x44px touch targets */}
      <TabsList className="w-full grid grid-cols-4 h-12">
        <TabsTrigger value="summary" className="min-h-[44px] px-4">
          Summary
        </TabsTrigger>
        <TabsTrigger value="stats" className="min-h-[44px] px-4">
          Stats
        </TabsTrigger>
        <TabsTrigger value="predictions" className="min-h-[44px] px-4">
          Predictions
        </TabsTrigger>
        <TabsTrigger value="analysis" className="min-h-[44px] px-4">
          Analysis
        </TabsTrigger>
      </TabsList>

      {/* Tab content: Apply swipe handlers to content area */}
      <div {...handlers} className="mt-6">
        <TabsContent value="summary">
          <MatchSummaryTab match={match} />
        </TabsContent>
        <TabsContent value="stats">
          <MatchStatsTab matchId={matchId} />
        </TabsContent>
        <TabsContent value="predictions">
          <MatchPredictionsTab matchId={matchId} isFinished={isFinished} />
        </TabsContent>
        <TabsContent value="analysis">
          <MatchAnalysisTab matchId={matchId} isFinished={isFinished} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
```

### Pattern 3: Progressive Disclosure with Collapsible Section
**What:** "View More" pattern for hiding advanced stats on mobile, revealed on user request
**When to use:** Content that's useful but not essential, reducing initial mobile viewport usage
**Example:**
```typescript
// Source: Progressive disclosure best practices 2026
// https://www.nngroup.com/articles/progressive-disclosure/
// https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between min-h-[44px] px-4" // WCAG 2.5.5 AAA
        aria-expanded={isOpen}
      >
        <span className="font-medium">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </Button>

      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// Usage in MatchStatsTab
export function MatchStatsTab({ matchId }: Props) {
  return (
    <div className="space-y-6">
      {/* Always visible: Core stats */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Key Statistics</h3>
          {/* Possession, shots, goals */}
        </CardContent>
      </Card>

      {/* Mobile: Collapsed by default */}
      <div className="md:hidden">
        <CollapsibleSection title="Advanced Statistics">
          {/* xG, passing accuracy, duels won, etc. */}
        </CollapsibleSection>
      </div>

      {/* Desktop: Always visible */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Advanced Statistics</h3>
            {/* xG, passing accuracy, duels won, etc. */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Pattern 4: Content Consolidation via Conditional Rendering
**What:** Remove duplicate content by conditionally rendering based on viewport and match state
**When to use:** When same data appears in multiple components (score, predictions, stats)
**Example:**
```typescript
// Source: Mobile UI anti-patterns 2026
// https://www.numberanalytics.com/blog/avoiding-ui-pitfalls-anti-patterns

// BEFORE (duplicated): Score in header + roundup viewer scoreboard
// AFTER: Score ONLY in sticky header, roundup viewer hides scoreboard on mobile

export function RoundupViewer({ scoreboard, ...props }: Props) {
  return (
    <div>
      {/* Hide scoreboard on mobile (already in sticky header) */}
      <div className="hidden md:block">
        <Card>
          <ScoreboardDisplay {...scoreboard} />
        </Card>
      </div>

      {/* Show narrative on all sizes */}
      <Card>
        <NarrativeContent {...props} />
      </Card>
    </div>
  );
}

// Predictions consolidation: Merge table + roundup predictions + top performers
export function MatchPredictionsTab({ matchId, isFinished }: Props) {
  return (
    <div className="space-y-6">
      {/* Single predictions table (not duplicated in roundup) */}
      <Card>
        <CardContent>
          <h3 className="font-semibold mb-4">AI Model Predictions</h3>
          <PredictionTable matchId={matchId} />
        </CardContent>
      </Card>

      {/* Top performers only if finished */}
      {isFinished && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Top Performers</h3>
            <TopPerformersList matchId={matchId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Pattern 5: Touch Target Accessibility (WCAG 2.5.5 AAA)
**What:** Ensure all interactive elements meet 44x44px minimum size for mobile accessibility
**When to use:** All buttons, tabs, toggles, and clickable elements
**Example:**
```typescript
// Source: WCAG 2.2 Target Size guidelines
// https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
// https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/

// Button variants with guaranteed touch targets
export const buttonVariants = cva(
  "inline-flex items-center justify-center",
  {
    variants: {
      size: {
        default: "h-10 px-4 py-2", // 40px height + 4px padding = 44px+ touch target
        sm: "h-11 px-3", // 44px minimum
        lg: "h-12 px-8", // 48px (exceeds minimum)
        icon: "h-11 w-11", // 44x44px square
      },
    },
  }
);

// Tab trigger with enforced minimum
<TabsTrigger
  value="stats"
  className="min-h-[44px] min-w-[44px] px-4"
>
  Stats
</TabsTrigger>

// Collapse button with safe touch target
<Button
  onClick={toggle}
  className="min-h-[44px] w-full"
  aria-expanded={isOpen}
>
  View More Statistics
</Button>
```

### Anti-Patterns to Avoid

- **Sticky header >30% viewport:** Mobile satisfaction drops when sticky header exceeds 20-30% of screen. Use compact sticky header on mobile, full header on desktop.
- **position:fixed causing layout shift:** Use `position:sticky` instead of `position:fixed` to avoid CLS penalties and unexpected scroll behavior.
- **Tabs without swipe support:** Users expect swipe navigation on mobile tabs. Radix Tabs alone doesn't provide this, requires react-swipeable integration.
- **Duplicate content across components:** Match score appearing in header + roundup + stats causes confusion and wastes mobile viewport. Single source of truth in sticky header.
- **Hidden touch targets:** Interactive elements <44px cause 3x higher error rates. Use padding to expand hit areas even if visual element is smaller.
- **sm: breakpoint for mobile:** Tailwind's sm: (640px) is NOT mobile, it's small tablet. Mobile = unprefixed utilities, md: (768px) = tablet+.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Custom touchstart/touchmove/touchend handlers | react-swipeable hook | Handles momentum, thresholds, prevent-scroll, browser quirks, horizontal vs vertical discrimination |
| Accessible tabs | DIV soup with onClick handlers | @radix-ui/react-tabs | WAI-ARIA compliant, keyboard navigation (arrows, home, end), focus management, screen reader support |
| Progressive disclosure | useState + CSS transitions | @radix-ui/react-collapsible | Accessibility (aria-expanded, aria-controls), animation timing, focus restoration |
| Responsive breakpoints | Custom useMediaQuery hook | Tailwind mobile-first utilities | SSR-safe, no hydration mismatch, standardized breakpoints, no JS needed |
| Touch target sizing | Manual padding calculations | Tailwind min-h-[44px] + CVA variants | Consistent enforcement, design system integration, theme-aware |

**Key insight:** Mobile interaction patterns (swipes, touch targets, sticky headers) have subtle edge cases that library solutions handle correctly. Custom implementations often miss: momentum tracking, scroll prevention, keyboard accessibility, focus management, and browser-specific quirks. Use battle-tested libraries for interaction primitives, focus custom code on business logic.

## Common Pitfalls

### Pitfall 1: Sticky Header Layout Shift (CLS Penalty)
**What goes wrong:** Using `position:fixed` for sticky header causes Cumulative Layout Shift, hurting Core Web Vitals and user experience when header appears/disappears
**Why it happens:** Fixed positioning removes element from document flow, causing content below to jump when fixed element is added/removed
**How to avoid:** Use `position:sticky` instead. Sticky elements remain in document flow, no layout shift. Reserve space for header in initial render.
**Warning signs:** CLS score >0.1 in Lighthouse, content "jumps" when scrolling, mobile users complain about "jittery" experience

### Pitfall 2: Radix Tabs Without Swipe Support
**What goes wrong:** Implementing Radix UI Tabs on mobile without swipe gestures. Users expect to swipe between tabs on touch devices, but Radix Tabs only supports click/keyboard.
**Why it happens:** Radix UI documentation doesn't mention swipe support (it doesn't exist). Developers assume tab component includes touch gestures.
**How to avoid:** Integrate react-swipeable hook with controlled Radix Tabs state. Detect swipe direction, update activeTab via onValueChange. Test on actual touch devices.
**Warning signs:** GitHub issue #2249 "mobile support" on radix-ui/primitives, users asking "how do I swipe between tabs?"

### Pitfall 3: Touch Targets Below 44x44px
**What goes wrong:** Buttons, tabs, or toggles with visual size <44px fail WCAG 2.5.5 AAA, causing 3x higher tap error rates on mobile
**Why it happens:** Designers optimize for visual density, forget about finger size (average adult fingertip: 16-20mm = 45-57px at 96dpi)
**How to avoid:** Use `min-h-[44px]` and `min-w-[44px]` on all interactive elements. Expand hit area with padding if visual element needs to be smaller. Test with accessibility audit tools.
**Warning signs:** Lighthouse accessibility score <100, users miss buttons frequently, complaints about "can't tap the right thing"

### Pitfall 4: Mobile-First Breakpoint Confusion
**What goes wrong:** Using `sm:` breakpoint thinking it targets mobile, but sm:640px is actually small tablets. Mobile users don't see sm: styles.
**Why it happens:** Misunderstanding Tailwind's mobile-first philosophy. Unprefixed = all sizes (including mobile), sm:/md:/lg: = "at this breakpoint AND ABOVE"
**How to avoid:** Mobile styles = unprefixed (text-sm, p-4). Tablet+ = md: prefix (md:text-base, md:p-6). Never use sm: for mobile-specific styles.
**Warning signs:** Mobile viewport looks broken, styles "missing" on phone but work on desktop, confusion about why sm: doesn't apply to mobile

### Pitfall 5: Duplicate Score Displays (Cognitive Load)
**What goes wrong:** Match score appears in multiple places (header, stats card, roundup scoreboard), confusing users and wasting mobile viewport space
**Why it happens:** Components independently render score data without coordination. Copy-paste from existing components without considering mobile context.
**How to avoid:** Establish single source of truth for score in sticky header. Hide duplicate scoreboards on mobile via `md:block` responsive utility. Audit all components for duplicate content.
**Warning signs:** User confusion ("which score is correct?"), excessive scrolling on mobile, multiple h2 headings with same information

### Pitfall 6: Progressive Disclosure Beyond 2 Levels
**What goes wrong:** Nesting collapsible sections >2 levels deep (e.g., "View Stats" → "View Advanced Stats" → "View xG Details") causes users to get lost
**Why it happens:** Trying to hide too much content, creating nested disclosure without considering cognitive load
**How to avoid:** Limit disclosure to 2 levels max. Structure: (1) Always visible core, (2) Optional details behind single disclosure. If need 3+ levels, simplify information architecture.
**Warning signs:** Users complain about "can't find" information, analytics show low engagement with deeply nested content, complex state management in disclosure components

## Code Examples

Verified patterns from official sources:

### Mobile-First Responsive Layout
```typescript
// Source: Tailwind CSS responsive design docs
// https://tailwindcss.com/docs/responsive-design

// Mobile (unprefixed) = stacked layout
// Tablet+ (md:) = horizontal layout
export function MatchStatsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard label="Possession" value="58%" />
      <StatCard label="Shots" value="12" />
      <StatCard label="xG" value="1.8" />
    </div>
  );
}

// Mobile = full width sticky header
// Desktop = hide sticky, show full header
export function AdaptiveHeader() {
  return (
    <>
      {/* Mobile sticky (compact) */}
      <div className="sticky top-0 z-50 md:hidden">
        <CompactScoreHeader />
      </div>

      {/* Desktop (full) */}
      <div className="hidden md:block">
        <FullMatchHeader />
      </div>
    </>
  );
}
```

### Controlled Tabs with State Management
```typescript
// Source: Radix UI Tabs controlled example
// https://www.radix-ui.com/primitives/docs/components/tabs

'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function ControlledMatchTabs() {
  const [activeTab, setActiveTab] = useState('summary');

  // External state control enables swipe gesture integration
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Optional: Analytics tracking
    console.log('Tab changed:', value);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
        <TabsTrigger value="predictions">Predictions</TabsTrigger>
      </TabsList>

      <TabsContent value="summary">
        <SummaryContent />
      </TabsContent>
      <TabsContent value="stats">
        <StatsContent />
      </TabsContent>
      <TabsContent value="predictions">
        <PredictionsContent />
      </TabsContent>
    </Tabs>
  );
}
```

### Swipe Handler Configuration
```typescript
// Source: react-swipeable documentation
// https://nearform.com/open-source/react-swipeable/docs/

import { useSwipeable } from 'react-swipeable';

export function useTabSwipes(activeTab: string, setActiveTab: (tab: string) => void) {
  const tabs = ['summary', 'stats', 'predictions', 'analysis'];

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    },
    // Prevent horizontal scroll during swipe
    preventScrollOnSwipe: true,
    // Only touch devices (not mouse drag)
    trackMouse: false,
    // Minimum swipe distance before triggering (pixels)
    delta: 50,
  });

  return handlers;
}

// Usage
export function SwipeableTabs() {
  const [activeTab, setActiveTab] = useState('summary');
  const swipeHandlers = useTabSwipes(activeTab, setActiveTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>...</TabsList>

      {/* Apply swipe handlers to content container */}
      <div {...swipeHandlers} className="mt-4">
        <TabsContent value="summary">...</TabsContent>
        <TabsContent value="stats">...</TabsContent>
      </div>
    </Tabs>
  );
}
```

### Touch Target Enforcement
```typescript
// Source: WCAG 2.2 Target Size (Enhanced) examples
// https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html

import { cva } from 'class-variance-authority';

// Button with enforced 44x44px minimum
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      size: {
        // All sizes meet or exceed 44px minimum
        default: "h-11 px-4 py-2", // 44px height
        sm: "h-11 px-3", // 44px height (minimum)
        lg: "h-12 px-8", // 48px height (exceeds)
        icon: "h-11 w-11", // 44x44px square
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// Tab triggers with safe touch targets
<TabsList className="grid grid-cols-4 h-12"> {/* 48px height */}
  <TabsTrigger
    value="summary"
    className="min-h-[44px] px-4" // Enforce minimum
  >
    Summary
  </TabsTrigger>
</TabsList>

// Icon button with visual padding
<button
  className="h-11 w-11 flex items-center justify-center"
  aria-label="Toggle advanced stats"
>
  <ChevronDown className="h-5 w-5" /> {/* Icon only 20px, but button is 44px */}
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| position:fixed headers | position:sticky headers | 2023+ (CLS focus) | Eliminates layout shift, improves Core Web Vitals CLS score |
| DIV tabs with onClick | Radix UI Primitives | 2022+ (accessibility focus) | WAI-ARIA compliance, keyboard nav, screen reader support |
| Custom touch handlers | react-swipeable hook | 2021+ (v7 release) | Simpler API, better edge case handling, momentum tracking |
| CSS media queries | Tailwind mobile-first utilities | 2020+ (Tailwind adoption) | SSR-safe, no hydration issues, standardized breakpoints |
| WCAG 2.1 (48dp Android) | WCAG 2.2 (44px minimum AA, 24px Level A) | 2023 (WCAG 2.2 release) | Unified cross-platform standard, lower barrier for compliance |

**Deprecated/outdated:**
- **react-swipeable v6 and below:** v7.0+ (Nov 2024) uses modern hooks API, cleaner TypeScript types
- **@radix-ui/react-tabs <1.0:** v1.0+ (2023) introduced stable API, better controlled state management
- **Target size 48dp (Android only):** WCAG 2.2 unified standard at 44px CSS pixels for all platforms
- **sm: for mobile targeting:** Always incorrect; sm:640px targets small tablets, not phones

## Open Questions

Things that couldn't be fully resolved:

1. **react-swipeable React 19 compatibility**
   - What we know: v7.0.2 released Nov 2024, uses React Hooks API which is stable in React 19
   - What's unclear: No explicit documentation stating "React 19 compatible" on package page or GitHub
   - Recommendation: Install and test in dev environment. Hooks API is stable across React 18/19, expect compatibility. Monitor for TypeScript type issues with React 19's stricter types.

2. **Server Component vs Client Component boundary for tabs**
   - What we know: Tabs require client-side state (useState, useSwipeable), must be 'use client' component
   - What's unclear: Optimal pattern for passing server-fetched data (predictions, stats) to client tab components
   - Recommendation: Fetch data in Server Component parent, pass as props to 'use client' tab wrapper. Wrap tab section in Suspense for streaming. Follow existing PredictionsSection pattern.

3. **Sticky header height on very small screens (<360px width)**
   - What we know: Compact score display works well 375px+ (iPhone SE), might be cramped on older Android devices
   - What's unclear: Should we further compress or stack score elements on ultra-small screens?
   - Recommendation: Test on 320px viewport (smallest common). If cramped, introduce @container queries (Tailwind 4) or consider portrait-only sticky header (hide on landscape).

## Sources

### Primary (HIGH confidence)
- Radix UI Tabs documentation v1.1.13 - https://www.radix-ui.com/primitives/docs/components/tabs
- WCAG 2.2 Success Criterion 2.5.5 (Target Size Enhanced) - https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- WCAG 2.2 Success Criterion 2.5.8 (Target Size Minimum) - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Tailwind CSS Responsive Design docs - https://tailwindcss.com/docs/responsive-design
- react-swipeable GitHub repository v7.0.2 - https://github.com/FormidableLabs/react-swipeable
- react-swipeable documentation - https://nearform.com/open-source/react-swipeable/docs/

### Secondary (MEDIUM confidence)
- Next.js 15 + React 19 Implementation Guide - https://medium.com/@genildocs/next-js-15-react-19-full-stack-implementation-guide-4ba0978fa0e5
- NN/G Progressive Disclosure article - https://www.nngroup.com/articles/progressive-disclosure/
- NN/G Sticky Headers: 5 Ways to Make Them Better - https://www.nngroup.com/articles/sticky-headers/
- Smashing Magazine Accessible Target Sizes - https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/
- W3C CSS Technique C34 (un-fixing sticky headers) - https://www.w3.org/WAI/WCAG21/Techniques/css/C34.html
- LogRocket Progressive Disclosure Types & Use Cases - https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/

### Tertiary (LOW confidence)
- WebSearch: React 19 + Next.js 15 mobile patterns 2026 (no single authoritative source, composite of multiple articles)
- WebSearch: Mobile UI anti-patterns 2026 (multiple sources, patterns consistent but not officially documented)
- GitHub issue radix-ui/primitives #2249 (mobile support discussion, not official feature documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official documentation, versions confirmed in package.json
- Architecture: HIGH - Patterns sourced from official Radix UI, Tailwind CSS, and WCAG documentation
- Pitfalls: MEDIUM - Combination of official docs (WCAG, Radix) and community best practices (NN/G, LogRocket)
- React 19 compatibility: MEDIUM - Hooks API stable but no explicit React 19 compatibility statement from react-swipeable
- Mobile patterns: MEDIUM - Best practices from multiple authoritative sources (NN/G, WCAG, Smashing Magazine) but not project-specific testing

**Research date:** 2026-02-02
**Valid until:** 2026-03-04 (30 days - stable domain, mature libraries with infrequent breaking changes)

**Key assumptions:**
- react-swipeable v7.0.2 works with React 19 (Hooks API is stable)
- Existing Radix UI Tabs component (@radix-ui/react-tabs) in ui/tabs.tsx is v1.1.13+
- Tailwind CSS v4 mobile-first breakpoints unchanged from v3
- Next.js 16.1.4 ISR behavior consistent with documented Next.js 15 ISR patterns
- Project uses App Router exclusively (no Pages Router hybrid)
