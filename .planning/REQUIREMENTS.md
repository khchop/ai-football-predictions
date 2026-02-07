# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-07
**Core Value:** The prediction pipeline must reliably generate scores from 42 LLMs before kickoff and accurately score them when matches complete

## v2.8 Requirements

Requirements for v2.8 Model Coverage milestone. Each maps to roadmap phases.

### Diagnostics

- [ ] **DIAG-01**: Diagnostic runner tests each model individually with golden fixture data
- [ ] **DIAG-02**: Failure categorization classifies each failure as timeout, parse, language, thinking-tag, API-error, or empty-response
- [ ] **DIAG-03**: Per-model success rate calculated from diagnostic run results
- [ ] **DIAG-04**: Raw LLM responses captured and stored for debugging failed models
- [ ] **DIAG-05**: Before/after comparison report shows improvement after fixes

### Regression Protection

- [ ] **REGR-01**: Regression test suite validates all currently-working models produce valid JSON
- [ ] **REGR-02**: Zod schema validates prediction response structure (home_score, away_score as numbers)
- [ ] **REGR-03**: Regression suite runs before and after any model config change

### Per-Model Fixes

- [ ] **FIX-01**: Timeout configuration tuned per model based on diagnostic data (60-90s for slow models)
- [ ] **FIX-02**: Thinking tag stripping applied to all reasoning models that leak tags
- [ ] **FIX-03**: English enforcement applied to models defaulting to non-English responses
- [ ] **FIX-04**: JSON extraction improved for models wrapping output in markdown or explanations
- [ ] **FIX-05**: Fallback chains expanded where Synthetic models have Together AI equivalents
- [ ] **FIX-06**: All 42 models produce valid prediction JSON in diagnostic test run

### Observability

- [ ] **OBS-01**: Database metrics table records per-model success/failure with timestamps and error categories
- [ ] **OBS-02**: Admin dashboard displays per-model health (success rate, last failure, failure type)
- [ ] **OBS-03**: Historical success rate trends visible per model over time
- [ ] **OBS-04**: Alert when a previously-working model starts failing (regression detection)

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Automated Optimization

- **AUTO-01**: Automated prompt variant A/B testing per model
- **AUTO-02**: Automated fallback chain discovery based on model similarity
- **AUTO-03**: Cost-optimized model selection (cheapest model that passes quality threshold)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automated prompt discovery/A/B testing | Too complex for this milestone, manual tuning sufficient |
| Few-shot example injection | Research indicates it degrades reasoning model performance |
| Model fine-tuning | Explicitly excluded in project constraints |
| New model additions | Focus on fixing existing 42, not adding more |
| Vision model predictions | Not useful for text-only football predictions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIAG-01 | Phase 54 | Pending |
| DIAG-02 | Phase 54 | Pending |
| DIAG-03 | Phase 54 | Pending |
| DIAG-04 | Phase 54 | Pending |
| DIAG-05 | Phase 58 | Pending |
| REGR-01 | Phase 53 | Pending |
| REGR-02 | Phase 53 | Pending |
| REGR-03 | Phase 53 | Pending |
| FIX-01 | Phase 55 | Pending |
| FIX-02 | Phase 55 | Pending |
| FIX-03 | Phase 56 | Pending |
| FIX-04 | Phase 56 | Pending |
| FIX-05 | Phase 57 | Pending |
| FIX-06 | Phase 57 | Pending |
| OBS-01 | Phase 58 | Pending |
| OBS-02 | Phase 58 | Pending |
| OBS-03 | Phase 58 | Pending |
| OBS-04 | Phase 58 | Pending |

**Coverage:**
- v2.8 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-07 after v2.8 roadmap created*
