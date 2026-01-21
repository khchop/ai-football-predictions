/**
 * Environment variable validation and type-safe access
 * This module validates that required environment variables are present
 * and provides type-safe access to them throughout the application.
 */

// Required environment variables (will throw if missing)
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
] as const;

// Optional environment variables with defaults
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  DAILY_BUDGET: '1.00',
  DB_POOL_MAX: '10',
  DB_POOL_MIN: '2',
} as const;

// Validate required env vars at module load time
function validateEnv() {
  const missing: string[] = [];
  
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file or deployment configuration.`
    );
  }
}

// Only validate on server-side
if (typeof window === 'undefined') {
  validateEnv();
}

/**
 * Type-safe environment variable access
 */
export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || OPTIONAL_ENV_VARS.DB_POOL_MAX, 10),
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || OPTIONAL_ENV_VARS.DB_POOL_MIN, 10),
  
  // API Keys (checked at usage time, not startup)
  get API_FOOTBALL_KEY() {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('API_FOOTBALL_KEY is not configured');
    return key;
  },
  
  get OPENROUTER_API_KEY() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');
    return key;
  },
  
  // Optional with defaults
  NODE_ENV: process.env.NODE_ENV || OPTIONAL_ENV_VARS.NODE_ENV,
  DAILY_BUDGET: parseFloat(process.env.DAILY_BUDGET || OPTIONAL_ENV_VARS.DAILY_BUDGET),
  
  // Optional (may be undefined)
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  
  // Helpers
  get isProduction() {
    return this.NODE_ENV === 'production';
  },
  
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
} as const;

export type Env = typeof env;
