---
phase: quick-014
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/competition/recent-predictions-widget.tsx
  - src/components/MatchPageSchema.tsx
  - src/lib/content/queries.ts
  - src/app/api/admin/trigger-roundups/route.ts
  - src/lib/queue/workers/fixtures.worker.ts
  - src/middleware.ts
  - src/app/leagues/[slug]/league-hub-content.tsx
  - src/lib/seo/schema/sports-event.ts
autonomous: true

must_haves:
  truths:
    - "No internal links generate /leagues/{long-slug}/ URLs that trigger 301 redirects"
    - "/leagues/turkish-super-lig redirects to /leagues/superlig with 301"
    - "League pages show all finished matches (not capped at 12)"
    - "SportsEvent schema has valid Place without invalid address string"
  artifacts:
    - path: "src/middleware.ts"
      provides: "Turkish Super Lig redirect mapping"
      contains: "turkish-super-lig"
    - path: "src/components/competition/recent-predictions-widget.tsx"
      provides: "Canonical competition.id in URLs"
      contains: "competition.id"
    - path: "src/lib/seo/schema/sports-event.ts"
      provides: "Valid Place schema without bare string address"
  key_links:
    - from: "src/components/competition/recent-predictions-widget.tsx"
      to: "/leagues/{id}"
      via: "competition.id in URL construction"
      pattern: "competition\\.id"
    - from: "src/middleware.ts"
      to: "/leagues/superlig"
      via: "LEAGUE_SLUG_REDIRECTS map"
      pattern: "turkish-super-lig.*superlig"
---

<objective>
Fix four Ahrefs SEO audit issues: (1) eliminate 30+ redirect-causing URLs by using competition.id instead of competition.slug, (2) add missing Turkish Super Lig redirect, (3) show all finished matches on league pages to eliminate orphan pages, (4) fix structured data Place/PostalAddress validation errors.

Purpose: Resolve Ahrefs-reported issues to improve site health score and eliminate unnecessary redirect chains, orphan pages, and schema validation errors.
Output: All four issue categories resolved with build verification.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/competition/recent-predictions-widget.tsx
@src/components/MatchPageSchema.tsx
@src/lib/content/queries.ts
@src/app/api/admin/trigger-roundups/route.ts
@src/lib/queue/workers/fixtures.worker.ts
@src/middleware.ts
@src/app/leagues/[slug]/league-hub-content.tsx
@src/lib/seo/schema/sports-event.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix redirect-causing URLs and add Turkish Super Lig redirect</name>
  <files>
    src/components/competition/recent-predictions-widget.tsx
    src/lib/content/queries.ts
    src/app/api/admin/trigger-roundups/route.ts
    src/lib/queue/workers/fixtures.worker.ts
    src/middleware.ts
  </files>
  <action>
Fix all places that use `competition.slug` (the long-form DB field like "premier-league") to build URLs. These must use `competition.id` (the short canonical form like "epl") instead.

**File 1: `src/components/competition/recent-predictions-widget.tsx` line 30**
Change:
```
`/leagues/${competition.slug || competition.id}/${match.slug}`
```
To:
```
`/leagues/${competition.id}/${match.slug}`
```
The `competition.slug` from DB is always the long form. `competition.id` is always the canonical short form.

**File 2: `src/lib/content/queries.ts` line 675**
Change:
```
competitionSlug: roundupMatches[0].competition.slug || roundupMatches[0].competition.id,
```
To:
```
competitionSlug: roundupMatches[0].competition.id,
```
This feeds into blog post slug generation via `generator.ts`. Using the short ID produces cleaner blog slugs (e.g., "epl-week-20-roundup" not "premier-league-week-20-roundup"). Note: existing blog posts already in DB will keep their old slugs -- this only affects NEW roundups.

**File 3: `src/app/api/admin/trigger-roundups/route.ts` line 66**
Change:
```
competitionSlug: competition.slug || competition.name.toLowerCase().replace(/\s+/g, '-'),
```
To:
```
competitionSlug: competition.id,
```
Same rationale -- use the canonical short-form ID for roundup slug generation.

**File 4: `src/lib/queue/workers/fixtures.worker.ts` line 91**
Change:
```
newMatchUrls.push(`https://kroam.xyz/leagues/${competitionSlug}/${slug}`);
```
To:
```
newMatchUrls.push(`https://kroam.xyz/leagues/${competition.id}/${slug}`);
```
The `competitionSlug` variable here comes from `generateCompetitionSlug(competition.name)` which produces the long-form slug. The IndexNow ping URL should use the canonical short-form `competition.id`.

**File 5: `src/middleware.ts` -- Add Turkish Super Lig redirect**
Add to the `LEAGUE_SLUG_REDIRECTS` map:
```
'turkish-super-lig': 'superlig',
```
This ensures /leagues/turkish-super-lig (the DB slug for Turkish Super Lig) redirects to /leagues/superlig (the canonical ID).
  </action>
  <verify>
Run `npx next build --webpack` to verify no type errors.
Grep all modified files for `competition.slug` usage in URL construction -- should find none (except MatchPageSchema.tsx which receives pre-resolved slug from the match page).
Run: `grep -rn 'competition\.slug' src/components/competition/recent-predictions-widget.tsx src/lib/content/queries.ts src/app/api/admin/trigger-roundups/route.ts` -- should return nothing.
Verify middleware has 'turkish-super-lig' entry.
  </verify>
  <done>
All internal URL construction uses competition.id (canonical short-form). Turkish Super Lig redirect is in middleware. No more redirect-causing URLs generated by application code.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix orphan pages and structured data errors</name>
  <files>
    src/app/leagues/[slug]/league-hub-content.tsx
    src/lib/seo/schema/sports-event.ts
  </files>
  <action>
**File 1: `src/app/leagues/[slug]/league-hub-content.tsx` line 106**
Remove the `.slice(0, 12)` cap on finished matches. Change:
```
<MatchGrid matchList={finishedMatches.slice(0, 12)} />
```
To:
```
<MatchGrid matchList={finishedMatches} />
```
The query already fetches 50 matches (`getMatchesByCompetitionId(competitionId, 50)` on line 60). Showing all returned finished matches (rather than capping at 12) ensures those match pages have at least one internal link from the league hub. The 50-match query limit is sufficient -- no need to increase it further.

Also update the heading to not say "Recent Results" when showing all of them. Change:
```
Recent Results ({finishedMatches.length})
```
To:
```
Results ({finishedMatches.length})
```

**File 2: `src/lib/seo/schema/sports-event.ts` lines 30-34**
The `address` field currently uses a plain string which fails Google Rich Results validation (expects PostalAddress object). Since we don't have real postal address data, simply remove the `address` property entirely. The `Place` with just a `name` is valid Schema.org.

Change the location block from:
```typescript
location: {
  '@type': 'Place',
  name: match.venue ?? 'Unknown Venue',
  // Google Rich Results requires Place @type explicitly
  address: match.venue ?? 'Unknown Venue',
},
```
To:
```typescript
location: {
  '@type': 'Place',
  name: match.venue ?? 'Unknown Venue',
},
```

Also check `src/components/MatchPageSchema.tsx` -- this file already has the correct location format (Place with just name, no address field at lines 71-73). No change needed there. Just verify it remains correct.
  </action>
  <verify>
Run `npx next build --webpack` to verify no build errors.
Grep for `address:` in `src/lib/seo/schema/sports-event.ts` -- should return nothing.
Grep for `.slice(0, 12)` in league-hub-content.tsx -- should return nothing.
  </verify>
  <done>
League pages display all finished matches (up to 50) -- no more orphan match pages. SportsEvent schema uses Place with name only (no invalid address string). Build passes clean.
  </done>
</task>

</tasks>

<verification>
1. `npx next build --webpack` passes with 0 errors
2. `grep -rn 'competition\.slug' src/components/competition/recent-predictions-widget.tsx src/lib/content/queries.ts src/app/api/admin/trigger-roundups/route.ts` returns no matches
3. `grep -n 'turkish-super-lig' src/middleware.ts` returns the new redirect entry
4. `grep -n 'address:' src/lib/seo/schema/sports-event.ts` returns no matches
5. `grep -n '.slice(0, 12)' src/app/leagues/\[slug\]/league-hub-content.tsx` returns no matches
</verification>

<success_criteria>
- All four Ahrefs issue categories resolved
- No URL construction in the codebase produces redirect-causing /leagues/{long-slug}/ paths
- Turkish Super Lig has a working redirect from /leagues/turkish-super-lig to /leagues/superlig
- League hub pages show all finished matches (up to query limit of 50)
- SportsEvent structured data passes Google Rich Results validation (no bare string address)
- Build compiles successfully
</success_criteria>

<output>
After completion, create `.planning/quick/014-fix-ahrefs-seo-issues/014-SUMMARY.md`
</output>
