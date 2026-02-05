# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The prediction pipeline must reliably generate scores from LLMs and accurately calculate Kicktipp quota points when matches complete
**Current focus:** v2.5 Model Reliability & Dynamic Counts

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-05 — Milestone v2.5 started

Progress: Ready for requirements definition

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
| v2.4 Synthetic.new Integration | 37-39 | 7 | 17 | 2026-02-05 |

**Total shipped:** 39 phases, 114 plans, 172 requirements

## Accumulated Context

### Decisions

Key decisions from v2.4 archived in milestones/v2.4-ROADMAP.md.

### Pending Todos

None.

### Blockers/Concerns

**Active Blockers:**
None.

**Known Issues for v2.5:**
- GLM-4.7 has known SGLang structured output bug (Synthetic.new confirmed) - may need Together.ai fallback
- kimi-k2.5-syn and glm-4.6-syn timeout consistently - need model-specific prompt or fallback
- qwen3-235b-thinking and deepseek-v3.2 return natural language instead of JSON - need prompt adjustment
- 15+ hardcoded "35 models" references across SEO metadata need dynamic replacement

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 009 | Fix HierarchyRequestError on new tab open | 2026-02-04 | 58330f2 | [009-fix-new-tab-hierarchy-error](./quick/009-fix-new-tab-hierarchy-error/) |
| 010 | Improve blog methodology, SEO/GEO, FAQ | 2026-02-04 | da9db4a | [010-blog-seo-methodology-faq](./quick/010-blog-seo-methodology-faq/) |

## Session Continuity

Last session: 2026-02-05
Stopped at: Milestone v2.5 started, defining requirements
Resume file: None
Resume with: Continue requirements definition

**Platform status:**
- 17 leagues operational
- 36 active models (29 Together + 7 Synthetic)
- 6 disabled Synthetic models (target for re-enabling)
- 172 requirements validated
- 39 phases complete
