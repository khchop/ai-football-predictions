/**
 * Queue Circuit Breaker - Barrel Export
 *
 * Exports queue-level circuit breaker functions for rate limit protection.
 */

export {
  recordQueueRateLimitError,
  recordQueueSuccess,
  getQueueCircuitStatus,
  isQueuePaused,
  manualResumeQueue,
  resetQueueCircuit,
  type QueueCircuitState,
} from './queue-circuit-breaker';
