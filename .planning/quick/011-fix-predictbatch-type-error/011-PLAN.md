---
quick: 011
type: execute
wave: 1
depends_on: []
files_modified: [src/types/index.ts, src/lib/llm/providers/base.ts]
autonomous: true

must_haves:
  truths:
    - "Production build succeeds without type errors"
    - "validate-all-models.ts script compiles successfully"
    - "Type checking passes for all LLM provider files"
  artifacts:
    - path: "src/types/index.ts"
      provides: "BatchPredictionResult interface and predictBatch method in LLMProvider"
      exports: ["BatchPredictionResult", "LLMProvider"]
    - path: "src/lib/llm/providers/base.ts"
      provides: "Base class using imported BatchPredictionResult type"
      pattern: "import.*BatchPredictionResult.*from.*@/types"
  key_links:
    - from: "scripts/validate-all-models.ts"
      to: "src/types/index.ts"
      via: "import type { LLMProvider }"
      pattern: "import type.*LLMProvider.*from.*@/types"
    - from: "src/lib/llm/providers/base.ts"
      to: "src/types/index.ts"
      via: "import BatchPredictionResult"
      pattern: "import.*BatchPredictionResult.*from.*@/types"
---

<objective>
Fix TypeScript type error preventing production builds by adding missing `BatchPredictionResult` interface and `predictBatch` method to the `LLMProvider` interface.

Purpose: Resolve build-breaking type error where `validate-all-models.ts` uses `provider.predictBatch()` but the `LLMProvider` interface doesn't declare it.

Output: Type-complete interface definitions allowing production builds to succeed.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/types/index.ts
@src/lib/llm/providers/base.ts
@scripts/validate-all-models.ts
</context>

<tasks>

<task type="auto">
  <name>Add BatchPredictionResult and predictBatch to LLMProvider interface</name>
  <files>src/types/index.ts, src/lib/llm/providers/base.ts</files>
  <action>
1. Add `BatchPredictionResult` interface to `src/types/index.ts` after `LLMPredictionResult` (line 75):

```typescript
export interface BatchPredictionResult {
  predictions: Map<string, { homeScore: number; awayScore: number }>;
  rawResponse: string;
  success: boolean;
  error?: string;
  processingTimeMs: number;
  failedMatchIds?: string[];
}
```

2. Add `predictBatch` method to `LLMProvider` interface (after predict method, line 83):

```typescript
predictBatch(batchPrompt: string, expectedMatchIds: string[]): Promise<BatchPredictionResult>;
```

3. Update `src/lib/llm/providers/base.ts`:
   - Remove local `BatchPredictionResult` interface definition (lines 22-29)
   - Add import at top: `import { BatchPredictionResult } from '@/types';` (add to existing import from line 1)
   - Keep `FallbackAPIResult` interface as-is (it's specific to base.ts)

This makes the type definition canonical in `src/types/index.ts` and eliminates duplication.
  </action>
  <verify>
Run TypeScript compiler: `npx tsc --noEmit`
Should complete with no type errors related to predictBatch or BatchPredictionResult.
  </verify>
  <done>
- `BatchPredictionResult` exported from `src/types/index.ts`
- `predictBatch` method declared in `LLMProvider` interface
- `base.ts` imports `BatchPredictionResult` from types (no local definition)
- TypeScript compilation succeeds with zero type errors
  </done>
</task>

</tasks>

<verification>
1. Run TypeScript type check: `npx tsc --noEmit` (zero errors)
2. Run validation script: `npm run validate:models` (compiles and executes)
3. Build succeeds: `npm run build` (no type errors)
</verification>

<success_criteria>
- Production build completes without type errors
- `scripts/validate-all-models.ts` compiles successfully
- `LLMProvider` interface includes `predictBatch` method signature
- `BatchPredictionResult` interface exported from `src/types/index.ts`
- No duplicate type definitions (single source of truth in types file)
</success_criteria>

<output>
After completion, create `.planning/quick/011-fix-predictbatch-type-error/011-SUMMARY.md`
</output>
