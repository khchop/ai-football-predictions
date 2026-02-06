---
phase: quick-014
plan: 01
subsystem: seo
tags: [ahrefs, redirects, canonical-urls, structured-data, orphan-pages]
requires: [phase-44, phase-45]
provides: [ahrefs-issue-resolution, canonical-url-enforcement, schema-validation-fix]
affects: [future-roundup-generation, indexnow-pings]
tech-stack:
  added: []
  patterns: [competition.id-over-slug-for-urls]
key-files:
  created: []
  modified:
    - src/components/competition/recent-predictions-widget.tsx
    - src/lib/content/queries.ts
    - src/app/api/admin/trigger-roundups/route.ts
    - src/lib/queue/workers/fixtures.worker.ts
    - src/middleware.ts
    - src/app/leagues/[slug]/league-hub-content.tsx
    - src/lib/seo/schema/sports-event.ts
decisions:
  - id: q014-01
    description: "Use competition.id (canonical short-form) instead of competition.slug (long-form DB field) for all URL construction"
  - id: q014-02
    description: "Remove address property from SportsEvent Place schema (bare string fails Google Rich Results validation)"
  - id: q014-03
    description: "Show all finished matches on league hub (up to 50 from query) instead of capping at 12"
metrics:
  duration: 1m30s
  completed: 2026-02-06
---

# Quick Task 014: Fix Ahrefs SEO Issues Summary

**One-liner:** Canonical URL enforcement via competition.id, Turkish Super Lig redirect, orphan page elimination, and SportsEvent schema address fix.

## What Was Done

### Task 1: Fix redirect-causing URLs and add Turkish Super Lig redirect (ca6f4f2)

Fixed 4 files that used `competition.slug` (the long-form DB field like "premier-league") to construct URLs. All now use `competition.id` (the canonical short-form like "epl"):

- **recent-predictions-widget.tsx**: `/leagues/${competition.slug || competition.id}/${match.slug}` -> `/leagues/${competition.id}/${match.slug}`
- **queries.ts**: `competitionSlug: roundupMatches[0].competition.slug || roundupMatches[0].competition.id` -> `competitionSlug: roundupMatches[0].competition.id`
- **trigger-roundups/route.ts**: `competitionSlug: competition.slug || competition.name.toLowerCase().replace(/\s+/g, '-')` -> `competitionSlug: competition.id`
- **fixtures.worker.ts**: IndexNow ping URL changed from `competitionSlug` variable (long-form) to `competition.id` (canonical)

Added `'turkish-super-lig': 'superlig'` to the `LEAGUE_SLUG_REDIRECTS` map in middleware.ts.

### Task 2: Fix orphan pages and structured data errors (5fb93b0)

- **league-hub-content.tsx**: Removed `.slice(0, 12)` cap on finished matches. League hub pages now show all finished matches returned by the query (up to 50). Heading changed from "Recent Results" to "Results".
- **sports-event.ts**: Removed `address: match.venue ?? 'Unknown Venue'` from the Place object. A bare string address fails Google Rich Results validation. Place with just `name` is valid Schema.org. Confirmed MatchPageSchema.tsx already had the correct format.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix redirect-causing URLs and add Turkish Super Lig redirect | ca6f4f2 | 4 URL fixes + 1 middleware redirect |
| 2 | Fix orphan pages and structured data errors | 5fb93b0 | Remove .slice(0,12) + remove address field |

## Verification Results

| Check | Result |
|-------|--------|
| `npx next build --webpack` | PASS - 0 errors |
| No `competition.slug` in URL construction (3 files) | PASS |
| `turkish-super-lig` in middleware | PASS |
| No `address:` in sports-event.ts | PASS |
| No `.slice(0, 12)` in league-hub-content.tsx | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| q014-01 | Use competition.id for all URL construction | competition.id is the canonical short-form (e.g., "epl"); competition.slug is the long-form DB field (e.g., "premier-league") that triggers 301 redirects |
| q014-02 | Remove address from SportsEvent Place | Bare string address fails Google Rich Results validation; Place with name only is valid Schema.org |
| q014-03 | Show all finished matches (up to 50) | Eliminates orphan pages by ensuring every match has at least one internal link from league hub |

## Impact

- **Redirects eliminated:** ~30+ internal URLs that previously generated /leagues/{long-slug}/ paths now use canonical /leagues/{short-id}/ paths directly
- **New redirect:** /leagues/turkish-super-lig -> /leagues/superlig (301 permanent)
- **Orphan pages fixed:** League hubs now link to all finished matches (up to 50) instead of only 12
- **Schema validation:** SportsEvent Place no longer triggers Google Rich Results address errors
- **Future roundups:** New roundup blog post slugs will use short-form IDs (existing posts keep old slugs)

## Self-Check: PASSED
