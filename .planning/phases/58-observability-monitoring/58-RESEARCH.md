# Phase 58: Observability & Monitoring - Research

**Researched:** 2026-02-08
**Domain:** Per-model health metrics, regression detection, time-series tracking
**Confidence:** HIGH

## Summary

Phase 58 builds long-term per-model observability on top of Phase 52's pipeline-level monitoring and Phase 57's diagnostic validation. While Phase 52 tracks whether matches have predictions (coverage), Phase 58 tracks whether individual models consistently produce successful predictions (reliability). The platform already has strong foundations: Drizzle ORM with PostgreSQL, existing admin dashboard with Recharts visualizations, per-model health tracking in the `models` table (consecutiveFailures, lastFailureAt), and proven admin API patterns with auth and rate limiting.

**Gap analysis:**
- Phase 52 monitors pipeline coverage (matches without predictions), but not per-model success rates over time
- `models` table tracks current health (consecutiveFailures), but no historical time-series for trend analysis
- Admin dashboard shows current model health, but no regression detection or before/after comparison
- No alert mechanism when previously-working models start degrading

**Architecture approach:** Create `llm_model_stats` table for daily per-model metrics (success count, failure count, error categories), extend admin API with `/api/admin/model-health` endpoint returning 7/30/90-day trends, add Recharts visualization to admin dashboard showing per-model success rate trends, implement regression detection checking for >10% drop in success rate over 7 days, generate before/after report comparing pre-Phase 57 baseline to post-fix metrics.

**Primary recommendation:** Use time-series table pattern (date + modelId composite key) for daily aggregates, leverage existing Recharts components for trend visualization, implement multi-level alerts (warning at 80%, critical at 90% threshold), track failure categories to identify systematic issues vs transient errors.

## Standard Stack

All required infrastructure already exists — no new dependencies:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Drizzle ORM** | Current | Database schema and queries | Already used for all tables, type-safe queries with `drizzle-orm/pg-core` |
| **Recharts** | ^3.6.0 (installed) | Time-series trend visualization | Already used in model-performance-chart.tsx, LineChart for success rate trends |
| **Admin API pattern** | Current | Auth, rate limiting, error handling | Proven pattern in /api/admin/data/route.ts with requireAdminAuth + checkRateLimit |
| **BullMQ workers** | Current | Background job processing | Already used for predictions/settlement, can add stats aggregation worker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **date-fns** | Installed | Date range calculations for 7/30/90-day windows | Already used in model-performance-chart.tsx for date formatting |
| **Pino logger** | Installed | Structured logging for alerts | Use metricsLogger for regression alerts (Phase 52 pattern) |
| **pLimit** | 6.2.0 | Concurrency control for bulk stats | If backfilling historical stats from predictions table |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Daily aggregates | Real-time metrics | Daily aggregates reduce query cost, sufficient for trend analysis (not live monitoring) |
| Database table | Redis time-series | PostgreSQL better for historical queries, easier backfill, already have Drizzle patterns |
| New dashboard | Extend Phase 52 | New dashboard allows focused per-model view, Phase 52 is pipeline-level |
| Manual report | Automated comparison | Manual report generation for one-time before/after milestone analysis |

**Installation:** No new packages required — all infrastructure exists.

## Architecture Patterns

### Recommended Database Structure

```
Extend existing schema (src/lib/db/schema.ts):

llm_model_stats (new table):
├── id: text (UUID primary key)
├── date: text (YYYY-MM-DD, indexed)
├── modelId: text (FK to models.id, indexed)
├── successCount: integer (predictions that succeeded)
├── failureCount: integer (predictions that failed)
├── totalAttempts: integer (successCount + failureCount)
├── successRate: double (percentage, for quick queries)
├── timeoutErrors: integer (category: timeout)
├── parseErrors: integer (category: parse)
├── apiErrors: integer (category: api-error)
├── languageErrors: integer (category: language)
├── createdAt: timestamp
├── updatedAt: timestamp
└── UNIQUE(date, modelId) for upsert

Indexes:
- idx_model_stats_date (for time-range queries)
- idx_model_stats_model_id (for per-model queries)
- idx_model_stats_date_model (composite for efficient lookups)
```

**Rationale:**
- Daily granularity sufficient for regression detection (not minute-by-minute)
- Error category breakdown enables root cause analysis
- Pre-calculated successRate avoids division in every query
- Unique constraint on (date, modelId) enables upsert pattern for incremental updates

### Pattern 1: Daily Stats Aggregation

**What:** Aggregate per-model success/failure counts from predictions table daily
**When to use:** Background worker runs at end of day (UTC midnight + 5 minutes) to aggregate yesterday's predictions
**Example:**

```typescript
// Source: BullMQ worker pattern + Drizzle aggregation queries
import { getDb, predictions, models, llmModelStats } from '@/lib/db';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

interface DailyStats {
  modelId: string;
  date: string; // YYYY-MM-DD
  successCount: number;
  failureCount: number;
  totalAttempts: number;
  successRate: number;
  errorBreakdown: {
    timeout: number;
    parse: number;
    apiError: number;
    language: number;
    other: number;
  };
}

export async function aggregateDailyStats(date: string): Promise<void> {
  const db = getDb();

  // Date range: start of date to end of date (UTC)
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  // Aggregate per-model stats from predictions table
  // Group by modelId, count successes/failures, categorize errors
  const statsQuery = await db
    .select({
      modelId: predictions.modelId,
      successCount: sql<number>`COUNT(*) FILTER (WHERE ${predictions.homeScore} IS NOT NULL AND ${predictions.awayScore} IS NOT NULL)`,
      failureCount: sql<number>`COUNT(*) FILTER (WHERE ${predictions.homeScore} IS NULL OR ${predictions.awayScore} IS NULL)`,
      timeoutErrors: sql<number>`COUNT(*) FILTER (WHERE ${predictions.failureReason} LIKE '%timeout%')`,
      parseErrors: sql<number>`COUNT(*) FILTER (WHERE ${predictions.failureReason} LIKE '%parse%' OR ${predictions.failureReason} LIKE '%JSON%')`,
      apiErrors: sql<number>`COUNT(*) FILTER (WHERE ${predictions.failureReason} LIKE '%API error%' OR ${predictions.failureReason} LIKE '%429%' OR ${predictions.failureReason} LIKE '%5xx%')`,
      languageErrors: sql<number>`COUNT(*) FILTER (WHERE ${predictions.failureReason} LIKE '%language%' OR ${predictions.failureReason} LIKE '%Chinese%')`,
    })
    .from(predictions)
    .where(
      and(
        gte(predictions.createdAt, startOfDay),
        lt(predictions.createdAt, endOfDay)
      )
    )
    .groupBy(predictions.modelId);

  // Upsert each model's stats
  for (const stat of statsQuery) {
    const totalAttempts = stat.successCount + stat.failureCount;
    const successRate = totalAttempts > 0
      ? (stat.successCount / totalAttempts) * 100
      : 0;

    await db.insert(llmModelStats)
      .values({
        id: crypto.randomUUID(),
        date,
        modelId: stat.modelId,
        successCount: stat.successCount,
        failureCount: stat.failureCount,
        totalAttempts,
        successRate,
        timeoutErrors: stat.timeoutErrors,
        parseErrors: stat.parseErrors,
        apiErrors: stat.apiErrors,
        languageErrors: stat.languageErrors,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [llmModelStats.date, llmModelStats.modelId],
        set: {
          successCount: stat.successCount,
          failureCount: stat.failureCount,
          totalAttempts,
          successRate,
          timeoutErrors: stat.timeoutErrors,
          parseErrors: stat.parseErrors,
          apiErrors: stat.apiErrors,
          languageErrors: stat.languageErrors,
          updatedAt: sql`now()`,
        },
      });
  }
}
```

**Integration point:** BullMQ cron job runs daily at 00:05 UTC, aggregates previous day's stats

### Pattern 2: Multi-Window Trend Queries

**What:** Query success rate trends over 7/30/90-day windows for per-model health cards
**When to use:** Admin dashboard API endpoint fetches current + historical success rates
**Example:**

```typescript
// Source: Date-fns + Drizzle time-range queries
import { subDays, format } from 'date-fns';
import { getDb, llmModelStats } from '@/lib/db';
import { eq, gte, and, desc } from 'drizzle-orm';

interface ModelHealthTrend {
  modelId: string;
  current: {
    successRate: number;
    lastFailure: string | null;
    failureCategory: string | null;
  };
  trends: {
    days7: { successRate: number; attempts: number };
    days30: { successRate: number; attempts: number };
    days90: { successRate: number; attempts: number };
  };
}

export async function getModelHealthTrends(modelId: string): Promise<ModelHealthTrend> {
  const db = getDb();
  const now = new Date();

  // Calculate date ranges
  const date7DaysAgo = format(subDays(now, 7), 'yyyy-MM-dd');
  const date30DaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
  const date90DaysAgo = format(subDays(now, 90), 'yyyy-MM-dd');

  // Fetch stats for all three windows
  const [stats7d, stats30d, stats90d, modelInfo] = await Promise.all([
    db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, modelId),
        gte(llmModelStats.date, date7DaysAgo)
      ))
      .orderBy(desc(llmModelStats.date)),

    db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, modelId),
        gte(llmModelStats.date, date30DaysAgo)
      ))
      .orderBy(desc(llmModelStats.date)),

    db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, modelId),
        gte(llmModelStats.date, date90DaysAgo)
      ))
      .orderBy(desc(llmModelStats.date)),

    // Get current model health from models table
    db.select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1),
  ]);

  // Calculate aggregates
  const aggregate = (stats: typeof stats7d) => {
    const totalSuccess = stats.reduce((sum, s) => sum + s.successCount, 0);
    const totalAttempts = stats.reduce((sum, s) => sum + s.totalAttempts, 0);
    return {
      successRate: totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0,
      attempts: totalAttempts,
    };
  };

  return {
    modelId,
    current: {
      successRate: stats7d[0]?.successRate ?? 0,
      lastFailure: modelInfo[0]?.lastFailureAt ?? null,
      failureCategory: determinePrimaryCategory(stats7d[0]) ?? null,
    },
    trends: {
      days7: aggregate(stats7d),
      days30: aggregate(stats30d),
      days90: aggregate(stats90d),
    },
  };
}

function determinePrimaryCategory(stat: typeof llmModelStats.$inferSelect | undefined): string | null {
  if (!stat) return null;

  const categories = {
    timeout: stat.timeoutErrors,
    parse: stat.parseErrors,
    apiError: stat.apiErrors,
    language: stat.languageErrors,
  };

  const max = Math.max(...Object.values(categories));
  if (max === 0) return null;

  return Object.entries(categories).find(([_, count]) => count === max)?.[0] ?? null;
}
```

**Query optimization:** Use composite index on (modelId, date) for fast time-range scans

### Pattern 3: Regression Detection Alert

**What:** Detect when a previously-working model's success rate drops below 90% threshold
**When to use:** Daily cron job runs after stats aggregation, checks for significant drops
**Example:**

```typescript
// Source: ML monitoring best practices + alert threshold patterns
interface RegressionAlert {
  modelId: string;
  previousSuccessRate: number;
  currentSuccessRate: number;
  drop: number;
  severity: 'warning' | 'critical';
  affectedDays: number;
}

export async function detectRegressions(): Promise<RegressionAlert[]> {
  const db = getDb();
  const now = new Date();

  // Compare current 7-day window to previous 7-day window
  const currentStart = format(subDays(now, 7), 'yyyy-MM-dd');
  const previousStart = format(subDays(now, 14), 'yyyy-MM-dd');
  const previousEnd = format(subDays(now, 8), 'yyyy-MM-dd');

  // Get all models
  const allModels = await db.select().from(models).where(eq(models.active, true));

  const alerts: RegressionAlert[] = [];

  for (const model of allModels) {
    // Current 7-day success rate
    const currentStats = await db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, model.id),
        gte(llmModelStats.date, currentStart)
      ));

    // Previous 7-day success rate (for comparison)
    const previousStats = await db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, model.id),
        gte(llmModelStats.date, previousStart),
        lt(llmModelStats.date, previousEnd)
      ));

    if (currentStats.length === 0 || previousStats.length === 0) continue;

    const currentRate = currentStats.reduce((sum, s) => sum + s.successRate, 0) / currentStats.length;
    const previousRate = previousStats.reduce((sum, s) => sum + s.successRate, 0) / previousStats.length;

    // Detect regression: >10% drop AND current rate below 90%
    const drop = previousRate - currentRate;

    if (drop > 10 && currentRate < 90) {
      alerts.push({
        modelId: model.id,
        previousSuccessRate: previousRate,
        currentSuccessRate: currentRate,
        drop,
        severity: currentRate < 80 ? 'critical' : 'warning',
        affectedDays: currentStats.length,
      });
    }
  }

  // Log alerts
  if (alerts.length > 0) {
    const critical = alerts.filter(a => a.severity === 'critical');
    const warnings = alerts.filter(a => a.severity === 'warning');

    if (critical.length > 0) {
      metricsLogger.error({
        regressions: critical.map(a => ({
          modelId: a.modelId,
          previousRate: `${a.previousSuccessRate.toFixed(1)}%`,
          currentRate: `${a.currentSuccessRate.toFixed(1)}%`,
          drop: `${a.drop.toFixed(1)}%`,
        })),
      }, `CRITICAL: ${critical.length} model(s) regressed below 80% success rate`);
    }

    if (warnings.length > 0) {
      metricsLogger.warn({
        regressions: warnings.map(a => ({
          modelId: a.modelId,
          drop: `${a.drop.toFixed(1)}%`,
        })),
      }, `WARNING: ${warnings.length} model(s) showing degraded performance (80-90%)`);
    }
  }

  return alerts;
}
```

**Alert strategy:** Multi-level thresholds (80% critical, 90% warning) prevent alert fatigue while catching real issues

### Pattern 4: Recharts Time-Series Visualization

**What:** Display per-model success rate trends in admin dashboard using existing Recharts components
**When to use:** Admin dashboard per-model health card showing 7/30/90-day trend lines
**Example:**

```typescript
// Source: Existing model-performance-chart.tsx pattern
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface SuccessRateTrendProps {
  data: Array<{
    date: string; // YYYY-MM-DD
    successRate: number;
    attempts: number;
  }>;
  modelId: string;
  timeWindow: '7d' | '30d' | '90d';
}

export function SuccessRateTrend({ data, modelId, timeWindow }: SuccessRateTrendProps) {
  const chartData = data.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'MMM d'),
    // Color based on success rate threshold
    color: d.successRate >= 90 ? 'hsl(142, 76%, 36%)' : // green
           d.successRate >= 80 ? 'hsl(45, 93%, 47%)' :  // yellow
           'hsl(0, 84%, 60%)',                           // red
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Success Rate - {timeWindow}</h4>
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded",
          chartData[chartData.length - 1]?.successRate >= 90 ? "bg-green-500/10 text-green-400" :
          chartData[chartData.length - 1]?.successRate >= 80 ? "bg-yellow-500/10 text-yellow-400" :
          "bg-red-500/10 text-red-400"
        )}>
          {chartData[chartData.length - 1]?.successRate.toFixed(1)}%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{ value: '%', angle: 0, position: 'insideTopLeft', style: { fontSize: 10 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '11px',
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
          />
          <Line
            type="monotone"
            dataKey="successRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          {/* Reference line at 90% threshold */}
          <Line
            type="monotone"
            dataKey={() => 90}
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{chartData.length} days</span>
        <span>{chartData.reduce((sum, d) => sum + d.attempts, 0)} attempts</span>
      </div>
    </div>
  );
}
```

**Integration:** Embed in admin dashboard's existing model health cards (Phase 52 style)

### Anti-Patterns to Avoid

- **Real-time metrics without aggregation:** Don't query predictions table on every dashboard load. Use daily aggregates for <1s response times.
- **Single success rate without context:** Don't show only current success rate. Include trend direction (↑↓) and time window for context.
- **Alert on every failure:** Don't alert on transient errors. Use 7-day rolling average to smooth out noise.
- **No error category breakdown:** Don't show generic "failures" count. Track timeout/parse/API categories for root cause analysis.
- **Missing before/after baseline:** Don't implement without Phase 57 baseline. Need pre-fix data to measure improvement.

## Don't Hand-Roll

Problems that already have solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series database | Custom tables | Daily aggregate pattern with indexed date ranges | PostgreSQL sufficient for day-granularity, no need for specialized DB |
| Trend calculation | Complex SQL aggregates | Pre-calculated successRate column + date-fns windows | Simpler queries, faster response times |
| Alert mechanism | Custom notification system | Pino structured logging (Phase 52 pattern) | Already integrated, metricsLogger has ERROR/WARN levels |
| Dashboard auth | Custom auth | Existing requireAdminAuth + checkRateLimit pattern | Proven in /api/admin/data, timing-safe comparison |
| Chart component | D3.js from scratch | Recharts LineChart (already used) | Consistent with model-performance-chart.tsx, React-native |

**Key insight:** Phase 52 established monitoring patterns (health endpoints, alert logging, admin APIs). Phase 58 extends same patterns to per-model granularity.

## Common Pitfalls

### Pitfall 1: Querying Predictions Table Directly on Dashboard Load

**What goes wrong:** Admin dashboard becomes slow as predictions table grows to millions of rows.

**Why it happens:** Calculating success rates from raw predictions requires full table scan per model (42 scans).

**How to avoid:** Pre-aggregate daily stats in background worker. Dashboard queries llm_model_stats table (42 rows for today vs millions in predictions).

**Warning signs:** Dashboard load time >5s, database CPU spikes on admin page access.

### Pitfall 2: Alert Fatigue from Transient Failures

**What goes wrong:** Single API timeout triggers alert, team ignores future alerts.

**Why it happens:** Alerting on absolute threshold (1 failure) instead of trend (sustained degradation).

**How to avoid:** Use 7-day rolling average for regression detection. Require >10% drop + below 90% threshold to trigger alert.

**Warning signs:** Multiple alerts per day for same model, alerts during known API outages.

### Pitfall 3: No Baseline for Comparison

**What goes wrong:** Can't measure Phase 57 improvement without pre-fix success rates.

**Why it happens:** Building observability after fixes already applied.

**How to avoid:** Backfill historical stats from predictions table before Phase 57 execution (pre-Phase 55 date range). Save baseline report.

**Warning signs:** "Did fixes work?" questions can't be answered with data.

### Pitfall 4: Aggregating on Worker Server Restart

**What goes wrong:** Stats aggregation job never runs because worker restarts before UTC midnight cron.

**Why it happens:** BullMQ cron jobs don't handle server restarts gracefully (missed schedules).

**How to avoid:** Add startup check for "yesterday not yet aggregated" + trigger manual aggregation. Idempotent upsert prevents duplicates.

**Warning signs:** Gaps in llm_model_stats table on days with deployments.

### Pitfall 5: Displaying Success Rate Without Attempt Count

**What goes wrong:** 100% success rate from 1 attempt looks same as 100% from 1000 attempts.

**Why it happens:** Only showing percentage without volume context.

**How to avoid:** Always display attempts count alongside success rate. Low volume = low confidence.

**Warning signs:** Admin confused why "100%" model isn't used in production (only 3 attempts).

## Code Examples

Verified patterns from project codebase and research sources:

### Database Schema Definition (Drizzle)

```typescript
// Source: Existing schema.ts pattern + time-series best practices
import { pgTable, text, integer, doublePrecision, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const llmModelStats = pgTable('llm_model_stats', {
  id: text('id').primaryKey(), // UUID
  date: text('date').notNull(), // YYYY-MM-DD for day-granularity
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),

  // Aggregate counts
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  totalAttempts: integer('total_attempts').default(0),
  successRate: doublePrecision('success_rate').default(0), // Pre-calculated percentage

  // Error category breakdown (from Phase 54 categorization)
  timeoutErrors: integer('timeout_errors').default(0),
  parseErrors: integer('parse_errors').default(0),
  apiErrors: integer('api_errors').default(0),
  languageErrors: integer('language_errors').default(0),
  otherErrors: integer('other_errors').default(0),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  // Unique constraint for upsert pattern
  unique('llm_model_stats_date_model_unique').on(table.date, table.modelId),

  // Indexes for efficient queries
  index('idx_llm_model_stats_date').on(table.date),
  index('idx_llm_model_stats_model_id').on(table.modelId),
  index('idx_llm_model_stats_date_model').on(table.date, table.modelId),
]);

export type LLMModelStat = typeof llmModelStats.$inferSelect;
export type NewLLMModelStat = typeof llmModelStats.$inferInsert;
```

### Admin API Endpoint - Model Health Trends

```typescript
// Source: Existing /api/admin/data pattern + date-fns queries
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { getModelHealthTrends } from '@/lib/db/queries/model-stats';

export async function GET(request: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`admin:model-health:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }

  // Admin authentication
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId query parameter required' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const trends = await getModelHealthTrends(modelId);

    return NextResponse.json(
      { trends },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-model-health') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
```

### BullMQ Stats Aggregation Worker

```typescript
// Source: Existing predictions.worker.ts pattern + daily cron
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '@/lib/cache/redis';
import { loggers } from '@/lib/logger/modules';
import { aggregateDailyStats, detectRegressions } from '@/lib/db/queries/model-stats';
import { format, subDays } from 'date-fns';

const log = loggers.queue;

const QUEUE_NAME = 'model-stats-queue';

export const modelStatsQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

// Schedule daily aggregation at 00:05 UTC
modelStatsQueue.add(
  'aggregate-daily-stats',
  {},
  {
    repeat: {
      pattern: '5 0 * * *', // Every day at 00:05 UTC
      tz: 'UTC',
    },
  }
);

export const modelStatsWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === 'aggregate-daily-stats') {
      // Aggregate stats for yesterday (yesterday's date at time of execution)
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      log.info({ date: yesterday }, 'Starting daily model stats aggregation');

      await aggregateDailyStats(yesterday);

      log.info({ date: yesterday }, 'Daily stats aggregation completed');

      // Run regression detection after aggregation
      const regressions = await detectRegressions();

      if (regressions.length > 0) {
        log.warn({ count: regressions.length }, 'Regressions detected');
      }

      return { date: yesterday, regressions: regressions.length };
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Single aggregation at a time
  }
);

// Startup check: backfill yesterday if missing
async function checkBackfill() {
  const db = getDb();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const existing = await db.select()
    .from(llmModelStats)
    .where(eq(llmModelStats.date, yesterday))
    .limit(1);

  if (existing.length === 0) {
    log.info({ date: yesterday }, 'Missing stats for yesterday, backfilling');
    await aggregateDailyStats(yesterday);
  }
}

modelStatsWorker.on('ready', () => {
  log.info('Model stats worker ready');
  checkBackfill();
});
```

### Before/After Comparison Report Generator

```typescript
// Source: Diagnostic report pattern from Phase 54 + markdown generation
import { getDb, llmModelStats, models } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { format, parseISO } from 'date-fns';

interface ComparisonReport {
  baselinePeriod: { start: string; end: string };
  currentPeriod: { start: string; end: string };
  overallImprovement: number;
  perModelComparison: Array<{
    modelId: string;
    displayName: string;
    baselineSuccessRate: number;
    currentSuccessRate: number;
    improvement: number;
    status: 'improved' | 'degraded' | 'unchanged';
  }>;
}

export async function generateBeforeAfterReport(
  baselineStart: string, // Pre-Phase 55 date
  baselineEnd: string,   // Pre-Phase 57 date
  currentStart: string,  // Post-Phase 57 date
  currentEnd: string     // Today
): Promise<string> {
  const db = getDb();

  // Fetch all models
  const allModels = await db.select().from(models);

  const comparisons: ComparisonReport['perModelComparison'] = [];

  for (const model of allModels) {
    // Baseline success rate
    const baselineStats = await db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, model.id),
        gte(llmModelStats.date, baselineStart),
        lte(llmModelStats.date, baselineEnd)
      ));

    // Current success rate
    const currentStats = await db.select()
      .from(llmModelStats)
      .where(and(
        eq(llmModelStats.modelId, model.id),
        gte(llmModelStats.date, currentStart),
        lte(llmModelStats.date, currentEnd)
      ));

    if (baselineStats.length === 0 || currentStats.length === 0) continue;

    const baselineRate = baselineStats.reduce((sum, s) => sum + s.successRate, 0) / baselineStats.length;
    const currentRate = currentStats.reduce((sum, s) => sum + s.successRate, 0) / currentStats.length;
    const improvement = currentRate - baselineRate;

    comparisons.push({
      modelId: model.id,
      displayName: model.displayName,
      baselineSuccessRate: baselineRate,
      currentSuccessRate: currentRate,
      improvement,
      status: improvement > 5 ? 'improved' : improvement < -5 ? 'degraded' : 'unchanged',
    });
  }

  // Calculate overall improvement
  const overallBaseline = comparisons.reduce((sum, c) => sum + c.baselineSuccessRate, 0) / comparisons.length;
  const overallCurrent = comparisons.reduce((sum, c) => sum + c.currentSuccessRate, 0) / comparisons.length;
  const overallImprovement = overallCurrent - overallBaseline;

  // Generate markdown report
  let md = `# Phase 57 Before/After Comparison Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Baseline Period:** ${baselineStart} to ${baselineEnd} (pre-Phase 55 fixes)\n`;
  md += `- **Current Period:** ${currentStart} to ${currentEnd} (post-Phase 57 fixes)\n`;
  md += `- **Overall Improvement:** ${overallImprovement > 0 ? '+' : ''}${overallImprovement.toFixed(1)}%\n`;
  md += `- **Models Improved:** ${comparisons.filter(c => c.status === 'improved').length}\n`;
  md += `- **Models Degraded:** ${comparisons.filter(c => c.status === 'degraded').length}\n`;
  md += `- **Models Unchanged:** ${comparisons.filter(c => c.status === 'unchanged').length}\n\n`;

  md += `## Per-Model Results\n\n`;
  md += `| Model | Baseline | Current | Change | Status |\n`;
  md += `|-------|----------|---------|--------|--------|\n`;

  for (const comp of comparisons.sort((a, b) => b.improvement - a.improvement)) {
    const status = comp.status === 'improved' ? '✅ Improved' :
                   comp.status === 'degraded' ? '❌ Degraded' :
                   '➖ Unchanged';

    md += `| ${comp.displayName} | ${comp.baselineSuccessRate.toFixed(1)}% | ${comp.currentSuccessRate.toFixed(1)}% | ${comp.improvement > 0 ? '+' : ''}${comp.improvement.toFixed(1)}% | ${status} |\n`;
  }

  md += `\n## Top Improvements\n\n`;
  const topImprovements = comparisons
    .filter(c => c.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 5);

  for (const comp of topImprovements) {
    md += `- **${comp.displayName}:** ${comp.baselineSuccessRate.toFixed(1)}% → ${comp.currentSuccessRate.toFixed(1)}% (+${comp.improvement.toFixed(1)}%)\n`;
  }

  md += `\n## Remaining Issues\n\n`;
  const degraded = comparisons.filter(c => c.currentSuccessRate < 90);

  if (degraded.length > 0) {
    md += `${degraded.length} model(s) still below 90% success rate:\n\n`;
    for (const comp of degraded) {
      md += `- **${comp.displayName}:** ${comp.currentSuccessRate.toFixed(1)}% (requires investigation)\n`;
    }
  } else {
    md += `All models achieving >90% success rate ✅\n`;
  }

  return md;
}

// Save report to file
export async function saveComparisonReport(report: string): Promise<string> {
  const outputDir = path.join(process.cwd(), '.planning/phases/58-observability-monitoring');
  await mkdir(outputDir, { recursive: true });

  const filename = `before-after-report-${format(new Date(), 'yyyy-MM-dd')}.md`;
  const filepath = path.join(outputDir, filename);

  await writeFile(filepath, report, 'utf-8');

  return filepath;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary health (working/broken) | Success rate trends over time | 2026 | Detect gradual degradation before catastrophic failure |
| Manual model testing | Automated daily aggregation | 2026 | Continuous monitoring without manual intervention |
| No historical tracking | Time-series metrics table | 2026 | Regression detection, trend analysis, before/after comparison |
| Generic "failures" | Error category breakdown | Phase 54 | Root cause analysis (timeout vs parse vs API) |
| Phase 52 pipeline monitoring | Phase 58 per-model monitoring | 2026 | Pipeline monitors coverage, per-model monitors reliability |

**Deprecated/outdated:**
- **Point-in-time health checks:** Only showing current failure count without trend context
- **No baseline comparison:** Can't measure fix effectiveness without pre/post metrics
- **Alert on single failure:** Modern ML monitoring uses multi-day windows to reduce noise
- **Real-time aggregation:** Daily aggregates sufficient for trend analysis, faster queries

## Open Questions

1. **Historical backfill timing**
   - What we know: Need pre-Phase 55 baseline for comparison
   - What's unclear: Exact date range to backfill (Phase 55 started when?)
   - Recommendation: Backfill from 2026-01-15 (pre-Phase 55) to today, store in llm_model_stats

2. **Alert notification channel**
   - What we know: Pino structured logging for alerts (Phase 52 pattern)
   - What's unclear: External notification (email, Slack, PagerDuty) or just logs?
   - Recommendation: Start with log-only alerts (DIAG-05 requirement), defer external notifications to Phase 59+

3. **Stats aggregation frequency**
   - What we know: Daily aggregation at UTC midnight
   - What's unclear: Should we also aggregate hourly for real-time dashboard?
   - Recommendation: Daily sufficient for regression detection, hourly adds complexity without ROI

## Sources

### Primary (HIGH confidence)
- **Project Codebase:** `src/lib/db/schema.ts` (Drizzle patterns), `src/components/model-performance-chart.tsx` (Recharts usage), `/api/admin/data/route.ts` (admin API pattern)
- **Drizzle ORM Documentation:** [/drizzle-team/drizzle-orm-docs](https://orm.drizzle.team/) - PostgreSQL schema definition, time-series index patterns
- **Phase 52 Plans:** `.planning/phases/52-monitoring-observability/52-02-PLAN.md`, `52-03-PLAN.md` - Pipeline monitoring patterns, admin endpoint structure
- **Phase 54 Research:** `.planning/phases/54-diagnostic-infrastructure/54-RESEARCH.md` - Failure categorization taxonomy, diagnostic infrastructure

### Secondary (MEDIUM confidence)
- [PostgreSQL monitoring & alerting: Best practices](https://drdroid.io/engineering-tools/postgresql-monitoring-alerting-best-practices) - Real-time monitoring and alerting through dashboards
- [Machine learning model monitoring: Best practices | Datadog](https://www.datadoghq.com/blog/ml-model-monitoring-in-production-best-practices/) - Performance metrics, drift detection, alert thresholds
- [Model monitoring for ML in production: a comprehensive guide](https://www.evidentlyai.com/ml-in-production/model-monitoring) - Regression detection, multi-level alert strategy
- [Recharts: How to Use it and Build Analytics Dashboards](https://embeddable.com/blog/what-is-recharts) - Time-series charting with React integration
- [Best Practices for PostgreSQL Time Series Database Design](https://www.alibabacloud.com/blog/best-practices-for-postgresql-time-series-database-design_599374) - Daily aggregation patterns, index optimization
- [TimescaleDB](https://www.timescale.com/) - PostgreSQL extension for time-series (not needed, but validates PostgreSQL-native approach)

### Tertiary (LOW confidence)
- [Adaptive threshold-based alarm strategies](https://pmc.ncbi.nlm.nih.gov/articles/PMC9123069/) - Multi-level threshold concepts
- [Temperature Thresholds - 8 Expert Methods](https://envigilance.com/temperature-monitoring/temperature-thresholds/) - Alert configuration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed (Drizzle, Recharts, date-fns, BullMQ)
- Architecture: HIGH - Patterns verified in existing admin dashboard and Phase 52 monitoring
- Time-series schema: HIGH - Daily aggregate pattern standard for PostgreSQL, matches project scale (42 models)
- Regression detection: MEDIUM - Algorithm based on ML monitoring research, thresholds need validation in production

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable monitoring patterns)
