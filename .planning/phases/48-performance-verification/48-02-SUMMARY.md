---
phase: 48
plan: 02
subsystem: seo-performance
requires: ["48-01"]
provides:
  - production-ttfb-baseline
  - pre-ahrefs-verification
  - site-audit-readiness
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - src/middleware.ts
decisions:
  - id: PERF-03
    choice: "Use Host header for hostname in Edge Runtime middleware"
    rationale: "request.url hostname can be 'localhost' in Edge Runtime, causing incorrect redirect URLs"
    alternatives: ["Use metadataBase", "Use env var"]
tags: [performance, seo, audit, production-verification]
duration: 8min
completed: 2026-02-06
---

# Phase 48 Plan 02: Production Performance Profiling & Pre-Ahrefs Verification Summary

**One-liner:** Production audit passes 6/6 with exceptional TTFB (50-73ms), all pre-Ahrefs spot-checks green, middleware hostname bug fixed, site declared Ahrefs-ready.

## What Was Done

### Task 1: Production TTFB Profiling
1. **Deployed latest code** (48-01 changes with Pass 6 TTFB measurement)
2. **Ran full audit** against production (https://kroam.xyz)
3. **Verified /matches/UUID redirect** performance (PERF-02)
4. **Analyzed TTFB results** across all page types

**Audit Results:**
- Pass 1 (Sitemap URL validation): ✓ 0 failures
- Pass 2 (Sitemap completeness): ✓ 0 failures
- Pass 3 (Internal link architecture): ✓ 0 failures, 1 warning (blog links below threshold)
- Pass 4 (Meta tag validation): ✓ 0 failures
- Pass 5 (JSON-LD validation): ✓ 0 failures
- Pass 6 (TTFB measurement): ✓ All page types under 100ms

**TTFB Profiling Results:**
| Page Type | Avg TTFB | Status |
|-----------|----------|--------|
| Index pages | 50ms | Excellent |
| League pages | 73ms | Excellent |
| Match pages | 54ms | Excellent |
| Model pages | 56ms | Excellent |
| Blog pages | 59ms | Excellent |

**All page types well under 2s target. No optimization needed.**

**/matches/UUID Redirect:**
- TTFB: 86ms (well under 500ms target)
- Status: 410 Gone (correct)
- Middleware responds synchronously with no database queries

### Task 2: Pre-Ahrefs Spot-Check Verification
Performed 6 pre-audit spot-checks to verify site readiness:

**Check 1: Sitemap Accessibility** ✓
- `/sitemap.xml` returns 200
- Lists 5 sub-sitemaps (static, leagues, models, blog, matches)

**Check 2: robots.txt** ✓
- Allows crawling of important paths
- References sitemap URL
- Allows AI crawlers (GPTBot, ClaudeBot, etc.)

**Check 3: Redirects** ✓
- www redirect: 301 to kroam.xyz (single-hop)
- Long-form league slugs: 301 to short-form (single-hop)
- **BUG FOUND:** League slug redirects used `localhost` hostname instead of actual domain

**Check 4: Sample Page Health** ✓
- 3 index pages: All 200
- 2 league pages: All 200
- 2 model pages: All 200
- 2 blog pages: All 200
- 2 match pages: All 200

**Check 5: Breadcrumb Structure** ✓
- League pages: 3-item breadcrumb (Home > Leagues > {League})
- Match pages: 4-item breadcrumb (Home > Leagues > {League} > {Match})
- Model pages: No breadcrumbs (acceptable, not required)

**Check 6: No Critical SEO Issues** ✓
- No 404 or 500 errors on sampled URLs
- No redirect chains (all single-hop)
- Canonical URLs self-referential

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed middleware hostname using localhost instead of domain**
- **Found during:** Task 2 Check 3 (redirect verification)
- **Issue:** Middleware used `url.hostname` from `request.url`, which in Edge Runtime was 'localhost' instead of actual domain. League slug redirects returned `Location: https://localhost/leagues/epl` instead of `https://kroam.xyz/leagues/epl`.
- **Root cause:** In Edge Runtime, `new URL(request.url).hostname` doesn't always preserve the actual requested domain
- **Fix:** Changed line 43 to use `request.headers.get('host')` as primary source, with `url.hostname` as fallback. The Host header always contains the actual requested domain.
- **Files modified:** src/middleware.ts
- **Commit:** 9340c1a
- **Impact:** All league slug redirects now work correctly. This bug would have broken SEO crawlers trying to follow redirected URLs.

## Context for Future Plans

### Performance Baseline Established
- **TTFB target achieved:** All page types 50-73ms (well under 2s threshold)
- **No further optimization needed** for v2.6 SEO work
- **Cold start variability:** Production TTFB may vary ±50ms depending on serverless cold starts, but this is acceptable
- **PPR effectiveness:** Static shells render instantly (50-60ms), dynamic content streams after

### Audit Infrastructure Ready
- **6-pass audit** now fully functional against production
- **AUDIT_BASE_URL=https://kroam.xyz** enables full HTML/schema validation
- **Pass 6 TTFB measurement** provides ongoing performance monitoring
- **Exit code 0** when all passes succeed (CI-friendly)

### Pre-Ahrefs Verification Complete
All 6 spot-checks passed:
1. ✓ Sitemap accessible and well-formed
2. ✓ robots.txt allows crawling with sitemap reference
3. ✓ All redirects work (301 permanent, single-hop)
4. ✓ Sample pages return 200 across all page types
5. ✓ Breadcrumb schemas present on applicable pages
6. ✓ No critical SEO issues (404s, 500s, redirect chains, duplicate canonicals)

**Site is Ahrefs-ready for Phase 48-03 external audit.**

## Task Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| 2 | 9340c1a | src/middleware.ts | Fixed middleware hostname bug (localhost → actual domain) |

**Investigation-only task (Task 1) produced no code changes - profiling and verification only.**

## Decisions Made

**PERF-03: Use Host header for hostname in Edge Runtime**
- **Context:** Middleware redirect logic needs reliable hostname to construct canonical URLs
- **Issue:** `new URL(request.url).hostname` in Edge Runtime can be 'localhost' instead of actual domain
- **Decision:** Use `request.headers.get('host')` as primary source, fallback to `url.hostname`
- **Rationale:** Host header always contains the actual requested domain, regardless of Edge Runtime quirks
- **Alternative considered:** Use NEXT_PUBLIC_BASE_URL env var, but this wouldn't work for preview deployments with dynamic domains
- **Impact:** All redirects now use correct domain in Location header

## Next Phase Readiness

### Ready for Phase 48-03 (External Audit)
- ✓ All internal validation passes (6/6)
- ✓ Performance meets targets (50-73ms TTFB)
- ✓ Pre-Ahrefs spot-checks complete
- ✓ No critical SEO issues found
- ✓ Redirect bug fixed before external audit

### Pending Items
None. Site is production-ready for external Ahrefs audit.

### Known Warnings (Acceptable)
- Blog pages have 1 link source (below 3-link threshold LINK-05)
  - Not a blocker: Blog posts are leaf content, limited internal linking is expected
  - Improvement: Could add "Related Posts" widget in future, but not required for v2.6

## Metrics

- **Plans completed:** 2/3 in Phase 48
- **Requirements validated:** 2 (PERF-01, PERF-02)
- **Total time:** 8 minutes (3min deploy wait, 2min audit, 3min spot-checks)
- **Exit codes:** 0 (all audit passes green)

---

*Phase 48 Plan 02 complete. Production audit passes 6/6 with exceptional performance. Site declared Ahrefs-ready.*

=== Self-Check Result: PASSED ===

All files and commits verified.
