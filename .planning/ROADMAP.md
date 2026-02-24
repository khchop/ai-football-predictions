# Roadmap: AI Football Predictions Platform

## Milestones

- ✅ **v1.0 Bug Fix Stabilization** - Phases 1-4 (shipped 2026-02-01)
- ✅ **v1.1 Stats Accuracy & SEO** - Phases 5-8 (shipped 2026-02-02)
- ✅ **v1.2 Technical SEO Fixes** - Phases 9-12 (shipped 2026-02-02)
- ✅ **v1.3 Match Page Refresh** - Phases 13-16 (shipped 2026-02-02)
- ✅ **v2.0 UI/UX Overhaul** - Phases 17-23 (shipped 2026-02-03)
- ✅ **v2.1 Match Page Simplification** - Phases 24-25 (shipped 2026-02-03)
- ✅ **v2.2 Match Page Rewrite** - Phases 26-30 (shipped 2026-02-04)
- ✅ **v2.3 Content Pipeline & SEO** - Phases 31-36 (shipped 2026-02-04)
- ✅ **v2.4 Synthetic.new Integration** - Phases 37-39 (shipped 2026-02-05)
- ✅ **v2.5 Model Reliability & Dynamic Counts** - Phases 40-43 (shipped 2026-02-05)
- ✅ **v2.6 SEO/GEO Site Health** - Phases 44-48 (shipped 2026-02-06)
- ✅ **v2.7 Pipeline Reliability & Retroactive Backfill** - Phases 49-52 (shipped 2026-02-07)
- ✅ **v2.8 Model Coverage** - Phases 53-58 (shipped 2026-02-08)
- ✅ **v2.9 Provider Unification & Maximum Coverage** - Phases 59-62 + quick-040/041 (shipped 2026-02-11)
- ✅ **v3.0 Club/Team Pages** - Phases 67-71 (shipped 2026-02-12)
- ✅ **v3.1 Model Lifecycle & Discord Alerts** — Phases 72-74 (shipped 2026-02-13)
- 🚧 **v3.2 PageSpeed Optimization** - Phases 75-79 (in progress)

## Phases

<details>
<summary>✅ v1.0 Bug Fix Stabilization (Phases 1-4) - SHIPPED 2026-02-01</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.1 Stats Accuracy & SEO (Phases 5-8) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.2 Technical SEO Fixes (Phases 9-12) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v1.3 Match Page Refresh (Phases 13-16) - SHIPPED 2026-02-02</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.0 UI/UX Overhaul (Phases 17-23) - SHIPPED 2026-02-03</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.1 Match Page Simplification (Phases 24-25) - SHIPPED 2026-02-03</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.2 Match Page Rewrite (Phases 26-30) - SHIPPED 2026-02-04</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.3 Content Pipeline & SEO (Phases 31-36) - SHIPPED 2026-02-04</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.4 Synthetic.new Integration (Phases 37-39) - SHIPPED 2026-02-05</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.5 Model Reliability & Dynamic Counts (Phases 40-43) - SHIPPED 2026-02-05</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.6 SEO/GEO Site Health (Phases 44-48) - SHIPPED 2026-02-06</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.7 Pipeline Reliability & Retroactive Backfill (Phases 49-52) - SHIPPED 2026-02-07</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.8 Model Coverage (Phases 53-58) - SHIPPED 2026-02-08</summary>

See `.planning/MILESTONES.md` for full details.

</details>

<details>
<summary>✅ v2.9 Provider Unification & Maximum Coverage (Phases 59-62 + quick-040/041) - SHIPPED 2026-02-11</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/v2.9-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.0 Club/Team Pages (Phases 67-71) - SHIPPED 2026-02-12</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.1 Model Lifecycle & Discord Alerts (Phases 72-74) — SHIPPED 2026-02-13</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

### 🚧 v3.2 PageSpeed Optimization (In Progress)

**Milestone Goal:** Achieve 90+ Lighthouse performance score on all page types (desktop and mobile)

#### Phase 75: CLS Fixes

**Goal**: Eliminate layout shifts to achieve CLS < 0.1 across all page types

**Depends on**: Phase 74

**Requirements**: CLS-01, CLS-02, CLS-03

**Success Criteria** (what must be TRUE):
  1. Homepage desktop CLS drops from 0.294 to < 0.1 (no footer shift)
  2. LiveMatches section loads without expanding from zero height (fixed-height container or proper skeleton)
  3. All page types (home, match, team, league, model) maintain CLS < 0.1 on desktop and mobile
  4. Suspense fallbacks use proper skeletons with reserved height matching content
  5. No layout shift when components hydrate or lazy-load

**Plans**: 1 plan

Plans:
- [x] 75-01-PLAN.md — Replace all `fallback={null}` with proper skeletons (homepage LiveMatches, matches badge, league FAQ)

#### Phase 76: LCP & Font Optimization

**Goal**: Reduce mobile LCP to < 2.5s and optimize hero section rendering

**Depends on**: Phase 75

**Requirements**: LCP-01, LCP-02

**Success Criteria** (what must be TRUE):
  1. Homepage mobile LCP drops from 4.2s to < 2.5s
  2. Hero `<p>` tag (LCP element) renders in first paint without blocking on font or JS hydration
  3. next/font Inter configuration optimized (font-display:swap already enabled, verify preload)
  4. Critical text visible before full font loads (FOUT acceptable vs FOIT)
  5. Hero section HTML delivered inline (not waiting for client components)

**Plans**: 1 plan

Plans:
- [x] 76-01-PLAN.md — Optimize next/font Inter config + restructure Providers to eliminate hydration blocking

#### Phase 77: Bundle Reduction

**Goal**: Reduce JavaScript bundle size through dynamic imports and legacy code removal

**Depends on**: Phase 76

**Requirements**: BNDL-01, BNDL-02, BNDL-03, BNDL-04

**Success Criteria** (what must be TRUE):
  1. Below-fold modal components (SearchModal, CompareModal, LeagueSelector) use dynamic imports with loading states
  2. Legacy JavaScript polyfills eliminated (14 KiB savings verified)
  3. Unused JavaScript reduced by at least 50 KiB from current 78 KiB
  4. @next/bundle-analyzer integrated into package.json with build:analyze script
  5. Bundle analysis report shows clear before/after comparison

**Plans**: TBD

Plans:
- [ ] 77-01: TBD

#### Phase 78: DOM & Rendering

**Goal**: Reduce DOM complexity and main thread work while verifying LCP across page types

**Depends on**: Phase 77

**Requirements**: DOM-01, DOM-02, LCP-03, LCP-04

**Success Criteria** (what must be TRUE):
  1. Homepage DOM elements reduced from 1,155 to < 1,000 elements
  2. Mobile main thread work reduced from 2.0s to < 1.5s
  3. Match pages achieve LCP < 2.5s on mobile
  4. Team pages achieve LCP < 2.5s on mobile
  5. No unnecessary wrapper divs or redundant DOM structure identified

**Plans**: TBD

Plans:
- [ ] 78-01: TBD

#### Phase 79: Final Verification

**Goal**: Achieve 90+ Lighthouse scores across all page types on desktop and mobile

**Depends on**: Phase 78

**Requirements**: PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
  1. All page types (home, match, team, league, model) score 90+ on Lighthouse desktop
  2. All page types score 90+ on Lighthouse mobile
  3. CLS < 0.1, LCP < 2.5s, and TBT < 200ms verified across all page types
  4. No regressions in FCP, TTI, or Speed Index from baseline
  5. Verification documented with before/after Lighthouse reports for each page type

**Plans**: TBD

Plans:
- [ ] 79-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 75 → 76 → 77 → 78 → 79

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-74. Previous milestones | v1.0-v3.1 | All | Complete | 2026-02-13 |
| 75. CLS Fixes | v3.2 | 1/1 | Complete | 2026-02-14 |
| 76. LCP & Font Optimization | v3.2 | 1/1 | Planned | - |
| 77. Bundle Reduction | v3.2 | 0/TBD | Not started | - |
| 78. DOM & Rendering | v3.2 | 0/TBD | Not started | - |
| 79. Final Verification | v3.2 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-14 after Phase 75 execution*
