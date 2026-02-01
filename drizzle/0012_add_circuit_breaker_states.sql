-- Migration: Add circuit_breaker_states table for circuit breaker persistence
-- This table allows circuit breaker state to survive Redis restarts

CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  service TEXT PRIMARY KEY, -- 'api-football', 'together-predictions', etc.
  state TEXT NOT NULL DEFAULT 'closed', -- 'closed', 'open', 'half-open'
  failures INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP,
  last_state_change TIMESTAMP DEFAULT NOW(),
  total_failures INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups by state
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_state ON circuit_breaker_states(state);
