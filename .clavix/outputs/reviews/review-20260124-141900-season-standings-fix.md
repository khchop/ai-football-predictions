---
id: review-20260124-141900-season-standings-fix
branch: main (commit 6d9f818)
targetBranch: main
criteria: [all-around]
date: 2026-01-24T14:19:00Z
filesReviewed: 6
criticalIssues: 0
majorIssues: 1
minorIssues: 3
assessment: Approve with Minor Changes
---

# PR Review Report

**Commit:** `6d9f818` on `main`
**Files Changed:** 6 (5 source, 1 component)
**Review Criteria:** All-Around (Security, Architecture, Standards, Performance)
**Date:** 2026-01-24

---

## Executive Summary

| Dimension | Rating | Key Finding |
|-----------|--------|-------------|
| Security | GOOD | No security issues - data filtering is database-side |
| Architecture | GOOD | Consistent pattern applied across all functions |
| Code Quality | FAIR | One logic issue in H2H display for cup matches |
| Performance | GOOD | Season filter uses indexed column |

**Overall Assessment:** Approve with Minor Changes

---

## Detailed Findings

### Critical (Must Fix)

No critical issues found.

### Major (Should Fix)

| ID | File | Line | Issue |
|:--:|:-----|:----:|:------|
| M1 | `src/components/match/MatchStats.tsx` | 97-100 | **H2H Team Names in Cup Matches**: The H2H summary uses `homeStanding?.teamName` which falls back to "Home"/"Away" when standings are null (cup matches). This means cup match H2H displays as "Home leads 5-1" instead of actual team names. The component should receive team names as props or extract them from the first H2H result. |

### Minor (Optional)

| ID | File | Line | Issue |
|:--:|:-----|:----:|:------|
| m1 | `src/lib/football/competitions.ts` | 12-16 | **Date Object Creation**: `new Date()` is called 3 times. Consider storing in a variable for consistency: `const now = new Date(); const CURRENT_SEASON = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;` |
| m2 | `src/components/match/MatchStats.tsx` | 131-145 | **parseFloat Safety**: The odds parsing `parseFloat(analysis.oddsHome).toFixed(2)` could display "NaN" if the string is malformed. Consider adding fallback: `(parseFloat(analysis.oddsHome) \|\| 0).toFixed(2)` |
| m3 | `src/lib/football/standings.ts` | 273-275 | **Unused Function**: `getStandingByTeamName` was updated with season parameter but doesn't appear to have any callers. Verify if this function is still needed or should be removed. |

### Suggestions (Nice to Have)

- Consider adding JSDoc to document that `season` parameter uses the format YYYY (e.g., 2025 for 2025-26 season)
- The 3-column grid on mobile (`grid-cols-1`) stacks all cards vertically which is correct, but on medium screens (`md:grid-cols-3`) might be cramped. Consider `md:grid-cols-2 lg:grid-cols-3` for better spacing.

---

## What's Good

- **Comprehensive fix**: All 4 standings query functions were updated consistently
- **Proper null coalescing**: Used `?? 0` for numeric comparisons to handle null values
- **Good UX for cup matches**: Clear "Cup Match - No league standings" message
- **Dynamic season calculation**: Auto-calculates based on month, no more manual updates needed
- **H2H neutral format**: Much clearer than the previous "5W, 4D, 1L" format
- **Build passes**: No TypeScript errors

---

## Recommended Actions

**Before Merge:**
(Already merged - these are for follow-up)

**Consider for Follow-up:**
1. Fix M1: Pass `homeTeam` and `awayTeam` props to MatchStats component for accurate H2H display in cup matches
2. Fix m2: Add NaN protection for odds parsing

**Future Improvements:**
3. Consider extracting repeated Date() calls
4. Verify if `getStandingByTeamName` is still used anywhere

---

## Files Reviewed

| File | Status | Notes |
|:-----|:------:|:------|
| `src/lib/football/competitions.ts` | GOOD | Dynamic CURRENT_SEASON works correctly |
| `src/lib/db/queries.ts` | GOOD | Season filter properly added |
| `src/lib/football/standings.ts` | GOOD | All 3 functions updated consistently |
| `src/lib/queue/workers/predictions.worker.ts` | GOOD | Caller updated correctly |
| `src/app/predictions/[league]/[slug]/page.tsx` | GOOD | Season passed from competition |
| `src/components/match/MatchStats.tsx` | FAIR | H2H team name issue for cup matches |

---

*Generated with Clavix Review | 2026-01-24*
