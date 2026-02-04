# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** v2.4 Synthetic.new Integration

## Current Position

Phase: 37 of 39 (Synthetic Provider Foundation)
Plan: 02 of 03 complete
Status: In progress
Last activity: 2026-02-04 — Completed 37-02-PLAN.md (13 model configurations)

Progress: [██████░░░░] 67%

## Milestone History

| Milestone | Phases | Plans | Requirements | Shipped |
|-----------|--------|-------|--------------|---------|
| v1.0 Bug Fix Stabilization | 1-4 | 14 | 18 | 2026-02-01 |
| v1.1 Stats Accuracy & SEO | 5-8 | 10 | 19 | 2026-02-02 |
| v1.2 Technical SEO Fixes | 9-12 | 9 | 13 | 2026-02-02 |
| v1.3 Match Page Refresh | 13-16 | 13 | 18 | 2026-02-02 |
| v2.0 UI/UX Overhaul | 17-23 | 28 | 33 | 2026-02-03 |
| v2.1 Match Page Simplification | 24-25 | 3 | 9 | 2026-02-03 |
| v2.2 Match Page Rewrite | 26-30 | 17 | 21 | 2026-02-04 |
| v2.3 Content Pipeline & SEO | 31-36 | 13 | 24 | 2026-02-04 |
| v2.4 Synthetic.new Integration | 37-39 | — | 17 | In Progress |

**Total shipped:** 36 phases, 107 plans, 155 requirements

## Accumulated Context

### Decisions

Key decisions from v2.3 are archived in milestones/v2.3-ROADMAP.md.

**v2.4 Decisions:**
- Add Synthetic.new alongside Together AI (not replace)
- Keep Together AI models for overlapping models (prefer existing)
- Skip vision model (Qwen3-VL) - not useful for text predictions
- Include GLM models despite Chinese output risk
- All Synthetic model IDs use -syn suffix to distinguish from Together
- 13 models configured (4 premium, 9 budget) with placeholder pricing

### Pending Todos

None.

### Blockers/Concerns

**Active Blockers:**
None.

**Future Concerns:**
- JSON mode support unknown on Synthetic.new (parser handles non-JSON)
- Rate limits: 135 req/5hrs on Standard tier (small requests count as 0.2)
- GLM models may output Chinese text

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |

## Session Continuity

Last session: 2026-02-04T20:43:49Z
Stopped at: Completed 37-02-PLAN.md
Resume file: .planning/phases/37-synthetic-provider/37-03-PLAN.md
Resume with: `/gsd:execute-plan 37-03` to integrate Synthetic providers into registry

**v2.4 Summary:**
- 3 phases (37-39), 17 requirements
- Adds Synthetic.new as second LLM provider
- 13 new models (3 reasoning + 10 standard)
- Total models: 29 → 42
