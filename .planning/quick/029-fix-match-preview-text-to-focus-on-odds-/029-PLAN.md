---
quick_task: 029
title: Fix match preview text to focus on odds, predictions & outcomes instead of hallucinated facts
type: execute
autonomous: true
files_modified:
  - src/lib/content/prompts.ts
  - src/lib/content/generator.ts
  - src/components/match/match-narrative.tsx
---

<objective>
Rewrite match preview prompt to focus on DATA WE HAVE (odds, predictions, form) instead of DATA WE DON'T (player names, tactics, formations).

**Problem:** Current prompt asks for "keyPlayers" and "tacticalAnalysis" sections, encouraging LLM to hallucinate wrong league standings, fictional player names, made-up formations, and random match facts not in the provided data.

**Solution:** Remove hallucination-prone sections (keyPlayers, tacticalAnalysis), add strict anti-hallucination rules (like the league roundup prompt has), and require answer-first structure (lead with bookmaker odds).

**Purpose:** Eliminate hallucinated content in match previews, focusing on verifiable data-driven analysis.

**Output:** Clean match preview prompt that generates factual content constrained to provided data.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/pieterbos/Documents/bettingsoccer/.planning/STATE.md
@/Users/pieterbos/Documents/bettingsoccer/src/lib/content/prompts.ts
@/Users/pieterbos/Documents/bettingsoccer/src/lib/content/generator.ts
@/Users/pieterbos/Documents/bettingsoccer/src/components/match/match-narrative.tsx
</context>

<tasks>

<task type="auto">
  <name>Rewrite buildMatchPreviewPrompt to prevent hallucination</name>
  <files>
    src/lib/content/prompts.ts
  </files>
  <action>
**In `buildMatchPreviewPrompt()` (lines 52-115):**

1. **Remove hallucination-prone sections from JSON structure:**
   - DELETE `keyPlayers` - we don't provide player data, LLM invents names
   - DELETE `tacticalAnalysis` - we don't provide formation data, LLM invents tactics
   - KEEP `headToHead` only if `data.h2hHistory` exists (guard with conditional in prompt)

2. **Update remaining sections with data constraints:**
   - `introduction`: Add requirement "First sentence MUST state which team bookmakers favor and at what odds (e.g., 'Bookmakers favor Arsenal at 1.65 to beat Chelsea in this Premier League clash')"
   - `teamFormAnalysis`: Add constraint "Use ONLY the form string (e.g., 'WWDWL') and goals data provided. Do NOT mention league table positions, relegation/title races, or player names."
   - `headToHead`: Change to "H2H history analysis using ONLY the dates and scores provided. If no H2H data provided, write 'No recent head-to-head data available' (do not speculate)."
   - `prediction`: Keep as-is (already data-focused)
   - `bettingInsights`: Keep as-is (already data-focused)

3. **Add strict anti-hallucination rules** (copy pattern from `buildLeagueRoundupPrompt` lines 189-196):

```
CRITICAL ANTI-HALLUCINATION RULES:
- Use ONLY the data provided above. Do NOT infer, guess, or add facts not explicitly in the data.
- Do NOT mention league table positions, relegation/title races, or championship standings.
- Do NOT mention player names, injuries, managers, or formations.
- Do NOT mention specific dates of past matches unless provided in H2H data.
- If data is not provided for a section, acknowledge it (e.g., "No H2H data available") instead of inventing content.
- Focus on betting odds, AI predictions, form strings, and goal statistics ONLY.
```

Add this block BEFORE the "Writing Guidelines" section (around line 102).

4. **Update MatchPreviewResponse interface** (lines 439-449):
   - Remove `keyPlayers: string;`
   - Remove `tacticalAnalysis: string;`

**Do NOT change the league roundup prompt** - it already has proper anti-hallucination rules and is working correctly.
  </action>
  <verify>
```bash
# Verify prompt structure updated
grep -A 5 "CRITICAL ANTI-HALLUCINATION RULES" src/lib/content/prompts.ts

# Verify interface updated
grep -A 10 "export interface MatchPreviewResponse" src/lib/content/prompts.ts | grep -v "keyPlayers\|tacticalAnalysis"
```
  </verify>
  <done>
- `buildMatchPreviewPrompt()` JSON structure removes keyPlayers and tacticalAnalysis
- Anti-hallucination rules added before Writing Guidelines
- introduction section requires answer-first with bookmaker odds
- teamFormAnalysis constrained to form strings and goals only
- MatchPreviewResponse interface removes keyPlayers and tacticalAnalysis fields
  </done>
</task>

<task type="auto">
  <name>Remove references to deleted sections in generator and UI</name>
  <files>
    src/lib/content/generator.ts
    src/components/match/match-narrative.tsx
  </files>
  <action>
**In `src/lib/content/generator.ts` (lines 83-141):**

1. **Remove sanitization calls** for deleted fields (lines 87-88, 97-98):
   - DELETE `const keyPlayers = sanitizeContent(result.content.keyPlayers);`
   - DELETE `const tacticalAnalysis = sanitizeContent(result.content.tacticalAnalysis);`
   - DELETE `validateNoHtml(keyPlayers);`
   - DELETE `validateNoHtml(tacticalAnalysis);`

2. **Remove DB fields** in `newPreview` object (lines 113-114):
   - DELETE `keyPlayers,`
   - DELETE `tacticalAnalysis,`

**In `src/components/match/match-narrative.tsx`:**

1. **Update PreviewData interface** (lines 9-17):
   - DELETE `keyPlayers: string | null;`
   - DELETE `tacticalAnalysis: string | null;`

2. **Remove rendering blocks** in `renderPreviewSections()` (lines 45-57):
   - DELETE the entire `{preview.keyPlayers && ...}` block (lines 45-50)
   - DELETE the entire `{preview.tacticalAnalysis && ...}` block (lines 52-57)
   - Preserve rendering for: introduction, teamFormAnalysis, headToHead (conditional), prediction, bettingInsights
  </action>
  <verify>
```bash
# Verify generator no longer references deleted fields
grep -n "keyPlayers\|tacticalAnalysis" src/lib/content/generator.ts

# Verify UI no longer references deleted fields
grep -n "keyPlayers\|tacticalAnalysis" src/components/match/match-narrative.tsx

# Both commands should return no results (exit code 1)
```
  </verify>
  <done>
- generator.ts no longer sanitizes or saves keyPlayers/tacticalAnalysis
- match-narrative.tsx PreviewData interface removes both fields
- renderPreviewSections() no longer renders keyPlayers or tacticalAnalysis sections
- grep confirms zero references to deleted fields in both files
  </done>
</task>

<task type="auto">
  <name>Commit changes and note backfill requirement</name>
  <files>
    src/lib/content/prompts.ts
    src/lib/content/generator.ts
    src/components/match/match-narrative.tsx
  </files>
  <action>
1. **Commit changes:**

```bash
node /Users/pieterbos/.claude/get-shit-done/bin/gsd-tools.js commit "fix(quick-029): prevent match preview hallucination, focus on odds & predictions" --files src/lib/content/prompts.ts src/lib/content/generator.ts src/components/match/match-narrative.tsx
```

2. **Create backfill note** in STATE.md pending todos:

The `generateMatchPreview()` function uses `onConflictDoUpdate` - calling it for any existing match will regenerate content with the new anti-hallucination prompt. Existing previews in the database still contain old hallucinated content (wrong standings, fictional players, made-up tactics).

**Options for backfill:**
- **Automatic:** Next time any match page is visited, the preview regenerates if stale
- **Manual:** Run a script to call `generateMatchPreview(matchId)` for all matches with existing previews
- **Selective:** Regenerate only for high-traffic matches (top leagues, upcoming fixtures)

User asked "also for older matches possible?" - yes, but requires intentional regeneration (not automatic on this commit).

Add to STATE.md under "Pending Todos":
```
- **Optional:** Regenerate match previews for existing matches to remove hallucinated content (new prompt only affects future generations)
```
  </action>
  <verify>
```bash
# Verify commit created
git log -1 --oneline | grep "quick-029"

# Verify files committed
git diff --name-only HEAD~1 HEAD | grep -E "(prompts|generator|match-narrative)"
```
  </verify>
  <done>
- Changes committed with message referencing quick-029
- All three files (prompts.ts, generator.ts, match-narrative.tsx) in commit
- Backfill requirement noted (existing DB records need manual regeneration)
  </done>
</task>

</tasks>

<verification>
**Manual verification (optional):**

1. **Test new prompt locally:**
   - Trigger match preview generation for an upcoming match
   - Verify output JSON no longer contains keyPlayers or tacticalAnalysis
   - Verify introduction leads with bookmaker odds
   - Verify teamFormAnalysis doesn't mention league table positions or player names

2. **Check UI rendering:**
   - Visit a match detail page with preview
   - Verify no "Key Players" or "Tactical Analysis" sections appear
   - Verify remaining sections (Introduction, Team Form, Prediction, Betting Insights) render correctly

3. **Backfill decision:**
   - Decide whether to regenerate existing previews (manual script needed)
   - Or wait for automatic regeneration on next visit/update
</verification>

<success_criteria>
- [ ] `buildMatchPreviewPrompt()` removes keyPlayers and tacticalAnalysis from JSON structure
- [ ] Anti-hallucination rules added (no player names, no league positions, no formations)
- [ ] introduction section requires answer-first with bookmaker odds
- [ ] teamFormAnalysis constrained to form strings and goals data only
- [ ] MatchPreviewResponse interface updated (removes 2 fields)
- [ ] generator.ts no longer sanitizes or saves removed fields
- [ ] match-narrative.tsx no longer renders removed sections
- [ ] PreviewData interface updated (removes 2 fields)
- [ ] Changes committed with descriptive message
- [ ] Backfill requirement documented for user decision
</success_criteria>

<output>
After completion, create `.planning/quick/029-fix-match-preview-text-to-focus-on-odds-/029-SUMMARY.md`
</output>
