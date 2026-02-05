---
phase: quick-012
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/index.ts
autonomous: true

must_haves:
  truths:
    - "Production build completes without ReferenceError"
    - "Fallback mapping validation still runs (but lazily, not at module load)"
    - "All existing exports and functionality unchanged"
  artifacts:
    - path: "src/lib/llm/index.ts"
      provides: "LLM provider registry without eager side effects"
  key_links:
    - from: "src/lib/llm/index.ts"
      to: "src/lib/llm/providers/synthetic.ts"
      via: "import SYNTHETIC_PROVIDERS"
      pattern: "import.*SYNTHETIC_PROVIDERS"
---

<objective>
Fix production build failure caused by circular dependency in LLM module initialization.

Purpose: The production build (Next.js Turbopack) crashes with `ReferenceError: Cannot access 'd' before initialization` because `validateFallbackMapping()` is called eagerly at module load time (line 111 of `src/lib/llm/index.ts`). This triggers `loggers.llm.info()` during module evaluation, but a circular import chain (`index.ts` -> `synthetic.ts` -> `response-handlers.ts` -> back) means a minified variable isn't yet initialized when the logger runs.

Output: A clean production build with no circular dependency crash.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove eager validateFallbackMapping call and make validation lazy</name>
  <files>src/lib/llm/index.ts</files>
  <action>
In `src/lib/llm/index.ts`, make the following targeted changes:

1. **Remove the eager call on line 111**: Delete the line `validateFallbackMapping();` and the comment on line 110 above it (`// Run validation at module load time (fails fast if config is invalid)`).

2. **Make validation lazy inside `getFallbackProvider`**: Add a one-time validation call at the start of `getFallbackProvider()` using a module-level `let validated = false` flag. On first call to `getFallbackProvider`, run `validateFallbackMapping()` and set `validated = true`. This preserves the safety check without triggering it during module evaluation.

Specifically:
- Add `let fallbacksValidated = false;` after the `MODEL_FALLBACKS` declaration (after line 45).
- In `getFallbackProvider` (starts at line 52), add at the top of the function body:
  ```typescript
  if (!fallbacksValidated) {
    validateFallbackMapping();
    fallbacksValidated = true;
  }
  ```

3. **Do NOT change any exports, function signatures, or other code.** Only the timing of when `validateFallbackMapping` runs changes (from module load to first use).

Why this approach: The validation is valuable (catches config errors early), but it must not run during module initialization due to the circular import chain. Lazy validation on first use of `getFallbackProvider` preserves the safety net while breaking the circular init crash.
  </action>
  <verify>
Run the production build to confirm no ReferenceError:
```bash
npm run build
```
The build must complete the "Collecting page data" phase without crashing. Look for successful completion or at minimum no `ReferenceError: Cannot access 'd' before initialization`.
  </verify>
  <done>
- `npm run build` completes without `ReferenceError: Cannot access 'd' before initialization`
- `validateFallbackMapping()` is no longer called at module load time
- Validation still occurs lazily on first call to `getFallbackProvider`
- All exports from `src/lib/llm/index.ts` remain unchanged
  </done>
</task>

</tasks>

<verification>
1. `npm run build` completes successfully (no ReferenceError during "Collecting page data")
2. `grep -n "validateFallbackMapping()" src/lib/llm/index.ts` shows the call only inside `getFallbackProvider`, not at top level
3. TypeScript compilation passes: `npx tsc --noEmit` (no type errors introduced)
</verification>

<success_criteria>
Production build completes without the circular dependency ReferenceError. The fix is minimal (only changes when validation runs, not what it does). All existing functionality preserved.
</success_criteria>

<output>
After completion, create `.planning/quick/012-fix-circular-dep-build-error/012-SUMMARY.md`
</output>
