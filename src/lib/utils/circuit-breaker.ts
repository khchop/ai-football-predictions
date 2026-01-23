/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures when external services are down.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail fast (no network call)
 * - HALF_OPEN: Testing if service recovered
 * 
 * Configuration:
 * - Opens after N consecutive failures
 * - Stays open for M seconds before trying half-open
 * - Closes again after successful request in half-open state
 */

import { loggers } from '@/lib/logger/modules';
import type { ServiceName } from './retry-config';
import { cacheGet, cacheSet } from '@/lib/cache/redis';

// Re-export for convenience
export type { ServiceName };

// ============================================================================
// CONFIGURATION
// ============================================================================

interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  resetTimeoutMs: number;      // Time before half-open
  halfOpenMaxAttempts: number; // Attempts in half-open before re-opening
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,         // Open after 5 consecutive failures
  resetTimeoutMs: 60000,       // Try again after 1 minute
  halfOpenMaxAttempts: 2,      // Allow 2 test requests in half-open
};

// Service-specific overrides
const SERVICE_CONFIGS: Partial<Record<ServiceName, Partial<CircuitBreakerConfig>>> = {
  'api-football': {
    failureThreshold: 5,
    resetTimeoutMs: 30000,     // API-Football recovers quickly
  },
  'together-predictions': {
    failureThreshold: 5,
    resetTimeoutMs: 60000,     // LLM services may need more time
  },
  'together-content': {
    failureThreshold: 5,
    resetTimeoutMs: 60000,     // Content generation same as predictions
  },
};

// ============================================================================
// STATE
// ============================================================================

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitStatus {
  state: CircuitState;
  failures: number;
  successes: number;           // Successes in half-open state
  lastFailureAt: number;       // Timestamp
  lastStateChange: number;     // Timestamp
  totalFailures: number;       // Lifetime counter for metrics
  totalSuccesses: number;      // Lifetime counter for metrics
}

const circuits = new Map<ServiceName, CircuitStatus>();

// Redis persistence configuration
const CIRCUIT_BREAKER_KEY_PREFIX = 'circuit:breaker:';
const CIRCUIT_BREAKER_TTL = 3600; // 1 hour in seconds

/**
 * Get Redis key for circuit breaker state
 */
function getCircuitKey(service: ServiceName): string {
  return `${CIRCUIT_BREAKER_KEY_PREFIX}${service}`;
}

/**
 * Load circuit state from Redis (on startup or first access)
 */
async function loadCircuitFromRedis(service: ServiceName): Promise<CircuitStatus | null> {
  try {
    const cached = await cacheGet<CircuitStatus>(getCircuitKey(service));
    if (cached) {
      loggers.circuitBreaker.debug({ service }, 'Loaded circuit state from Redis');
      return cached;
    }
  } catch (error) {
    loggers.circuitBreaker.warn({ service, error }, 'Failed to load circuit state from Redis (falling back to in-memory)');
  }
  return null;
}

/**
 * Persist circuit state to Redis
 */
async function persistCircuitToRedis(service: ServiceName, circuit: CircuitStatus): Promise<void> {
  try {
    await cacheSet(getCircuitKey(service), circuit, CIRCUIT_BREAKER_TTL);
  } catch (error) {
    loggers.circuitBreaker.warn({ service, error }, 'Failed to persist circuit state to Redis (continuing with in-memory)');
  }
}

// ============================================================================
// CIRCUIT BREAKER LOGIC
// ============================================================================

function getConfig(service: ServiceName): CircuitBreakerConfig {
  return { ...DEFAULT_CONFIG, ...SERVICE_CONFIGS[service] };
}

// Track which services have been loaded from Redis to avoid repeated attempts
const redisLoadAttempts = new Set<ServiceName>();

function getOrCreateCircuit(service: ServiceName): CircuitStatus {
  let circuit = circuits.get(service);
  if (!circuit) {
    circuit = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureAt: 0,
      lastStateChange: Date.now(),
      totalFailures: 0,
      totalSuccesses: 0,
    };
    circuits.set(service, circuit);
  }
  return circuit;
}

/**
 * Async version to load from Redis on first access
 */
async function getOrCreateCircuitAsync(service: ServiceName): Promise<CircuitStatus> {
  let circuit = circuits.get(service);
  
  // If not in memory and haven't tried loading from Redis yet, try to load
  if (!circuit && !redisLoadAttempts.has(service)) {
    redisLoadAttempts.add(service);
    const redisCircuit = await loadCircuitFromRedis(service);
    if (redisCircuit) {
      circuit = redisCircuit;
      circuits.set(service, circuit);
    }
  }
  
  // Fall back to creating new if not found
  if (!circuit) {
    circuit = getOrCreateCircuit(service);
  }
  
  return circuit;
}

/**
 * Check if circuit is open (should fail fast)
 */
export function isCircuitOpen(service: ServiceName): boolean {
  const circuit = getOrCreateCircuit(service);
  const config = getConfig(service);
  
  if (circuit.state === 'closed') {
    return false;
  }
  
    if (circuit.state === 'open') {
     // Check if we should transition to half-open
     const timeSinceFailure = Date.now() - circuit.lastFailureAt;
     if (timeSinceFailure >= config.resetTimeoutMs) {
       circuit.state = 'half-open';
       circuit.successes = 0;
       circuit.lastStateChange = Date.now();
       loggers.circuitBreaker.info({ service }, 'OPEN -> HALF_OPEN (testing recovery)');
       return false; // Allow request through
     }
     return true; // Still open, fail fast
   }
  
  // half-open: allow limited requests through
  return false;
}

/**
 * Record a successful request
 * Requires multiple consecutive successes to close circuit (prevents oscillation)
 */
export function recordSuccess(service: ServiceName): void {
  const circuit = getOrCreateCircuit(service);
  
  circuit.totalSuccesses++;
  
  if (circuit.state === 'half-open') {
    circuit.successes++;
    
    // Require 3 consecutive successes to close circuit
    // This prevents oscillation with intermittent failures
    const REQUIRED_SUCCESSES = 3;
    
    if (circuit.successes >= REQUIRED_SUCCESSES) {
      const previousState = circuit.state;
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastStateChange = Date.now();
      loggers.circuitBreaker.info(
        { service, previousState, successesRequired: REQUIRED_SUCCESSES },
        'HALF_OPEN -> CLOSED (service recovered)'
      );
    } else {
      loggers.circuitBreaker.debug(
        { service, successes: circuit.successes, required: REQUIRED_SUCCESSES },
        'Half-open success recorded'
      );
    }
  } else if (circuit.state === 'closed') {
    // Reset failure counter on success
    circuit.failures = 0;
  }
  
  // Persist to Redis asynchronously (don't block on success)
  persistCircuitToRedis(service, circuit).catch(() => {
    // Error already logged in persistCircuitToRedis
  });
}

/**
 * Record a failed request
 */
export function recordFailure(service: ServiceName, error?: Error): void {
  const circuit = getOrCreateCircuit(service);
  const config = getConfig(service);
  
  circuit.failures++;
  circuit.totalFailures++;
  circuit.lastFailureAt = Date.now();
  
  const errorMsg = error?.message || 'Unknown error';
  
    if (circuit.state === 'half-open') {
      // Failure in half-open immediately opens circuit
      circuit.state = 'open';
      circuit.lastStateChange = Date.now();
      loggers.circuitBreaker.warn(
        { service, error: errorMsg },
        'HALF_OPEN -> OPEN (recovery failed)'
      );
    } else if (circuit.state === 'closed' && circuit.failures >= config.failureThreshold) {
      // Too many failures, open the circuit
      circuit.state = 'open';
      circuit.lastStateChange = Date.now();
      loggers.circuitBreaker.warn(
        { service, failures: circuit.failures, error: errorMsg },
        'CLOSED -> OPEN after too many failures'
      );
    } else if (circuit.state === 'closed') {
      loggers.circuitBreaker.warn(
        { service, currentFailures: circuit.failures, threshold: config.failureThreshold, error: errorMsg },
        'Failure recorded'
      );
    }
  
  // Persist to Redis asynchronously (don't block on failure)
  persistCircuitToRedis(service, circuit).catch(() => {
    // Error already logged in persistCircuitToRedis
  });
}

/**
 * Get current circuit status (for monitoring/debugging)
 */
export function getCircuitStatus(service: ServiceName): CircuitStatus & { config: CircuitBreakerConfig } {
  const circuit = getOrCreateCircuit(service);
  const config = getConfig(service);
  return { ...circuit, config };
}

/**
 * Get all circuit statuses (for admin dashboard)
 */
export function getAllCircuitStatuses(): Map<ServiceName, CircuitStatus & { config: CircuitBreakerConfig }> {
  const statuses = new Map();
  for (const [service, circuit] of circuits) {
    statuses.set(service, { ...circuit, config: getConfig(service) });
  }
  return statuses;
}

/**
 * Manually reset a circuit (for admin use)
 */
export function resetCircuit(service: ServiceName): void {
    const circuit = getOrCreateCircuit(service);
    const previousState = circuit.state;
    circuit.state = 'closed';
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.lastStateChange = Date.now();
    loggers.circuitBreaker.info({ service, previousState }, 'Manual reset');
    
    // Persist the reset to Redis
    persistCircuitToRedis(service, circuit).catch(() => {
      // Error already logged
    });
  }

/**
 * Initialize circuits from Redis on startup (for known services)
 * This ensures circuit state survives app restarts
 */
export async function initializeCircuitsFromRedis(): Promise<void> {
  const services: ServiceName[] = ['api-football', 'together-predictions', 'together-content'];
  
  for (const service of services) {
    try {
      const loadedCircuit = await loadCircuitFromRedis(service);
      if (loadedCircuit) {
        circuits.set(service, loadedCircuit);
        redisLoadAttempts.add(service);
        loggers.circuitBreaker.info({ service }, 'Circuit state restored from Redis');
      }
    } catch (error) {
      loggers.circuitBreaker.warn({ service, error }, 'Failed to restore circuit from Redis');
    }
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class CircuitOpenError extends Error {
  constructor(
    public readonly service: ServiceName,
    public readonly retryAfterMs: number
  ) {
    super(
      `Circuit breaker OPEN for ${service}. ` +
      `Service temporarily unavailable. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`
    );
    this.name = 'CircuitOpenError';
  }
}
