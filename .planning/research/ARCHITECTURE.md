# Architecture Research: Match Page Refresh

**Researched:** 2026-02-02
**Confidence:** HIGH

## Summary

The match page suffers from architectural bloat (545-line monolithic component), duplicate data rendering, and a broken content pipeline. Content exists in `matchContent` and `matchRoundups` tables but isn't displaying due to query misalignment and component structure. The architecture should follow Next.js 15 server-first patterns with strategic component boundaries, mobile-first layout hierarchy, and clean data flow from database → RSC → rendering.

---

## Current Pain Points

### 1. Monolithic Page Component
**File:** `/src/app/leagues/[slug]/[match]/page.tsx` (545 lines)
- **Issue:** Inline JSX mixing layout, data fetching, and presentation
- **Consequence:** Hard to maintain, test, or reuse components
- **Location:** Lines 169-544 contain massive inline JSX with duplicated logic

### 2. Broken Content Rendering
**Component:** `MatchContentSection` (`src/components/match/MatchContent.tsx`)
- **Issue:** Queries `matchContent` table but content generation writes to both `matchContent` AND `matchRoundups`
- **Root cause:** Dual-table architecture created confusion — `generatePostMatchRoundup()` writes HTML to `matchContent.postMatchContent` but main narrative to `matchRoundups.narrative`
- **Evidence:** Line 353 renders `<MatchContentSection matchId={matchData.id} />` which queries `getMatchContent(matchId)`, but this only returns 3-section text fields, not the rich roundup data

### 3. Duplicate Data Sections
**Problem:** Match metadata rendered THREE times:
1. **Lines 198-330:** Main match card (team logos, score, venue, time)
2. **Lines 356-370:** RoundupViewer scoreboard (if roundup exists)
3. **Lines 332-343:** MatchEvents section (if finished/live)

**Consequence:** Mobile users scroll through repetitive information

### 4. Content Generation Pipeline Confusion
**Files:** `src/lib/content/generator.ts` (lines 904-950)
- **Issue:** Post-match roundup writes to TWO tables:
  - `matchRoundups` table: Structured JSON (scoreboard, events, stats, narrative)
  - `matchContent` table: Legacy HTML blob for backward compatibility
- **Result:** Components don't know which source to use

### 5. Inconsistent Component Boundaries
**Components that overlap:**
- `MatchStats` (league context, H2H, predictions)
- `MatchContentSection` (3-section narrative)
- `RoundupViewer` (full post-match analysis)
- `PredictionTable` (AI model predictions)

No clear ownership of "who renders what when"

### 6. Mobile Layout Issues
- Match card optimized for desktop (team logos side-by-side)
- No progressive disclosure patterns
- Stats grids force horizontal scroll on narrow screens
- Related content widgets placed at bottom (lost in scroll depth)

---

## Proposed Structure

### Page Hierarchy (Server Components First)

```
src/app/leagues/[slug]/[match]/page.tsx (150 lines max)
├── Metadata generation
├── Data fetching layer (6 queries → parallel)
│   ├── getMatchBySlug()
│   ├── getMatchWithAnalysis()
│   ├── getPredictionsForMatchWithDetails()
│   ├── getMatchContent() + getMatchRoundup() → UNIFIED
│   ├── getStandingsForTeams()
│   └── getNextMatchesForTeams()
└── Layout composition
    ├── <MatchHeader /> — New consolidated component
    ├── <MatchContentTabs /> — New tabbed interface
    │   ├── Tab: Overview (default, mobile-first)
    │   ├── Tab: Predictions
    │   ├── Tab: Analysis
    │   └── Tab: Stats
    └── <MatchRelatedContent /> — Sidebar/bottom module
```

### New Components to Create

#### 1. `MatchHeader.tsx` (Server Component)
**Purpose:** Consolidate scoreboard + metadata + status badge
**Props:**
```typescript
interface MatchHeaderProps {
  match: Match;
  competition: Competition;
  isLive: boolean;
  isFinished: boolean;
}
```
**Renders:**
- Team logos + names
- Score/VS indicator
- Status badge (Live/Upcoming/Full Time)
- Competition + round
- Venue + kickoff time
- Back to league link

**Mobile-first:** Stacked layout on <768px, side-by-side on desktop

#### 2. `MatchContentTabs.tsx` (Client Component)
**Purpose:** Organize dense content into tabs to reduce scroll depth
**Props:**
```typescript
interface MatchContentTabsProps {
  match: Match;
  predictions: Prediction[];
  content: MatchContentUnified | null; // NEW unified type
  analysis: MatchAnalysis | null;
  standings: { home: Standing | null; away: Standing | null };
  h2h: H2HMatch[];
}
```
**Tabs:**
1. **Overview** (default)
   - Match narrative (from `matchContent` or `matchRoundups`)
   - Key stats summary
   - Top 3 predictions
2. **Predictions**
   - Full PredictionTable
   - Model accuracy comparison
3. **Analysis**
   - RoundupViewer (if finished)
   - MatchStats (league context, H2H, odds)
4. **Stats**
   - MatchEvents timeline
   - Extended statistics

**Why client component:** Tab state requires `useState` for active tab

#### 3. `MatchOverviewTab.tsx` (Server Component)
**Purpose:** Mobile-optimized summary for quick consumption
**Renders:**
- Narrative content (150-200 word snippet)
- Key match stats (possession, shots, xG) — 3-column grid
- Top 3 AI predictions — compact card layout
- Call-to-action: "View all predictions" → switches to Predictions tab

#### 4. `MatchRelatedContent.tsx` (Server Component)
**Purpose:** SEO internal linking + user navigation
**Renders:**
- Related matches widget (already exists)
- Upcoming fixtures
- Popular models
- Competition link

**Desktop:** Sidebar (sticky positioned)
**Mobile:** Bottom section (after main content)

### Components to Modify

#### 1. `MatchContentSection.tsx` → `MatchNarrative.tsx`
**Changes:**
- Rename for clarity
- Accept unified content type (handles both `matchContent` and `matchRoundups`)
- Simplify to single narrative block (no 3-section layout)
- Add "Read full roundup" link if `matchRoundups` exists

**New interface:**
```typescript
interface MatchNarrativeProps {
  content: {
    narrative: string; // Unified from either source
    generatedAt: Date;
    source: 'matchContent' | 'matchRoundup';
  } | null;
  isFinished: boolean;
}
```

#### 2. `RoundupViewer.tsx`
**Changes:**
- Remove redundant scoreboard section (already in MatchHeader)
- Keep: Events timeline, Stats grid, Model predictions table, Top performers, Narrative
- Add prop: `compact?: boolean` for embedding in tabs vs standalone

#### 3. `MatchStats.tsx`
**Changes:**
- Move to Analysis tab (not Overview)
- Keep: League context, H2H, Predictions percentages
- Remove: Odds section (move to new BettingInsights component if needed)

### Components to Remove/Consolidate

**Remove:**
- `match-header.tsx` — superseded by new MatchHeader
- `match-odds.tsx` — integrate into MatchStats or separate BettingInsights
- `predictions-skeleton.tsx` — use Suspense boundaries instead
- `predictions-section.tsx` — fold into PredictionTable

**Keep:**
- `PredictionTable` (used in Predictions tab)
- `match-h1.tsx` (SEO H1 component)
- `MatchFAQSchema.tsx` (structured data)
- `PredictionInsightsBlockquote.tsx` (AI summary)
- `related-matches-widget.tsx` (SEO linking)

---

## Data Flow

### Current Flow (Broken)
```
Match finished
  ↓
Settlement worker → generatePostMatchRoundup()
  ↓
Writes to TWO tables:
  1. matchRoundups (structured JSON + narrative)
  2. matchContent.postMatchContent (HTML blob)
  ↓
Page component renders:
  - MatchContentSection queries matchContent (shows HTML blob)
  - RoundupViewer queries matchRoundups (shows structured data)
  ↓
RESULT: Duplicate rendering OR missing content (if only one table populated)
```

### Proposed Flow (Fixed)
```
Match finished
  ↓
Settlement worker → generatePostMatchRoundup()
  ↓
Writes to matchRoundups ONLY (single source of truth)
  ↓
Deprecate matchContent.postMatchContent field
Keep matchContent for pre-match + betting sections only
  ↓
Page component:
  - Queries getMatchRoundup(matchId) for finished matches
  - Queries getMatchContent(matchId) for pre-match/betting text
  ↓
Unified in MatchNarrative component:
  if (roundup) display roundup.narrative
  else if (content.postMatchContent) display legacy HTML
  else display content.preMatchContent || content.bettingContent
  ↓
RESULT: Single content source, no duplication
```

### Query Consolidation
**New utility function:** `src/lib/content/queries.ts`
```typescript
export async function getMatchContentUnified(matchId: string) {
  const [content, roundup] = await Promise.all([
    getMatchContent(matchId),
    getMatchRoundup(matchId),
  ]);

  return {
    // Pre-match and betting from matchContent
    preMatch: content?.preMatchContent,
    betting: content?.bettingContent,

    // Post-match: prefer roundup, fallback to legacy
    postMatch: roundup
      ? { source: 'roundup', data: roundup }
      : content?.postMatchContent
        ? { source: 'legacy', html: content.postMatchContent }
        : null,
  };
}
```

---

## Content Generation Pipeline

### Current Issue
**Problem:** `generatePostMatchRoundup()` writes to both tables (lines 904-973 in `generator.ts`)

### Fix Strategy
**Phase 1: Deprecate Dual Writes (Immediate)**
1. Modify `generatePostMatchRoundup()`:
   - Write ONLY to `matchRoundups` table
   - Remove lines 952-973 (matchContent insert)
   - Keep backward compatibility read path in UI

**Phase 2: Migration (Follow-up milestone)**
1. Backfill script: Copy `matchContent.postMatchContent` → `matchRoundups.narrative`
2. Add database migration: `ALTER TABLE match_content DROP COLUMN post_match_content`
3. Update all queries to use `matchRoundups` only

### Content Generation Triggers
**Keep existing:**
- T-6h: Pre-match analysis → `matchContent.preMatchContent`
- T-30m: Betting insights → `matchContent.bettingContent`
- Match finished + settled: Post-match → `matchRoundups` (new single source)

---

## Component Consolidation

### What to Merge
**Before:** 12 components in `src/components/match/`
**After:** 8 components (33% reduction)

| Old Component | Action | New Home |
|---------------|--------|----------|
| `match-header.tsx` | Replace | New `MatchHeader.tsx` |
| `match-odds.tsx` | Merge | Into `MatchStats.tsx` |
| `predictions-skeleton.tsx` | Remove | Use Suspense |
| `predictions-section.tsx` | Merge | Into `PredictionTable` |
| `MatchContent.tsx` | Rename | `MatchNarrative.tsx` |
| `MatchStats.tsx` | Keep | Move to Analysis tab |
| `RoundupViewer.tsx` | Modify | Remove scoreboard duplication |
| `PredictionInsightsBlockquote.tsx` | Keep | Use in Overview tab |
| `MatchFAQSchema.tsx` | Keep | SEO structured data |
| `match-h1.tsx` | Keep | SEO H1 |
| `related-matches-widget.tsx` | Keep | SEO internal linking |
| `MatchRoundup.tsx` | Audit | May be unused duplicate |

---

## Build Order

### Phase 1: Data Layer (Foundation)
**Goal:** Fix content retrieval without touching UI
**Tasks:**
1. Create `getMatchContentUnified()` query function
2. Add unit tests for query logic
3. Verify data flow with existing components

**Estimated effort:** 4 hours
**Complexity:** Low
**Risk:** Low (read-only changes)

### Phase 2: Component Refactor (Core)
**Goal:** New components + consolidation
**Tasks:**
1. Create `MatchHeader.tsx` (extract from page.tsx lines 198-330)
2. Create `MatchContentTabs.tsx` (client component with tab state)
3. Create `MatchOverviewTab.tsx` (server component)
4. Rename `MatchContent.tsx` → `MatchNarrative.tsx` with unified content support

**Estimated effort:** 12 hours
**Complexity:** Medium
**Risk:** Medium (requires testing all match states)

### Phase 3: Page Restructure (Integration)
**Goal:** Slim page.tsx and wire new components
**Tasks:**
1. Rewrite page.tsx using new components (target: <150 lines)
2. Update data fetching to use `getMatchContentUnified()`
3. Add Suspense boundaries for streaming
4. Test all match states (scheduled, live, finished)

**Estimated effort:** 8 hours
**Complexity:** Medium
**Risk:** High (user-facing changes)

### Phase 4: Mobile Optimization (Polish)
**Goal:** Responsive design + progressive disclosure
**Tasks:**
1. Mobile-first CSS for MatchHeader (stacked layout)
2. Tab interface optimized for touch (min 44px tap targets)
3. Related content sidebar → bottom on mobile
4. Test on real devices (iOS Safari, Android Chrome)

**Estimated effort:** 6 hours
**Complexity:** Low
**Risk:** Low (CSS-only changes)

### Phase 5: Content Pipeline Fix (Cleanup)
**Goal:** Eliminate dual-table writes
**Tasks:**
1. Modify `generatePostMatchRoundup()` to write only to `matchRoundups`
2. Deploy and monitor for 48 hours
3. Backfill legacy data (migration script)
4. Drop `matchContent.postMatchContent` column

**Estimated effort:** 8 hours
**Complexity:** Low
**Risk:** High (data migration requires backup/rollback plan)

---

## AI Search Optimization

### Current Issues
1. **Unstructured HTML blobs:** `matchContent.postMatchContent` contains raw HTML (lines 904-950 in generator.ts)
2. **Buried narrative:** Key insights hidden in 545-line component
3. **No progressive disclosure:** Mobile users hit wall of text

### Recommendations

#### 1. Structured Content Format
**For AI crawlers (Perplexity, ChatGPT):**
```typescript
interface AIOptimizedContent {
  summary: string; // 2-3 sentences (50 words max)
  keyInsights: string[]; // 3-5 bullet points
  mainNarrative: string; // Full analysis (500-1000 words)
  metadata: {
    matchScore: string;
    topPerformers: string[];
    consensusPrediction: string;
  };
}
```

**Why:** AI search engines prefer structured, scannable content with clear hierarchy

#### 2. Schema.org Enhancements
**Already have:** `SportsEventSchema`, `WebPageSchema`
**Add:** `FAQPage` schema to MatchFAQSchema component (line 437)

**Example:**
```typescript
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the predicted score for {home} vs {away}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{consensus prediction from AI models}"
      }
    }
  ]
}
```

#### 3. Content Hierarchy for AI
**Update MatchNarrative to use semantic HTML:**
```html
<article itemscope itemtype="https://schema.org/SportsEvent">
  <h2 itemprop="name">Match Analysis: {home} vs {away}</h2>

  <section itemprop="description">
    <h3>Summary</h3>
    <p>{50-word summary}</p>
  </section>

  <section>
    <h3>Key Insights</h3>
    <ul>
      <li>{insight 1}</li>
      <li>{insight 2}</li>
    </ul>
  </section>

  <section>
    <h3>Detailed Analysis</h3>
    <p>{full narrative}</p>
  </section>
</article>
```

**Why:** Semantic HTML helps AI understand content structure

---

## Architecture Patterns Followed

### Server-First Rendering (Next.js 15)
**Pattern:** Server Components by default, Client Components only for interactivity
**Application:**
- Page component: Server Component (data fetching)
- MatchHeader, MatchNarrative, MatchRelatedContent: Server Components (static)
- MatchContentTabs: Client Component (tab state)
- PredictionTable: Server Component with Suspense

**Source:** [Next.js App Router Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)

### Streaming with Suspense
**Pattern:** Progressive rendering for slow data sources
**Application:**
```tsx
<Suspense fallback={<PredictionSkeleton />}>
  <PredictionTable predictions={predictions} />
</Suspense>
```

**Why:** Predictions query can be slow (35+ models), stream them separately

**Source:** [Next.js Data Fetching Patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns)

### Mobile-First Component Design
**Pattern:** Design for smallest screen, progressively enhance
**Application:**
- MatchHeader: Vertical stack → horizontal on ≥768px
- MatchContentTabs: Full-width tabs → sidebar on ≥1024px
- Stats grids: 2-column → 3-column → 5-column responsive

**Source:** [React Stack Patterns 2026](https://www.patterns.dev/react/react-2026/)

### Progressive Disclosure
**Pattern:** Show essential content first, details on demand
**Application:**
- Overview tab: Summary + top 3 predictions (visible immediately)
- Analysis tab: Full stats + H2H (one click away)
- Related content: Bottom section (low priority)

**Why:** Mobile users need core info within first 2 seconds

**Source:** [React.js 2026 Performance Revolution](https://medium.com/@expertappdevs/react-js-2026-performance-secure-architecture-84f78ad650ab)

### Component Composition over Props Drilling
**Pattern:** Children pattern for flexible layouts
**Application:**
```tsx
<MatchContentTabs>
  <Tab label="Overview">
    <MatchOverviewTab content={content} predictions={predictions.slice(0, 3)} />
  </Tab>
  <Tab label="Predictions">
    <PredictionTable predictions={predictions} />
  </Tab>
</MatchContentTabs>
```

**Why:** Avoids passing 10+ props through intermediate components

---

## Integration Points with Existing System

### 1. Data Layer
**Interfaces with:**
- `src/lib/db/queries.ts` — Match, prediction, analysis queries
- `src/lib/content/queries.ts` — Content generation queries

**New function needed:**
```typescript
// src/lib/content/queries.ts
export async function getMatchContentUnified(matchId: string)
```

### 2. Content Generation
**Interfaces with:**
- `src/lib/queue/workers/content.worker.ts` — BullMQ job handler
- `src/lib/content/generator.ts` — AI generation logic

**Modified function:**
```typescript
// src/lib/content/generator.ts (line 487)
export async function generatePostMatchRoundup(matchId: string)
// Remove matchContent write, keep only matchRoundups write
```

### 3. Component Tree
**Parent:** `/src/app/leagues/[slug]/[match]/page.tsx`
**Children:**
- `MatchHeader` (new)
- `MatchContentTabs` (new)
  - `MatchOverviewTab` (new)
  - `PredictionTable` (existing)
  - `RoundupViewer` (modified)
  - `MatchStats` (modified)
- `MatchRelatedContent` (new)

**Removed dependencies:**
- `match-header.tsx` (replaced)
- `match-odds.tsx` (merged)
- `predictions-section.tsx` (merged)

### 4. Schema/Database
**Tables affected:**
- `matchContent` — Only pre-match + betting fields used
- `matchRoundups` — Primary source for post-match content

**Migration needed:**
```sql
-- Phase 5: After verifying new flow works
ALTER TABLE match_content DROP COLUMN post_match_content;
ALTER TABLE match_content DROP COLUMN post_match_generated_at;
```

### 5. API Routes
**Cron job:** `/src/app/api/cron/generate-content/route.ts`
**Change required:** Update to call modified `generatePostMatchRoundup()` (no breaking changes to interface)

---

## Risk Mitigation

### High-Risk Areas
1. **Data migration (Phase 5):** Dropping `matchContent.postMatchContent` column
   - **Mitigation:** Full database backup, deploy in maintenance window, rollback plan tested
   - **Validation:** Run backfill script on staging, verify 100% data coverage

2. **Page restructure (Phase 3):** User-facing layout changes
   - **Mitigation:** Feature flag for new layout, A/B test on 10% traffic
   - **Validation:** Visual regression tests, mobile device testing

3. **Content rendering logic:** Unified query may miss edge cases
   - **Mitigation:** Write comprehensive tests for all match states
   - **Validation:** Smoke test on 100 matches (scheduled, live, finished, with/without roundup)

### Medium-Risk Areas
1. **Mobile performance:** New tab component may increase JS bundle
   - **Mitigation:** Code-split tabs, lazy load non-default tabs
   - **Validation:** Lighthouse audit, target <200KB initial JS

2. **SEO impact:** Layout changes may affect rankings
   - **Mitigation:** Keep URL structure, preserve H1, maintain schema.org
   - **Validation:** Google Search Console monitoring for 2 weeks post-deploy

---

## Sources

**Next.js Architecture:**
- [Next.js App Router Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [Data Fetching Patterns | Next.js](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns)
- [Server and Client Components | Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components)

**React Patterns:**
- [React Stack Patterns 2026](https://www.patterns.dev/react/react-2026/)
- [React.js 2026 Performance Revolution](https://medium.com/@expertappdevs/react-js-2026-performance-secure-architecture-84f78ad650ab)
- [React Server Components Explained 2026](https://www.grapestechsolutions.com/blog/react-server-components-explained/)

**Mobile-First Design:**
- [The New Architecture of React: Reusability and UX in Next.js Era](https://www.bitcot.com/new-architecture-of-react/)

**Project Source Code:**
- `/src/app/leagues/[slug]/[match]/page.tsx` (current implementation)
- `/src/lib/content/generator.ts` (content generation pipeline)
- `/src/components/match/*.tsx` (existing components)
- `/src/lib/db/schema.ts` (database schema)
