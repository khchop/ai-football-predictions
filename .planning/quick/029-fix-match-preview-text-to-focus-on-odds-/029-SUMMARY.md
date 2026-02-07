---
quick_task: 029
title: Fix match preview text to focus on odds, predictions & outcomes instead of hallucinated facts
subsystem: content-generation
tags: [llm, content-quality, anti-hallucination, match-preview]
dependency_graph:
  requires: [quick-027]
  provides: [hallucination-free-previews]
  affects: [match-detail-pages, seo-content-quality]
tech_stack:
  added: []
  patterns: [anti-hallucination-rules, data-constrained-prompts]
key_files:
  created: []
  modified:
    - src/lib/content/prompts.ts
    - src/lib/content/generator.ts
    - src/components/match/match-narrative.tsx
decisions:
  - Removed keyPlayers and tacticalAnalysis sections entirely (no data to support them)
  - Applied anti-hallucination pattern from league roundup prompt
  - Required answer-first structure (bookmaker odds in opening sentence)
  - DB columns remain (nullable) but won't be populated for new previews
metrics:
  duration: 98s
  completed: 2026-02-07
---

# Quick Task 029: Fix Match Preview Hallucination

**One-liner:** Rewrote match preview prompt to eliminate hallucinated player names, formations, and league standings by constraining LLM to provided data only (odds, predictions, form strings).

## Objective

Eliminate hallucinated content in match previews by removing sections that encourage speculation (keyPlayers, tacticalAnalysis) and adding strict anti-hallucination rules copied from the working league roundup prompt pattern.

## Implementation

### Task 1: Rewrite buildMatchPreviewPrompt to prevent hallucination

**Modified:** `src/lib/content/prompts.ts`

**Changes:**

1. **Removed hallucination-prone sections from JSON structure:**
   - Deleted `keyPlayers` field (no player data provided, LLM invented names)
   - Deleted `tacticalAnalysis` field (no formation data provided, LLM invented tactics)

2. **Updated remaining sections with data constraints:**
   - `introduction`: Added requirement "First sentence MUST state which team bookmakers favor and at what odds"
   - `teamFormAnalysis`: Added constraint "Use ONLY the form string (e.g., 'WWDWL') and goals data provided. Do NOT mention league table positions, relegation/title races, or player names."
   - `headToHead`: Changed to "H2H history analysis using ONLY the dates and scores provided. If no H2H data provided, write 'No recent head-to-head data available' (do not speculate)."

3. **Added strict anti-hallucination rules** (copied pattern from `buildLeagueRoundupPrompt`):
   ```
   CRITICAL ANTI-HALLUCINATION RULES:
   - Use ONLY the data provided above. Do NOT infer, guess, or add facts not explicitly in the data.
   - Do NOT mention league table positions, relegation/title races, or championship standings.
   - Do NOT mention player names, injuries, managers, or formations.
   - Do NOT mention specific dates of past matches unless provided in H2H data.
   - If data is not provided for a section, acknowledge it (e.g., "No H2H data available") instead of inventing content.
   - Focus on betting odds, AI predictions, form strings, and goal statistics ONLY.
   ```

4. **Updated MatchPreviewResponse interface:**
   - Removed `keyPlayers: string;`
   - Removed `tacticalAnalysis: string;`

**Commit:** `22c19f8` - feat(quick-029): rewrite match preview prompt to prevent hallucination

### Task 2: Remove references to deleted sections in generator and UI

**Modified:** `src/lib/content/generator.ts`, `src/components/match/match-narrative.tsx`

**Changes in generator.ts:**

1. Removed sanitization calls for deleted fields:
   - Deleted `const keyPlayers = sanitizeContent(result.content.keyPlayers);`
   - Deleted `const tacticalAnalysis = sanitizeContent(result.content.tacticalAnalysis);`
   - Deleted `validateNoHtml(keyPlayers);`
   - Deleted `validateNoHtml(tacticalAnalysis);`

2. Removed DB fields in `newPreview` object:
   - Deleted `keyPlayers,`
   - Deleted `tacticalAnalysis,`

**Changes in match-narrative.tsx:**

1. Updated PreviewData interface:
   - Removed `keyPlayers: string | null;`
   - Removed `tacticalAnalysis: string | null;`

2. Removed rendering blocks in `renderPreviewSections()`:
   - Deleted entire `{preview.keyPlayers && ...}` block (6 lines)
   - Deleted entire `{preview.tacticalAnalysis && ...}` block (6 lines)

**Verification:** `grep` confirmed zero references to `keyPlayers` or `tacticalAnalysis` in both files.

**Commit:** `c57f7f2` - fix(quick-029): remove keyPlayers and tacticalAnalysis from generator and UI

### Task 3: Document backfill requirement

**Modified:** `.planning/STATE.md`

Added to "Pending Todos":
```
- **Optional:** Regenerate match previews for existing matches to remove hallucinated content (new prompt only affects future generations)
```

**Note:** The `generateMatchPreview()` function uses `onConflictDoUpdate`, so calling it for any existing match will regenerate content with the new anti-hallucination prompt. Existing previews in the database still contain old hallucinated content.

**Backfill options:**
- **Automatic:** Next time any match page is visited, the preview regenerates if stale
- **Manual:** Run a script to call `generateMatchPreview(matchId)` for all matches with existing previews
- **Selective:** Regenerate only for high-traffic matches (top leagues, upcoming fixtures)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**Automated verification:**

1. Anti-hallucination rules confirmed in prompt:
   ```bash
   grep -A 5 "CRITICAL ANTI-HALLUCINATION RULES" src/lib/content/prompts.ts
   ```
   ✓ Rules block present with 6 constraints

2. Interface updated correctly:
   ```bash
   grep -A 10 "export interface MatchPreviewResponse" src/lib/content/prompts.ts
   ```
   ✓ No `keyPlayers` or `tacticalAnalysis` fields

3. Generator no longer references deleted fields:
   ```bash
   grep -n "keyPlayers\|tacticalAnalysis" src/lib/content/generator.ts
   ```
   ✓ No matches (exit code 1)

4. UI no longer references deleted fields:
   ```bash
   grep -n "keyPlayers\|tacticalAnalysis" src/components/match/match-narrative.tsx
   ```
   ✓ No matches (exit code 1)

5. Commits verified:
   ```bash
   git log --oneline -3 | grep "quick-029"
   git diff --name-only HEAD~2 HEAD
   ```
   ✓ 2 commits (22c19f8, c57f7f2) with all 3 files

**Manual verification (recommended):**
- Trigger match preview generation for an upcoming match
- Verify output JSON no longer contains keyPlayers or tacticalAnalysis
- Verify introduction leads with bookmaker odds
- Verify teamFormAnalysis doesn't mention league table positions or player names
- Visit a match detail page and confirm no "Key Players" or "Tactical Analysis" sections

## Impact

**Before:**
- LLM hallucinated player names not in data (e.g., "Harry Kane will lead the line" for matches he's not in)
- LLM invented league standings (e.g., "fighting relegation" when team is mid-table)
- LLM fabricated formations (e.g., "4-3-3" when no tactical data provided)
- LLM speculated on H2H when no data available

**After:**
- LLM constrained to: betting odds, AI predictions, form strings (WWDWL), goals scored/conceded
- Answer-first structure: bookmaker favorite stated in opening sentence
- Honest acknowledgment: "No H2H data available" instead of speculation
- No player names, no league positions, no formations

**SEO impact:** Improved content quality and factual accuracy, reducing risk of misinformation and improving user trust.

**DB impact:** `keyPlayers` and `tacticalAnalysis` columns in `matchPreviews` table remain (nullable text) but won't be populated for new previews. Old records still have hallucinated content until regenerated.

## Technical Notes

**Anti-hallucination pattern (reusable):**

1. List ONLY the data you're providing (odds, form, goals, H2H)
2. Add "CRITICAL ANTI-HALLUCINATION RULES" block BEFORE writing guidelines
3. Explicitly forbid categories of speculation (players, standings, formations)
4. Require acknowledgment when data missing ("No H2H data available")
5. Focus output on verifiable data only

**Pattern source:** `buildLeagueRoundupPrompt` lines 189-196 (already working correctly)

**DB schema note:** Optional (nullable) columns can be left unpopulated without breaking existing code. TypeScript interfaces should match what the LLM returns, not what the DB schema allows.

## Next Phase Readiness

**Blockers:** None

**Enables:**
- Clean, hallucination-free match preview content
- Foundation for applying same anti-hallucination pattern to other content types
- Improved SEO content quality for match detail pages

## Self-Check: PASSED

**Created files:** None (only modifications)

**Modified files:**
```bash
[ -f "src/lib/content/prompts.ts" ] && echo "FOUND: src/lib/content/prompts.ts" || echo "MISSING"
[ -f "src/lib/content/generator.ts" ] && echo "FOUND: src/lib/content/generator.ts" || echo "MISSING"
[ -f "src/components/match/match-narrative.tsx" ] && echo "FOUND: src/components/match/match-narrative.tsx" || echo "MISSING"
```
✓ FOUND: src/lib/content/prompts.ts
✓ FOUND: src/lib/content/generator.ts
✓ FOUND: src/components/match/match-narrative.tsx

**Commits exist:**
```bash
git log --oneline --all | grep "22c19f8" && echo "FOUND: 22c19f8" || echo "MISSING"
git log --oneline --all | grep "c57f7f2" && echo "FOUND: c57f7f2" || echo "MISSING"
```
✓ FOUND: 22c19f8
✓ FOUND: c57f7f2

## Success Criteria: ALL MET

- [x] `buildMatchPreviewPrompt()` removes keyPlayers and tacticalAnalysis from JSON structure
- [x] Anti-hallucination rules added (no player names, no league positions, no formations)
- [x] introduction section requires answer-first with bookmaker odds
- [x] teamFormAnalysis constrained to form strings and goals data only
- [x] MatchPreviewResponse interface updated (removes 2 fields)
- [x] generator.ts no longer sanitizes or saves removed fields
- [x] match-narrative.tsx no longer renders removed sections
- [x] PreviewData interface updated (removes 2 fields)
- [x] Changes committed with descriptive messages (2 commits)
- [x] Backfill requirement documented for user decision

---

**Duration:** 98 seconds (1m 38s)
**Completed:** 2026-02-07
**Agent:** GSD execute-phase
