# Quick Task 011: Fix predictBatch Type Error

## Problem

Production deployment failed with TypeScript error:
```
Property 'predictBatch' does not exist on type 'LLMProvider'
```
at `scripts/validate-all-models.ts:99`.

## Root Cause

The `LLMProvider` interface in `src/types/index.ts` only declared the `predict()` method, but the base class in `src/lib/llm/providers/base.ts` also implements `predictBatch()`. The validation script imported the type from `src/types` and called `predictBatch`, causing a type error during `next build`.

## Fix

1. Added `BatchPredictionResult` interface to `src/types/index.ts`
2. Added `predictBatch` method signature to `LLMProvider` interface
3. Updated `base.ts` to import `BatchPredictionResult` from `@/types` instead of defining it locally

## Files Changed

- `src/types/index.ts` — Added `BatchPredictionResult` interface and `predictBatch` to `LLMProvider`
- `src/lib/llm/providers/base.ts` — Import `BatchPredictionResult` from `@/types`, removed local definition

## Verification

- `tsc --noEmit` confirms no `predictBatch` errors
- `validate-all-models.ts` type-checks cleanly

## Commit

`8625f5d` — fix: add predictBatch to LLMProvider interface to fix production build
