# Quick Plan: Fix deployment failure - missing schema-dts dependency

## Problem
Deployment fails with TypeScript error:
```
Type error: Cannot find module 'schema-dts' or its corresponding type declarations.
```

Location: `src/lib/seo/schema/article.ts:1`

The `schema-dts` package was referenced in SEO code but was in `devDependencies` instead of `dependencies`, causing it to be unavailable during production build.

## Task
- [x] Move `schema-dts` from devDependencies to dependencies in package.json
- [x] Regenerate package-lock.json

## Changes
- `package.json`: Moved schema-dts from devDependencies to dependencies
- `package-lock.json`: Regenerated to include schema-dts in the dependency tree