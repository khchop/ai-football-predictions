---
phase: 60-multi-provider-routing
plan: 01
subsystem: llm-provider-routing
tags: [provider-routing, fallback-system, multi-provider, infrastructure]
dependency_graph:
  requires: [phase-59-openrouter-provider]
  provides: [multi-provider-routing-infrastructure, provider-route-validation]
  affects: [predictions-worker, admin-fallback-stats, diagnostic-scripts]
tech_stack:
  added: []
  patterns: [ordered-provider-priority, cycle-detection, max-depth-enforcement]
key_files:
  created: []
  modified:
    - src/lib/llm/index.ts
    - src/lib/llm/providers/base.ts
    - src/app/api/admin/fallback-stats/route.ts
    - scripts/check-fallback-rate.ts
    - scripts/diagnostic/validate-coverage.ts
    - scripts/diagnostic/generate-coverage-report.ts
decisions:
  - id: ROUT-06
    decision: "Single source of truth: MODEL_FALLBACKS fully deleted, getFallbackProvider() refactored as thin wrapper over MODEL_PROVIDER_ROUTES"
    rationale: "Prevents parallel fallback systems. All routing reads from one config, reducing maintenance burden and preventing inconsistencies."
  - id: ROUT-07
    decision: "Only models with 2+ providers get entries in MODEL_PROVIDER_ROUTES (5 models initially)"
    rationale: "Keeps config lean. Single-provider models have no fallback by definition, so no entry needed. Avoids bloating config with 37 single-provider entries."
  - id: ROUT-08
    decision: "Consolidated model IDs are routing-level identifiers, not provider IDs"
    rationale: "Separation of concerns: routing layer uses logical model names (deepseek-r1), provider layer uses provider-specific IDs (deepseek-r1-0528-syn). Phase 62-64 will transition workers to consolidated IDs."
metrics:
  duration_minutes: 5.6
  tasks_completed: 3
  commits: 2
  completed_date: 2026-02-08
---

# Phase 60 Plan 01: Multi-Provider Routing Infrastructure Summary

Multi-provider routing system with 3-tier fallback chains, cycle detection, and unified MODEL_PROVIDER_ROUTES configuration replacing old MODEL_FALLBACKS.

## What Was Built

Replaced single-tier MODEL_FALLBACKS map with MODEL_PROVIDER_ROUTES system supporting ordered provider priority lists (max 3 providers per model). Enabled 3-tier fallback chains (e.g., Synthetic -> Together -> OpenRouter) while maintaining backward compatibility with existing predictions worker.

**Key infrastructure:**
- MODEL_PROVIDER_ROUTES config with 5 initial routes (deepseek-r1, kimi-k2-thinking, kimi-k2.5, qwen3-235b, llama-4-scout)
- validateProviderRoutes with cycle detection, max depth, and empty route checks
- callAPIWithMultiProviderRouting for explicit provider routing
- Extended FallbackAPIResult with providerUsed and attemptedProviders tracking
- Updated admin fallback-stats and diagnostic scripts

**Backward compatibility preserved:**
- Predictions worker still calls `callAPIWithFallback(system, user)` without providerRoute
- Single-fallback path maintained via refactored getFallbackProvider() reading from MODEL_PROVIDER_ROUTES
- Workers transition to explicit providerRoute planned for Phase 62-64

## Tasks Completed

### Task 1: Replace MODEL_FALLBACKS with MODEL_PROVIDER_ROUTES (Commit 3a9b420)

**Changes:**
- Deleted MODEL_FALLBACKS constant and validateFallbackMapping function entirely
- Added MODEL_PROVIDER_ROUTES with ordered provider arrays (5 models: 3-tier deepseek-r1, 2-tier kimi variants, 2-tier Together->OpenRouter routes)
- Added validateProviderRoutes with comprehensive checks (provider existence, cycle detection, max depth 3, no empty routes)
- Updated getProviderById to search ALL_PROVIDERS + OPENROUTER_PROVIDERS (enables multi-provider routing to find OpenRouter providers)
- Refactored getFallbackProvider() as thin wrapper over MODEL_PROVIDER_ROUTES (searches routes, returns next provider in chain — unified system, not parallel)
- Added getRouteForModel helper for route lookup by consolidated model ID
- Module load validation via `validateProviderRoutes()` call at end of index.ts

**Key architectural point:** getFallbackProvider() is NOT a separate fallback system — it's a query function over MODEL_PROVIDER_ROUTES. The old MODEL_FALLBACKS constant no longer exists.

### Task 2: Extend callAPIWithFallback with multi-provider routing (Commit 3a9b420)

**Changes:**
- Extended FallbackAPIResult interface with `providerUsed?: string` and `attemptedProviders?: string[]` for routing transparency
- Added callAPIWithMultiProviderRouting private method with:
  - Non-empty route validation (defensive against empty arrays)
  - Cycle detection (should never trigger with validated routes, but defensive)
  - Max depth 3 enforcement (loop limit)
  - Detailed logging at each fallback step
- Updated callAPIWithFallback signature to accept optional `providerRoute?: string[]`
  - When provided: uses multi-provider routing
  - When not provided: uses existing single-fallback path via getFallbackProvider() (backward compatible)
- Updated single-fallback path to populate new fields (providerUsed, attemptedProviders)

**Backward compatibility verified:** Predictions worker at `src/lib/queue/workers/predictions.worker.ts` compiles without changes (calls `callAPIWithFallback(system, user)` with 2 args, hits single-fallback path).

### Task 3: Update admin fallback-stats and scripts (Commit c7a02bb)

**Changes:**
- Updated admin fallback-stats route imports (MODEL_PROVIDER_ROUTES, OpenRouterProvider)
- Changed modelsWithFallback extraction to iterate MODEL_PROVIDER_ROUTES and collect all provider IDs
- Changed fallbackTargetId lookup to search routes for next provider in chain
- Added OpenRouterProvider to cost estimation type guard
- Updated scripts/check-fallback-rate.ts to extract fallback mappings from routes
- Updated scripts/diagnostic/validate-coverage.ts to check routes for fallback status
- Updated scripts/diagnostic/generate-coverage-report.ts to use routes for coverage

**Build verification:** `npx next build --webpack` passed successfully, confirming admin route compiles as valid Next.js API route with all imports resolved and types correct.

## Deviations from Plan

None. Plan executed exactly as written.

## Verification Results

All verification checks passed:

1. `grep -r "MODEL_FALLBACKS" src/ scripts/` → 0 results (fully removed from codebase)
2. `grep "MODEL_PROVIDER_ROUTES" src/lib/llm/index.ts` → Found (config exists and exported)
3. `grep "callAPIWithMultiProviderRouting" src/lib/llm/providers/base.ts` → Found (multi-provider routing implemented)
4. `grep "providerUsed" src/lib/llm/providers/base.ts` → Found 5 times (FallbackAPIResult extended, all paths populate fields)
5. `grep "callAPIWithFallback" src/lib/queue/workers/predictions.worker.ts` → Found 2 times (worker compiles, backward compatible)
6. `grep "MODEL_PROVIDER_ROUTES" src/app/api/admin/fallback-stats/route.ts` → Found 3 times (admin route updated)
7. `grep "getFallbackProvider" src/lib/llm/index.ts` → Found 3 times (function exists as thin wrapper over routes)
8. `npx tsc --noEmit` → Passed (ignoring unrelated drizzle-orm and test framework type errors)
9. `npx next build --webpack` → Passed (admin route compiles, all imports resolve)

## Technical Highlights

**Cycle detection:**
Multi-provider routing checks `attemptedProviders.includes(providerId)` before each attempt, breaking infinite loops. Validated routes shouldn't have cycles, but defensive check added.

**Max depth enforcement:**
Loop condition `i < providerRoute.length && i < 3` enforces hard limit of 3 providers per prediction attempt.

**Provider existence validation:**
validateProviderRoutes builds Set from ALL_PROVIDERS + OPENROUTER_PROVIDERS (conditionally), checks all route provider IDs exist. Logs warning (not error) for OpenRouter providers when API key not set.

**Unified system architecture:**
getFallbackProvider() searches MODEL_PROVIDER_ROUTES for the given provider ID, returns next in chain if found. No separate MODEL_FALLBACKS data structure exists. Single source of truth.

**Worker transition path:**
Workers currently call `callAPIWithFallback(system, user)` → hits single-fallback path → calls getFallbackProvider(this.id) → queries MODEL_PROVIDER_ROUTES → returns next provider. Phase 62-64 will change workers to look up `providerRoute = getRouteForModel(consolidatedId)` and pass as third arg → hits multi-provider path → tries all providers in route order.

## Files Modified

**Core routing infrastructure:**
- src/lib/llm/index.ts (MODEL_PROVIDER_ROUTES config, validation, getFallbackProvider refactored, getProviderById extended, getRouteForModel added)
- src/lib/llm/providers/base.ts (FallbackAPIResult extended, callAPIWithMultiProviderRouting added, callAPIWithFallback signature updated)

**Admin and diagnostics:**
- src/app/api/admin/fallback-stats/route.ts (uses MODEL_PROVIDER_ROUTES, includes OpenRouterProvider)
- scripts/check-fallback-rate.ts (extracts fallbacks from routes)
- scripts/diagnostic/validate-coverage.ts (checks routes for fallback status)
- scripts/diagnostic/generate-coverage-report.ts (uses routes for coverage metrics)

## Next Steps

**Phase 62-64 worker transition:**
Workers will query `getRouteForModel(consolidatedModelId)` and pass result as `providerRoute` to `callAPIWithFallback()`. This activates multi-tier routing for predictions. getFallbackProvider() can be deprecated once all callers transition.

**Phase 64 model re-activation:**
Use MODEL_PROVIDER_ROUTES to configure 3-tier fallback chains for 7 deprecated Together AI models (route to OpenRouter equivalents). Verify OpenRouter model IDs match during phase planning.

**Immediate operational readiness:**
System validated at module load time. Any misconfigured route (invalid provider ID, cycle, empty array, max depth exceeded) throws error on import, preventing deployment of bad config.

## Self-Check: PASSED

All claimed files and commits verified:

**Files exist:**
```bash
[ -f "src/lib/llm/index.ts" ] && echo "FOUND"
[ -f "src/lib/llm/providers/base.ts" ] && echo "FOUND"
[ -f "src/app/api/admin/fallback-stats/route.ts" ] && echo "FOUND"
[ -f "scripts/check-fallback-rate.ts" ] && echo "FOUND"
[ -f "scripts/diagnostic/validate-coverage.ts" ] && echo "FOUND"
[ -f "scripts/diagnostic/generate-coverage-report.ts" ] && echo "FOUND"
```
All files FOUND.

**Commits exist:**
```bash
git log --oneline --all | grep "3a9b420"  # Task 1-2 commit
git log --oneline --all | grep "c7a02bb"  # Task 3 commit
```
Both commits FOUND.

**Key functionality verified:**
- MODEL_FALLBACKS constant: 0 references (fully deleted)
- MODEL_PROVIDER_ROUTES constant: 21 references (used across codebase)
- callAPIWithMultiProviderRouting method: exists in base.ts
- providerUsed field: exists in FallbackAPIResult interface and populated in all code paths
- Build passes: webpack build succeeded with zero errors
