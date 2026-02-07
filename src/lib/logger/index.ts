/**
 * Pino Logger Configuration
 * 
 * Structured JSON logging with environment-based formatting:
 * - Development: Pretty-printed with colors (pino-pretty)
 * - Production: Compact JSON (suitable for Coolify/container logs)
 */

import pino from 'pino';

// Determine environment and log level
const isDev = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// Base logger configuration
const baseLogger = pino({
  level: logLevel,

  // ISO timestamps for consistent parsing in logs
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serialize Error objects properly (fixes error: {} in logs)
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
  },

  // Format level as string for better readability
  formatters: {
    level: (label) => ({ level: label }),
  },
  
  // Base context for all logs
  base: {
    env: process.env.NODE_ENV,
    service: 'bettingsoccer',
  },
  
  // Pretty print in development, JSON in production
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    },
  }),
});

export default baseLogger;
export { baseLogger as logger };

// Type for child logger bindings
export interface LogContext {
  module?: string;
  jobId?: string;
  jobName?: string;
  matchId?: string;
  modelId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Create a child logger with module context
 */
export function createLogger(module: string, context?: LogContext): pino.Logger {
  return baseLogger.child({ module, ...context });
}
