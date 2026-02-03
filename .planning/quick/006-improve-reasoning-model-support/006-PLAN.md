---
phase: quick
plan: 006
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/together.ts
  - src/lib/llm/prompt.ts
autonomous: true

must_haves:
  truths:
    - "Kimi K2.5 model is available for predictions"
    - "JSON inside thinking tags is preserved during parsing"
    - "Reasoning model responses extract JSON correctly"
  artifacts:
    - path: "src/lib/llm/providers/together.ts"
      provides: "Kimi K2.5 provider definition"
      contains: "moonshotai/Kimi-K2.5-Instruct"
    - path: "src/lib/llm/prompt.ts"
      provides: "Smart thinking tag extraction"
      contains: "extractJsonFromThinkingTags"
  key_links:
    - from: "src/lib/llm/prompt.ts"
      to: "parsePredictionResponse"
      via: "extraction before stripping"
      pattern: "extractJsonFromThinkingTags.*before.*replace"
---

<objective>
Improve reasoning model support and add Kimi K2.5 as a budget reasoning model.

Purpose: Current tag stripping blindly removes `<think>` content, potentially losing JSON if the model places it there. Kimi K2.5 is a new budget reasoning model ($0.20/$0.60) that should be added.

Output: Smart JSON extraction from thinking tags + Kimi K2.5 provider
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/llm/providers/together.ts
@src/lib/llm/prompt.ts
@src/lib/llm/providers/base.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add smart JSON extraction from thinking tags</name>
  <files>src/lib/llm/prompt.ts</files>
  <action>
Add a helper function `extractJsonFromThinkingTags(text: string)` that:
1. Searches for JSON patterns INSIDE `<think>`, `<thinking>`, `<reasoning>` tags BEFORE stripping
2. If valid JSON with score fields found inside tags, extract and return it
3. If no JSON in tags, return null

Update `parsePredictionResponse()` and `parseBatchPredictionResponse()`:
1. BEFORE the existing tag stripping logic, call `extractJsonFromThinkingTags()`
2. If it returns valid JSON, use that immediately (skip further parsing)
3. If null, proceed with existing logic (strip tags, then parse)

The extraction should look for patterns like:
- `{"home_score": N, "away_score": N}`
- `[{"match_id": ..., "home_score": N, "away_score": N}]`

This ensures we preserve JSON even if a reasoning model embeds it in thinking output.
  </action>
  <verify>
Manual test: Create test strings with JSON inside `<think>` tags and verify extraction works:
```typescript
const test1 = '<think>Let me analyze... {"home_score": 2, "away_score": 1}</think>';
const test2 = '<thinking>Analysis here</thinking>{"home_score": 1, "away_score": 0}';
```
Both should parse successfully.
  </verify>
  <done>JSON inside thinking tags is extracted rather than discarded; JSON outside tags still works</done>
</task>

<task type="auto">
  <name>Task 2: Add Kimi K2.5 reasoning model</name>
  <files>src/lib/llm/providers/together.ts</files>
  <action>
Add Kimi K2.5 Instruct as a new Together provider in the MOONSHOT section (after existing Kimi K2 models):

```typescript
// 5. Kimi K2.5 Instruct (Reasoning)
export const KimiK25InstructProvider = new TogetherProvider(
  'kimi-k2.5-instruct',
  'together',
  'moonshotai/Kimi-K2.5-Instruct',
  'Kimi K2.5 Instruct (Moonshot Reasoning)',
  'budget',  // $0.20/$0.60 is budget tier
  { promptPer1M: 0.20, completionPer1M: 0.60 },
  false
);
```

Add to TOGETHER_PROVIDERS array in the Moonshot section:
```typescript
// Moonshot (3)
KimiK2_0905Provider,           // 3  - $1.00/$3.00
KimiK2InstructProvider,        // 4  - $1.00/$3.00
KimiK25InstructProvider,       // 5  - $0.20/$0.60 (reasoning)
```

Update all subsequent comment numbers in the array (increment by 1).
Update the summary comment at the bottom: 30 models instead of 29.
  </action>
  <verify>
TypeScript compilation: `npx tsc --noEmit src/lib/llm/providers/together.ts`
Check export: `grep -n "KimiK25" src/lib/llm/providers/together.ts`
  </verify>
  <done>Kimi K2.5 provider is defined and exported in TOGETHER_PROVIDERS array</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npm run build`
2. Kimi K2.5 appears in provider list
3. Tag extraction preserves JSON from reasoning outputs
</verification>

<success_criteria>
- Kimi K2.5 model added to TOGETHER_PROVIDERS (30 models total)
- JSON extraction from thinking tags implemented
- Existing parsing behavior unchanged for non-reasoning models
- Build passes
</success_criteria>

<output>
After completion, create `.planning/quick/006-improve-reasoning-model-support/006-SUMMARY.md`
</output>
