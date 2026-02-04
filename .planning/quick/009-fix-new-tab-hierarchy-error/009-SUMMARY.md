# Quick Task 009: Summary

## Task
Fix HierarchyRequestError when opening match detail pages in new tab

## Root Cause
The match page was rendering **duplicate JSON-LD breadcrumb schemas**:
1. `MatchPageSchema` already includes BreadcrumbList in its consolidated `@graph`
2. `BreadcrumbsWithSchema` rendered a second `BreadcrumbSchema` script tag

Multiple script tags as siblings to client components caused hydration conflicts with Radix UI's DOM management.

## Fix Applied
**File:** `src/app/leagues/[slug]/[match]/page.tsx`

Changed import and usage from `BreadcrumbsWithSchema` to `Breadcrumbs`:
- Removed duplicate schema script tag
- MatchPageSchema still provides complete breadcrumb schema in its @graph
- Visual breadcrumbs still render correctly

## Changes
| File | Change |
|------|--------|
| `src/app/leagues/[slug]/[match]/page.tsx` | Use `Breadcrumbs` instead of `BreadcrumbsWithSchema` |

## Verification
- ✅ Build passes
- ✅ Single consolidated JSON-LD schema (no duplicates)
- ✅ Eliminates hydration conflict between script tags and client components
