# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

### Files

**General Rule:** Use kebab-case for all filenames.

| Element | Convention | Example |
|---------|------------|---------|
| Component files | kebab-case | `match-card.tsx`, `leaderboard-table.tsx` |
| Utility files | kebab-case | `api-client.ts`, `retry-helpers.ts` |
| API route files | kebab-case (for dynamic) | `matches/route.ts`, `matches/[id]/route.ts` |
| Configuration files | kebab-case | `eslint.config.mjs` |

**Exceptions:**
- Dynamic route parameters use bracket notation: `[id]/route.ts`
- Optional catch-all routes use double brackets: `[[...path]]/route.ts`

### Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages and API routes |
| `src/components/` | React components |
| `src/components/ui/` | shadcn/ui base components |
| `src/lib/` | Core library code (DB, API clients, utilities) |
| `src/lib/db/` | Database schema and queries |
| `src/lib/football/` | API-Football integration |
| `src/lib/llm/` | LLM provider abstraction |
| `src/lib/queue/` | BullMQ queue setup and workers |
| `src/lib/cache/` | Redis caching layer |
| `src/lib/validation/` | Zod validation schemas |
| `src/lib/logger/` | Pino logging utilities |
| `src/types/` | TypeScript type definitions |

### Functions

**Convention:** camelCase for all functions.

```typescript
// Helper functions
function getUpcomingMatches(hoursAhead: number = 48) { }

// Database query functions
export async function upsertMatch(data: NewMatch) { }

// Utility functions
export function sanitizeError(error: unknown, context?: string): string { }
```

### Constants

**Convention:** UPPER_SNAKE_CASE for constants, camelCase for object keys.

```typescript
// Module-level constants
const LEGACY_STARTING_BALANCE = 1000;

// Environment-based constants
const CACHE_TTL = {
  COMPETITIONS: 3600,
  MODELS: 1800,
  STATS: 300,
} as const;

// Object properties (camelCase)
const rateLimitResult = {
  allowed: true,
  resetAt: 1234567890,
  limit: 60,
};
```

### Types/Interfaces

**Convention:** PascalCase for all types and interfaces.

```typescript
// Database types (inferred from schema)
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

// Custom types
export interface MatchWithPredictions {
  id: string;
  competitionId: string;
  homeTeam: string;
  awayTeam: string;
  predictions: PredictionWithModel[];
}

// Type exports
export type { Competition, NewCompetition } from '@/lib/db/schema';
```

### Database Tables/Columns

**Convention:** camelCase for all table and column names.

```typescript
// Table names (singular)
export const matches = pgTable('matches', { ... });

// Column names
homeScore: integer('home_score'),
awayScore: integer('away_score'),
kickoffTime: text('kickoff_time'),

// Type exports
export type Match = typeof matches.$inferSelect;
```

---

## Import Organization

**Order (with blank lines between groups):**

```typescript
// 1. External packages - React/Next.js
import { Suspense } from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';

// 2. External packages - other
import pino from 'pino';
import { format, parseISO, isAfter } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/nextjs';

// 3. Internal imports using @/ alias
import { getDb, matches, models, competitions } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';

// 4. Type-only imports (after implementation imports)
import type { Match, Model } from '@/lib/db/schema';
import type { ScoringBreakdown } from '@/types';
```

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Use `@/lib/` for library imports
- Use `@/components/` for component imports
- Use `@/types/` for type imports

---

## Code Style

### TypeScript

**Configuration:** `tsconfig.json`
- `strict: true` - Full strict mode enabled
- `noImplicitAny: true` - No implicit `any`
- `jsx: react-jsx` - React JSX support
- `moduleResolution: "bundler"` - Bundler resolution

**Patterns:**
- Use `$inferSelect` and `$inferInsert` for DB types
- Explicit return types on exported functions
- No implicit `any` (strict mode enforces this)
- Use discriminated unions for status values

```typescript
// DB schema type exports
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

// Status type discriminated union
type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

// Explicit return types
export async function getMatchById(id: string): Promise<Match | undefined> { }
```

### Linting

**Configuration:** `eslint.config.mjs`

Uses `eslint-config-next` with TypeScript support:
- `nextVitals` - Next.js performance rules
- `nextTs` - TypeScript-specific rules

**Ignored directories:**
```
.next/**, out/**, build/**, next-env.d.ts
```

**Run linting:**
```bash
npm run lint
```

### Formatting

**Tool:** Not explicitly configured (Prettier not detected)

**Code style observed:**
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- Semicolons at end of statements
- Aligned object properties

---

## React Component Patterns

### Server Components

**Default:** All page components are async Server Components.

```typescript
// src/app/matches/page.tsx
async function LiveMatchesList() {
  const matches = await getLiveMatches();
  return <div>{/* render */}</div>;
}

export default function MatchesPage() {
  return (
    <div>
      <Suspense fallback={<LoadingSkeleton />}>
        <LiveMatchesList />
      </Suspense>
    </div>
  );
}
```

**Rules:**
- Mark `'use client'` only when using hooks or event handlers
- Use `Suspense` with `fallback` for all async data
- Async components for data fetching

### Client Components

**When to use `'use client'`:**
- Using React hooks (`useState`, `useEffect`, `useContext`)
- Event handlers (`onClick`, `onSubmit`)
- Browser-only APIs

```typescript
// src/components/match-card.tsx
'use client';

import { useEffect, useState } from 'react';

export function MatchCard({ match }: MatchCardProps) {
  const [showGoalAnimation, setShowGoalAnimation] = useState(false);

  useEffect(() => {
    // Client-side logic
  }, [match.homeScore]);

  return <div onClick={() => handleClick()}>{/* render */}</div>;
}
```

### Component Props

```typescript
interface MatchCardProps {
  match: {
    id: string;
    slug?: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffTime: string;
    status: string;
    competition: {
      id: string;
      name: string;
    };
  };
  analysis?: { /* optional */ } | null;
  showPredictions?: boolean;  // Optional with default
  predictions?: Array<{ /* ... */ }>;  // Optional empty array default
}
```

### Loading States

```typescript
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl bg-card/50 p-4">
              <Skeleton className="h-4 w-32 mb-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Error Handling

### API Routes

```typescript
// src/app/api/matches/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const { data: validatedQuery, error: validationError } = validateQuery(
      getMatchesQuerySchema,
      queryParams
    );
    if (validationError) {
      return validationError;
    }
    
    const matches = await getRecentMatches(validatedQuery.limit);
    return NextResponse.json({ success: true, matches });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'matches') },
      { status: 500 }
    );
  }
}
```

### Error Sanitization

```typescript
// src/lib/utils/error-sanitizer.ts
export function sanitizeError(error: unknown, context?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Always log full error internally
  if (context) {
    loggers.api.error({ error: errorMessage, context }, 'API error occurred');
  }
  
  // In production, never expose internal details
  if (process.env.NODE_ENV === 'production') {
    return 'An internal error occurred';
  }
  
  // In development, return actual error for debugging
  return errorMessage;
}
```

### Global Error Boundary

```typescript
// src/app/error.tsx
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: 'error',
      tags: { error_boundary: 'app_error' },
    });
  }, [error]);

  return (
    <div className="text-center">
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Rate Limiting

```typescript
// src/app/api/matches/route.ts
const rateLimitKey = getRateLimitKey(request);
const rateLimitResult = await checkRateLimit(`matches:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);

if (!rateLimitResult.allowed) {
  const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded.' },
    {
      status: 429,
      headers: {
        ...createRateLimitHeaders(rateLimitResult),
        'Retry-After': String(retryAfter),
      },
    }
  );
}
```

---

## Logging

### Pino Structured Logging

**Configuration:** `src/lib/logger/index.ts`

### Pre-configured Module Loggers

```typescript
// src/lib/logger/modules.ts
export const loggers = {
  // Queue system
  queue: createLogger('queue'),
  scheduler: createLogger('scheduler'),
  workers: createLogger('workers'),
  
  // Individual workers
  fixturesWorker: createLogger('worker:fixtures'),
  predictionsWorker: createLogger('worker:predictions'),
  
  // Infrastructure
  db: createLogger('db'),
  cache: createLogger('cache'),
  api: createLogger('api'),
  
  // App
  content: createLogger('content'),
  llm: createLogger('llm'),
  betting: createLogger('betting'),
};
```

### Usage Patterns

**Basic logging:**
```typescript
log.info({ matchId, modelId }, 'Generating predictions');
log.warn({ matchId, reason }, 'Skipping match');
log.error({ matchId, err: error }, 'Failed to process');
```

**Job-scoped logger:**
```typescript
import { createJobLogger } from '@/lib/logger/modules';

const jobLogger = createJobLogger(baseLogger, job.id, job.name, { matchId });
jobLogger.info('Starting job');
```

**Request-scoped logger:**
```typescript
import { createRequestLogger } from '@/lib/logger/modules';

const reqLogger = createRequestLogger(requestId, method, path);
reqLogger.info({ queryParams }, 'Request started');
```

### Logging Database Errors

```typescript
// src/lib/db/queries.ts
function logQueryError(operation: string, error: any, context?: Record<string, any>) {
  loggers.db.error({
    operation,
    message: error.message,
    code: error.code,
    severity: error.severity,
    detail: error.detail,
    hint: error.hint,
    constraint: error.constraint,
    ...context,
  }, 'Database query error');
}
```

---

## Database Patterns

### Drizzle ORM

**Schema:** `src/lib/db/schema.ts`

**Pattern:** Define tables, export types, import in queries.

```typescript
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const matches = pgTable('matches', {
  id: text('id').primaryKey(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  // ...
}, (table) => [
  index('idx_matches_competition_id').on(table.competitionId),
  index('idx_matches_status').on(table.status),
]);
```

### Database Instance

**Pattern:** Lazy initialization with singleton.

```typescript
// src/lib/db/index.ts
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}
```

### Query Patterns

**Basic queries:**
```typescript
export async function getMatchById(id: string) {
  const db = getDb();
  return db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);
}
```

**Joins:**
```typescript
export async function getRecentMatches(limit: number = 20) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}
```

**Transactions:**
```typescript
return db.transaction(async (tx) => {
  // LOCK ORDER: bets -> modelBalances
  await tx.insert(bets).values(betsData);
  await tx
    .update(modelBalances)
    .set({ currentBalance: sql`${modelBalances.currentBalance} - ${totalStake}` })
    .where(and(...));
});
```

**Atomic updates:**
```typescript
await db
  .update(models)
  .set({
    consecutiveFailures: sql`COALESCE(${models.consecutiveFailures}, 0) + 1`,
    autoDisabled: sql`CASE WHEN ... THEN TRUE ELSE ... END`,
  })
  .where(eq(models.id, modelId));
```

### Caching

**Pattern:** Redis caching with automatic fallback.

```typescript
// src/lib/db/queries.ts
export async function getActiveCompetitions(): Promise<Competition[]> {
  return withCache(
    cacheKeys.activeCompetitions(),
    CACHE_TTL.COMPETITIONS,
    async () => {
      const db = getDb();
      return db.select().from(competitions).where(eq(competitions.active, true));
    }
  );
}
```

---

## API Route Patterns

### Route Structure

```
src/app/api/
├── health/route.ts          # GET /api/health
├── matches/
│   ├── route.ts             # GET /api/matches
│   └── [id]/route.ts        # GET /api/matches/:id
├── admin/
│   ├── queue-status/route.ts
│   ├── dlq/route.ts
│   └── queues/
│       └── [[...path]]/route.ts
└── cron/
    └── generate-content/route.ts
```

### Basic GET Route

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
```

### Full GET Route with Validation

```typescript
// src/app/api/matches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateQuery } from '@/lib/validation/middleware';
import { getMatchesQuerySchema } from '@/lib/validation/schemas';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders } from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

export async function GET(request: NextRequest) {
  // 1. Rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`matches:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded.' },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    // 2. Validate query params
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const { data: validatedQuery, error: validationError } = validateQuery(
      getMatchesQuerySchema,
      queryParams
    );
    if (validationError) {
      return validationError;
    }

    // 3. Process data
    const matches = await getRecentMatches(validatedQuery.limit);

    // 4. Format response
    const formattedMatches = matches.map(({ match, competition }) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      competition: { id: competition.id, name: competition.name },
    }));

    return NextResponse.json(
      { success: true, matches: formattedMatches },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'matches') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
```

### Response Format

**Success response:**
```typescript
return NextResponse.json(
  { success: true, data: {...}, count: n },
  { status: 200, headers: {...} }
);
```

**Error response:**
```typescript
return NextResponse.json(
  { success: false, error: 'User-friendly message' },
  { status: 400 | 404 | 429 | 500 }
);
```

---

## Validation

### Zod Schemas

**Location:** `src/lib/validation/schemas.ts`

**Pattern:** Define schemas, export inferred types.

```typescript
import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getMatchesQuerySchema = z.object({
  type: z.enum(['upcoming', 'recent', 'finished']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetMatchesQuery = z.infer<typeof getMatchesQuerySchema>;
```

### Validation Middleware

```typescript
// src/lib/validation/middleware.ts
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: Record<string, string | string[] | undefined>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const data = schema.parse(searchParams);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    return {
      data: null,
      error: NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid params' } },
        { status: 400 }
      ),
    };
  }
}
```

---

## BullMQ Queue Workers

### Worker Pattern

```typescript
// src/lib/queue/workers/predictions.worker.ts
export function createPredictionsWorker() {
  return new Worker<PredictMatchPayload>(
    QUEUE_NAMES.PREDICTIONS,
    async (job: Job<PredictMatchPayload>) => {
      const { matchId } = job.data;
      const log = loggers.predictionsWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Generating predictions for match ${matchId}`);
      
      try {
        // Processing logic
        const result = await processPredictions(matchId);
        log.info({ successCount: result.successCount }, 'Complete');
        return result;
        
      } catch (error: any) {
        log.error({ matchId, err: error }, 'Error processing predictions');
        
        Sentry.captureException(error, {
          level: 'error',
          tags: { worker: 'predictions', matchId },
        });
        
        // Retry only transient errors
        if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
          throw new Error(`Retryable error: ${error.message}`);
        }
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  );
}
```

---

## Utility Patterns

### Retry Helpers

```typescript
// src/lib/utils/retry-helpers.ts
export async function getMatchWithRetry(
  matchId: string,
  maxRetries: number = 3,
  delayMs: number = 2000,
  logger?: pino.Logger
): Promise<Match | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const match = await getMatchById(matchId);
    if (match) return match;
    
    if (attempt < maxRetries) {
      logger?.warn({ matchId, attempt, maxRetries }, 'Match not found, retrying...');
      await sleep(delayMs);
    }
  }
  return null;
}
```

### Rate Limiter

```typescript
// src/lib/utils/rate-limiter.ts
export async function checkRateLimit(
  key: string,
  preset: RateLimitPreset
): Promise<RateLimitResult> {
  // Implementation
}

export function getRateLimitKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  return ip;
}
```

### Circuit Breaker

```typescript
// src/lib/utils/circuit-breaker.ts
// Pattern: Prevent cascading failures by failing fast
```

---

## CSS/Tailwind Patterns

### Class Merging

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  isActive && "active-class"
)} />
```

### Component Variants

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

---

*Convention analysis: 2026-01-27*
