# Phase 32: Make Failures Visible - Research

**Researched:** 2026-02-04
**Domain:** BullMQ error handling, retry mechanisms, and content validation
**Confidence:** HIGH

## Summary

BullMQ provides robust error handling and retry mechanisms for job processing, but requires explicit error throwing (not return false) to activate retries. The current codebase uses return false pattern which silently fails without triggering BullMQ's retry logic or dead letter queue tracking.

Standard approach: Throw regular Error for retryable failures (network issues, rate limits), throw UnrecoverableError for fatal failures (invalid data, auth failures). BullMQ's built-in retry system with exponential backoff handles transient failures automatically, while the 'failed' event enables DLQ implementation.

**Primary recommendation:** Replace all `return false` patterns in content generation with thrown errors, use BullMQ's UnrecoverableError for fatal errors, implement DLQ via 'failed' event listener, and add content validation before database save.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.34.3 | Job queue and retry management | Industry standard for Redis-backed queues in Node.js |
| UnrecoverableError | Built-in | Fatal error signaling | BullMQ's official pattern for non-retryable failures |
| RateLimitError | Built-in | Rate limit handling | BullMQ's official pattern for external API limits |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Worker events | Built-in | Job lifecycle hooks | 'failed' event for DLQ, 'stalled' for diagnostics |
| job.extendLock() | Built-in | Lock renewal for long jobs | Jobs exceeding lockDuration need heartbeat |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ DLQ pattern | Bull (v3) | Bull is deprecated, lacks UnrecoverableError |
| Manual retry logic | Custom exponential backoff | BullMQ built-in is battle-tested, less code |

**Installation:**
Already installed (BullMQ 5.34.3 in package.json)

## Architecture Patterns

### Recommended Error Class Structure
```
src/lib/errors/
├── content-errors.ts    # RetryableContentError, FatalContentError
└── index.ts             # Export all error classes
```

### Pattern 1: Error Throwing with Context
**What:** Replace `return false` with thrown errors containing full diagnostic context
**When to use:** All content generation functions
**Example:**
```typescript
// Source: Current codebase analysis + BullMQ best practices
// DON'T DO THIS (current pattern):
export async function generatePreMatchContent(matchId: string): Promise<boolean> {
  try {
    // ... generation logic
    return true;
  } catch (error) {
    log.error({ matchId, err: error }, 'Pre-match content generation failed');
    return false; // ❌ Silent failure, no retry
  }
}

// DO THIS (throw errors):
export async function generatePreMatchContent(matchId: string): Promise<void> {
  try {
    // ... generation logic
  } catch (error) {
    // Add diagnostic context and re-throw
    throw new RetryableContentError(
      `Pre-match content generation failed for match ${matchId}`,
      {
        matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        originalError: error,
        timestamp: new Date().toISOString(),
      }
    );
  }
}
```

### Pattern 2: Fatal vs Retryable Error Classification
**What:** Use UnrecoverableError for truly fatal errors, regular Error for retryable
**When to use:** When determining whether retry will help
**Example:**
```typescript
// Source: https://docs.bullmq.io/patterns/stop-retrying-jobs
import { UnrecoverableError } from 'bullmq';

// Fatal errors (don't retry):
if (!matchData || matchData.length === 0) {
  throw new UnrecoverableError(
    `Match ${matchId} not found - data issue, retrying won't help`
  );
}

// Retryable errors (will retry):
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  throw new Error(
    `Rate limited by LLM API - retry after ${retryAfter}s`
  );
}

// Network/timeout errors (will retry):
if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
  throw new Error(`Network error: ${error.message} - will retry`);
}
```

### Pattern 3: Rate Limit Handling with Retry-After
**What:** Use Worker.rateLimit() to pause queue when API returns 429
**When to use:** When external API provides Retry-After header
**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/rate-limiting
import { Worker, RateLimitError } from 'bullmq';

const worker = new Worker('content', async (job) => {
  try {
    const response = await callLLMAPI(job.data);

    if (response.status === 429) {
      // Extract Retry-After header (seconds or HTTP date)
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = parseRetryAfter(retryAfter) || 60000; // Default 60s

      // Pause the entire queue
      await worker.rateLimit(delayMs);

      // Throw special error (doesn't count against attempts)
      throw new RateLimitError(`Rate limited - retry after ${delayMs}ms`);
    }

    return response.data;
  } catch (error) {
    // Other errors use normal retry logic
    throw error;
  }
});
```

### Pattern 4: DLQ Implementation via 'failed' Event
**What:** Listen to 'failed' event and move exhausted jobs to separate queue
**When to use:** When jobs exceed retry attempts and need manual review
**Example:**
```typescript
// Source: https://dev.to/ronak_navadia/level-up-your-nestjs-app-with-bullmq-queues-dlqs-bull-board-5hnn
const worker = new Worker('content', processor, options);
const dlqQueue = new Queue('content-dlq');

worker.on('failed', async (job, error) => {
  if (!job) return; // Job was deleted by removeOnFail

  // Check if retries exhausted
  if (job.attemptsMade >= (job.opts.attempts || 1)) {
    // Move to DLQ with full context
    await dlqQueue.add('dlq-job', {
      originalJob: {
        id: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: error.message,
        stackTrace: error.stack,
        timestamp: new Date().toISOString(),
      },
    }, {
      removeOnComplete: {
        age: 604800, // Keep DLQ jobs for 7 days
      },
    });

    log.error({ jobId: job.id, error: error.message }, 'Job moved to DLQ');
  }
});
```

### Pattern 5: Lock Extension for Long-Running Jobs
**What:** Periodically extend job lock to prevent stalled detection
**When to use:** Jobs that may exceed lockDuration (e.g., 120s lock, 90s processing)
**Example:**
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-21-bullmq-stalled-jobs/view
const worker = new Worker('content', async (job) => {
  // Setup heartbeat to extend lock every 10 seconds
  const heartbeatInterval = setInterval(async () => {
    try {
      if (job.token) {
        await job.extendLock(job.token, 120000); // Extend by 120s
      }
    } catch (error) {
      log.warn({ jobId: job.id, err: error }, 'Lock extension failed');
      // Don't throw - let job continue, stalled detection will handle it
    }
  }, 10000); // Every 10 seconds (well before lock expiry)

  try {
    // Long-running content generation
    return await generateContent(job.data);
  } finally {
    // Always clean up interval
    clearInterval(heartbeatInterval);
  }
}, {
  lockDuration: 120000, // 2 minutes
  stalledInterval: 30000, // Check for stalled jobs every 30s
  maxStalledCount: 1, // Fail after 1 stall
});
```

### Pattern 6: Content Validation Before Save
**What:** Validate generated content meets quality thresholds before database save
**When to use:** After LLM generation, before database insert
**Example:**
```typescript
// Validation patterns based on research
function validateGeneratedContent(
  content: string,
  minLength: number = 100
): { valid: boolean; reason?: string } {
  // Length check
  if (content.length < minLength) {
    return {
      valid: false,
      reason: `Content too short: ${content.length} chars (min: ${minLength})`
    };
  }

  // Placeholder text detection
  const placeholders = [
    /\[TEAM NAME\]/gi,
    /\[PLACEHOLDER\]/gi,
    /lorem ipsum/gi,
    /\bTODO\b/gi,
    /\bFIXME\b/gi,
    /\{\{.*?\}\}/g, // Template variables
    /\[Insert.*?\]/gi,
  ];

  for (const pattern of placeholders) {
    if (pattern.test(content)) {
      return {
        valid: false,
        reason: `Placeholder detected: ${pattern.source}`
      };
    }
  }

  // Empty/whitespace only
  if (content.trim().length === 0) {
    return { valid: false, reason: 'Content is empty or whitespace only' };
  }

  return { valid: true };
}

// Usage in content generation:
const result = await generateTextWithTogetherAI(systemPrompt, prompt);
const content = result.content;

const validation = validateGeneratedContent(content, 150);
if (!validation.valid) {
  // Throw retryable error - LLM might produce valid content on retry
  throw new Error(
    `Invalid content generated: ${validation.reason}. Will retry.`
  );
}

// Content is valid, save to database
await db.insert(matchContent).values({ ... });
```

### Anti-Patterns to Avoid
- **Return false on failure:** Bypasses BullMQ retry mechanism and DLQ tracking
- **Catching all errors silently:** Prevents proper error classification and retry logic
- **No error context:** Makes debugging failed jobs nearly impossible
- **Same error class for all failures:** Can't distinguish fatal vs retryable errors
- **Hardcoded retry delays:** Use BullMQ's exponential backoff instead
- **No lock extension for long jobs:** Causes false stalled job detection

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff | Custom retry delay calculator | BullMQ's built-in backoff: `{ type: 'exponential', delay: 30000 }` | Handles jitter, overflow, edge cases |
| Dead letter queue | Custom failed job storage | BullMQ 'failed' event + separate queue | Standard pattern, integrates with Bull Board UI |
| Rate limit tracking | Custom rate limiter | BullMQ's Worker.rateLimit() + RateLimitError | Pauses entire queue, respects Retry-After |
| Job lock management | Custom heartbeat timer | job.extendLock() in interval | Atomic Redis operation, handles race conditions |
| Stalled job detection | Custom timeout tracking | BullMQ's lockDuration + stalledInterval | Built-in Redis-based detection, auto-retry |

**Key insight:** BullMQ's retry and error handling system is battle-tested across thousands of production deployments. Custom solutions miss edge cases like Redis connection failures during retry, lock race conditions, and graceful shutdown handling.

## Common Pitfalls

### Pitfall 1: Returning false Instead of Throwing
**What goes wrong:** Jobs appear to "complete successfully" but produce no output, failures invisible in queue metrics
**Why it happens:** Developers treat content generation as optional/non-blocking
**How to avoid:** Change function signatures from `Promise<boolean>` to `Promise<void>`, throw errors on failure
**Warning signs:**
- Worker shows 100% success rate but content missing in database
- No jobs in failed state despite generation issues
- Logs show errors but BullMQ reports completed jobs

### Pitfall 2: Using Same Error Class for All Failures
**What goes wrong:** Fatal errors (missing data) get retried pointlessly, wasting API quota
**Why it happens:** Not understanding UnrecoverableError vs regular Error distinction
**How to avoid:** Classify errors at throw site: data/auth issues → UnrecoverableError, network/timeout → Error
**Warning signs:**
- Jobs retry 5 times for missing database records
- DLQ full of "match not found" errors
- API quota exhausted on unretryable failures

### Pitfall 3: Ignoring Retry-After Headers
**What goes wrong:** Queue hammers rate-limited API, causing longer rate limit windows or IP bans
**Why it happens:** Not checking response headers, using fixed retry delays
**How to avoid:** Parse Retry-After header, use Worker.rateLimit(duration) to pause queue
**Warning signs:**
- Escalating rate limit durations (60s → 300s → 3600s)
- Multiple jobs hitting 429 simultaneously
- API provider warnings about abuse

### Pitfall 4: No Lock Extension for Long Jobs
**What goes wrong:** Jobs marked as stalled mid-processing, restarted while still running, duplicate content generated
**Why it happens:** lockDuration too short for actual processing time, no heartbeat
**How to avoid:** Set lockDuration to 2x expected max time, add job.extendLock() heartbeat for long jobs
**Warning signs:**
- 'stalled' events in logs during normal operation
- Duplicate content in database (same job ran twice)
- Jobs fail with "lock lost" errors mid-processing

### Pitfall 5: Validation After Database Save
**What goes wrong:** Invalid content (placeholders, too short) saved to database, visible to users
**Why it happens:** Validation happens too late or not at all
**How to avoid:** Validate LLM output immediately after generation, before database insert
**Warning signs:**
- Match pages show "[TEAM NAME]" or lorem ipsum
- Content sections only 20-30 characters
- SEO penalties for thin/duplicate content

### Pitfall 6: No DLQ Auto-Cleanup
**What goes wrong:** DLQ grows indefinitely, Redis memory exhaustion, performance degradation
**Why it happens:** DLQ jobs configured with no expiry
**How to avoid:** Set removeOnComplete: { age: 604800 } (7 days) on DLQ jobs
**Warning signs:**
- Redis memory usage climbing steadily
- DLQ has thousands of old jobs from weeks ago
- Bull Board UI slow to load failed jobs

## Code Examples

Verified patterns from official sources:

### Custom Error Classes
```typescript
// Source: BullMQ best practices + current codebase
import { UnrecoverableError } from 'bullmq';

export class RetryableContentError extends Error {
  constructor(
    message: string,
    public context: {
      matchId: string;
      homeTeam: string;
      awayTeam: string;
      contentType: 'pre-match' | 'betting' | 'post-match';
      timestamp: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'RetryableContentError';
  }
}

export class FatalContentError extends UnrecoverableError {
  constructor(
    message: string,
    public context: {
      matchId: string;
      reason: 'match_not_found' | 'invalid_data' | 'auth_failure';
      timestamp: string;
    }
  ) {
    super(message);
    this.name = 'FatalContentError';
  }
}
```

### Worker Configuration with All Settings
```typescript
// Source: https://docs.bullmq.io/guide/retrying-failing-jobs + current worker
import { Worker } from 'bullmq';

export function createContentWorker() {
  const worker = new Worker<GenerateContentPayload>(
    QUEUE_NAMES.CONTENT,
    async (job: Job<GenerateContentPayload>) => {
      // Setup lock extension heartbeat for long jobs
      const heartbeat = setInterval(async () => {
        try {
          if (job.token) {
            await job.extendLock(job.token, 120000);
          }
        } catch (err) {
          log.warn({ jobId: job.id, err }, 'Lock extension failed');
        }
      }, 30000); // Every 30s (well before 120s lock expiry)

      try {
        return await processJob(job);
      } finally {
        clearInterval(heartbeat);
      }
    },
    {
      connection: getQueueConnection(),

      // Concurrency: 3 parallel jobs (avoid LLM API overload)
      concurrency: 3,

      // Lock configuration
      lockDuration: 120000, // 2 minutes
      stalledInterval: 30000, // Check every 30s
      maxStalledCount: 1, // Fail after 1 stall

      // Rate limiting (Together AI: 30 req/min)
      limiter: {
        max: 30,
        duration: 60000, // Per minute
      },
    }
  );

  // Setup DLQ handling
  const dlqQueue = getQueue('content-dlq');

  worker.on('failed', async (job, error) => {
    if (!job) return;

    // Only move to DLQ if retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      await dlqQueue.add('dlq-job', {
        originalJob: {
          id: job.id,
          data: job.data,
          error: error.message,
          stack: error.stack,
          attemptsMade: job.attemptsMade,
          timestamp: new Date().toISOString(),
        },
      });

      log.error({ jobId: job.id }, 'Job moved to DLQ after retry exhaustion');
    }
  });

  return worker;
}
```

### Job Configuration with Retry Settings
```typescript
// Source: https://docs.bullmq.io/guide/retrying-failing-jobs
await contentQueue.add(
  'generate-content',
  {
    type: 'match_preview',
    data: { matchId, homeTeam, awayTeam },
  },
  {
    // Retry configuration
    attempts: 5, // Total: 1 initial + 5 retries
    backoff: {
      type: 'exponential',
      delay: 30000, // Base delay: 30s, 1m, 2m, 4m, 8m
    },

    // Job retention
    removeOnComplete: {
      age: 86400, // Keep successful jobs 24h
      count: 100, // Keep last 100 successful
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs 7 days (for DLQ review)
    },
  }
);
```

### Rate Limit Error Handling
```typescript
// Source: https://docs.bullmq.io/guide/rate-limiting
import { RateLimitError } from 'bullmq';

async function callLLMAPI(prompt: string) {
  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ prompt }),
    });

    if (response.status === 429) {
      // Parse Retry-After header (seconds or HTTP date)
      const retryAfter = response.headers.get('Retry-After');
      let delayMs = 60000; // Default 60s

      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed)) {
          delayMs = parsed * 1000; // Convert seconds to ms
        } else {
          // HTTP date format
          const retryDate = new Date(retryAfter);
          delayMs = retryDate.getTime() - Date.now();
        }
      }

      // Pause the queue
      await worker.rateLimit(delayMs);

      // Throw special error (doesn't count against attempts)
      throw new RateLimitError(
        `Rate limited - queue paused for ${delayMs}ms`
      );
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error; // Re-throw rate limit errors as-is
    }

    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      throw new Error(`Network error: ${error.message}`);
    }

    // Unknown errors
    throw error;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Return false on failure | Throw errors with context | BullMQ v2.0+ (2021) | Enables retry logic and DLQ |
| QueueScheduler for stalled jobs | Built-in stalled detection | BullMQ v2.0+ (2021) | Simpler architecture, one less dependency |
| Manual DLQ implementation | 'failed' event pattern | BullMQ v3.0+ (2022) | Standardized DLQ approach |
| Fixed retry delays | Exponential backoff with jitter | BullMQ v1.0+ (2020) | Prevents thundering herd |
| Worker.RateLimitError() static method | RateLimitError class import | BullMQ v5.0+ (2024) | Better TypeScript typing |

**Deprecated/outdated:**
- QueueScheduler: Removed in BullMQ v2.0, stalled detection now built into Worker
- Bull (v3): Deprecated library, use BullMQ instead (active development)
- Manual retry logic: Use BullMQ's built-in attempts + backoff instead

## Open Questions

Things that couldn't be fully resolved:

1. **Exact minimum content length thresholds**
   - What we know: Typical content is 150-200 words (~900-1200 chars), current code has no validation
   - What's unclear: Should pre-match, betting, and post-match have different minimums?
   - Recommendation: Start with 100 chars minimum for all types, monitor actual generation lengths, adjust if needed (marked as Claude's Discretion in CONTEXT.md)

2. **Fatal error retry handling**
   - What we know: UnrecoverableError skips all retries immediately
   - What's unclear: Should some "fatal" errors (auth failures) get one retry in case of transient auth service issues?
   - Recommendation: Pure UnrecoverableError for data issues (match not found), regular Error with attempts: 2 for auth failures (one retry, then fail) (marked as Claude's Discretion in CONTEXT.md)

3. **Additional placeholder patterns**
   - What we know: Common patterns like [TEAM NAME], TODO, lorem ipsum
   - What's unclear: LLM-specific placeholders (e.g., Claude outputs "I cannot...", GPT outputs "As an AI...")
   - Recommendation: Start with common patterns, add LLM-specific ones if they appear in production logs (marked as Claude's Discretion in CONTEXT.md)

## Sources

### Primary (HIGH confidence)
- [BullMQ Official Docs - Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) - Retry configuration, backoff strategies
- [BullMQ Official Docs - Stalled Jobs](https://docs.bullmq.io/guide/jobs/stalled) - Lock duration, stalled detection
- [BullMQ Official Docs - Stop Retrying Jobs](https://docs.bullmq.io/patterns/stop-retrying-jobs) - UnrecoverableError usage
- [BullMQ Official Docs - Rate Limiting](https://docs.bullmq.io/guide/rate-limiting) - Worker.rateLimit() and RateLimitError
- [BullMQ Official Docs - Worker Concurrency](https://docs.bullmq.io/guide/workers/concurrency) - Concurrency limits
- BullMQ v5.34.3 TypeScript Definitions - Error class interfaces

### Secondary (MEDIUM confidence)
- [OneUpTime - BullMQ Stalled Jobs Guide (2026-01-21)](https://oneuptime.com/blog/post/2026-01-21-bullmq-stalled-jobs/view) - Heartbeat pattern with job.extendLock()
- [DEV Community - Level Up Your NestJS App with BullMQ DLQs](https://dev.to/ronak_navadia/level-up-your-nestjs-app-with-bullmq-queues-dlqs-bull-board-5hnn) - DLQ implementation pattern
- [DEV Community - How to Effectively Use Retry Policies](https://dev.to/woovi/how-to-effectively-use-retry-policies-with-bulljsbullmq-45h9) - Retry best practices

### Tertiary (LOW confidence)
- [AI Content Detection Research (2026)](https://direct.mit.edu/tacl/article/doi/10.1162/TACL.a.61/134537/) - Placeholder detection patterns (general guidance only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official BullMQ documentation and TypeScript types
- Architecture: HIGH - Verified patterns from official docs and recent 2026 guides
- Pitfalls: HIGH - Based on official docs warnings and production deployment guides
- Content validation: MEDIUM - Placeholder patterns from general research, not LLM-specific validation docs
- Lock extension: HIGH - Official 2026 guide with complete implementation

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - BullMQ is stable, infrequent breaking changes)
