---
phase: 27-hero-component
verified: 2026-02-03T19:30:00Z
status: gaps_found
score: 1/4 must-haves verified
gaps:
  - truth: "Score displays exactly once on the page (no duplicates in header, H1, or elsewhere)"
    status: failed
    reason: "MatchHero component created but never integrated - old match-header.tsx still renders score"
    artifacts:
      - path: "src/components/match/match-hero.tsx"
        issue: "Component exists but is ORPHANED - not imported/used anywhere"
      - path: "src/components/match/match-header.tsx"
        issue: "OLD component still renders score (lines 100-120) - duplicate not eliminated"
      - path: "src/app/matches/[id]/page.tsx"
        issue: "Still uses MatchHeader (line 122) instead of MatchHero"
      - path: "src/app/leagues/[slug]/[match]/page.tsx"
        issue: "Still uses MatchPageHeader→MatchHeader (line 201) instead of MatchHero"
    missing:
      - "Replace MatchHeader with MatchHero in /matches/[id]/page.tsx"
      - "Replace MatchPageHeader→MatchHeader with MatchHero in /leagues/[slug]/[match]/page.tsx"
      - "Verify no other score displays remain (check all match-related components)"
      - "Test that score appears exactly once on live match pages"

  - truth: "Match hero shows teams, competition, kickoff time correctly"
    status: uncertain
    reason: "MatchHero implementation looks correct but never visually verified - Plan 27-02 approved without testing"
    artifacts:
      - path: "src/components/match/match-hero.tsx"
        issue: "Code structure correct but user approved 27-02 verification with 'approved cant test right now'"
    missing:
      - "Human verification: Does MatchHero actually render correctly when integrated?"
      - "Visual test: Team logos, names, competition, date/time all display properly?"

  - truth: "Live matches display current score and match minute"
    status: partial
    reason: "useLiveMatchMinute hook implemented correctly but MatchHero not integrated into live match pages"
    artifacts:
      - path: "src/components/match/use-live-match-minute.ts"
        issue: "Hook verified and working (polling, cleanup, visibility detection all present)"
      - path: "src/app/api/match-minute/[id]/route.ts"
        issue: "API route verified (fetches from API-Football, uses formatMatchMinute, 30s cache)"
      - path: "src/components/match/match-hero.tsx"
        issue: "Component uses hook correctly (line 30) but component is orphaned"
    missing:
      - "Integrate MatchHero into match pages so polling actually runs on live matches"
      - "Test live match page shows updating minute"

  - truth: "Upcoming matches show VS instead of score"
    status: verified_in_code
    reason: "Implementation correct (line 90 shows VS for upcoming) but not deployed/integrated"
    artifacts:
      - path: "src/components/match/match-hero.tsx"
        issue: "Code handles upcoming state correctly but component never used"
    missing:
      - "Integration needed to verify in actual pages"
---

# Phase 27: Hero Component Verification Report

**Phase Goal:** Create single authoritative score/VS display that renders match info exactly once  
**Verified:** 2026-02-03T19:30:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Executive Summary

**CRITICAL GAP: Phase goal NOT achieved.**

The MatchHero component was created and is substantive (195 lines, full implementation), BUT it is **completely orphaned** — not imported or used anywhere in the application. The old match-header.tsx component still renders the score/VS display, meaning the duplicate displays were never eliminated.

**What SUMMARY claimed:** "Single authoritative MatchHero component with live minute polling"  
**What ACTUALLY exists:** MatchHero sits unused while match-header.tsx continues to be the score display

This is a textbook case of "task completion ≠ goal achievement":
- ✅ Task "create MatchHero component" — DONE (file created)
- ✗ Goal "single authoritative score display" — FAILED (old duplicate still in use)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Score displays exactly once on the page (no duplicates) | ✗ FAILED | MatchHero orphaned; match-header.tsx still renders score at lines 100-120; both match pages use old header |
| 2 | Match hero shows teams, competition, kickoff time correctly | ? UNCERTAIN | Implementation looks correct but never visually verified (user said "cant test right now") and never integrated |
| 3 | Live matches display current score and match minute | ⚠️ PARTIAL | useLiveMatchMinute hook + API route verified working, but MatchHero not integrated so polling never activates |
| 4 | Upcoming matches show VS instead of score | ⚠️ CODE_ONLY | Line 90 handles this correctly in code, but component never deployed |

**Score:** 1/4 truths verified (only #4 passes code-level verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/match/match-hero.tsx` | Single authoritative score display component | ⚠️ ORPHANED | EXISTS (195 lines), SUBSTANTIVE (full implementation), NOT_WIRED (no imports, not used) |
| `src/components/match/use-live-match-minute.ts` | Polling hook with cleanup | ✓ VERIFIED | EXISTS (97 lines), SUBSTANTIVE (useRef, cleanup, visibility detection), WIRED (imported by MatchHero) |
| `src/app/api/match-minute/[id]/route.ts` | API endpoint returning current minute | ✓ VERIFIED | EXISTS (46 lines), SUBSTANTIVE (fetches from API-Football, uses formatMatchMinute), WIRED (called by hook) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| match-hero.tsx | MatchDataProvider context | useMatch() hook | ✓ WIRED | Line 29: `useMatch()` correctly consumes context |
| match-hero.tsx | use-live-match-minute.ts | useLiveMatchMinute() hook | ✓ WIRED | Line 30: `useLiveMatchMinute(match.externalId, matchState === 'live')` |
| use-live-match-minute.ts | /api/match-minute/[id] | fetch call | ✓ WIRED | Lines 37, 69: `fetch(\`/api/match-minute/\${externalId}\`)` |
| **CRITICAL MISSING LINK** | **match-hero.tsx** | **match pages** | ✗ NOT_WIRED | MatchHero not imported in /matches/[id]/page.tsx or /leagues/[slug]/[match]/page.tsx |

### Requirements Coverage

**Requirements:** LAYT-02, CONT-01, CONT-07

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| LAYT-02 (Single score render point) | ✗ BLOCKED | MatchHero exists but old match-header.tsx still renders score |
| CONT-01 (State-aware display) | ? UNCERTAIN | Code looks correct but never integrated/tested |
| CONT-07 (Live updates) | ⚠️ PARTIAL | Polling infrastructure works but component not deployed |

### Anti-Patterns Found

**No stub patterns in MatchHero implementation** — the component itself is fully substantive.

**CRITICAL ARCHITECTURAL GAP:**

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| match-hero.tsx | Component created but never integrated | 🛑 BLOCKER | Phase goal impossible - single score display not achieved |
| match-header.tsx | Old duplicate still in use | 🛑 BLOCKER | Lines 100-120 still render score/VS - not replaced |
| matches/[id]/page.tsx | Uses old MatchHeader (line 122) | 🛑 BLOCKER | Match pages never switched to new component |
| leagues/[slug]/[match]/page.tsx | Uses old MatchPageHeader→MatchHeader (line 201) | 🛑 BLOCKER | League match pages never switched to new component |

### Human Verification Required

**1. Visual Rendering Check (After Integration)**

**Test:** Navigate to a live match page (e.g., /matches/[id]) after MatchHero is integrated  
**Expected:**  
- Score/VS appears exactly once (in hero section, not in header/H1)
- Team logos display correctly
- Competition name and kickoff time visible
- Status badge shows correct state (LIVE/FT/Upcoming/etc)
- For live matches: minute updates every 30 seconds
- LIVE badge has NO pulsing/animation (solid red)

**Why human:** Visual appearance, animation behavior, live updates cannot be verified by grep

**2. State Coverage Check**

**Test:** View match pages in all states: upcoming, live, finished, postponed, cancelled  
**Expected:**  
- Upcoming: Shows "VS" (not score)
- Live: Shows score + minute + LIVE badge (no animation)
- Finished: Shows score + FT badge + winner highlighted green
- Postponed: Shows "POSTPONED" text instead of score
- Cancelled: Shows "CANCELLED" with line-through

**Why human:** Need to verify visual styling and state transitions in browser

**3. Polling Behavior Check**

**Test:** Open live match page, wait 30 seconds, check if minute updates  
**Expected:** Match minute (e.g., "67'") updates automatically every 30s  
**Why human:** Real-time behavior verification requires observing actual polling

**4. No Duplicates Check**

**Test:** Open match page and inspect entire page visually  
**Expected:** Score/VS appears ONLY in hero section (not in header, not in H1, not elsewhere)  
**Why human:** Need to verify complete page layout in browser context

## Gaps Summary

### Root Cause

Plan 27-01 created all artifacts but did NOT integrate them into match pages. Plan 27-02 was supposed to be visual verification but only created a temporary test harness (`/test-hero` page) — it never integrated MatchHero into the actual match pages.

**The gap:** Component built ✓, but never deployed ✗

### What's Missing

**To close gaps and achieve phase goal:**

1. **Integration (BLOCKER)**
   - Replace `MatchHeader` with `MatchHero` in `/matches/[id]/page.tsx`
   - Replace `MatchPageHeader` with `MatchHero` in `/leagues/[slug]/[match]/page.tsx`
   - Ensure MatchHero is wrapped in MatchDataProvider (already present)
   - Remove or deprecate `match-header.tsx` after migration

2. **Verification (BLOCKER)**
   - Test match page loads without errors
   - Verify score appears exactly once (visual check)
   - Test live match shows updating minute (polling works)
   - Verify all match states render correctly (upcoming/live/finished/postponed/cancelled)

3. **Cleanup (RECOMMENDED)**
   - Remove unused `match-header.tsx` after confirming MatchHero works
   - Remove `match-page-header.tsx` wrapper (just calls match-header)
   - Grep codebase for any other score displays that duplicate MatchHero

### Why This Happened

Plan 27-01 success criteria said: "MatchHero consumes context via useMatch() (not props)" ✓  
Plan 27-02 success criteria said: "User has visually verified MatchHero renders correctly" ✓  

**But neither plan said:** "Replace old match-header with MatchHero in actual pages"

The plans focused on building the artifact, not deploying it. The phase goal requires deployment.

## Technical Verification Details

### Level 1: Existence ✓

All three required files exist:
```bash
✓ src/components/match/match-hero.tsx (195 lines)
✓ src/components/match/use-live-match-minute.ts (97 lines)
✓ src/app/api/match-minute/[id]/route.ts (46 lines)
```

### Level 2: Substantive ✓

**match-hero.tsx:**
- Line count: 195 (well above 80 minimum)
- Has 'use client' directive (line 1)
- Uses useMatch() hook (line 29)
- Uses useLiveMatchMinute() hook (line 30)
- Handles all match states: upcoming (line 89), live (line 41, 169), finished (line 68-72), postponed (line 81), cancelled (line 85)
- LIVE badge has animate-none override (lines 176-177) per user decision
- No stub patterns (no TODO/FIXME/placeholder)
- Exports: `export function MatchHero()` (line 28)

**use-live-match-minute.ts:**
- Line count: 97 (well above 40 minimum)
- Uses useRef for interval (line 24) — prevents memory leaks
- Cleanup in useEffect return (lines 54-58)
- Visibility detection (lines 62-94)
- Fetches from /api/match-minute/[id] (lines 37, 69)
- No stub patterns

**route.ts:**
- Line count: 46 (above 10 minimum)
- Exports GET function (line 4)
- Fetches from API-Football (lines 11-19)
- Uses formatMatchMinute utility (line 32)
- Returns { minute: string | null } (lines 22, 29, 34, 44)
- 30s cache (line 17, 38)

### Level 3: Wired ⚠️

**Internal wiring (MatchHero ↔ hooks ↔ API): ✓ VERIFIED**
- MatchHero imports and calls useMatch() (line 29)
- MatchHero imports and calls useLiveMatchMinute() (line 30)
- useLiveMatchMinute fetches from API route (lines 37, 69)
- API route uses formatMatchMinute utility (line 32)

**External wiring (MatchHero ↔ pages): ✗ NOT_WIRED**
```bash
$ grep -r "import.*MatchHero" src --include="*.tsx" -l
src/components/match/match-hero.tsx  # Only itself
```

MatchHero is NOT imported by:
- `/matches/[id]/page.tsx` — uses MatchHeader (line 122)
- `/leagues/[slug]/[match]/page.tsx` — uses MatchPageHeader (line 201)

**This is the critical gap.**

### User Decision Compliance

**From 27-CONTEXT.md user decisions:**

| Decision | Requirement | Status | Evidence |
|----------|-------------|--------|----------|
| "Red 'LIVE' badge - classic solid red, no pulsing/animation" | animate-none override | ✓ VERIFIED | Lines 176-177: `className="animate-none"` |
| "No venue in hero - keep minimal" | No venue field | ✓ VERIFIED | No MapPin/venue rendering |
| "No form or league position in hero" | Not included | ✓ VERIFIED | No form/position data |
| "Always show match date for all states" | Date display | ✓ VERIFIED | Line 164: `format(kickoff, 'MMMM d, yyyy')` |
| "Polling update for match minute - auto-refresh every 30-60 seconds" | 30s interval | ✓ VERIFIED | Line 21: `intervalMs: number = 30000` |

All user decisions correctly implemented in code. But code is not deployed.

---

## Next Steps to Close Gaps

**Recommended approach:**

1. **Create Plan 27-03** (Integration): Replace match-header with match-hero in match pages
2. **Create Plan 27-04** (Verification): Test integration with human verification checklist
3. **Create Plan 27-05** (Cleanup): Remove deprecated match-header.tsx after migration

OR (faster):

1. **Create single gap-closure plan** that does all three: integration + verification + cleanup

**Key success criteria for gap closure:**
- MatchHero imported and used in both match page routes
- Old match-header.tsx removed or deprecated
- Score appears exactly once on match pages (human verified)
- Live match minute polling works (human verified)
- No TypeScript/build errors

---

_Verified: 2026-02-03T19:30:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Methodology: Goal-backward verification with 3-level artifact checking (exists, substantive, wired)_
