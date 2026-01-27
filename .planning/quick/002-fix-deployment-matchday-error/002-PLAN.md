# Quick Plan: Fix deployment failure - missing matchday property

## Problem
Deployment fails with TypeScript error:
```
Type error: Property 'matchday' is missing in type '...' but required in type '...'.
```

Location: `src/lib/queue/workers/fixtures.worker.ts:93`

The `matchday` column was added to the database schema but the match object construction is missing this property.

## Task
- [x] Add `matchday: null` to the match object in fixtures.worker.ts (column is nullable in schema)

## Changes
- `src/lib/queue/workers/fixtures.worker.ts`: Added missing `matchday: null` property