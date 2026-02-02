# Quick Task 007: Summary

## Fix toFixed undefined error

**Date:** 2026-02-02
**Duration:** Quick fix

## Problem

Production logs showed:
```
TypeError: Cannot read properties of undefined (reading 'toFixed')
```

The error occurred in `src/components/match/roundup-viewer.tsx:263` when `stats.xG` was undefined.

## Root Cause

The `RoundupViewer` component assumed all stats fields would always have values. When API-Football returns incomplete match statistics (missing xG, possession, etc.), the component crashed on render.

## Solution

1. Updated the `Stats` interface to mark all fields as optional (`number | undefined`)
2. Added nullish coalescing (`??`) for all stats values, displaying `-` when unavailable
3. Used optional chaining (`?.`) for `xG.toFixed(2)` call

## Files Changed

- `src/components/match/roundup-viewer.tsx`
  - Lines 35-42: Made Stats interface fields optional
  - Lines 236-265: Added defensive guards for stats rendering

## Verification

- Build passes (`npm run build`)
- No type errors in production code
- Missing stats now display as `-` instead of crashing

## Impact

Fixes SSR crashes for matches with incomplete statistics data. This was causing 108 failed content-queue jobs and 43 failed settlement-queue jobs.
