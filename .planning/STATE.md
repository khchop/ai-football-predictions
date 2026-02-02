# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** v1.3 Match Page Refresh - Mobile-first match pages with consolidated content and AI search optimization

## Current Position

Phase: 16 (AI Search Optimization) - IN PROGRESS
Plan: 3 of 4 complete
Status: In progress
Last activity: 2026-02-02 - Completed 16-03-PLAN.md (Match Page Integration)

Progress: [██████████████░░░░░░░░░░] 60% (24/40 plans complete)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 17 plans
- Average duration: 2.8 min per plan
- Total execution time: 47.9 minutes

**Velocity (v1.1):**
- Total plans completed: 10 plans
- Phases: 5-8 (Stats Foundation, Data Migration, SEO Enhancement, UX Transparency)
- 79 commits, 218 files changed
- +36,895 / -8,161 lines

**Velocity (v1.2):**
- Total plans completed: 9 plans
- Phases: 9-12 (Critical SEO Errors, Page Structure, Redirect Optimization, Internal Linking)
- 22 commits, 34 files changed
- +4,147 / -42 lines

**Velocity (v1.3):**
- Total plans completed: 15 plans (Phase 13, Phase 14, Phase 15 complete, Phase 16 in progress)
- Phases: 13-16 (Content Pipeline, Mobile Layout, Performance, AI Search)
- Status: Phase 13 complete, Phase 14 complete, Phase 15 complete, Phase 16 plans 1-3 complete

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Full decision history available in phase SUMMARY.md files.

**Key v1.3 Decisions:**
- Content Pipeline fixes before Mobile Layout (can't optimize layout for broken content)
- Unified content query system (`getMatchContentUnified()`) to resolve dual-table writes
- ISR with conditional revalidation (60s scheduled, 30s live, 3600s finished) replacing force-dynamic
- Consolidated Schema.org JSON-LD @graph for AI search engines
- 4 phases derived from 18 requirements (comprehensive depth, natural clustering)

**Phase 13 Decisions:**
- 13-01: COALESCE prefers roundup narrative over short-form post-match content
- 13-01: Two-query fallback for roundup-only matches (edge case support)
- 13-02: ReadMoreText: Dynamic line-clamp class via previewLines prop for flexibility
- 13-02: ReadMoreText: 600 char threshold for truncation (approx 150-200 words)
- 13-02: ReadMoreText: focus-visible ring instead of focus for better keyboard UX
- 13-03: Nullable matchStatus defaults to 'scheduled' behavior for graceful degradation

**Phase 14 Decisions:**
- 14-01: position:sticky instead of position:fixed for header (avoids CLS penalties)
- 14-01: 44px minimum touch targets for WCAG 2.5.5 AAA compliance
- 14-01: Separate mobile/desktop render paths (sticky vs full header)
- 14-02: Controlled Radix Tabs with external state for swipe gesture integration
- 14-02: Progressive disclosure for H2H stats on mobile only (desktop always visible)
- 14-02: Four separate tab content components for clear separation of concerns
- 14-03: Inline data mapping at page layer keeps tab components generic and reusable
- 14-03: Transform matchEvents from API-Football format at page level for API-agnostic tabs
- 14-03: Parse roundup JSON in server component for clean tab interfaces
- 14-04: Human verification checkpoint validates mobile UX beyond automated tests

**Phase 15 Decisions:**
- 15-01: revalidate=60 for all match statuses (Next.js doesn't support conditional static exports)
- 15-02: Two-stage parallel fetch (critical path + Promise.all) for match page data
- 15-02: Individual .catch() per promise for graceful degradation
- 15-03: 70% threshold for 'healthy' cache status (Phase 15 success criteria)
- 15-03: force-dynamic for monitoring endpoints (always fresh stats)

**Phase 16 Decisions:**
- 16-01: Group AI crawlers by company in robots.ts (maintainability)
- 16-01: Descriptive text in llms.txt markdown links (AI parser compatibility)
- 16-02: @id URL fragment pattern for entity cross-references (url#webpage, url#organization)
- 16-02: Single @graph consolidation eliminates multiple JSON-LD validation warnings
- 16-02: kroam.xyz as canonical domain for Organization/WebSite entities
- 16-03: Remove SportsEventSchema + WebPageSchema in favor of single MatchPageSchema
- 16-03: SSR content via async server components verified (MatchContentSection, RoundupViewer)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed 16-03-PLAN.md (Match Page Integration)
Resume with: Continue to 16-04-PLAN.md (Documentation & Cleanup)
