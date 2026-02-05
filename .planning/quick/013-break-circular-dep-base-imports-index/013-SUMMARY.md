---
phase: quick-013
plan: 01
subsystem: llm-providers
tags: [circular-dependency, dynamic-import, build-fix]
dependency-graph:
  requires: [quick-012]
  provides: [working-production-build, no-circular-dep-at-init]
  affects: []
tech-stack:
  added: []
  patterns: [dynamic-import-for-circular-deps]
key-files:
  created: []
  modified:
    - src/lib/llm/providers/base.ts
decisions:
  - id: dynamic-import-pattern
    choice: "Use await import() inside async method body"
    rationale: "callAPIWithFallback is already async, so await import() works without any signature changes. Resolves getFallbackProvider at runtime when actually needed, not at module init time."
metrics:
  duration: "2m 10s"
  completed: "2026-02-05"
---

# Quick Task 013: Break Circular Dependency in base.ts Imports

**One-liner:** Replace static import of getFallbackProvider with dynamic await import() to break index->synthetic->base->index circular dependency causing build failure.

## What Was Done

### Task 1: Replace static import with dynamic import in base.ts
**Commit:** `5322a19`

The production build was failing with "Cannot access 'd' before initialization" due to a circular import chain:
- `index.ts` imports `synthetic.ts` (via `SYNTHETIC_PROVIDERS`)
- `synthetic.ts` imports `base.ts` (extends `OpenAICompatibleProvider`)
- `base.ts` imports `index.ts` (via `getFallbackProvider`)

**Fix applied:**
1. Removed line 13: `import { getFallbackProvider } from '../index';`
2. Added dynamic import inside `callAPIWithFallback` method body (line 381):
   ```typescript
   const { getFallbackProvider } = await import('../index');
   const fallbackProvider = getFallbackProvider(this.id);
   ```

This works because `callAPIWithFallback` is already an `async` method returning `Promise<FallbackAPIResult>`, so `await import()` requires no signature changes. The import resolves at runtime when the method is actually called, not at module initialization time.

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` (webpack mode) | PASSED -- all 45 pages generated, no ReferenceError |
| `npx tsc --noEmit` | No new errors (pre-existing test type errors only) |
| No static `from '../index'` in base.ts | Confirmed via grep |
| Dynamic `await import('../index')` present | Confirmed on line 381 |

**Note:** The default `npm run build` (turbopack) fails due to a missing SWC native binary (`@next/swc-darwin-arm64` package is a stub without the `.node` file). Build was verified using `npx next build --webpack` which completed successfully. This is an infrastructure issue unrelated to the code change.

## Deviations from Plan

None -- plan executed exactly as written.

## Context: Why quick-012 Was Insufficient

Quick-012 made `validateFallbackMapping()` lazy (deferred execution), but this didn't fix the root cause. The circular dependency existed at the static import level -- TypeScript/webpack resolves all static imports before any code runs. Even with lazy validation, the import of `getFallbackProvider` from `index.ts` in `base.ts` still triggered the circular resolution chain during module initialization.

The dynamic `await import()` pattern is the standard TypeScript solution: it defers module resolution to runtime, breaking the initialization-time circular chain entirely.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace static import with dynamic import in base.ts | `5322a19` | src/lib/llm/providers/base.ts |

## Self-Check: PASSED
