# Phase 42: Dynamic Model Counts - Research

**Researched:** 2026-02-05
**Domain:** Dynamic content generation, cache invalidation, single source of truth pattern
**Confidence:** HIGH

## Summary

This phase replaces hardcoded "35 models" references scattered across 15+ locations with dynamic counts from a single source of truth. The codebase already has the foundational infrastructure: `getProviderStats()` returns total/together/synthetic counts, `getActiveProviders()` filters disabled models, and Redis caching with pattern-based invalidation exists. The primary work is creating a new `getActiveModelCount()` function that queries the database (not the static provider arrays) and integrating it into all hardcoded locations.

The key distinction is between **configured models** (42 in provider arrays) and **active models** (those with `models.active = true` in database). The homepage and SEO should display active model count from the database, which reflects operational reality. The leaderboard already queries models with `active = true` filter - it just needs the count displayed dynamically.

Cache invalidation is the main risk. Currently, model enable/disable operations invalidate `activeModels` cache but not all downstream consumers (leaderboard FAQs, match metadata, content prompts). The solution is atomic invalidation when model status changes.

**Primary recommendation:** Create `getActiveModelCount()` that uses Redis cache with 60s TTL querying `models.active = true` count from database, invalidate on model status change, replace all 15+ hardcoded references with this function.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | existing | Redis caching | Already configured with `withCache()`, `cacheDelete()`, `cacheDeletePattern()` |
| drizzle-orm | existing | Database queries | Already used for `models` table queries |
| Next.js | existing | Server components | SSR data fetching already working |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Schema validation | Not needed - simple integer return |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Database query | Static provider array length | Provider array shows configured models, DB shows operationally active |
| Redis cache | In-memory cache | Cross-process consistency required for workers |
| 60s TTL | Real-time invalidation only | 60s provides fallback if invalidation fails |

**Installation:**
No new packages required. All dependencies exist.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/llm/
├── index.ts              # Add getActiveModelCount() alongside existing getProviderStats()
├── providers/
│   ├── together.ts       # TOGETHER_PROVIDERS array (29 models)
│   └── synthetic.ts      # SYNTHETIC_PROVIDERS array (13 models)
src/lib/cache/
└── redis.ts              # Add invalidateModelCountCache() export
src/lib/db/
└── queries.ts            # Model enable/disable functions call invalidation
```

### Pattern 1: Single Source of Truth Function
**What:** One async function returns active model count, all consumers use it
**When to use:** Any UI/content that displays model count
**Example:**
```typescript
// src/lib/llm/index.ts (add to existing file)
import { withCache, cacheKeys, CACHE_TTL, cacheDelete } from '@/lib/cache/redis';
import { getDb, models } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

/**
 * Get active model count from database (cached)
 * This is the ONLY function that should return model count for UI/content
 * Queries database models.active = true, not provider arrays
 */
export async function getActiveModelCount(): Promise<number> {
  return withCache(
    cacheKeys.activeModelCount(),  // Add to cacheKeys
    CACHE_TTL.STATS,               // 60s TTL (same as overall stats)
    async () => {
      const db = getDb();
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(models)
        .where(eq(models.active, true));
      return Number(result[0]?.count) || 0;
    }
  );
}
```

### Pattern 2: Atomic Cache Invalidation
**What:** When model status changes, invalidate all count-dependent caches atomically
**When to use:** Model enable/disable operations
**Example:**
```typescript
// src/lib/cache/redis.ts (add to existing file)
export async function invalidateModelCountCaches(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await Promise.all([
      cacheDelete(cacheKeys.activeModelCount()),
      cacheDelete(cacheKeys.overallStats()),
      // Leaderboard caches include model count in FAQs
      cacheDeletePattern('db:leaderboard:*'),
    ]);
    loggers.cache.info('Invalidated model count caches');
  } catch (error) {
    loggers.cache.error({ error }, 'Failed to invalidate model count caches');
  }
}

// In cacheKeys object, add:
activeModelCount: () => 'db:models:count:active',
```

### Pattern 3: Server Component Data Fetching
**What:** Fetch count at render time in Server Components
**When to use:** Pages displaying model count (homepage, leaderboard, match pages)
**Example:**
```typescript
// src/app/page.tsx (homepage)
import { getActiveModelCount } from '@/lib/llm';

async function StatsBar() {
  const stats = await getOverallStats();
  const modelCount = await getActiveModelCount();  // Or use stats.activeModels

  return (
    <div>
      <p className="text-2xl font-bold">{modelCount}</p>
      <p className="text-xs text-muted-foreground">AI Models</p>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Using provider array length for active count:** `ALL_PROVIDERS.length` returns configured models (42), not operationally active ones. The database `models` table reflects actual active status.
- **Hardcoding numbers anywhere:** Even "42" will become stale when models are added/removed.
- **Calling database directly without cache:** 15+ pages all hitting DB for same count wastes resources.
- **Forgetting to invalidate on model status change:** Creates count inconsistency between pages.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caching with TTL | Custom Map with setTimeout | `withCache()` from redis.ts | Handles Redis unavailability, consistent TTLs |
| Cache invalidation | Manual key tracking | `invalidateModelCountCaches()` | Atomic invalidation of related caches |
| Database count query | Raw SQL string | Drizzle ORM `sql` function | Type safety, injection protection |
| Pattern deletion | Manual key iteration | `cacheDeletePattern()` | Uses SCAN (non-blocking), handles batches |

**Key insight:** The caching infrastructure is already sophisticated. Use `withCache()` for get-or-set, `cacheDelete()` for single keys, `cacheDeletePattern()` for wildcards.

## Common Pitfalls

### Pitfall 1: Count Inconsistency Across Pages
**What goes wrong:** Homepage shows "42 models", leaderboard shows "40 models", match page says "35 models" because different pages use different sources or have different cache states.
**Why it happens:** Partial migration - some pages use new dynamic count, others still hardcoded.
**How to avoid:**
1. Replace ALL 15+ hardcoded references in single PR
2. Add CI check: `rg '\b(35|36|42)\s+(AI\s+)?models?' --type ts --type tsx` should return zero
3. Use global search-replace with verification
**Warning signs:** Different numbers on different pages visible during testing.

### Pitfall 2: Cache Not Invalidated on Model Status Change
**What goes wrong:** Admin enables a disabled model, but count still shows old value until cache expires (60s).
**Why it happens:** Model enable/disable code path doesn't call `invalidateModelCountCaches()`.
**How to avoid:**
1. Find ALL places that change `models.active` or `models.autoDisabled`
2. Add invalidation call after each update
3. Grep for `models.active`, `models.autoDisabled`, `deactivateOldModels` to find all mutation points
**Warning signs:** Count updates only after 60s delay after model status change.

### Pitfall 3: Leaderboard Already Filters by Active
**What goes wrong:** Developer assumes leaderboard needs changes for auto-include, but it already filters by `models.active = true`.
**Why it happens:** Not reading existing `getLeaderboard()` code carefully.
**How to avoid:** The leaderboard query at line 285 in `src/lib/db/queries/stats.ts` already has `eq(models.active, true)` in whereConditions.
**Warning signs:** LEAD-01, LEAD-02, LEAD-03 requirements may already be satisfied.

### Pitfall 4: SEO Metadata in Static Exports
**What goes wrong:** `generateMetadata()` functions in page.tsx run at build time for static pages, not request time.
**Why it happens:** Next.js static optimization caches metadata.
**How to avoid:**
1. For ISR pages (match pages), metadata regenerates on revalidation - this is acceptable
2. For static pages (about), either accept 24h staleness or switch to dynamic rendering
3. Match page SEO already uses ISR with `revalidate` - count will update on next revalidation
**Warning signs:** Deployed metadata shows stale count after model changes.

### Pitfall 5: Content Generation Prompts Import at Module Load
**What goes wrong:** System prompts that use model count are evaluated at module import time, not request time.
**Why it happens:** `const SYSTEM_PROMPT = \`${getProviderStats().total} models...\`` runs once at import.
**How to avoid:**
1. Make prompt generation functions that accept count as parameter
2. Call `getActiveModelCount()` at request time, pass to prompt builder
3. Don't use template literals with function calls at module scope
**Warning signs:** Content prompts always show same count even after model changes.

## Code Examples

Verified patterns from existing codebase:

### Cache Key Pattern (from redis.ts)
```typescript
// Source: src/lib/cache/redis.ts line 368-397
export const cacheKeys = {
  // ... existing keys
  activeModelCount: () => 'db:models:count:active',  // Add this
} as const;
```

### withCache Pattern (from redis.ts)
```typescript
// Source: src/lib/cache/redis.ts line 270-299
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Checks Redis availability, handles null sentinel, falls back to fetcher
}
```

### Invalidation Pattern (from redis.ts)
```typescript
// Source: src/lib/cache/redis.ts line 399-430
export async function invalidateMatchCaches(matchId: string): Promise<void> {
  await Promise.all([
    cacheDeletePattern('db:leaderboard:*'),
    cacheDelete(cacheKeys.overallStats()),
    cacheDelete(cacheKeys.topPerformingModel()),
    cacheDelete(cacheKeys.matchPredictions(matchId)),
  ]);
}
```

### Existing Model Count Query (from queries.ts)
```typescript
// Source: src/lib/db/queries.ts line 1416-1445
export async function getOverallStats() {
  return withCache(
    cacheKeys.overallStats(),
    CACHE_TTL.STATS,
    async () => {
      const db = getDb();
      const result = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM models WHERE active = true)::int as active_models
      `);
      return { activeModels: row?.active_models || 0 };
    }
  );
}
```

### Leaderboard Active Filter (from stats.ts)
```typescript
// Source: src/lib/db/queries/stats.ts line 285
const whereConditions: any[] = [eq(models.active, true)];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded "35 models" | Dynamic count from DB | This phase | Eliminates stale counts |
| Provider array length | Database active count | This phase | Reflects operational reality |
| Manual cache invalidation | Atomic invalidation function | This phase | Consistent counts across pages |

**Deprecated/outdated:**
- `getProviderStats().total` for UI display - use `getActiveModelCount()` instead
- Hardcoded model numbers anywhere in codebase
- Assuming provider array length matches active models

## Open Questions

Things that couldn't be fully resolved:

1. **Static page metadata staleness**
   - What we know: Static pages like `/about` have metadata generated at build time
   - What's unclear: Is 24h staleness acceptable, or should these become dynamic?
   - Recommendation: Accept ISR-based staleness for now. Model count changes are rare events.

2. **Content generation prompt timing**
   - What we know: System prompts may be evaluated at module load
   - What's unclear: Which specific prompts need refactoring vs which already accept dynamic values
   - Recommendation: Audit `src/lib/content/prompts.ts` and similar files during planning

## Sources

### Primary (HIGH confidence)
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/index.ts` - Existing `getProviderStats()`, `getActiveProviders()`, provider arrays
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/cache/redis.ts` - Cache infrastructure, `withCache()`, invalidation patterns
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/db/queries.ts` - `getOverallStats()` already queries active_models
- `/Users/pieterbos/Documents/bettingsoccer/src/lib/db/queries/stats.ts` - `getLeaderboard()` already filters by `models.active`

### Secondary (MEDIUM confidence)
- Grep search for "35 models" found 15+ hardcoded locations (verified in codebase)
- `.planning/research/PITFALLS.md` - Pitfall 5 documents count inconsistency risk
- `.planning/research/ARCHITECTURE.md` - Integration Point 3 outlines dynamic count approach

### Tertiary (LOW confidence)
- None - all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns copied from existing cache infrastructure
- Pitfalls: HIGH - verified against actual code and prior research

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable infrastructure)

---

## Appendix: Hardcoded Locations Found

Complete list from grep search (to be replaced):

**SEO/Metadata files:**
1. `src/lib/seo/metadata.ts:45` - "35 models compete"
2. `src/lib/seo/metadata.ts:62` - "AI predictions from 35 models"
3. `src/lib/seo/metadata.ts:276` - generateCompetitionMetadata "from 35 models"
4. `src/lib/seo/schema/competition.ts:67-68` - "AI predictions from 35 models"

**Page files:**
5. `src/app/matches/page.tsx:15,21,29` - Multiple metadata references
6. `src/app/leagues/[slug]/page.tsx:42-43` - Competition metadata
7. `src/app/blog/[slug]/page.tsx:78` - Blog OG description
8. `src/app/blog/page.tsx:21` - Blog list metadata
9. `src/app/about/page.tsx:9,15` - About page metadata
10. `src/app/leaderboard/page.tsx:20,26,34` - Leaderboard metadata

**Content generation:**
11. `src/lib/league/generate-league-faqs.ts:79,88` - FAQ answers with "35 AI models"

**Note:** The leaderboard dynamically calculates `totalModels` from query results (line 68) - this is correct. But the static metadata on line 20 is hardcoded and should be dynamic.
