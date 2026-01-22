/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup.
 * Provides clear error messages if any are missing.
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
}

const ENV_VARS: EnvVar[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection string',
    validate: (val) => val.startsWith('postgres://') || val.startsWith('postgresql://'),
  },
  
  // Redis
  {
    name: 'REDIS_URL',
    required: true,
    description: 'Redis connection string for queue and cache',
    validate: (val) => val.startsWith('redis://') || val.startsWith('rediss://'),
  },
  
  // API Keys
  {
    name: 'API_FOOTBALL_KEY',
    required: true,
    description: 'API-Football API key for match data',
  },
  {
    name: 'TOGETHER_API_KEY',
    required: true,
    description: 'Together AI API key for predictions',
  },
  {
    name: 'OPENROUTER_API_KEY',
    required: false,
    description: 'OpenRouter API key for content generation (optional)',
  },
  
  // Admin
  {
    name: 'ADMIN_PASSWORD',
    required: true,
    description: 'Password for admin API endpoints',
  },
  
  // Application
  {
    name: 'NEXT_PUBLIC_BASE_URL',
    required: false,
    description: 'Base URL for the application (for sitemap/SEO)',
  },
  {
    name: 'NODE_ENV',
    required: true,
    description: 'Node environment (development/production)',
    validate: (val) => ['development', 'production', 'test'].includes(val),
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    
    // Check if required variable is missing
    if (envVar.required && !value) {
      errors.push(
        `Missing required environment variable: ${envVar.name} - ${envVar.description}`
      );
      continue;
    }
    
    // Check if optional variable is missing (warning only)
    if (!envVar.required && !value) {
      warnings.push(
        `Optional environment variable not set: ${envVar.name} - ${envVar.description}`
      );
      continue;
    }
    
    // Run custom validation if provided
    if (value && envVar.validate && !envVar.validate(value)) {
      errors.push(
        `Invalid value for ${envVar.name}: ${envVar.description}`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment and throw on error
 * Use this at application startup
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();
  
  if (result.warnings.length > 0) {
    console.warn('[Env Validation] Warnings:');
    result.warnings.forEach(warning => console.warn(`  ⚠  ${warning}`));
  }
  
  if (!result.valid) {
    console.error('[Env Validation] Errors:');
    result.errors.forEach(error => console.error(`  ✗  ${error}`));
    throw new Error(
      `Environment validation failed with ${result.errors.length} error(s). ` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
  
  console.log('[Env Validation] ✓ All required environment variables are set');
}

/**
 * Get a required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get an optional environment variable with default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
