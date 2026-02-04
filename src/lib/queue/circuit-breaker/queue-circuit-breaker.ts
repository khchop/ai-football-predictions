/**
 * Queue-Level Circuit Breaker
 *
 * Pauses queue after consecutive rate limit (429) errors from Together AI.
 * Auto-resumes after cooldown to let rate limit window reset.
 *
 * Different from service-level circuit breaker:
 * - Service circuit breaker: Fail-fast individual API calls
 * - Queue circuit breaker: Pause entire queue to prevent retry storms
 *
 * When Together AI rate limits hit threshold:
 * 1. Pause the content queue (stops consuming jobs)
 * 2. Schedule auto-resume after cooldown
 * 3. Fire Sentry alert for visibility
 * 4. Resume and reset counter
 */

import * as Sentry from '@sentry/nextjs';
import { loggers } from '@/lib/logger/modules';
import { getQueue, QUEUE_NAMES } from '../index';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface QueueCircuitConfig {
  rateLimitThreshold: number; // Consecutive 429s before pause
  autoResumeAfterMs: number; // Cooldown before auto-resume
}

const DEFAULT_CONFIG: QueueCircuitConfig = {
  rateLimitThreshold: 5, // Pause after 5 consecutive rate limits
  autoResumeAfterMs: 60000, // Resume after 60 seconds
};

// Per-queue config overrides (if needed in future)
const QUEUE_CONFIGS: Partial<Record<string, Partial<QueueCircuitConfig>>> = {
  [QUEUE_NAMES.CONTENT]: {
    rateLimitThreshold: 5,
    autoResumeAfterMs: 60000,
  },
};

// ============================================================================
// STATE
// ============================================================================

export interface QueueCircuitState {
  consecutiveRateLimitErrors: number;
  lastRateLimitAt: number;
  isPaused: boolean;
  pausedAt: number | null;
  resumeTimeoutId: NodeJS.Timeout | null;
}

// In-memory state per queue (no persistence needed - transient)
const queueCircuits = new Map<string, QueueCircuitState>();

const log = loggers.circuitBreaker;

// ============================================================================
// HELPERS
// ============================================================================

function getConfig(queueName: string): QueueCircuitConfig {
  return { ...DEFAULT_CONFIG, ...QUEUE_CONFIGS[queueName] };
}

function getOrCreateState(queueName: string): QueueCircuitState {
  let state = queueCircuits.get(queueName);
  if (!state) {
    state = {
      consecutiveRateLimitErrors: 0,
      lastRateLimitAt: 0,
      isPaused: false,
      pausedAt: null,
      resumeTimeoutId: null,
    };
    queueCircuits.set(queueName, state);
  }
  return state;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Record a rate limit (429) error from the queue worker.
 * If threshold reached, pauses the queue and schedules auto-resume.
 */
export async function recordQueueRateLimitError(
  queueName: string
): Promise<void> {
  const state = getOrCreateState(queueName);
  const config = getConfig(queueName);

  state.consecutiveRateLimitErrors++;
  state.lastRateLimitAt = Date.now();

  log.warn(
    {
      queueName,
      consecutive: state.consecutiveRateLimitErrors,
      threshold: config.rateLimitThreshold,
    },
    'Rate limit error recorded'
  );

  // Check if we've hit the threshold
  if (
    state.consecutiveRateLimitErrors >= config.rateLimitThreshold &&
    !state.isPaused
  ) {
    await pauseQueue(queueName, config);
  }
}

/**
 * Record a successful job completion.
 * Resets consecutive error counter.
 */
export function recordQueueSuccess(queueName: string): void {
  const state = getOrCreateState(queueName);

  if (state.consecutiveRateLimitErrors > 0) {
    log.info(
      {
        queueName,
        previousConsecutive: state.consecutiveRateLimitErrors,
      },
      'Success recorded, resetting consecutive error count'
    );
  }

  state.consecutiveRateLimitErrors = 0;
}

/**
 * Get current circuit state for a queue.
 */
export function getQueueCircuitStatus(
  queueName: string
): QueueCircuitState | undefined {
  return queueCircuits.get(queueName);
}

/**
 * Check if a queue is currently paused due to rate limiting.
 */
export function isQueuePaused(queueName: string): boolean {
  const state = queueCircuits.get(queueName);
  return state?.isPaused ?? false;
}

// ============================================================================
// INTERNAL: PAUSE/RESUME
// ============================================================================

async function pauseQueue(
  queueName: string,
  config: QueueCircuitConfig
): Promise<void> {
  const state = getOrCreateState(queueName);

  // Prevent double-pause
  if (state.isPaused) {
    log.debug({ queueName }, 'Queue already paused, skipping');
    return;
  }

  try {
    const queue = getQueue(queueName);
    await queue.pause();

    state.isPaused = true;
    state.pausedAt = Date.now();

    log.warn(
      {
        queueName,
        consecutiveErrors: state.consecutiveRateLimitErrors,
        autoResumeAfterMs: config.autoResumeAfterMs,
      },
      'Queue PAUSED due to rate limit threshold reached'
    );

    // Fire Sentry alert
    Sentry.captureMessage(
      `Queue ${queueName} paused after ${state.consecutiveRateLimitErrors} consecutive rate limits`,
      {
        level: 'warning',
        tags: {
          queue: queueName,
          action: 'pause',
        },
        extra: {
          consecutiveErrors: state.consecutiveRateLimitErrors,
          autoResumeAfterMs: config.autoResumeAfterMs,
          pausedAt: new Date(state.pausedAt).toISOString(),
        },
      }
    );

    // Schedule auto-resume
    state.resumeTimeoutId = setTimeout(async () => {
      await resumeQueue(queueName);
    }, config.autoResumeAfterMs);
  } catch (error) {
    log.error({ queueName, error }, 'Failed to pause queue');
    Sentry.captureException(error, {
      tags: { queue: queueName, action: 'pause_failed' },
    });
  }
}

async function resumeQueue(queueName: string): Promise<void> {
  const state = getOrCreateState(queueName);

  // Clear timeout if exists
  if (state.resumeTimeoutId) {
    clearTimeout(state.resumeTimeoutId);
    state.resumeTimeoutId = null;
  }

  if (!state.isPaused) {
    log.debug({ queueName }, 'Queue not paused, skipping resume');
    return;
  }

  try {
    const queue = getQueue(queueName);
    await queue.resume();

    const pauseDuration = state.pausedAt ? Date.now() - state.pausedAt : 0;

    log.info(
      {
        queueName,
        pauseDurationMs: pauseDuration,
      },
      'Queue RESUMED after cooldown'
    );

    // Reset state
    state.isPaused = false;
    state.pausedAt = null;
    state.consecutiveRateLimitErrors = 0;

    // Fire Sentry info
    Sentry.captureMessage(`Queue ${queueName} resumed after cooldown`, {
      level: 'info',
      tags: {
        queue: queueName,
        action: 'resume',
      },
      extra: {
        pauseDurationMs: pauseDuration,
      },
    });
  } catch (error) {
    log.error({ queueName, error }, 'Failed to resume queue');
    Sentry.captureException(error, {
      tags: { queue: queueName, action: 'resume_failed' },
    });
  }
}

/**
 * Manually resume a paused queue (for admin use).
 */
export async function manualResumeQueue(queueName: string): Promise<void> {
  log.info({ queueName }, 'Manual queue resume requested');
  await resumeQueue(queueName);
}

/**
 * Reset queue circuit state (for testing/admin use).
 */
export function resetQueueCircuit(queueName: string): void {
  const state = queueCircuits.get(queueName);
  if (state?.resumeTimeoutId) {
    clearTimeout(state.resumeTimeoutId);
  }
  queueCircuits.delete(queueName);
  log.info({ queueName }, 'Queue circuit state reset');
}
