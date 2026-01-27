# Quick Plan: Fix deployment failure - missing schema-dts dependency

## Problem
Deployment fails with TypeScript error:
```
Type error: Cannot find module 'schema-dts' or its corresponding type declarations.
```

Location: `src/lib/seo/schema/article.ts:1`

The `schema-dts` package was referenced in SEO code but was in `devDependencies` instead of `dependencies`, causing it to be unavailable during production build.

## Tasks
- [x] Move `schema-dts` from devDependencies to dependencies in package.json
- [x] Regenerate package-lock.json
- [x] Fix BASE_URL to use fallback instead of throwing error (NEXT_PUBLIC_APP_URL support)

## Changes
- `package.json`: Moved schema-dts from devDependencies to dependencies
- `package-lock.json`: Regenerated to include schema-dts
- `src/lib/seo/constants.ts`: Added fallback to NEXT_PUBLIC_APP_URL and empty string for BASE_URL