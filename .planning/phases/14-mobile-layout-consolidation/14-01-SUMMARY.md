---
phase: 14-mobile-layout-consolidation
plan: 01
subsystem: mobile-ui
tags: [react, swipeable, sticky-header, progressive-disclosure, wcag, mobile-first]
requires: []
provides:
  - react-swipeable dependency for tab swipe gestures
  - MatchHeaderSticky component for compact mobile score display
  - CollapsibleSection component for progressive disclosure pattern
affects: [14-02, 14-03]
tech-stack:
  added:
    - react-swipeable@7.0.2
  patterns:
    - position:sticky for headers (avoids CLS)
    - Controlled state with useSwipeable integration
    - 44px minimum touch targets (WCAG 2.5.5 AAA)
    - Mobile-first responsive utilities
key-files:
  created:
    - src/components/match/match-header-sticky.tsx
    - src/components/match/collapsible-section.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - decision: "Use position:sticky instead of position:fixed for header"
    rationale: "Avoids Cumulative Layout Shift penalties, maintains document flow"
    alternatives: ["position:fixed with reserved space"]
    impact: "Better Core Web Vitals, no layout jump on scroll"
  - decision: "44px minimum touch targets on all interactive elements"
    rationale: "WCAG 2.5.5 AAA compliance, reduces tap error rates by 3x"
    alternatives: ["40px Android standard", "48px iOS guideline"]
    impact: "Cross-platform accessibility, better mobile UX"
  - decision: "Mobile displays sticky header, desktop displays full MatchHeader"
    rationale: "Single source of truth for score, eliminates duplication"
    alternatives: ["Conditional rendering within single component"]
    impact: "Clear separation of mobile/desktop layouts"
metrics:
  duration: 2.5 min
  completed: 2026-02-02
---

# Phase 14 Plan 01: Foundation Components Summary

React-swipeable installed, sticky header and collapsible section components created for mobile layout consolidation.

## What Was Built

### Task 1: Install react-swipeable
- Installed react-swipeable v7.0.2 via npm
- Verified installation and TypeScript compilation
- Provides useSwipeable hook for Plan 02 tab swipe navigation

### Task 2: MatchHeaderSticky Component
Created sticky header component with two rendering paths:
- **Mobile (md:hidden):** Compact score display in sticky header
  - Home team + score, separator, away score + team
  - Max 60px height (<20% viewport on small screens)
  - Live match: pulsing red/orange gradient border
  - Tabular-nums for score alignment
- **Desktop (hidden md:block):** Passthrough to existing MatchHeader
- Uses `position:sticky` (not `position:fixed`) to avoid CLS penalties

**Exports:** `MatchHeaderSticky`

### Task 3: CollapsibleSection Component
Created reusable progressive disclosure component:
- Controlled toggle state with useState
- Button trigger with 44px minimum height (WCAG 2.5.5 AAA)
- ChevronDown/ChevronUp icons from lucide-react
- aria-expanded attribute for screen readers
- Animate-in slide effect on expand
- 'use client' directive for interactivity

**Exports:** `CollapsibleSection`

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Decision 1: position:sticky vs position:fixed
**Context:** Sticky headers can be implemented with CSS `position:sticky` or `position:fixed`

**Chosen:** `position:sticky`

**Reasoning:**
- Sticky elements remain in document flow, no layout shift
- Fixed elements cause Cumulative Layout Shift when added/removed
- Better Core Web Vitals (CLS score)
- Natural scroll behavior without JavaScript

**Trade-offs:**
- Sticky: Simpler implementation, better performance, no CLS
- Fixed: More control over positioning, but requires compensating padding

### Decision 2: 44px Touch Target Minimum
**Context:** Mobile touch targets need sufficient size for accurate tapping

**Chosen:** 44x44px minimum (WCAG 2.5.5 AAA)

**Reasoning:**
- WCAG 2.2 AAA standard is 44x44px CSS pixels
- Average adult fingertip: 16-20mm (45-57px at 96dpi)
- Studies show 3x higher tap error rates below 44px
- Unified cross-platform standard (vs 48dp Android, 44pt iOS)

**Implementation:**
- CollapsibleSection: `min-h-[44px]` on Button component
- Future tabs (Plan 02): `min-h-[44px]` on TabsTrigger

### Decision 3: Separate Mobile/Desktop Render Paths
**Context:** Mobile and desktop need different header layouts

**Chosen:** Render both, hide one with responsive classes

**Reasoning:**
- Clear separation of concerns
- Leverages existing MatchHeader component for desktop
- Mobile-first: compact sticky (md:hidden), full header (hidden md:block)
- Simpler than conditional rendering within single component

**Trade-offs:**
- Pro: Reuses existing component, clear mobile-first approach
- Con: Renders both (hidden one doesn't impact performance in RSC)

## Integration Points

### Plan 02 Dependencies (Tabbed Navigation)
- `react-swipeable` installed and ready for tab swipe gestures
- `CollapsibleSection` ready for "View More" patterns in tab content
- Touch target patterns established (44px minimum)

### Plan 03 Dependencies (Match Page Integration)
- `MatchHeaderSticky` ready to replace existing MatchHeader on mobile
- Score de-duplication pattern established (sticky header = single source of truth)
- Progressive disclosure pattern ready for stats/analysis sections

## Testing Recommendations

### Manual Testing
1. **Sticky Header:**
   - Test on 375px viewport (iPhone SE)
   - Verify score stays visible during scroll
   - Check live match indicator appears when isLive=true
   - Verify no layout shift when scrolling
2. **Collapsible Section:**
   - Tap button on mobile device
   - Verify 44px touch target is comfortable
   - Check animation plays smoothly
   - Test keyboard navigation (Space/Enter to toggle)

### Automated Testing
1. Lighthouse accessibility audit should pass for touch target size
2. CLS score should remain <0.1 with sticky header
3. Build verification confirms TypeScript compilation

## Next Steps

**Plan 02: Tabbed Navigation with Swipes**
- Integrate react-swipeable with Radix UI Tabs
- Create MatchTabsMobile component
- Implement tab content components (Summary, Stats, Predictions, Analysis)

**Plan 03: Match Page Integration**
- Replace MatchHeader with MatchHeaderSticky on mobile
- Remove duplicate scoreboards from child components
- Apply CollapsibleSection to advanced stats

## Performance Metrics

**Execution:**
- Tasks completed: 3/3
- Duration: 2.5 minutes
- Commits: 3 atomic commits

**Commits:**
- 56b0fea: chore(14-01): install react-swipeable
- ef810e2: feat(14-01): create MatchHeaderSticky component
- 5c55938: feat(14-01): create CollapsibleSection component

**Files Changed:**
- Created: 2 components
- Modified: 2 dependency files
- Total lines: +134 additions

## Learnings

### What Worked Well
- Clear separation of tasks (dependency, then components)
- Mobile-first approach with responsive utilities
- Reusing existing components (MatchHeader) for desktop
- WCAG 2.5.5 compliance built in from start

### What to Watch
- react-swipeable React 19 compatibility (no official statement, but Hooks API is stable)
- Sticky header height on very small screens (<360px) - may need testing
- Server/Client component boundary when passing data to tabs (Plan 02)

### Patterns Established
1. **Mobile-first responsive:** Unprefixed = mobile, md: = tablet+
2. **Touch targets:** 44px minimum on all interactive elements
3. **Progressive disclosure:** CollapsibleSection for "View More" patterns
4. **Sticky positioning:** position:sticky > position:fixed for headers

---

*Summary generated: 2026-02-02*
*Phase 14, Plan 01 of 14-mobile-layout-consolidation*
