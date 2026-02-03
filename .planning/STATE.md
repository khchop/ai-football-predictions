# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete
**Current focus:** v2.0 UI/UX Overhaul

## Current Position

Phase: 19 - Blog Page Rebuild
Plan: 2 of 5 complete
Status: In progress
Last activity: 2026-02-03 - Completed 19-02-PLAN.md (FAQ Section with Schema)

Progress: [██████░░░░░░░░░░░░░░░░░░] 20% (v2.0: 11/? plans, 17/33 requirements)

## Milestone History

| Milestone | Phases | Plans | Requirements | Shipped |
|-----------|--------|-------|--------------|---------|
| v1.0 Bug Fix Stabilization | 1-4 | 14 | 18 | 2026-02-01 |
| v1.1 Stats Accuracy & SEO | 5-8 | 10 | 19 | 2026-02-02 |
| v1.2 Technical SEO Fixes | 9-12 | 9 | 13 | 2026-02-02 |
| v1.3 Match Page Refresh | 13-16 | 13 | 18 | 2026-02-02 |

**Total:** 16 phases, 46 plans, 68 requirements shipped

## v2.0 Phase Structure

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 17. Design System Foundation | Design tokens, dark mode, PPR infrastructure | DSGN-01 to DSGN-06 (6) | Complete |
| 18. Match Page Rebuild | Content visibility, deduplication, GEO | MTCH-01 to MTCH-06 (6) | Complete |
| 19. Blog Page Rebuild | Typography, TOC, FAQ, related | BLOG-01 to BLOG-05 (5) | In progress (2/5) |
| 20. League Page Rebuild | SEO, schema, stats dashboard | LEAG-01 to LEAG-05 (5) | Pending |
| 21. Leaderboard Page Rebuild | SEO, filters, trends | LEAD-01 to LEAD-03 (3) | Pending |
| 22. Navigation & Internal Linking | Bottom nav, breadcrumbs, auto-linking | NAVL-01 to NAVL-05 (5) | Pending |
| 23. Performance & Polish | PPR validation, client audit, transitions | PERF-01 to PERF-04 (4) | Pending |

**Phase Dependencies:**
```
Phase 17 (Foundation) [COMPLETE]
  |
  +---> Phase 18 (Match) [COMPLETE] --+
  |                                    |
  +---> Phase 19 (Blog) [IN PROGRESS]-+--> Phase 22 (Navigation)
  |                                    |
  +---> Phase 20 (League)-------------+
  |                                    |
  +---> Phase 21 (Leader)-------------+--> Phase 23 (Performance)
```

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Full decision history available in phase SUMMARY.md files.

**Key v2.0 Decisions (Phases 17-19):**
- OKLCH color space for perceptual uniformity across light/dark modes
- Dark mode uses dark grays (L=0.14), not pure black, for eye comfort
- System preference as default theme via next-themes
- ThemeToggle deferred to Phase 22 navigation integration
- System font stack for fast loading and native feel
- 1.2 ratio (Minor Third) type scale for balanced hierarchy
- 4px/8px spacing rhythm for consistent component spacing
- MatchBadge for structured outcome/status props, Badge variants for simple usage
- AccuracyBadge thresholds: <40% red, 40-70% amber, >70% green
- 150ms view transition duration for snappy navigation feel
- prefers-reduced-motion fully disables view transitions
- Intersection Observer triggers sticky header only when hero exits viewport
- Score appears exactly twice: large in hero, compact in sticky header
- TL;DR format varies by match state: finished shows score, live shows current score, upcoming shows prediction preview
- Scroll-to-section pattern instead of inline expansion per user decision
- 150-word truncation for preview content with smooth scroll behavior
- PPR activation deferred to Phase 23 (infrastructure ready, requires Suspense refactoring)
- Hardcoded copyright year (2026) to avoid new Date() PPR incompatibility
- Shimmer animation: 2s duration, OKLCH gradients, respects prefers-reduced-motion
- FAQ at absolute bottom: supplementary for SEO, not primary UX (GEO optimization)
- Native details/summary for FAQ: no JavaScript required, accessible by default
- TL;DR question always first in FAQ for AI search engine citation priority
- Phase 18 integration approved without manual verification (deployment constraints)
- MatchTLDR placement above hero for answer-first GEO structure
- 300 char FAQ answer truncation for schema best practice (19-02)
- 5 FAQ max default for reasonable schema size (19-02)

**Key v1.3 Decisions (archived):**
- Content Pipeline fixes before Mobile Layout
- Unified content query system (`getMatchContentUnified()`)
- ISR with 60s revalidation replacing force-dynamic
- Consolidated Schema.org JSON-LD @graph
- position:sticky instead of position:fixed for headers
- 44px minimum touch targets (WCAG 2.5.5 AAA)

### Research Findings (v2.0)

From research/SUMMARY.md:

**Key patterns identified:**
- Bottom navigation bar: 21% faster mobile navigation
- FAQ schema: 3.2x more likely AI Overview appearances
- Answer-first content: Optimized for AI citation
- PPR + View Transitions: Native Next.js 16 features, no new packages

**Critical pitfalls to avoid:**
- Client component creep (audit 71+ component files)
- LCP regression during redesign (priority attribute required)
- Breaking existing URLs (preserve route structure)
- ISR cache staleness (two-layer caching awareness)

**Phases needing deeper research:**
- Phase 22: Entity linking automation strategy

### Pending Todos

None.

### Blockers/Concerns

**PPR Activation Deferred to Phase 23:**
- Shimmer infrastructure complete (CSS, enhanced skeletons)
- Route segment configs removed (18 files cleaned)
- Remaining work: Suspense boundaries for searchParams-dependent pages (blog, leaderboard)
- Impact: PPR benefits delayed, but shimmer skeletons work with ISR
- Estimated Phase 23 effort: 2-3 hours

None blocking current work.

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 19-02-PLAN.md (FAQ Section with Schema)
Resume with: Continue Phase 19 with 19-03-PLAN.md
