---
phase: 61-provider-attribution
plan: 02
subsystem: observability
tags:
  - admin-dashboard
  - provider-tracking
  - observability
  - ui-enhancement
dependency_graph:
  requires:
    - phase: 61
      plan: 01
      provides: predictions.provider_used and attempted_providers columns
  provides:
    - Admin API with providerDistribution and fallbackDepth aggregates
    - FallbackMetrics UI with provider distribution and fallback chain depth
  affects:
    - phase: 61
      plan: 03
      why: Provider attribution now visible in admin dashboard for operational monitoring
tech_stack:
  added:
    - SQL GROUP BY queries on provider_used column
    - Conditional React rendering for attribution sections
  patterns:
    - Graceful degradation (sections hidden when no data)
    - Percentage bar visualization
    - Count card grid layout
key_files:
  created: []
  modified:
    - src/app/api/admin/fallback-stats/route.ts
    - src/components/admin/fallback-metrics.tsx
decisions:
  - what: Conditionally render new sections
    why: Historical data has NULL provider_used - sections should hide gracefully
    alternative: Show empty state message
    chosen: Conditional rendering is cleaner and less noisy
  - what: Use json_array_length (not jsonb_array_length)
    why: attempted_providers is TEXT column, not JSONB
    alternative: Migrate to JSONB in future phase
    chosen: TEXT with ::json cast works now, JSONB can wait
metrics:
  duration: 144s
  completed: 2026-02-08
  tasks_completed: 2
  commits: 2
  files_changed: 2
---

# Phase 61 Plan 02: Admin Dashboard Provider Stats Summary

**One-liner:** Extended admin fallback-stats API and FallbackMetrics component to show provider distribution with percentage bars and fallback chain depth counts

## What Was Built

Extended the existing admin dashboard to surface provider attribution data from Plan 01. The fallback-stats API now aggregates provider_used and attempted_providers columns, and the FallbackMetrics component renders two new visual sections showing which providers are serving predictions and how deep fallback chains are going.

**Core components:**
1. API queries for provider distribution (GROUP BY provider_used) and fallback depth (CASE analysis of used_fallback and attempted_providers)
2. FallbackStats interface extended with providerDistribution and fallbackDepth arrays
3. UI sections with percentage bars and count cards that conditionally render when data exists

## Tasks Completed

### Task 1: Extend fallback-stats API with provider distribution and fallback depth
**Commit:** 32904f9

Extended `src/app/api/admin/fallback-stats/route.ts` with two new SQL queries:

**Provider distribution query:**
- GROUP BY provider_used to count predictions per provider
- Calculate percentages of total predictions with attribution
- Order by count descending to show top providers first
- Filter IS NOT NULL to exclude historical predictions without attribution

**Fallback depth query:**
- CASE expression analyzes used_fallback and attempted_providers columns
- Depth 0: Direct (no fallback)
- Depth 1: Single fallback (used_fallback=true, no attempted_providers)
- Depth 2+: Multiple fallbacks (json_array_length(attempted_providers) - 1)
- GROUP BY depth, ORDER BY depth for consistent display

**Interface extension:**
- Added providerDistribution array (provider, count, percentage)
- Added fallbackDepth array (depth, count)
- Both arrays added to FallbackStats response

**Verification:**
- grep confirms providerDistribution and fallbackDepth in API file
- grep confirms provider_used snake_case column reference in SQL
- TypeScript compiles without errors
- `npx next build --webpack` passes

### Task 2: Add provider distribution and fallback depth UI to FallbackMetrics
**Commit:** e52add5

Extended `src/components/admin/fallback-metrics.tsx` with two new sections:

**Provider Distribution section:**
- Heading: "Provider Distribution (Today)"
- Progress bars showing provider count and percentage
- Percentage width calculated with Math.min(percentage, 100) to prevent overflow
- Uses existing card styling (text-sm, bg-muted, bg-primary)
- Conditionally rendered with && pattern when data exists

**Fallback Chain Depth section:**
- Heading: "Fallback Chain Depth"
- Grid layout (grid-cols-3) with count cards
- Labels: "Direct" for 0, "1 fallback" for 1, "N fallbacks" for 2+
- Border-top separator between sections
- Conditionally rendered when data exists

**Interface extension:**
- Updated FallbackStats interface to match API response
- Added providerDistribution and fallbackDepth arrays

**Placement:**
- Both sections placed AFTER summary badges, BEFORE fallback stats table
- Inside existing card-gradient container
- Maintain consistent spacing (mb-6) with rest of component

**Verification:**
- grep confirms providerDistribution and fallbackDepth in component file
- grep confirms section headings present
- TypeScript compiles without errors
- `npx next build --webpack` passes

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:
- [x] Admin API at `/api/admin/fallback-stats` returns providerDistribution and fallbackDepth arrays
- [x] FallbackMetrics component renders provider distribution with percentage bars
- [x] FallbackMetrics component renders fallback chain depth counts
- [x] Both new sections degrade gracefully when no attribution data exists (conditional rendering)
- [x] `npx next build --webpack` passes (full build verification)

## Self-Check

**Verification protocol:** Check modified files exist, commits are in history, and all verifications passed.

```bash
# Check API modifications
grep -q "providerDistribution" src/app/api/admin/fallback-stats/route.ts && echo "FOUND: providerDistribution in API" || echo "MISSING"
# FOUND: providerDistribution in API

grep -q "fallbackDepth" src/app/api/admin/fallback-stats/route.ts && echo "FOUND: fallbackDepth in API" || echo "MISSING"
# FOUND: fallbackDepth in API

grep -q "provider_used" src/app/api/admin/fallback-stats/route.ts && echo "FOUND: provider_used column" || echo "MISSING"
# FOUND: provider_used column

# Check component modifications
grep -q "Provider Distribution (Today)" src/components/admin/fallback-metrics.tsx && echo "FOUND: Provider Distribution UI" || echo "MISSING"
# FOUND: Provider Distribution UI

grep -q "Fallback Chain Depth" src/components/admin/fallback-metrics.tsx && echo "FOUND: Fallback Chain Depth UI" || echo "MISSING"
# FOUND: Fallback Chain Depth UI

# Check commits
git log --oneline --all | grep -q "32904f9" && echo "FOUND: 32904f9" || echo "MISSING"
# FOUND: 32904f9

git log --oneline --all | grep -q "e52add5" && echo "FOUND: e52add5" || echo "MISSING"
# FOUND: e52add5
```

## Self-Check: PASSED

All files modified, all commits in history, all verifications passed.

## Next Phase Readiness

**Phase 61 Plan 03 (Model Provider Labels):**
- ✅ Ready - provider attribution data now visible in admin dashboard
- ✅ Operators can monitor provider distribution and fallback depth
- ✅ Provides operational visibility before adding provider labels to frontend

**No blockers for next plan.**

## Production Deployment Notes

**No database migration required** - Plan 01 migration already applied.

**Verification after deploy:**
1. Visit `/admin` and scroll to Fallback Metrics card
2. Check for new sections:
   - "Provider Distribution (Today)" with provider names and percentage bars
   - "Fallback Chain Depth" with Direct/1 fallback/2+ fallbacks count cards
3. Sections should only appear after new predictions with provider_used populated
4. Historical predictions (provider_used=NULL) gracefully excluded from queries

**Expected behavior:**
- If migration applied but no new predictions yet: sections hidden (conditional rendering)
- After new predictions processed: sections appear with current provider distribution
- Provider names should match provider IDs from MODEL_PROVIDER_ROUTES (e.g., "llama-3.1-70b-together", "meta-llama/llama-3.3-70b-openrouter")
- Fallback depth should show mostly "Direct" with occasional "1 fallback" or "2 fallbacks"

**API endpoint:**
```bash
# Test API response structure
curl -H "X-Admin-Password: $ADMIN_PASSWORD" https://kroam.xyz/api/admin/fallback-stats | jq '.providerDistribution, .fallbackDepth'
```

## Duration

**Total time:** 144 seconds (2 minutes 24 seconds)

**Breakdown:**
- Planning/context load: ~20s
- Task 1 (API): ~50s
- Task 2 (UI): ~40s
- Verification/summary: ~34s
