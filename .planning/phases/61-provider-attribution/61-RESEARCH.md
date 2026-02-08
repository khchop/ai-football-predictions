# Phase 61: Provider Attribution - Research

**Researched:** 2026-02-08
**Domain:** Provider attribution tracking, multi-provider observability, database schema extension
**Confidence:** HIGH

## Summary

Provider attribution enables observability into which provider (Together AI, Synthetic.new, OpenRouter) actually served each prediction request in a multi-provider routing system. This phase extends the predictions table with a `provider_used` field to capture the actual provider at request time, updates admin dashboards to visualize provider distribution, and enhances fallback logging to track routing chains.

The platform already has Phase 60's `callAPIWithFallback` returning `FallbackAPIResult` with `providerUsed` and `attemptedProviders` fields. Phase 61 persists this attribution data to PostgreSQL and surfaces it in the admin dashboard alongside existing fallback metrics.

**Architecture approach:** Add a single `provider_used` TEXT column to the predictions table (nullable for backward compatibility with existing predictions), update predictions.worker.ts to persist `apiResult.providerUsed` when creating predictions, extend the admin fallback-stats API to include provider distribution aggregates, and add a new admin dashboard widget showing provider usage breakdown.

**Primary recommendation:** Use Drizzle ORM's additive DDL pattern (ALTER TABLE ADD COLUMN IF NOT EXISTS) for zero-downtime migration. Store provider ID strings directly (not foreign keys) since provider list is static configuration. Extend existing FallbackMetrics component rather than creating a new dashboard page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current | Schema extension and queries | Already used for all database operations, supports IF NOT EXISTS for safe migrations |
| PostgreSQL | Current | Provider attribution storage | Existing database, TEXT columns efficient for provider IDs |
| Next.js API Routes | 16.1.4 | Admin dashboard endpoints | Existing admin API pattern in `/api/admin/*` |
| React/Next.js | 16.1.4 | Admin UI components | Existing FallbackMetrics component pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pino logger | Current | Fallback chain logging | Already logs fallback events with provider context |
| TypeScript | Current | Type safety for provider IDs | Existing FallbackAPIResult interface |
| Drizzle-kit | Current | Migration generation | Used for all schema changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| provider_used TEXT | provider_used_id INTEGER with foreign key | TEXT is simpler since provider list is static config; no referential integrity needed |
| New dashboard page | Extend existing FallbackMetrics | Reuse existing component pattern; attribution is related to fallback metrics |
| Separate attribution table | Add column to predictions | Single table query more efficient; no 1:1 relationship benefit |
| JSON attempted_providers array | Separate fallback_attempts table | JSON sufficient for debugging; no query-by-attempted-provider requirement |

**Installation:**
No new dependencies required. Schema change via Drizzle migration.

## Architecture Patterns

### Current Architecture (Phase 60)
```
Predictions Flow:
├── predictions.worker.ts
│   ├── Loop: For each active provider
│   ├── Call: provider.callAPIWithFallback(system, user)
│   ├── Return: FallbackAPIResult {
│   │     response: string,
│   │     usedFallback: boolean,
│   │     providerUsed?: string,        // NEW in Phase 60
│   │     attemptedProviders?: string[] // NEW in Phase 60
│   │   }
│   └── Insert: predictions table {
│         matchId, modelId, predictedHome, predictedAway,
│         predictedResult, status, usedFallback
│       }
├── Logging: fallback events with provider context
└── Database: predictions.usedFallback = boolean only

Admin Dashboard:
├── FallbackMetrics component
│   ├── Queries: /api/admin/fallback-stats
│   ├── Shows: fallback rate, cost multiplier per model
│   └── Missing: which providers are actually serving requests
```

### Recommended Architecture (Phase 61)
```
Extended Predictions Flow:
├── predictions.worker.ts
│   ├── Call: apiResult = provider.callAPIWithFallback(system, user)
│   ├── Extract: providerUsed = apiResult.providerUsed || provider.id
│   └── Insert: predictions table {
│         ...existing fields,
│         usedFallback,
│         providerUsed,              // NEW: captures actual provider
│         attemptedProviders: JSON   // NEW: fallback chain for debugging
│       }

Database Schema:
predictions table:
├── ... existing columns ...
├── usedFallback: BOOLEAN           // Existing (Phase 41)
├── provider_used: TEXT              // NEW: Provider ID that served request
└── attempted_providers: TEXT        // NEW (optional): JSON array of attempted providers

Admin Dashboard:
├── FallbackMetrics component (extended)
│   ├── Provider Distribution Card:
│   │   ├── Together AI: 2,450 predictions (58%)
│   │   ├── Synthetic.new: 1,890 predictions (45%)
│   │   └── OpenRouter: 120 predictions (3%, fallback-only)
│   ├── Fallback Chain Breakdown:
│   │   ├── No fallback: 3,890 (92%)
│   │   ├── 1 fallback: 320 (7.5%)
│   │   └── 2+ fallbacks: 20 (0.5%)
│   └── Per-Model Provider Usage:
│       └── deepseek-r1: Synthetic (80%), Together (18%), OpenRouter (2%)

Enhanced Logging:
└── Fallback events include:
    ├── originalProvider: 'deepseek-r1-0528-syn'
    ├── providerUsed: 'deepseek-r1'
    ├── attemptedProviders: ['deepseek-r1-0528-syn', 'deepseek-r1']
    └── fallbackReason: 'timeout'
```

### Pattern 1: Additive Schema Migration (Zero-Downtime)
**What:** Use ALTER TABLE ADD COLUMN IF NOT EXISTS to add provider attribution fields without downtime
**When to use:** All schema extensions in production database
**Example:**
```sql
-- Source: Drizzle ORM migration pattern + existing drizzle/0006_add_model_health_tracking.sql
-- File: drizzle/0015_add_provider_attribution.sql

-- Add provider attribution to predictions table
-- IF NOT EXISTS ensures idempotent migrations (safe to re-run)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS provider_used TEXT;

-- Optional: Track full fallback chain for debugging
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS attempted_providers TEXT;

-- Add index for provider distribution queries (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_predictions_provider_used
  ON predictions(provider_used);

-- Add composite index for time-based provider queries
CREATE INDEX IF NOT EXISTS idx_predictions_created_provider
  ON predictions(created_at, provider_used);
```

### Pattern 2: Schema Definition in Drizzle ORM
**What:** Extend predictions table schema with new attribution fields
**When to use:** Update src/lib/db/schema.ts after migration applied
**Example:**
```typescript
// Source: Existing predictions table schema (lines 364-399 in schema.ts)
export const predictions = pgTable('predictions', {
  id: text('id').primaryKey(),
  matchId: text('match_id')
    .notNull()
    .references(() => matches.id),
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),

  // Prediction
  predictedHome: integer('predicted_home').notNull(),
  predictedAway: integer('predicted_away').notNull(),
  predictedResult: text('predicted_result').notNull(),

  // Scoring
  tendencyPoints: integer('tendency_points'),
  goalDiffBonus: integer('goal_diff_bonus'),
  exactScoreBonus: integer('exact_score_bonus'),
  totalPoints: integer('total_points'),

  // Status
  status: text('status').default('pending'),
  usedFallback: boolean('used_fallback').default(false), // Existing

  // NEW: Provider Attribution (Phase 61)
  providerUsed: text('provider_used'),        // Provider ID that served request
  attemptedProviders: text('attempted_providers'), // JSON array (optional)

  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`),
  scoredAt: timestamp('scored_at'),
}, (table) => [
  // Existing indexes...
  index('idx_predictions_provider_used').on(table.providerUsed), // NEW
  index('idx_predictions_created_provider').on(table.createdAt, table.providerUsed), // NEW
]);
```

### Pattern 3: Worker Attribution Capture
**What:** Extract providerUsed from FallbackAPIResult and persist to predictions table
**When to use:** Update predictions.worker.ts prediction insertion logic
**Example:**
```typescript
// Source: Existing predictions.worker.ts (lines 201-272)
// Use fallback-aware API call
const apiResult = await (provider as unknown as {
  callAPIWithFallback: (system: string, user: string) => Promise<FallbackAPIResult>
}).callAPIWithFallback(BATCH_SYSTEM_PROMPT, prompt);

const rawResponse = apiResult.response;
const usedFallback = apiResult.usedFallback;

// NEW: Extract provider attribution (Phase 61)
const providerUsed = apiResult.providerUsed || provider.id; // Fallback to original if not returned
const attemptedProviders = apiResult.attemptedProviders
  ? JSON.stringify(apiResult.attemptedProviders)
  : null;

// Parse and validate...
const prediction = parsed.predictions[0];

// Collect prediction for batch insert
predictionsToInsert.push({
  id: uuidv4(),
  matchId,
  modelId: provider.id,
  predictedHome: prediction.homeScore,
  predictedAway: prediction.awayScore,
  predictedResult: result,
  status: 'pending',
  usedFallback,           // Existing
  providerUsed,           // NEW: Phase 61
  attemptedProviders,     // NEW: Phase 61 (optional)
});
```

### Pattern 4: Admin Dashboard Provider Distribution
**What:** Aggregate provider usage and show distribution breakdown
**When to use:** Extend /api/admin/fallback-stats or create new /api/admin/provider-stats
**Example:**
```typescript
// Source: Existing /api/admin/fallback-stats/route.ts pattern
export async function GET(request: NextRequest) {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // NEW: Provider distribution query
  const providerDistribution = await db.execute<{
    providerUsed: string;
    count: string;
  }>(sql`
    SELECT
      "providerUsed",
      COUNT(*)::text as "count"
    FROM predictions
    WHERE "createdAt" >= ${todayStart.toISOString()}
      AND "providerUsed" IS NOT NULL
    GROUP BY "providerUsed"
    ORDER BY COUNT(*) DESC
  `);

  // NEW: Fallback chain depth analysis
  const fallbackDepth = await db.execute<{
    depth: number;
    count: string;
  }>(sql`
    SELECT
      CASE
        WHEN "usedFallback" = false THEN 0
        WHEN "attemptedProviders" IS NULL THEN 1
        ELSE jsonb_array_length("attemptedProviders"::jsonb) - 1
      END as depth,
      COUNT(*)::text as "count"
    FROM predictions
    WHERE "createdAt" >= ${todayStart.toISOString()}
    GROUP BY depth
    ORDER BY depth
  `);

  return NextResponse.json({
    providerDistribution: providerDistribution.rows.map(row => ({
      provider: row.providerUsed,
      count: parseInt(row.count, 10),
      percentage: (parseInt(row.count, 10) / totalPredictions) * 100,
    })),
    fallbackDepth: fallbackDepth.rows.map(row => ({
      depth: row.depth,
      count: parseInt(row.count, 10),
    })),
  });
}
```

### Pattern 5: React Component for Provider Distribution
**What:** Extend FallbackMetrics component or create ProviderDistribution widget
**When to use:** Add to existing admin dashboard (src/components/admin/)
**Example:**
```tsx
// Source: Existing FallbackMetrics component pattern (fallback-metrics.tsx)
export function ProviderDistribution() {
  const [data, setData] = useState<ProviderStats | null>(null);

  const fetchData = async () => {
    const response = await fetch('/api/admin/provider-stats', {
      headers: { 'X-Admin-Password': storedPassword },
    });
    const result = await response.json();
    setData(result);
  };

  return (
    <div className="card-gradient rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Provider Distribution (Today)</h2>

      {/* Provider breakdown */}
      <div className="space-y-3 mb-6">
        {data?.providerDistribution.map(item => (
          <div key={item.provider} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{item.provider}</span>
                <span className="text-sm text-muted-foreground">
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fallback depth breakdown */}
      <div className="border-t border-border/50 pt-4">
        <h3 className="text-sm font-medium mb-3">Fallback Chain Depth</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {data?.fallbackDepth.map(item => (
            <div key={item.depth} className="p-2 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">
                {item.depth === 0 ? 'No fallback' : `${item.depth} fallback${item.depth > 1 ? 's' : ''}`}
              </div>
              <div className="text-lg font-bold">{item.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Foreign key to providers table:** Provider list is static configuration (ALL_PROVIDERS), not dynamic entities. TEXT column avoids referential integrity overhead.
- **Separate attribution table:** 1:1 relationship with predictions adds JOIN overhead with no benefit. Single table queries are faster.
- **Backfilling provider_used for old predictions:** Historical predictions don't have attribution data. Leave NULL for old rows; only new predictions populate the field.
- **Storing full route configuration:** Don't duplicate MODEL_PROVIDER_ROUTES in database. Store only the actual provider used; route config lives in code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migrations | Raw SQL ALTER TABLE scripts | Drizzle-kit generate + migrate | Type-safe migrations, automatic rollback support, migration history tracking |
| Provider ID validation | Runtime checks in worker | TypeScript type narrowing from FallbackAPIResult | Compiler-enforced correctness, no runtime overhead |
| Attribution aggregation | Manual SQL string building | Drizzle ORM query builder with GROUP BY | Type-safe queries, prevents SQL injection |
| Admin dashboard charts | Custom D3.js visualizations | Tailwind progress bars + grid layout | Matches existing admin dashboard style, zero dependencies |

**Key insight:** Phase 60 already returns provider attribution in FallbackAPIResult. Phase 61 is primarily a persistence and visualization problem, not a routing/fallback logic problem. The hard work (multi-provider routing) is done; this phase just captures and displays the results.

## Common Pitfalls

### Pitfall 1: Forgetting to Handle NULL provider_used in Queries
**What goes wrong:** Queries filtering by provider_used fail or return incomplete results for old predictions
**Why it happens:** Schema migration adds column with NULL for existing rows; new predictions populate it
**How to avoid:** Always include `WHERE provider_used IS NOT NULL` in attribution queries or treat NULL as "unknown provider"
**Warning signs:** Admin dashboard shows 0% provider distribution despite predictions existing

### Pitfall 2: Persisting Provider Route Instead of Actual Provider
**What goes wrong:** Storing MODEL_PROVIDER_ROUTES['deepseek-r1'] array instead of the actual provider ID that succeeded
**Why it happens:** Confusion between routing configuration (static) and attribution data (dynamic)
**How to avoid:** Store `apiResult.providerUsed` (string) not the full provider route array
**Warning signs:** Database contains JSON arrays in provider_used field; can't GROUP BY provider

### Pitfall 3: Not Indexing provider_used Column
**What goes wrong:** Admin dashboard queries (GROUP BY provider_used) become slow as predictions table grows
**Why it happens:** Missing index on provider_used column
**How to avoid:** Add `CREATE INDEX idx_predictions_provider_used ON predictions(provider_used)` in migration
**Warning signs:** /api/admin/provider-stats endpoint takes >1s to respond with 10k+ predictions

### Pitfall 4: Inconsistent Provider ID Format
**What goes wrong:** Provider IDs don't match between FallbackAPIResult and ALL_PROVIDERS
**Why it happens:** Phase 60 returns provider.id, but worker uses different identifier
**How to avoid:** Verify `apiResult.providerUsed` matches provider IDs in ALL_PROVIDERS (e.g., 'deepseek-r1', 'deepseek-r1-0528-syn', 'deepseek-r1-or')
**Warning signs:** Admin dashboard shows unknown providers like 'DeepSeek R1' (displayName) instead of 'deepseek-r1' (id)

### Pitfall 5: Attempting to Backfill Historical Predictions
**What goes wrong:** Migration script tries to populate provider_used for old predictions, but attribution data doesn't exist
**Why it happens:** Desire for "complete" data drives unnecessary backfill attempt
**How to avoid:** Accept that provider_used is NULL for historical predictions; only new predictions (post-Phase 61) have attribution
**Warning signs:** Migration takes hours trying to infer providers from modelId patterns; backfilled data is unreliable

## Code Examples

Verified patterns from existing codebase:

### FallbackAPIResult Interface (Existing Phase 60)
```typescript
// Source: src/lib/llm/providers/base.ts (lines 24-29)
export interface FallbackAPIResult {
  response: string;
  usedFallback: boolean;
  providerUsed?: string;       // Provider ID that succeeded
  attemptedProviders?: string[]; // All providers attempted in order
}
```

### Extracting Provider Attribution in Worker
```typescript
// Source: src/lib/queue/workers/predictions.worker.ts (lines 201-207)
const apiResult = await (provider as unknown as {
  callAPIWithFallback: (system: string, user: string) => Promise<FallbackAPIResult>
}).callAPIWithFallback(BATCH_SYSTEM_PROMPT, prompt);

const rawResponse = apiResult.response;
const usedFallback = apiResult.usedFallback;
// NEW: Extract provider attribution
const providerUsed = apiResult.providerUsed || provider.id;
```

### Safe Migration Pattern (Additive DDL)
```sql
-- Source: drizzle/0006_add_model_health_tracking.sql (existing pattern)
-- IF NOT EXISTS ensures idempotent migrations
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS provider_used TEXT;

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_predictions_provider_used
  ON predictions(provider_used);
```

### Admin API Provider Distribution Query
```typescript
// Source: Pattern from src/app/api/admin/fallback-stats/route.ts
const result = await db.execute<{
  providerUsed: string;
  count: string;
}>(sql`
  SELECT
    "providerUsed",
    COUNT(*)::text as "count"
  FROM predictions
  WHERE "createdAt" >= ${todayStart.toISOString()}
    AND "providerUsed" IS NOT NULL
  GROUP BY "providerUsed"
  ORDER BY COUNT(*) DESC
`);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| usedFallback boolean only | provider_used + attemptedProviders | Phase 61 (Feb 2026) | Enables provider-level observability, cost attribution per provider |
| Infer provider from modelId | Capture actual provider at request time | Phase 61 (Feb 2026) | Accurate attribution in multi-provider routing (Phase 60+) |
| Manual fallback logging | Structured FallbackAPIResult | Phase 41/60 | Type-safe provider tracking, enables database persistence |
| No provider distribution metrics | Admin dashboard provider breakdown | Phase 61 (Feb 2026) | Identifies over-reliance on fallback providers (cost optimization) |

**Deprecated/outdated:**
- Inferring provider from modelId suffix (-syn, -or): Unreliable after Phase 62 consolidation (base model IDs)
- Boolean fallback tracking only: Insufficient for multi-provider routing (can't distinguish which provider served request)
- Log-only fallback tracking: No queryable historical data, can't analyze provider reliability trends

## Open Questions

1. **Should attempted_providers be stored as JSON TEXT or separate fallback_attempts table?**
   - What we know: Most predictions succeed on first provider (92% based on Phase 41 fallback metrics)
   - What's unclear: Is fallback chain debugging worth the storage overhead?
   - Recommendation: Start with optional JSON TEXT field (NULL for successful first attempts); consider separate table if deep debugging becomes frequent requirement

2. **How to handle provider attribution for retroactive predictions (backfill jobs)?**
   - What we know: Retroactive predictions use allowRetroactive flag but still use current provider routing
   - What's unclear: Should retroactive predictions populate provider_used or leave NULL?
   - Recommendation: Populate provider_used even for retroactive predictions — useful for measuring current provider reliability on historical matches

3. **Should admin dashboard show provider distribution per competition or globally?**
   - What we know: Different competitions may have different provider reliability (varying match data quality)
   - What's unclear: Is per-competition breakdown actionable or just noise?
   - Recommendation: Start with global provider distribution; add per-competition filter in Phase 66 if needed

4. **How far back should provider distribution queries look (24h, 7d, 30d)?**
   - What we know: Admin dashboard currently shows "today" for fallback metrics
   - What's unclear: Provider reliability may vary week-to-week; daily view may be too volatile
   - Recommendation: Match existing FallbackMetrics timeframe (today) for consistency; add date range filter if trend analysis becomes important

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/llm/providers/base.ts` (FallbackAPIResult interface, lines 24-29)
- Existing codebase: `src/lib/queue/workers/predictions.worker.ts` (worker attribution extraction, lines 201-207)
- Existing codebase: `src/app/api/admin/fallback-stats/route.ts` (admin API query pattern)
- Existing codebase: `src/components/admin/fallback-metrics.tsx` (dashboard component pattern)
- Existing codebase: `drizzle/0006_add_model_health_tracking.sql` (additive DDL migration pattern)
- Existing codebase: `src/lib/db/schema.ts` (predictions table schema, lines 364-399)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) - Official docs on migration workflow
- [Drizzle ORM - PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new) - Schema definition patterns

### Secondary (MEDIUM confidence)
- [Multi-provider LLM orchestration in production: A 2026 Guide](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10) - Provider attribution and observability patterns
- [The complete guide to LLM observability for 2026](https://portkey.ai/blog/the-complete-guide-to-llm-observability/) - Model name, provider, version tracking for consistency measurement
- [8 Drizzle ORM Patterns for Clean, Fast Migrations](https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8) - Additive DDL best practices
- [Schema migration with Neon Postgres and Drizzle ORM](https://neon.com/docs/guides/drizzle-migrations) - Push vs generate+migrate workflows

### Tertiary (LOW confidence - flagged for validation)
- None - Phase 61 is primarily implementation of existing Phase 60 infrastructure, not new architectural patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Extends existing Drizzle ORM, PostgreSQL, Next.js patterns
- Architecture: HIGH - Builds directly on Phase 60 FallbackAPIResult interface
- Pitfalls: HIGH - Based on existing schema migration experience and Phase 60 implementation

**Research date:** 2026-02-08
**Valid until:** 30 days (stable domain - database schema extension and observability patterns are well-established)
