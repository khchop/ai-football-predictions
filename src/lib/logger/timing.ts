/**
 * Timing Utilities for Performance Logging
 * 
 * Provides high-precision timing and duration formatting.
 */

import pino from 'pino';

export interface TimingResult {
  durationMs: number;
  durationFormatted: string;
}

/**
 * Start a timer, returns function to stop and get duration
 * Uses process.hrtime.bigint() for nanosecond precision
 */
export function startTimer(): () => TimingResult {
  const start = process.hrtime.bigint();
  
  return () => {
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const durationMs = Math.round(durationNs / 1_000_000);
    
    return {
      durationMs,
      durationFormatted: formatDuration(durationMs),
    };
  };
}

/**
 * Format milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Log with timing - wrap an async operation
 */
export async function withTiming<T>(
  logger: pino.Logger,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const stopTimer = startTimer();
  
  try {
    const result = await fn();
    const { durationMs, durationFormatted } = stopTimer();
    
    logger.info({
      ...context,
      durationMs,
      duration: durationFormatted,
    }, `${operation} completed`);
    
    return result;
  } catch (error) {
    const { durationMs, durationFormatted } = stopTimer();
    
    logger.error({
      ...context,
      durationMs,
      duration: durationFormatted,
      error: error instanceof Error ? error.message : String(error),
    }, `${operation} failed`);
    
    throw error;
  }
}
