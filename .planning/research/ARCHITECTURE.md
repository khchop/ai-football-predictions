# Architecture Research: v2.2 Match Page Rewrite

**Researched:** 2026-02-03
**Confidence:** HIGH (based on codebase analysis)
**Focus:** Component hierarchy, data flow, state-aware layouts, build order

---

## Executive Summary

The current match page (`src/app/leagues/[slug]/[match]/page.tsx`) has grown organically with 15+ component imports and inline rendering logic. While v2.1 cleaned up tabs and unified layouts, the page still suffers from:

1. **Data prop drilling** - Match data passed to 10+ components individually
2. **Duplicate status derivation** - `isFinished`, `isLive` calculated multiple times
3. **Mixed concerns** - Page component handles data fetching, rendering, and layout decisions
4. **Scattered state logic** - Each component re-derives match state internally

The rewrite should introduce a clean component hierarchy with a single source of truth for match state and data.

---

## Component Hierarchy

### Recommended Structure

```
MatchPage (Server Component - page.tsx)
|
+-- MatchDataProvider (Context boundary - provides match + meta)
    |
    +-- MatchLayout (State-aware layout selector)
        |
        +-- UpcomingMatchLayout | LiveMatchLayout | FinishedMatchLayout
            |
            +-- MatchHero (Score/VS display - SINGLE score render)
            |   +-- TeamDisplay (home/away with logos)
            |   +-- ScoreDisplay (conditional: VS or actual score)
            |   +-- MatchMeta (date, time, venue, competition)
            |
            +-- MatchTLDR (State-aware summary)
            |
            +-- MatchContent (Narrative sections)
            |   +-- PreMatchNarrative (upcoming only)
            |   +-- PredictionAnalysis (live/finished)
            |   +-- PostMatchReport (finished only)
            |
            +-- MatchEvents (live/finished - goals, cards timeline)
            |
            +-- MatchStats (predictions percentages + roundup stats)
            |
            +-- PredictionsTable (35 model predictions)
            |
            +-- MatchFAQ (auto-generated, schema.org)
            |
            +-- RelatedContent
                +-- ExploreMoreLinks
                +-- RelatedMatchesWidget
```

### Component Responsibilities

| Component | Responsibility | Renders |
|-----------|----------------|---------|
| `MatchPage` | Data fetching, SEO metadata | Layout wrapper |
| `MatchDataProvider` | Context boundary, normalized data | Children with context |
| `MatchLayout` | State routing (`upcoming`/`live`/`finished`) | Correct layout variant |
| `MatchHero` | Visual score/teams display | Team logos, score OR "VS" |
| `MatchTLDR` | One-sentence summary | Status-aware text |
| `MatchContent` | Narrative content sections | 1-3 narrative blocks |
| `PredictionsTable` | All 35 model predictions | Sortable table/cards |
| `MatchFAQ` | Auto-generated Q&A | Expandable FAQ + schema |

### Key Principle: Single Responsibility

Each component should:
- Accept props from context or direct parent
- Not re-derive match state (`isFinished` etc.)
- Render ONE piece of information (no duplicate scores)
- Handle its own empty state (return `null` if no content)

---

## Data Flow

### Current Problems

1. **Prop drilling**: Match data passed to every component:
   ```tsx
   // Current: 10+ components receive match data
   <MatchH1 homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} ... />
   <MatchTLDR match={matchData} competition={competition} />
   <MatchPageHeader match={matchData} competition={competition} isLive={isLive} ... />
   ```

2. **Duplicate derivation**: Status calculated in page AND components:
   ```tsx
   // page.tsx
   const isFinished = matchData.status === 'finished';

   // match-tldr.tsx
   const isFinished = match.status === 'finished';  // DUPLICATE
   ```

3. **Data spread**: Same data fetched in page, but components re-fetch:
   ```tsx
   // MatchContentSection fetches its own data
   const content = await getMatchContent(matchId);
   ```

### Recommended: Context-Based Single Source of Truth

```tsx
// types/match-context.ts
interface MatchContextValue {
  // Core data
  match: Match;
  competition: Competition;

  // Derived state (computed once)
  state: 'upcoming' | 'live' | 'finished';

  // Optional data (fetched in page)
  analysis: MatchAnalysis | null;
  predictions: PredictionWithModel[];
  content: MatchContent | null;
  events: MatchEvent[];
  roundup: MatchRoundup | null;

  // Helpers
  kickoff: Date;
  score: { home: number; away: number } | null;
}

// components/match/match-data-provider.tsx
export const MatchContext = createContext<MatchContextValue | null>(null);

export function MatchDataProvider({
  value,
  children
}: {
  value: MatchContextValue;
  children: React.ReactNode
}) {
  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within MatchDataProvider');
  return ctx;
}
```

### Data Flow Diagram

```
[page.tsx - Server Component]
     |
     | 1. Fetch all data in parallel (existing pattern - good)
     | 2. Derive state once: upcoming/live/finished
     | 3. Normalize into MatchContextValue
     |
     v
[MatchDataProvider - Context boundary]
     |
     | Provides: match, competition, state, analysis, predictions, etc.
     |
     v
[MatchLayout - State router]
     |
     | Reads: state from context
     | Routes to: UpcomingLayout | LiveLayout | FinishedLayout
     |
     v
[Child Components]
     |
     | useMatch() hook to access data
     | NO prop drilling
     | NO re-derivation of state
```

### Why Context Works Here

1. **Server Components**: Context works with RSC when provider is client component
2. **Single render**: Match page is one render tree (no navigation within)
3. **Predictable data**: All data available at page load (no client fetching)
4. **Type safety**: Single interface ensures consistency

---

## State-Aware Layouts

### Match States

| State | Condition | Key Sections |
|-------|-----------|--------------|
| `upcoming` | `status === 'scheduled'` | Preview narrative, predictions, FAQ |
| `live` | `status === 'live'` | Live score, events, predictions |
| `finished` | `status === 'finished'` | Final score, events, report, scored predictions |

### Layout Variants

#### UpcomingMatchLayout
```
1. MatchHero (VS display, no score)
2. MatchTLDR ("AI models predict...")
3. MatchContent/PreMatchNarrative
4. MatchStats (predictions percentages)
5. PredictionsTable (unsorted, no points)
6. MatchFAQ (prediction-focused questions)
7. RelatedContent
```

#### LiveMatchLayout
```
1. MatchHero (live score with pulse indicator)
2. MatchTLDR ("X-X as of now")
3. MatchEvents (timeline of goals/cards)
4. PredictionsTable (unsorted, no points yet)
5. RelatedContent
```

#### FinishedMatchLayout
```
1. MatchHero (final score with winner highlight)
2. MatchTLDR ("Team A beat Team B X-X")
3. MatchEvents (complete timeline)
4. MatchContent/PostMatchReport
5. MatchStats (roundup stats: possession, xG, etc.)
6. PredictionsTable (sorted by points, badges for exact/correct)
7. MatchFAQ (result-focused questions)
8. RelatedContent
```

### Implementation Pattern

```tsx
// components/match/match-layout.tsx
export function MatchLayout() {
  const { state } = useMatch();

  switch (state) {
    case 'upcoming':
      return <UpcomingMatchLayout />;
    case 'live':
      return <LiveMatchLayout />;
    case 'finished':
      return <FinishedMatchLayout />;
  }
}

// components/match/layouts/upcoming-match-layout.tsx
export function UpcomingMatchLayout() {
  return (
    <div className="space-y-8">
      <MatchHero />
      <MatchTLDR />
      <PreMatchNarrative />
      <MatchStats />
      <PredictionsSection />
      <MatchFAQ />
      <RelatedContent />
    </div>
  );
}
```

---

## Build Order

Based on component dependencies and the ability to incrementally verify:

### Phase 1: Foundation (Day 1-2)

**Goal:** Establish data flow without changing UI

1. **Create `MatchContextValue` type** (`src/types/match-context.ts`)
   - Define normalized data shape
   - Include all derived state

2. **Create `MatchDataProvider`** (`src/components/match/match-data-provider.tsx`)
   - Context creation
   - `useMatch()` hook
   - Client component wrapper

3. **Create `MatchLayout` router** (`src/components/match/match-layout.tsx`)
   - State-based routing
   - Placeholder layouts initially

**Verification:** Page renders with context, no visual change

### Phase 2: Hero Component (Day 3)

**Goal:** Single score render point

4. **Create `MatchHero`** (`src/components/match/match-hero.tsx`)
   - Consolidates: `MatchHeader`, `MatchH1`, score display
   - Single source of score rendering
   - Team logos, match meta (date, time, venue)

5. **Create `TeamDisplay`** (`src/components/match/team-display.tsx`)
   - Reusable team logo + name
   - Home/away styling

6. **Create `ScoreDisplay`** (`src/components/match/score-display.tsx`)
   - "VS" for upcoming
   - Score with winner highlight for finished
   - Live indicator for in-progress

**Verification:** Score appears exactly once, all states render correctly

### Phase 3: Content Components (Day 4-5)

**Goal:** Narrative sections with zero duplication

7. **Refactor `MatchContent`**
   - Use context instead of fetching
   - Split into: `PreMatchNarrative`, `PredictionAnalysis`, `PostMatchReport`

8. **Refactor `MatchTLDR`**
   - Use context for state
   - Remove internal derivation

9. **Keep `MatchFAQ`** (already clean)
   - Update to use context

**Verification:** Content renders in correct states, no duplicate text

### Phase 4: Data Components (Day 6-7)

**Goal:** Predictions and stats with proper sorting

10. **Refactor `PredictionsTable`** (`src/components/match/predictions-table.tsx`)
    - Use context for `isFinished`
    - Add column sorting
    - Remove predictions prop (get from context)

11. **Refactor `MatchStats`**
    - Use context for analysis and roundup
    - Remove prop drilling

12. **Refactor `MatchEvents`**
    - Use context for events array
    - Conditional render based on state

**Verification:** Predictions sorted correctly, stats show for correct states

### Phase 5: Layout Assembly (Day 8)

**Goal:** Wire everything together

13. **Create layout variants**
    - `UpcomingMatchLayout`
    - `LiveMatchLayout`
    - `FinishedMatchLayout`

14. **Update page.tsx**
    - Fetch data (existing parallel pattern)
    - Create `MatchContextValue`
    - Wrap in `MatchDataProvider`
    - Render `MatchLayout`

**Verification:** All three states render correctly with proper sections

### Phase 6: Cleanup (Day 9-10)

**Goal:** Remove deprecated code, optimize

15. **Delete deprecated components**
    - `match-header.tsx` (replaced by `MatchHero`)
    - `match-page-header.tsx` (wrapper removed)
    - Any unused tab components

16. **Performance audit**
    - Verify PPR still works
    - Check for unnecessary re-renders
    - Validate hydration

**Verification:** No regressions, clean component tree

---

## Anti-Patterns to Avoid

### 1. Prop Drilling for Match Data
**Bad:**
```tsx
<Component match={match} competition={comp} isLive={isLive} isFinished={isFinished} />
```
**Good:**
```tsx
<Component />  // Uses useMatch() internally
```

### 2. Duplicate State Derivation
**Bad:**
```tsx
// In every component
const isFinished = match.status === 'finished';
```
**Good:**
```tsx
// Once in page, passed via context
const { state } = useMatch();  // 'upcoming' | 'live' | 'finished'
```

### 3. Components That Fetch Their Own Data
**Bad:**
```tsx
export async function MatchContentSection({ matchId }) {
  const content = await getMatchContent(matchId);  // Re-fetch!
  ...
}
```
**Good:**
```tsx
export function MatchContentSection() {
  const { content } = useMatch();  // From context
  ...
}
```

### 4. Multiple Score Renders
**Bad:**
```tsx
<MatchH1>Team A 2-1 Team B</MatchH1>  // Score #1
<MatchHeader>2 - 1</MatchHeader>       // Score #2
<MatchTLDR>Team A beat Team B 2-1</MatchTLDR>  // Score #3
```
**Good:**
```tsx
<MatchH1 />  // sr-only, semantic
<MatchHero />  // Visual score, ONLY place
<MatchTLDR />  // Text summary, no score duplication
```

### 5. Conditional Logic in JSX
**Bad:**
```tsx
{isFinished && matchEvents.length > 0 && (
  <Card>
    {isFinished && match.homeScore !== null && ...}
  </Card>
)}
```
**Good:**
```tsx
// In FinishedMatchLayout only
<MatchEvents />  // Component handles empty state
```

---

## Component Duplication Analysis

### Current Duplicate Content Areas

| Content | Current Locations | Recommended |
|---------|-------------------|-------------|
| Score | `MatchH1`, `MatchHeader`, `MatchTLDR` | `MatchHero` only (sr-only H1 for SEO) |
| Team names | `MatchH1`, `MatchHeader`, `PredictionTable` | Context provides, components render |
| Match status | Derived in 5+ places | `MatchDataProvider` derives once |
| Kickoff date | `MatchHeader`, `MatchFAQ` | Context provides parsed `Date` |

### Files to Delete After Rewrite

1. `src/components/match/match-header.tsx` - Replaced by `MatchHero`
2. `src/components/match/match-page-header.tsx` - Thin wrapper, unnecessary
3. `src/components/match/match-header-sticky.tsx` - v2.1 removed sticky headers
4. `src/components/match/tab-content/*.tsx` - v2.1 removed tabs
5. `src/components/match/match-tabs-mobile.tsx` - v2.1 removed tabs

---

## Server Component Considerations

### Current: Mostly Server Components

The match page uses async Server Components for data fetching:
- `page.tsx` - async Server Component (good)
- `MatchContentSection` - async Server Component (fetches data)
- `RelatedMatchesWidget` - async Server Component (fetches data)

### Recommended: Server + Client Hybrid

```tsx
// page.tsx - Server Component (fetches all data)
export default async function MatchPage({ params }) {
  const data = await fetchAllMatchData(params);

  return (
    <MatchDataProvider value={data}>  {/* Client Component */}
      <MatchLayout />                   {/* Client Component */}
    </MatchDataProvider>
  );
}

// MatchDataProvider - Client Component (provides context)
'use client';
export function MatchDataProvider({ value, children }) {
  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

// MatchHero - Server or Client (no data fetching)
export function MatchHero() {
  const { match, state, score } = useMatch();
  // Pure rendering, no async
}
```

### PPR Compatibility

Next.js 16 PPR (Partial Prerendering) works with this pattern:
- Static shell: Layout, navigation, footer
- Dynamic content: Match data (via `connection()` signal in queries)

The context pattern doesn't break PPR because:
1. Data fetching happens in Server Component (page.tsx)
2. Context provider is client component but receives serialized props
3. Child components consume context, don't fetch

---

## Sources

- **Codebase analysis**: Direct examination of `src/app/leagues/[slug]/[match]/page.tsx` and all match components
- **Existing architecture**: `.planning/codebase/ARCHITECTURE.md`
- **PROJECT.md**: v2.2 requirements and goals
- **Next.js 16 patterns**: PPR, Server Components, Context with RSC

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Component hierarchy | HIGH | Based on existing components and clear patterns |
| Data flow pattern | HIGH | Context is well-established React pattern |
| State-aware layouts | HIGH | Requirements clearly define three states |
| Build order | MEDIUM | Dependencies clear, but timing estimates may vary |
| Duplication fixes | HIGH | Analyzed existing code for exact duplication points |

---

## Open Questions for Phase Planning

1. **MatchHero component boundary**: Should it include breadcrumbs/back link, or separate?
2. **Animation requirements**: Any transitions between states for live matches?
3. **Error boundaries**: Per-section or page-level error handling?
4. **Skeleton states**: Loading UI needed for any sections?
