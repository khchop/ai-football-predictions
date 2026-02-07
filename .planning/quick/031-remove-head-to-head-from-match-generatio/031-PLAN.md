---
phase: quick-031
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/prompts.ts
  - src/lib/content/generator.ts
  - src/lib/content/config.ts
  - src/components/match/match-narrative.tsx
  - src/app/api/matches/[id]/content/route.ts
autonomous: true

must_haves:
  truths:
    - "Match preview generation no longer produces a headToHead section"
    - "Prediction section focuses on AI model consensus predictions, not football API data"
    - "Betting Insights section focuses on AI model predictions vs market odds"
    - "Frontend no longer renders a Head to Head section"
    - "API no longer returns headToHead field in preview response"
  artifacts:
    - path: "src/lib/content/prompts.ts"
      provides: "Updated prompt without H2H, with AI-consensus-focused prediction/betting sections"
    - path: "src/lib/content/generator.ts"
      provides: "Generator that no longer sanitizes/validates/stores headToHead"
    - path: "src/components/match/match-narrative.tsx"
      provides: "UI without H2H rendering block"
  key_links:
    - from: "src/lib/content/prompts.ts"
      to: "src/lib/content/generator.ts"
      via: "MatchPreviewResponse type"
      pattern: "headToHead.*should not exist"
---

<objective>
Remove the head-to-head section from match preview generation and refocus the Prediction and Betting Insights sections on AI model consensus instead of football API data.

Purpose: The H2H section adds little value (often "no data available") and the prediction/betting sections should highlight what makes this platform unique -- 42 AI models making predictions, not generic football API statistics.
Output: Updated prompt, generator, UI component, and API route with H2H removed and AI-consensus-focused prediction/betting sections.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/content/prompts.ts
@src/lib/content/generator.ts
@src/lib/content/config.ts
@src/components/match/match-narrative.tsx
@src/app/api/matches/[id]/content/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove H2H from prompt and refocus prediction/betting on AI consensus</name>
  <files>src/lib/content/prompts.ts, src/lib/content/config.ts</files>
  <action>
In `src/lib/content/prompts.ts`:

1. Remove `h2hHistory` field from the `MatchPreviewData` interface (lines 43-49, the entire `// H2H data` block).

2. In `buildMatchPreviewPrompt()`, remove the H2H data section from the prompt template (lines 83-86):
   ```
   ${data.h2hHistory && data.h2hHistory.length > 0 ? `
   Recent Head-to-Head:
   ${data.h2hHistory.slice(0, 3).map(h => ...
   ` : ''}
   ```

3. Remove the `"headToHead"` line from the JSON output structure (line 93). The output JSON should go: introduction, teamFormAnalysis, prediction, bettingInsights, metaDescription, keywords.

4. Update the `"prediction"` description (currently line 94) to:
   ```
   "prediction": "AI-powered prediction based on model consensus (150-200 words). State the overall AI model consensus (e.g., '45% draw, 35% home win, 20% away win'). Highlight which outcome most models agree on. Reference how the AI consensus compares to the bookmaker odds. Mention confidence level based on model agreement."
   ```

5. Update the `"bettingInsights"` description (currently line 95) to:
   ```
   "bettingInsights": "Betting insights based on AI model predictions vs market odds (150-200 words). Identify where AI model consensus DIFFERS from bookmaker odds (value bets). Suggest 2-3 specific betting markets where models see value. Reference the AI prediction percentages alongside the implied odds percentages."
   ```

6. In the anti-hallucination rules block (lines 100-106), remove the line about H2H data:
   Remove: `- If data is not provided for a section, acknowledge it (e.g., "No H2H data available") instead of inventing content.`
   Replace with: `- Focus heavily on AI model consensus and predictions when discussing likely outcomes.`

7. Remove `headToHead` from the `MatchPreviewResponse` interface (line 448). The interface should have: introduction, teamFormAnalysis, prediction, bettingInsights, metaDescription, keywords.

In `src/lib/content/config.ts`:

8. Remove `'headToHead'` from the `sections` array (line 54). Keep: introduction, teamFormAnalysis, keyPlayers, tacticalAnalysis, prediction, bettingInsights.
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors from removing headToHead from MatchPreviewResponse.</verify>
  <done>MatchPreviewData no longer has h2hHistory, prompt no longer mentions H2H, prediction/bettingInsights descriptions focus on AI model consensus, MatchPreviewResponse no longer has headToHead field.</done>
</task>

<task type="auto">
  <name>Task 2: Remove H2H from generator, UI component, and API route</name>
  <files>src/lib/content/generator.ts, src/components/match/match-narrative.tsx, src/app/api/matches/[id]/content/route.ts</files>
  <action>
In `src/lib/content/generator.ts`:

1. Remove the headToHead sanitization line (line 86):
   `const headToHead = sanitizeContent(result.content.headToHead);`

2. Remove the headToHead validation line (line 94):
   `validateNoHtml(headToHead);`

3. Remove `headToHead,` from the `newPreview` object (line 108). Do NOT add `headToHead: null` -- simply omit the field. The DB column is nullable so Drizzle will default to null.

In `src/components/match/match-narrative.tsx`:

4. Remove `headToHead` from the `PreviewData` interface (line 12):
   `headToHead: string | null;`

5. Remove the H2H rendering block from `renderPreviewSections` (lines 36-41):
   ```tsx
   {preview.headToHead && (
     <>
       <h3>Head to Head</h3>
       <p>{preview.headToHead}</p>
     </>
   )}
   ```

6. Update the component JSDoc comment (line 25) to remove "H2H" mention:
   `* Renders structured preview sections (introduction, team form, prediction, betting insights)`

In `src/app/api/matches/[id]/content/route.ts`:

7. Remove `headToHead: preview.headToHead,` from the preview response object (line 33).
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors across all modified files. Then run `npm run build -- --no-lint` (or `npx next build --webpack`) to confirm production build succeeds.</verify>
  <done>Generator no longer processes headToHead, UI no longer renders it, API no longer returns it. TypeScript compiles cleanly. Build succeeds.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npm run build -- --no-lint` or `npx next build --webpack` succeeds
3. Grep confirms no remaining references to headToHead in the 5 modified files:
   `grep -n "headToHead" src/lib/content/prompts.ts src/lib/content/generator.ts src/lib/content/config.ts src/components/match/match-narrative.tsx src/app/api/matches/[id]/content/route.ts`
   should return zero results
4. Note: H2H references in `src/lib/football/h2h.ts`, `match-analysis.ts`, `prompt-builder.ts`, and `src/lib/db/schema.ts` are INTENTIONALLY kept -- those handle the football API data pipeline, not the content generation output. The DB column `head_to_head` stays (nullable, will be null for new rows).
</verification>

<success_criteria>
- Match preview prompt no longer asks for or mentions H2H section
- Prediction section prompt explicitly asks for AI model consensus language
- Betting Insights prompt explicitly asks for AI predictions vs market odds comparison
- MatchPreviewResponse type has no headToHead field
- Generator does not sanitize, validate, or store headToHead
- UI component does not render any H2H block
- API route does not return headToHead in response
- TypeScript compilation succeeds
- Production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/031-remove-head-to-head-from-match-generatio/031-SUMMARY.md`
</output>
