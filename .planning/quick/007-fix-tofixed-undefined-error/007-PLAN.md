# Quick Task 007: Fix toFixed undefined error

## Context

Production logs show:
```
TypeError: Cannot read properties of undefined (reading 'toFixed')
at m (.next/server/chunks/ssr/_34e46371._.js:2:19009)
```

Error occurs after fetching fixture events from API-Football. The issue is in `roundup-viewer.tsx:263` where `stats.xG.toFixed(2)` is called without checking if `xG` exists.

## Root Cause

The `RoundupViewer` component assumes all stats fields are defined, but match data from the API can have missing/null values for:
- `possession`
- `shots`
- `shotsOnTarget`
- `corners`
- `xG`

## Tasks

### Task 1: Add defensive guards for stats rendering

**File:** `src/components/match/roundup-viewer.tsx`

**Changes:**
1. Add null/undefined guards for all stats values in the Stats Grid section
2. Use optional chaining and nullish coalescing for safe rendering
3. Display "N/A" or "0" when stats are missing

## Success Criteria

- [ ] `stats.xG?.toFixed(2)` or fallback value used
- [ ] Other stats fields also guarded
- [ ] No runtime errors when stats are incomplete
