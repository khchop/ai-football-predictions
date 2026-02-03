# Phase 24: Match Page Cleanup - Research

**Researched:** 2026-02-03
**Domain:** Next.js/React UI layout refactoring with Tailwind CSS
**Confidence:** HIGH

## Summary

Phase 24 focuses on simplifying the match page from a complex tabbed/sticky navigation experience to a unified single-scrollable-page layout. The current implementation uses mobile tabs (`MatchTabsMobile`), a sticky header (`MatchHeaderSticky`), and separate desktop/mobile layouts that fragment content across tabs. The phase requires removing these navigation elements and presenting all content in a linear, scrollable order with intelligent hiding of empty sections.

The research confirms this is a straightforward React component refactoring task using established Next.js and Tailwind CSS patterns. The codebase already demonstrates good conditional rendering practices (e.g., `MatchStats.tsx` conditionally showing H2H/standings), which can be extended. The primary technical work involves removing client-side state management (tabs), eliminating positioning classes (sticky header), and implementing data-driven conditional rendering to hide empty sections.

**Primary recommendation:** Remove `MatchTabsMobile` and `MatchHeaderSticky` components, flatten all tab content into the main page layout using the specified order, apply conditional rendering at the component level (return `null` when no data exists), and remove Tailwind `sticky` positioning classes to enable natural scrolling.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | React framework with SSR/PPR | Industry standard for React apps, already in use |
| React | 18+ | Component-based UI | Foundation of Next.js ecosystem |
| Tailwind CSS | 3+ | Utility-first CSS framework | Already used throughout codebase, mobile-first responsive design |
| TypeScript | 5+ | Type safety | Standard for modern React development |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind responsive utilities | Built-in | `md:`, `lg:` breakpoint prefixes | All responsive layout changes |
| React conditional rendering | Built-in | `&&`, ternary, early return | Hiding empty sections |
| Tailwind display utilities | Built-in | `hidden`, `block`, `md:hidden` | Device-specific visibility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conditional rendering | CSS `display: none` | Conditional rendering prevents component lifecycle execution, better performance |
| Tailwind utilities | Custom CSS/media queries | Tailwind is already project standard, consistent with existing code |
| Component-level hiding | Parent-level conditional | Component-level is more maintainable, encapsulates logic |

**Installation:**
No new dependencies required - all utilities are already available in the codebase.

## Architecture Patterns

### Recommended Project Structure
Current structure is already appropriate:
```
src/
├── app/leagues/[slug]/[match]/page.tsx    # Main match page
├── components/match/
│   ├── match-header.tsx                   # Regular header (keep)
│   ├── match-header-sticky.tsx            # DELETE - sticky header to remove
│   ├── match-tabs-mobile.tsx              # DELETE - tabs to remove
│   ├── tab-content/                       # FLATTEN - move content up
│   │   ├── summary-tab.tsx
│   │   ├── stats-tab.tsx
│   │   ├── predictions-tab.tsx
│   │   └── analysis-tab.tsx
│   ├── MatchContent.tsx                   # Keep - already conditionally renders
│   ├── MatchStats.tsx                     # Keep - already shows H2H/standings
│   ├── match-faq.tsx                      # Keep
│   └── predictions-section.tsx            # Keep
```

### Pattern 1: Conditional Component Rendering (Early Return)
**What:** Components return `null` when they have no data to display, preventing rendering entirely
**When to use:** When component existence depends on data availability
**Example:**
```typescript
// Source: React official docs + codebase example (MatchContent.tsx)
export function MatchContentSection({ matchId, matchStatus }: Props) {
  const content = await getMatchContent(matchId);

  // Hide entire section if no content exists
  if (!content) {
    return null;
  }

  // Determine which sections to show based on match status
  const showPreMatch = status === 'scheduled' && !!content.preMatchContent;
  const showBetting = (status === 'live' || status === 'finished') && !!content.bettingContent;
  const showPostMatch = status === 'finished' && !!content.postMatchContent;

  // Hide if no applicable content for this match state
  if (!showPreMatch && !showBetting && !showPostMatch) {
    return null;
  }

  return <Card>...</Card>;
}
```

### Pattern 2: Responsive Layout Unification (Mobile-First)
**What:** Use Tailwind's mobile-first breakpoints to create unified layouts that work on all devices
**When to use:** Replacing separate mobile/desktop layouts with single responsive layout
**Example:**
```typescript
// Source: Tailwind CSS responsive design docs
// Instead of separate <div className="md:hidden"> and <div className="hidden md:block">
// Use unified layout with responsive utilities

<div className="max-w-4xl mx-auto space-y-8">
  {/* All content in single column on mobile, maintains layout on desktop */}
  <Section1 />
  <Section2 />
  <Section3 />
</div>
```

### Pattern 3: Remove Sticky Positioning
**What:** Replace `sticky top-0` with natural scrolling by removing positioning classes
**When to use:** Converting sticky/fixed headers to scrollable headers
**Example:**
```typescript
// Source: Tailwind CSS position docs + research findings

// BEFORE (Sticky):
<header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
  {/* header content */}
</header>

// AFTER (Scrollable):
<header className="bg-background/95 border-b">
  {/* header content */}
</header>
```

### Pattern 4: Inline Conditional Rendering with &&
**What:** Use logical AND operator for simple presence/absence rendering
**When to use:** When section visibility depends on single boolean or data existence check
**Example:**
```typescript
// Source: React conditional rendering docs + codebase patterns
{(isFinished || isLive) && matchEvents.length > 0 && (
  <Card>
    <h2>Match Events</h2>
    <MatchEvents events={matchEvents} />
  </Card>
)}
```

### Anti-Patterns to Avoid
- **Returning empty fragments/divs instead of null:** Creates unnecessary DOM nodes and lifecycle overhead. Always return `null` when component should not render.
- **Checking data inside component vs parent:** For performance, do conditional checks at parent level before component instantiation when possible, but for maintainability, prefer component-level encapsulation.
- **Using CSS `display: none` for conditional content:** Hidden elements still execute React lifecycle and exist in DOM. Use conditional rendering instead.
- **Placeholder messages for missing data:** Per requirements (FILT-04), never show "unavailable" or "no data" messages - hide sections entirely.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive breakpoints | Custom media queries | Tailwind responsive utilities (`md:`, `lg:`) | Already project standard, consistent, mobile-first |
| Layout spacing | Manual margins/padding | Tailwind spacing utilities (`space-y-8`) | Maintains design system consistency |
| Conditional class application | Custom string concatenation | `cn()` utility from `lib/utils` | Already in codebase, handles undefined/null safely |
| Component visibility | JavaScript DOM manipulation | React conditional rendering | React's reconciliation is optimized, safer |

**Key insight:** The codebase already contains all necessary utilities and patterns. This phase is about removing complexity (tabs, sticky positioning), not adding it. Resist the temptation to create new abstractions or helper components.

## Common Pitfalls

### Pitfall 1: Forgetting Mobile-First Breakpoints
**What goes wrong:** Using `lg:block hidden` instead of `hidden lg:block` results in element being hidden on mobile even though no prefix = mobile base state
**Why it happens:** Tailwind is mobile-first, unprefixed utilities apply to all screen sizes, prefixes override at that breakpoint and up
**How to avoid:** Always write unprefixed utility first (mobile state), then add breakpoint prefixes for larger screens
**Warning signs:** Content disappearing on mobile when it should be visible

### Pitfall 2: Incomplete Tab Content Migration
**What goes wrong:** Removing `MatchTabsMobile` but forgetting to migrate all tab content to main page layout
**Why it happens:** Tab content is split across 4 separate files (`summary-tab.tsx`, `stats-tab.tsx`, `predictions-tab.tsx`, `analysis-tab.tsx`)
**How to avoid:** Create checklist of all tab content, map each section to new layout order position
**Warning signs:** Missing sections after deployment, broken functionality

### Pitfall 3: Not Removing Client-Side State
**What goes wrong:** Deleting `MatchTabsMobile` component but leaving `'use client'` directive and state management in other files
**Why it happens:** Tabs require client-side state (`useState` for active tab), but single-page scroll doesn't
**How to avoid:** Remove `'use client'` directives from components that no longer need interactivity
**Warning signs:** Unnecessary client-side JavaScript bundle increase

### Pitfall 4: Leaving Sticky Header Classes
**What goes wrong:** Removing `MatchHeaderSticky` component but keeping `sticky top-0` classes elsewhere
**Why it happens:** Sticky positioning might be applied in multiple places or inherited through component composition
**How to avoid:** Search codebase for `sticky`, `fixed`, `top-0`, `z-50` patterns and verify each
**Warning signs:** Header still sticks on scroll after changes

### Pitfall 5: Showing Empty Sections with Placeholder Text
**What goes wrong:** Displaying "No data available" or "Coming soon" messages when section is empty
**Why it happens:** Default developer instinct to provide feedback, misunderstanding requirement FILT-04
**How to avoid:** Review requirement FILT-04: "No 'unavailable' or 'no data' placeholder messages shown to users"
**Warning signs:** User reports seeing placeholder text, sections visible when they should be hidden

### Pitfall 6: Breaking Desktop Layout While Fixing Mobile
**What goes wrong:** Removing responsive utilities like `md:grid-cols-3` while removing tabs, breaking desktop grid layouts
**Why it happens:** Focus on removing mobile tabs without considering desktop layout needs
**How to avoid:** Test on multiple screen sizes (mobile, tablet, desktop) after each change
**Warning signs:** Desktop layout becomes single-column when it should have multiple columns

## Code Examples

Verified patterns from official sources and codebase:

### Unified Layout Order (Replacing Tabs)
```typescript
// Source: Current codebase at src/app/leagues/[slug]/[match]/page.tsx

// BEFORE: Separate mobile/desktop layouts
<div className="md:hidden">
  <MatchTabsMobile>{/* tabbed content */}</MatchTabsMobile>
</div>
<div className="hidden md:block">
  {/* desktop content */}
</div>

// AFTER: Unified scrollable layout
<div className="max-w-4xl mx-auto space-y-8">
  {/* 1. Score - MatchPageHeader already exists */}
  <MatchPageHeader match={matchData} competition={competition} />

  {/* 2. Scorers/Goals - Match Events */}
  {(isFinished || isLive) && matchEvents.length > 0 && (
    <Card>
      <h2>Match Events</h2>
      <MatchEvents events={matchEvents} />
    </Card>
  )}

  {/* 3. Odds - from MatchStats */}

  {/* 4. Pre-match Report - MatchContentSection handles this */}
  <MatchContentSection matchId={matchData.id} matchStatus={matchData.status} />

  {/* 5. Prediction Report - see above */}

  {/* 6. Post-match Report - see above */}

  {/* 7. Predictions Table */}
  <Card>
    <PredictionTable predictions={predictions} />
  </Card>

  {/* 8. FAQ */}
  <MatchFAQ match={matchData} competition={competition} />
</div>
```

### Hiding H2H Section (FILT-01)
```typescript
// Source: Current codebase at src/components/match/MatchStats.tsx

// CURRENT: H2H is shown in MatchStats component
// APPROACH: Either remove from component or add conditional prop

// Option 1: Remove H2H card entirely from MatchStats.tsx
// Delete lines 89-130 that render H2H card

// Option 2: Add conditional prop (more flexible)
export function MatchStats({
  analysis,
  homeStanding,
  awayStanding,
  showH2H = false  // Add this prop, default false
}: MatchStatsProps) {
  const h2hResults = analysis?.h2hResults ? JSON.parse(analysis.h2hResults) as H2HMatch[] : [];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Standings card */}

      {/* H2H card - only show if prop is true */}
      {showH2H && (
        <Card>
          <h3>Head-to-Head</h3>
          {/* H2H content */}
        </Card>
      )}

      {/* Predictions card */}
    </div>
  );
}
```

### Hiding League Standings (FILT-02)
```typescript
// Source: Current codebase at src/components/match/MatchStats.tsx

// CURRENT: League standings shown in "League Context" card
// APPROACH: Return null when standings section should be hidden

// Option 1: Hide entire MatchStats component for match pages
// In page.tsx, don't render MatchStats at all

// Option 2: Add showStandings prop similar to H2H pattern
// Option 3: Remove standings card from component (lines 45-87)

// Most direct approach based on requirements:
// Simply don't include MatchStats component on match page
// Keep only the Predictions card content
```

### Conditional Section Rendering (FILT-03, FILT-04)
```typescript
// Source: Current codebase at src/components/match/MatchContent.tsx

// PATTERN ALREADY IN USE - extend to other components
export async function MatchContentSection({ matchId, matchStatus }: Props) {
  const content = await getMatchContent(matchId);

  // FILT-03: Hide empty sections - no Card rendered
  if (!content) {
    return null;  // Component doesn't render at all
  }

  const showPreMatch = status === 'scheduled' && !!content.preMatchContent;
  const showBetting = (status === 'live' || status === 'finished') && !!content.bettingContent;
  const showPostMatch = status === 'finished' && !!content.postMatchContent;

  // FILT-04: No "unavailable" message - just hide
  if (!showPreMatch && !showBetting && !showPostMatch) {
    return null;  // No placeholder text shown
  }

  return <Card>{/* render actual content */}</Card>;
}

// Apply same pattern to Match Events:
{(isFinished || isLive) && matchEvents.length > 0 && (
  <Card>
    <h2>Match Events</h2>
    <MatchEvents events={matchEvents} />
  </Card>
)}
// No else clause, no "No events available" message
```

### Removing Sticky Header (LAYT-01)
```typescript
// Source: Tailwind CSS position docs

// BEFORE: src/components/match/match-header-sticky.tsx
<header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b md:hidden">
  {/* sticky mobile header */}
</header>

// AFTER: Use regular MatchHeader for all screen sizes
// Delete match-header-sticky.tsx file entirely
// In page.tsx, use only:
<MatchPageHeader
  match={matchData}
  competition={competition}
  isLive={isLive}
  isFinished={isFinished}
/>
// Component naturally scrolls with page - no sticky classes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate mobile/desktop layouts | Unified responsive layout | 2024-2025 | Simpler maintenance, consistent UX across devices |
| Tab-based content organization | Single-scroll vertical layout | 2024-2025 | Better for SEO, simpler navigation |
| Sticky headers everywhere | Natural scrolling | 2025-2026 | Reduces scroll hijacking, better accessibility |
| Placeholder messages for empty state | Hide sections entirely | Current trend | Cleaner UI, less cognitive load |
| CSS media queries | Tailwind responsive utilities | 2020-present | Faster development, consistent system |
| Component-level CSS | Utility-first CSS | 2020-present | Smaller bundle, easier maintenance |

**Deprecated/outdated:**
- Complex tab state management for simple content sections - modern UX favors single-scroll with anchor links
- Fixed/sticky positioning for all headers - accessibility concerns and scroll hijacking issues
- Showing "no data" placeholders - progressive disclosure and hiding empty sections is now preferred

## Open Questions

Things that couldn't be fully resolved:

1. **Should league standings be removed from ALL match pages or just some?**
   - What we know: FILT-02 says "Hide league standings section completely from match pages"
   - What's unclear: This seems absolute, but MatchStats shows standings conditionally for cup matches
   - Recommendation: Hide standings completely per requirement, but preserve the isCupMatch detection logic in case requirement changes

2. **What happens to CollapsibleSection component?**
   - What we know: It's currently used in stats-tab.tsx for mobile H2H progressive disclosure
   - What's unclear: Whether it's used elsewhere or needed after tab removal
   - Recommendation: Check for other usages, delete if only used in tabs

3. **Should match venue, kickoff time, competition info still be displayed?**
   - What we know: Currently in SummaryTab component which will be removed
   - What's unclear: Where this metadata should appear in new layout
   - Recommendation: Keep this info in MatchPageHeader or create small metadata section above main content

## Sources

### Primary (HIGH confidence)
- Tailwind CSS Official Documentation - Responsive Design: https://tailwindcss.com/docs/responsive-design
- Tailwind CSS Official Documentation - Position Utilities: https://tailwindcss.com/docs/position
- Tailwind CSS Official Documentation - Display Utilities: https://tailwindcss.com/docs/display
- Tailwind CSS Official Documentation - Visibility Utilities: https://tailwindcss.com/docs/visibility
- React Official Documentation - Conditional Rendering: https://react.dev/learn/conditional-rendering
- Current codebase - MatchContent.tsx demonstrates conditional rendering pattern
- Current codebase - MatchStats.tsx demonstrates data-driven section visibility

### Secondary (MEDIUM confidence)
- [Tailwind Hidden Utility for Design Control](https://blogs.purecode.ai/blogs/tailwind-hidden) - Comprehensive guide on hiding elements
- [Tailwind CSS Sticky Headers Guide](https://kitemetric.com/blogs/mastering-sticky-headers-with-tailwind-css-a-comprehensive-guide) - How sticky positioning works
- [CloudDevs - Creating Responsive Layout in Next.js](https://clouddevs.com/next/responsive-layout/) - CSS Grid and Flexbox patterns
- [Snyk - The Art of Conditional Rendering in React/Next.js](https://snyk.io/blog/conditional-rendering-react-next-js/) - Best practices for conditional rendering

### Tertiary (LOW confidence)
- Web search results on React tab removal patterns - general guidance only
- Blog posts on mobile-first responsive design - patterns confirmed with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All technologies already in active use in codebase
- Architecture: HIGH - Patterns demonstrated in existing code (MatchContent.tsx, MatchStats.tsx)
- Pitfalls: HIGH - Based on common React/Tailwind patterns and requirement analysis
- Code examples: HIGH - Derived from actual codebase files and official documentation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable technologies, established patterns)

**Key findings:**
1. No new dependencies required - all utilities exist in current stack
2. Codebase already demonstrates correct conditional rendering patterns
3. Primary work is deletion and simplification, not addition
4. Requirements are clear and testable (5 success criteria provided)
5. Risk is low - removing features is easier than adding, changes are isolated to match page components
