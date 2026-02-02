# Domain Pitfalls: UI/UX Redesign for Next.js Sports Platform

**Domain:** Next.js sports prediction platform UI/UX rebuild
**Researched:** 2026-02-02
**Confidence:** HIGH (verified via official Next.js docs, GitHub issues, and current project analysis)

---

## Critical Pitfalls

Mistakes that cause rewrites, major regressions, or SEO damage.

### Pitfall 1: Client Component Creep Destroys Bundle Size

**What goes wrong:** During redesign, developers add `'use client'` to components for convenience (using hooks, event handlers) without considering the cascade effect. Child components become client components too, bloating the JavaScript bundle.

**Why it happens:**
- Redesign often means adding interactivity
- Easier to make everything client than think about boundaries
- Existing codebase may already have this problem (current `navigation.tsx` is client-side)

**Consequences:**
- Bundle size increases 30-60%
- LCP degrades significantly
- INP suffers from hydration overhead
- RSC benefits disappear

**Warning signs:**
- Many files start with `'use client'`
- Components that only render data still marked as client
- Next.js bundle analyzer shows large client chunks

**Prevention:**
1. Audit every `'use client'` directive during redesign
2. Create clear component boundaries: Server for data, Client for interaction
3. Use composition pattern: Server component wraps Client component
4. Move data fetching to Server Components (current match pages do this well)

**Detection:**
```bash
# Count client components
grep -r "'use client'" src/components | wc -l
```

**Which phase:** Address in Phase 1 (Component Architecture). Establish patterns before building.

**Current codebase observation:** Navigation is client (`navigation.tsx`), which is correct for `usePathname`. But 71+ component files need audit.

---

### Pitfall 2: LCP Regression from Hero/Above-the-Fold Changes

**What goes wrong:** Redesign changes what appears above the fold. New hero images, new layout causes Largest Contentful Paint element to change. Missing `priority` attribute on new LCP element causes 2-4 second delay.

**Why it happens:**
- Next.js lazy-loads images by default
- New LCP element not marked with `priority` or `fetchpriority="high"`
- Developers don't test on throttled connections
- Multiple images compete for priority

**Consequences:**
- LCP goes from green (<2.5s) to red (>4s)
- Google Search Console shows Core Web Vitals regression
- SEO rankings drop within weeks

**Warning signs:**
- Console warning: "Image with src X was detected as LCP"
- PageSpeed Insights shows "Largest Contentful Paint element" is an image without preload
- Field data in Search Console degrades

**Prevention:**
1. Identify LCP element for each page type before redesign
2. Mark LCP images with `priority` (or `preload` in Next.js 16+)
3. Add PageSpeed Insights check to CI/CD pipeline
4. Test on 3G throttled connection before merge

**Detection:**
- Run Lighthouse on each page type
- Check: `<Image priority />` on above-fold images

**Which phase:** Phase 2 (Core Web Vitals). Must be addressed before any visual redesign deploys.

**Current codebase observation:** Match pages don't have hero images (good), but any redesign adding team logos above fold needs priority handling.

---

### Pitfall 3: Breaking Existing URLs During Redesign

**What goes wrong:** URL structure changes during redesign. Old URLs return 404. Backlinks break. Google drops pages from index.

**Why it happens:**
- New routing structure seems cleaner
- Parameter changes (e.g., from `/matches/[id]` to `/match/[slug]`)
- Forgetting to add redirects

**Consequences:**
- Immediate SEO traffic loss (25-80%)
- Broken backlinks
- Users bookmarks fail
- Google shows 404 errors in Search Console

**Warning signs:**
- New route patterns in `app/` directory
- Old route files deleted without redirect implementation
- No redirect testing in deployment

**Prevention:**
1. Document all existing URL patterns before redesign
2. Keep existing routes or implement 301 redirects
3. Add redirect map to `next.config.js`
4. Test all old URLs post-deployment

**Detection:**
- Crawl site before and after, compare URL lists
- Check Search Console for 404 spike

**Which phase:** Phase 1 (Planning). URL audit must happen before any routing changes.

**Current codebase observation:** Already has good pattern with `/leagues/[slug]/[match]` and redirect from `/matches/[id]`. This pattern must be preserved.

---

### Pitfall 4: ISR Cache Staleness with CDN Layer

**What goes wrong:** Next.js ISR works in development but production shows stale content. Two caching layers (Next.js + CDN) create 2x stale time.

**Why it happens:**
- Next.js sets `Cache-Control: s-maxage=X, stale-while-revalidate`
- CDN respects this header and caches stale response
- Request hits CDN cache, CDN requests from origin, origin returns cached stale
- Result: 2x configured revalidate time

**Consequences:**
- Live match scores show old data
- Predictions don't update after matches
- Users see outdated content for hours

**Warning signs:**
- Content older than `revalidate` time appears
- Production behaves differently than development
- Manual refresh shows different content than navigation

**Prevention:**
1. For truly dynamic sports data, use `export const dynamic = 'force-dynamic'`
2. Configure CDN to respect `must-revalidate`
3. Use on-demand revalidation via API routes for critical updates
4. Test ISR behavior in staging with CDN layer

**Detection:**
- Check `Cache-Control` headers in production
- Compare data timestamp to server time

**Which phase:** Phase 2 (Performance). Must verify caching strategy for each page type.

**Current codebase observation:** Match pages have both `dynamic = 'force-dynamic'` and `revalidate = 60`. These conflict - `force-dynamic` wins but intention is unclear.

---

### Pitfall 5: Structured Data (JSON-LD) Breaks During Component Refactoring

**What goes wrong:** Schema.org structured data lives in components being redesigned. Refactoring breaks or removes JSON-LD scripts. Google loses rich results.

**Why it happens:**
- Schema generation mixed with UI components
- Developers don't understand SEO impact
- No automated validation in CI

**Consequences:**
- Rich snippets disappear from search results
- Click-through rate drops
- Competitive disadvantage

**Warning signs:**
- JSON-LD scripts moved or deleted during refactor
- Schema test in Google shows errors
- Rich results drop in Search Console

**Prevention:**
1. Extract all schema generation to dedicated module (`/lib/seo/`)
2. Keep schema logic separate from UI components
3. Add schema validation to test suite
4. Monitor Search Console enhancements report

**Detection:**
- Test with Google's Rich Results Test
- Validate all pages have required schema types

**Which phase:** Phase 1 (Planning). Audit and protect existing schema before any UI changes.

**Current codebase observation:** Good - schema is already in `/lib/seo/schema/` and components (`MatchPageSchema.tsx`, etc.). Preserve this separation.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or user experience degradation.

### Pitfall 6: Navigation State Loss During Client-Side Transitions

**What goes wrong:** Client components in layout re-render on navigation in production (but not development). Search input loses text, modals close unexpectedly, filters reset.

**Why it happens:**
- Known Next.js issue: Client components in root layout may re-render
- `React.memo` can make it worse (state loss)
- Difference between dev and production behavior

**Consequences:**
- Users frustrated by lost input
- Search modal closes on navigation
- Filter selections reset

**Warning signs:**
- Works in development, breaks in production
- Components lose state during soft navigation
- Console shows unexpected re-renders

**Prevention:**
1. Test navigation state in production build (`next build && next start`)
2. Lift persistent state to context or URL params
3. Use `<Link>` for SPA transitions, not `<a>` tags
4. Avoid `React.memo` on stateful layout components

**Detection:**
- Type in search, navigate, check if text persists
- Open modal, click nav link, check if modal state preserved

**Which phase:** Phase 3 (Component Implementation). Test each interactive component's state persistence.

**Current codebase observation:** `SearchModal` in navigation - test search input persistence after navigation.

---

### Pitfall 7: Internal Link Automation Creates Broken Links

**What goes wrong:** Automated internal linking system generates links to pages that don't exist, have changed URLs, or are behind 404s.

**Why it happens:**
- Links generated from database that's out of sync with routes
- URL pattern changes without updating link generation
- Soft-deleted content still has link entries

**Consequences:**
- Broken links hurt SEO (waste crawl budget)
- User experience degrades
- 42% of websites have broken internal links (industry stat)

**Warning signs:**
- 404 spike in Search Console
- Crawl reports show broken links
- Users report "page not found"

**Prevention:**
1. Validate generated links exist before rendering
2. Add link health check to build process
3. Use database foreign keys to prevent orphaned links
4. Monitor 404 rate in analytics

**Detection:**
- Run Screaming Frog or similar crawler monthly
- Check `404` requests in server logs

**Which phase:** Phase 4 (Internal Linking). Build validation into link generation.

**Current codebase observation:** `RelatedMatchesWidget` generates links from database queries - ensure query only returns valid matches with slugs.

---

### Pitfall 8: Mobile-First Design Inversion

**What goes wrong:** Desktop redesign completed first, then "shrunk" for mobile. Mobile experience is cramped, unusable, or completely different.

**Why it happens:**
- Designers work on large screens
- Stakeholders review on desktop
- Mobile treated as afterthought

**Consequences:**
- 60% of traffic has poor experience (mobile majority)
- Bounce rate increases on mobile
- Core Web Vitals fail on mobile specifically

**Warning signs:**
- No mobile mockups in design phase
- Testing only happens on desktop
- Mobile CSS is overrides and `!important`

**Prevention:**
1. Design mobile first, enhance for desktop
2. Include mobile in every design review
3. Test on real devices, not just browser resize
4. Set mobile as primary viewport in Lighthouse

**Detection:**
- Run PageSpeed Insights with "Mobile" selected
- Test on actual phones (iOS Safari, Android Chrome)

**Which phase:** Phase 1 (Design). Establish mobile-first workflow from the start.

**Current codebase observation:** `match-tabs-mobile.tsx` exists (good mobile consideration), but desktop has separate layout. Ensure parity.

---

### Pitfall 9: Component Library Version Drift

**What goes wrong:** Radix/shadcn components updated mid-redesign. New version has different prop contracts, breaking existing components.

**Why it happens:**
- Developer runs `npm update` during redesign
- Major version of Radix changes API
- shadcn CLI pulls newer versions

**Consequences:**
- Build breaks
- Components behave differently
- Debugging time wasted

**Warning signs:**
- TypeScript errors after install
- Components render incorrectly
- Props that worked before now error

**Prevention:**
1. Pin Radix/shadcn versions in package.json
2. Don't update dependencies during active redesign
3. If update needed, do it as isolated task with full regression test
4. Use lockfile (`package-lock.json` or `pnpm-lock.yaml`)

**Detection:**
- Check for version changes in `package-lock.json` diff
- TypeScript errors on existing component props

**Which phase:** All phases. Lock versions before starting, update only when complete.

---

### Pitfall 10: Over-Engineering Design System for Small Team

**What goes wrong:** Team builds comprehensive design system with 50+ components before shipping anything. System goes unused because it doesn't match actual needs.

**Why it happens:**
- Trying to build "the right way"
- Following enterprise patterns for startup scale
- Building for hypothetical future needs

**Consequences:**
- Months wasted on unused components
- Actual UI needs differ from predictions
- Team resistance to overly complex system

**Warning signs:**
- More time on design system than product features
- Components built without immediate use case
- Extensive documentation for internal team of 1-2

**Prevention:**
1. Build components as needed (just-in-time)
2. Extract patterns after 3rd use, not before 1st
3. Use shadcn's copy-paste model - components in your codebase
4. Documentation only for non-obvious patterns

**Detection:**
- Count components with zero imports
- Check ratio of system work to feature work

**Which phase:** Phase 1 (Planning). Define minimal viable system.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: Inconsistent Spacing/Colors Across New Components

**What goes wrong:** Different developers use different spacing values. Some use Tailwind spacing scale, others use arbitrary values. Visual inconsistency.

**Prevention:**
- Define and enforce spacing scale (4, 8, 12, 16, 24, 32, 48)
- Use CSS custom properties for colors (already done in globals.css)
- Add ESLint rule for arbitrary spacing values

**Current codebase observation:** Good - using CSS variables (`--border`, `--muted`, etc.). Maintain this pattern.

---

### Pitfall 12: Missing Loading States in Redesigned Components

**What goes wrong:** Old loading states not recreated in new components. Users see blank screens during data fetch.

**Prevention:**
- Audit all existing Suspense boundaries and skeletons
- Create corresponding loading states for new components
- Use `loading.tsx` files in route segments

**Current codebase observation:** Has `predictions-skeleton.tsx`, `leaderboard/skeleton.tsx` - ensure redesign preserves these.

---

### Pitfall 13: Forgetting Error Boundaries in New Component Tree

**What goes wrong:** Error boundary exists in old tree, not added to new tree. Single component error crashes entire page.

**Prevention:**
- Add `error.tsx` to each route segment
- Wrap risky components with error boundaries
- Test error states explicitly

**Current codebase observation:** Has `ErrorBoundaryProvider` in layout - ensure new components are covered.

---

### Pitfall 14: Date/Time Display Without Timezone Handling

**What goes wrong:** Match times display in wrong timezone for users. Already have `client-date.tsx` pattern but new components don't use it.

**Prevention:**
- All date displays must use client-side component
- Use existing `client-date.tsx` pattern for new components
- Consider user locale for formatting

---

### Pitfall 15: Accessibility Regression in New Interactive Components

**What goes wrong:** New modals, tabs, dropdowns lack proper ARIA attributes, keyboard navigation, focus management.

**Prevention:**
- Use Radix primitives (already in stack) which handle a11y
- Test with keyboard-only navigation
- Run axe-core in CI

**Current codebase observation:** Using Radix (`@radix-ui/react-*`) - continue using primitives, don't build custom.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Component Architecture | Client component creep (#1) | Establish server/client boundaries in design doc |
| Core Web Vitals | LCP regression (#2) | Add Lighthouse to CI before any visual changes |
| URL Structure | Breaking URLs (#3) | Complete URL audit before any route changes |
| Caching Strategy | ISR staleness (#4) | Document caching intent for each page type |
| SEO Protection | Schema breakage (#5) | Keep schema separate, add validation tests |
| Navigation | State loss (#6) | Test production build, not just dev |
| Internal Linking | Broken links (#7) | Validate links at generation time |
| Responsive Design | Mobile afterthought (#8) | Mobile-first design process |
| Dependencies | Version drift (#9) | Lock versions, isolated update PRs |
| Design System | Over-engineering (#10) | Just-in-time component creation |

---

## Quick Validation Checklist Before Each Phase

Before starting any phase:

- [ ] LCP element identified for affected pages?
- [ ] URL changes documented with redirect plan?
- [ ] Schema/JSON-LD protected from refactor?
- [ ] Mobile design addressed, not deferred?
- [ ] Caching behavior verified for page type?
- [ ] Existing loading/error states preserved?

Before deploying:

- [ ] Bundle size compared to baseline?
- [ ] Lighthouse scores compared to baseline?
- [ ] All old URLs tested (redirects work)?
- [ ] Production build tested, not just dev?
- [ ] Search Console monitored for 48 hours post-deploy?

---

## Sources

**Official Documentation:**
- [Next.js ISR Guide](https://nextjs.org/docs/pages/guides/incremental-static-regeneration)
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)

**GitHub Issues & Discussions:**
- [Layout re-render on navigation](https://github.com/vercel/next.js/issues/52558)
- [ISR stale data issue](https://github.com/vercel/next.js/issues/58909)
- [LCP warning discussion](https://github.com/vercel/next.js/discussions/48255)

**Industry Research:**
- [Next.js App Router Common Mistakes](https://upsun.com/blog/avoid-common-mistakes-with-next-js-app-router/)
- [Design System Adoption Pitfalls](https://www.netguru.com/blog/design-system-adoption-pitfalls)
- [Internal Linking Mistakes](https://www.quattr.com/improve-discoverability/internal-linking-mistakes)
- [UX Design Mistakes 2025](https://www.designstudiouiux.com/blog/ux-design-mistakes/)
- [Core Web Vitals Optimization 2025](https://nitropack.io/blog/core-web-vitals-strategy/)
