# Phase 5: Stats Foundation - Research

**Researched:** 2026-02-02
**Domain:** Database query consistency, TypeScript service layer patterns, SQL division by zero protection
**Confidence:** HIGH

## Summary

Stats Foundation addresses a critical data consistency problem: the same model displays different accuracy numbers across pages (94% vs 87%) because queries use different formulas. The codebase has two competing patterns: `tendencyPoints IS NOT NULL` (includes 0-point predictions) vs `tendencyPoints > 0` (correct predictions only), and an unrelated bug where the model detail page shows exact score accuracy in metadata instead of tendency accuracy.

The standard solution is a Stats Service Layer that acts as single source of truth for all accuracy calculations. Modern TypeScript/Next.js 15 applications use Data Access Layers (DAL) to centralize database operations and enforce consistency. Drizzle ORM's lightweight, modular design makes it ideal for service layer patterns without requiring code generation.

**Primary recommendation:** Create `src/lib/services/stats.ts` that exports typed functions for all accuracy calculations. All pages and components import from this service instead of writing raw SQL queries. Standardize on `tendencyPoints > 0` denominator with `NULLIF()` protection.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.36+ | Type-safe SQL query builder | Already in project, TypeScript-first, no code generation, perfect for service layers |
| TypeScript | 5.0+ | Type system | Enforces contract between service layer and consumers |
| Next.js 15 | 15.x | App framework | Server Components enable efficient data fetching in service layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Runtime validation | If service layer needs input validation (optional for this phase) |
| PostgreSQL | 14+ | Database | Already using Neon, provides NULLIF() for division protection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Service layer | Query helpers | Helpers don't enforce single entry point, easier to bypass |
| Drizzle | Prisma | Prisma requires code generation, heavier runtime, less SQL control |
| Centralized calcs | Inline SQL | Inline SQL works but duplicates logic, harder to maintain |

**Installation:**
No new packages needed. Drizzle ORM, TypeScript, and PostgreSQL already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── services/
│   ├── stats.ts              # Stats calculation service (NEW)
│   └── index.ts              # Re-export all services
├── db/
│   ├── queries/
│   │   └── stats.ts          # Raw DB queries (REFACTOR to use service)
│   └── queries.ts            # Legacy queries (REFACTOR to use service)
└── types/
    └── stats.ts              # Shared stats types (NEW)
```

### Pattern 1: Service Layer as Single Source of Truth
**What:** Centralize all accuracy calculations in a service that abstracts database complexity
**When to use:** Any time multiple pages need the same calculation
**Example:**
```typescript
// src/lib/services/stats.ts
// Source: Architecture patterns from Next.js DAL best practices

import { getDb, predictions, models, matches, competitions } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Standard accuracy formula used everywhere:
 * accuracy = (predictions with tendencyPoints > 0) / (scored predictions) * 100
 *
 * Uses NULLIF() to prevent division by zero.
 * Denominator is ALWAYS scored predictions (status = 'scored'),
 * never total predictions (which includes pending).
 */
const ACCURACY_SQL = sql<number>`
  COALESCE(
    ROUND(
      100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
      1
    ),
    0
  )
`;

export interface ModelAccuracyStats {
  modelId: string;
  accuracy: number;           // Tendency accuracy (correct tendency / scored)
  exactAccuracy: number;      // Exact score accuracy (exact scores / scored)
  scoredPredictions: number;  // Denominator for accuracy
  totalPredictions: number;   // Includes pending
  correctTendencies: number;  // Numerator for accuracy
  exactScores: number;        // Numerator for exact accuracy
}

/**
 * Get accuracy stats for a model - CANONICAL VERSION
 * All pages must use this function, not raw queries
 */
export async function getModelAccuracy(modelId: string): Promise<ModelAccuracyStats | null> {
  const db = getDb();

  const result = await db
    .select({
      modelId: models.id,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      scoredPredictions: sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      accuracy: ACCURACY_SQL,
      exactAccuracy: sql<number>`
        COALESCE(
          ROUND(
            100.0 * SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
            1
          ),
          0
        )
      `,
    })
    .from(models)
    .leftJoin(predictions, eq(predictions.modelId, models.id))
    .where(eq(models.id, modelId))
    .groupBy(models.id);

  if (!result[0]) return null;

  return {
    modelId: result[0].modelId,
    accuracy: Number(result[0].accuracy),
    exactAccuracy: Number(result[0].exactAccuracy),
    scoredPredictions: Number(result[0].scoredPredictions),
    totalPredictions: Number(result[0].totalPredictions),
    correctTendencies: Number(result[0].correctTendencies),
    exactScores: Number(result[0].exactScores),
  };
}
```

### Pattern 2: SQL Fragments for Consistency
**What:** Define SQL calculations once as constants, reuse in all queries
**When to use:** When multiple functions need the same calculation but different groupings/filters
**Example:**
```typescript
// Reusable SQL fragments
const SCORED_PREDICTIONS = sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END)`;
const CORRECT_TENDENCIES = sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`;

// Use in different contexts
const leaderboardQuery = db.select({
  accuracy: sql<number>`COALESCE(ROUND(100.0 * ${CORRECT_TENDENCIES} / NULLIF(${SCORED_PREDICTIONS}, 0)::numeric, 1), 0)`
}).from(models);
```

### Pattern 3: Next.js Data Access Layer (DAL)
**What:** Service layer functions called from Server Components, never from client
**When to use:** Always - this is the Next.js 15 recommended pattern
**Example:**
```typescript
// app/models/[id]/page.tsx (Server Component)
import { getModelAccuracy } from '@/lib/services/stats';

export default async function ModelPage({ params }) {
  const stats = await getModelAccuracy(params.id);
  return <div>Accuracy: {stats.accuracy}%</div>;
}
```

### Anti-Patterns to Avoid
- **Inline SQL in pages:** Raw queries bypass the service layer, create inconsistency
- **Multiple calculation versions:** Having both `IS NOT NULL` and `> 0` versions is the root cause
- **Missing NULLIF():** Division without NULLIF() throws errors on models with zero scored predictions
- **Total predictions as denominator:** Accuracy should only count scored predictions, not pending ones

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Division by zero in SQL | `IF scored > 0 THEN ... ELSE 0` | `NULLIF(denominator, 0)` | PostgreSQL standard, cleaner, database-level protection |
| Accuracy consistency | Comment saying "use this formula" | Service layer function | Comments get ignored, service layer enforces consistency |
| SQL query deduplication | Copy-paste queries | Drizzle sql\`\` fragments | Fragments are composable, type-safe, single definition |
| Stats type definitions | Inline types in queries | Shared interface in types/ | Types document the contract, prevent drift |

**Key insight:** Stats consistency is a Single Source of Truth problem, not a SQL problem. The fix isn't better queries, it's centralizing where queries happen.

## Common Pitfalls

### Pitfall 1: IS NOT NULL vs > 0 Mismatch
**What goes wrong:** `tendencyPoints IS NOT NULL` includes predictions with 0 points (wrong tendency), inflating accuracy
**Why it happens:** tendencyPoints is nullable (NULL before scoring), 0 after scoring wrong tendency, 2-6 for correct tendency
**How to avoid:** Always use `tendencyPoints > 0` to count only correct predictions
**Warning signs:** Model shows 94% accuracy on one page, 87% on another (7% = the wrong tendencies)

### Pitfall 2: Division by Zero Without NULLIF()
**What goes wrong:** Query crashes with "division by zero" error when model has no scored predictions yet
**Why it happens:** New models or models with only pending predictions have denominator = 0
**How to avoid:** Wrap denominator in `NULLIF(denominator, 0)`, then `COALESCE(result, 0)` for NULL handling
**Warning signs:** 500 errors on model detail pages for newly added models

### Pitfall 3: Total vs Scored Predictions
**What goes wrong:** Accuracy uses total predictions (including pending) as denominator, showing artificially low accuracy
**Why it happens:** `COUNT(predictions.id)` includes all predictions, but only scored ones have points
**How to avoid:** Denominator must be `SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END)`
**Warning signs:** Accuracy drops suddenly when new matches are added (pending predictions increase denominator)

### Pitfall 4: Bypassing the Service Layer
**What goes wrong:** Developer adds new page, writes inline SQL, uses different formula, consistency breaks again
**Why it happens:** Service layer isn't enforced, raw database queries are too easy to access
**How to avoid:** Make service layer the easy path: good TypeScript types, good documentation, export from central index
**Warning signs:** New component uses `db.select()` directly instead of importing stats service

### Pitfall 5: Wrong Accuracy in Metadata
**What goes wrong:** Model detail page shows exact score accuracy (exactScores/scored) in hero section instead of tendency accuracy
**Why it happens:** Copy-paste error in metadata generation, calculation is `exactScores / scoredPredictions * 100`
**How to avoid:** Service layer returns both `accuracy` (tendency) and `exactAccuracy`, use the right one
**Warning signs:** SEO metadata shows different percentage than hero section displays

## Code Examples

Verified patterns from current codebase:

### Current Correct Pattern (stats.ts)
```typescript
// Source: src/lib/db/queries/stats.ts lines 100, 156, 215, 275, 331
// This is the CORRECT formula - should be used everywhere

accuracy: sql<number>`COALESCE(
  ROUND(
    100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
    1
  ),
  0
)`
```

### Current Wrong Pattern (queries.ts)
```typescript
// Source: src/lib/db/queries.ts line 275
// This is WRONG - uses IS NOT NULL (includes 0-point predictions)

accuracy: sql<number>`COALESCE(
  ROUND(
    100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)
    / NULLIF(COUNT(${predictions.id}), 0)::numeric,
    1
  ),
  0
)`
```

### Metadata Bug (page.tsx)
```typescript
// Source: src/app/models/[id]/page.tsx lines 51-53
// BUG: Using exact score accuracy in metadata, should use tendency accuracy

const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
  ? Math.round((predictionStats.exactScores / predictionStats.scoredPredictions) * 100)  // WRONG
  : 0;

// Should be:
const accuracy = predictionStats?.scoredPredictions && predictionStats.scoredPredictions > 0
  ? Math.round((predictionStats.correctTendencies / predictionStats.scoredPredictions) * 100)
  : 0;
```

### Hero Section (Correct)
```typescript
// Source: src/app/models/[id]/page.tsx lines 137-139
// This is CORRECT - uses tendency accuracy

const tendencyAccuracy = scoredPredictions
  ? Math.round((predictionStats.correctTendencies / scoredPredictions) * 100)
  : 0;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline queries in pages | Data Access Layer (DAL) service | Next.js 13+ (2023) | Single source of truth for calculations |
| Prisma-heavy ORMs | Drizzle lightweight ORM | 2024-2025 | Better TypeScript integration, no codegen |
| Manual NULL checks | NULLIF() + COALESCE() | PostgreSQL standard | Database-level protection, cleaner SQL |
| Copy-paste SQL | sql\`\` fragments | Drizzle pattern | Reusable, composable, type-safe |

**Deprecated/outdated:**
- **Raw queries in pages:** Next.js 15 recommends DAL pattern for data fetching in Server Components
- **Inconsistent formulas:** Modern apps centralize calculations in service layer, not scattered across files

## Open Questions

Things that couldn't be fully resolved:

1. **Should stats service be cached?**
   - What we know: Current queries don't use Redis cache, but leaderboard does
   - What's unclear: Whether stats service should handle caching internally or let callers cache
   - Recommendation: Start without caching in service layer, add if performance issues arise (measure first)

2. **How to handle migration of existing queries?**
   - What we know: `queries.ts` has `getTopModelsByCompetition()` and `getModelPredictionStats()` with wrong formulas
   - What's unclear: Should we refactor these to use the service, or deprecate and replace?
   - Recommendation: Refactor existing functions to call service layer internally, maintain API compatibility

3. **Should service layer return raw numbers or formatted strings?**
   - What we know: Some places need `87.5`, others need `87.5%`, others need `88%` (rounded)
   - What's unclear: Where formatting should happen (service vs component)
   - Recommendation: Service returns numbers, components format. Keeps service reusable.

## Sources

### Primary (HIGH confidence)
- Current codebase analysis - src/lib/db/queries/stats.ts (correct formula with `> 0`)
- Current codebase analysis - src/lib/db/queries.ts (wrong formula with `IS NOT NULL`)
- Current codebase analysis - src/app/models/[id]/page.tsx (metadata bug using exact accuracy)
- Current codebase analysis - src/lib/db/schema.ts (predictions table with tendencyPoints 2-6 check)
- Current codebase analysis - src/lib/utils/scoring.ts (Kicktipp quota system documentation)

### Secondary (MEDIUM confidence)
- [Modern Full Stack Application Architecture Using Next.js 15+](https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/)
- [Next.js Data Access Layer](https://aysh.me/blogs/data-access-layer-nextjs)
- [Data Access Layer in Next.js](https://medium.com/@javadmohammadi.career/in-a-next-js-cb8e180bf10a)
- [Using NULLIF() To Prevent Divide-By-Zero Errors In SQL](https://www.bennadel.com/blog/984-using-nullif-to-prevent-divide-by-zero-errors-in-sql.htm)
- [How to Handle Divide by Zero In SQL](https://learnsql.com/cookbook/how-to-handle-divide-by-zero-in-sql/)
- [Drizzle vs Prisma 2026](https://medium.com/@codabu/drizzle-vs-prisma-choosing-the-right-typescript-orm-in-2026-deep-dive-63abb6aa882b)
- [TypeScript Best Practices for Large-Scale Web Applications in 2026](https://johal.in/typescript-best-practices-for-large-scale-web-applications-in-2026/)
- [What Is a Single Source of Truth](https://strapi.io/blog/what-is-single-source-of-truth)
- [Building a Layered Architecture in NestJS & TypeScript](https://medium.com/@patrick.cunha336/building-a-layered-architecture-in-nestjs-typescript-repository-pattern-dtos-and-validators-08907a8ac4cb)

### Tertiary (LOW confidence)
- General machine learning accuracy calculation articles (not SQL-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Drizzle, TypeScript, PostgreSQL already in use, no new dependencies
- Architecture: HIGH - Next.js DAL pattern is official recommendation, current codebase follows similar patterns
- Pitfalls: HIGH - All identified from actual bugs in codebase (IS NOT NULL vs > 0, metadata calculation)
- SQL patterns: HIGH - NULLIF() is PostgreSQL standard, verified in official documentation

**Research date:** 2026-02-02
**Valid until:** ~30 days (Next.js/Drizzle stable, PostgreSQL SQL standard unlikely to change)
