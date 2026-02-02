# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-02
**Core Value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete

## v2.0 Requirements

Requirements for UI/UX Overhaul. Each maps to roadmap phases.

### Design System

- [ ] **DSGN-01**: Semantic color tokens defined for sports states (win/loss/draw, live/upcoming/finished)
- [ ] **DSGN-02**: Typography scale with responsive sizing across breakpoints
- [ ] **DSGN-03**: Spacing system with consistent rhythm (4px/8px base)
- [ ] **DSGN-04**: Component variants for all match states
- [ ] **DSGN-05**: Full dark mode support with toggle
- [ ] **DSGN-06**: View Transitions API enabled for smooth navigation

### Match Pages

- [ ] **MTCH-01**: Score displays exactly once on page (no duplication across sections)
- [ ] **MTCH-02**: Pre-match narrative content visible on upcoming match pages
- [ ] **MTCH-03**: Prediction explanation content visible on match pages with predictions
- [ ] **MTCH-04**: Post-match roundup content visible on finished match pages
- [ ] **MTCH-05**: Static shell with streaming dynamic content via PPR
- [ ] **MTCH-06**: Answer-first content structure optimized for GEO/AI citations

### Blog Pages

- [ ] **BLOG-01**: Readable line width (600-700px max-width on content)
- [ ] **BLOG-02**: Proper typography hierarchy (H1, H2, H3 styling)
- [ ] **BLOG-03**: Table of contents for articles over 500 words
- [ ] **BLOG-04**: FAQ section with FAQPage schema for GEO
- [ ] **BLOG-05**: Related articles widget showing contextually relevant posts

### League Pages

- [ ] **LEAG-01**: SEO-optimized metadata (titles, descriptions, OG tags)
- [ ] **LEAG-02**: Structured data (SportsOrganization/SportsLeague schema)
- [ ] **LEAG-03**: FAQ section with FAQPage schema for GEO
- [ ] **LEAG-04**: Competition stats dashboard (total matches, predictions, accuracy)
- [ ] **LEAG-05**: Historical performance trends visualization

### Leaderboard Pages

- [ ] **LEAD-01**: SEO-optimized metadata and FAQ section with schema
- [ ] **LEAD-02**: Time period filters (weekly/monthly/all-time)
- [ ] **LEAD-03**: Trend indicators showing rising/falling model performance

### Navigation & Internal Linking

- [ ] **NAVL-01**: Bottom navigation bar for mobile (icons + labels)
- [ ] **NAVL-02**: Breadcrumbs on all pages
- [ ] **NAVL-03**: Related content widgets (matches, models, articles)
- [ ] **NAVL-04**: Automated entity linking in content (team names, competitions, models)
- [ ] **NAVL-05**: Prefetch on hover/touch for instant navigation

### Performance

- [ ] **PERF-01**: Partial Prerendering (PPR) enabled for static shells
- [ ] **PERF-02**: Cache configuration fixed (resolve dynamic/revalidate conflicts)
- [ ] **PERF-03**: Client component audit complete (unnecessary 'use client' removed)
- [ ] **PERF-04**: View Transitions enabled for smooth page transitions

## Future Requirements

Deferred to subsequent milestones.

### Model Pages

- **MODL-01**: Model detail page redesign with GEO optimization
- **MODL-02**: Model comparison feature

### About Pages

- **ABOU-01**: About page SEO optimization
- **ABOU-02**: Methodology page redesign

### Advanced Features

- **ADVN-01**: Real-time prediction confidence updates
- **ADVN-02**: User preference persistence (dark mode, filters)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts/auth | View-only platform, no user data |
| Betting integration | Not in business model |
| Native mobile app | Web-first, PWA possible later |
| Real-time chat/comments | Moderation burden, focus on predictions |
| Model fine-tuning | Infrastructure complexity |
| New leagues beyond 17 | Maintain existing scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DSGN-01 | — | Pending |
| DSGN-02 | — | Pending |
| DSGN-03 | — | Pending |
| DSGN-04 | — | Pending |
| DSGN-05 | — | Pending |
| DSGN-06 | — | Pending |
| MTCH-01 | — | Pending |
| MTCH-02 | — | Pending |
| MTCH-03 | — | Pending |
| MTCH-04 | — | Pending |
| MTCH-05 | — | Pending |
| MTCH-06 | — | Pending |
| BLOG-01 | — | Pending |
| BLOG-02 | — | Pending |
| BLOG-03 | — | Pending |
| BLOG-04 | — | Pending |
| BLOG-05 | — | Pending |
| LEAG-01 | — | Pending |
| LEAG-02 | — | Pending |
| LEAG-03 | — | Pending |
| LEAG-04 | — | Pending |
| LEAG-05 | — | Pending |
| LEAD-01 | — | Pending |
| LEAD-02 | — | Pending |
| LEAD-03 | — | Pending |
| NAVL-01 | — | Pending |
| NAVL-02 | — | Pending |
| NAVL-03 | — | Pending |
| NAVL-04 | — | Pending |
| NAVL-05 | — | Pending |
| PERF-01 | — | Pending |
| PERF-02 | — | Pending |
| PERF-03 | — | Pending |
| PERF-04 | — | Pending |

**Coverage:**
- v2.0 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33 (pending roadmap)

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
