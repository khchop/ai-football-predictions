---
phase: quick-054
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/layout.tsx
  - src/app/not-found.tsx
  - src/app/models/error.tsx
  - src/app/blog/error.tsx
  - src/app/teams/[slug]/error.tsx
  - src/app/teams/error.tsx
autonomous: true

must_haves:
  truths:
    - "Users see a loading skeleton (not blank white) while any page's async content resolves"
    - "Users see a styled 404 page when navigating to non-existent routes"
    - "Users see an error UI with retry button when any page-level data fetch fails"
  artifacts:
    - path: "src/app/layout.tsx"
      provides: "Root Suspense with visible loading fallback"
      contains: "fallback={"
    - path: "src/app/not-found.tsx"
      provides: "Styled 404 page"
      contains: "not found"
    - path: "src/app/models/error.tsx"
      provides: "Error boundary for /models route"
      contains: "error"
    - path: "src/app/blog/error.tsx"
      provides: "Error boundary for /blog route"
      contains: "error"
    - path: "src/app/teams/[slug]/error.tsx"
      provides: "Error boundary for /teams/[slug] route"
      contains: "error"
  key_links:
    - from: "src/app/layout.tsx"
      to: "all page routes"
      via: "Suspense fallback around {children}"
      pattern: "Suspense fallback="
---

<objective>
Fix empty page loads caused by missing Suspense fallbacks, missing error boundaries, and missing not-found page.

Purpose: Users currently see blank white pages when (a) async server components are resolving, (b) database queries fail, or (c) they navigate to non-existent routes. This makes the site appear broken.

Output: Root layout with proper loading fallback, root not-found.tsx, and error.tsx files for unprotected routes.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/layout.tsx
@src/app/error.tsx
@src/app/page.tsx
@src/components/error-boundary-provider.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix root Suspense fallback and evaluate ViewTransition</name>
  <files>src/app/layout.tsx</files>
  <action>
In `src/app/layout.tsx`, the `<Suspense>` on line 131 wrapping `{children}` has NO `fallback` prop. The default fallback is `null`, which means the entire main content area renders as blank white while any async server component resolves. This is the #1 cause of empty page loads.

Fix:
1. Add a proper loading fallback to the Suspense wrapping `{children}` (line 131). Create a `PageLoadingSkeleton` component inline (similar to existing `NavigationSkeleton` pattern) that shows:
   - A centered container with the same max-width as main content
   - 3-4 skeleton blocks using the `animate-pulse` pattern already used in NavigationSkeleton
   - A header-sized skeleton (h-8 w-64) at top
   - 2-3 card-sized skeletons (rounded-xl, h-48) below in a grid matching the common page layout
   - Use the same Tailwind classes as existing skeletons: `bg-muted animate-pulse rounded-xl`

2. Change line 131 from `<Suspense>` to `<Suspense fallback={<PageLoadingSkeleton />}>`

3. Leave the `<ViewTransition>` wrapper in place -- it is a React 19 feature that is useful for route transitions and removing it could break navigation animations. The Suspense fallback fix addresses the root blank page issue. If ViewTransition causes issues separately, that can be addressed later.

Do NOT change any other Suspense boundaries in the file (Navigation and BottomNav already have proper fallbacks).
  </action>
  <verify>
Run `npx next build --webpack 2>&1 | tail -20` to verify the build still succeeds. Then grep `src/app/layout.tsx` for `fallback=` to confirm all three Suspense boundaries have fallbacks.
  </verify>
  <done>The root Suspense boundary around {children} has a visible loading skeleton fallback. No Suspense in layout.tsx has a missing or null fallback.</done>
</task>

<task type="auto">
  <name>Task 2: Add root not-found.tsx and missing route error.tsx files</name>
  <files>src/app/not-found.tsx, src/app/models/error.tsx, src/app/blog/error.tsx, src/app/teams/[slug]/error.tsx, src/app/teams/error.tsx</files>
  <action>
Create the following files to close gaps where errors/404s produce blank or unstyled pages:

**1. `src/app/not-found.tsx`** (NEW file - currently missing entirely):
- Server component (no 'use client')
- Styled 404 page matching the site's dark theme
- Show a centered card with: icon (use `Search` from lucide-react), "Page Not Found" heading, descriptive text, and a Link back to home (`/`)
- Use existing Tailwind patterns from error.tsx: `min-h-[400px] flex items-center justify-center`, card styling with `rounded-xl border border-border/50 bg-card/50`
- Include a "Back to Home" link styled as a button: `inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground`

**2. `src/app/models/error.tsx`** (NEW file - /models has no error boundary):
- Copy the pattern from existing `src/app/error.tsx` exactly (it's a 'use client' component with Sentry reporting, AlertTriangle icon, reset button)
- Only change: update the `error_boundary` tag to `'models_error'`

**3. `src/app/blog/error.tsx`** (NEW file - /blog has no error boundary):
- Same pattern as models/error.tsx
- Tag: `'blog_error'`

**4. `src/app/teams/[slug]/error.tsx`** (NEW file - /teams/[slug] has no error boundary despite 7 parallel queries):
- Same pattern as models/error.tsx
- Tag: `'team_page_error'`

**5. `src/app/teams/error.tsx`** (NEW file - /teams index has no error boundary):
- Same pattern as models/error.tsx
- Tag: `'teams_error'`

All error.tsx files must be 'use client' components (Next.js requirement for error boundaries).
  </action>
  <verify>
Run `npx next build --webpack 2>&1 | tail -20` to verify build succeeds. Verify all files exist: `ls src/app/not-found.tsx src/app/models/error.tsx src/app/blog/error.tsx src/app/teams/error.tsx src/app/teams/\[slug\]/error.tsx`
  </verify>
  <done>
- Root not-found.tsx exists and shows styled 404 page
- error.tsx exists for /models, /blog, /teams, and /teams/[slug] routes
- Build passes with all new files
  </done>
</task>

</tasks>

<verification>
1. `npx next build --webpack` passes without errors
2. All Suspense boundaries in layout.tsx have explicit fallback props (no bare `<Suspense>`)
3. `src/app/not-found.tsx` exists
4. error.tsx files exist for: models, blog, teams, teams/[slug]
5. Grep confirms: `grep -r "fallback=" src/app/layout.tsx` shows 3 matches (nav, main content, bottom nav)
</verification>

<success_criteria>
- Zero bare `<Suspense>` (without fallback) in root layout
- All major routes have error.tsx boundaries
- Root not-found.tsx provides styled 404 experience
- Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/54-fix-empty-page-loads-comprehensive-inves/054-01-SUMMARY.md`
</output>
