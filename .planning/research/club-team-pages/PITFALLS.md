# Pitfalls Research: Club/Team Pages

**Domain:** Adding club/team pages to existing AI Football Predictions Platform
**Researched:** 2026-02-11
**Confidence:** HIGH (based on existing codebase patterns and known data model constraints)

## Critical Pitfalls

### Pitfall 1: Team Name as String Without Foreign Key

**What goes wrong:**
Teams exist as plain text fields (`homeTeam`/`awayTeam`) in the matches table with no `teams` table or foreign key. "Manchester City" might appear as "Man City", "Manchester City", or "Man. City" across different API-Football responses. Team pages query by exact string match, so `/teams/manchester-city` won't find matches stored as "Man City".

**Why it happens:**
API-Football provides team names as strings, and the platform stored them directly without normalization. This worked fine for match display but breaks when team names become URL identifiers.

**How to avoid:**
Create a `teams.ts` mapping file (similar to existing `competitions.ts`) with a canonical name, slug, and aliases. Use `getTeamByIdOrAlias()` to resolve slugs to the exact string stored in the database. Run a one-time audit: `SELECT DISTINCT homeTeam FROM matches ORDER BY homeTeam` to verify all team name variants.

**Warning signs:**
Team pages showing 0 matches. Different match counts when querying by homeTeam vs awayTeam for the same team.

**Phase to address:** Phase 1 (Foundation) - team mapping file must be created and validated before any UI work.

---

### Pitfall 2: N+1 Query Problem on Team Pages

**What goes wrong:**
Team page loads team stats, then for each recent match loads predictions, then for each prediction loads model details. With 20 recent matches and 42 models, this spirals to 800+ queries.

**Why it happens:**
Developers build features incrementally — first team info, then matches, then predictions — and each step adds queries without considering the aggregate.

**How to avoid:**
Design queries upfront to aggregate in SQL. Use `getTeamStats()` as a single aggregation query with CASE WHEN. For match history, batch-load prediction counts with `IN (matchIds)` instead of per-match queries. Max 3-4 DB queries per page load: team stats, recent matches, upcoming matches, leaderboard.

**Warning signs:**
Page load time >500ms. Redis cache miss causing >1s response. Database connection pool exhaustion under moderate traffic.

**Phase to address:** Phase 1 (Foundation) - query design must be batch-oriented from the start.

---

### Pitfall 3: Cache Invalidation Cascades

**What goes wrong:**
When a match finishes, `invalidateMatchCaches()` wipes all team caches with `db:team-*` pattern. With 200+ teams, this triggers a thundering herd of cache misses on the next request cycle, overloading the database.

**Why it happens:**
Pattern-based cache deletion is simple to implement but invalidates too broadly. The existing `db:leaderboard:*` pattern works because there are few leaderboard variants, but team caches multiply by team count.

**How to avoid:**
Invalidate only the two teams involved in the finished match: `db:team-stats:${homeTeamSlug}` and `db:team-stats:${awayTeamSlug}`. Keep pattern invalidation for `db:team-leaderboard:*` since leaderboard rankings change globally. Use stale-while-revalidate pattern where possible.

**Warning signs:**
Redis CPU spikes after match scoring. Database query latency increases after cache invalidation events.

**Phase to address:** Phase 1 (Foundation) - cache key design must support targeted invalidation.

---

### Pitfall 4: Sitemap Explosion with Thin Content

**What goes wrong:**
Generating sitemap entries for 200+ team pages where many teams have <5 matches creates thin content pages that hurt SEO. Google may interpret these as low-quality doorway pages and demote the entire site.

**Why it happens:**
Developers generate sitemaps from the full team list without filtering by content quality. Every team that appears in any match gets a page, even one-off cup opponents with a single match.

**How to avoid:**
Set minimum content thresholds: only include teams with 5+ finished matches in the sitemap. Add `noindex` meta tag to team pages below the threshold. Show a "limited data" message on thin pages rather than hiding them entirely.

**Warning signs:**
Google Search Console showing "Crawled - currently not indexed" for team pages. Low average page quality scores in GSC.

**Phase to address:** Phase 2 (Routes & SEO) - sitemap generation must filter by content threshold.

---

### Pitfall 5: ISR Revalidation Storms on Match Days

**What goes wrong:**
On a busy Premier League matchday with 10 simultaneous matches finishing, ISR revalidation triggers for all 20 involved team pages plus the teams index page simultaneously. This creates database load spikes.

**Why it happens:**
ISR `revalidate = 60` means pages regenerate on first request after 60s. Match days naturally concentrate revalidation requests.

**How to avoid:**
Use on-demand revalidation (`revalidatePath`) triggered by match completion webhook instead of time-based ISR. This gives precise control over when pages regenerate. Alternatively, stagger revalidation with slightly different TTLs per page.

**Warning signs:**
Database query latency spikes correlated with match completion times. 504 errors on team pages during peak times.

**Phase to address:** Phase 2 (Routes & SEO) - ISR strategy must account for match-day load patterns.

---

### Pitfall 6: URL Slug Collisions

**What goes wrong:**
Two teams in different leagues have the same slug: e.g., "Racing Club" (Argentina) and "Racing" (France) both slugify to `racing`. Or "United" could match multiple teams.

**Why it happens:**
Simple slugification (lowercase + hyphenate) doesn't account for name collisions across 17 leagues.

**How to avoid:**
Include league context in slug disambiguation: `/teams/racing-club-argentina` vs `/teams/racing-lens`. Or use unique identifiers from API-Football team IDs as part of the slug. Check for collisions during team mapping file generation.

**Warning signs:**
Multiple teams resolving to the same slug during team list generation.

**Phase to address:** Phase 1 (Foundation) - slug generation must detect and resolve collisions.

---

### Pitfall 7: AI Content Generation Rate Limits

**What goes wrong:**
Generating AI club analysis for 200+ teams hits Together AI rate limits, causing batch job failures and incomplete content. Cost per generation also adds up.

**Why it happens:**
Content generation is an afterthought — developers build the UI, then realize they need content for 200 pages and try to generate it all at once.

**How to avoid:**
Generate content lazily: only when a team page is first visited (ISR generates on first request). Use BullMQ with rate limiting (existing pattern). Prioritize high-traffic teams first. Cache generated content in database, not just Redis.

**Warning signs:**
Together AI 429 errors in logs. Content generation queue growing faster than it drains.

**Phase to address:** Phase 5 (Content Generation) - must use rate-limited queue, not batch generation.

---

### Pitfall 8: Stale Data for Inactive/Relegated Teams

**What goes wrong:**
Teams relegated from a tracked league or eliminated from a cup still have pages showing outdated stats. Users see "last match: 6 months ago" which makes the site look abandoned.

**Why it happens:**
Team pages are generated from historical match data. Once a team stops appearing in tracked competitions, their page becomes frozen.

**How to avoid:**
Show "last active: {date}" indicator on team pages. Sort team index by recent activity. Add "This team is not currently in a tracked competition" notice for inactive teams. Don't remove pages (breaks bookmarks/SEO) but clearly indicate staleness.

**Warning signs:**
Team pages with kickoffTime >3 months old showing as current.

**Phase to address:** Phase 3 (UI Components) - display logic must handle inactive teams gracefully.

---

### Pitfall 9: Query Performance Without Indexes

**What goes wrong:**
Team stats queries do full table scans on the matches table (potentially 10k+ rows) because there's no index on `homeTeam`/`awayTeam` columns. Works in dev with 100 matches, fails in production with 5000+.

**Why it happens:**
Text columns used for display aren't usually indexed. The matches table was designed for league/date queries, not team filtering.

**How to avoid:**
Add indexes before deploying team pages: `CREATE INDEX idx_matches_home_team ON matches(home_team)` and `CREATE INDEX idx_matches_away_team ON matches(away_team)`. Also consider a composite index for common query patterns.

**Warning signs:**
Team stats query >200ms. EXPLAIN ANALYZE showing sequential scans on matches table.

**Phase to address:** Phase 1 (Foundation) - indexes must be added as part of database preparation.

---

### Pitfall 10: Duplicate Content Across Team and Leaderboard Pages

**What goes wrong:**
`/teams/liverpool` and `/leaderboard/club/Liverpool` show nearly identical leaderboard data. Google may flag this as duplicate content, hurting SEO for both pages.

**Why it happens:**
The existing `/leaderboard/club/[id]` page already shows team-scoped model leaderboards. New team pages add another view of the same data.

**How to avoid:**
Differentiate the pages: `/teams/[slug]` is a comprehensive team hub (stats + matches + leaderboard), while `/leaderboard/club/[id]` is a focused leaderboard view. Add canonical URLs pointing to `/teams/[slug]` as the primary. Consider redirecting `/leaderboard/club/[id]` to `/teams/[slug]#leaderboard`.

**Warning signs:**
Google Search Console showing "Duplicate without user-selected canonical" for team/leaderboard URL pairs.

**Phase to address:** Phase 2 (Routes & SEO) - canonical strategy must be defined before launch.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding team list instead of querying DB | Fast initial build, no DB dependency for routing | Must update code when new teams appear (promotion/relegation) | Never — use DB query with caching instead |
| Skipping team name normalization | Faster development | Broken pages for teams with name variants | Never — must handle from day 1 |
| Using `db:team-*` pattern invalidation | Simple implementation | Cache thundering herd on match days | MVP only — switch to targeted invalidation |
| Generating all AI content at deploy time | Complete content on launch | Slow deploys, rate limit issues, stale content | Never — use lazy generation |
| Inline team stats queries in page components | Quick prototyping | No reuse, no caching, hard to test | Never — use query functions with cache layer |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unindexed team name columns | Slow page loads, timeout errors | Add DB indexes on homeTeam/awayTeam | >2000 matches in database |
| Loading all predictions for match history | Memory spikes, slow queries | Aggregate prediction counts in SQL, not JS | >50 matches per team |
| Team index page loading all team stats | 200+ DB queries on index page | Cache team list with summary stats as single query | >100 teams |
| SVG team logos not optimized | Large page weight, slow LCP | Use next/image with CDN, set width/height | >20 teams on index page |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing empty team pages for new/inactive teams | User thinks site is broken | Show "No data available yet" with link to league page |
| No loading states for leaderboard section | Content jumps, poor CLS score | Skeleton loader matching leaderboard height |
| Prediction counts without context | "15 models predict win" means nothing to new users | Add percentages: "15/42 models (36%) predict win" |
| Team page showing all-time stats by default | Overwhelming for first visit | Default to current season, offer all-time as filter |

## "Looks Done But Isn't" Checklist

- [ ] **Team mapping:** All 200+ teams from DB have entries in teams.ts — verify with `SELECT COUNT(DISTINCT homeTeam) FROM matches`
- [ ] **Slug collisions:** No two teams share the same slug — verify with uniqueness check on generated slugs
- [ ] **Canonical URLs:** Every team page has canonical pointing to itself, not to leaderboard page
- [ ] **OG images:** Every team page generates a valid OG image — verify with Facebook Sharing Debugger
- [ ] **Mobile layout:** Team stats cards don't overflow on 320px screens — verify with Chrome DevTools
- [ ] **Empty states:** Teams with 0 upcoming matches show appropriate message — verify with a recently relegated team
- [ ] **Cache invalidation:** Match completion invalidates correct team caches — verify by scoring a test match

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Team name mismatch | LOW | Update teams.ts aliases, re-query affected team stats |
| N+1 queries in production | MEDIUM | Rewrite queries to batch, add caching, deploy hotfix |
| SEO duplicate content penalty | HIGH | Add canonical tags, submit reconsideration request, wait 2-4 weeks |
| Cache thundering herd | LOW | Switch to targeted invalidation, deploy immediately |
| Missing DB indexes | LOW | Add indexes (online, no downtime), verify with EXPLAIN |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Team name string matching | Phase 1: Foundation | All teams resolve from slug to correct DB filter |
| N+1 queries | Phase 1: Foundation | Max 4 DB queries per team page load |
| Cache invalidation cascades | Phase 1: Foundation | Match scoring only invalidates 2 team caches |
| Sitemap thin content | Phase 2: Routes & SEO | Only teams with 5+ matches in sitemap |
| ISR revalidation storms | Phase 2: Routes & SEO | No DB spikes during match-day revalidation |
| URL slug collisions | Phase 1: Foundation | All slugs unique across all leagues |
| AI content rate limits | Phase 5: Content Gen | Queue processes at <10 requests/minute |
| Stale inactive teams | Phase 3: UI Components | Inactive teams show "last active" date |
| Missing DB indexes | Phase 1: Foundation | EXPLAIN ANALYZE shows index scans |
| Duplicate content | Phase 2: Routes & SEO | Canonical URLs set, leaderboard redirects |

---
*Pitfalls research for: Club/Team Pages on AI Football Predictions Platform*
*Researched: 2026-02-11*
*Confidence: HIGH — based on existing codebase data model and known constraints*
