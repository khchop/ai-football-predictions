/**
 * Response builder utilities for stats API endpoints
 * Provides consistent response formatting with caching support
 */

import type { StatsResponse, PaginationMeta, StatsFilters } from './types';
import { getStatsCache, setStatsCache, getStatsTTL } from './cache';

/**
 * Create stats response (cached or fresh)
 * Checks cache first, falls back to provided data, and caches the result
 */
export async function createStatsResponse<T>(
  data: T,
  cacheKey: string,
  filters: StatsFilters = {}
): Promise<StatsResponse<T>> {
  // Check cache first
  const cached = await getStatsCache<T>(cacheKey);
  if (cached) {
    return {
      data: cached,
      meta: {
        generatedAt: new Date().toISOString(),
        cached: true,
        cacheKey,
        filters,
      },
    };
  }

  // Cache miss - use provided data and cache it
  const ttl = getStatsTTL(filters);
  await setStatsCache(cacheKey, data, ttl);

  return {
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      cached: false,
      cacheKey,
      filters,
    },
  };
}

/**
 * Create paginated stats response
 * Wraps response with pagination metadata
 */
export async function createPaginatedResponse<T>(
  data: T[],
  cacheKey: string,
  filters: StatsFilters & { limit: number },
  totalCount: number,
  hasMore: boolean
): Promise<StatsResponse<T[]>> {
  // Get base response (with caching)
  const baseResponse = await createStatsResponse(data, cacheKey, filters);

  // Add pagination metadata
  const pagination: PaginationMeta = {
    totalCount,
    hasMore,
    limit: filters.limit,
    nextCursor: hasMore && data.length > 0 ? encodeCursor(data[data.length - 1]) : undefined,
  };

  return {
    ...baseResponse,
    meta: {
      ...baseResponse.meta,
      pagination,
    },
  };
}

/**
 * Encode cursor from last item
 * Simple base64 encoding of item ID for pagination
 */
function encodeCursor(item: any): string {
  // Extract modelId or other relevant identifier
  const identifier = item.modelId || item.id || item.rank;
  return Buffer.from(JSON.stringify({ id: identifier })).toString('base64');
}

/**
 * Decode cursor to extract identifier
 * Returns null if cursor is invalid
 */
export function decodeCursor(cursor: string): { id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
