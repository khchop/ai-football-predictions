---
phase: quick-39
plan: 01
subsystem: seo-content
tags: [seo, faq, structured-data, content-quality]
completed_at: 2026-02-10T21:23:32Z
duration_minutes: 3

dependency_graph:
  requires: []
  provides:
    - "Dynamic FAQ generation with real prediction statistics"
    - "Self-contained FAQ answers (no UI redirects)"
    - "SEO-optimized FAQ content for AI search engines"
  affects:
    - "Match detail pages (all states: upcoming, live, finished)"
    - "FAQPage JSON-LD schema (inherits enriched content)"

tech_stack:
  added: []
  patterns:
    - "Server-side data enrichment for SSR FAQs"
    - "Client-side context consumption for fallback FAQs"
    - "Optional enrichment parameters (backward compatible)"

key_files:
  created: []
  modified:
    - path: "src/components/match/MatchFAQSchema.tsx"
      changes: "Added PredictionSummary interface, enhanced generateMatchFAQs with dynamic answers"
    - path: "src/app/leagues/[slug]/[match]/page.tsx"
      changes: "Build predictionSummary from raw predictions, pass to generateMatchFAQs"
    - path: "src/components/match/match-layout.tsx"
      changes: "Thread predictionSummary through to MatchFAQ component"
    - path: "src/components/match/match-faq.tsx"
      changes: "Access analysis from useMatch() context, pass to generateMatchFAQs"

decisions:
  - decision: "Replace 'how to watch' FAQ with 'who is favored' using real odds/H2H data"
    rationale: "Generic 'how to watch' has no SEO value. Odds + H2H provides substantive data for featured snippets."
    alternatives_considered: ["Keep generic", "Add both"]
    chosen: "Replace with data-rich alternative"

  - decision: "Replace 'goalscorers' FAQ with 'pre-match odds' for finished matches"
    rationale: "No match events section exists (goalscorers placeholder was incorrect). Odds data is available and SEO-valuable."
    alternatives_considered: ["Remove entirely", "Add live events tracking"]
    chosen: "Replace with available data"

  - decision: "Team form FAQ falls back to venue question when form data unavailable"
    rationale: "Graceful degradation preserves 5-FAQ structure while prioritizing data-rich content when available."
    alternatives_considered: ["Always show team form", "Always show venue"]
    chosen: "Conditional rendering based on data availability"

metrics:
  lines_changed: 221
  files_modified: 4
  commits: 2
---

# Quick Task 39: Optimize Match Detail Page FAQ for SEO

**One-liner:** Template FAQs now contain real prediction stats, odds, H2H records, and team form instead of generic placeholders, improving SEO/GEO quality.

## Overview

Replaced generic/static template FAQ answers with fully dynamic, data-rich answers that use actual prediction statistics, odds, H2H records, and team form data. This makes the fallback FAQs (used when AI-generated FAQs aren't available) produce SEO/GEO-quality content with real numbers instead of placeholders like "check the table above" or "GPT-4, Claude, and Gemini."

**Impact:** Match detail pages now provide substantive FAQ content for AI search engines even when AI-generated FAQs are unavailable. Answers are self-contained (no UI redirects) and contain actual data that improves featured snippet eligibility.

## Tasks Completed

### Task 1: Enhanced FAQ Generation with Dynamic Data

**Commit:** `1a7fb40`

**Changes:**
- Added `PredictionSummary` interface with model stats, scorelines, accuracy metrics
- Extended `generateMatchFAQs()` to accept optional `{ predictions, analysis }` parameter
- Maintained backward compatibility (2-parameter signature still works)

**Upcoming/Live Match FAQs (rewritten):**
1. **Kickoff time** - Already dynamic with date/time/venue
2. **Predictions summary** - Real data: "{N} AI models analyzed this match. {homeWinCount} predict a {home} win, {drawCount} predict a draw, {awayWinCount} predict an {away} win. The most predicted scoreline is {topScoreline} (predicted by {count} models). Models include {first 4 names}."
3. **Who is favored?** (replaces "how to watch") - Real odds: "Based on betting odds, {favoriteTeam} is favored with odds of {home}/{draw}/{away}. Expert tip: {advice}. In {h2hTotal} head-to-head meetings, {home} has won {homeWins}, drawn {draws}, with {awayWins} {away} wins."
4. **Team form** (replaces venue) - Real form: "{home}'s recent form is {WWLDL} with {goalsScored} scored and {goalsConceded} conceded in their last 5 matches. {away}'s form is {LWDWW} with {scored} scored and {conceded} conceded." (Falls back to venue question if form unavailable)
5. **AI methodology** - Dynamic with actual model count

**Finished Match FAQs (rewritten):**
1. **Final score** - Already dynamic with actual score
2. **Prediction accuracy** - Real data: "Of {N} AI models, {correctResultCount} correctly predicted the match outcome and {exactScoreCount} predicted the exact score of {score}. Top performers were {top 3 models}. The most popular prediction of {scoreline} was correct."
3. **Pre-match odds** (replaces goalscorers) - Real odds: "Pre-match betting odds were {home} (home), {draw} (draw), {away} (away). The expert tip was: {advice}. The match ended {score}."
4. **Competition context** - Already dynamic with competition name
5. **AI methodology** - Dynamic with actual model count

**Graceful degradation:** When enrichment data unavailable, answers are generic but self-contained (no "see above" redirects).

**Files modified:**
- `src/components/match/MatchFAQSchema.tsx` (150 insertions, 29 deletions)

### Task 2: Wired Enriched Data to Call Sites

**Commit:** `15dc498`

**Changes:**

**A. Server-side (page.tsx):**
- Build `PredictionSummary` from raw predictions array:
  - Count home/draw/away predictions
  - Find most predicted scoreline and count
  - Calculate accuracy stats for finished matches (correctResultCount, exactScoreCount, topScorerNames)
- Pass `{ predictions: predictionSummary, analysis }` to `generateMatchFAQs()`
- Thread `predictionSummary` through to `MatchLayout` component

**B. Client-side (match-faq.tsx):**
- Access `analysis` from `useMatch()` context
- Receive `predictionSummary` from props
- Pass both to `generateMatchFAQs()` fallback

**C. Threading (match-layout.tsx):**
- Accept `predictionSummary` prop
- Pass to `MatchFAQ` component

**Result:** Both server-side (SSR) and client-side (fallback) FAQs use enriched data. The JSON-LD FAQPage schema automatically inherits enriched content since it receives the `faqs` array from page.tsx.

**Files modified:**
- `src/app/leagues/[slug]/[match]/page.tsx` (59 insertions, 10 deletions)
- `src/components/match/match-layout.tsx` (8 insertions, 2 deletions)
- `src/components/match/match-faq.tsx` (11 insertions, 3 deletions)

## Verification Results

- TypeScript compilation: PASSED (no errors in modified files)
- Build (webpack mode): PASSED
- Manual inspection: No "see above", "check the table", or hardcoded model names remain
- Backward compatibility: `generateMatchFAQs(match, competition)` still works without optional parameter
- Self-contained answers: All FAQ answers contain data inline (no UI redirects)

## Deviations from Plan

None. Plan executed exactly as written.

## Impact Assessment

**SEO/GEO Benefits:**
- Template FAQs now provide substantive content for AI search engines
- Featured snippet eligibility improved (real data vs generic placeholders)
- Self-contained answers reduce bounce rate (no need to find UI sections)

**Content Quality:**
- Prediction FAQ: Real model count and vote distribution instead of "GPT-4, Claude, and Gemini"
- Odds FAQ: Actual odds, expert tips, H2H records instead of "check your local broadcaster"
- Team Form FAQ: Real form strings (WWLDL) and goal stats instead of venue question (when data available)
- Accuracy FAQ: Actual correct/exact counts and top performers instead of "check the predictions table above"

**User Experience:**
- FAQ answers are immediately useful without requiring users to find referenced sections
- More specific, data-driven answers vs generic placeholders

**Technical:**
- Backward compatible (existing 2-param signature works)
- Graceful degradation (generic but self-contained answers when data unavailable)
- No breaking changes to API surface

## Next Steps

No follow-up actions required. This quick task is complete and self-contained.

## Self-Check: PASSED

**Files exist:**
```bash
✓ FOUND: src/components/match/MatchFAQSchema.tsx
✓ FOUND: src/app/leagues/[slug]/[match]/page.tsx
✓ FOUND: src/components/match/match-layout.tsx
✓ FOUND: src/components/match/match-faq.tsx
```

**Commits exist:**
```bash
✓ FOUND: 1a7fb40 (Task 1: Enhanced FAQ generation)
✓ FOUND: 15dc498 (Task 2: Wired enriched data to call sites)
```

**Build verification:**
```bash
✓ npx tsc --noEmit: No errors in modified files
✓ npx next build --webpack: Build succeeded
```

**Content verification:**
```bash
✓ No "see above" redirects in FAQ answers
✓ No "check the table" phrases in FAQ answers
✓ No hardcoded "GPT-4, Claude, and Gemini" placeholders
✓ generateMatchFAQs(match, competition) backward compatibility confirmed
✓ generateMatchFAQs(match, competition, { predictions, analysis }) enrichment confirmed
```
