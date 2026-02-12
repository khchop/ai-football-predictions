# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-12
**Core Value:** The prediction pipeline must reliably generate scores from 20 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete

## v3.1 Requirements

Requirements for v3.1 Model Lifecycle & Discord Alerts. Each maps to roadmap phases.

### Model Configuration

- [ ] **MDL-01**: System configures 20 active models with correct OpenRouter model IDs and pricing
- [ ] **MDL-02**: New models (GLM-5, DeepSeek V3.2, DeepSeek R1-0528, MiniMax M2.1, Devstral 2, Qwen3 30B A3B, GPT-OSS-20B, Step 3.5 Flash, Mistral Small 3.2 24B, Gemma 3 27B, Nemotron 3 Nano 30B A3B, Trinity Large Preview, Phi-4, Llama 4 Scout, Gemma 3 12B) are defined with appropriate prompt variants and timeouts
- [ ] **MDL-03**: Existing models not in the active 20 are marked as archived
- [ ] **MDL-04**: GLM-4.7 route registration bug is fixed (defined but not in MODEL_PROVIDER_ROUTES)
- [ ] **MDL-05**: Model validation passes at module load time for all 20 active models

### Archive System

- [ ] **ARCH-01**: Models table has `archived` boolean column (default false)
- [ ] **ARCH-02**: Archived models are excluded from the prediction pipeline (not queried by workers)
- [ ] **ARCH-03**: Archived models are excluded from dynamic model count (`getActiveModelCount()`)
- [ ] **ARCH-04**: Leaderboard shows "Show archived models" toggle switch
- [ ] **ARCH-05**: When toggle is off (default), archived models are hidden from leaderboard rankings
- [ ] **ARCH-06**: When toggle is on, archived models appear in leaderboard with visual indicator
- [ ] **ARCH-07**: Team page leaderboards respect the archived filter
- [ ] **ARCH-08**: Competition leaderboards respect the archived filter

### Discord Alerts

- [ ] **DISC-01**: Discord webhook URL configurable via `DISCORD_WEBHOOK_URL` environment variable
- [ ] **DISC-02**: Discord notification service sends rich embeds with model name, error details, and timestamps
- [ ] **DISC-03**: Alert fires when a model is auto-disabled (5+ consecutive model-specific failures)
- [ ] **DISC-04**: Alert fires during daily regression check when a model drops >10% success rate
- [ ] **DISC-05**: Alerts include actionable context: error type, failure count, last success time, suggested action

## Future Requirements

### Model Lifecycle

- **LIFE-01**: Admin UI page to toggle archive status per model
- **LIFE-02**: Model comparison tool (head-to-head for clubs)
- **LIFE-03**: Best/worst matchup analysis per model

### Discord Enhancements

- **DSCE-01**: Daily health digest summary to Discord
- **DSCE-02**: Discord alerts for pipeline coverage gaps
- **DSCE-03**: Configurable alert severity thresholds via admin

## Out of Scope

| Feature | Reason |
|---------|--------|
| Admin archive toggle UI | Milestone keeps it simple — archive via code/DB, admin UI deferred to LIFE-01 |
| Daily Discord digest | Not needed for v3.1, can add in future milestone |
| Slack/email integration | Discord only for now |
| Model performance predictions | Out of scope for lifecycle management |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MDL-01 | — | Pending |
| MDL-02 | — | Pending |
| MDL-03 | — | Pending |
| MDL-04 | — | Pending |
| MDL-05 | — | Pending |
| ARCH-01 | — | Pending |
| ARCH-02 | — | Pending |
| ARCH-03 | — | Pending |
| ARCH-04 | — | Pending |
| ARCH-05 | — | Pending |
| ARCH-06 | — | Pending |
| ARCH-07 | — | Pending |
| ARCH-08 | — | Pending |
| DISC-01 | — | Pending |
| DISC-02 | — | Pending |
| DISC-03 | — | Pending |
| DISC-04 | — | Pending |
| DISC-05 | — | Pending |

**Coverage:**
- v3.1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after initial definition*
