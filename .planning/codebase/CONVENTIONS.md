# Coding Conventions

**Analysis Date:** 2026-01-31

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension: `CompetitionFilter.tsx`, `CompetitionBadge.tsx`
- Utilities/helpers: camelCase with `.ts` extension: `api-client.ts`, `error-sanitizer.ts`, `circuit-breaker.ts`
- Routes: lowercase with `.ts` extension: `route.ts` (for Next.js API and app router)
- Schemas/types: camelCase descriptive names: `getMatchesQuerySchema`, `validateEnvironment`

**Functions:**
- Async functions use verb-first naming: `getRequiredEnv()`, `validateEnvironment()`, `sanitizeError()`, `createErrorResponse()`, `calculateBackoffDelay()`
- Handler functions use prefix pattern: `handleCORSPreflight()`, `handleRateLimit()`
- Utility functions are descriptive: `getRateLimitKey()`, `createRateLimitHeaders()`
- Boolean-returning functions use `is`, `can`, `should` prefixes: `canAffordPrediction()`, `shouldSkipProvider()`, `isAllowedOrigin()`
- Exported constants use UPPER_SNAKE_CASE: `DEFAULT_RETRY_CONFIG`, `SYSTEM_PROMPT`, `ENV_VARS`

**Variables:**
- Local variables and parameters use camelCase: `searchParams`, `validatedQuery`, `rateLimitKey`, `errorMessage`
- Component props follow interface naming: `CompetitionFilterProps`, `CompetitionBadgeProps`
- Database objects use descriptive camelCase: `modelUsage`, `timeoutRef`, `lastError`

**Types:**
- Interfaces use PascalCase with `Props` suffix for component props: `CompetitionFilterProps`, `CompetitionBadgeProps`
- Type aliases use PascalCase for domain concepts: `BudgetStatus`, `LeaderboardEntry`, `LLMPredictionResult`
- Enum schemas use camelCase: `matchTypeSchema`, `betStatusSchema`, `queueNameSchema`
- Response types use clear pattern: `ValidationErrorResponse`, `APIFootballResponse`, `APIFootballPredictionResponse`

## Code Style

**Formatting:**
- No Prettier config present; relies on ESLint formatting only
- ESLint configured through `eslint.config.mjs` using Next.js presets (`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`)
- 2-space indentation (implicit in Next.js projects)
- Semicolons required at end of statements

**Linting:**
- ESLint v9 with Next.js core web vitals configuration
- Config location: `/Users/pieterbos/Documents/bettingsoccer/eslint.config.mjs`
- Default ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Enforces TypeScript strict mode rules

## Import Organization

**Order:**
1. External libraries: `import { ... } from 'next/...'`, `import { z } from 'zod'`, etc.
2. Internal utilities: `import { ... } from '@/lib/...'`
3. Component imports: `import { ... } from '@/components/...'`
4. Type imports: `import type { ... }` (when used)

**Path Aliases:**
- `@/*` resolves to `./src/*` (defined in `tsconfig.json`)
- Always use absolute alias paths, never relative paths
- Example: `import { getDb } from '@/lib/db'` not `import { getDb } from '../../../lib/db'`

**Pattern:**
```typescript
// External first
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// Internal utilities
import { getDb } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';

// Components/UI
import { CompetitionFilter } from '@/components/competition-filter';
import { Select } from '@/components/ui/select';
```

## Error Handling

**Patterns:**
- Wrap external API calls in try-catch with explicit error type checks
- Always distinguish between `Error` instances and generic errors:
  ```typescript
  const errorMessage = error instanceof Error ? error.message : String(error);
  ```
- Use `sanitizeError()` utility for API responses to prevent information disclosure
- Log full errors internally, return generic messages in production
- Custom error classes for circuit breaking: `CircuitOpenError`
- Validation errors use Zod's `ZodError` with structured field-level details

**Error Response Format:**
```typescript
// Standard error response
{ success: false, error: sanitizeError(error, context) }

// Validation error response
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [{ field: 'fieldName', message: 'error message' }]
  }
}
```

**Retry Logic:**
- Exponential backoff with jitter: `calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)`
- Default: 3 retries, 1s base delay, 10s max delay
- Retryable status codes: 408, 429, 500, 502, 503, 504
- Circuit breaker pattern for rate limiting with configurable reset timeout

## Logging

**Framework:** Pino v10 with `pino-pretty` transport in development

**Pattern:**
- Create module-scoped loggers: `loggers.moduleName.level(data, 'message')`
- Modules available: `instrumentation`, `api`, `envValidation`, `worker`, `queue`
- Development: pretty-printed with colors and readable timestamps
- Production: compact JSON format with ISO timestamps

**Configuration:**
- Base context added to all logs: `env`, `service: 'bettingsoccer'`
- Child loggers include context: `module`, `jobId`, `matchId`, `modelId`, `requestId`
- Log levels available: `debug`, `info`, `warn`, `error`, `fatal`
- ISO timestamps: `YYYY-MM-DDTHH:mm:ss.sssZ`

**Usage Examples:**
```typescript
// Simple message
loggers.api.info('Request successful');

// With context
loggers.queue.error({ jobId: '123', error: 'Failed' }, 'Job failed');

// With metrics
loggers.instrumentation.info(
  { workerCount: 5, duration: 234 },
  'Workers started'
);
```

## Comments

**When to Comment:**
- JSDoc comments for public APIs, exported functions, and complex logic
- Block comments (`/** */`) for module/function documentation
- Inline comments (`//`) for non-obvious logic or important notes
- No comments stating the obvious (e.g., `// increment counter` above `counter++`)

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Function description in one line
 *
 * More detailed explanation if needed.
 *
 * @param paramName - Description
 * @returns Description of return value
 */
export function functionName(paramName: string): string {
  // implementation
}
```

## Function Design

**Size:** Functions typically 10-50 lines; utility helpers can be 2-5 lines. Complex logic is extracted into separate utility functions.

**Parameters:**
- Use named parameters for functions with >2 arguments
- Prefer objects with typed properties over multiple params: `{ data, context, options }`
- Default values specified in function signature: `export function getDailyBudget(): number`

**Return Values:**
- Async functions return `Promise<T>` or `Promise<{ data: T; error: null } | { data: null; error: Error }>`
- Validation functions return discriminated unions for error handling
- Database queries return typed arrays with proper null handling
- API responses use `NextResponse.json()` with typed payloads

## Module Design

**Exports:**
- Named exports for functions and types: `export function validateEnvironment()`
- Default exports only for main entry points (rare)
- Type exports use `export type`: `export type BudgetStatus = { ... }`
- Barrel files aggregate related exports: `export { ... } from './submodule'`

**Barrel Files:**
- Located in index.ts files for module organization
- Example: `src/lib/logger/modules.ts` re-exports specific loggers
- Used for cleaner import paths: `import { loggers } from '@/lib/logger/modules'`

**Module Structure Pattern:**
```
src/lib/moduleName/
├── index.ts           (barrel file with main exports)
├── core.ts            (primary implementation)
├── schema.ts          (types/interfaces)
├── utils.ts           (helper functions)
└── constants.ts       (config constants)
```

## TypeScript Configuration

**Strict Mode:** Enabled
- `strict: true` in `tsconfig.json`
- Requires explicit types on function parameters and returns
- Null/undefined safety enforced

**Target:** ES2017
- Use modern async/await syntax
- Template literals and spread operator available
- No class property decorators (kept in stage-2)

**Module Resolution:** `bundler`
- Supports Next.js 16+ bundling
- Path aliases required for non-relative imports

## Validation

**Framework:** Zod v4 for runtime validation

**Pattern:**
```typescript
// Define schema
export const getUserSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
});

export type GetUserParams = z.infer<typeof getUserSchema>;

// Use in API
const { data, error } = validateParams(getUserSchema, params);
if (error) return error;

// data is now correctly typed
```

**Common Patterns:**
- Reusable base schemas: `uuidSchema`, `paginationSchema`, `booleanStringSchema`
- Enum schemas for query parameters: `matchTypeSchema`, `betStatusSchema`
- Transform functions for type coercion: `z.coerce.number()`, `.transform(v => v === 'true')`
- Optional fields with defaults: `field.optional().default(value)`

---

*Convention analysis: 2026-01-31*
