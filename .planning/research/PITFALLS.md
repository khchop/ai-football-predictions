# Pitfalls Research: v2.2 Match Page Rewrite

**Domain:** Football prediction platform - match detail pages
**Researched:** 2026-02-03
**Confidence:** HIGH (based on project history + verified web research)

## Executive Summary

This is the 3rd attempt at fixing match pages. Previous failures stemmed from:
1. **Dual-render patterns** (preview + full section = duplicate content)
2. **Tabs on mobile** (explicitly unwanted by user)
3. **Section ordering inconsistency** (different layouts per device)

This research identifies pitfalls specific to match page rewrites with SEO/GEO optimization focus.

---

## Content Duplication Pitfalls

### Pitfall 1: Dual-Render Pattern (Preview + Full)

**What goes wrong:** Component renders content twice - once as a truncated preview, once as full content below. User sees identical text repeated on the page.

**Historical evidence:** Quick Task 008 fixed exactly this. `MatchContent.tsx` previously rendered `NarrativePreview` AND full section for pre-match and post-match content.

**Root cause:** Developer intention to show "teaser then full" but forgetting that both are visible simultaneously on single-page layouts.

**Warning signs:**
- Component imports both preview and full-render utilities
- Multiple render calls for same data source
- Variable names like `showPreview` AND `showFull` for same content type

**Prevention:**
```typescript
// BAD: renders content twice
{showPreMatch && <NarrativePreview text={content.preMatchContent} />}
{showPreMatch && <FullSection content={content.preMatchContent} />}

// GOOD: renders content once
{showPreMatch && <Section content={content.preMatchContent} />}
```

**Phase impact:** Architecture phase - establish single-render principle before building components.

---

### Pitfall 2: Hydration Mismatch Duplication

**What goes wrong:** Server renders one version of content, client hydration renders a different version, causing flicker or duplicate DOM nodes.

**Root cause:**
- Using `Date()` or `Math.random()` in render
- Conditional rendering based on `typeof window`
- Different data between server and client fetch

**Warning signs:**
- React console warnings about hydration mismatch
- Content flickers on page load
- Different content visible before/after JavaScript loads

**Prevention:**
- Use Server Components for all static match data
- Defer client-only logic to `useEffect`
- Ensure identical data fetching between server and client

**Phase impact:** Component architecture phase - clearly separate server vs client boundaries.

---

### Pitfall 3: Multiple Components Fetching Same Data

**What goes wrong:** Header component fetches match data. Score component fetches match data. Events component fetches match data. Same content could render from multiple sources.

**Historical evidence:** Old match page had `MatchHeader`, `MatchOddsPanel`, `PredictionsSection` all potentially displaying score/status.

**Prevention:**
- Single data fetch at page level, pass as props
- Use React `cache()` for request deduplication if components must fetch independently
- Audit: search for all places same field is rendered

**Phase impact:** Data architecture phase - establish single source of truth pattern.

---

### Pitfall 4: SEO Duplicate Content from URL Variations

**What goes wrong:** Same match accessible via:
- `/matches/[id]`
- `/leagues/[slug]/[match]`
- Query params: `?tab=predictions`

Google indexes all as separate pages with duplicate content.

**Historical evidence:** Project has both `/matches/[id]` and `/leagues/[slug]/[match]` routes. The old page redirects to new, but redirect must be permanent (308, not 307).

**Warning signs:**
- Multiple route patterns leading to same content
- 307 (temporary) redirects instead of 308 (permanent)
- Missing or incorrect canonical tags

**Prevention:**
- Permanent redirect (308) from legacy URLs
- Explicit canonical tag on every page pointing to preferred URL
- Avoid query params that don't change canonical content

**Phase impact:** SEO phase - implement canonical tags and verify redirects.

---

## SEO/GEO Pitfalls

### Pitfall 5: Answer-First Content Buried Below Fold

**What goes wrong:** Key information (final score, prediction) hidden below lengthy headers, navigation, or promotional content. AI search engines can't find the "answer" to extract.

**GEO context:** Opening paragraphs that answer the query upfront get cited 67% more by AI engines. Burying answers reduces citations.

**Warning signs:**
- Large hero sections before substantive content
- "Skip to content" links needed
- First meaningful content below 500px viewport height

**Prevention:**
- Score/prediction visible in first 300px
- Lead with answer, follow with context
- Structure: Answer -> Evidence -> Details

**Phase impact:** Layout phase - define above-fold content requirements.

---

### Pitfall 6: FAQ Schema Without Visible Content

**What goes wrong:** FAQ schema markup exists in JSON-LD, but actual FAQ content not visible on page. Google may penalize as structured data spam.

**Current context:** As of 2023 Google update (still valid 2026), FAQ rich results limited to authoritative sites. But schema still helps AI engines understand Q&A structure.

**Warning signs:**
- `FAQPage` schema in head but no FAQ section in body
- FAQ questions don't match user-visible content
- Auto-generated FAQs with generic questions

**Prevention:**
- Every FAQ schema question MUST be visible on page
- Use natural language, not robotic phrasing
- Validate with Google Rich Results Test

**Phase impact:** FAQ generation phase - ensure schema/content parity.

---

### Pitfall 7: Auto-Generated FAQ Content Quality

**What goes wrong:** FAQ auto-generation produces:
- Generic questions not specific to this match
- Answers that repeat information already on page
- Questions users don't actually ask

**Example of bad FAQ:**
- "What time is the match?" (already shown in header)
- "Who is playing?" (redundant with title)

**Example of good FAQ:**
- "What is the AI consensus prediction for [Team A] vs [Team B]?"
- "Which AI model has the best record for [Competition] matches?"

**Prevention:**
- Generate match-specific questions using team names, competition
- Answer questions not directly covered elsewhere on page
- Limit to 3-5 high-value questions

**Phase impact:** Content generation phase - define FAQ quality criteria.

---

### Pitfall 8: Missing State-Specific SEO

**What goes wrong:** Same meta title/description for upcoming, live, and finished matches. Misses opportunity for state-appropriate messaging.

**Example:**
- Upcoming: "AI Predictions for Arsenal vs Chelsea - Feb 15, 2026"
- Live: "Arsenal vs Chelsea LIVE - Current Score 1-0"
- Finished: "Arsenal 2-1 Chelsea - Match Result & AI Analysis"

**Warning signs:**
- Static meta templates that ignore match status
- No dynamic OG images based on state
- Title doesn't reflect whether match is live/finished

**Prevention:**
- State-aware metadata generation (already exists in `buildMatchMetadata`)
- Verify all 3 states have distinct, appropriate metadata
- Test OG images for each state

**Phase impact:** SEO phase - audit metadata per state.

---

## Component Architecture Pitfalls

### Pitfall 9: Implicit State Dependencies

**What goes wrong:** Component assumes match status but doesn't receive it as prop. Uses internal logic that diverges from page's understanding of status.

**Example:**
```typescript
// BAD: Component determines status independently
function ScoreDisplay({ match }) {
  const isFinished = match.homeScore !== null; // May differ from page's logic
}

// GOOD: Status passed explicitly
function ScoreDisplay({ match, isFinished }) {
  // Uses page's authoritative status
}
```

**Warning signs:**
- Multiple components computing `isFinished` independently
- Status derived from different fields in different places
- Conditional rendering based on data presence vs explicit status

**Prevention:**
- Compute status ONCE at page level
- Pass status as explicit prop to all components
- Components trust prop, don't re-derive

**Phase impact:** Component architecture phase - establish status prop pattern.

---

### Pitfall 10: State Machine Gaps

**What goes wrong:** Three states (upcoming, live, finished) but code assumes binary (upcoming vs finished). Live state gets unexpected behavior.

**Historical context:** Match lifecycle: `scheduled` -> `live` -> `finished` (also `postponed`, `cancelled`).

**Warning signs:**
- Binary checks: `isFinished ? X : Y` (what about live?)
- Missing case in switch statement
- Different components handling live differently

**Prevention:**
- Exhaustive state handling in TypeScript:
```typescript
type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

function getLayout(status: MatchStatus) {
  switch (status) {
    case 'scheduled': return UpcomingLayout;
    case 'live': return LiveLayout;
    case 'finished': return FinishedLayout;
    case 'postponed':
    case 'cancelled':
      return CancelledLayout;
  }
}
```

**Phase impact:** Type definition phase - define exhaustive status handling.

---

### Pitfall 11: Props Drilling Through Deep Hierarchies

**What goes wrong:** Match data passed through 5+ levels of components. Changes require updating many intermediate components.

**Warning signs:**
- Components receiving props they don't use, just pass through
- Same prop name appearing in many component interfaces
- Difficulty adding new data because of intermediate components

**Prevention:**
- Flatten component hierarchy for match pages
- Use composition over deep nesting
- Consider React Context for truly global match data (but prefer props for most cases)

**Phase impact:** Component architecture phase - design flat hierarchy.

---

## Mobile UX Pitfalls

### Pitfall 12: Tabs on Mobile (User Explicitly Rejected)

**What goes wrong:** Developer implements tabs "for mobile UX" but user has explicitly stated NO TABS.

**Historical evidence:** v1.3 implemented `MatchTabsMobile` with swipe gestures. v2.1 removed them per user requirement.

**Why tabs fail here:**
- Horizontal scroll + vertical scroll = confusing
- Hidden content not discoverable
- User prefers single scrollable page

**Warning signs:**
- Component names containing "Tab" or "TabMobile"
- `hidden md:block` / `md:hidden` responsive classes
- Swipeable containers

**Prevention:**
- NO TABS. Single scrollable layout.
- Same sections visible on all screen sizes
- Use collapsible sections only if content is very long (500+ words)

**Phase impact:** ALL phases - reject any tab-based proposals.

---

### Pitfall 13: Sticky Elements Interfering with Scroll

**What goes wrong:** Sticky header/footer consumes viewport space. User can't see full content. Scroll feels constrained.

**Historical evidence:** v2.1 removed sticky header per user feedback.

**Warning signs:**
- `position: sticky` or `position: fixed` on headers
- Components using `useIntersectionObserver` for sticky behavior
- CSS classes like `sticky`, `fixed`, `top-0`

**Prevention:**
- Header scrolls naturally with page
- No fixed elements except maybe bottom nav
- Test: can user see full content section without scrolling past fixed elements?

**Phase impact:** Layout phase - audit for sticky elements.

---

### Pitfall 14: Touch Target Size

**What goes wrong:** Buttons, links too small for finger taps. Accessibility failure, frustrating UX.

**Standard:** 44x44px minimum touch target (Apple HIG, WCAG).

**Warning signs:**
- Links with only icon, no padding
- Inline text links without adequate tap area
- Buttons with height < 44px

**Prevention:**
- `min-h-11 min-w-11` (44px) on all interactive elements
- Adequate padding around inline links
- Test on actual mobile device, not just DevTools

**Phase impact:** Component styling phase - enforce touch targets.

---

## Rewrite-Specific Pitfalls

### Pitfall 15: Losing Existing Functionality in Rewrite

**What goes wrong:** Rewrite focuses on "new" design, forgets to port working features from old implementation.

**Historical evidence:** Previous rewrites lost:
- Entity linking in narrative content
- Match events display for finished matches
- OG image generation

**Prevention:**
- Before rewriting, create feature inventory from existing code
- Checklist: each existing feature must be in new code OR explicitly deprecated
- Test coverage for critical features before rewriting

**Phase impact:** Planning phase - create feature inventory before starting.

---

### Pitfall 16: Big Bang Rewrite

**What goes wrong:** Attempt to rewrite entire page in one PR. Review is overwhelming, bugs hide, rollback is all-or-nothing.

**Best practice:** "Rewrites succeed when they are incremental, not heroic." Even in a rewrite, ship in phases.

**Warning signs:**
- PR touching 20+ files
- Rewrite branch open for weeks
- "Just one more thing" syndrome

**Prevention:**
- Ship new layout structure first (empty sections)
- Add sections one at a time
- Each PR is independently reviewable and deployable

**Phase impact:** ALL phases - structure as incremental PRs.

---

### Pitfall 17: Not Preserving Encapsulated Knowledge

**What goes wrong:** Old code had edge case handling developed over months. Rewrite removes it because developer didn't understand why it existed.

**Example edge cases in this project:**
- `stripHtml()` for database content with HTML tags
- Redirect from `/matches/[id]` to `/leagues/[slug]/[match]`
- Empty section hiding (return null when no data)

**Prevention:**
- Read old code thoroughly before replacing
- If unclear why something exists, ask before removing
- Comment non-obvious logic in new code

**Phase impact:** Architecture phase - document edge cases to preserve.

---

## Confidence Assessment

| Pitfall Category | Confidence | Basis |
|-----------------|------------|-------|
| Content Duplication | HIGH | Project history (quick-008, phase-25) confirms these exact issues occurred |
| SEO/GEO | MEDIUM | Web research verified; project-specific application extrapolated |
| Component Architecture | HIGH | React/Next.js established patterns; project history shows state issues |
| Mobile UX | HIGH | User requirements explicitly documented; previous failures documented |
| Rewrite-Specific | MEDIUM | Industry research verified; project-specific application extrapolated |

---

## Phase-Specific Warnings Summary

| Phase | Critical Pitfalls | Mitigation |
|-------|------------------|------------|
| Planning | #15 (losing features), #16 (big bang) | Feature inventory, incremental PRs |
| Architecture | #1 (dual-render), #9 (implicit state), #10 (state gaps) | Single-render principle, explicit status prop |
| Layout | #5 (answer buried), #12 (tabs), #13 (sticky) | Answer-first, single scroll, no sticky |
| Components | #3 (multiple fetches), #11 (props drilling), #14 (touch targets) | Single fetch, flat hierarchy, 44px targets |
| SEO | #4 (URL duplicates), #8 (state-specific meta) | Canonical tags, state-aware metadata |
| FAQ | #6 (schema mismatch), #7 (quality) | Schema/content parity, match-specific questions |
| Content | #2 (hydration mismatch) | Server Component boundaries |

---

## Sources

**Project History:**
- `/Users/pieterbos/Documents/bettingsoccer/.planning/quick/008-fix-duplicate-match-content/008-SUMMARY.md`
- `/Users/pieterbos/Documents/bettingsoccer/.planning/phases/24-match-page-cleanup/24-VERIFICATION.md`
- `/Users/pieterbos/Documents/bettingsoccer/.planning/phases/25-content-rendering-fix/25-VERIFICATION.md`

**SEO/GEO Research:**
- [Next.js SEO: How to solve Duplicate Content](https://akoskm.com/nextjs-seo-how-to-solve-duplicate-google-chose-different-canonical-than-user/)
- [SEO for AI Engines: A 2026 Guide to AI Search Optimization & GEO](https://blog.brandsatplayllc.com/blog/seo-for-ai-engines-a-2026-guide-to-ai-search-optimization-geo)
- [The rise and fall of FAQ schema](https://searchengineland.com/faq-schema-rise-fall-seo-today-463993)
- [Schema Markup in 2026](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/)

**React/Component Research:**
- [React Strict Mode - Official Docs](https://react.dev/reference/react/StrictMode)
- [State Machines in React](https://mastery.games/post/state-machines-in-react/)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

**Mobile UX Research:**
- [Tabs UX: Best Practices and When to Avoid](https://www.eleken.co/blog-posts/tabs-ux)
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [Scrolling is Faster than Paging](https://www.freshconsulting.com/insights/blog/uiux-principle-33-scrolling-is-faster-than-paging/)

**Rewrite vs Refactor:**
- [Refactor vs Rewrite vs Replatform 2026](https://devoxsoftware.com/blog/refactor-vs-rewrite-vs-replatform-what-s-right-for-your-business-in-2026/)
- [Why refactoring is almost always better than rewriting](https://www.ben-morris.com/why-refactoring-code-is-almost-always-better-than-rewriting-it/)

---

*Researched: 2026-02-03*
*Researcher: Claude (gsd-researcher)*
