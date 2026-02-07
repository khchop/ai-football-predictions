---
phase: 53
plan: 02
subsystem: testing
completed: 2026-02-07
duration: 2min

requires:
  - 53-01 (golden fixture infrastructure)

provides:
  - Runtime Zod validation at database boundary
  - CI automation for regression tests on LLM config changes
  - Schema validation failure tracking via recordModelFailure()

affects:
  - 54-model-diagnostics (can rely on CI catching config regressions)
  - 55-targeted-fixes (protected by automated regression testing)
  - Future LLM config changes (all protected by CI workflow)

tech-stack:
  added: []
  patterns:
    - Database boundary validation with Zod safeParse
    - CI-first regression protection
    - GitHub Actions path-based triggers

key-files:
  created:
    - src/lib/validation/prediction-schema.ts
    - .github/workflows/regression-tests.yml
  modified:
    - src/lib/queue/workers/predictions.worker.ts
    - src/__tests__/schemas/prediction.ts

decisions:
  - slug: separate-test-production-schemas
    title: Separate schemas for test vs production validation
    rationale: Test schemas validate LLM output format (match_id, home_score, away_score) while production schema validates database insert format (matchId, predictedHome, predictedAway). Different stages, different concerns.
    alternatives: Single unified schema
    tradeoffs: Two schemas mean maintaining consistency, but clearer separation of concerns
    impact: Low-risk pattern change

  - slug: ci-offline-only
    title: CI runs offline tests only (no API keys)
    rationale: Fast feedback (<10s), no rate limits, no API costs, sufficient for regression detection
    alternatives: Run live API tests in CI
    tradeoffs: Offline tests don't catch API integration issues, but golden fixtures cover parsing/schema
    impact: Medium-risk architectural constraint

  - slug: manual-branch-protection
    title: Branch protection rules configured manually
    rationale: GitHub API requires admin access or PAT, not automatable via CLI without elevated permissions
    alternatives: Terraform/GitHub Actions with PAT
    tradeoffs: One-time manual step after merge vs complex automation
    impact: Low-risk operational decision

tags:
  - testing
  - regression
  - ci-cd
  - validation
  - github-actions
---

# Phase 53 Plan 02: Runtime Validation & CI Automation Summary

**One-liner:** Zod safeParse guards database boundary + GitHub Actions CI blocks PRs with regression failures

## What Was Built

**Database Boundary Guard (REGR-02):**
- Created `PredictionInsertSchema` in `src/lib/validation/prediction-schema.ts`
- Added Zod validation in predictions.worker.ts after LLM parsing, before database insert
- Invalid predictions (non-integer scores, missing fields, scores >20) are skipped with error logging
- Validation failures recorded via `recordModelFailure()` with reason `schema_validation_failed`
- Clear separation documented between test schemas (LLM output) and production schemas (DB insert)

**CI Automation (REGR-03):**
- Created GitHub Actions workflow at `.github/workflows/regression-tests.yml`
- Triggers on PR changes to `src/lib/llm/**`, worker, validation, or test files
- Runs offline regression tests (no API keys needed, completes in <10 seconds)
- Runs schema validation tests (ensures test schemas stay valid)
- Timeout: 5 minutes (generous for fast offline tests)
- **Note:** Branch protection rules (require status checks) must be configured manually in GitHub repository settings after merge

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Database boundary Zod validation | c846dc0 | prediction-schema.ts, predictions.worker.ts, prediction.ts |
| 2 | CI workflow for regression tests | 1f6a534 | regression-tests.yml |

## Verification

All verification checks passed:
- ✅ `safeParse` validation exists in predictions.worker.ts
- ✅ `PredictionInsertSchema` defined in prediction-schema.ts
- ✅ CI workflow exists with correct triggers and test commands
- ✅ Regression tests pass (10/10, 2 skipped for live fixtures)
- ✅ Schema validation tests pass (7/7)
- ✅ TypeScript compilation succeeds (no type errors from new imports)

## Decisions Made

**1. Separate schemas for test vs production validation**
- Test schemas validate LLM output format (match_id, home_score, away_score)
- Production schema validates database insert format (matchId, predictedHome, predictedAway)
- Different field names reflect different stages of the pipeline
- Clearer separation of concerns, easier to maintain

**2. CI runs offline tests only (no API keys)**
- Fast feedback (<10 seconds)
- No API rate limits or costs
- Sufficient for regression detection (validates parsing/schema against golden fixtures)
- Live API tests remain available as `npm run test:regression:live` for manual validation

**3. Branch protection configured manually**
- GitHub API requires admin access to configure branch protection
- Not automatable via CLI without Personal Access Token
- One-time manual step: Settings > Branches > Add rule for `main` > Enable "Require status checks"
- Add "Model Regression Tests" as required check

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Imports:**
- predictions.worker.ts imports `PredictionInsertSchema` from `@/lib/validation/prediction-schema`
- Uses Zod's `safeParse()` for validation before database insert

**CI Triggers:**
- GitHub Actions workflow triggers on paths: `src/lib/llm/**`, worker, validation, tests, vitest config
- Runs `npm run test:regression` (defined in package.json from 53-01)
- Runs schema validation with `npx vitest run src/__tests__/schemas/`

**Model Failure Tracking:**
- Validation failures recorded via existing `recordModelFailure()` function
- Reason: `schema_validation_failed`
- Error type: `ErrorType.PARSE_ERROR` (same as LLM parsing failures)

## Technical Notes

**Validation Flow:**
1. LLM returns JSON response
2. `parseBatchPredictionResponse()` validates LLM output format (match_id, home_score, away_score)
3. NEW: `PredictionInsertSchema.safeParse()` validates database insert format (matchId, predictedHome, predictedAway)
4. Only valid predictions reach `predictionsToInsert.push()` and database insert

**Why Two Schemas:**
- LLM output uses snake_case field names (match_id, home_score, away_score)
- Database insert uses camelCase field names (matchId, predictedHome, predictedAway)
- Different stages, different concerns
- Test schemas in `src/__tests__/schemas/prediction.ts` validate LLM output
- Production schema in `src/lib/validation/prediction-schema.ts` validates DB insert

**CI Performance:**
- Offline tests complete in <10 seconds (no API calls)
- Schema validation tests complete in <2 seconds
- Total CI time: ~30 seconds including npm install
- Fast feedback loop for developers

## Next Phase Readiness

**Phase 54 (Model Diagnostics) is READY:**
- ✅ Regression test infrastructure complete (53-01)
- ✅ Database boundary protected with Zod validation
- ✅ CI automation catches regressions in PRs
- ✅ Golden fixtures capture baseline behavior
- ✅ Can now safely modify LLM configs with regression protection

**What Phase 54 can leverage:**
- Run golden fixture generator to capture current baseline
- Make diagnostic changes to model configs
- CI automatically validates no regressions in successful models
- Failed model diagnostics won't break working models

**Blockers/Concerns:**
- None. Branch protection manual step is documented, but not blocking (CI still runs, just not enforced)

## Self-Check: PASSED

**Created files verified:**
```bash
[ -f "src/lib/validation/prediction-schema.ts" ] ✅ FOUND
[ -f ".github/workflows/regression-tests.yml" ] ✅ FOUND
```

**Commits verified:**
```bash
git log --oneline --all | grep "c846dc0" ✅ FOUND: feat(53-02): add Zod validation at database boundary
git log --oneline --all | grep "1f6a534" ✅ FOUND: feat(53-02): add CI workflow for automated regression testing
```

**Tests verified:**
```bash
npm run test:regression ✅ PASSED: 10 tests pass, 2 skipped
npx vitest run src/__tests__/schemas/ ✅ PASSED: 7 tests pass
```
