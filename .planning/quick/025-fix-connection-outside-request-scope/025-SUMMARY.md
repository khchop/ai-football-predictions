# Quick Task 025: Fix `connection()` called outside request scope

## Result: COMPLETE

## Problem

Next.js `connection()` from `next/server` was being called in:
- `src/lib/cache/redis.ts:490` — inside `withCache()`
- `src/lib/db/queries.ts:130` — inside `getUpcomingMatches()`

When BullMQ workers called these functions, there was no HTTP request context, causing `connection()` to throw. This broke ALL analysis jobs (predictions, injuries, odds fetching).

## Fix

Created `safeConnection()` wrapper in `redis.ts` that try-catches `connection()`. Outside request scope (workers), it's a silent no-op. Inside request scope (page renders), it still signals PPR correctly.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/cache/redis.ts` | Added `safeConnection()` wrapper, replaced `connection()` call |
| `src/lib/db/queries.ts` | Replaced `connection` import with `safeConnection` from redis.ts |

## Commit

`753f73d` — fix(quick-025): wrap connection() in try-catch for worker compatibility
