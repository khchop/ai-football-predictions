# Project Milestones: AI Football Predictions Platform

## v2.1 Match Page Simplification (Shipped: 2026-02-03)

**Delivered:** Simplified match page layout with natural scrolling (no sticky header), unified single-column design (no mobile tabs), removed H2H/standings sections, and clean HTML stripping for narrative content.

**Phases completed:** 24-25 (3 plans total)

**Key accomplishments:**

- Unified single-column layout — all devices scroll naturally without sticky header or mobile tabs
- Removed H2H and league standings sections — cleaner interface, fewer API calls
- Empty section hiding — components return null when no data (no "unavailable" placeholders)
- HTML stripping utility with isomorphic-dompurify for SSR-compatible content sanitization
- Clean narrative rendering — pre-match, betting, and post-match display without raw HTML tags
- Performance improvement — removed standings API call from match page data fetching

**Stats:**

- 98,659 lines of TypeScript (+2,391 from v2.0)
- 2 phases, 3 plans, 9 requirements
- 21 files changed, +2,691 / -300 lines
- 1 day from start to ship (2026-02-03)

**Git range:** `feat(24-01)` → `docs(25)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.0 UI/UX Overhaul (Shipped: 2026-02-03)

**Delivered:** Complete UI/UX rebuild with new design system, dark mode, View Transitions, PPR streaming, FAQ schemas for GEO optimization, and systematic internal linking across all page types.

**Phases completed:** 17-23 (28 plans total)

**Key accomplishments:**

- Design system foundation with OKLCH semantic color tokens, 1.2 type scale, 4px/8px spacing rhythm
- Dark mode with next-themes (system preference default, manual toggle)
- View Transitions API for smooth page navigation (150ms duration)
- Match page rebuild with score deduplication, TL;DR summaries, narrative previews, FAQ schema
- Blog page rebuild with 70ch line width, TOC with IntersectionObserver scroll spy, FAQ extraction
- League page rebuild with enhanced SportsOrganization schema, CSS-only trend charts, dynamic FAQs
- Leaderboard time period filters (weekly/monthly/all-time) with rank trend indicators
- Bottom navigation bar for mobile with 44px touch targets
- Breadcrumbs on all 5 page types with builder utilities
- EntityLinkedText for inline team/model/competition links
- HoverPrefetchLink for intent-based prefetching on hover/touch
- PPR enabled via cacheComponents with Suspense boundaries
- 3 client components converted to server components

**Stats:**

- 46,402 lines of TypeScript
- 7 phases, 28 plans, 33 requirements
- 1 day from start to ship (2026-02-02 → 2026-02-03)

**Git range:** `feat(17-01)` → `docs(23-03)`

**Tech debt deferred:**

- ThemeToggle not integrated into Navigation (2 min fix)
- MatchBadge/AccuracyBadge components orphaned (0 imports)
- 50+ hardcoded colors could use semantic tokens

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.3 Match Page Refresh (Shipped: 2026-02-02)

**Delivered:** Mobile-first match pages with unified content query, tabbed navigation with swipe gestures, ISR caching, and AI search optimization (robots.txt, llms.txt, consolidated Schema.org @graph).

**Phases completed:** 13-16 (13 plans total)

**Key accomplishments:**

- Unified content query (`getMatchContentUnified`) merging dual-table content with COALESCE prioritization
- Mobile tabbed navigation (Summary/Stats/Predictions/Analysis) with react-swipeable swipe gestures
- Sticky header with de-duplicated score display (position:sticky avoids CLS)
- 44px touch targets meeting WCAG 2.5.5 AAA accessibility standards
- ISR caching enabled with 60-second revalidation (removed force-dynamic)
- Parallel data fetching with two-stage Promise.all pattern
- Consolidated Schema.org JSON-LD @graph with 5 entities for AI search engines
- AI crawler configuration (GPTBot, ClaudeBot, PerplexityBot) and llms.txt structured paths

**Stats:**

- 82,942 lines of TypeScript (+2,608 from v1.2)
- 4 phases, 13 plans, 18 requirements
- 48 commits, 58 files changed
- +9,124 / -382 lines (net +8,742)
- 13 days from start to ship

**Git range:** `feat(13-01)` → `docs(16)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.2 Technical SEO Fixes (Shipped: 2026-02-02)

**Delivered:** Fixed ~1,083 SEO issues from Ahrefs audit including 500 errors, 404s in sitemap, redirect chains, missing H1 tags, long titles, and orphan pages with new internal linking widgets.

**Phases completed:** 9-12 (9 plans total)

**Key accomplishments:**

- Competition alias system with 308 redirects enabling both short IDs and long-form slugs
- Edge-level redirects in next.config.ts for faster redirect resolution
- Defensive error handling on match pages (404 instead of 500)
- MatchH1 component with sr-only class for SEO without visual changes
- Abbreviation utilities for team/competition names keeping titles under 60 chars
- permanentRedirect() for all SEO-critical redirects (308 status)
- RelatedMatchesWidget showing related matches from same competition/teams
- RelatedModelsWidget showing top performers on model pages
- RecentPredictionsWidget on competition hub pages

**Stats:**

- 40,129 lines of TypeScript
- 4 phases, 9 plans
- 22 commits, 34 files changed
- +4,147 / -42 lines
- 1 day from start to ship

**Git range:** `feat(09-01)` → `docs(12)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.1 Stats Accuracy & SEO (Shipped: 2026-02-02)

**Delivered:** Fixed critical 48% accuracy inflation bug, added SEO structured data for Google Rich Results, and improved UX transparency with visible denominators and methodology tooltips.

**Phases completed:** 5-8 (10 plans total)

**Key accomplishments:**

- Canonical stats service with `tendencyPoints > 0` formula fixing 48% accuracy bug
- Migration snapshot with verification report for audit trail and rollback capability
- Schema.org structured data (SportsEvent, Article, BreadcrumbList) for Rich Results
- Methodology page explaining accuracy calculation formula
- AccuracyDisplay component showing "X/Y (Z%)" format with tooltips
- OG image accuracy badges for social sharing visibility

**Stats:**

- 80,334 lines of TypeScript (+41,864 from v1.0)
- 4 phases, 10 plans
- 79 commits, 218 files changed
- +36,895 / -8,161 lines (net +28,734)
- 1 day from start to ship

**Git range:** `feat(05-01)` → `docs(08)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.0 Bug Fix Stabilization (Shipped: 2026-02-01)

**Delivered:** Production stability for prediction pipeline with 18 critical bug fixes across database, queue workers, scoring, caching, and frontend.

**Phases completed:** 1-4 (14 plans total)

**Key accomplishments:**

- Database pool sized to 20 connections with health monitoring and alerting
- Multi-strategy JSON extraction (4 fallbacks) for robust LLM response parsing
- Error-type-aware model recovery with 7 error classifications and 1h cooldown
- Transaction-safe settlement with FOR UPDATE row locking prevents race conditions
- Kicktipp-accurate quota calculation (2-6 points based on prediction rarity)
- Streaming SSR with React Suspense for sub-500ms TTFB on match pages
- API budget enforcement (100/day) with Redis graceful degradation
- Mobile-responsive prediction cards and auto-refresh leaderboards
- Error boundaries catch all React rendering failures

**Stats:**

- 38,470 lines of TypeScript
- 4 phases, 14 plans
- 47.9 minutes total execution time
- 1 day from start to ship

**Git range:** `feat(01-00)` → `feat(04-03)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

*Last updated: 2026-02-03 after v2.1 milestone*
