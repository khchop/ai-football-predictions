# Phase 2 Context

## Overview

Phase 2: Stats API + Caching — REST API endpoints for multi-granularity stats with Redis caching layer.

## Decisions

### Response Structure

**Decision:** All endpoints return consistent structure with metadata.

**Details:**
- Response format:
  ```typescript
  {
    data: T;           // Actual stats data
    meta: {
      generatedAt: string;  // ISO timestamp
      cached: boolean;      // Was this from cache?
      cacheKey?: string;    // Debugging aid
      filters?: StatsFilters; // Applied filters
      pagination?: {
        totalCount: number;
        hasMore: boolean;
        nextCursor?: string;
      };
    };
  }
  ```
- Error responses use same structure with `error` field
- All endpoints include pagination metadata

### Pagination

**Decision:** Cursor-based pagination for robustness with real-time data.

**Details:**
- Uses last seen `id` as cursor, not page numbers
- More robust for frequently changing data (new matches, updated scores)
- Default limit: 50 results per request
- Includes `totalCount` and `hasMore` in metadata
- API does NOT support offset-based pagination

**Rationale:** Cursor pagination handles real-time updates better than page numbers. Page numbers become invalid when data changes between requests (new match completes, pushing old results to "next page").

### Authentication

**Decision:** Stats endpoints require authentication using same mechanism as existing API routes.

**Details:**
- Bearer token authentication (same as cron endpoints)
- Rate limiting enabled to prevent abuse
- All stats endpoints: `GET /api/stats/*` require valid auth token
- No distinction between admin and read-only (all stats are read-only)

**Implementation:**
- Use existing auth pattern from codebase
- Rate limit: 100 requests per minute per token
- Public-facing pages (Phase 3) can fetch from API without auth

### Cache TTL Strategy

**Decision:** Tiered TTL based on data freshness needs.

**Details:**
- Active season: 60 seconds TTL + stale-while-revalidate (CDN caches 60s, serves stale up to 5min while revalidating)
- Historical seasons: 5 minutes TTL (data rarely changes)
- Cache-Control header: `public, s-maxage=60, stale-while-revalidate=300`
- No explicit cache size limits (monitor and adjust if needed)

**Rationale:**
- 60s TTL provides reasonable freshness (stats update within 1 hour of match completion)
- Stale-while-revalidate ensures fast responses even during cache refresh
- Historical data doesn't need frequent refresh

## Scope Boundary

**In Scope (Phase 2):**
- REST API endpoints for all granularity levels
- Consistent response structure with metadata
- Cursor-based pagination
- Redis caching with tiered TTL
- Cache invalidation on match completion
- Authentication on all endpoints
- Rate limiting

**Deferred (Future Phases):**
- Real-time WebSocket updates (poll-based for now)
- Complex filter combinations (beyond basic filters)
- Analytics/dashboard endpoints (stats-only, no aggregation)

## Technical Notes

**Endpoints:**
- `GET /api/stats/overall` — Global leaderboard
- `GET /api/stats/competition/{id}` — Competition-specific
- `GET /api/stats/club/{id}` — Club-specific
- `GET /api/stats/leaderboard` — Sortable rankings
- `GET /api/stats/models/{id}` — Model-specific stats

**Cache Key Pattern:**
```
stats:{level}:{filters}
stats:overall:current
stats:competition:{id}:{season}
stats:club:{id}:{season}:{isHome}
```

**Invalidation Strategy:**
- Match completion → invalidate overall, competition, both clubs

---
*Created: 2026-01-27 after discussion*
