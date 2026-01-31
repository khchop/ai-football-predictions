# Testing Patterns

**Analysis Date:** 2026-01-31

## Test Framework

**Status:** No testing framework configured

The codebase currently has no automated testing infrastructure:
- No test runner installed (Jest, Vitest, etc.)
- No test configuration files present
- No test files in `/src` directory
- No testing dependencies in `package.json`

This is a significant technical debt area. All code is currently validated only through manual testing and linting.

## Test File Organization

**Current State:** Not applicable - no tests exist

**Recommended Pattern (for future implementation):**
- Location: Co-located with source files
- Naming: `[module].test.ts` or `[module].spec.ts`
- Structure:
  ```
  src/lib/moduleName/
  ├── core.ts
  ├── core.test.ts          (unit tests)
  └── index.ts

  src/components/
  ├── ComponentName.tsx
  ├── ComponentName.test.tsx (component tests)
  └── ...
  ```

## Mocking

**Current State:** Not applicable - no testing framework

**Patterns to consider for future implementation:**

- Mock database queries using dependency injection
- Mock external API calls (API-Football, Together AI)
- Mock logger instances for log assertion
- Mock Next.js router/navigation for component tests
- Mock Zod schemas for validation testing

## Fixtures and Factories

**Current State:** No test fixtures or factories exist

**Patterns needed for future implementation:**

Test data builders would be valuable for:
- Match data fixtures (upcoming, finished, in-progress)
- Model data with various scoring scenarios
- Prediction fixtures for leaderboard testing
- Budget/cost scenarios for financial calculations
- API response mocks for external services

Location: `src/__tests__/fixtures/` or `src/lib/__tests__/factories/`

## Code Coverage

**Requirements:** Not enforced

No coverage targets are currently set. This should be established when testing infrastructure is added.

## Test Types

**Unit Tests** (needed):
- Utility functions: `calculateBackoffDelay()`, `sanitizeError()`, `validateEnvironment()`
- Validation schemas: query validation, response validation
- Budget calculations: `getTodaySpend()`, `canAffordPrediction()`, `getRemainingBudget()`
- Scoring logic: point calculations, result determination

**Integration Tests** (needed):
- Database operations: query builders with Drizzle ORM
- Queue interactions: job scheduling, worker processing
- Cache operations: Redis warming, cache invalidation
- External API calls: API-Football data fetching with retry logic

**E2E Tests** (needed):
- API endpoint tests: `/api/matches`, `/api/leaderboard`, `/api/models/*`
- Complete match lifecycle: fetch, predict, score
- Admin operations: queue management, rescoring
- Rate limiting enforcement

## Known Issues Without Tests

**High-Risk Areas:**
- Error handling in retry logic: Untested edge cases in exponential backoff
- Budget tracking atomicity: Race conditions in `recordPredictionCost()`
- Validation edge cases: Empty strings, null values in Zod schemas
- CORS middleware: Untested origin validation and header handling
- Cache warming: No verification that frequently accessed data is cached

**API Response Consistency:**
- Inconsistent error response formats across endpoints
- Rate limit headers not tested for correct values
- Validation error details format varies

**Database Operations:**
- Drizzle ORM queries lack unit test coverage
- N+1 query problems not detected
- Transaction rollback scenarios untested

**External Integrations:**
- API-Football error responses not tested
- Circuit breaker state transitions untested
- Retry backoff timing not verified

## Current Quality Assurance Approach

**Linting:**
- ESLint v9 with Next.js rules enforces code style
- TypeScript strict mode prevents type-related bugs
- No runtime error detection

**Manual Testing:**
- Development mode (`npm run dev`) for local testing
- Production build (`npm run build`) catches some issues
- No automated regression testing

**Monitoring:**
- Sentry integration for error tracking (from `package.json`: `@sentry/nextjs`)
- Logger output for debugging
- No automated alerting for failing operations

## Structure for Adding Tests

When implementing a testing framework, follow this structure:

**Setup:**
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react
```

**Configuration File:** `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/**/*.d.ts']
    }
  }
});
```

**Test File Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateBackoffDelay } from '@/lib/utils/api-client';

describe('calculateBackoffDelay', () => {
  it('calculates exponential backoff', () => {
    const delay = calculateBackoffDelay(0, 1000, 10000);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1300); // with 30% jitter
  });
});
```

## Testing Gaps by Module

**Priority 1 (Critical):**
- `src/lib/db/` - Database operations and queries
- `src/lib/queue/` - Job scheduling and processing
- `src/lib/llm/` - LLM provider interactions and budgeting
- `src/lib/utils/` - Retry logic, error handling, validation

**Priority 2 (High):**
- `src/app/api/` - Route handlers and response formats
- `src/lib/validation/` - Request validation logic
- `src/lib/football/` - External API integration

**Priority 3 (Medium):**
- `src/components/` - React component rendering
- `src/lib/cache/` - Cache operations and warming
- `src/lib/logger/` - Logging output and formatting

## Recommended Testing Strategy

1. Start with unit tests for utility functions (lowest dependencies)
2. Add integration tests for database and queue operations
3. Implement API endpoint tests for critical routes
4. Add component tests for interactive UI elements
5. Set up E2E tests for complete workflows

Target: Achieve 70%+ coverage on critical paths before 90%+ overall.

---

*Testing analysis: 2026-01-31*
