# Phase 1: Critical Stability - Research

**Researched:** 2026-01-31
**Domain:** Node.js/TypeScript prediction pipeline with PostgreSQL, BullMQ, and LLM integrations
**Confidence:** HIGH

## Summary

This research investigates the critical stability domain for a prediction pipeline handling 29 LLM models across football match predictions. The system uses PostgreSQL (via Drizzle ORM), BullMQ for job processing, and Together AI for LLM inference. Current pain points include: connection pool exhaustion under concurrent workers, unhandled API null data crashes, LLM JSON parsing failures, improper timeout backoff strategies, and model auto-disable thresholds that are too aggressive.

**Primary recommendation:** Implement error-type-aware backoff (60s rate limit / linear timeout / 5s parse), increase pool size to 20+ with health monitoring, adopt multi-strategy JSON extraction (direct → markdown → regex → score pattern), and raise model disable threshold to 5 failures with 1-hour cooldown recovery.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | ^8.17.2 | PostgreSQL driver | Official Node.js driver, supports pooling, widely adopted |
| drizzle-orm | ^0.45.1 | ORM and query builder | Type-safe, lightweight, direct SQL mapping |
| bullmq | ^5.34.3 | Job queue and workers | Redis-based, supports retries, backoff, concurrency control |
| ioredis | ^5.9.2 | Redis client | Required by BullMQ, cluster support, robust reconnection |
| pino | ^10.2.1 | Structured logging | High performance, JSON output, child loggers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sentry/nextjs | ^10.36.0 | Error tracking | Production error monitoring, automatic crash reporting |
| zod | ^4.3.6 | Schema validation | Input/output validation, type safety |

**Installation:**
```bash
npm install pg drizzle-orm bullmq ioredis pino @sentry/nextjs zod
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg Pool | knex.js | Knex adds query builder overhead; pg Pool is lower-level and sufficient with Drizzle |
| BullMQ | node-cron + in-memory | BullMQ provides persistence, retries, and distributed processing required for multi-worker setup |
| pino | winston | pino has lower overhead and better structured JSON logging for production |

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── db/
│   ├── index.ts          # Pool configuration and health monitoring
│   ├── schema.ts         # Drizzle table definitions
│   └── queries.ts        # Database operations with error handling
├── queue/
│   ├── index.ts          # BullMQ connection and queue setup
│   ├── types.ts          # Job payload type definitions
│   ├── setup.ts          # Repeatable job registration
│   └── workers/          # Individual worker implementations
│       ├── predictions.worker.ts
│       └── model-recovery.worker.ts
├── llm/
│   ├── providers/
│   │   ├── base.ts       # Base provider with retry logic
│   │   └── together.ts   # Together AI implementation
│   └── prompt.ts         # JSON parsing with multi-strategy extraction
├── utils/
│   ├── api-client.ts     # fetchWithRetry with circuit breaker
│   ├── circuit-breaker.ts # Service health tracking
│   └── retry-config.ts   # Error-type-aware backoff configs
└── logger/
    ├── index.ts          # Logger factory
    └── modules.ts        # Pre-configured module loggers
```

### Pattern 1: Error-Type-Aware Backoff
**What:** Different backoff strategies based on error classification (rate limit, timeout, parse error)
**When to use:** External API calls with varying failure modes requiring different recovery timing
**Example:**
```typescript
// Source: BullMQ documentation + AWS retry best practices
function calculateBackoffDelay(
  attempt: number,
  errorType: 'rate-limit' | 'timeout' | 'parse-error' | 'network',
  baseDelayMs: number = 1000
): number {
  const jitter = Math.random() * 0.3; // 30% jitter to prevent thundering herd

  switch (errorType) {
    case 'rate-limit':
      // Rate limits need longer, consistent backoff
      return 60000; // 60s fixed for rate limit reset
    case 'timeout':
      // Timeouts benefit from linear backoff (faster recovery)
      return Math.min(attempt * 5000, 30000); // 5s, 10s, 15s... max 30s
    case 'parse-error':
      // Parse errors retry quickly (transient LLM formatting issues)
      return Math.min(5000 * Math.pow(2, attempt - 1), 20000); // 5s, 10s, 20s
    case 'network':
    default:
      // Network errors use exponential backoff
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      return Math.min(exponentialDelay * (1 + jitter), 60000);
  }
}
```

### Pattern 2: Multi-Strategy JSON Extraction
**What:** Fallback chain for parsing LLM responses: direct JSON → markdown code block → regex extraction → score pattern matching
**When to use:** LLM outputs with inconsistent formatting, markdown wrappers, or extra text
**Example:**
```typescript
// Source: Current codebase + LLM best practices
function parsePredictionResponse(response: string): ParsedPrediction {
  const strategies = [
    // Strategy 1: Direct JSON parse
    () => JSON.parse(response.trim()),

    // Strategy 2: Extract from markdown code blocks
    () => {
      const codeBlockMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) return JSON.parse(codeBlockMatch[1].trim());
      throw new Error('No code block found');
    },

    // Strategy 3: Regex extraction for score patterns
    () => {
      const scoreMatch = response.match(/\{\s*["']?home[_\s]?score["']?\s*:\s*(\d+)\s*,\s*["']?away[_\s]?score["']?\s*:\s*(\d+)\s*\}/i);
      if (scoreMatch) {
        return {
          home_score: parseInt(scoreMatch[1], 10),
          away_score: parseInt(scoreMatch[2], 10)
        };
      }
      throw new Error('No score pattern found');
    },

    // Strategy 4: Flexible pattern matching (any JSON-like object with score fields)
    () => {
      const flexibleMatch = response.match(/["']?home[_\s]?score["']?\s*[:=]\s*(\d+).*?["']?away[_\s]?score["']?\s*[:=]\s*(\d+)/is);
      if (flexibleMatch) {
        return {
          home_score: parseInt(flexibleMatch[1], 10),
          away_score: parseInt(flexibleMatch[2], 10)
        };
      }
      throw new Error('No flexible match found');
    }
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (isValidScore(result)) return { success: true, ...result };
    } catch (e) {
      // Log first 500 chars on final strategy failure
      if (i === strategies.length - 1) {
        log.error({ responsePreview: response.slice(0, 500) }, 'All JSON parse strategies failed');
      }
    }
  }

  return { success: false, error: 'Could not extract valid prediction' };
}
```

### Pattern 3: Database Pool Health Monitoring
**What:** Active monitoring of connection pool with alerting on high usage, idle connections, and wait queue
**When to use:** Production systems with 10+ concurrent workers where pool exhaustion causes cascading failures
**Example:**
```typescript
// Source: node-postgres pooling guide + production best practices
interface PoolHealth {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxConnections: number;
  utilizationPercent: number;
}

function monitorPoolHealth(pool: Pool): void {
  const health: PoolHealth = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: pool.options.max || 20,
    utilizationPercent: Math.round((pool.totalCount - pool.idleCount) / (pool.options.max || 20) * 100)
  };

  // Log metrics periodically
  loggers.db.debug(health, 'Pool health check');

  // Alert on concerning conditions
  if (health.waitingCount > 5) {
    loggers.db.warn(health, 'High connection wait queue detected');
  }
  if (health.utilizationPercent > 90) {
    loggers.db.warn(health, 'Pool utilization exceeds 90%');
  }
  if (health.totalCount === health.maxConnections && health.idleCount === 0) {
    loggers.db.error(health, 'Pool exhausted - all connections in use');
  }
}

// Run health check every 30 seconds
setInterval(() => monitorPoolHealth(pool), 30000);
```

### Pattern 4: Defensive Worker Error Handling
**What:** Worker-level try-catch with error classification, isolated failures, and graceful degradation
**When to use:** Queue workers processing external API data that may be null/malformed
**Example:**
```typescript
// Source: BullMQ worker patterns + defensive programming
const worker = new Worker(
  QUEUE_NAMES.PREDICTIONS,
  async (job) => {
    const log = loggers.predictionsWorker.child({ jobId: job.id });

    try {
      // Fetch external data with defensive checks
      const apiData = await fetchMatchData(job.data.matchId);

      // Validate data existence before processing
      if (!apiData || typeof apiData !== 'object') {
        log.warn({ matchId: job.data.matchId }, 'API returned null/invalid data');
        return { skipped: true, reason: 'invalid_api_data' };
      }

      // Process with individual error isolation
      const results = [];
      for (const item of apiData.items || []) {
        try {
          const result = await processItem(item);
          results.push(result);
        } catch (itemError) {
          // Log but continue - don't fail entire batch
          log.warn({ itemId: item.id, error: itemError.message }, 'Item processing failed');
        }
      }

      return { success: true, processed: results.length, failed: apiData.items.length - results.length };

    } catch (error) {
      // Classify error for retry decision
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED')) {
        // Retryable - throw to trigger BullMQ retry
        throw new Error(`Retryable error: ${errorMsg}`);
      }

      if (errorMsg.includes('match started') || errorMsg.includes('cancelled')) {
        // Unrecoverable - don't retry
        return { skipped: true, reason: 'unrecoverable', error: errorMsg };
      }

      // Unknown error - log and retry
      log.error({ error: errorMsg }, 'Unexpected error in worker');
      throw error;
    }
  },
  {
    connection: getQueueConnection(),
    concurrency: 1, // Process one job at a time
    settings: {
      backoffStrategy: (attemptsMade, type, err) => {
        // Error-type-aware backoff at worker level
        if (err?.message?.includes('rate limit')) return 60000;
        if (err?.message?.includes('timeout')) return attemptsMade * 5000;
        return Math.pow(2, attemptsMade) * 1000;
      }
    }
  }
);
```

### Pattern 5: Model Health Tracking with Circuit Breaker
**What:** Track consecutive failures per model, auto-disable after threshold, recover after cooldown
**When to use:** Multi-model systems where individual model failures shouldn't crash the entire pipeline
**Example:**
```typescript
// Source: Circuit breaker pattern + current codebase implementation
interface ModelHealth {
  consecutiveFailures: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  autoDisabled: boolean;
  failureReason: string | null;
}

const DISABLE_THRESHOLD = 5; // Failures before auto-disable
const COOLDOWN_HOURS = 1;    // Recovery cooldown period

async function recordModelFailure(modelId: string, error: string): Promise<{ autoDisabled: boolean }> {
  const result = await db
    .update(models)
    .set({
      consecutiveFailures: sql`COALESCE(${models.consecutiveFailures}, 0) + 1`,
      lastFailureAt: new Date().toISOString(),
      failureReason: error.substring(0, 500), // Truncate long errors
      // Auto-disable if threshold reached
      autoDisabled: sql`CASE WHEN COALESCE(${models.consecutiveFailures}, 0) + 1 >= ${DISABLE_THRESHOLD} THEN TRUE ELSE ${models.autoDisabled} END`,
    })
    .where(eq(models.id, modelId))
    .returning({ autoDisabled: models.autoDisabled });

  if (result[0]?.autoDisabled) {
    loggers.modelRecoveryWorker.warn({ modelId, threshold: DISABLE_THRESHOLD }, 'Model auto-disabled');
  }

  return { autoDisabled: result[0]?.autoDisabled || false };
}

async function recordModelSuccess(modelId: string): Promise<void> {
  await db
    .update(models)
    .set({
      consecutiveFailures: 0,
      lastSuccessAt: new Date().toISOString(),
      failureReason: null,
      autoDisabled: false, // Re-enable on success
    })
    .where(eq(models.id, modelId));
}

// Recovery worker runs every 30 minutes
async function recoverDisabledModels(): Promise<void> {
  const disabledModels = await getAutoDisabledModels();
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();

  for (const model of disabledModels) {
    const lastFailure = model.lastFailureAt ? new Date(model.lastFailureAt).getTime() : 0;
    const timeSinceFailure = now - lastFailure;

    if (timeSinceFailure >= cooldownMs) {
      // Reset to partial count (2) to require 3 more failures before re-disable
      await db
        .update(models)
        .set({
          autoDisabled: false,
          consecutiveFailures: 2, // Partial reset - not fully trusted yet
          failureReason: 'Recovered after cooldown',
        })
        .where(eq(models.id, model.id));

      loggers.modelRecoveryWorker.info({ modelId: model.id, cooldownHours: COOLDOWN_HOURS }, 'Model re-enabled after cooldown');
    }
  }
}
```

### Anti-Patterns to Avoid
- **Global error handlers that swallow all errors:** Always classify errors as retryable vs unrecoverable
- **Synchronous JSON parsing without try-catch:** LLM responses can always contain unexpected content
- **Pool sizing based on guesswork:** Use formula: max = (core_count * 2) + effective_spindle_count, adjusted for concurrent workers
- **Circuit breakers without persistence:** Store circuit state in Redis to survive restarts
- **Model disable without recovery mechanism:** Always implement automated recovery with cooldown

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connection pooling | Custom pool manager | pg.Pool | Handles connection lifecycle, reconnection, queue management |
| Job queue | In-memory array + setInterval | BullMQ | Persistence, retries, backoff, concurrency control, monitoring |
| Retry logic | Recursive try-catch with sleep | BullMQ backoff strategies | Built-in jitter, exponential backoff, error-type-aware strategies |
| Circuit breaker | Boolean flag in memory | Custom implementation with Redis persistence | State must survive restarts, needs half-open state testing |
| Structured logging | console.log with JSON | pino | High performance, child loggers, log levels, redaction |
| JSON schema validation | Manual if-checks | zod | Type inference, error messages, composable schemas |

**Key insight:** The prediction pipeline's reliability depends on battle-tested primitives. BullMQ's retry system, pg.Pool's connection management, and pino's structured logging are all optimized for production edge cases (thundering herds, connection leaks, log flooding) that custom implementations typically miss.

## Common Pitfalls

### Pitfall 1: Connection Pool Exhaustion
**What goes wrong:** "Connection pool exhausted" errors under load, queries hang indefinitely
**Why it happens:** Default pool size (10) is too small for 12+ concurrent workers; each worker holds connections during LLM API calls (2-5s), causing queue buildup
**How to avoid:**
- Increase max pool size to 20+ (current: 10)
- Add pool monitoring with alerts at 80% utilization
- Set connectionTimeoutMillis to 5s (fail fast rather than hang)
- Use idleTimeoutMillis: 30000 to recycle idle connections

**Warning signs:**
- `waitingCount` in pool metrics > 0
- Query response times spike during prediction batches
- "sorry, too many clients already" PostgreSQL errors

### Pitfall 2: Thundering Herd on Recovery
**What goes wrong:** After API service recovers from outage, all retrying requests hit simultaneously causing another outage
**Why it happens:** Exponential backoff without jitter causes synchronized retry timing across workers
**How to avoid:**
- Always add 20-30% jitter to backoff delays
- Use different backoff strategies for different error types
- Implement circuit breaker to fail fast when service is down

**Warning signs:**
- Recovery followed by immediate second outage
- Regular patterns in retry timing logs

### Pitfall 3: JSON Parse Cascade Failures
**What goes wrong:** One malformed LLM response causes entire prediction batch to fail
**Why it happens:** No try-catch around individual model parsing; single parse failure throws out entire batch
**How to avoid:**
- Wrap each model's response parsing in individual try-catch
- Return partial results (20 predictions better than 0)
- Use multi-strategy extraction with fallbacks

**Warning signs:**
- Batch predictions frequently return 0 successful
- Log shows "undefined is not iterable" errors

### Pitfall 4: Model Disable Without Classification
**What goes wrong:** Good models get disabled due to transient API issues (rate limits, timeouts)
**Why it happens:** All failures count toward disable threshold regardless of error type
**How to avoid:**
- Don't count rate limit/timeout errors toward disable threshold
- Only count model-specific failures (parse errors, invalid outputs)
- Implement cooldown recovery with partial failure count reset

**Warning signs:**
- Models disabled during API outages
- Recovery worker re-enables models that immediately fail again

### Pitfall 5: Silent Worker Crashes
**What goes wrong:** Queue workers stop processing jobs without error logs
**Why it happens:** Unhandled promise rejections, unhandled exceptions in async code, or Redis connection drops
**How to avoid:**
- Always attach error handlers to worker events
- Use Sentry for unhandled exception capture
- Implement health check endpoint that verifies worker liveness

**Warning signs:**
- Queue depth growing without processing
- No log entries for extended periods
- Redis connection errors in logs

## Code Examples

### Pool Configuration with Health Monitoring
```typescript
// Source: node-postgres pooling guide + production patterns
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Increased from 10
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Fail fast
  // Additional safety options
  keepAlive: true, // Prevent connection drops
  keepAliveInitialDelayMillis: 10000,
});

// Health monitoring
pool.on('error', (err) => {
  loggers.db.error({ error: err.message }, 'Unexpected pool error');
});

// Periodic health logging
setInterval(() => {
  const health = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max,
  };

  if (health.waiting > 0 || health.total === health.max) {
    loggers.db.warn(health, 'Pool under pressure');
  }
}, 30000);
```

### Error-Type-Aware API Client
```typescript
// Source: Current codebase + AWS retry best practices
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig,
  timeoutMs: number,
  serviceName?: ServiceName
): Promise<Response> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok) {
        if (serviceName) recordSuccess(serviceName);
        return response;
      }

      // Classify error for backoff strategy
      let errorType: ErrorType = 'network';
      if (response.status === 429) errorType = 'rate-limit';
      else if (response.status >= 500) errorType = 'server-error';

      if (!config.retryableStatusCodes.includes(response.status)) {
        throw new APIError(`Non-retryable status: ${response.status}`, response.status);
      }

      // Error-type-aware backoff
      const delay = calculateBackoffDelay(attempt, errorType, config.baseDelayMs);
      loggers.api.warn({ attempt, errorType, delayMs: delay }, 'Retrying after error');
      await sleep(delay);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Classify for backoff
      let errorType: ErrorType = 'network';
      if (errorMsg.includes('timeout')) errorType = 'timeout';
      else if (errorMsg.includes('ECONNREFUSED')) errorType = 'connection';

      if (attempt >= config.maxRetries) {
        if (serviceName) recordFailure(serviceName, error as Error);
        throw error;
      }

      const delay = calculateBackoffDelay(attempt, errorType, config.baseDelayMs);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Defensive Prediction Worker
```typescript
// Source: Current codebase patterns + defensive programming
export function createPredictionsWorker() {
  return new Worker(
    QUEUE_NAMES.PREDICTIONS,
    async (job) => {
      const { matchId } = job.data;
      const log = loggers.predictionsWorker.child({ jobId: job.id, matchId });

      try {
        const matchData = await getMatchWithRetry(matchId, 3, 2000, log);
        if (!matchData) {
          return { skipped: true, reason: 'match_not_found' };
        }

        const providers = await getActiveProviders();
        const predictions: NewPrediction[] = [];
        const successfulModels: string[] = [];

        // Process each model with individual error isolation
        for (const provider of providers) {
          try {
            const rawResponse = await provider.callAPI(BATCH_SYSTEM_PROMPT, prompt);
            const parsed = parseBatchPredictionResponse(rawResponse, [matchId]);

            if (!parsed.success) {
              // Log preview for debugging (first 500 chars)
              log.warn({
                modelId: provider.id,
                preview: rawResponse.slice(0, 500),
                error: parsed.error
              }, 'Parse failed');

              // Record failure but continue with other models
              await recordModelFailure(provider.id, parsed.error || 'Parse failed');
              continue;
            }

            predictions.push({
              matchId,
              modelId: provider.id,
              predictedHome: parsed.predictions[0].homeScore,
              predictedAway: parsed.predictions[0].awayScore,
              // ...
            });
            successfulModels.push(provider.id);

          } catch (modelError) {
            // Isolate model errors - don't fail entire batch
            const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);
            log.warn({ modelId: provider.id, error: errorMsg }, 'Model prediction failed');
            await recordModelFailure(provider.id, errorMsg);
          }
        }

        // Batch insert successful predictions
        if (predictions.length > 0) {
          await createPredictionsBatch(predictions);

          // Record successes only after successful insert
          for (const modelId of successfulModels) {
            await recordModelSuccess(modelId);
          }
        }

        return {
          success: true,
          predictionCount: predictions.length,
          failedCount: providers.length - predictions.length
        };

      } catch (error) {
        // Only throw for retryable errors
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED')) {
          throw new Error(`Retryable: ${errorMsg}`);
        }
        // Non-retryable - return skip result
        return { skipped: true, reason: 'unrecoverable', error: errorMsg };
      }
    },
    { connection: getQueueConnection(), concurrency: 1 }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single retry with fixed delay | Error-type-aware backoff with jitter | 2025 best practices | Prevents thundering herds, faster recovery for transient errors |
| Synchronous model processing | Async parallel with error isolation | Current codebase | One model failure doesn't crash batch |
| Simple JSON.parse | Multi-strategy extraction with fallbacks | Phase 1 implementation | Handles markdown, extra text, malformed JSON |
| Static pool size 10 | Dynamic 20+ with health monitoring | Phase 1 implementation | Supports 12+ concurrent workers without exhaustion |
| Disable after 3 failures | Disable after 5 with error classification | Phase 1 implementation | Reduces false positives from transient issues |
| Manual recovery | Automated cooldown recovery | Phase 1 implementation | Faster recovery, less manual intervention |

**Deprecated/outdated:**
- **Bull (v3.x):** Replaced by BullMQ with better TypeScript support and atomic operations
- **node-postgres without pooling:** Direct connections don't scale; always use Pool
- **Console logging without structure:** Use pino for production observability

## Open Questions

1. **Pool size formula validation**
   - What we know: Formula is max = (core_count * 2) + effective_spindle_count
   - What's unclear: Exact concurrent worker count during peak prediction batches
   - Recommendation: Start with 20, monitor utilization, adjust based on metrics

2. **Error classification for model disable**
   - What we know: Rate limits and timeouts are transient
   - What's unclear: Whether 5xx errors from Together AI are transient or model-specific
   - Recommendation: Treat 5xx as transient (don't count toward disable), treat parse errors and 4xx as model-specific

3. **Recovery failure count reset**
   - What we know: Starting fresh (0 failures) may be too optimistic
   - What's unclear: Whether partial reset (2 failures) is optimal
   - Recommendation: Use partial reset (2 failures) requiring 3 more failures before re-disable

## Sources

### Primary (HIGH confidence)
- `/taskforcesh/bullmq` (Context7) - BullMQ backoff strategies, worker error handling
- node-postgres official documentation - Pool sizing and configuration
- AWS Builders Library - Exponential backoff and jitter patterns

### Secondary (MEDIUM confidence)
- Current codebase analysis - Existing patterns in `/src/lib/`
- Medium article: "PostgreSQL Performance Tuning for Node.js" (Dec 2025) - Pool sizing formula
- Stack Overflow verified answers - Production pg.Pool configurations

### Tertiary (LOW confidence)
- Web search results for JSON parsing patterns - General best practices, not specific to LLM outputs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Well-established libraries with official documentation
- Architecture: HIGH - Patterns verified in codebase and Context7 documentation
- Pitfalls: HIGH - All identified from actual production issues in current system

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (90 days for stable stack, review if upgrading BullMQ or pg versions)
