---
phase: quick-013
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/base.ts
autonomous: true

must_haves:
  truths:
    - "Production build completes without ReferenceError on module initialization"
    - "callAPIWithFallback still resolves fallback providers at runtime"
    - "No circular dependency between base.ts and index.ts at import time"
  artifacts:
    - path: "src/lib/llm/providers/base.ts"
      provides: "OpenAICompatibleProvider base class without circular static import"
      contains: "await import"
  key_links:
    - from: "src/lib/llm/providers/base.ts"
      to: "src/lib/llm/index.ts"
      via: "dynamic import inside callAPIWithFallback method"
      pattern: "await import\\("
---

<objective>
Break circular dependency causing production build failure. The cycle is:
index.ts -> synthetic.ts -> base.ts -> index.ts (via static import of getFallbackProvider).

Replace the static import of `getFallbackProvider` in `base.ts` with a dynamic `await import()` inside the `callAPIWithFallback` method. This is the standard TypeScript pattern for breaking circular dependencies -- the import resolves at runtime when the method is called, not at module initialization time.

Purpose: Unblock production deployment -- build crashes with "Cannot access 'd' before initialization"
Output: Working production build with no circular dependency at module init time
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/providers/base.ts
@src/lib/llm/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace static import with dynamic import in base.ts</name>
  <files>src/lib/llm/providers/base.ts</files>
  <action>
In `src/lib/llm/providers/base.ts`:

1. **Remove line 13:** Delete the static import `import { getFallbackProvider } from '../index';`

2. **Modify `callAPIWithFallback` method (line 381):** Replace the direct call to `getFallbackProvider` with a dynamic import:

   Change:
   ```typescript
   const fallbackProvider = getFallbackProvider(this.id);
   ```

   To:
   ```typescript
   const { getFallbackProvider } = await import('../index');
   const fallbackProvider = getFallbackProvider(this.id);
   ```

   This works because `callAPIWithFallback` is already an `async` method (returns `Promise<FallbackAPIResult>`), so `await import()` is valid without any signature changes.

3. **Leave everything else untouched.** The comment on line 397 referencing `getFallbackProvider` is fine as-is (it's just a code comment explaining the cast).

No other files need changes. The dynamic import breaks the circular chain because `base.ts` no longer requires `index.ts` to be fully initialized at import time.
  </action>
  <verify>
Run production build to confirm the circular dependency is broken:
```bash
npm run build
```
Expected: Build completes successfully through "Collecting page data" phase without ReferenceError.

Additionally verify no TypeScript errors:
```bash
npx tsc --noEmit
```
  </verify>
  <done>
- Production build (`npm run build`) completes without "Cannot access 'd' before initialization" error
- TypeScript compilation has no new errors
- The static import of `getFallbackProvider` from `'../index'` is removed from `base.ts`
- Dynamic `await import('../index')` is used inside `callAPIWithFallback` instead
  </done>
</task>

</tasks>

<verification>
1. `npm run build` completes successfully (no ReferenceError during "Collecting page data")
2. `npx tsc --noEmit` passes (no type errors introduced)
3. `grep -n "from '../index'" src/lib/llm/providers/base.ts` returns NO results (static import removed)
4. `grep -n "await import" src/lib/llm/providers/base.ts` returns the dynamic import line
</verification>

<success_criteria>
- Production build succeeds end-to-end
- No circular dependency at module initialization time between base.ts and index.ts
- Fallback functionality preserved (getFallbackProvider still called at runtime)
</success_criteria>

<output>
After completion, create `.planning/quick/013-break-circular-dep-base-imports-index/013-SUMMARY.md`
</output>
