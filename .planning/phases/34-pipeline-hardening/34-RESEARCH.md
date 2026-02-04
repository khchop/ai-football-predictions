# Phase 34: Pipeline Hardening - Research

**Researched:** 2026-02-04
**Domain:** Queue resilience, observability, and automatic protection
**Confidence:** HIGH

## Summary

This phase implements three key pipeline hardening features: circuit breaker for queue pause on rate limits (PIPE-05), worker heartbeat monitoring (PIPE-06), and content completeness alerting (PIPE-07). The codebase already has strong foundational infrastructure including a circuit breaker pattern in `src/lib/utils/circuit-breaker.ts`, BullMQ workers with stalled job detection, and Sentry integration for error reporting.

The key insight is that BullMQ provides native queue pause/resume functionality that can be controlled programmatically based on failure patterns. Combined with the existing circuit breaker infrastructure, implementing a queue-level circuit breaker that pauses after consecutive rate limit errors is straightforward. Worker heartbeat monitoring leverages BullMQ's built-in stalled job detection with custom health checks. Content completeness monitoring requires a new scheduled job that queries finished matches and alerts via Sentry/logging.

**Primary recommendation:** Build on existing circuit breaker infrastructure to add queue-level pause capability, extend worker health monitoring with `getWorkers()` API checks, and create a dedicated content completeness scan job with Sentry alerting.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | ^5.34.3 | Job queue with pause/resume | Native queue.pause(), queue.resume(), QueueEvents |
| ioredis | ^5.9.2 | Redis client | Required for BullMQ, reliable connection handling |
| Sentry | @sentry/nextjs | Error tracking & alerting | Already integrated in all workers |
| pino | (via loggers) | Structured logging | Already used throughout codebase |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| circuit-breaker.ts | Custom | Service-level circuit breaking | Extend for queue-level pause |
| retry-config.ts | Custom | Error classification | Detect rate limit errors (429, ErrorType.RATE_LIMIT) |
| metrics.ts | Custom | Queue metrics collection | Extend for health monitoring |

### Not Needed
| Instead of | Why Not | Use Instead |
|------------|---------|-------------|
| opossum circuit breaker | Over-engineering | Existing circuit-breaker.ts is sufficient |
| External monitoring (Prometheus) | Adds complexity | Sentry + structured logs are sufficient |
| Custom stall detection | Reinventing | BullMQ's native stalledInterval, maxStalledCount |

**Installation:**
No new packages needed. All required functionality exists in current dependencies.

## Architecture Patterns

### Recommended Implementation Structure
```
src/lib/queue/
├── circuit-breaker/           # NEW: Queue-level circuit breaker
│   └── queue-circuit-breaker.ts
├── monitoring/                # NEW: Health monitoring
│   ├── worker-health.ts
│   └── content-completeness.ts
├── workers/
│   └── content.worker.ts      # Modify: Add rate limit detection
└── index.ts                   # Modify: Add pause/resume exports
```

### Pattern 1: Queue-Level Circuit Breaker
**What:** Track consecutive rate limit errors per queue and auto-pause when threshold exceeded
**When to use:** When external API returns 429 errors repeatedly (5 consecutive)
**Example:**
```typescript
// Source: BullMQ docs - https://docs.bullmq.io/guide/queues
// + existing circuit-breaker.ts pattern

interface QueueCircuitState {
  consecutiveRateLimitErrors: number;
  lastRateLimitAt: number;
  isPaused: boolean;
  pausedAt: number | null;
}

// Track failures per queue
const queueCircuits = new Map<string, QueueCircuitState>();
const RATE_LIMIT_THRESHOLD = 5;
const AUTO_RESUME_AFTER_MS = 60000; // 1 minute

async function recordQueueRateLimitError(queueName: string): Promise<void> {
  const circuit = getOrCreateQueueCircuit(queueName);
  circuit.consecutiveRateLimitErrors++;
  circuit.lastRateLimitAt = Date.now();

  if (circuit.consecutiveRateLimitErrors >= RATE_LIMIT_THRESHOLD && !circuit.isPaused) {
    const queue = getQueue(queueName);
    await queue.pause();
    circuit.isPaused = true;
    circuit.pausedAt = Date.now();

    loggers.circuitBreaker.warn({
      queueName,
      consecutiveErrors: circuit.consecutiveRateLimitErrors,
    }, 'Queue paused after consecutive rate limit errors');

    Sentry.captureMessage(`Queue ${queueName} auto-paused after ${RATE_LIMIT_THRESHOLD} rate limit errors`, {
      level: 'warning',
      tags: { queue: queueName, feature: 'circuit-breaker' },
    });

    // Schedule auto-resume
    setTimeout(() => attemptAutoResume(queueName), AUTO_RESUME_AFTER_MS);
  }
}

async function recordQueueSuccess(queueName: string): Promise<void> {
  const circuit = queueCircuits.get(queueName);
  if (circuit) {
    circuit.consecutiveRateLimitErrors = 0; // Reset on success
  }
}
```

### Pattern 2: Worker Heartbeat Monitoring
**What:** Detect dead/stuck workers using BullMQ's getWorkers() and stalled job detection
**When to use:** Periodic health checks (every 60s) to detect process death
**Example:**
```typescript
// Source: BullMQ docs - https://docs.bullmq.io/guide/workers

interface WorkerHealthStatus {
  queueName: string;
  workerCount: number;
  lastHeartbeat: number;
  isHealthy: boolean;
  stalledJobCount: number;
}

async function checkWorkerHealth(queueName: string): Promise<WorkerHealthStatus> {
  const queue = getQueue(queueName);

  // Get connected workers
  const workers = await queue.getWorkers();

  // Check for stalled jobs (indicates worker death)
  const stalledJobs = await queue.getJobs(['waiting'], 0, 100);
  const recentlyStalled = stalledJobs.filter(job =>
    job.processedOn && job.finishedOn === undefined &&
    Date.now() - job.processedOn > 120000 // 2 minutes
  );

  const isHealthy = workers.length > 0 && recentlyStalled.length === 0;

  if (!isHealthy) {
    loggers.workers.error({
      queueName,
      workerCount: workers.length,
      stalledJobCount: recentlyStalled.length,
    }, 'Worker health check failed');

    Sentry.captureMessage(`Worker health check failed for ${queueName}`, {
      level: 'error',
      tags: { queue: queueName, feature: 'worker-heartbeat' },
      extra: {
        workerCount: workers.length,
        stalledJobCount: recentlyStalled.length,
      },
    });
  }

  return {
    queueName,
    workerCount: workers.length,
    lastHeartbeat: Date.now(),
    isHealthy,
    stalledJobCount: recentlyStalled.length,
  };
}
```

### Pattern 3: Content Completeness Monitoring
**What:** Query finished matches missing content and alert
**When to use:** Scheduled scan (every hour) checks for content gaps
**Example:**
```typescript
// Source: Existing content/queries.ts - getMatchesMissingPostMatchContent

interface ContentCompletenessResult {
  finishedMatchesWithoutContent: number;
  matchIds: string[];
  alertTriggered: boolean;
}

async function checkContentCompleteness(): Promise<ContentCompletenessResult> {
  // Get matches finished in last 24h without post-match content
  const missingContent = await getMatchesMissingPostMatchContent(1); // 1 day

  const shouldAlert = missingContent.length > 0;

  if (shouldAlert) {
    loggers.content.warn({
      count: missingContent.length,
      matchIds: missingContent.slice(0, 10).map(m => m.matchId),
    }, 'Finished matches missing content detected');

    Sentry.captureMessage(
      `${missingContent.length} finished matches have no content`,
      {
        level: 'warning',
        tags: { feature: 'content-completeness' },
        extra: {
          matchCount: missingContent.length,
          sampleMatchIds: missingContent.slice(0, 5).map(m => m.matchId),
        },
      }
    );
  }

  return {
    finishedMatchesWithoutContent: missingContent.length,
    matchIds: missingContent.map(m => m.matchId),
    alertTriggered: shouldAlert,
  };
}
```

### Anti-Patterns to Avoid
- **Manual lock management:** BullMQ handles locks internally; don't implement custom locking
- **Blocking retry loops:** Use BullMQ's retry mechanism, not manual retry loops in worker code
- **Polling for stalled detection:** Use BullMQ's native stalledInterval instead of custom polling
- **Hardcoded pause durations:** Use configurable timeouts with automatic recovery

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stalled job detection | Custom heartbeat timer | BullMQ stalledInterval/maxStalledCount | Battle-tested, handles edge cases |
| Queue pause/resume | Custom job filtering | queue.pause()/queue.resume() | Atomic operations, proper Redis handling |
| Consecutive failure tracking | Simple counter | Extend circuit-breaker.ts | Already handles persistence, state transitions |
| Rate limit detection | Manual 429 parsing | ErrorType.RATE_LIMIT from retry-config.ts | Centralized error classification |
| Worker death detection | Process monitoring | BullMQ getWorkers() + QueueEvents stalled | Integrated with queue system |

**Key insight:** The codebase already has circuit breaker infrastructure. Extend it rather than building a parallel system.

## Common Pitfalls

### Pitfall 1: Pausing Without Auto-Resume
**What goes wrong:** Queue pauses on rate limit but never resumes, causing job backup
**Why it happens:** Forgetting to implement recovery mechanism
**How to avoid:** Always schedule auto-resume on pause:
```typescript
// When pausing
await queue.pause();
setTimeout(() => attemptAutoResume(queueName), AUTO_RESUME_AFTER_MS);
```
**Warning signs:** Queue shows `paused: true` for extended periods, job counts grow

### Pitfall 2: Race Conditions in Consecutive Error Counting
**What goes wrong:** Multiple workers increment counter simultaneously, triggering multiple pauses
**Why it happens:** Non-atomic read-increment-write operations
**How to avoid:** Use atomic Redis operations or a mutex:
```typescript
// Use Redis INCR for atomic counting
const count = await redis.incr(`queue:ratelimit:${queueName}`);
await redis.expire(`queue:ratelimit:${queueName}`, 60);
```
**Warning signs:** Queue pauses/resumes rapidly, duplicate alerts

### Pitfall 3: Alerting on Transient Issues
**What goes wrong:** Alert fatigue from temporary content generation delays
**Why it happens:** Alerting immediately when content is missing
**How to avoid:** Use grace period (24h for finished matches):
```typescript
// Only alert for matches finished > 24h ago
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const missingContent = matches.filter(m =>
  new Date(m.finishedAt) < cutoff && !m.postMatchContent
);
```
**Warning signs:** High alert frequency, alerts self-resolve

### Pitfall 4: Worker Health False Positives
**What goes wrong:** Reports workers as dead when they're processing long jobs
**Why it happens:** Not accounting for lockDuration and stalledInterval
**How to avoid:** Check both worker count AND job activity:
```typescript
// Worker exists but may be processing - check idle time
const workers = await queue.getWorkers();
const activeWorkers = workers.filter(w =>
  parseInt(w.idle) < 300000 // Active in last 5 minutes
);
```
**Warning signs:** Health alerts during normal operation, especially for long-running jobs

## Code Examples

Verified patterns from official sources:

### Queue Pause/Resume (BullMQ Native)
```typescript
// Source: https://api.docs.bullmq.io/classes/v5.Queue.html

import { Queue } from 'bullmq';

const queue = new Queue('content-queue', { connection });

// Pause queue (atomic operation)
await queue.pause();

// Check if paused
const isPaused = await queue.isPaused();

// Resume queue
await queue.resume();
```

### QueueEvents for Failure Tracking
```typescript
// Source: https://api.docs.bullmq.io/interfaces/v4.QueueEventsListener.html

import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('content-queue', { connection });

// Listen for failed jobs
queueEvents.on('failed', ({ jobId, failedReason }) => {
  if (failedReason.includes('429') || failedReason.includes('rate limit')) {
    recordQueueRateLimitError('content-queue');
  }
});

// Listen for completed jobs (reset counter)
queueEvents.on('completed', ({ jobId }) => {
  recordQueueSuccess('content-queue');
});

// Listen for stalled jobs (worker health)
queueEvents.on('stalled', ({ jobId }) => {
  loggers.workers.warn({ jobId }, 'Job stalled - possible worker death');
});
```

### Worker with Rate Limit Handling
```typescript
// Source: https://docs.bullmq.io/guide/rate-limiting

import { Worker, RateLimitError } from 'bullmq';

const worker = new Worker(
  'content-queue',
  async (job) => {
    try {
      // Process job
      await processJob(job);
    } catch (error) {
      if (error.message.includes('429')) {
        // Notify queue circuit breaker
        await recordQueueRateLimitError('content-queue');
        // BullMQ handles retry
        throw new RateLimitError('Rate limit hit');
      }
      throw error;
    }
  },
  {
    connection,
    // Existing configuration from content.worker.ts
    lockDuration: 120000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  }
);
```

### Extend Existing Circuit Breaker for Queue Pause
```typescript
// Source: Extend src/lib/utils/circuit-breaker.ts

// Add to existing SERVICE_CONFIGS
const QUEUE_CIRCUIT_CONFIGS: Record<string, QueueCircuitConfig> = {
  [QUEUE_NAMES.CONTENT]: {
    rateLimitThreshold: 5,           // Pause after 5 consecutive 429s
    autoResumeAfterMs: 60000,        // Try to resume after 1 minute
    healthCheckIntervalMs: 30000,    // Check health every 30s
  },
};

// Integrate with existing circuit breaker state persistence
async function persistQueueCircuitState(queueName: string, state: QueueCircuitState): Promise<void> {
  // Use existing cacheSet/saveCircuitToDatabase pattern
  await cacheSet(`queue:circuit:${queueName}`, state, CIRCUIT_BREAKER_TTL);
  await saveQueueCircuitToDatabase(queueName, state);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| QueueScheduler for stalled jobs | Built-in Worker stalledInterval | BullMQ 2.0 | No separate component needed |
| Manual rate limit retry | Worker.RateLimitError | BullMQ 3.x | Native retry handling |
| Separate monitoring service | QueueEvents + getWorkers | BullMQ 4.x | Single codebase monitoring |

**Deprecated/outdated:**
- QueueScheduler: No longer needed in BullMQ 2.0+ for stalled detection

## Open Questions

Things that couldn't be fully resolved:

1. **Redis Cluster with getWorkers()**
   - What we know: getWorkers() doesn't work with Redis Cluster (uses CLIENT LIST on single node)
   - What's unclear: Whether this affects the deployment
   - Recommendation: Verify Redis is not in cluster mode; if clustered, use alternative health check

2. **Optimal Auto-Resume Timing**
   - What we know: 1 minute is common, API-Football has 30-second reset
   - What's unclear: Optimal timing for Together AI rate limits
   - Recommendation: Start with 60s, make configurable, monitor and adjust

3. **Sentry Alert Volume**
   - What we know: Sentry has alert fatigue risk
   - What's unclear: Appropriate threshold for content completeness alerts
   - Recommendation: Start with 1+ matches missing content for 24h, tune based on volume

## Sources

### Primary (HIGH confidence)
- BullMQ API Docs: Queue.pause(), Queue.resume(), Queue.isPaused() - https://api.docs.bullmq.io/classes/v5.Queue.html
- BullMQ QueueEvents: failed, stalled, completed events - https://api.docs.bullmq.io/interfaces/v4.QueueEventsListener.html
- BullMQ Rate Limiting Guide - https://docs.bullmq.io/guide/rate-limiting
- BullMQ Stalled Jobs Guide - https://docs.bullmq.io/guide/jobs/stalled
- Existing circuit-breaker.ts - `/Users/pieterbos/Documents/bettingsoccer/src/lib/utils/circuit-breaker.ts`
- Existing content.worker.ts - `/Users/pieterbos/Documents/bettingsoccer/src/lib/queue/workers/content.worker.ts`

### Secondary (MEDIUM confidence)
- BullMQ getWorkers() API - https://github.com/taskforcesh/bullmq/discussions/2460
- Node.js circuit breaker patterns - https://leapcell.io/blog/fortifying-node-js-apis-with-rate-limiting-and-circuit-breakers

### Tertiary (LOW confidence)
- Redis Cluster getWorkers limitation - https://github.com/taskforcesh/bullmq/issues/3340 (verify if applicable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, just extending patterns
- Architecture: HIGH - BullMQ native pause/resume is well-documented
- Pitfalls: MEDIUM - Based on common patterns, some project-specific validation needed

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - BullMQ is stable)
