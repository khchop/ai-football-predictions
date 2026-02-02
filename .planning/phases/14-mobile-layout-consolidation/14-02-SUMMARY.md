---
phase: 14-mobile-layout-consolidation
plan: 02
subsystem: mobile-ui
tags: [react, tabs, swipeable, progressive-disclosure, mobile-first, wcag]
requires: [14-01]
provides:
  - MatchTabsMobile component with swipe gesture support
  - Four tab content wrappers (Summary, Stats, Predictions, Analysis)
  - Progressive disclosure pattern for H2H stats on mobile
affects: [14-03]
tech-stack:
  added: []
  patterns:
    - Controlled Radix Tabs with useSwipeable integration
    - Progressive disclosure with CollapsibleSection
    - Mobile-first tab content layout
    - 44px minimum touch targets (WCAG 2.5.5 AAA)
key-files:
  created:
    - src/components/match/match-tabs-mobile.tsx
    - src/components/match/tab-content/summary-tab.tsx
    - src/components/match/tab-content/stats-tab.tsx
    - src/components/match/tab-content/predictions-tab.tsx
    - src/components/match/tab-content/analysis-tab.tsx
  modified: []
decisions:
  - decision: "Use controlled Radix Tabs with external state management"
    rationale: "Enables swipe gesture integration via useSwipeable hook"
    alternatives: ["Uncontrolled tabs", "Custom tab implementation"]
    impact: "Seamless swipe-to-switch on mobile, controlled state for gestures"
  - decision: "Progressive disclosure for H2H stats on mobile only"
    rationale: "H2H section takes significant vertical space, not always relevant"
    alternatives: ["Always collapsed", "Always visible", "Remove on mobile"]
    impact: "Reduces initial viewport usage, preserves desktop UX"
  - decision: "Four separate tab content components instead of single wrapper"
    rationale: "Each tab has distinct data requirements and layout patterns"
    alternatives: ["Single polymorphic component", "Switch statement in one file"]
    impact: "Clear separation of concerns, easier to maintain and test"
metrics:
  duration: 2.5 min
  completed: 2026-02-02
---

# Phase 14 Plan 02: Tabbed Navigation with Swipes Summary

Tabbed navigation system with swipe gesture support created for mobile match pages.

## What Was Built

### Task 1: MatchTabsMobile Component
Created main tabbed navigation component integrating Radix UI Tabs with react-swipeable:
- **Controlled tabs:** useState manages activeTab, onValueChange updates state
- **Swipe gestures:**
  - onSwipedLeft: advance to next tab (if not last)
  - onSwipedRight: go to previous tab (if not first)
  - preventScrollOnSwipe: true (prevents horizontal page scroll)
  - trackMouse: false (touch-only, no mouse drag)
  - delta: 50px (minimum swipe distance)
- **Tab order:** ['summary', 'stats', 'predictions', 'analysis']
- **Touch targets:** 44px minimum height on all tab triggers (WCAG 2.5.5 AAA)
- **Props interface:** children object with four ReactNode slots, optional defaultTab

**Exports:** `MatchTabsMobile`

### Task 2: Tab Content Wrapper Components
Created four tab content components as thin wrappers composing existing components:

**SummaryTab (summary-tab.tsx):**
- Server component (no 'use client')
- Props: match, competition, isLive, isFinished, matchEvents
- Renders: Match info card (competition, kickoff, venue), Match events timeline
- Layout: space-y-4 with Card components
- Uses date-fns for date formatting, lucide-react for icons

**StatsTab (stats-tab.tsx):**
- Server component
- Props: analysis, homeStanding, awayStanding, homeTeam, awayTeam
- **Mobile (md:hidden):** H2H section wrapped in CollapsibleSection with "Head-to-Head History" title
- **Desktop (hidden md:block):** H2H section always visible
- Renders: League context (standings + form), H2H history, Match predictions
- Progressive disclosure reduces initial mobile viewport usage

**PredictionsTab (predictions-tab.tsx):**
- Server component
- Props: predictions, homeTeam, awayTeam, isFinished
- Renders: PredictionTable component with consolidated AI model predictions
- If finished: Shows accuracy stats (exact scores, correct results, accuracy rate)
- Layout: space-y-6 with Card components

**AnalysisTab (analysis-tab.tsx):**
- Async server component (fetches match content)
- Props: matchId, matchStatus, roundup (optional)
- Renders: MatchContentSection for AI narratives (pre-match/betting/post-match)
- If roundup exists AND isFinished: renders roundup narrative + top performers
- No duplicate scoreboard/stats (those are in Summary/Stats tabs)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Decision 1: Controlled vs Uncontrolled Tabs
**Context:** Radix Tabs support both controlled (value/onValueChange) and uncontrolled (defaultValue) modes

**Chosen:** Controlled tabs with useState

**Reasoning:**
- Swipe gesture integration requires external state control
- useSwipeable hook needs to update tab state imperatively
- Controlled mode enables analytics tracking (future enhancement)
- More flexible for future features (tab history, URL sync)

**Trade-offs:**
- Pro: Full control over tab state, enables gesture integration
- Con: Slightly more boilerplate than uncontrolled mode
- Decision: Benefits outweigh minimal complexity cost

### Decision 2: Progressive Disclosure for H2H Stats
**Context:** H2H section shows 5 recent matches + summary stats, takes ~200-300px vertical space

**Chosen:** CollapsibleSection on mobile (md:hidden), always visible on desktop

**Reasoning:**
- H2H history is useful but not essential for quick match overview
- Mobile viewport is precious, reducing initial content load improves UX
- NN/G research shows progressive disclosure reduces cognitive load when used appropriately
- Desktop has vertical space to spare, no need to hide content

**Implementation:**
- Mobile: CollapsibleSection with defaultOpen={false}
- Desktop: Standard Card component, always visible
- Separate render paths avoid runtime checks

**Trade-offs:**
- Pro: Reduces mobile scroll, preserves desktop UX
- Con: Adds component complexity (duplicate H2H render code)
- Decision: Mobile UX improvement worth the duplication

### Decision 3: Four Separate Tab Content Components
**Context:** Tab content could be implemented as separate components or single polymorphic wrapper

**Chosen:** Four separate files in tab-content/ directory

**Reasoning:**
- Each tab has distinct data requirements (different props interfaces)
- Layout patterns vary (Summary: events list, Stats: 3-column grid, Predictions: table, Analysis: HTML content)
- Easier to maintain: change one tab without affecting others
- Clearer imports: explicit component names vs. TabContent with type prop
- Better code splitting: Next.js can chunk each tab separately

**Trade-offs:**
- Pro: Clear separation, easier maintenance, better tree-shaking
- Con: More files, some layout duplication (Card/CardContent wrappers)
- Decision: Clarity and maintainability outweigh file count

## Integration Points

### Plan 14-01 Dependencies (Used)
- `react-swipeable` dependency installed in Plan 01, used in MatchTabsMobile
- `CollapsibleSection` component created in Plan 01, used in StatsTab
- 44px touch target pattern established in Plan 01, applied to all tab triggers

### Plan 14-03 Dependencies (Ready)
- `MatchTabsMobile` ready to replace vertical stack in match page
- Tab content components ready for data injection from match page
- Props interfaces defined for all components (clear data contracts)

### Existing Component Integration
**Successfully composed:**
- `PredictionTable` (predictions-tab.tsx)
- `MatchContentSection` (analysis-tab.tsx)
- `CollapsibleSection` (stats-tab.tsx)

**Note:** MatchStats component NOT used directly (extracted relevant sections into StatsTab to avoid desktop 3-column layout on mobile)

## Testing Recommendations

### Manual Testing
1. **Tab Navigation:**
   - Tap each tab trigger on mobile device
   - Verify 44px touch target is comfortable to hit
   - Verify active tab indicator appears correctly
2. **Swipe Gestures:**
   - Swipe left to advance to next tab
   - Swipe right to go to previous tab
   - Verify no swipe at first tab (Summary) or last tab (Analysis)
   - Test on iOS Safari and Android Chrome (WebKit vs Blink gesture handling)
3. **Progressive Disclosure:**
   - Verify H2H section collapsed on mobile by default
   - Tap "Head-to-Head History" button to expand
   - Verify smooth animation plays
   - Verify H2H section always visible on desktop (no button)

### Automated Testing
1. Lighthouse accessibility audit should pass for touch target size
2. Build verification confirms TypeScript compilation (passed)
3. Component snapshot tests for tab content (future enhancement)

## Next Steps

**Plan 03: Match Page Integration**
- Replace vertical stack with MatchTabsMobile on mobile
- Inject match data into tab content components
- Remove duplicate content from existing components
- Test full integration with real match data

## Performance Metrics

**Execution:**
- Tasks completed: 2/2
- Duration: 2.5 minutes
- Commits: 2 atomic commits

**Commits:**
- 2cd2516: feat(14-02): create MatchTabsMobile with swipe gestures
- b2d700e: feat(14-02): create tab content wrapper components

**Files Changed:**
- Created: 5 components (1 main, 4 tab content)
- Total lines: +738 additions

## Learnings

### What Worked Well
- Controlled tabs pattern enabled clean swipe integration
- Progressive disclosure pattern from Plan 01 reused effectively
- Server components for tab content (only MatchTabsMobile needs 'use client')
- Clear separation: navigation logic in MatchTabsMobile, content in tab wrappers

### What to Watch
- **Swipe gesture conflicts:** If parent has horizontal scroll, swipe gestures might interfere
- **Tab state persistence:** Currently resets on page reload (URL sync could preserve tab)
- **Server/Client boundary:** Tab content is server-rendered, but MatchTabsMobile is client
- **Props drilling:** Tab content components need 8+ props from parent, could use React Context

### Patterns Established
1. **Controlled Radix Tabs + useSwipeable:** Standard pattern for mobile tab navigation
2. **Progressive disclosure mobile-only:** Use CollapsibleSection on mobile, always visible on desktop
3. **Tab content wrappers:** Thin components that compose existing UI, minimal logic
4. **44px touch targets:** Applied consistently across all interactive elements

## Known Issues

None.

## Future Enhancements

1. **URL-synced tabs:** Store activeTab in URL query param (?tab=stats), persist on reload
2. **Swipe animation:** Add slide transition animation when swiping between tabs
3. **Tab analytics:** Track which tabs users view most frequently
4. **Keyboard shortcuts:** Left/Right arrow keys to switch tabs (desktop enhancement)
5. **Tab badges:** Show notification badges (e.g., "3 new predictions") on tab triggers

---

*Summary generated: 2026-02-02*
*Phase 14, Plan 02 of 14-mobile-layout-consolidation*
