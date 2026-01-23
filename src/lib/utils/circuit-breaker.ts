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

import type { ServiceName } from './retry-config';

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

// ============================================================================
// CIRCUIT BREAKER LOGIC
// ============================================================================

function getConfig(service: ServiceName): CircuitBreakerConfig {
  return { ...DEFAULT_CONFIG, ...SERVICE_CONFIGS[service] };
}

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
      console.log(`[Circuit Breaker] ${service}: OPEN -> HALF_OPEN (testing recovery)`);
      return false; // Allow request through
    }
    return true; // Still open, fail fast
  }
  
  // half-open: allow limited requests through
  return false;
}

/**
 * Record a successful request
 */
export function recordSuccess(service: ServiceName): void {
  const circuit = getOrCreateCircuit(service);
  
  circuit.totalSuccesses++;
  
  if (circuit.state === 'half-open') {
    circuit.successes++;
    // After successful request in half-open, close the circuit
    if (circuit.successes >= 1) {
      const previousState = circuit.state;
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastStateChange = Date.now();
      console.log(`[Circuit Breaker] ${service}: ${previousState.toUpperCase()} -> CLOSED (service recovered)`);
    }
  } else if (circuit.state === 'closed') {
    // Reset failure counter on success
    circuit.failures = 0;
  }
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
    console.warn(
      `[Circuit Breaker] ${service}: HALF_OPEN -> OPEN (recovery failed: ${errorMsg})`
    );
  } else if (circuit.state === 'closed' && circuit.failures >= config.failureThreshold) {
    // Too many failures, open the circuit
    circuit.state = 'open';
    circuit.lastStateChange = Date.now();
    console.warn(
      `[Circuit Breaker] ${service}: CLOSED -> OPEN after ${circuit.failures} failures ` +
      `(last error: ${errorMsg})`
    );
  } else if (circuit.state === 'closed') {
    console.warn(
      `[Circuit Breaker] ${service}: Failure ${circuit.failures}/${config.failureThreshold} ` +
      `(${errorMsg})`
    );
  }
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
  console.log(`[Circuit Breaker] ${service}: ${previousState.toUpperCase()} -> CLOSED (manual reset)`);
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
