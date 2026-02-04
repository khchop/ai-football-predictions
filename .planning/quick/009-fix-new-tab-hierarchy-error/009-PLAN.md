# Quick Task 009: Fix HierarchyRequestError on New Tab Open

## Problem

Opening match detail pages in a new tab causes:
```
HierarchyRequestError: Failed to execute 'insertBefore' on 'Node':
The new child element contains the parent.
```

## Root Cause

The match page renders **two separate JSON-LD script tags** as direct children of the same div:

1. `<MatchPageSchema>` - contains BreadcrumbList in its @graph
2. `<BreadcrumbsWithSchema>` → `<BreadcrumbSchema>` - renders a SECOND BreadcrumbList script

This causes:
- Duplicate breadcrumb schemas (SEO issue)
- Multiple script tags as siblings to client components (hydration issue)
- Radix UI accordion trying to manage DOM conflicts with script placement

## Solution

Replace `BreadcrumbsWithSchema` with just `Breadcrumbs` on the match page since `MatchPageSchema` already includes the breadcrumb schema in its consolidated @graph.

## Tasks

### Task 1: Update match page to use Breadcrumbs instead of BreadcrumbsWithSchema

**File:** `src/app/leagues/[slug]/[match]/page.tsx`

**Change:**
- Line 10: Import `Breadcrumbs` instead of `BreadcrumbsWithSchema`
- Line 157: Use `<Breadcrumbs items={breadcrumbs} />` instead of `<BreadcrumbsWithSchema items={breadcrumbs} />`

**Verification:**
- Build passes: `npm run build`
- No duplicate breadcrumb schemas in page source
- Page loads correctly in new tab without HierarchyRequestError
