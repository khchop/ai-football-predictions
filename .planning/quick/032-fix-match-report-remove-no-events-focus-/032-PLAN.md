---
phase: quick-032
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/lib/content/prompts.ts]
autonomous: true

must_haves:
  truths:
    - "Generated match roundups never mention 'no events recorded' or absence of events"
    - "AI model prediction accuracy is the PRIMARY narrative focus of roundups"
    - "When event data exists, it is still included but secondary to model analysis"
  artifacts:
    - path: "src/lib/content/prompts.ts"
      provides: "buildPostMatchRoundupPrompt with restructured prompt"
      contains: "NEVER mention the absence of events"
  key_links:
    - from: "src/lib/content/prompts.ts"
      to: "LLM output"
      via: "prompt template"
      pattern: "Model Predictions Analysis"
---

<objective>
Fix post-match roundup prompt to eliminate "no events recorded" filler and refocus the narrative on AI model prediction accuracy and performance.

Purpose: Match reports currently waste content on "no major events recorded" because the prompt feeds empty event data to the LLM. Restructuring the prompt to omit empty events and prioritize AI prediction analysis produces higher-quality, more relevant content.

Output: Updated `buildPostMatchRoundupPrompt` in `src/lib/content/prompts.ts`
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/content/prompts.ts (lines 534-693 — buildPostMatchRoundupPrompt function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure post-match roundup prompt to eliminate empty events and prioritize AI prediction analysis</name>
  <files>src/lib/content/prompts.ts</files>
  <action>
In `buildPostMatchRoundupPrompt` (starts line 534), make these changes:

**A. Conditionally include MATCH EVENTS section (around line 627-628):**

Replace the static events section:
```
## MATCH EVENTS (TIMELINE)
${eventsTimeline || '  No major events recorded'}
```

With a conditional block. Before the return template string, compute:
```typescript
const eventsSection = eventsTimeline
  ? `## MATCH EVENTS (TIMELINE)\n${eventsTimeline}`
  : ''; // Omit entirely when no events — do NOT include placeholder text
```

Then in the template string, use `${eventsSection}` (with a conditional newline so there's no blank gap when empty).

**B. Restructure INSTRUCTIONS section (lines 642-653):**

Reorder the numbered structure sections to put Model Predictions FIRST:

1. **Score Header** - Match title with final score and competition
2. **Match Overview** - Opening paragraph (context, importance, AI prediction landscape)
3. **Model Predictions Analysis** - LEAD SECTION: How AI models performed, highlight top/bottom performers, accuracy breakdown, which models got the tendency right vs exact score
4. **Extended Statistics** - Possession, shots, xG analysis with bullet points
5. **Key Events Timeline** - Major moments in chronological order (ONLY if event data was provided above; if not, skip this section entirely)
6. **Narrative Analysis** - Deep dive: tactical insights, what the stats reveal, why models succeeded or failed
7. **Narrative Angles** - Highlight if this was a derby, comeback, upset, or milestone

**C. Add anti-absence instruction in INSTRUCTIONS section:**

After the numbered list, add a clear instruction block:
```
CRITICAL RULES:
- NEVER mention the absence of events, missing event data, or say "no events recorded"
- If no match events timeline is provided above, simply skip that section — do NOT comment on its absence
- The PRIMARY narrative focus must be AI model prediction accuracy and performance
- Lead with which models predicted correctly, which were close, and which missed badly
```

**D. Update WRITING GUIDELINES section (lines 654-662):**

Replace with:
```
## WRITING GUIDELINES

- PRIMARY FOCUS: AI model prediction accuracy — which models nailed it, which missed, and why
- Reference specific model names and their exact predictions (no generic "Model 1")
- Use a balanced tone: mix data-driven analysis with storytelling
- Use facts ONLY from the provided data (no hallucinations)
- NEVER mention the absence or lack of match events — if events aren't provided, focus elsewhere
- Highlight prediction patterns: did most models predict the right tendency? Any exact scores?
- Highlight unique angles: comebacks, upsets, derbies, milestones
- Rich formatting: bullet points for stats, occasional emoji for emphasis
- Plain text format with natural line breaks (no HTML tags or entities)
- Focus on what the AI models reveal about this match
```

**E. Reorder data sections in template (lines 627-640):**

Move MODEL PREDICTIONS PERFORMANCE before MATCH EVENTS so the LLM sees prediction data first:

```
## MODEL PREDICTIONS PERFORMANCE
${predictionsTable}

## TOP 3 PERFORMERS (BY POINTS)
${topPerformers...}

${eventsSection}

## EXTENDED STATS
${formattedStats...}

## NARRATIVE ANGLES
${anglesText}
```

This puts prediction data at the TOP of the context, reinforcing its primacy.
  </action>
  <verify>
1. `npx tsc --noEmit src/lib/content/prompts.ts` — no type errors
2. `npm run build` — successful build
3. Manually grep the file to confirm:
   - No occurrence of `'No major events recorded'` string literal
   - `NEVER mention the absence` instruction exists
   - `Model Predictions Analysis` appears before `Key Events Timeline` in the INSTRUCTIONS
   - `PRIMARY FOCUS: AI model prediction accuracy` exists in WRITING GUIDELINES
  </verify>
  <done>
The buildPostMatchRoundupPrompt function: (1) omits the MATCH EVENTS section entirely when no events exist instead of saying "no events recorded", (2) places Model Predictions Analysis as section 3 (up from 5) in instructions, (3) includes explicit "NEVER mention absence of events" instruction, (4) writing guidelines lead with AI prediction accuracy as primary focus, (5) data sections reordered with predictions before events.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes without errors
2. Build succeeds
3. The string "No major events recorded" no longer exists in prompts.ts
4. The INSTRUCTIONS section lists Model Predictions Analysis before Key Events Timeline
5. CRITICAL RULES block contains anti-absence instruction
6. WRITING GUIDELINES leads with AI prediction accuracy focus
</verification>

<success_criteria>
- Zero occurrences of "No major events recorded" in prompts.ts
- Model Predictions Analysis is section 3 (before events in section 5) in INSTRUCTIONS
- Explicit "NEVER mention the absence of events" instruction present
- Writing guidelines lead with "PRIMARY FOCUS: AI model prediction accuracy"
- Build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/032-fix-match-report-remove-no-events-focus-/032-SUMMARY.md`
</output>
