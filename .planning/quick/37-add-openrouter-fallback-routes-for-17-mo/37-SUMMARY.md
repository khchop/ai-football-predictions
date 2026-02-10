---
phase: quick-37
plan: 01
subsystem: llm
tags: [openrouter, fallback-routing, provider-configuration]

# Dependency graph
requires:
  - phase: quick-64
    provides: Universal OpenRouter fallback coverage infrastructure (22 initial routes)
provides:
  - 13 new OpenRouter fallback provider instances
  - 13 new fallback routes in MODEL_PROVIDER_ROUTES
  - Total 35 OpenRouter providers with fallback coverage
  - Together AI -> OpenRouter fallbacks: 25 models (16 -> 25)
  - Synthetic -> OpenRouter fallbacks: 10 models (6 -> 10)
affects: [fallback-routing, provider-reliability, model-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns: [openrouter-fallback-pattern, special-prompt-configs-for-thinking-models, special-prompt-configs-for-json-models]

key-files:
  created: []
  modified:
    - src/lib/llm/providers/openrouter.ts
    - src/lib/llm/index.ts

key-decisions:
  - "qwen3-235b-thinking-or uses THINKING_STRIPPED + STRIP_THINKING_TAGS to match primary provider behavior"
  - "gpt-oss-120b-or uses JSON_STRICT + EXTRACT_JSON to match primary provider behavior"
  - "All 9 Together AI fallback routes follow primary-fallback naming convention (-or suffix)"
  - "All 4 Synthetic fallback routes follow primary-fallback naming convention (-or suffix)"

patterns-established:
  - "OpenRouter fallback providers mirror primary provider's special prompt configurations (thinking models, JSON models)"
  - "Batch additions documented with batch number and date in comments"
  - "OPENROUTER_PROVIDERS array organized by batches with clear comments"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Quick Task 37: Add OpenRouter Fallback Routes for 17 Models Summary

**35 OpenRouter fallback routes established (22 existing + 13 new) covering 35 of 39 production models - only 4 models remain without OR fallbacks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T19:22:00Z
- **Completed:** 2026-02-10T19:23:02Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added 13 new OpenRouter provider instances verified on OpenRouter API
- Configured 9 Together AI models with OpenRouter fallbacks (deepseek-v3.1, kimi-k2-0905, kimi-k2-instruct, gpt-oss-20b, mistral-small-3-24b, mistral-7b-v0.2, mistral-7b-v0.3, nemotron-nano-9b-v2, gemma-3n-e4b)
- Configured 4 Synthetic models with OpenRouter fallbacks (qwen3-235b-thinking, deepseek-v3-0324, deepseek-v3.1-terminus, gpt-oss-120b)
- Special configurations: qwen3-235b-thinking uses THINKING_STRIPPED + STRIP_THINKING_TAGS, gpt-oss-120b uses JSON_STRICT + EXTRACT_JSON
- Validated all 35 routes at build time - "Provider routes validated successfully"

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 13 new OpenRouter provider instances** - `2c2ee1a` (feat)
2. **Task 2: Add 13 new routes to MODEL_PROVIDER_ROUTES** - `f66fa9c` (feat)
3. **Task 3: Build verification** - (verification only, no commit)

## Files Created/Modified
- `src/lib/llm/providers/openrouter.ts` - Added 13 new OpenRouterProvider instances with correct pricing, tiers, and special prompt configs. Updated OPENROUTER_PROVIDERS array from 22 to 35 providers. Updated count comment.
- `src/lib/llm/index.ts` - Added 13 new routes to MODEL_PROVIDER_ROUTES. Updated Together -> OpenRouter comment from 16 to 25 models. Updated Synthetic -> OpenRouter comment from 6 to 10 models.

## Decisions Made

**1. Mirror primary provider special configurations**
- qwen3-235b-thinking-or uses THINKING_STRIPPED + STRIP_THINKING_TAGS (same as qwen3-235b-thinking primary)
- gpt-oss-120b-or uses JSON_STRICT + EXTRACT_JSON (same as gpt-oss-120b primary)
- Rationale: Fallbacks must behave identically to primary providers to ensure transparent failover

**2. Batch documentation pattern**
- Organized new providers into "Batch 2" sections with date (2026-02-10)
- Rationale: Clear audit trail for incremental fallback expansion, easy to trace when providers were added

**3. Numbering sequence**
- Continued sequential numbering from 17-29 for new providers
- Rationale: Maintains clear ordering and makes it easy to count total providers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. Git index lock during Task 2 commit**
- Issue: `.git/index.lock` file existed from previous operation
- Resolution: Removed stale lock file with `rm -f .git/index.lock` and retried commit successfully
- Impact: None - commit succeeded on retry

**2. Local Turbopack build failure**
- Issue: Turbopack WASM bindings error (`turbo.createProject is not supported by the wasm bindings`)
- Resolution: Used webpack fallback build verification with `npx next build --webpack`
- Verification: Build passed, provider routes validated successfully with 35 routes
- Impact: None - webpack build confirms TypeScript correctness and route validation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Coverage status after this task:**
- Total models: 39 (29 Together + 10 Synthetic)
- Models WITH OpenRouter fallbacks: 35 (25 Together + 10 Synthetic)
- Models WITHOUT OpenRouter fallbacks: 4
  - cogito-70b (not available on OpenRouter)
  - cogito-109b-moe (not available on OpenRouter)
  - cogito-405b (not available on OpenRouter)
  - marin-8b-instruct (niche community model, not on OpenRouter)

**Fallback coverage: 89.7% (35/39 models)**

All models except the 4 Cogito/Marin models now have OpenRouter fallback routes. The fallback infrastructure is complete for maximum provider reliability.

**Blockers:** None

**Notes:**
- OpenRouter API verification completed 2026-02-10
- All 13 new model IDs verified as available on OpenRouter
- Pricing per OpenRouter API as of 2026-02-10

## Self-Check: PASSED

All files verified:
- FOUND: src/lib/llm/providers/openrouter.ts (14473 bytes, modified 2026-02-10)
- FOUND: src/lib/llm/index.ts (12358 bytes, modified 2026-02-10)

All commits verified:
- FOUND: 2c2ee1a (Task 1: Add 13 new OpenRouter provider instances)
- FOUND: f66fa9c (Task 2: Add 13 new OpenRouter fallback routes)

---
*Phase: quick-37*
*Completed: 2026-02-10*
