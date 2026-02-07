# Phase 52: Monitoring & Observability - Research

**Researched:** 2026-02-07
**Domain:** Production observability for BullMQ job queues and prediction pipeline health
**Confidence:** HIGH

## Summary

Phase 52 adds observability to the prediction pipeline to ensure no matches go unserved. The platform already has BullMQ with Bull Board for queue inspection, Pino for structured logging, and an admin dashboard with model health monitoring. This phase extends monitoring with five key capabilities: (1) health endpoint reporting match coverage percentage, (2) admin dashboard showing gaps in upcoming matches, (3) structured alerts for matches approaching kickoff without jobs, (4) Bull Board custom metrics for match coverage, and (5) settlement failure dashboard for investigating failed scoring jobs.

The standard approach combines BullMQ's built-in metrics API with custom database queries that join scheduled matches against delayed jobs in Redis. Health endpoints should validate critical dependencies (Redis, database) not just return 200 OK. Structured logging with Pino enables filtering alerts by severity level. The admin dashboard uses server-side authentication and rate limiting (already implemented in Phase 50).

**Primary recommendation:** Extend `/api/health` to query match coverage using time-windowed database queries (next 6h) joined against BullMQ `getDelayedCount()` and `getJobs(['delayed'])`. Add custom dashboard endpoint at `/api/admin/pipeline-health` that returns match gaps with severity levels. Use Pino's child logger pattern with `level: 'error'` for critical alerts (2h to kickoff, no job). Avoid expensive queries in health checks by caching results for 60 seconds.

## Standard Stack

The established libraries/tools for production queue observability:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.34.3 | Job queue metrics API | Built-in `getDelayedCount()`, `getWaitingCount()`, `getFailed()` for queue state inspection |
| @bull-board/api | 6.16.2 | Queue visualization UI | Industry standard for Bull/BullMQ monitoring, provides job browser and retry controls |
| Pino | 10.2.1 | Structured JSON logging | Fastest Node.js logger, structured output enables log aggregation and filtering |
| Drizzle ORM | 0.45.1 | Type-safe database queries | Already used for match queries, efficient time-based filtering with indexed columns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sentry/nextjs | 10.36.0 | Error tracking & alerting | Already integrated, use for critical pipeline failures (Phase 49 pattern) |
| IORedis | 5.9.2 | Redis connection for BullMQ | Direct Redis queries for advanced metrics (scan for job patterns) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ metrics | Prometheus + bullmq-exporter | More complex setup, external service required - overkill for current scale (17 leagues, 42 models) |
| Custom dashboard | Upqueue.io / Taskforce.sh | Hosted solutions cost $29-99/month, current traffic doesn't justify external service |
| Pino alerts | Winston with transports | Pino is 5x faster, JSON output already configured for production log aggregation |

**Installation:**
```bash
# All dependencies already installed in package.json
# No new packages required for Phase 52
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/
│   ├── health/route.ts                    # Enhanced with coverage metrics (MON-01)
│   └── admin/
│       ├── pipeline-health/route.ts       # Match gap detection endpoint (MON-02)
│       └── settlement-failures/route.ts   # Failed settlement dashboard (MON-05)
├── lib/
│   ├── monitoring/
│   │   ├── pipeline-coverage.ts           # Match coverage calculation logic
│   │   ├── gap-detection.ts               # Identify matches without jobs
│   │   └── types.ts                       # Monitoring interfaces
│   └── queue/
│       └── monitoring/
│           └── match-metrics.ts           # BullMQ custom metrics for matches
└── components/admin/
    ├── pipeline-health-card.tsx           # Dashboard widget for gaps (MON-02)
    └── settlement-failures-table.tsx      # Failed job browser (MON-05)
```

### Pattern 1: Health Endpoint with Dependency Checks
**What:** Health checks validate critical dependencies (Redis, database) and return coverage metrics
**When to use:** Every production API - load balancers and orchestrators rely on health endpoints

**Example:**
```typescript
// src/app/api/health/route.ts
// Source: Microservices Pattern - Health Check API (https://microservices.io/patterns/observability/health-check-api.html)
import { NextResponse } from 'next/server';
import { isQueueConnectionHealthy } from '@/lib/queue';
import { getMatchCoverage } from '@/lib/monitoring/pipeline-coverage';

// Cache coverage result for 60s (avoid expensive query on every health check)
let cachedCoverage: { percentage: number; timestamp: number } | null = null;

export async function GET() {
  const now = Date.now();

  // Check Redis connection health
  const redisHealthy = isQueueConnectionHealthy();

  // Get match coverage (cached for 60s)
  if (!cachedCoverage || now - cachedCoverage.timestamp > 60000) {
    const coverage = await getMatchCoverage(6); // Next 6 hours
    cachedCoverage = { percentage: coverage.percentage, timestamp: now };
  }

  const isHealthy = redisHealthy && cachedCoverage.percentage > 90;

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      matchCoverage: `${cachedCoverage.percentage.toFixed(1)}%`,
    },
  }, {
    status: isHealthy ? 200 : 503,
  });
}
```

### Pattern 2: Match Coverage Calculation
**What:** Query upcoming matches and join against scheduled jobs to calculate coverage percentage
**When to use:** Health endpoint (cached), admin dashboard (real-time), alerts (scheduled checks)

**Example:**
```typescript
// src/lib/monitoring/pipeline-coverage.ts
import { db } from '@/lib/db';
import { matches } from '@/lib/db/schema';
import { gte, lte, inArray } from 'drizzle-orm';
import { getAnalysisQueue, getPredictionsQueue } from '@/lib/queue';

export interface MatchCoverageResult {
  percentage: number;
  totalMatches: number;
  coveredMatches: number;
  gaps: Array<{
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    kickoffTime: string;
    hoursUntilKickoff: number;
    missingJobs: string[];
  }>;
}

export async function getMatchCoverage(hoursAhead: number = 6): Promise<MatchCoverageResult> {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Get upcoming matches in time window
  const upcomingMatches = await db
    .select()
    .from(matches)
    .where(
      gte(matches.kickoffTime, now.toISOString()),
      lte(matches.kickoffTime, future.toISOString()),
      inArray(matches.status, ['scheduled', 'live'])
    );

  if (upcomingMatches.length === 0) {
    return { percentage: 100, totalMatches: 0, coveredMatches: 0, gaps: [] };
  }

  // Get delayed jobs from analysis and predictions queues
  const analysisQueue = getAnalysisQueue();
  const predictionsQueue = getPredictionsQueue();

  const [analysisJobs, predictionJobs] = await Promise.all([
    analysisQueue.getJobs(['delayed', 'waiting', 'active'], 0, 1000),
    predictionsQueue.getJobs(['delayed', 'waiting', 'active'], 0, 1000),
  ]);

  // Build set of matchIds with scheduled jobs
  const analysisJobMatches = new Set(analysisJobs.map(j => j.data?.matchId).filter(Boolean));
  const predictionJobMatches = new Set(predictionJobs.map(j => j.data?.matchId).filter(Boolean));

  // Identify gaps (matches without BOTH analysis AND prediction jobs)
  const gaps = upcomingMatches
    .filter(m => !analysisJobMatches.has(m.id) || !predictionJobMatches.has(m.id))
    .map(m => {
      const kickoffTime = new Date(m.kickoffTime);
      const hoursUntilKickoff = (kickoffTime.getTime() - now.getTime()) / (60 * 60 * 1000);

      return {
        matchId: m.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffTime: m.kickoffTime,
        hoursUntilKickoff,
        missingJobs: [
          !analysisJobMatches.has(m.id) ? 'analysis' : null,
          !predictionJobMatches.has(m.id) ? 'predictions' : null,
        ].filter(Boolean) as string[],
      };
    });

  const coveredMatches = upcomingMatches.length - gaps.length;
  const percentage = (coveredMatches / upcomingMatches.length) * 100;

  return {
    percentage,
    totalMatches: upcomingMatches.length,
    coveredMatches,
    gaps,
  };
}
```

### Pattern 3: Alert Logging with Severity Levels
**What:** Structured logging with severity levels for filtering critical alerts
**When to use:** Background workers, scheduled health checks, validation steps

**Example:**
```typescript
// src/lib/queue/workers/backfill.worker.ts (extend existing)
// Source: Pino Logger Guide (https://signoz.io/guides/pino-logger/)
import { loggers } from '@/lib/logger/modules';
import { getMatchCoverage } from '@/lib/monitoring/pipeline-coverage';

// In backfill worker's repeatable job handler
export async function checkPipelineHealth() {
  const log = loggers.backfillWorker.child({ task: 'pipeline-health-check' });

  const coverage = await getMatchCoverage(6); // Next 6 hours

  // Log gap summary at INFO level
  log.info({
    coveragePercentage: coverage.percentage,
    totalMatches: coverage.totalMatches,
    gaps: coverage.gaps.length,
  }, 'Pipeline health check complete');

  // Alert on critical gaps (< 2h to kickoff, no job)
  const criticalGaps = coverage.gaps.filter(g => g.hoursUntilKickoff < 2);

  if (criticalGaps.length > 0) {
    // ERROR level triggers alerts in log aggregation systems
    log.error({
      criticalGaps: criticalGaps.map(g => ({
        matchId: g.matchId,
        match: `${g.homeTeam} vs ${g.awayTeam}`,
        kickoffTime: g.kickoffTime,
        hoursUntilKickoff: g.hoursUntilKickoff.toFixed(1),
        missingJobs: g.missingJobs,
      })),
    }, 'CRITICAL: Matches within 2h of kickoff without scheduled jobs');
  }
}
```

### Pattern 4: Admin Dashboard Endpoint with Authentication
**What:** Protected API endpoint returning detailed pipeline health data for admin dashboard
**When to use:** Admin dashboards, internal tools, debugging interfaces

**Example:**
```typescript
// src/app/api/admin/pipeline-health/route.ts
// Source: Phase 50 settlement/retry/route.ts pattern
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { getMatchCoverage } from '@/lib/monitoring/pipeline-coverage';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

export async function GET(req: NextRequest) {
  // Rate limit check (10 req/min for admin endpoints)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:pipeline-health:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }

  // Admin authentication
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    // Get coverage for next 6h (early warning window)
    const coverage = await getMatchCoverage(6);

    // Classify gaps by severity
    const critical = coverage.gaps.filter(g => g.hoursUntilKickoff < 2);
    const warning = coverage.gaps.filter(g => g.hoursUntilKickoff >= 2 && g.hoursUntilKickoff < 4);
    const info = coverage.gaps.filter(g => g.hoursUntilKickoff >= 4);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        coveragePercentage: coverage.percentage,
        totalMatches: coverage.totalMatches,
        coveredMatches: coverage.coveredMatches,
        totalGaps: coverage.gaps.length,
      },
      gaps: {
        critical: critical.length,
        warning: warning.length,
        info: info.length,
      },
      matches: {
        critical,
        warning,
        info,
      },
    }, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-pipeline-health') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
```

### Pattern 5: Settlement Failure Dashboard
**What:** Browse failed settlement jobs with error reasons and retry controls
**When to use:** Investigating scoring failures, manual recovery, debugging settlement issues

**Example:**
```typescript
// src/app/api/admin/settlement-failures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { getSettlementQueue } from '@/lib/queue';
import { getDeadLetterJobs } from '@/lib/queue/dead-letter';

export async function GET(req: NextRequest) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const settlementQueue = getSettlementQueue();

  // Get failed jobs from queue
  const failedJobs = await settlementQueue.getFailed(0, 100);

  // Get settlement jobs from DLQ
  const dlqJobs = await getDeadLetterJobs(100, 0);
  const settlementDlqJobs = dlqJobs.filter(j => j.queueName === 'settlement-queue');

  // Format for dashboard display
  const failures = [
    ...failedJobs.map(job => ({
      jobId: job.id,
      matchId: job.data?.matchId,
      source: 'queue' as const,
      failedReason: job.failedReason?.substring(0, 200),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      canRetry: true,
    })),
    ...settlementDlqJobs.map(job => ({
      jobId: job.jobId,
      matchId: job.data?.matchId,
      source: 'dlq' as const,
      failedReason: job.failureReason?.substring(0, 200),
      attemptsMade: job.attemptsMade || 0,
      timestamp: job.timestamp,
      canRetry: true,
    })),
  ];

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    totalFailures: failures.length,
    failures,
  });
}
```

### Anti-Patterns to Avoid
- **Expensive health checks:** Don't run complex aggregations on every health check - cache results for 60s minimum
- **Missing dependency validation:** Health endpoint returning 200 OK when Redis is down creates false confidence
- **Unfiltered log flooding:** Logging every match check at INFO level generates noise - use ERROR only for actionable alerts
- **Blocking queries in API routes:** Always set query timeouts, use indices on `kickoffTime` for time-based filters
- **Exposing sensitive data:** Don't return full job payloads or API keys in admin endpoints - sanitize error messages

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue visualization | Custom React UI for job browsing | Bull Board (@bull-board/api) | Handles job state changes, pagination, retry controls, search - ~3000 lines of complex state management |
| Structured logging | Custom log formatting with JSON.stringify | Pino with child loggers | Asynchronous I/O (5x faster), automatic serialization of errors, request correlation |
| Error grouping | String matching on error messages | Normalized reason extraction (Phase 50 pattern) | Removes IDs/numbers to group similar errors - already implemented in `scripts/investigate-settlement-failures.ts` |
| Time-based filtering | Manual date comparisons in application code | Drizzle ORM with `gte()`/`lte()` on indexed columns | Database engine optimizes with index range scans - 100x faster than filtering in JS |
| Match gap detection | Iterating matches and checking job existence | Set-based comparison with `getJobs()` | O(n) lookup vs O(n²) iteration - critical at scale (17 leagues × ~10 matches/day) |

**Key insight:** BullMQ's `getJobs(['delayed'])` returns job data including `matchId` - use Set-based lookup (`new Set(jobs.map(j => j.data?.matchId))`) to check coverage in O(1) time. Avoid iterating matches and calling `queue.getJob(jobId)` for each (N database round trips).

## Common Pitfalls

### Pitfall 1: Health Endpoint Overwhelms Database
**What goes wrong:** Health checks run every 10 seconds (load balancer probes) - expensive coverage query causes database CPU spike
**Why it happens:** No caching strategy, complex joins run on every request, unindexed time-based filters
**How to avoid:**
- Cache coverage result for 60 seconds minimum (coverage doesn't change that frequently)
- Use separate lightweight endpoint for load balancer health (`/api/health/liveness` returns 200 OK)
- Use detailed health check (`/api/health/readiness`) only for monitoring systems (1-minute intervals)
**Warning signs:** Database CPU correlates with health check frequency, queries show up in slow query log

### Pitfall 2: Alert Fatigue from Excessive Logging
**What goes wrong:** Every match check logs at ERROR level - operations team ignores alerts
**Why it happens:** Confusion between INFO (status update) and ERROR (actionable problem)
**How to avoid:**
- Reserve ERROR level for critical issues requiring immediate action (< 2h to kickoff, no job)
- Use INFO for summary metrics (total matches checked, coverage percentage)
- Use DEBUG for per-match details (only visible when LOG_LEVEL=debug)
- Filter logs in production: `LOG_LEVEL=info` excludes debug noise
**Warning signs:** Log volume > 1000 messages/minute, operations team adds `/pipeline-health/` to log filters

### Pitfall 3: Missing Gaps Due to Stale Job State
**What goes wrong:** Match coverage shows 100% but jobs are stalled in Redis (processedOn > 5 minutes ago)
**Why it happens:** Coverage check only queries delayed/waiting jobs, doesn't detect active jobs that stopped processing
**How to avoid:**
- Check active jobs with `processedOn` timestamp: `now - job.processedOn > lockDuration` indicates stalled
- Use BullMQ's stalled job detection (built-in, runs automatically)
- Phase 49's `checkAndFixStuckMatches()` already handles this - schedule hourly in backfill worker
**Warning signs:** Bull Board shows active jobs with no recent progress, worker logs show no activity

### Pitfall 4: Race Condition in Gap Detection
**What goes wrong:** Dashboard shows gap, but job is scheduled between query time and display time
**Why it happens:** Coverage query and job scheduling are not transactional
**How to avoid:**
- Accept eventual consistency - monitoring lags reality by ~60 seconds (cache duration)
- Show "last updated" timestamp in dashboard
- Don't trigger automatic job creation from gap detection (creates duplicate jobs)
- Gap detection is early warning system, not source of truth
**Warning signs:** Duplicate jobs created, "job already exists" errors in logs

### Pitfall 5: Settlement Failures Hidden by Partial Success
**What goes wrong:** Scoring job returns success but only 38/42 models scored - 4 failures not visible
**Why it happens:** Worker returns success if majority models succeed, partial failures logged but not tracked
**How to avoid:**
- Already implemented in Phase 50: `returnvalue.failedPredictions` in job result
- Query `queue.getCompleted()` and check for non-empty `failedPredictions` array
- Show partial failures separately in dashboard (warning, not error)
**Warning signs:** Match has settlement record but prediction counts don't match model count (42 models but only 38 scores)

## Code Examples

Verified patterns from existing codebase:

### Query Upcoming Matches with Time Window
```typescript
// Source: src/lib/db/queries.ts:129 (getUpcomingMatches)
export async function getUpcomingMatches(hoursAhead: number = 48) {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return await db
    .select()
    .from(matches)
    .where(
      gte(matches.kickoffTime, now.toISOString()),
      lte(matches.kickoffTime, future.toISOString())
    )
    .orderBy(matches.kickoffTime);
}
```

### Get Delayed Jobs from Queue
```typescript
// Source: BullMQ API - Queue.getJobs() method
import { getAnalysisQueue } from '@/lib/queue';

const analysisQueue = getAnalysisQueue();

// Get delayed jobs (scheduled for future execution)
const delayedJobs = await analysisQueue.getJobs(['delayed'], 0, 1000);

// Extract match IDs from job data
const scheduledMatchIds = new Set(
  delayedJobs
    .map(job => job.data?.matchId)
    .filter(Boolean)
);

// Check if specific match has scheduled job (O(1) lookup)
const hasJob = scheduledMatchIds.has(matchId);
```

### Child Logger with Context
```typescript
// Source: src/lib/queue/workers/backfill.worker.ts:29
import { loggers } from '@/lib/logger/modules';

export function createBackfillWorker() {
  return new Worker(QUEUE_NAMES.BACKFILL, async (job) => {
    // Create child logger with job context
    const log = loggers.backfillWorker.child({
      jobId: job.id,
      jobName: job.name
    });

    // All log calls include jobId/jobName automatically
    log.info('Starting backfill check');
    log.error({ matchId }, 'Failed to schedule job');
  });
}
```

### Admin Authentication Pattern
```typescript
// Source: src/app/api/admin/settlement/retry/route.ts:43
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';

export async function POST(req: NextRequest) {
  // Rate limit BEFORE auth (prevent timing attacks)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(
    `admin:endpoint:${rateLimitKey}`,
    RATE_LIMIT_PRESETS.admin
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }

  // Timing-safe admin password comparison
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  // ... protected logic ...
}
```

### Bull Board Integration
```typescript
// Source: src/app/api/admin/queues/[[...path]]/route.ts:38-52
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getAllQueues } from '@/lib/queue';

// Lazy initialization (avoid build-time errors)
let serverAdapter: ExpressAdapter | null = null;

async function getServerAdapter() {
  if (serverAdapter) return serverAdapter;

  const queues = getAllQueues();

  serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/api/admin/queues');

  createBullBoard({
    queues: queues.map(q => new BullMQAdapter(q)),
    serverAdapter,
  });

  return serverAdapter;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual queue inspection via Redis CLI | Bull Board web UI with job browser | 2021 (Bull Board v1) | Developers can view/retry jobs without Redis commands |
| Text logs with console.log | Structured JSON logging with Pino | 2023 (Pino became dominant) | Log aggregation systems can filter/query by severity and context |
| Health check returns 200 OK always | Health check validates dependencies | 2024 (observability best practices) | Load balancers detect Redis/DB failures, prevent routing to unhealthy instances |
| Queue metrics via custom Redis queries | BullMQ built-in metrics API | 2022 (BullMQ v2) | Standardized metrics gathering, automatic aggregation in 1-minute intervals |

**Deprecated/outdated:**
- **Bull (not BullMQ):** Original Bull library is deprecated, BullMQ is the maintained successor with better TypeScript support and metrics API
- **Custom job state tracking:** Before BullMQ v5, apps tracked job state in database - now use `queue.getJobCounts()` instead
- **Polling workers for health:** Before BullMQ's `getWorkers()` API, health checks guessed worker status - now query connected workers directly

## Open Questions

Things that couldn't be fully resolved:

1. **Metrics retention policy for BullMQ**
   - What we know: BullMQ stores metrics in Redis with 1-minute intervals, recommended duration is 2 weeks (~120KB per queue)
   - What's unclear: Current platform doesn't use BullMQ metrics API yet - do we need historical metrics or just current state?
   - Recommendation: Start with current state only (no metrics retention) - Phase 52 focuses on real-time visibility. Historical trends can be added in v2.8 if needed (AMON-D02)

2. **Alert delivery mechanism**
   - What we know: Pino logs structured JSON to stdout, ERROR level indicates actionable problem
   - What's unclear: Does production have log aggregation configured? How do operations team receive alerts?
   - Recommendation: Log at ERROR level with structured data - external alerting (Slack/webhook) deferred to v2.8 (AMON-D01). For now, operations team can grep container logs for `"level":"error"` and `"CRITICAL:"`

3. **Bull Board custom metrics display**
   - What we know: Bull Board can show custom stats via `@bull-board/api`'s plugin system
   - What's unclear: Plugin API documentation is sparse, unclear if custom cards are supported in v6.16.2
   - Recommendation: Add "matches without predictions" count to admin dashboard endpoint instead of Bull Board UI - simpler implementation, same visibility (MON-04)

4. **Database index on kickoffTime column**
   - What we know: Time-based queries filter on `matches.kickoffTime` column frequently
   - What's unclear: Is there an index on `kickoffTime`? Schema file doesn't show explicit index declarations
   - Recommendation: Verify with `EXPLAIN ANALYZE` on coverage query - if scan shows sequential, add index: `CREATE INDEX idx_matches_kickoff ON matches(kickoffTime)`. Drizzle ORM generates indices from schema definitions.

## Sources

### Primary (HIGH confidence)
- [BullMQ Metrics Documentation](https://docs.bullmq.io/guide/metrics) - Built-in metrics API, 1-minute aggregation, Redis storage
- [Pino Logger Complete Guide (2026)](https://signoz.io/guides/pino-logger/) - Structured logging, log levels, filtering patterns
- [Health Check API Pattern](https://microservices.io/patterns/observability/health-check-api.html) - Dependency validation, meaningful checks vs 200 OK
- [Bull Board GitHub](https://github.com/felixmosh/bull-board) - Queue visualization, job browser, BullMQAdapter
- Phase 50 implementation (`src/app/api/admin/settlement/retry/route.ts`) - Admin auth pattern, rate limiting, DLQ handling

### Secondary (MEDIUM confidence)
- [Next.js Health Check Endpoint Guide](https://hyperping.com/blog/nextjs-health-check-endpoint) - API route implementation, status codes
- [Azure Databricks Jobs Monitoring](https://learn.microsoft.com/en-us/azure/databricks/jobs/monitor) - Gap detection patterns, alerting on missing jobs
- [Better Stack BullMQ Guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/) - Delayed jobs, repeatable jobs, scheduling patterns
- [SQL Performance Tuning Guide](https://www.acceldata.io/blog/sql-performance-tuning-strategies-to-optimize-query-execution) - Time-based filtering, index optimization

### Tertiary (LOW confidence)
- [Upqueue.io BullMQ Dashboard](https://upqueue.io/) - Hosted alternative, pricing context ($29-99/month)
- [bullmq-exporter for Prometheus](https://github.com/ron96G/bullmq-exporter) - Self-hosted metrics collection (not needed at current scale)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ, Pino, Bull Board already in package.json and actively used
- Architecture: HIGH - Patterns verified in existing codebase (Phase 50 admin endpoints, backfill worker structure)
- Pitfalls: MEDIUM - Common issues from web research, some inferred from BullMQ docs
- Match coverage calculation: HIGH - Drizzle ORM queries match existing pattern in `queries.ts`, BullMQ `getJobs()` is documented API

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable domain, BullMQ and Pino APIs don't change frequently)
