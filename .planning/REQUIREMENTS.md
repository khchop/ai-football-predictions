# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-04
**Core Value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete

## v2.4 Requirements

Requirements for Synthetic.new provider integration. Adds 14 new models to the existing 29 Together AI models.

### Provider Integration

- [ ] **PROV-01**: SyntheticProvider class extends OpenAICompatibleProvider with correct endpoint
- [ ] **PROV-02**: Provider uses `SYNTHETIC_API_KEY` environment variable for authentication
- [ ] **PROV-03**: Provider calls `https://api.synthetic.new/openai/v1/chat/completions`
- [ ] **PROV-04**: Provider handles `hf:org/model` ID format correctly

### Model Configuration

- [ ] **MODL-01**: 14 Synthetic models defined with ID, name, model, displayName
- [ ] **MODL-02**: Reasoning models (R1-0528, K2-Thinking, Qwen3-Thinking) marked as premium tier
- [ ] **MODL-03**: Models exported in `SYNTHETIC_PROVIDERS` array
- [ ] **MODL-04**: Provider registry includes Synthetic providers alongside Together

### Database Integration

- [ ] **DATA-01**: Seed script registers 14 new models in database
- [ ] **DATA-02**: Models have `provider: 'synthetic'` for identification
- [ ] **DATA-03**: Models default to `is_active: true`

### Error Handling

- [ ] **ERRH-01**: 429 rate limit errors handled with existing retry logic
- [ ] **ERRH-02**: Missing `SYNTHETIC_API_KEY` throws descriptive error at startup
- [ ] **ERRH-03**: Model failures trigger auto-disable after 3 consecutive failures

### Testing

- [ ] **TEST-01**: Each model tested with sample prediction before production enablement
- [ ] **TEST-02**: Thinking model output correctly parsed (existing `<think>` tag stripping works)
- [ ] **TEST-03**: GLM models monitored for Chinese output issues

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replace Together AI | Keep existing models, only add Synthetic-exclusive |
| Per-model rate limiting | Use Synthetic tier rate limits as-is |
| Vision model (Qwen3-VL) | Not useful for text-only predictions |
| Usage-based pricing tracking | No published per-token costs from Synthetic |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 37 | Pending |
| PROV-02 | Phase 37 | Pending |
| PROV-03 | Phase 37 | Pending |
| PROV-04 | Phase 37 | Pending |
| MODL-01 | Phase 37 | Pending |
| MODL-02 | Phase 37 | Pending |
| MODL-03 | Phase 37 | Pending |
| MODL-04 | Phase 37 | Pending |
| DATA-01 | Phase 38 | Pending |
| DATA-02 | Phase 38 | Pending |
| DATA-03 | Phase 38 | Pending |
| ERRH-01 | Phase 37 | Pending |
| ERRH-02 | Phase 37 | Pending |
| ERRH-03 | Phase 37 | Pending |
| TEST-01 | Phase 39 | Pending |
| TEST-02 | Phase 39 | Pending |
| TEST-03 | Phase 39 | Pending |

**Coverage:**
- v2.4 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after v2.4 milestone initialization*
