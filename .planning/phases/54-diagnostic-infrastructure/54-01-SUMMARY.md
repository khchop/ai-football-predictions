---
phase: 54
plan: 01
subsystem: diagnostic-infrastructure
tags: [testing, fixtures, failure-categorization, diagnostics]
depends_on:
  requires: [53]
  provides: [diverse-scenarios, failure-categorization, diagnostic-result-type]
  affects: [54-02, 54-03]
tech-stack:
  added: []
  patterns: [failure-taxonomy, scenario-driven-testing]
key-files:
  created:
    - src/__tests__/fixtures/golden/diverse-scenarios.ts
    - scripts/diagnostic/categorize-failure.ts
  modified: []
decisions:
  - id: diag-prefix
    decision: "Use diag- prefix for diagnostic match IDs to distinguish from test-validation-001 fixture"
    rationale: "Prevents collision with existing golden fixture IDs"
  - id: six-categories
    decision: "6 failure categories with strict priority order: timeout > api-error > empty > language > thinking-tag > parse"
    rationale: "Priority order prevents misclassification (e.g., timeout with partial Chinese response classified as timeout, not language)"
metrics:
  duration: ~2 minutes
  completed: 2026-02-07
---

# Phase 54 Plan 01: Diverse Scenarios & Failure Categorization Summary

Typed match scenario fixtures covering 5 prediction contexts (standard, high-scoring, low-scoring, upset, derby) with buildTestPrompt() helper, plus failure categorization module classifying LLM errors into 6 categories with actionable fix recommendations.

## What Was Built

### Diverse Match Scenario Fixtures
- `DiagnosticScenario` interface with id, homeTeam, awayTeam, competition, description fields
- `DIVERSE_SCENARIOS` record with 5 scenarios covering varied prediction difficulty
- `buildTestPrompt(scenarioId)` generates prompts matching existing test-data.ts format with `diag-` prefix
- `getAllScenarioIds()` returns all scenario keys for parameterized loops

### Failure Categorization Module
- `FailureCategory` enum: TIMEOUT, PARSE, LANGUAGE, THINKING_TAG, API_ERROR, EMPTY_RESPONSE
- `categorizeFailure()` with priority-ordered decision tree (prevents misclassification)
- `FIX_RECOMMENDATIONS` map with specific code-change recommendations per category
- `DiagnosticResult` interface for diagnostic runner integration (Plan 02)
- Raw response truncation at 300 characters

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create diverse match scenario fixtures | ceacc98 | src/__tests__/fixtures/golden/diverse-scenarios.ts |
| 2 | Create failure categorization module | 0b7a1d1 | scripts/diagnostic/categorize-failure.ts |

## Decisions Made

1. **diag- prefix for match IDs** - Diagnostic scenarios use `diag-standard`, `diag-high-scoring`, etc. to avoid collision with the existing `test-validation-001` fixture from Phase 53.

2. **Priority-ordered categorization** - Timeout checked first, parse is the default fallback. This prevents a timeout error with a partial Chinese response from being classified as LANGUAGE instead of TIMEOUT.

3. **300-char truncation** - Raw responses stored in CategorizedFailure are truncated to 300 characters for readability while preserving enough context for debugging.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:
- 5 diverse scenarios exported with typed interface
- buildTestPrompt returns formatted prompts with diag- prefix
- getAllScenarioIds returns all 5 keys
- categorizeFailure correctly classifies all 6 failure types in priority order
- Each category maps to actionable fix recommendation
- DiagnosticResult interface exported for Plan 02 integration
- Both modules compile and execute without errors

## Next Phase Readiness

Plan 54-02 (Diagnostic Runner) can now:
- Import `DIVERSE_SCENARIOS` and `buildTestPrompt` for scenario-driven model testing
- Import `categorizeFailure` and `DiagnosticResult` for failure classification
- Use `FIX_RECOMMENDATIONS` to generate actionable diagnostic reports

## Self-Check: PASSED
