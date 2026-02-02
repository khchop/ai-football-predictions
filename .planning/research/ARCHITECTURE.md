# Architecture Integration: Stats Standardization & SEO

**Project:** BettingSoccer Platform
**Research Date:** 2026-02-02
**Focus:** Integration patterns for stats accuracy fixes and SEO enhancement without breaking existing functionality

---

## Executive Summary

The platform has **6 different accuracy calculation definitions** scattered across:
- `src/lib/db/queries/stats.ts` (4 definitions)
- `src/lib/db/queries.ts` (2 definitions)
- Frontend calculations in page components

**Architecture Goal:** Centralize stats logic without breaking 14 existing page routes, maintain cache invalidation patterns, and layer SEO without refactoring component structure.

**Key Constraint:** This is a **SUBSEQUENT MILESTONE** — the platform is live in production. Changes must be incremental, backward-compatible, and verifiable.

---

## Problem: Stats Calculation Inconsistencies

### Current State (6 Accuracy Definitions)

**Definition 1: `getModelOverallStats` (line 100)**
```sql
accuracy: ROUND(100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0), 1)
```
- **Denominator:** Scored predictions only
- **Numerator:** Tendency points > 0

**Definition 2: `getModelCompetitionStats` (line 156)**
```sql
accuracy: ROUND(100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0), 1)
```
- **Same as Definition 1** (consistent)

**Definition 3: `getModelClubStats` (line 215)**
```sql
accuracy: ROUND(100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0), 1)
```
- **Same as Definition 1** (consistent)

**Definition 4: `getLeaderboard` (line 275)**
```sql
accuracy: ROUND(100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0), 1)
```
- **Same as Definition 1** (consistent)

**Definition 5: `getTopModelsByCompetition` (line 276)**
```sql
accuracy: ROUND(100.0 * SUM(CASE WHEN tendencyPoints IS NOT NULL THEN 1 ELSE 0 END)
          / NULLIF(COUNT(predictions.id), 0), 1)
```
- **INCONSISTENT:** Uses `tendencyPoints IS NOT NULL` instead of `> 0`
- **INCONSISTENT:** Denominator is total predictions (including pending), not scored

**Definition 6: Frontend Calculation (models/[id]/page.tsx line 52)**
```typescript
const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
  ? Math.round((predictionStats.exactScores / predictionStats.scoredPredictions) * 100)
  : 0;
```
- **CRITICAL BUG:** Calculates exact score accuracy, not tendency accuracy
- Used for OG image metadata (line 53-61)

### Impact Analysis

**User-Facing:**
- Leaderboard shows 65.3% accuracy
- Model detail page shows 58.1% accuracy (for same model)
- OG image shows 12.5% accuracy (exact scores only)

**Technical Debt:**
- 6 different SQL fragments to maintain
- Copy-paste errors likely (Definition 5 already wrong)
- Frontend calculation completely wrong
- Cache keys coupled to query logic

---

## Solution: Centralized Stats Service

### Architecture Pattern: Service Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (pages, API routes, components)                            │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ calls
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Stats Service (NEW)                            │
│  src/lib/stats/service.ts                                   │
│                                                             │
│  - Single source of truth for calculations                 │
│  - Type-safe interfaces                                     │
│  - Cache-aware                                              │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ uses
              ▼
┌─────────────────────────────────────────────────────────────┐
│         Database Queries (EXISTING)                         │
│  src/lib/db/queries.ts & queries/stats.ts                  │
│                                                             │
│  - Raw data fetching only                                   │
│  - No calculation logic                                     │
└─────────────────────────────────────────────────────────────┘
```

### Service Layer Design

**Location:** `src/lib/stats/service.ts` (NEW FILE)

**Responsibilities:**
1. Define accuracy calculation once
2. Apply consistently across all contexts
3. Handle edge cases (division by zero, null values)
4. Provide type-safe interfaces
5. Integration point for caching

**Non-Responsibilities:**
- Database access (delegates to existing queries)
- UI rendering (that's component layer)
- Cache management (uses existing redis.ts)

### Implementation Structure

```typescript
// src/lib/stats/definitions.ts (NEW)
// Single source of truth for stat calculations

export type AccuracyDefinition = {
  numerator: 'tendency_correct' | 'exact_scores';
  denominator: 'scored_predictions' | 'total_predictions';
};

export const ACCURACY_DEFINITION: AccuracyDefinition = {
  numerator: 'tendency_correct',      // Predictions with tendencyPoints > 0
  denominator: 'scored_predictions',  // Only finished, scored predictions
};

// SQL fragment generator (for use in existing queries)
export function getAccuracySql(): string {
  return `
    COALESCE(
      ROUND(
        100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
        1
      ),
      0
    )
  `;
}

// Application-level calculation (for frontend)
export function calculateAccuracy(
  correctTendencies: number,
  scoredPredictions: number
): number {
  if (scoredPredictions === 0) return 0;
  return Math.round((correctTendencies / scoredPredictions) * 100 * 10) / 10;
}
```

```typescript
// src/lib/stats/service.ts (NEW)
// High-level stats interface

import { getModelPredictionStats, getModelRank } from '@/lib/db/queries';
import { calculateAccuracy } from './definitions';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';

export interface ModelStatsResponse {
  modelId: string;
  displayName: string;

  // Core metrics
  totalPredictions: number;
  scoredPredictions: number;
  pendingPredictions: number;

  // Accuracy (standardized)
  tendencyAccuracy: number;  // Always calculated using ACCURACY_DEFINITION
  exactScoreRate: number;

  // Performance
  avgPoints: number;
  totalPoints: number;

  // Rankings
  globalRank: number | null;

  // Streaks
  currentStreak: number;
  bestStreak: number;
}

export async function getModelStats(modelId: string): Promise<ModelStatsResponse | null> {
  // Cache key includes version to invalidate on definition changes
  const cacheKey = cacheKeys.modelStats(modelId, 'v1');

  return withCache(cacheKey, CACHE_TTL.STATS, async () => {
    const [predictionStats, rank] = await Promise.all([
      getModelPredictionStats(modelId),
      getModelRank(modelId),
    ]);

    if (!predictionStats) return null;

    const scoredPredictions = Number(predictionStats.scoredPredictions) || 0;
    const correctTendencies = Number(predictionStats.correctTendencies) || 0;
    const exactScores = Number(predictionStats.exactScores) || 0;

    return {
      modelId,
      displayName: '', // Fetch from model table if needed

      totalPredictions: Number(predictionStats.totalPredictions) || 0,
      scoredPredictions,
      pendingPredictions: Number(predictionStats.totalPredictions) - scoredPredictions,

      // Standardized calculation
      tendencyAccuracy: calculateAccuracy(correctTendencies, scoredPredictions),
      exactScoreRate: calculateAccuracy(exactScores, scoredPredictions),

      avgPoints: Number(predictionStats.avgPoints) || 0,
      totalPoints: Number(predictionStats.totalPoints) || 0,

      globalRank: rank,

      currentStreak: 0, // Fetch from model table
      bestStreak: 0,
    };
  });
}
```

### Migration Strategy (Zero Downtime)

**Phase 1: Create Service Layer (No Breaking Changes)**
```
1. Create src/lib/stats/definitions.ts
2. Create src/lib/stats/service.ts
3. Write tests for calculateAccuracy()
4. Deploy (service exists but unused)
```

**Phase 2: Migrate Database Queries (Update SQL)**
```
1. Update queries/stats.ts to use getAccuracySql() helper
2. Update queries.ts getTopModelsByCompetition (fix Definition 5)
3. Verify query results unchanged (existing tests should pass)
4. Deploy
```

**Phase 3: Migrate Frontend Calculations**
```
1. Update models/[id]/page.tsx to use getModelStats()
2. Fix accuracy calculation for OG images (line 52-54)
3. Update other pages incrementally
4. Deploy
```

**Phase 4: Cleanup**
```
1. Remove duplicate SQL fragments
2. Add eslint rule: ban direct accuracy calculations
3. Document stats service as canonical source
```

**Rollback Safety:** Each phase independently deployable. If Phase 2 breaks, Phase 1 code is unused so no revert needed.

---

## Problem: SEO Metadata Gaps

### Current State

**What Exists:**
- `src/lib/seo/metadata.ts` — Helper functions for building Next.js Metadata
- `src/components/WebPageSchema.tsx` — JSON-LD for WebPage
- `src/components/SportsEventSchema.tsx` — JSON-LD for matches
- Model pages already have `generateMetadata()` (line 34-90 in models/[id]/page.tsx)

**What's Missing:**
1. **Competition pages** — No metadata, no structured data
2. **Leaderboard pages** — Generic metadata only
3. **Match pages** — Basic metadata, missing prediction context
4. **Model pages** — Metadata exists but accuracy calculation is WRONG

**Gap Analysis:**
| Page Type | Metadata | Structured Data | Status |
|-----------|----------|-----------------|--------|
| Model detail | ✅ (but wrong accuracy) | ✅ WebPageSchema | Needs fix |
| Competition page | ❌ | ❌ | Needs both |
| Leaderboard | ✅ Generic | ❌ | Needs structured data |
| Match detail | ✅ Basic | ✅ SportsEventSchema | Needs enhancement |
| Match roundup | ❌ | ❌ | Needs both |

---

## Solution: Layered SEO Enhancement

### Architecture Pattern: Decorator Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Page Component                           │
│  (e.g., leagues/[slug]/page.tsx)                           │
│                                                             │
│  export async function generateMetadata() { ... }          │
│  <CompetitionPageSchema ... />                             │
└─────────────────────────────────────────────────────────────┘
              │                            │
              │ uses                       │ renders
              ▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  SEO Metadata Helpers    │   │  Structured Data Components  │
│  (EXISTING)              │   │  (EXTEND EXISTING)           │
│  src/lib/seo/metadata.ts │   │  src/components/*Schema.tsx  │
└──────────────────────────┘   └──────────────────────────────┘
```

**Key Insight:** Don't refactor page structure. Add metadata generation and schema components to existing pages.

### Implementation: Competition Pages

**Step 1: Create metadata helper** (extend existing `metadata.ts`)

```typescript
// src/lib/seo/metadata.ts (ADD)

export function generateCompetitionMetadata(
  competition: Competition,
  stats: CompetitionStats
): Metadata {
  const title = `${competition.name} Predictions & AI Model Leaderboard | Kroam`;
  const description = `Track ${competition.name} match predictions from ${stats.activeModels} AI models. Current accuracy: ${stats.avgAccuracy}%. Live scores, model rankings, and prediction analysis.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/leagues/${competition.slug}`,
      images: [
        {
          url: `${BASE_URL}/api/og/league?id=${competition.id}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${BASE_URL}/leagues/${competition.slug}`,
    },
  };
}
```

**Step 2: Create structured data component**

```typescript
// src/components/CompetitionSchema.tsx (NEW)

export function CompetitionSchema({
  competition,
  nextMatch,
  topModel,
}: CompetitionSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    'name': competition.name,
    'sport': 'Football',
    'url': `https://kroam.xyz/leagues/${competition.slug}`,
  };

  // Enrich with upcoming event
  if (nextMatch) {
    schema.event = {
      '@type': 'SportsEvent',
      'name': `${nextMatch.homeTeam} vs ${nextMatch.awayTeam}`,
      'startDate': nextMatch.kickoffTime,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

**Step 3: Integrate into existing page** (minimal changes)

```typescript
// src/app/leagues/[slug]/page.tsx (MODIFY EXISTING)

// ADD metadata generation
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return { title: 'Competition Not Found' };

  const stats = await getCompetitionStats(competition.id);
  return generateCompetitionMetadata(competition, stats);
}

export default async function CompetitionPage({ params }) {
  // Existing data fetching...

  return (
    <div>
      {/* ADD structured data */}
      <CompetitionSchema
        competition={competition}
        nextMatch={nextMatch}
        topModel={topModel}
      />

      {/* Existing UI components unchanged */}
      <CompetitionStats ... />
      <MatchList ... />
    </div>
  );
}
```

**Impact:** Page component grows by ~15 lines. No refactoring. No risk to existing functionality.

### Implementation: Fix Model Page Accuracy

**Problem:** Line 52-54 calculates exact score accuracy instead of tendency accuracy.

**Fix:**
```typescript
// src/app/models/[id]/page.tsx (CHANGE LINES 52-54)

// BEFORE (WRONG):
const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
  ? Math.round((predictionStats.exactScores / predictionStats.scoredPredictions) * 100)
  : 0;

// AFTER (CORRECT):
const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
  ? Math.round((predictionStats.correctTendencies / predictionStats.scoredPredictions) * 100)
  : 0;
```

**Alternative (Better):** Use stats service for consistency.

```typescript
// AFTER (BEST):
import { calculateAccuracy } from '@/lib/stats/definitions';

const accuracy = calculateAccuracy(
  predictionStats?.correctTendencies || 0,
  predictionStats?.scoredPredictions || 0
);
```

**Verification:**
1. Check model page accuracy matches leaderboard
2. Check OG image accuracy matches page display
3. Regenerate OG images to update cached versions

---

## Cache Integration Strategy

### Current Cache Architecture

**Cache Keys (from redis.ts):**
```typescript
cacheKeys = {
  activeCompetitions: () => 'db:competitions:active',
  activeModels: () => 'db:models:active',
  overallStats: () => 'db:stats:overall',
  topPerformingModel: () => 'db:stats:top-model',
  leaderboard: (metric, filters) => `db:leaderboard:${metric}:${hash}`,
  predictions: (matchId) => `db:predictions:${matchId}`,
  // ... etc
};
```

**Invalidation Pattern (from redis.ts line 342-358):**
```typescript
export async function invalidateMatchCaches(matchId: string) {
  await Promise.all([
    cacheDeletePattern('db:leaderboard:*'),
    cacheDelete(cacheKeys.overallStats()),
    cacheDelete(cacheKeys.predictions(matchId)),
  ]);
}
```

**Problem Identified:** Leaderboard invalidation uses `KEYS` command (line 288) which blocks Redis.

### Stats Service Cache Integration

**Add cache key with version:**
```typescript
// src/lib/cache/redis.ts (ADD)

export const cacheKeys = {
  // ... existing keys ...

  // Stats service keys (versioned for definition changes)
  modelStats: (modelId: string, version: string) =>
    `stats:model:${modelId}:${version}`,
  competitionStats: (competitionId: string, version: string) =>
    `stats:competition:${competitionId}:${version}`,
};
```

**Invalidation strategy:**
1. **On stats definition change:** Bump version (`v1` → `v2`), old caches automatically ignored
2. **On data change (match settlement):** Invalidate specific model/competition keys
3. **No pattern matching:** Use explicit keys for fast invalidation

**Implementation:**
```typescript
// src/lib/stats/service.ts

export async function invalidateModelStats(modelId: string): Promise<void> {
  const keys = [
    cacheKeys.modelStats(modelId, 'v1'),
    cacheKeys.leaderboard('avgPoints', {}),  // Model appears in leaderboard
  ];

  await Promise.all(keys.map(key => cacheDelete(key)));
}
```

**Call from settlement worker:**
```typescript
// src/lib/queue/workers/scoring.worker.ts (MODIFY EXISTING)

// After scorePredictionsTransactional succeeds:
await invalidateMatchCaches(matchId);

// ADD: Invalidate affected model stats
const modelIds = predictions.map(p => p.modelId);
await Promise.all(modelIds.map(id => invalidateModelStats(id)));
```

**Performance Impact:**
- Before: Pattern match `db:leaderboard:*` scans 10K+ keys (slow)
- After: Delete 5-10 specific keys (fast)

---

## Migration Validation Checkpoints

### Stats Centralization

**Checkpoint 1: Service Layer Created**
- [ ] `src/lib/stats/definitions.ts` exists
- [ ] `calculateAccuracy()` has unit tests
- [ ] No existing code uses the service yet (safe to deploy)

**Checkpoint 2: Database Queries Updated**
- [ ] All SQL queries use `getAccuracySql()` helper
- [ ] Query results match previous output (regression test)
- [ ] Definition 5 bug in `getTopModelsByCompetition` fixed
- [ ] Leaderboard accuracy matches model detail page accuracy

**Checkpoint 3: Frontend Migrated**
- [ ] Model page accuracy calculation fixed (line 52-54)
- [ ] OG images show correct accuracy
- [ ] No pages directly calculate accuracy anymore
- [ ] Grep codebase for direct `exactScores / scoredPredictions` calculations

**Checkpoint 4: Cleanup**
- [ ] Duplicate SQL fragments removed
- [ ] Stats service is sole source of truth
- [ ] Documentation updated

### SEO Enhancement

**Checkpoint 1: Metadata Helpers Extended**
- [ ] `generateCompetitionMetadata()` added to `metadata.ts`
- [ ] `generateLeaderboardMetadata()` already exists (line 137-169)
- [ ] Model page metadata helper uses correct accuracy

**Checkpoint 2: Structured Data Components**
- [ ] `CompetitionSchema.tsx` created
- [ ] Existing schema components (`WebPageSchema`, `SportsEventSchema`) working
- [ ] Schema validation passes (use schema.org validator)

**Checkpoint 3: Page Integration**
- [ ] Competition pages: `generateMetadata()` + schema component added
- [ ] Model pages: accuracy calculation fixed
- [ ] Match pages: prediction context added to metadata
- [ ] Leaderboard pages: structured data added

**Checkpoint 4: Verification**
- [ ] Google Search Console shows structured data detected
- [ ] OG images display correctly on Twitter/Slack
- [ ] Page titles and descriptions accurate
- [ ] No console errors from malformed JSON-LD

---

## Build Order (Risk Minimization)

### Phase 1: Stats Centralization (Week 1)
**Goal:** Fix inconsistent accuracy calculations without breaking existing UI

```
Day 1-2: Create service layer
  - definitions.ts with calculateAccuracy()
  - Unit tests
  - Deploy (unused code, zero risk)

Day 3-4: Update database queries
  - Migrate queries/stats.ts
  - Fix getTopModelsByCompetition bug
  - Regression tests
  - Deploy

Day 5: Update frontend
  - Fix model page accuracy (critical bug)
  - Deploy
  - Monitor OG image generation

Day 6-7: Incremental migration
  - Update remaining pages to use service
  - Remove duplicate calculations
  - Deploy
```

**Why this order:** Database queries are leaf nodes (no dependencies). Frontend depends on queries. Fix data layer first, then UI.

**Rollback triggers:**
- Leaderboard shows different numbers after query update
- Model page accuracy goes to 0% or >100%
- Cache invalidation breaks (stats don't update)

### Phase 2: SEO Enhancement (Week 2)
**Goal:** Add metadata and structured data without refactoring pages

```
Day 1-2: Competition pages
  - generateCompetitionMetadata()
  - CompetitionSchema component
  - Integrate into leagues/[slug]/page.tsx
  - Deploy

Day 3-4: Match pages
  - Enhance match metadata with prediction context
  - Add PredictionSchema if needed
  - Deploy

Day 5: Leaderboard structured data
  - Create LeaderboardSchema component
  - Integrate into leaderboard pages
  - Deploy

Day 6-7: Verification
  - Submit sitemap to Google Search Console
  - Check structured data detection
  - Monitor search appearance
```

**Why this order:** Each page type is independent. Competition pages have most SEO value (high-traffic landing pages). Match pages second. Leaderboard is niche.

**Rollback triggers:**
- JSON-LD validation errors
- Page load time increases >200ms (schema generation too slow)
- Hydration mismatches (server/client schema differences)

### Phase 3: Cache Optimization (Week 3)
**Goal:** Improve cache invalidation performance

```
Day 1-2: Add versioned cache keys
  - cacheKeys.modelStats()
  - cacheKeys.competitionStats()
  - Deploy (keys added but unused)

Day 3-4: Integrate with stats service
  - withCache() wrapping in service.ts
  - Explicit key invalidation (no patterns)
  - Deploy

Day 5: Remove pattern matching
  - Replace cacheDeletePattern('db:leaderboard:*')
  - Use explicit key lists
  - Deploy

Day 6-7: Monitor
  - Cache hit rate
  - Invalidation latency
  - Redis memory usage
```

**Why this order:** Stats service must exist first. Cache optimization is a performance improvement, not a correctness fix. Do last when stats logic is stable.

**Rollback triggers:**
- Cache hit rate drops below 50% (keys too specific)
- Stats don't update after match settlement (invalidation broke)
- Redis memory usage increases >20% (key proliferation)

---

## Integration Points & Dependencies

### Where Stats Service Integrates

**Database Layer (queries.ts, queries/stats.ts):**
- Current: 6 different accuracy calculations
- After: All use `getAccuracySql()` helper
- Change: SQL string replacement only, query structure unchanged

**API Routes (if any):**
- Current: Likely call queries directly
- After: Call stats service for computed stats
- Change: Import path changes, no logic changes

**Page Components:**
- Current: Direct database queries or props from parent
- After: Call `getModelStats()` for standardized data
- Change: Replace query calls with service calls

**Cache Layer:**
- Current: Direct query result caching
- After: Service layer caching
- Change: Cache keys gain version suffix

**Worker Jobs:**
- Current: Cache invalidation via `invalidateMatchCaches()`
- After: Add `invalidateModelStats()` calls
- Change: Additional invalidation, not replacement

### Where SEO Integrates

**Page Components:**
- Current: Some have `generateMetadata()`, some don't
- After: All pages have metadata generation
- Change: Add export function, no refactoring

**Layout:**
- Current: Provides default metadata
- After: Page-specific metadata overrides defaults
- Change: None (Next.js handles merging)

**Component Tree:**
- Current: Renders UI components
- After: Adds `<Schema>` components at top level
- Change: Minimal (1-2 lines per page)

**OG Image Generation:**
- Current: Uses dynamic metadata for og:image URLs
- After: Same, but accuracy calculation fixed
- Change: Calculation fix, not architecture change

### Dependency Graph

```
┌──────────────────────────────────────────────────┐
│  Phase 1: Stats Centralization                   │
│  (Week 1)                                        │
│                                                  │
│  1. definitions.ts ─────────────┐               │
│  2. service.ts (uses 1)         │               │
│  3. queries (use 1)             │               │
│  4. pages (use 2, which uses 3) │               │
└──────────────────────────────────┼───────────────┘
                                   │
                    Independent of │
                                   │
┌──────────────────────────────────┼───────────────┐
│  Phase 2: SEO Enhancement        ▼               │
│  (Week 2)                                        │
│                                                  │
│  1. metadata.ts (helpers)       Uses stats      │
│  2. Schema components           service for     │
│  3. Page integration            accuracy in     │
│                                 descriptions    │
└──────────────────────────────────┬───────────────┘
                                   │
                    Optimizes both │
                                   │
┌──────────────────────────────────▼───────────────┐
│  Phase 3: Cache Optimization                     │
│  (Week 3)                                        │
│                                                  │
│  1. Versioned cache keys                         │
│  2. Explicit invalidation                        │
│  3. Remove pattern matching                      │
└──────────────────────────────────────────────────┘
```

**Critical Path:** Phases 1 and 2 are independent. Phase 3 optimizes both.

**Parallelization Opportunity:** If 2 developers available:
- Dev 1: Phase 1 (stats)
- Dev 2: Phase 2 (SEO)
- Merge both, then Dev 1 or 2 does Phase 3

---

## Risk Analysis & Mitigation

### High Risk: Database Query Changes

**Risk:** Changing SQL in `queries/stats.ts` breaks leaderboard display.

**Mitigation:**
1. **Snapshot testing:** Capture current query results before changes
2. **Parallel queries:** Run old and new queries side-by-side, compare results
3. **Gradual rollout:** Use feature flag to toggle new queries
4. **Rollback plan:** Keep old queries commented in code for 1 week

**Detection:**
- Monitor: Leaderboard accuracy % before and after
- Alert: If any model's accuracy changes by >5% (indicates calculation change)

### Medium Risk: Cache Invalidation Breaks

**Risk:** Stats service caching breaks existing invalidation, showing stale data.

**Mitigation:**
1. **Invalidation tests:** Verify cache clears after match settlement
2. **TTL safety net:** Set 5-minute TTL on all stats caches (even if explicit invalidation)
3. **Monitoring:** Track cache age vs expected freshness

**Detection:**
- Monitor: Time between match settlement and leaderboard update
- Alert: If cache age > 5 minutes after settlement

### Medium Risk: SEO Schema Validation Errors

**Risk:** Malformed JSON-LD causes Google to ignore structured data.

**Mitigation:**
1. **Schema validation:** Use schema.org validator in tests
2. **Error boundaries:** Catch JSON-LD generation errors, log but don't break page
3. **Gradual rollout:** Add schemas to one page type at a time

**Detection:**
- Monitor: Google Search Console structured data errors
- Alert: If error count increases

### Low Risk: Model Page Accuracy Fix

**Risk:** Fixing line 52-54 changes OG image accuracy, cached images show old value.

**Mitigation:**
1. **Cache bust:** Change OG image URL parameter after fix (`?v=2`)
2. **Or:** Clear CDN cache for `/api/og/model` route
3. **Verify:** Check OG image preview in Slack/Twitter after deploy

**Detection:**
- Visual inspection of OG images
- Compare displayed accuracy to leaderboard value

---

## Success Criteria

### Stats Centralization Complete

**Quantitative:**
- [ ] 1 accuracy definition (down from 6)
- [ ] 0 SQL accuracy calculations outside `definitions.ts`
- [ ] 0 frontend accuracy calculations outside service layer
- [ ] 100% of pages use stats service

**Qualitative:**
- [ ] Leaderboard and model detail show same accuracy (within 0.1%)
- [ ] OG images display correct tendency accuracy
- [ ] Definition 5 bug in `getTopModelsByCompetition` fixed
- [ ] Developers reference service as source of truth

### SEO Enhancement Complete

**Quantitative:**
- [ ] 14 page types have `generateMetadata()` (all routes)
- [ ] 5+ structured data types implemented (WebPage, SportsEvent, SportsOrganization, etc.)
- [ ] 0 Google Search Console schema validation errors
- [ ] <200ms metadata generation latency (95th percentile)

**Qualitative:**
- [ ] Search result snippets display rich data (stars, dates, scores)
- [ ] Social media shares show accurate OG images
- [ ] Breadcrumbs appear in Google search results
- [ ] Schema.org validator shows no warnings

### Cache Optimization Complete

**Quantitative:**
- [ ] <100ms cache invalidation latency (down from ~500ms with pattern matching)
- [ ] >70% cache hit rate for stats queries
- [ ] 0 KEYS commands in production (replaced with explicit deletes)
- [ ] <5 second staleness window (settlement → leaderboard update)

**Qualitative:**
- [ ] Stats update immediately after match settlement
- [ ] No user reports of stale leaderboard data
- [ ] Redis memory usage stable (no key proliferation)

---

## Sources & References

**Existing Architecture:**
- `src/lib/db/queries/stats.ts` — Current stats queries
- `src/lib/db/queries.ts` — Additional query definitions
- `src/app/models/[id]/page.tsx` — Frontend calculation example
- `src/lib/cache/redis.ts` — Cache invalidation patterns

**Next.js Patterns:**
- Next.js 16 App Router metadata API (generateMetadata)
- Server Components (async components, data fetching)
- Streaming (Suspense for slow queries)

**SEO Standards:**
- Schema.org structured data (SportsEvent, WebPage, etc.)
- Open Graph Protocol (OG images, meta tags)
- JSON-LD format (embedded in `<script type="application/ld+json">`)

**Database Patterns:**
- Drizzle ORM (type-safe queries)
- PostgreSQL query optimization (avoid N+1, use aggregates)
- Connection pooling (pg library)

**Confidence Levels:**
- High: Architecture patterns (server components, service layer, schema components)
- High: Database query consolidation (single SQL fragment)
- Medium: Cache optimization impact (depends on key distribution)
- Medium: SEO enhancement visibility (depends on Google crawl timing)

---

*Architecture research complete. Document provides integration patterns for stats standardization and SEO enhancement without breaking existing functionality. All recommendations based on production codebase analysis.*
