---
phase: quick-030
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  truths:
    - "All existing match previews regenerated with anti-hallucination prompt"
    - "Script reports progress and completion statistics"
  artifacts:
    - path: "scripts/backfill-match-previews.ts"
      provides: "One-time backfill script to regenerate all match previews"
      min_lines: 100
  key_links:
    - from: "scripts/backfill-match-previews.ts"
      to: "src/lib/content/generator.ts"
      via: "generateMatchPreview function call"
      pattern: "generateMatchPreview"
    - from: "scripts/backfill-match-previews.ts"
      to: "src/lib/content/queries.ts"
      via: "getMatchBetsForPreview function call"
      pattern: "getMatchBetsForPreview"
---

<objective>
Create one-time backfill script to regenerate all existing match previews using the new anti-hallucination prompt from quick-029.

Purpose: Remove hallucinated content (wrong standings, fictional players, made-up tactics) from existing database previews. The new prompt focuses on odds, AI predictions, and observable data only.

Output: Executable backfill script that safely overwrites all existing previews.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@scripts/backfill-post-match-content.ts
@src/lib/content/generator.ts
@src/lib/content/queries.ts
@src/lib/db/schema.ts
</context>

<tasks>

<task type="auto">
  <name>Create backfill script for match previews</name>
  <files>scripts/backfill-match-previews.ts</files>
  <action>
Create `scripts/backfill-match-previews.ts` following the pattern from `scripts/backfill-post-match-content.ts`:

1. **Query logic:** Select ALL matches that have existing previews:
   - Inner join `matches` + `matchPreviews` + `competitions`
   - Left join `matchAnalysis` (analysis may be missing for some)
   - Where: `matchPreviews.id IS NOT NULL` (only regenerate existing previews)
   - Select: matchId, homeTeam, awayTeam, kickoffTime, venue, competitionName, analysis
   - Order by kickoffTime

2. **Processing loop:**
   - BATCH_SIZE = 3 (not 5 — previews use structured JSON output, heavier than post-match)
   - DELAY_BETWEEN_BATCHES = 3000ms (3 seconds)
   - For each match:
     a. Call `getMatchBetsForPreview(matchId)` to get AI predictions
     b. Call `generateMatchPreview()` with matchData object:
        ```ts
        await generateMatchPreview({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competitionName,
          kickoffTime: match.kickoffTime,
          venue: match.venue ?? undefined,
          analysis: match.analysis ?? undefined,
          aiPredictions,
        });
        ```
     c. Log progress: "  - {homeTeam} vs {awayTeam}... ✓ Regenerated"
     d. Catch errors: log "  ✗ Error: {error.message}", continue

3. **Summary reporting:**
   - Total matches processed
   - Success count
   - Fail count
   - List of failed matches (if any)
   - Exit code 1 if failures, 0 if all success

4. **Imports needed:**
   - `{ getDb, matches, matchPreviews, competitions, matchAnalysis }` from '@/lib/db'
   - `{ eq, and, isNotNull }` from 'drizzle-orm'
   - `{ generateMatchPreview }` from '@/lib/content/generator'
   - `{ getMatchBetsForPreview }` from '@/lib/content/queries'

**Note:** `generateMatchPreview` already uses `onConflictDoUpdate` targeting `matchPreviews.matchId`, so it will safely overwrite existing previews.
  </action>
  <verify>
1. Script exists: `ls scripts/backfill-match-previews.ts`
2. TypeScript compiles: `npx tsc --noEmit scripts/backfill-match-previews.ts`
3. Dry-run check: Script queries DB correctly (can test query logic without running full generation)
  </verify>
  <done>
- Script created at `scripts/backfill-match-previews.ts`
- Follows backfill pattern (batch processing, delays, error handling)
- Queries all existing previews from DB
- Calls `generateMatchPreview()` with full match data + AI predictions
- Processes in batches of 3 with 3s delays
- Logs progress and final statistics
- TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. Script structure matches `scripts/backfill-post-match-content.ts` pattern
2. Query joins all required tables (matches, matchPreviews, competitions, matchAnalysis)
3. Batch size is 3 (appropriate for JSON structured output)
4. Delay is 3000ms between batches
5. Error handling preserves continuation (one failure doesn't stop entire backfill)
6. Final summary reports total/success/fail counts
</verification>

<success_criteria>
- Backfill script exists and compiles
- Ready to execute: `npx tsx scripts/backfill-match-previews.ts`
- Will regenerate all existing match previews with anti-hallucination prompt
- Safe to run (uses upsert, won't create duplicates)
</success_criteria>

<output>
After completion, create `.planning/quick/030-backfill-regenerate-match-previews-anti-/030-SUMMARY.md`
</output>
