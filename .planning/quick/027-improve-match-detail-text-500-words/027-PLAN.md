---
phase: quick-027
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/matches/[id]/content/route.ts
  - src/lib/db/queries.ts
  - src/components/match/match-narrative.tsx
autonomous: true

must_haves:
  truths:
    - "Finished match pages show 500+ words of text content"
    - "Finished matches display the Match Preview section (introduction, team form, H2H, key players, tactical, prediction, betting insights)"
    - "Finished matches display the Match Report section using the roundup narrative (1000+ words) instead of the short postMatchContent (~200 words)"
    - "Upcoming/live match pages continue to work exactly as before"
  artifacts:
    - path: "src/app/api/matches/[id]/content/route.ts"
      provides: "Content API returning roundupNarrative as separate field"
      contains: "roundupNarrative"
    - path: "src/components/match/match-narrative.tsx"
      provides: "MatchNarrative rendering preview + roundup for finished matches"
      min_lines: 80
  key_links:
    - from: "src/app/api/matches/[id]/content/route.ts"
      to: "src/lib/db/queries.ts"
      via: "getMatchContentUnified returns roundupNarrative"
      pattern: "roundupNarrative"
    - from: "src/components/match/match-narrative.tsx"
      to: "/api/matches/[id]/content"
      via: "fetch in useEffect, reads roundupNarrative + preview"
      pattern: "roundupNarrative"
---

<objective>
Make finished match pages show 500+ words by displaying both the Match Preview and the full roundup narrative (Match Report).

Purpose: Currently finished match pages only show ~150-200 words of postMatchContent. The preview data (500-1000 words) and roundup narrative (1000+ words) both exist in the database but aren't displayed for finished matches. Combining them yields 1500-2000+ words of rich content.

Output: Finished match detail pages showing "Match Preview" section + "Match Report" section with the full roundup narrative.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/api/matches/[id]/content/route.ts
@src/lib/db/queries.ts (lines 2650-2754, getMatchContentUnified function)
@src/components/match/match-narrative.tsx
@src/app/api/matches/[id]/roundup/route.ts (reference for roundup data structure)
@src/lib/db/schema.ts (lines 500-554, matchRoundups table)
@src/lib/content/queries.ts (getMatchPreview function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expose roundup narrative in Content API response</name>
  <files>
    src/app/api/matches/[id]/content/route.ts
    src/lib/db/queries.ts
  </files>
  <action>
**In `src/lib/db/queries.ts`:**

The `UnifiedMatchContent` interface (around line 2656) already has `hasFullRoundup: boolean`. Add a new field:
```
roundupNarrative: string | null;
```

In `getMatchContentUnified` (line 2683):
- Add `roundupNarrative: matchRoundups.narrative` to the select clause (around line 2692-2708)
- In the return object (line 2716-2725), add `roundupNarrative: result[0].roundupNarrative ?? null`
- In the roundupOnly fallback (line 2740-2749), add `roundupNarrative: roundupOnly[0].narrative`
- In the null return case, this field doesn't matter (returns null entirely)

**In `src/app/api/matches/[id]/content/route.ts`:**

Add `roundupNarrative` to the JSON response:
```typescript
return NextResponse.json({
  preMatchContent: content?.preMatchContent || null,
  postMatchContent: content?.postMatchContent || null,
  roundupNarrative: content?.roundupNarrative || null,
  preview: preview ? { ... } : null,
});
```

This keeps the existing `postMatchContent` for backward compatibility while exposing the full roundup narrative as a separate field.
  </action>
  <verify>
Run `npx next build --webpack 2>&1 | tail -20` to verify no TypeScript errors.
Verify the API response shape by checking that `roundupNarrative` appears in the route handler's return.
  </verify>
  <done>Content API returns `{ preMatchContent, postMatchContent, roundupNarrative, preview }` where `roundupNarrative` contains the 1000+ word HTML narrative from matchRoundups when available.</done>
</task>

<task type="auto">
  <name>Task 2: Show preview + roundup narrative for finished matches</name>
  <files>src/components/match/match-narrative.tsx</files>
  <action>
**Update the `NarrativeContent` interface** to include `roundupNarrative`:
```typescript
interface NarrativeContent {
  preMatchContent: string | null;
  postMatchContent: string | null;
  roundupNarrative: string | null;
  preview: PreviewData | null;
}
```

**Rewrite the finished match rendering block** (lines 76-112). For finished matches, show TWO sections in a single Card:

1. **Match Preview section** - if `content?.preview` exists, render the structured preview (introduction, team form, H2H, key players, tactical, prediction, betting insights) using the same markup currently used for upcoming/live matches (lines 117-163). Extract this into a helper function or inline it to avoid duplication.

2. **Match Report section** - prefer `content?.roundupNarrative` (the 1000+ word HTML narrative) over `content?.postMatchContent` (the short ~200 word text). Render with `dangerouslySetInnerHTML` since the roundup narrative is HTML. If neither exists, show "Match report is being generated."

Structure for finished matches:
```tsx
<div className="space-y-6">
  {/* Match Preview - show if preview data exists */}
  {preview && (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <h2 ...>Match Preview</h2>
        <div className="prose ...">
          {/* Same structured preview sections as upcoming/live */}
        </div>
      </CardContent>
    </Card>
  )}

  {/* Match Report - roundup narrative or fallback to postMatchContent */}
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-6">
      <h2 ...>Match Report</h2>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {roundupNarrative ? (
          <div dangerouslySetInnerHTML={{ __html: roundupNarrative }} />
        ) : postContent ? (
          isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: postContent }} />
          ) : (
            postContent
          )
        ) : (
          <p className="text-muted-foreground italic">
            Match report is being generated.
          </p>
        )}
      </div>
    </CardContent>
  </Card>
</div>
```

**Extract the preview rendering into a reusable function** to avoid duplicating the preview section markup between finished and upcoming/live branches. Create a local function `renderPreviewSections(preview: PreviewData)` that returns the JSX for introduction, team form, H2H, key players, tactical analysis, prediction, and betting insights. Use this function in BOTH the finished match block and the upcoming/live block.

**Keep upcoming/live behavior unchanged.** The only difference is:
- Upcoming/Live: shows preview only (as before)
- Finished: shows preview (if exists) + match report (roundup narrative preferred over postMatchContent)
  </action>
  <verify>
Run `npx next build --webpack 2>&1 | tail -20` to verify no TypeScript errors and successful build.
Visually verify by navigating to a finished match page in dev mode (`npm run dev`) and confirming both Match Preview and Match Report sections appear.
  </verify>
  <done>
Finished match pages display: (1) Match Preview section with structured preview data (introduction, team form, H2H, key players, tactical, prediction, betting insights) and (2) Match Report section with the full roundup narrative (1000+ words HTML). Upcoming/live matches continue showing only the preview section as before. Total word count for finished matches with both sections: 1500-2000+ words.
  </done>
</task>

</tasks>

<verification>
1. Build succeeds: `npx next build --webpack` completes without errors
2. Finished match page shows both "Match Preview" and "Match Report" sections
3. Match Report section shows the long roundup narrative (1000+ words), not the short postMatchContent
4. Upcoming match pages continue to show only the Match Preview section
5. Matches without roundup data gracefully fall back to postMatchContent for the report section
</verification>

<success_criteria>
- Finished match detail pages display 500+ words of content (preview + roundup narrative)
- No regression on upcoming/live match pages
- Build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/027-improve-match-detail-text-500-words/027-SUMMARY.md`
</output>
