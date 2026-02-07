---
phase: quick-028
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/sanitization.ts
  - src/lib/content/generator.ts
  - src/components/match/match-narrative.tsx
autonomous: true
must_haves:
  truths:
    - "Finished match pages with roundup narratives render without HierarchyRequestError"
    - "Narrative text displays with proper paragraph spacing"
    - "Server-rendered HTML matches client hydration (no DOM mismatch)"
  artifacts:
    - path: "src/lib/content/sanitization.ts"
      provides: "textToParagraphs utility function"
      exports: ["textToParagraphs"]
    - path: "src/lib/content/generator.ts"
      provides: "Properly structured HTML in roundupHtml narrative section"
      contains: "textToParagraphs"
    - path: "src/components/match/match-narrative.tsx"
      provides: "Safe rendering of plain-text narratives via paragraph conversion"
      contains: "textToParagraphs"
  key_links:
    - from: "src/lib/content/generator.ts"
      to: "src/lib/content/sanitization.ts"
      via: "import textToParagraphs"
      pattern: "textToParagraphs"
    - from: "src/components/match/match-narrative.tsx"
      to: "src/lib/content/sanitization.ts"
      via: "import textToParagraphs"
      pattern: "textToParagraphs"
---

<objective>
Fix HierarchyRequestError: Failed to execute 'insertBefore' on 'Node' that occurs during React hydration on finished match pages with roundup narratives.

Purpose: The error is caused by plain text (with `\n\n` paragraph breaks but no HTML tags) being inserted into an HTML template and rendered via `dangerouslySetInnerHTML`. The browser auto-corrects bare text nodes differently than the server, causing DOM mismatch during hydration.

Output: Properly structured HTML paragraphs in both the stored roundupHtml template and the client-side narrative rendering, eliminating the hydration error.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/content/sanitization.ts
@src/lib/content/generator.ts (lines 778-893 — generatePostMatchRoundup function)
@src/components/match/match-narrative.tsx (lines 120-189 — finished match rendering)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add textToParagraphs utility and fix HTML generation</name>
  <files>
    src/lib/content/sanitization.ts
    src/lib/content/generator.ts
  </files>
  <action>
    1. In `src/lib/content/sanitization.ts`, add a new exported function `textToParagraphs(text: string): string` that:
       - Returns empty string if input is falsy or whitespace-only
       - Splits the input on `\n\n` (double newline — the paragraph separator used by sanitizeContent)
       - Filters out empty/whitespace-only chunks
       - Trims each chunk
       - Wraps each chunk in `<p>` tags: `<p>${chunk}</p>`
       - Joins all paragraphs with newline
       - This converts plain text like `"Para one.\n\nPara two."` into `"<p>Para one.</p>\n<p>Para two.</p>"`

    2. In `src/lib/content/generator.ts`, import `textToParagraphs` from `./sanitization` (add to existing import on the line that imports `sanitizeContent` and `validateNoHtml`).

    3. In the `roundupHtml` template (around line 885-888), change:
       ```
       <div class="narrative">
         <h2>Match Analysis</h2>
         ${sanitizedNarrative}
       </div>
       ```
       to:
       ```
       <div class="narrative">
         <h2>Match Analysis</h2>
         ${textToParagraphs(sanitizedNarrative)}
       </div>
       ```

       This ensures the HTML stored in matchContent table has proper `<p>` tags wrapping narrative paragraphs instead of bare text nodes.
  </action>
  <verify>
    - `npx tsc --noEmit` passes (type check)
    - Grep for `textToParagraphs` in sanitization.ts confirms export exists
    - Grep for `textToParagraphs(sanitizedNarrative)` in generator.ts confirms usage
  </verify>
  <done>
    - `textToParagraphs` utility exists in sanitization.ts, exported and tested
    - generator.ts roundupHtml template wraps narrative text in `<p>` tags via the utility
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix client-side narrative rendering to handle plain text from DB</name>
  <files>
    src/components/match/match-narrative.tsx
  </files>
  <action>
    The `roundupNarrative` from the API is plain text (from `matchRoundups.narrative` column) with `\n\n` paragraph separators but NO HTML tags. It is rendered via `dangerouslySetInnerHTML={{ __html: roundupNarrative }}` on line 172, which causes the hydration mismatch because bare text nodes in a div are handled differently by server vs client.

    Existing roundup records in the DB already have plain text narratives stored, so fixing only the generator is insufficient — the rendering side must also handle plain text gracefully.

    1. Import `textToParagraphs` from `@/lib/content/sanitization` at the top of the file.

    2. On line 172, change:
       ```tsx
       <div dangerouslySetInnerHTML={{ __html: roundupNarrative }} />
       ```
       to:
       ```tsx
       <div dangerouslySetInnerHTML={{ __html: textToParagraphs(roundupNarrative) }} />
       ```

       This ensures that even plain text narratives (both existing and future) get proper `<p>` tag wrapping before being set as innerHTML, producing consistent DOM structure for hydration.

    Note: `textToParagraphs` is safe to call on text that already has `<p>` tags — but to be defensive, the function should handle that case. In Task 1, if the input already contains `<p>` tags (check with a simple regex `/<p[\s>]/i`), return the input unchanged. This handles the edge case where future narratives might already be HTML-formatted.
  </action>
  <verify>
    - `npx tsc --noEmit` passes
    - `npm run build` succeeds (confirms no SSR/hydration issues at build time)
    - Grep confirms `textToParagraphs` is used in match-narrative.tsx
  </verify>
  <done>
    - match-narrative.tsx converts plain text roundupNarrative to proper HTML paragraphs before rendering
    - No bare text nodes inside dangerouslySetInnerHTML divs
    - Build passes without errors
    - The HierarchyRequestError will no longer occur because server and client produce identical DOM structure
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — type checking passes
2. `npm run build` — production build succeeds without errors
3. Manual verification: Visit a finished match page with a roundup narrative — no console errors, narrative displays with proper paragraph spacing
</verification>

<success_criteria>
- Zero HierarchyRequestError on finished match pages with roundup narratives
- Narrative text renders with proper `<p>` tag paragraph structure
- Both new roundups (via generator) and existing DB records (via component) are handled
- Production build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/028-fix-hierarchyrequesterror-insertbefore-d/028-SUMMARY.md`
</output>
