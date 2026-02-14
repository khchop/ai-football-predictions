---
phase: quick-052
plan: 01
subsystem: llm
tags: [openrouter, model-providers, sync, llms-txt]

# Dependency graph
requires:
  - phase: quick-051
    provides: "21 active models after adding MiniMax M2.5"
provides:
  - "Exactly 21 OpenRouter providers after model swap"
  - "Archived flag fix in sync-models ensures reactivated models un-archive"
  - "Updated llms.txt content reflecting current 21-model OpenRouter architecture"
affects: [model-lifecycle, leaderboard, predictions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Model substitution without changing total count"]

key-files:
  created: []
  modified:
    - src/lib/llm/providers/openrouter.ts
    - src/lib/llm/index.ts
    - src/lib/db/sync-models.ts
    - src/app/llms-full.txt/route.ts
    - src/app/llms.txt/route.ts

key-decisions:
  - "Swapped 5 underperforming models (qwen3-235b-thinking, llama-4-maverick, cogito-671b, devstral-small, nemotron-nano-9b-v2) for 5 new models (glm-4.7, llama-3.3-70b, gpt-oss-120b, devstral-2, nemotron-3-nano-30b-a3b)"
  - "Added archived:false to sync-models .set() call to fix reactivation bug"
  - "Updated llms.txt content from 29 Together AI models to 21 OpenRouter models"

patterns-established:
  - "Model swap protocol: remove from provider definitions, array, and routes atomically"
  - "sync-models must explicitly set archived:false on upsert to handle reactivation"

# Metrics
duration: 401s (6m 41s)
completed: 2026-02-14
---

# Quick Task 052: Sync Active Models - Ensure Exactly 21 Summary

**Swapped 5 underperforming/unavailable models for 5 new models, fixed sync-models archived bug, and updated llms.txt to reflect 21 OpenRouter models**

## Performance

- **Duration:** 6 min 41 sec (401 seconds)
- **Started:** 2026-02-14T13:35:03Z
- **Completed:** 2026-02-14T13:41:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Exactly 21 OpenRouter providers active (5 removed, 5 added, 16 unchanged)
- All new providers have correct model IDs, pricing, tiers, and prompt configs
- sync-models.ts now un-archives models on reactivation (archived: false in .set())
- llms-full.txt and llms.txt reflect current 21-model OpenRouter architecture
- TypeScript compiles cleanly, production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap 5 providers in openrouter.ts and update routes in index.ts** - `30e9fe5` (feat)
2. **Task 2: Fix sync-models archived flag and update llms.txt content** - `85398f7` (feat)
3. **Task 3: Build verification and test fixture note** - `2a08b9b` (chore)

## Files Created/Modified

- `src/lib/llm/providers/openrouter.ts` - Removed 5 provider definitions, added 5 new, updated OPENROUTER_PROVIDERS array to maintain 21 total
- `src/lib/llm/index.ts` - Updated MODEL_PROVIDER_ROUTES with 5 new routes, removed 5 old routes, updated section comments
- `src/lib/db/sync-models.ts` - Added archived: false to .set() call in update branch to un-archive reactivated models
- `src/app/llms-full.txt/route.ts` - Updated model count (29→21), provider (Together AI→OpenRouter), full model list with current 21 models
- `src/app/llms.txt/route.ts` - Updated AI Models reference to OpenRouter

## Models Removed

1. **Qwen3 235B Thinking** (qwen3-235b-thinking-or) - Reasoning model with high latency
2. **Llama 4 Maverick** (llama-4-maverick-or) - Replaced by Llama 3.3 70B
3. **Cogito 671B** (cogito-671b-or) - Underperforming model
4. **Devstral Small** (devstral-small-or) - Replaced by Devstral 2
5. **Nemotron Nano 9B v2** (nemotron-nano-9b-v2-or) - Replaced by Nemotron 3 Nano 30B A3B

## Models Added

1. **GLM-4.7** (glm-4.7-or) - Premium reasoning model (Z-AI family)
   - Pricing: $0.40/$1.50 per 1M tokens
   - Config: ENGLISH_ENFORCED + EXTRACT_JSON + 120s timeout
2. **Llama 3.3 70B Instruct** (llama-3.3-70b-or) - Budget Meta model
   - Pricing: $0.10/$0.32 per 1M tokens
3. **GPT-OSS 120B** (gpt-oss-120b-or) - Budget OpenAI OSS model
   - Pricing: $0.039/$0.19 per 1M tokens
4. **Devstral 2** (devstral-2-or) - Budget Mistral code model
   - Pricing: $0.05/$0.22 per 1M tokens
5. **Nemotron 3 Nano 30B A3B** (nemotron-3-nano-30b-a3b-or) - Ultra-budget NVIDIA model
   - Pricing: $0.05/$0.20 per 1M tokens

## Family Grouping Updates

- **Qwen:** 3→2 models (removed 235B Thinking)
- **Meta Llama:** 2 models (replaced Maverick with Llama 3.3 70B)
- **OpenAI OSS:** 1→2 models (added 120B)
- **Deep Cogito:** 1→0 models (removed entirely)
- **Z-AI GLM:** 1→2 models (added GLM-4.7)
- **Mistral:** 2 models (replaced Devstral Small with Devstral 2)
- **NVIDIA:** 1 model (replaced Nano 9B v2 with Nano 30B A3B)

## Decisions Made

**1. Swap strategy:** Remove underperforming/unavailable models, add new models with better availability/pricing
- Rationale: Maintain 21 total for clean leaderboard presentation, improve model quality

**2. Archive fix priority:** Added archived:false to sync-models .set() call
- Rationale: Without this, previously-archived models would stay archived even when re-added to code, breaking reactivation flow

**3. Content updates:** Updated llms-full.txt and llms.txt to reflect current architecture
- Rationale: Public-facing content must match actual system state (29 Together AI→21 OpenRouter)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all changes applied cleanly, TypeScript compiled without errors, production build succeeded.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

**Files created/modified verification:**
```
FOUND: src/lib/llm/providers/openrouter.ts
FOUND: src/lib/llm/index.ts
FOUND: src/lib/db/sync-models.ts
FOUND: src/app/llms-full.txt/route.ts
FOUND: src/app/llms.txt/route.ts
```

**Commits verification:**
```
FOUND: 30e9fe5
FOUND: 85398f7
FOUND: 2a08b9b
```

**Provider count verification:**
```
OPENROUTER_PROVIDERS: 21 entries ✓
MODEL_PROVIDER_ROUTES: 21 entries ✓
No dangling references ✓
```

**Build verification:**
```
TypeScript compilation: 0 relevant errors ✓
Production build: successful ✓
```

## Next Phase Readiness

- 21 active models synchronized between code and database
- Archive/unarchive flow works correctly
- Public-facing content (llms.txt) accurate and up-to-date
- Ready for production deployment

---
*Phase: quick-052*
*Completed: 2026-02-14*
