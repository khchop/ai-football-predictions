# Phase 2 Research: Stats API + Caching

## Overview

Research for implementing Phase 2: REST API endpoints for multi-granularity stats with Redis caching layer.

## Standard Stack

**API Framework: Next.js App Router** (current stack, continue)

- Use Route Handlers in `src/app/api/` for REST endpoints
- Next.js 16 supports both Server Components and Route Handlers
- Validation with Zod (already integrated per codebase map)

**Caching: Redis** (current stack, continue)

- Redis for tiered caching with TTL
- Key pattern: `stats:{level}:{id}:{season}` or `stats:{level}:{model}:{id}:{season}`
- Cache invalidation strategies for match completion events

**Existing patterns in codebase:**
- BullMQ workers already implemented (Phase 1)
- Drizzle ORM for database queries (Phase 1 materialized views)
- Pino structured logging (already integrated)

**Recommended additional libraries:**
- `zod` for request validation (already in codebase)
- `next/cache` for route handler caching if needed
- No new libraries needed for Redis (use `ioredis` which may already be available)

## Architecture Patterns

### API Structure

```
src/app/api/stats/
├── route.ts                    # Main entry point
├── overall/
│   └── route.ts               # /api/stats/overall
├── competition/[id]/
│   └── route.ts               # /api/stats/competition/:id
├── club/[id]/
│   └── route.ts               # /api/stats/club/:id
├── leaderboard/
│   └── route.ts               # /api/stats/leaderboard
└── models/[id]/
    └── route.ts               # /api/stats/models/:id
```

### Consistent Response Structure

```typescript
// All API responses should follow this structure
interface StatsResponse<T> {
  data: T;
  meta: {
    generatedAt: string;
    cached: boolean;
    cacheKey: string;
    ttl?: number;
  };
}

// Granularity levels
type StatsLevel = 'overall' | 'competition' | 'club';

// Filter parameters
interface StatsFilters {
  season?: string;
  competition?: string;
  club?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}
```

### Cache Key Strategy

**Tiered key pattern:**
```
stats:{level}:{filters}
```

Examples:
- `stats:overall:current` - overall stats, current season
- `stats:competition:premier_league:2024-25` - Premier League 2024-25
- `stats:club:arsenal:home:2024-25` - Arsenal home matches 2024-25
- `stats:model:llama3_8b:premier_league` - Llama 3 8B in Premier League

**Model-specific keys:**
```
stats:overall:model:{modelId}:{season}
stats:competition:{competitionId}:model:{modelId}:{season}
stats:club:{clubId}:model:{modelId}:{season}:{isHome}
```

### Cache Invalidation Strategy

**On match completion (from Phase 1 worker):**

```
Match Completed
    │
    ▼
BullMQ Job: recalculate-stats (existing from Phase 1)
    │
    ├── Calculate points
    ├── Refresh materialized views
    └── INVALIDATE CACHE
            │
            ├── DELETE stats:overall:*
            ├── DELETE stats:competition:{competitionId}:*
            ├── DELETE stats:club:{homeTeamId}:*
            └── DELETE stats:club:{awayTeamId}:*
```

**Selective invalidation:**

```typescript
// src/lib/cache/stats-invalidation.ts
export async function invalidateStatsCache(match: Match) {
  const cache = getRedisCache();

  // Invalidate overall cache
  await cache.deletePattern('stats:overall:*');

  // Invalidate competition cache
  await cache.deletePattern(`stats:competition:${match.competitionId}:*`);

  // Invalidate club caches (both teams)
  await cache.deletePattern(`stats:club:${match.homeTeamId}:*`);
  await cache.deletePattern(`stats:club:${match.awayTeamId}:*`);

  // Invalidate model caches for predictions on this match
  const predictions = await getPredictionsForMatch(match.id);
  for (const pred of predictions) {
    await cache.deletePattern(`stats:overall:model:${pred.modelId}:*`);
    await cache.deletePattern(`stats:competition:model:${pred.modelId}:${match.competitionId}:*`);
  }
}
```

### Cache-Aside Pattern

```typescript
// src/lib/api/stats/overall.ts
export async function getOverallStats(filters: StatsFilters = {}) {
  const cache = getRedisCache();
  const cacheKey = buildCacheKey('overall', filters);

  // Try cache first
  const cached = await cache.get<OverallStats>(cacheKey);
  if (cached) {
    return { data: cached, meta: { cached: true, cacheKey } };
  }

  // Query materialized view
  const stats = await db.query.mv_model_stats_overall.findMany({
    where: (view, { and, eq }) => {
      // Apply filters
      return undefined; // All for overall
    },
    orderBy: (view, { desc }) => [desc(view.totalPoints)],
  });

  // Cache with TTL (1 hour for active season, 24 hours for historical)
  const ttl = filters.season === getCurrentSeason() ? 3600 : 86400;
  await cache.set(cacheKey, stats, ttl);

  return { data: stats, meta: { cached: false, cacheKey, ttl } };
}
```

## Don't Hand-Roll

**1. Redis Connection Management**

Use existing Redis connection from Phase 1 BullMQ setup. Don't create new connection logic.

**2. Cache Key Building**

Create utility functions for consistent key patterns. Reuse across all endpoints.

**3. Error Handling**

Use Next.js error handling patterns already in codebase. Don't invent new error formats.

**4. Request Validation**

Use Zod schemas (already integrated) for all query parameters and request bodies.

## Common Pitfalls

### Pitfall 1: Cache Stampede

**Problem:** Many requests hit database when cache expires simultaneously.

**Solution:** Use randomized TTL or proactive refresh:

```typescript
// Add jitter to TTL
const baseTTL = 3600;
const jitter = Math.random() * 300; // 0-5 minutes
await cache.set(key, data, baseTTL + jitter);
```

### Pitfall 2: Inconsistent Response Structures

**Problem:** Different endpoints return different structures, breaking frontend.

**Solution:** Define TypeScript interfaces and enforce:

```typescript
// src/lib/api/stats/types.ts
export interface StatsResponse<T> {
  data: T;
  meta: {
    generatedAt: string;
    cached: boolean;
    cacheKey: string;
    ttl?: number;
    filters?: StatsFilters;
  };
}

// All endpoints must return StatsResponse<T>
```

### Pitfall 3: Cache Key Explosion

**Problem:** Too many cache keys from filter combinations, exhausting memory.

**Solution:**
- Only cache common filter combinations
- Use lower TTLs for complex filters
- Consider cache size limits

### Pitfall 4: Missing Cache Headers

**Problem:** No HTTP caching headers, overloading server.

**Solution:** Add appropriate headers:

```typescript
// In route handlers
return NextResponse.json(response, {
  headers: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  },
});
```

### Pitfall 5: Race Conditions on Cache Updates

**Problem:** Two requests both miss cache, both query DB, both try to set cache.

**Solution:** Use Redis SET with NX (only set if not exists):

```typescript
await cache.setNX(key, data, ttl); // Atomic set-if-not-exists
```

## Code Examples

### Route Handler Template

```typescript
// src/app/api/stats/overall/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOverallStats } from '@/lib/api/stats/overall';
import { StatsFilters, StatsResponse } from '@/lib/api/stats/types';

const querySchema = z.object({
  season: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const filters = querySchema.parse(searchParams);

  const result = await getOverallStats(filters);

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

### Competition Stats Endpoint

```typescript
// src/app/api/stats/competition/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompetitionStats } from '@/lib/api/stats/competition';
import { StatsResponse } from '@/lib/api/stats/types';

const paramsSchema = z.object({
  id: z.string(),
});

const querySchema = z.object({
  season: z.string().optional(),
  model: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = querySchema.parse(searchParams);

  const result = await getCompetitionStats(id, {
    season: query.season,
    model: query.model,
  });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

### Club Stats Endpoint

```typescript
// src/app/api/stats/club/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClubStats } from '@/lib/api/stats/club';
import { StatsResponse } from '@/lib/api/stats/types';

const paramsSchema = z.object({
  id: z.string(),
});

const querySchema = z.object({
  season: z.string().optional(),
  isHome: z.coerce.boolean().optional(),
  model: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = querySchema.parse(searchParams);

  const result = await getClubStats(id, {
    season: query.season,
    isHome: query.isHome,
    model: query.model,
  });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

### Leaderboard Endpoint

```typescript
// src/app/api/stats/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLeaderboard } from '@/lib/api/stats/leaderboard';

const querySchema = z.object({
  metric: z.enum(['totalPoints', 'avgPoints', 'winRate']).default('totalPoints'),
  limit: z.coerce.number().min(1).max(100).default(10),
  competition: z.string().optional(),
  season: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const { metric, limit, competition, season } = querySchema.parse(searchParams);

  const leaderboard = await getLeaderboard({
    metric,
    limit,
    competitionId: competition,
    season,
  });

  return NextResponse.json({
    data: leaderboard,
    meta: {
      generatedAt: new Date().toISOString(),
      cached: false,
      filters: { competition, season },
    },
  });
}
```

### Model Stats Endpoint

```typescript
// src/app/api/stats/models/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getModelStats } from '@/lib/api/stats/model';

const paramsSchema = z.object({
  id: z.string(),
});

const querySchema = z.object({
  season: z.string().optional(),
  competition: z.string().optional(),
  club: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = querySchema.parse(searchParams);

  const stats = await getModelStats(id, {
    season: query.season,
    competitionId: query.competition,
    clubId: query.club,
  });

  return NextResponse.json({
    data: stats,
    meta: {
      generatedAt: new Date().toISOString(),
      cached: false,
      filters: query,
    },
  });
}
```

### Cache Utility

```typescript
// src/lib/cache/stats.ts
import Redis from 'ioredis';
import { getEnv } from '@/lib/validation/env';

const redis = new Redis(getEnv('REDIS_URL') || 'redis://localhost:6379');

export function buildCacheKey(level: string, filters: Record<string, any>): string {
  const parts = ['stats', level];

  if (filters.season) parts.push(filters.season);
  if (filters.competition) parts.push(`comp:${filters.competition}`);
  if (filters.club) parts.push(`club:${filters.club}`);
  if (filters.model) parts.push(`model:${filters.model}`);
  if (filters.isHome !== undefined) parts.push(filters.isHome ? 'home' : 'away');

  return parts.join(':');
}

export async function getStatsCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setStatsCache<T>(key: string, data: T, ttl: number = 3600): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(data));
}

export async function deleteStatsCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function deletePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### Integration with Phase 1 Worker

```typescript
// In src/lib/queue/workers/stats-worker.ts (existing from Phase 1)
// Add cache invalidation after points calculation

import { deletePattern } from '@/lib/cache/stats';

async function handleMatchCompleted(matchId: string) {
  const db = getDb();

  // Existing: Calculate points and refresh views
  await calculatePointsForMatch(matchId);
  await refreshStatsViews();

  // NEW: Invalidate cache
  const match = await db.query.matches.findFirst({
    where: (m, { eq }) => eq(m.id, matchId),
  });

  if (match) {
    await deletePattern(`stats:overall:*`);
    await deletePattern(`stats:competition:${match.competitionId}:*`);
    await deletePattern(`stats:club:${match.homeTeamId}:*`);
    await deletePattern(`stats:club:${match.awayTeamId}:*`);
  }
}
```

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| Next.js Route Handlers | High | Current stack, well-established |
| Redis caching | High | Pattern from Phase 1 workers |
| Cache invalidation | High | Standard cache-aside pattern |
| API structure | High | RESTful patterns |
| Performance optimization | Medium | Need to measure actual cache hit rates |

## Open Questions

1. **Cache TTL optimization:** What's the right balance between freshness and performance?
   - Suggested: 60s active season, 24h historical

2. **Model-specific caching:** Should we cache per-model data separately?
   - Yes, for leaderboard and model comparison endpoints

3. **Fallback strategy:** What happens if Redis is unavailable?
   - Query DB directly (graceful degradation)

4. **Pagination:** Should we cache paginated results?
   - Cache first page only, not offset pages

---
*Research completed: 2026-01-27*
