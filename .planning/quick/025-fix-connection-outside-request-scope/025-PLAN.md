# Quick Task 025: Fix `connection()` called outside request scope

## Problem

Next.js `connection()` from `next/server` is called in `withCache()` (redis.ts:490) and `getUpcomingMatches()` (queries.ts:130). When BullMQ workers call these functions, there's no HTTP request context, so `connection()` throws:

```
Error: `connection` was called outside a request scope
```

This breaks ALL analysis jobs — predictions, injuries, and odds fetching all fail.

## Root Cause

`connection()` is a Next.js PPR (Partial Pre-Rendering) API that signals "this needs request-time data". It's only valid inside request handlers (API routes, page renders), not background workers.

## Fix

Make `connection()` calls safe for non-request contexts by wrapping in try-catch. Create a helper `safeConnection()` that silently ignores the error when called outside request scope.

## Tasks

### Task 1: Create safeConnection helper and fix both call sites

**Files:**
- `src/lib/cache/redis.ts` — Replace `connection()` with `safeConnection()`
- `src/lib/db/queries.ts` — Replace `connection()` with `safeConnection()`

**Approach:**
- In `redis.ts`: Create a `safeConnection()` wrapper that try-catches `connection()`, then use it at line 490
- In `queries.ts`: Import and use `safeConnection()` from redis.ts (or duplicate the wrapper inline)

**Verification:**
- `npx next build --webpack` passes
- No import of `connection` remains outside the safe wrapper
