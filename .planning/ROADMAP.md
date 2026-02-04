# Roadmap: v2.4 Synthetic.new Integration

**Milestone:** v2.4
**Goal:** Add Synthetic.new as second LLM provider with 14 new models
**Phases:** 37-39
**Requirements:** 17

## Phase Overview

| Phase | Name | Goal | Requirements | Success Criteria | Status |
|-------|------|------|--------------|------------------|--------|
| 37 | Synthetic Provider | Create provider class and model configurations | PROV-01-04, MODL-01-04, ERRH-01-03 | Provider makes successful API call | Complete |
| 38 | Database Integration | Register models in database | DATA-01-03 | Models appear in predictions table | Complete |
| 39 | Testing & Validation | Test all 13 models in production | TEST-01-03 | 7 models validated, 6 disabled, fallbacks configured | In Progress |

---

## Phase 37: Synthetic Provider Foundation

**Status:** Complete (2026-02-04)
**Goal:** Create SyntheticProvider class and configure 13 models

**Requirements:**
- PROV-01: SyntheticProvider class extends OpenAICompatibleProvider
- PROV-02: Provider uses `SYNTHETIC_API_KEY` environment variable
- PROV-03: Provider calls `https://api.synthetic.new/openai/v1/chat/completions`
- PROV-04: Provider handles `hf:org/model` ID format
- MODL-01: 14 Synthetic models defined with ID, name, model, displayName
- MODL-02: Reasoning models marked as premium tier
- MODL-03: Models exported in `SYNTHETIC_PROVIDERS` array
- MODL-04: Provider registry includes Synthetic providers
- ERRH-01: 429 rate limit errors handled with existing retry logic
- ERRH-02: Missing API key throws descriptive error
- ERRH-03: Model failures trigger auto-disable after 3 consecutive failures

**Success Criteria:**
1. SyntheticProvider class created at `src/lib/llm/providers/synthetic.ts`
2. 14 model configurations defined with correct `hf:` prefixed IDs
3. Provider registry exports combined Together + Synthetic providers
4. API call to Synthetic.new returns valid response (manual test)
5. Missing API key produces clear error message

**Deliverables:**
- `src/lib/llm/providers/synthetic.ts` - Provider class + 14 model configs
- Updated provider registry/index file

---

## Phase 38: Database Integration

**Status:** Complete (2026-02-04)
**Goal:** Register 14 Synthetic models in database

**Requirements:**
- DATA-01: Auto-sync registers models via `syncModelsToDatabase()` on server startup
- DATA-02: Models have `provider: 'synthetic'` from `SyntheticProvider.name`
- DATA-03: Models default to `active: true` via sync logic

**Success Criteria:**
1. Auto-sync adds models to `models` table (no manual seed needed)
2. Models queryable with `provider = 'synthetic'`
3. Models appear in model selection/leaderboard UI (after first sync)
4. No duplicate ID conflicts (unique IDs with `-syn` suffix)

**Implementation Notes:**
Phase 38 was already implemented by Phase 37's registry integration. The existing `sync-models.ts` auto-sync mechanism:
- Reads all providers from `getActiveProviders()` (includes SYNTHETIC_PROVIDERS when API key set)
- Upserts each provider into the database with `provider`, `modelName`, `displayName`, `isPremium`, `active: true`
- Runs on server startup — no manual migration or seed script needed

**Deliverables:**
- Existing `src/lib/db/sync-models.ts` handles registration automatically
- Models visible in application after first deployment with `SYNTHETIC_API_KEY` set

---

## Phase 39: Testing & Validation

**Status:** In Progress
**Goal:** Validate all 13 models produce usable predictions; disable non-working models; add Together AI fallbacks
**Plans:** 4 plans

**Requirements:**
- TEST-01: Each model tested with sample prediction
- TEST-02: Thinking model output correctly parsed
- TEST-03: GLM models monitored for Chinese output

**Success Criteria:**
1. ~~All 13 models return parseable JSON predictions~~ **7/13 models validated (6 disabled)**
2. DeepSeek R1, Kimi K2-Thinking, Qwen3-Thinking correctly parsed (thinking tags stripped) **2/3 work**
3. GLM models produce English output (or auto-disabled if not) **Both disabled (timeout/API bug)**
4. No models stuck in permanent failure state **6 models disabled with documented reasons**
5. First full prediction cycle completes with Synthetic models included **Pending 39-04**

**Deliverables:**
- Validation script created (39-01)
- 6 failing models disabled (39-02)
- Together AI fallback mapping (39-03)
- Production prediction cycle verified (39-04)

Plans:
- [x] 39-01-PLAN.md — Create validation script and test all 13 models
- [ ] 39-02-PLAN.md — Disable 6 failing Synthetic models (gap closure)
- [ ] 39-03-PLAN.md — Add Together AI fallback mapping (gap closure)
- [ ] 39-04-PLAN.md — Run production prediction cycle with Synthetic models (gap closure)

---

## Dependency Graph

```
Phase 37 (Provider)
    |
Phase 38 (Database)
    |
Phase 39 (Testing)
    |
    +-- 39-01 (Validation script) [Complete]
    |
    +-- 39-02 (Disable failing models) [Wave 1]
    |
    +-- 39-03 (Together AI fallbacks) [Wave 1]
    |
    +-- 39-04 (Production validation) [Wave 2, depends on 39-02]
```

---

## Models Summary (13)

| # | ID | Type | Status |
|---|-----|------|--------|
| 1 | deepseek-r1-0528-syn | Reasoning | **Active** |
| 2 | kimi-k2-thinking-syn | Reasoning | **Active** |
| 3 | qwen3-235b-thinking-syn | Reasoning | Disabled (parse failure) |
| 4 | deepseek-v3-0324-syn | Standard | **Active** |
| 5 | deepseek-v3.1-terminus-syn | Standard | **Active** |
| 6 | deepseek-v3.2-syn | Standard | Disabled (parse failure) |
| 7 | minimax-m2-syn | Standard | **Active** |
| 8 | minimax-m2.1-syn | Standard | **Active** |
| 9 | kimi-k2.5-syn | Standard | Disabled (timeout) |
| 10 | glm-4.6-syn | Standard | Disabled (timeout) |
| 11 | glm-4.7-syn | Standard | Disabled (API bug) |
| 12 | qwen3-coder-480b-syn | Standard | **Active** |
| 13 | gpt-oss-120b-syn | Standard | Disabled (invalid response) |

**Summary:** 7 active, 6 disabled

---

*Roadmap created: 2026-02-04*
*Total: 3 phases, 17 requirements*
