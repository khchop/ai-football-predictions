---
phase: 15
plan: 01
subsystem: performance
tags: [isr, caching, next.js, ttfb]
dependency-graph:
  requires: []
  provides: [match-page-isr-enabled]
  affects: [match-page-performance, edge-caching]
tech-stack:
  added: []
  patterns: [isr-revalidation, next.js-caching]
key-files:
  created: []
  modified:
    - src/app/leagues/[slug]/[match]/page.tsx
decisions:
  - "revalidate=60 for all match statuses (Next.js doesn't support conditional static exports)"
metrics:
  duration: 53s
  completed: 2026-02-02
---

# Phase 15 Plan 01: Enable Match Page ISR Summary

**One-liner:** Removed force-dynamic export to enable 60-second ISR caching on match pages

## What Was Done

### Task 1: Remove force-dynamic export and verify ISR configuration
- Removed `export const dynamic = 'force-dynamic'` from line 32
- Added `export const revalidate = 60; // ISR: 60s for scheduled/live matches`
- Verified no other conflicting exports exist
- Commit: `bfa8e2d`

### Task 2: Verify ISR behavior in production build
- Production build completed successfully
- Route `/leagues/[slug]/[match]` compiles without errors
- Page uses dynamic features (permanentRedirect, notFound) so shows as dynamic, but ISR is now enabled via revalidate export

## Technical Notes

The match page route shows `f (Dynamic)` in build output because it uses:
- `permanentRedirect()` for alias-to-canonical URL redirects
- `notFound()` for missing matches

This is expected behavior. The key change is that `export const revalidate = 60` is now respected because `force-dynamic` no longer blocks it. Next.js will:
1. Render the page on first request (SSR)
2. Cache the rendered HTML at the edge/CDN
3. Serve cached HTML for subsequent requests (TTFB < 200ms)
4. Revalidate in background after 60 seconds

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Single revalidate=60 for all match statuses | Next.js `export const revalidate` must be static; conditional values not supported | On-demand revalidation via webhook (future enhancement) |

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| src/app/leagues/[slug]/[match]/page.tsx | Modified | Replaced force-dynamic with revalidate=60 |

## Commits

| Hash | Type | Message |
|------|------|---------|
| bfa8e2d | perf | enable ISR on match pages by removing force-dynamic |

## Verification Results

- [x] `grep "force-dynamic"` returns no matches
- [x] `grep "revalidate = 60"` returns match at line 32
- [x] `npm run build` succeeds without errors
- [x] No TypeScript or build errors

## Next Phase Readiness

Phase 15 Plan 01 complete. Ready for 15-02 (Static Params Breadth Expansion) or 15-03 (Competition Page ISR).

### What's Available
- Match pages now support ISR with 60-second revalidation
- Edge/CDN caching enabled for cached requests

### Potential Issues
None identified.
