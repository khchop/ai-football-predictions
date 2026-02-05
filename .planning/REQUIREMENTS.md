# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-05
**Core Value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete

## v2.5 Requirements

Requirements for Model Reliability & Dynamic Counts milestone. Each maps to roadmap phases.

### Model-Specific Prompts

- [ ] **PRMT-01**: Model-specific prompt templates exist for failing models (GLM, Kimi, thinking models)
- [ ] **PRMT-02**: GLM models receive English enforcement prompt ("Respond in English only")
- [ ] **PRMT-03**: Thinking models receive tag suppression prompt ("Output JSON only, no thinking tags")
- [ ] **PRMT-04**: DeepSeek R1 uses minimal system prompt (empty or single line)
- [ ] **PRMT-05**: Prompt selector falls back to base prompt for unmapped models (don't break working models)
- [ ] **PRMT-06**: Models returning natural language receive JSON emphasis prompt

### Structured Output

- [ ] **JSON-01**: Models that fail JSON parsing receive structured output enforcement in prompt
- [ ] **JSON-02**: qwen3-235b-thinking returns valid JSON after prompt adjustment
- [ ] **JSON-03**: deepseek-v3.2 returns valid JSON after prompt adjustment
- [ ] **JSON-04**: Integration test validates JSON output for all 36+ models

### Model Timeouts

- [ ] **TIME-01**: Model-specific timeout configuration exists (MODEL_TIMEOUT_OVERRIDES map)
- [ ] **TIME-02**: Thinking models use 60s timeout (vs 30s default)
- [ ] **TIME-03**: Kimi K2.5 uses 60s timeout
- [ ] **TIME-04**: GLM models use 60s timeout

### Fallback Chains

- [ ] **FALL-01**: Fallback orchestrator wraps callAPI with try-catch + fallback logic
- [ ] **FALL-02**: Synthetic model failures trigger automatic fallback to Together.ai
- [ ] **FALL-03**: Fallback returns tuple [response, actualProvider] for transparency
- [ ] **FALL-04**: kimi-k2.5-syn falls back to equivalent Together.ai model
- [ ] **FALL-05**: glm-4.6-syn falls back to equivalent Together.ai model
- [ ] **FALL-06**: glm-4.7-syn falls back to equivalent Together.ai model (SGLang bug workaround)

### Cycle Detection

- [ ] **CYCL-01**: Fallback mapping validated at startup (no cycles)
- [ ] **CYCL-02**: Runtime cycle detection tracks attemptedModels Set
- [ ] **CYCL-03**: Max fallback depth limit of 3 prevents infinite retries

### Cost Guards

- [ ] **COST-01**: Fallback logs warning if fallback provider >2x more expensive
- [ ] **COST-02**: Cost metadata tracked in prediction record (originalCost, fallbackCost)
- [ ] **COST-03**: Daily fallback cost visible in admin dashboard

### Dynamic Counts

- [ ] **DYNM-01**: Homepage hero displays dynamic model count (not hardcoded "35")
- [ ] **DYNM-02**: Leaderboard page displays dynamic model count
- [ ] **DYNM-03**: Match page SEO metadata uses dynamic model count
- [ ] **DYNM-04**: Content generation prompts use dynamic model count
- [ ] **DYNM-05**: System prompts use dynamic model count
- [ ] **DYNM-06**: Single source of truth (getActiveModelCount function)
- [ ] **DYNM-07**: Cache invalidation on model enable/disable

### Leaderboard Auto-Include

- [ ] **LEAD-01**: New models appear in leaderboard automatically after first prediction
- [ ] **LEAD-02**: Re-enabled models appear in leaderboard without manual intervention
- [ ] **LEAD-03**: Leaderboard query uses active models from database (not hardcoded list)

## Future Requirements

Deferred to v2.6+. Tracked but not in current roadmap.

### Advanced Reliability

- **ADRL-01**: Adaptive prompt optimization based on success rates
- **ADRL-02**: A/B testing framework for prompt variants
- **ADRL-03**: Predictive circuit breaking (ML-based failure prediction)
- **ADRL-04**: Model warmup/cooldown (gradual reintroduction)

### Cost Optimization

- **COPT-01**: Cost-aware routing (prefer cheaper models when accuracy equal)
- **COPT-02**: Budget-based model selection during high-volume periods
- **COPT-03**: Per-model cost tracking dashboard

### Observability

- **OBSV-01**: Model performance leaderboard (uptime %, parse success %, latency)
- **OBSV-02**: Model health monitoring API endpoint
- **OBSV-03**: Fallback frequency alerting

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| LiteLLM/Portkey gateway | Adds 50-200ms latency, Python dependency |
| LangChain prompt management | 10MB+ bundle for simple string mapping |
| Cross-provider model switching | Complexity not justified, fallback sufficient |
| Real-time prompt A/B testing | Premature for current scale |
| Model fine-tuning | Out of scope for this platform |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRMT-01 | Phase 40 | Pending |
| PRMT-02 | Phase 40 | Pending |
| PRMT-03 | Phase 40 | Pending |
| PRMT-04 | Phase 40 | Pending |
| PRMT-05 | Phase 40 | Pending |
| PRMT-06 | Phase 40 | Pending |
| JSON-01 | Phase 40 | Pending |
| JSON-02 | Phase 40 | Pending |
| JSON-03 | Phase 40 | Pending |
| JSON-04 | Phase 43 | Pending |
| TIME-01 | Phase 40 | Pending |
| TIME-02 | Phase 40 | Pending |
| TIME-03 | Phase 40 | Pending |
| TIME-04 | Phase 40 | Pending |
| FALL-01 | Phase 41 | Pending |
| FALL-02 | Phase 41 | Pending |
| FALL-03 | Phase 41 | Pending |
| FALL-04 | Phase 41 | Pending |
| FALL-05 | Phase 41 | Pending |
| FALL-06 | Phase 41 | Pending |
| CYCL-01 | Phase 41 | Pending |
| CYCL-02 | Phase 41 | Pending |
| CYCL-03 | Phase 41 | Pending |
| COST-01 | Phase 41 | Pending |
| COST-02 | Phase 41 | Pending |
| COST-03 | Phase 41 | Pending |
| DYNM-01 | Phase 42 | Pending |
| DYNM-02 | Phase 42 | Pending |
| DYNM-03 | Phase 42 | Pending |
| DYNM-04 | Phase 42 | Pending |
| DYNM-05 | Phase 42 | Pending |
| DYNM-06 | Phase 42 | Pending |
| DYNM-07 | Phase 42 | Pending |
| LEAD-01 | Phase 42 | Pending |
| LEAD-02 | Phase 42 | Pending |
| LEAD-03 | Phase 42 | Pending |

**Coverage:**
- v2.5 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after initial definition*
