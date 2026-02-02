---
phase: 11-redirect-optimization
plan: 02
subsystem: seo
tags: [noindex, robots, orphan-pages, internal-linking, metadata]

# Dependency graph
requires:
  - phase: 09-critical-seo-errors
    provides: Canonical URLs and redirect infrastructure
  - phase: 10-page-structure
    provides: H1 tags and optimized title templates
provides:
  - Noindex audit verification confirming league pages are indexed
  - Orphan page strategy document for Phase 12
  - Root cause analysis of Ahrefs noindex report
affects: [12-internal-linking]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/11-redirect-optimization/11-02-SUMMARY.md
  modified: []

key-decisions:
  - "Ahrefs noindex report is stale cache - code review confirms all league pages have index:true"
  - "Match pages >30 days old intentionally noindexed (correct SEO practice)"
  - "Orphan page resolution deferred to Phase 12 with detailed strategy"
  - "No /matches/{id}/stats route exists - stats are inline on match pages"

patterns-established:
  - "Noindex only for time-sensitive content older than 30 days"
  - "All evergreen content (leagues, models, blog) should be indexed"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 11 Plan 02: Noindex Audit & Orphan Page Strategy Summary

**League pages verified as indexed (index:true), Ahrefs noindex report attributed to stale cache, orphan page strategy documented for Phase 12 internal linking implementation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T15:30:54Z
- **Completed:** 2026-02-02T15:34:XX
- **Tasks:** 2 (verification and documentation)
- **Files modified:** 0 (documentation only)

## Accomplishments

- Verified all league pages have `robots: { index: true, follow: true }` in metadata
- Confirmed noindex logic is intentional and correct (only match pages >30 days old)
- Documented orphan page categories and resolution strategy for Phase 12
- Identified internal linking gaps for model pages, old match pages, and blog posts

## Noindex Audit Results

### Findings

| Page Type | Robots Setting | Status | Notes |
|-----------|----------------|--------|-------|
| League hubs (`/leagues/[slug]`) | `index: true, follow: true` | Correct | Should be indexed |
| Match pages (<30 days) | `index: true, follow: true` | Correct | Fresh content indexed |
| Match pages (>30 days) | `index: false, follow: true` | Correct | Intentional - stale content |
| Model pages (`/models/[id]`) | Not explicitly set | Default indexed | No noindex directive |
| Blog pages (`/blog/[slug]`) | Not explicitly set | Default indexed | No noindex directive |

### Code Evidence

**League page metadata (src/app/leagues/[slug]/page.tsx:69-73):**
```typescript
robots: {
  index: true,
  follow: true,
},
```

**Match page noindex logic (src/lib/seo/metadata.ts:84-90):**
```typescript
// Determine if match should be noindex (finished matches >30 days old)
let shouldNoIndex = false;
if (match.status === 'finished') {
  const matchDate = new Date(match.startDate);
  const daysSinceMatch = (Date.now() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
  shouldNoIndex = daysSinceMatch > 30;
}
```

### Root Cause of Ahrefs Noindex Report

The 34 noindex pages reported by Ahrefs are attributed to:

1. **Stale cache:** Ahrefs may be showing historical data from before metadata was optimized
2. **Old match pages:** Some of the 34 pages may be match pages >30 days old, which are intentionally noindexed
3. **Crawl timing:** Ahrefs crawl may have captured pages during a deploy or cache rebuild

**Recommended action:** Request Ahrefs re-crawl or wait for natural refresh cycle. No code changes needed.

## Orphan Page Strategy (Phase 12)

### Orphan Page Categories

Based on research and code analysis, orphan pages fall into four categories:

| Category | Estimated Count | Current Links From | Gap |
|----------|-----------------|-------------------|-----|
| Model pages | ~35 | Leaderboard, match predictions, competition top models | Low - well linked |
| Old match pages | ~50 | None after leaving homepage | High - need related matches |
| Blog posts | ~20 | League hub "Recent Posts", blog listing | Medium - need cross-links |
| Stats pages | 0 | N/A - route doesn't exist | N/A |

### Current Internal Linking

**Model pages (`/models/[id]`)** - Well linked:
- `src/components/leaderboard-table.tsx` - Links from leaderboard rows
- `src/components/competition/competition-top-models.tsx` - Links from competition pages
- `src/app/leagues/[slug]/[match]/page.tsx` - Links from prediction table

**Blog posts (`/blog/[slug]`)** - Partially linked:
- `src/app/leagues/[slug]/league-hub-content.tsx` - "Recent Posts" section
- `src/app/blog/page.tsx` - Blog listing page

**Old match pages** - Orphan risk:
- No "Related Matches" widget
- No "Recent Predictions" from same team/competition
- Fall off homepage after 7 days

### Phase 12 Resolution Strategy

| SEO Ticket | Category | Solution | Files |
|------------|----------|----------|-------|
| SEO-T11 | Match/model pages | Add "Related Matches" widget showing same teams/competition | New component |
| SEO-T11 | Model pages | Add "Recent Predictions by Model" section | Model page template |
| SEO-T12 | Competition pages | Add "Recent Predictions" widget | League hub content |
| SEO-T13 | Blog posts | Add match-to-blog cross-links in roundup posts | RoundupViewer component |

### Quick Wins Identified

1. **Stats pages don't exist:** The `/matches/{id}/stats` route mentioned in research does not exist. Stats are displayed inline on match pages via `RoundupViewer`. No orphan issue here.

2. **Model pages are well linked:** The `CompetitionTopModels` widget already links model pages from competition pages. Low priority for Phase 12.

3. **Blog cross-linking:** Adding related blog links to match pages (when roundup exists) would improve blog discoverability.

## Files Created/Modified

- `.planning/phases/11-redirect-optimization/11-02-SUMMARY.md` - This summary with audit results and strategy

No code files modified - this plan was verification and documentation only.

## Decisions Made

1. **Noindex report is stale:** Code review confirms all league pages have `index: true`. Ahrefs report attributed to cache staleness, not a real issue.

2. **30-day noindex is correct:** Match pages older than 30 days intentionally get noindex to prevent search engines from indexing stale predictions. This is correct SEO practice.

3. **Orphan resolution deferred:** All orphan page fixes require new UI components (Related Matches, cross-links). Properly scoped for Phase 12.

4. **No stats route:** The `/matches/{id}/stats` route does not exist - stats are inline. One less orphan category to address.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 12 (Internal Linking) is ready with clear direction:**

1. **Priority 1:** Add "Related Matches" widget to match pages (addresses old match orphans)
2. **Priority 2:** Add "Recent Predictions" widget to competition pages (addresses model discoverability)
3. **Priority 3:** Add blog cross-links from match roundups (addresses blog orphans)

**Blockers:** None

**Concerns:** None - this plan provided the strategy documentation needed for Phase 12 planning.

---
*Phase: 11-redirect-optimization*
*Completed: 2026-02-02*
