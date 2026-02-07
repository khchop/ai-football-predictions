---
phase: quick-026
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/generator.ts
  - src/lib/db/queries.ts
  - src/app/api/matches/[id]/content/route.ts
  - src/components/match/match-narrative.tsx
  - src/app/leagues/[slug]/[match]/page.tsx
autonomous: true

must_haves:
  truths:
    - "Finished matches show the model-performance-focused post-match report (not generic roundup narrative)"
    - "Upcoming matches show rich preview content (introduction, form analysis, prediction) instead of placeholder"
    - "Predictions are shown exactly once on match detail pages (no duplicate widget)"
  artifacts:
    - path: "src/lib/content/generator.ts"
      provides: "Conditional matchContent write in generatePostMatchRoundup"
      contains: "postMatchContent"
    - path: "src/lib/db/queries.ts"
      provides: "Reversed COALESCE priority in getMatchContentUnified"
      contains: "COALESCE"
    - path: "src/app/api/matches/[id]/content/route.ts"
      provides: "Preview data in content API response"
      contains: "getMatchPreview"
    - path: "src/components/match/match-narrative.tsx"
      provides: "Rich preview rendering for upcoming matches"
      contains: "previewData"
  key_links:
    - from: "src/app/api/matches/[id]/content/route.ts"
      to: "src/lib/content/queries.ts"
      via: "getMatchPreview import"
      pattern: "getMatchPreview"
    - from: "src/components/match/match-narrative.tsx"
      to: "/api/matches/[id]/content"
      via: "fetch in useEffect"
      pattern: "fetch.*api/matches"
---

<objective>
Fix three match page issues: (1) stop roundup generator from overwriting the good model-performance post-match content, and reverse COALESCE to prefer matchContent.postMatchContent over roundup narrative, (2) expose matchPreviews data through the content API and render it in MatchNarrative for upcoming matches, (3) remove duplicate PredictingModelsWidget from match page.

Purpose: Match detail pages currently show generic roundup narratives instead of the richer model-performance reports, show "Analysis pending" for upcoming matches despite having preview data in the database, and render predictions twice.
Output: Correct content display for all match states with no duplications.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/content/generator.ts (lines 894-915: roundup backward-compat write to matchContent)
@src/lib/db/queries.ts (lines 2682-2745: getMatchContentUnified with COALESCE)
@src/app/api/matches/[id]/content/route.ts (content API route)
@src/components/match/match-narrative.tsx (narrative display component)
@src/app/leagues/[slug]/[match]/page.tsx (match page with duplicate widget)
@src/lib/content/queries.ts (lines 256-266: getMatchPreview query)
@src/lib/db/schema.ts (lines 422-458: matchPreviews table schema)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix post-match content overwrite and COALESCE priority</name>
  <files>
    src/lib/content/generator.ts
    src/lib/db/queries.ts
  </files>
  <action>
  **In `src/lib/content/generator.ts` (~line 894-915):**

  Make the backward-compatibility write to `matchContent.postMatchContent` conditional. Only write if `postMatchContent` is currently NULL. Change the `onConflictDoUpdate` set clause to use a SQL conditional:

  Replace the unconditional `postMatchContent: roundupHtml` in the `set:` object with:
  ```
  postMatchContent: sql`CASE WHEN ${matchContent.postMatchContent} IS NULL THEN ${roundupHtml} ELSE ${matchContent.postMatchContent} END`
  ```

  This preserves the good model-performance report written by the scoring worker while still providing roundup HTML as fallback if no postMatchContent exists yet.

  Import `sql` from `drizzle-orm` if not already imported at the top of generator.ts.

  **In `src/lib/db/queries.ts` (~line 2698):**

  Reverse the COALESCE priority in `getMatchContentUnified`. Change:
  ```sql
  COALESCE(${matchRoundups.narrative}, ${matchContent.postMatchContent})
  ```
  To:
  ```sql
  COALESCE(${matchContent.postMatchContent}, ${matchRoundups.narrative})
  ```

  This ensures the model-performance focused postMatchContent (from scoring worker) is preferred when it exists, falling back to the roundup narrative when it does not.

  Also update the comment on that line from "prefer roundup narrative (long-form)" to "prefer matchContent post-match (model performance focus) over roundup narrative".

  Update the JSDoc comment on the function (around line 2670-2671) to reflect the new priority: matchContent.postMatchContent is preferred because it contains model performance data, roundup narrative is the fallback.
  </action>
  <verify>
  Run `npx next build --webpack 2>&1 | tail -20` to verify no TypeScript or build errors. Grep for the updated COALESCE: `grep -n "COALESCE" src/lib/db/queries.ts` should show postMatchContent first. Grep for the conditional write: `grep -n "IS NULL" src/lib/content/generator.ts` should show the new CASE WHEN guard.
  </verify>
  <done>
  The roundup generator no longer overwrites existing postMatchContent. The unified query prefers matchContent.postMatchContent (model performance data) over roundup narrative. Build passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Expose match preview data and remove duplicate predictions widget</name>
  <files>
    src/app/api/matches/[id]/content/route.ts
    src/components/match/match-narrative.tsx
    src/app/leagues/[slug]/[match]/page.tsx
  </files>
  <action>
  **In `src/app/api/matches/[id]/content/route.ts`:**

  Import `getMatchPreview` from `@/lib/content/queries`. After fetching `getMatchContentUnified`, also fetch the preview data in parallel:

  ```typescript
  import { getMatchPreview } from '@/lib/content/queries';

  // Inside GET handler, replace single query with parallel fetch:
  const [content, preview] = await Promise.all([
    getMatchContentUnified(id),
    getMatchPreview(id),
  ]);
  ```

  Update the response to include preview data. When no content exists, still return preview if available:

  ```typescript
  return NextResponse.json({
    preMatchContent: content?.preMatchContent || null,
    postMatchContent: content?.postMatchContent || null,
    preview: preview ? {
      introduction: preview.introduction,
      teamFormAnalysis: preview.teamFormAnalysis,
      headToHead: preview.headToHead,
      keyPlayers: preview.keyPlayers,
      tacticalAnalysis: preview.tacticalAnalysis,
      prediction: preview.prediction,
      bettingInsights: preview.bettingInsights,
    } : null,
  });
  ```

  Return this shape for both the "no content" case (status 200 with nulls) and the normal case.

  **In `src/components/match/match-narrative.tsx`:**

  Update the `NarrativeContent` interface to include preview data:

  ```typescript
  interface PreviewData {
    introduction: string;
    teamFormAnalysis: string;
    headToHead: string | null;
    keyPlayers: string | null;
    tacticalAnalysis: string | null;
    prediction: string;
    bettingInsights: string | null;
  }

  interface NarrativeContent {
    preMatchContent: string | null;
    postMatchContent: string | null;
    preview: PreviewData | null;
  }
  ```

  Update the content rendering logic. For upcoming/live matches, prefer preview data over plain preMatchContent. When `preview` exists and `!isFinished`:

  Render structured preview sections instead of plain text:
  - Introduction paragraph
  - "Team Form" section with `preview.teamFormAnalysis`
  - "Head to Head" section with `preview.headToHead` (if non-null)
  - "Key Players" section with `preview.keyPlayers` (if non-null)
  - "Tactical Analysis" section with `preview.tacticalAnalysis` (if non-null)
  - "Prediction" section with `preview.prediction`
  - "Betting Insights" section with `preview.bettingInsights` (if non-null)

  Each section as an `<h3>` with corresponding paragraph, all inside the existing Card/prose structure. Fall back to `preMatchContent` plain text if no preview data. Keep the existing postMatchContent rendering for finished matches as-is, but render it with `dangerouslySetInnerHTML` if it contains HTML tags (check with `/<[a-z][\s\S]*>/i.test(text)`), otherwise render as plain text. This handles both the HTML roundup content and plain text model performance content correctly.

  **In `src/app/leagues/[slug]/[match]/page.tsx`:**

  Remove lines 191-193 (the Suspense-wrapped PredictingModelsWidget). This is duplicated by SortablePredictionsTable inside MatchLayout. Also remove the import of `PredictingModelsWidget` (line 15) and the `Skeleton` import (line 16) if it is no longer used elsewhere in the file. Check if Suspense (line 2) is still used elsewhere; if not, remove that import too.
  </action>
  <verify>
  Run `npx next build --webpack 2>&1 | tail -20` to verify no TypeScript or build errors. Verify the PredictingModelsWidget is removed: `grep -n "PredictingModelsWidget" src/app/leagues/[slug]/[match]/page.tsx` should return nothing. Verify preview is exposed: `grep -n "getMatchPreview" src/app/api/matches/[id]/content/route.ts` should show the import and usage.
  </verify>
  <done>
  The content API returns match preview data for upcoming matches. MatchNarrative renders rich structured previews (form analysis, H2H, key players, tactical breakdown, prediction) instead of "Analysis pending" placeholder. Match page shows predictions exactly once (no duplicate PredictingModelsWidget). Build passes with no errors.
  </done>
</task>

</tasks>

<verification>
1. `npx next build --webpack` completes without errors
2. `grep -rn "PredictingModelsWidget" src/app/leagues/` returns no results in page.tsx
3. `grep -n "COALESCE" src/lib/db/queries.ts` shows `matchContent.postMatchContent` BEFORE `matchRoundups.narrative`
4. `grep -n "IS NULL" src/lib/content/generator.ts` shows the conditional guard on the backward-compat write
5. `grep -n "getMatchPreview" src/app/api/matches/` shows the preview query in the content route
</verification>

<success_criteria>
- Finished matches display the model-performance post-match report (not overwritten by roundup)
- Upcoming matches display structured preview content (introduction, form, H2H, etc.)
- Predictions section appears exactly once on match detail pages
- Build passes, no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/026-fix-match-report-overwrite-duplicates/026-SUMMARY.md`
</output>
