# Project Research Summary: Club/Team Pages

**Project:** v3.0 Club/Team Pages Milestone
**Domain:** AI Football Predictions Platform - Team Detail Pages
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

Club/team pages are a standard feature for sports prediction platforms, providing team-scoped views of AI model performance, match history, and statistics. Industry leaders like WhoScored and FBref establish user expectations: team info, recent results, upcoming fixtures, and comprehensive stats. The differentiator for kroam.xyz is team-specific AI model leaderboards — "which models are most accurate at predicting Liverpool?" — a unique value proposition not found on competitor sites.

The recommended approach leverages the existing validated stack with zero new dependencies. All capabilities exist: Next.js dynamic routes (proven in `/leagues/[slug]`), Drizzle ORM aggregations (proven in `/leaderboard/club/[id]`), Redis caching with pattern invalidation, Together AI for content generation, and Schema.org structured data. The existing `/leaderboard/club/[id]` page already implements the core query pattern needed — filtering predictions by team name — validating the technical approach. Implementation complexity is LOW to MEDIUM: new routes, new query functions, new schema markup, all using established patterns.

The critical risk is team name normalization. Teams exist as text fields (`homeTeam`/`awayTeam`) without a foreign key, and API-Football returns variants like "Man City" vs "Manchester City". This requires a team mapping layer (similar to `competitions.ts`) to resolve slugs to database strings. Secondary risks include N+1 queries (mitigated with batch aggregations), cache invalidation cascades (mitigated with targeted invalidation per team), and SEO duplicate content with existing `/leaderboard/club/[id]` pages (mitigated with canonical URLs). All risks are manageable with proper Phase 1 foundation work.

## Key Findings

### Recommended Stack

**Zero new dependencies required.** The existing stack handles all team page requirements. Next.js 16.1.4 App Router supports dynamic routes (`/teams/[slug]`) with proven ISR patterns (60s revalidation). Drizzle ORM handles team-scoped aggregations using the same CASE WHEN and GROUP BY patterns from leaderboard queries. PostgreSQL stores teams as text in matches table — no schema changes needed. Schema-dts provides `SportsTeam` types already imported elsewhere. Together AI generates club analysis using existing prompt patterns. All integration points validated in production at kroam.xyz.

**Core technologies (already validated):**
- **Next.js 16.1.4**: Dynamic routes, ISR, Server Components — pattern proven in `/leagues/[slug]` and `/leaderboard/club/[id]`
- **Drizzle ORM 0.45.1**: Team filtering with `or(eq(homeTeam, name), eq(awayTeam, name))` — pattern exists in club leaderboard queries
- **PostgreSQL (pg 8.17.2)**: Teams stored as text in matches.homeTeam/awayTeam — no new tables, no migrations
- **schema-dts 1.1.5**: SportsTeam type available — extend existing Schema.org patterns
- **Together AI (Gemini 3 Flash)**: AI-generated club analysis — reuse existing content generation infrastructure
- **Redis caching**: Team stats caching with 60s TTL — add new cache keys, extend invalidation logic

**What NOT to add:**
- Separate teams table (unnecessary normalization, migration complexity for marginal benefit)
- GraphQL layer (overkill for simple data fetching, Server Components sufficient)
- CMS for club content (LLM generation + ISR simpler and more flexible)
- Dedicated analytics library (Recharts + existing aggregations sufficient)

### Expected Features

Research identified 10 P1 table-stakes features, 7 P2 differentiators, and 5 P3 future features. Users expect basic team information, match history, and statistics as standard. The competitive advantage comes from AI-specific features: per-club model leaderboards, AI-generated insights, and model accuracy trends.

**Must have (P1 - table stakes, 10 features):**
- Club basic information (name, logo, league) — users expect this on all sports team pages
- Upcoming match predictions — primary user need when visiting team page
- Recent match results (last 10) — context for current form
- Per-club model leaderboard (all-time) — core differentiator, "which models predict this team best?"
- Time filters (all-time, season, monthly, weekly) — consistency with global leaderboard UX
- Navigation from league pages — discoverability from league standings/fixtures
- Navigation from match pages — discoverability from team names in match details
- Breadcrumb navigation — UX standard for deep pages
- SportsTeam schema.org markup — SEO foundation for Google discovery
- /teams index page — required for sitemap, user browsing

**Should have (P2 - competitive advantage, 7 features):**
- AI-generated club analysis — unique insights: "What patterns do AI models see in this club's play?"
- Club-specific FAQ generation — dynamic FAQs leveraging existing infrastructure
- Model accuracy trends for club — "Has Llama 3.1 gotten better at predicting Arsenal lately?"
- Club statistics dashboard (W/D/L, goals, form) — expected based on WhoScored/FBref patterns
- Recent form visualization — visual timeline of last 5-10 matches
- Head-to-head model comparison — filter to 2-3 models, side-by-side for this club
- Model recommendation for upcoming matches — "Use Claude 3.5 for Liverpool's next match"

**Defer (P3 - v2+, 5 features):**
- Best/worst matchups for models — complex analytics requiring significant data
- Interactive prediction accuracy heatmap — high complexity D3.js visualization
- /teams index filtering/search — v1 launches with simple list, add when count grows
- Club comparison tool — niche use case, validate demand first
- Historical data beyond 2 seasons — database bloat for minimal value

**Anti-features to avoid:**
- Real-time live match updates (not our differentiator, API delays, cost)
- Player-level statistics (massive scope creep, off-brand)
- User comments/predictions (moderation burden, spam risk)
- Betting odds integration (regulatory complexity, not our expertise)
- Social login/user accounts (auth complexity, GDPR, not needed v1)

### Architecture Approach

Low-to-medium complexity integration using established patterns. The platform already implements team-scoped queries in `/leaderboard/club/[id]` — filtering matches by `clubId`, aggregating model performance. Team pages extend this with team-scoped stats (W/D/L record, goals), match history queries, and comprehensive leaderboard display. Zero schema changes required since teams are stored as text in existing matches table.

**Major components:**

1. **Team mapping layer** (`src/lib/football/teams.ts`) — Resolve URL slugs to database team names, handle aliases ("Man City" vs "Manchester City"), similar to existing `competitions.ts` pattern

2. **Team stats aggregation** (`src/lib/db/queries/team-stats.ts`) — Single SQL query with CASE WHEN to calculate W/D/L, goals scored/conceded, avg per match, home/away splits, using Drizzle ORM patterns from existing leaderboard queries

3. **Team match history** (`src/lib/db/queries/team-stats.ts`) — Query matches filtered by team name with prediction distribution, batch-load prediction counts to avoid N+1, max 3-4 DB queries per page

4. **Caching strategy** — New cache keys (`db:team-stats:*`, `db:team-leaderboard:*`, `db:team-matches:*`) with 60s TTL, targeted invalidation per team on match completion, extend existing `invalidateMatchCaches()`

5. **Schema.org SportsTeam markup** (`src/lib/seo/schema/sports-team.ts`) — JSON-LD with team name, logo, description, URL, follows existing schema patterns from league/match pages

**Integration points:**
- Routes: `/teams/[slug]/page.tsx` following `/leagues/[slug]` pattern
- Queries: Reuse `getLeaderboard()` with `filters.clubId`, add `getTeamStats()` and `getTeamMatches()`
- Components: Reuse LeaderboardTable, add TeamStatsCard and TeamMatchesTable
- Linking: Convert team names to links in league/match pages, add teams to sitemap
- Content: LLM-generated club analysis using existing prompt patterns

### Critical Pitfalls

Research identified 10 critical pitfalls. The top 3 must be addressed in Phase 1 (Foundation) before any UI work.

1. **Team name string matching without foreign key** — Teams stored as text ("Man City" vs "Manchester City" variants). Avoidance: Create `teams.ts` mapping with canonical names and aliases, audit with `SELECT DISTINCT homeTeam` to verify all variants. Address in Phase 1.

2. **N+1 query problem** — Team page loading stats, then per-match predictions, then per-prediction models (800+ queries). Avoidance: Design batch aggregations upfront, max 3-4 DB queries per page, use `IN (matchIds)` for prediction counts. Address in Phase 1.

3. **Cache invalidation cascades** — Match completion wiping all `db:team-*` caches (200+ teams) causing thundering herd. Avoidance: Targeted invalidation per team (`db:team-stats:${homeTeamSlug}`, `db:team-stats:${awayTeamSlug}`), not pattern-based. Address in Phase 1.

4. **Sitemap explosion with thin content** — 200+ team pages where many have <5 matches, flagged as low-quality. Avoidance: Filter sitemap to teams with 5+ finished matches, add `noindex` below threshold. Address in Phase 2.

5. **SEO duplicate content** — `/teams/liverpool` and `/leaderboard/club/Liverpool` showing similar leaderboard data. Avoidance: Differentiate pages (team hub vs focused leaderboard), set canonical URLs pointing to `/teams/[slug]`, consider redirecting leaderboard URLs. Address in Phase 2.

**Other notable pitfalls:**
- URL slug collisions (multiple teams named "Racing" or "United" across leagues)
- AI content generation rate limits (200+ teams hitting Together AI limits)
- Query performance without indexes (need `idx_matches_home_team` and `idx_matches_away_team`)
- ISR revalidation storms on match days (10 simultaneous matches finishing)
- Stale data for relegated/inactive teams (showing "last match: 6 months ago")

## Implications for Roadmap

Based on combined research, team pages should be built in 5 phases starting at Phase 67 (continuing from v2.9's Phase 66). Phase structure prioritizes foundation (data layer, normalization, caching) before UI to avoid pitfalls, then adds features incrementally based on table-stakes → differentiators → content generation progression.

### Phase 67: Foundation & Data Layer
**Rationale:** Team name normalization, query design, and caching strategy are critical risks that must be solved before any UI work. This phase establishes the foundation without touching existing pages.

**Delivers:**
- Team mapping file (`teams.ts`) with canonical names, slugs, aliases for all 200+ teams
- Team query functions (`getTeamStats`, `getTeamMatches`) with batch aggregations
- Cache key design with targeted invalidation
- Database indexes on `homeTeam`/`awayTeam` columns

**Addresses (from FEATURES.md):**
- Underlying data access for all P1 features
- Team name resolution for URL routing

**Avoids (from PITFALLS.md):**
- Pitfall #1: Team name string matching (mapping layer solves this)
- Pitfall #2: N+1 queries (batch aggregations from start)
- Pitfall #3: Cache cascades (targeted invalidation design)
- Pitfall #6: URL slug collisions (detection during generation)
- Pitfall #9: Missing indexes (added before deployment)

**Research flags:** LOW — patterns proven in existing `/leaderboard/club/[id]` implementation. No new research needed.

---

### Phase 68: Routes, SEO & Basic Pages
**Rationale:** With data layer proven, create accessible team pages with proper SEO. Focus on metadata, structured data, and sitemap before rich UI.

**Delivers:**
- Team detail page (`/teams/[slug]/page.tsx`) with metadata generation
- Team index page (`/teams/page.tsx`) listing all teams
- SportsTeam schema.org markup with breadcrumbs
- Sitemap integration (filtered to teams with 5+ matches)
- Canonical URL strategy vs existing leaderboard pages

**Uses (from STACK.md):**
- Next.js dynamic routes (proven `/leagues/[slug]` pattern)
- schema-dts SportsTeam types
- ISR with 60s revalidation

**Implements (from ARCHITECTURE.md):**
- Component 4: Team name normalization (route → DB mapping)
- Component 5: Schema.org SportsTeam markup
- Sitemap integration with content threshold filtering

**Avoids (from PITFALLS.md):**
- Pitfall #4: Sitemap thin content (5+ match threshold)
- Pitfall #10: Duplicate content SEO (canonical URLs)

**Research flags:** LOW — Schema.org SportsTeam documented, Next.js metadata patterns established. Standard implementation.

---

### Phase 69: UI Components & Leaderboard
**Rationale:** Add visual components for team stats and per-club model leaderboard (core P1 features). Reuse existing LeaderboardTable component.

**Delivers:**
- TeamStatsCard component (W/D/L, goals, home/away splits)
- TeamMatchesTable component (recent/upcoming with prediction distribution)
- Per-club model leaderboard (reusing `getLeaderboard()` with `filters.clubId`)
- Time filters (all-time, season, monthly, weekly) consistent with global leaderboard

**Addresses (from FEATURES.md):**
- P1: Club basic information display
- P1: Per-club model leaderboard (core differentiator)
- P1: Time filters
- P1: Recent match results (last 10)
- P1: Upcoming match predictions
- P1: Breadcrumb navigation

**Implements (from ARCHITECTURE.md):**
- Component 1: Team stats aggregation (display layer)
- Component 2: Team match history (UI)
- Component 3: Team model leaderboard (reuse existing)

**Avoids (from PITFALLS.md):**
- Pitfall #8: Stale inactive teams (display "last active" indicator)
- UX pitfall: Empty states for new teams (appropriate messaging)
- UX pitfall: Loading states (skeleton loaders for CLS)

**Research flags:** LOW — Component patterns reused from leagues/models pages. No new research needed.

---

### Phase 70: Cross-Linking & Navigation
**Rationale:** Reduce orphan pages, improve SEO internal linking. Add team links to league/match pages to drive discovery.

**Delivers:**
- Team links in league pages ("Teams in Premier League" section)
- Team badge links in match detail pages
- Updated breadcrumbs: Home > Leagues > {League} > {Team} > {Match}
- "Related Teams" widget for homepage/league hubs

**Addresses (from FEATURES.md):**
- P1: Navigation from league pages
- P1: Navigation from match pages

**Implements (from ARCHITECTURE.md):**
- Integration point 6A: Linking from league pages
- Integration point 6B: Linking from match pages
- Integration point 6C: Team index page navigation

**Avoids (from PITFALLS.md):**
- SEO orphan pages (internal links establish team page authority)
- Discovery issues (users can reach team pages from multiple entry points)

**Research flags:** LOW — Standard cross-linking, no complex patterns. Skip research.

---

### Phase 71: AI Content & FAQ Generation
**Rationale:** Add unique AI-generated club analysis and FAQs (P2 differentiators). Deferred to final phase to validate core features first and avoid rate limit issues during launch.

**Delivers:**
- AI-generated club analysis using Together AI
- Club-specific FAQ generation (extending existing infrastructure)
- Content caching in database (not just Redis)
- Rate-limited queue (BullMQ) for lazy generation on first page visit

**Addresses (from FEATURES.md):**
- P2: AI-generated club analysis (unique differentiator)
- P2: Club-specific FAQ generation

**Uses (from STACK.md):**
- Together AI (Gemini 3 Flash) with existing prompt patterns
- FAQ generation infrastructure (proven in match pages)
- BullMQ for rate-limited content generation

**Implements (from ARCHITECTURE.md):**
- Content generation pattern from `content/generator.ts`
- FAQ pattern from `generate-league-faqs.ts`

**Avoids (from PITFALLS.md):**
- Pitfall #7: AI rate limits (lazy generation, queue-based)
- Cost control (generate on-demand, cache indefinitely)

**Research flags:** LOW — LLM content generation patterns proven. Prompts need refinement but no architectural research.

---

### Phase Ordering Rationale

**Foundation-first approach:** Phase 67 solves the three critical pitfalls (team name normalization, N+1 queries, cache cascades) before any UI work. This prevents rework and ensures all later phases build on solid data access patterns.

**SEO before features:** Phase 68 establishes discoverability (sitemap, schema.org, metadata) before Phase 69 adds rich UI. This allows early indexing while features are being built.

**Core features before AI content:** Phases 67-69 deliver all P1 table-stakes features (team info, leaderboard, stats, matches). Phase 71 adds P2 differentiators (AI analysis, FAQs) after validating core product-market fit.

**Cross-linking as bridge:** Phase 70 connects team pages to existing site structure between core features (Phase 69) and content generation (Phase 71). This drives traffic to validate engagement before investing in AI content.

**Dependency ordering:**
- Phase 67 → 68: Routes depend on team mapping and query functions
- Phase 68 → 69: UI components depend on routes and SEO being live
- Phase 69 → 70: Cross-linking depends on team pages being complete
- Phase 70 → 71: AI content depends on traffic validation from linked pages

### Research Flags

**Phases needing deeper research during planning:**
- None — all patterns proven in existing codebase or well-documented in official sources

**Phases with standard patterns (skip `/gsd:research-phase`):**
- **Phase 67:** Query patterns proven in `/leaderboard/club/[id]`, Drizzle ORM aggregations documented
- **Phase 68:** Next.js dynamic routes established, Schema.org SportsTeam documented
- **Phase 69:** Component patterns reused from existing pages
- **Phase 70:** Standard cross-linking, no complex integration
- **Phase 71:** LLM prompt engineering, not architectural research

**Validation points for each phase:**
- **Phase 67:** Run queries in Node REPL, verify cache keys, test invalidation
- **Phase 68:** Check Rich Results Test, validate sitemap XML, verify canonical URLs
- **Phase 69:** Test responsive layout, verify data accuracy, check Core Web Vitals
- **Phase 70:** Crawl with Screaming Frog, verify inlinks, check anchor text
- **Phase 71:** Monitor Together AI rate limits, verify content quality, check LLM costs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All capabilities exist in validated stack. Zero new dependencies. Patterns proven in production at kroam.xyz. |
| Features | **MEDIUM** | P1 features validated via competitor analysis (WhoScored, FBref). P2 differentiators based on existing AI infrastructure. User expectations from industry patterns. |
| Architecture | **HIGH** | Integration patterns proven in existing `/leaderboard/club/[id]` implementation. Query patterns validated. Caching strategy extends existing Redis patterns. |
| Pitfalls | **HIGH** | Based on actual data model constraints (teams as text). Risks identified from existing codebase analysis. Mitigation strategies reference proven patterns. |

**Overall confidence:** **HIGH**

Research is comprehensive and actionable. Stack validated in production, architecture patterns proven in existing code, pitfalls identified from actual schema constraints. The existing `/leaderboard/club/[id]` page serves as a working reference implementation, de-risking the approach.

### Gaps to Address

**Team name variant discovery:** The research assumes team name variants can be mapped manually. During Phase 67, run `SELECT DISTINCT homeTeam FROM matches UNION SELECT DISTINCT awayTeam` and verify all 200+ teams have predictable slugs. If API-Football introduces unexpected variants (e.g., special characters, non-ASCII), the mapping layer may need extension.

**Canonical URL strategy decision:** Research identifies duplicate content risk with `/leaderboard/club/[id]` but doesn't prescribe a specific solution. During Phase 68 planning, decide whether to:
- Set canonical from leaderboard → team pages (preferred)
- Redirect leaderboard URLs to team pages (breaks existing links)
- Differentiate content enough to avoid duplicate flags (risky)

**Content generation cost estimation:** Phase 71 adds AI-generated content for 200+ teams. Research notes rate limiting but doesn't estimate total cost. During Phase 71 planning, calculate: 200 teams × (1 analysis + 1 FAQ) × 2 generations = 800 LLM calls × $X per call. May need budget approval.

**Inactive team handling:** Research notes teams may become inactive (relegated, eliminated) but doesn't define "inactive" threshold. During Phase 69 planning, define: show "inactive" notice after X days without a match? X = 90 days? 180 days? Season boundary?

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** `src/app/leaderboard/club/[id]/page.tsx` — proven reference implementation for team-scoped queries
- **Existing codebase:** `src/lib/db/queries/stats.ts` — Drizzle ORM aggregation patterns
- **Existing codebase:** `src/lib/football/competitions.ts` — mapping file pattern for normalization
- **Schema.org official docs:** [SportsTeam type](https://schema.org/SportsTeam) — structured data specification
- **Next.js documentation:** [Dynamic Routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) — App Router patterns
- **Drizzle ORM documentation:** [Select queries](https://orm.drizzle.team/docs/select), [SQL operator](https://orm.drizzle.team/docs/sql) — aggregation syntax

### Secondary (MEDIUM confidence)
- **Competitor analysis:** WhoScored, FBref, SofaScore — team page feature expectations (WebFetch blocked some access, inferred patterns from search results)
- **Industry research:** "Best AI Sports Prediction Tools 2026" — 75-85% accuracy benchmarks for AI predictions
- **Industry research:** FootInsights verified 73% accuracy — validates AI prediction as valuable feature
- **UX patterns:** "19 Best Sports Website Designs 2026" — navigation patterns, mega menus, team color branding
- **SEO research:** "Schema Markup in 2026" — pages with schema rank 4 positions higher on average

### Tertiary (LOW confidence)
- **Market research:** "13 Best Free Football Data Websites" — feature comparison across stats sites (search results only, not hands-on validation)
- **SEO research:** "6 Ways to Ensure Live Sport Scores Get Indexed Real-Time" — dynamic rendering for sports content (not directly applicable, team pages use ISR not real-time)

---
*Research completed: 2026-02-11*
*Ready for roadmap: yes*
*Phase numbering: starts at Phase 67 (continuing from v2.9 Phase 66)*
