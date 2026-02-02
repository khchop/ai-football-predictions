---
phase: 05-stats-foundation
plan: 01
subsystem: stats-service
tags: [accuracy, sql, service-layer, drizzle, typescript]
completed: 2026-02-02

dependency-graph:
  requires: []
  provides:
    - canonical-accuracy-formula
    - stats-service-layer
    - reusable-sql-fragments
  affects:
    - 05-02 (API endpoint migration)
    - 05-03 (Component migration)
    - all-stats-consumers

tech-stack:
  added: []
  patterns:
    - service-layer-pattern
    - sql-fragment-reuse
    - nullif-division-protection

key-files:
  created:
    - src/lib/types/stats.ts
    - src/lib/services/stats.ts
  modified: []

decisions:
  - id: stats-formula
    choice: "tendencyPoints > 0"
    rationale: "IS NOT NULL includes 0-point wrong predictions, inflating accuracy by ~7%"
  - id: division-protection
    choice: "NULLIF(denominator, 0) + COALESCE(result, 0)"
    rationale: "Prevents division by zero for models with no scored predictions"
  - id: service-layer
    choice: "Centralized stats.ts service"
    rationale: "Single source of truth prevents formula drift across pages"

metrics:
  duration: ~2 min
  tasks: 2/2
  commits: 2
---

# Phase 05 Plan 01: Stats Service Layer Summary

**One-liner:** Canonical accuracy calculation service using `tendencyPoints > 0` formula with NULLIF division protection

## What Was Built

Created the stats service layer as the single source of truth for all accuracy calculations:

### 1. Stats Types (`src/lib/types/stats.ts`)
- `ModelAccuracyStats` interface with tendency and exact accuracy fields
- `CompetitionModelStats` interface for per-competition breakdowns
- Establishes contract for all stats consumers

### 2. Stats Service (`src/lib/services/stats.ts`)
- **Reusable SQL fragments:** `CORRECT_TENDENCIES_SQL`, `EXACT_SCORES_SQL`, `SCORED_PREDICTIONS_SQL`, `ACCURACY_SQL`, `EXACT_ACCURACY_SQL`
- **Service functions:** `getModelAccuracyStats()`, `getCompetitionModelStats()`
- **Canonical formula:** `tendencyPoints > 0` (not IS NOT NULL)
- **Division protection:** All calculations wrapped in `NULLIF(denominator, 0)` + `COALESCE(result, 0)`

## Key Implementation Details

**Accuracy Formula (Correct):**
```sql
COALESCE(
  ROUND(
    100.0 * SUM(CASE WHEN tendencyPoints > 0 THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
    1
  ),
  0
)
```

**Why `> 0` not `IS NOT NULL`:**
- tendencyPoints is NULL before scoring
- tendencyPoints is 0 after scoring if tendency was wrong
- tendencyPoints is 2-6 if tendency was correct
- `IS NOT NULL` includes wrong predictions (0 points), inflating accuracy by ~7%

## Commits

| Hash | Message |
|------|---------|
| 1d71244 | feat(05-01): create stats types for accuracy calculations |
| 3406686 | feat(05-01): create stats service with canonical accuracy formula |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Plan 02 (API Migration):** Ready
- Stats service exports all needed functions
- SQL fragments available for complex queries

**Plan 03 (Component Migration):** Ready
- Types available for component props
- Service functions ready for import

## Verification Results

1. `src/lib/types/stats.ts` exists with both interfaces
2. `src/lib/services/stats.ts` exports 7 items (5 SQL fragments + 2 functions)
3. Formula uses `tendencyPoints > 0` (verified via grep)
4. All divisions protected with NULLIF (verified via grep)
5. TypeScript compilation succeeds (no errors in stats files)
