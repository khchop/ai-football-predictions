# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Status:** No test framework is currently configured.

The project does not have a testing framework installed or configured. This is a significant gap that should be addressed when adding new features.

---

## Current Test Coverage

### Test Files Found

**None detected.** The project contains:
- No `*.test.ts` or `*.test.tsx` files
- No `*.spec.ts` or `*.spec.tsx` files
- No `__tests__/` directories
- No `vitest.config.*` or `jest.config.*` files
- No test scripts in `package.json`

### Existing Test Infrastructure

The following could be used as reference patterns when implementing tests:
- `drizzle.config.ts` - Database configuration
- `eslint.config.mjs` - Linting configuration

---

## Recommended Testing Setup

When adding tests to this project, use the following configuration:

### Recommended Framework

**Vitest** is recommended for this Next.js 16 project:
- Native ESM support
- Compatible with Vite/Next.js
- Fast execution
- Similar API to Jest

### Installation

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/dom @testing-library/user-event
npm install -D jsdom
```

### Configuration

**`vitest.config.ts`** (create at project root):

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,  // Auto-import test utilities
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'drizzle/', '.next/', '**/*.d.ts'],
    },
  },
});
```

**`vitest.setup.ts`** (create at project root):

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation if needed
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables
vi.stubEnv('NODE_ENV', 'test');
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## Test File Organization

### Location Patterns

**Option 1: Co-located (recommended)**
```
src/
├── components/
│   ├── match-card/
│   │   ├── match-card.tsx
│   │   └── match-card.test.tsx
│   └── ui/
│       └── button.tsx
```

**Option 2: Separate `__tests__` directory**
```
src/
├── components/
│   ├── __tests__/
│   │   ├── match-card.test.tsx
│   │   └── leaderboard-table.test.tsx
│   └── match-card.tsx
```

### Naming Convention

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts` or `*.integration.test.tsx`
- E2E tests: `*.e2e.test.ts` or `*.e2e.test.tsx`

---

## Testing Patterns to Implement

### Unit Testing Database Queries

**Mock database for unit tests:**

```typescript
// src/lib/db/__tests__/queries.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUpcomingMatches } from '@/lib/db/queries';

// Mock the db module
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/lib/db';
import { matches, competitions } from '@/lib/db/schema';

describe('Database Queries', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (getDb as vi.Mock).mockReturnValue(mockDb);
  });

  it('should fetch upcoming matches', async () => {
    const mockMatches = [
      { match: { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' }, competition: { id: 'ucl', name: 'Champions League' } }
    ];
    mockDb.limit.mockResolvedValue(mockMatches);

    const result = await getUpcomingMatches(48);

    expect(result).toEqual(mockMatches);
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.innerJoin).toHaveBeenCalled();
  });
});
```

### API Route Testing

**Test API routes with request mocking:**

```typescript
// src/app/api/__tests__/matches.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/matches/route';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  getUpcomingMatches: vi.fn(),
  getRecentMatches: vi.fn(),
  getFinishedMatches: vi.fn(),
  getOverallStats: vi.fn(),
}));

vi.mock('@/lib/utils/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() / 1000 + 60, limit: 60, remaining: 60 }),
  getRateLimitKey: vi.fn().mockReturnValue('test'),
  createRateLimitHeaders: vi.fn().mockReturnValue({}),
  RATE_LIMIT_PRESETS: { api: { limit: 60, windowMs: 60000 } },
}));

import { getUpcomingMatches, getRecentMatches, getOverallStats } from '@/lib/db/queries';

describe('/api/matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return matches for upcoming type', async () => {
    const mockMatches = [{ match: { id: '1' }, competition: { id: 'ucl', name: 'UCL' } }];
    (getUpcomingMatches as vi.Mock).mockResolvedValue(mockMatches);
    (getOverallStats as vi.Mock).mockResolvedValue({ totalMatches: 100 });

    const request = new Request('http://localhost/api/matches?type=upcoming');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.matches).toEqual(mockMatches);
  });
});
```

### Component Testing

**Test React components with Testing Library:**

```typescript
// src/components/__tests__/match-card.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCard } from '@/components/match-card';

const mockMatch = {
  id: '123',
  homeTeam: 'Manchester City',
  awayTeam: 'Arsenal',
  homeScore: 2,
  awayScore: 1,
  kickoffTime: '2026-01-27T20:00:00Z',
  status: 'finished',
  competition: { id: 'epl', name: 'Premier League' },
};

describe('MatchCard', () => {
  it('should render match teams and score', () => {
    render(<MatchCard match={mockMatch} />);
    
    expect(screen.getByText('Manchester City')).toBeInTheDocument();
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should show competition name', () => {
    render(<MatchCard match={mockMatch} />);
    expect(screen.getByText('Premier League')).toBeInTheDocument();
  });

  it('should apply upset class when isUpset is true', () => {
    const upsetMatch = { ...mockMatch, isUpset: true };
    const { container } = render(<MatchCard match={upsetMatch} />);
    
    expect(container.querySelector('.bg-orange-500\\/20')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(<MatchCard match={mockMatch} />);
    
    const link = container.querySelector('a');
    fireEvent.click(link!);
    
    expect(handleClick).not.toHaveBeenCalled(); // Link navigates, not calls handler
  });
});
```

### Validation Schema Testing

**Test Zod schemas:**

```typescript
// src/lib/validation/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { getMatchesQuerySchema } from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('getMatchesQuerySchema', () => {
    it('should parse valid query params', () => {
      const result = getMatchesQuerySchema.safeParse({
        type: 'upcoming',
        limit: '20',
        offset: '0',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('upcoming');
        expect(result.data.limit).toBe(20);
      }
    });

    it('should use defaults for missing params', () => {
      const result = getMatchesQuerySchema.safeParse({});
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
        expect(result.data.type).toBeUndefined();
      }
    });

    it('should reject invalid type', () => {
      const result = getMatchesQuerySchema.safeParse({
        type: 'invalid',
      });
      
      expect(result.success).toBe(false);
    });

    it('should enforce max limit of 100', () => {
      const result = getMatchesQuerySchema.safeParse({
        limit: '500',
      });
      
      expect(result.success).toBe(false);
    });
  });
});
```

### Logger Testing

**Test logging behavior:**

```typescript
// src/lib/logger/__tests__/modules.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loggers, createJobLogger } from '@/lib/logger/modules';

describe('Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create job-scoped logger with correct context', () => {
    const mockBaseLogger = {
      child: vi.fn().mockReturnThis(),
      info: vi.fn(),
    };
    
    const jobLogger = createJobLogger(mockBaseLogger as any, 'job-123', 'predictions', { matchId: '456' });
    
    expect(mockBaseLogger.child).toHaveBeenCalledWith({
      jobId: 'job-123',
      jobName: 'predictions',
      matchId: '456',
    });
  });
});
```

---

## Mock Patterns

### Common Mocks

**Environment variables:**

```typescript
vi.mock('@/lib/env', () => ({
  ENV: {
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://test',
    NODE_ENV: 'test',
  },
}));
```

**Database:**

```typescript
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => mockDb),
  competitions: {},
  matches: {},
  models: {},
}));
```

**Redis cache:**

```typescript
vi.mock('@/lib/cache/redis', () => ({
  withCache: vi.fn((key, ttl, fn) => fn()),
  cacheDelete: vi.fn(),
  cacheKeys: {
    activeCompetitions: () => 'competitions:active',
    activeModels: () => 'models:active',
  },
}));
```

**Logger:**

```typescript
vi.mock('@/lib/logger/modules', () => ({
  loggers: {
    api: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    db: { info: vi.fn(), error: vi.fn() },
    predictionsWorker: { info: vi.fn(), error: vi.fn() },
  },
}));
```

---

## Test Utilities

### Custom Render with Providers

```typescript
// src/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

export { customRender as render };
```

### Test Data Factories

```typescript
// src/test-factories.ts
export function createMockMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: crypto.randomUUID(),
    homeTeam: 'Test Home Team',
    awayTeam: 'Test Away Team',
    homeScore: null,
    awayScore: null,
    kickoffTime: new Date().toISOString(),
    status: 'scheduled',
    competitionId: 'epl',
    ...overrides,
  };
}

export function createMockCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: 'epl',
    name: 'Premier League',
    apiFootballId: 39,
    season: 2025,
    active: true,
    slug: 'premier-league',
    ...overrides,
  };
}
```

---

## Code Coverage Expectations

### Recommended Thresholds

| Type | Recommended |
|------|-------------|
| Overall coverage | 70% |
| Functions | 80% |
| Branches | 70% |
| Lines | 70% |
| Statements | 70% |

### Generate Coverage Report

```bash
npm run test:coverage
# Output to coverage/ directory
```

### Exclude from Coverage

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        '.next/',
        'drizzle/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-utils.*',
        '**/test-factories.*',
      ],
    },
  },
});
```

---

## E2E Testing

### Recommended Setup

**Playwright** is recommended for E2E testing:

```bash
npm install -D @playwright/test
npx playwright install
```

**`playwright.config.ts`:**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// e2e/matches.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Matches Page', () => {
  test('should display matches', async ({ page }) => {
    await page.goto('/matches');
    
    await expect(page.locator('h1')).toContainText('Matches');
    
    // Check for match cards
    const matchCards = page.locator('[class*="rounded-lg"][class*="bg-card"]');
    await expect(matchCards.first()).toBeVisible();
  });

  test('should filter by competition', async ({ page }) => {
    await page.goto('/matches');
    
    // Click on competition filter
    const filterBtn = page.locator('button:has-text("Filter")');
    await filterBtn.click();
    
    // Select Premier League
    const option = page.locator('[role="option"]:has-text("Premier League")');
    await option.click();
    
    // Verify filtered results
    await expect(page).toHaveURL(/\?competition=epl/);
  });

  test('should show live matches tab', async ({ page }) => {
    await page.goto('/matches');
    
    // Click Live tab
    await page.locator('[value="live"]').click();
    
    // Check for live indicator
    const liveIndicator = page.locator('.animate-pulse:has-text("Live")');
    await expect(liveIndicator).toBeVisible();
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: npm run lint
      
      - run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test
          REDIS_URL: redis://test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Current Testing Gaps

### Critical

1. **No test framework configured** - The entire codebase lacks automated tests
2. **Database queries untested** - Critical data access layer has no tests
3. **API routes untested** - All 10+ API endpoints lack tests

### High Priority

4. **Validation schemas untested** - Zod schemas could have edge cases
5. **Component untested** - UI components lack unit tests
6. **Utility functions untested** - Helper functions lack tests

### Medium Priority

7. **No E2E tests** - Critical user flows not tested
8. **No integration tests** - Multi-component interactions untested

### Test Coverage Gaps by File

| File | Risk | Priority |
|------|------|----------|
| `src/lib/db/queries.ts` | Data corruption, incorrect queries | Critical |
| `src/lib/db/schema.ts` | Schema definition errors | High |
| `src/lib/validation/schemas.ts` | Invalid data handling | High |
| `src/app/api/matches/route.ts` | API errors, rate limiting | High |
| `src/lib/queue/workers/*.worker.ts` | Queue processing errors | High |
| `src/components/match-card.tsx` | UI rendering issues | Medium |
| `src/lib/utils/scoring.ts` | Scoring calculation errors | High |
| `src/lib/football/api-football.ts` | External API failures | Medium |

---

## Recommendations

### Immediate Actions

1. Install and configure Vitest
2. Add test script to `package.json`
3. Write tests for validation schemas (low effort, high value)
4. Write tests for utility functions

### Short-term Actions

5. Add database query tests with mocked Drizzle
6. Add API route integration tests
7. Add component tests for critical UI components

### Long-term Actions

8. Set up E2E testing with Playwright
9. Configure CI pipeline with coverage reporting
10. Target 70% overall code coverage

---

*Testing analysis: 2026-01-27*
