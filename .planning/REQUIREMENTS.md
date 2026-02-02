# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-02
**Core Value:** Prediction pipeline reliably generates scores from 35 LLMs before kickoff and accurately calculates Kicktipp quota points when matches complete

## v1.2 Requirements

Requirements for Technical SEO Fixes milestone. Each maps to roadmap phases.

### Critical Errors (Phase 9)

- **SEO-T01**: Fix 500 error on Genoa vs Bologna match page (data corruption or null handling) — v1.2 Phase 9
- **SEO-T02**: Fix broken redirect chain that leads to 500 error — v1.2 Phase 9
- **SEO-T03**: Create league index pages for `/leagues/premier-league`, `/leagues/la-liga`, etc. (7 404s in sitemap) — v1.2 Phase 9
- **SEO-T04**: Update internal links/breadcrumbs to use correct league slugs (128 pages link to 404s) — v1.2 Phase 9

### Page Structure (Phase 10)

- **SEO-T05**: Add H1 tag to match detail pages (161 pages missing H1) — v1.2 Phase 10
- **SEO-T06**: Shorten match page title template to <60 characters (125 pages exceed limit) — v1.2 Phase 10
- **SEO-T07**: Shorten league page title template for long competition names — v1.2 Phase 10

### Redirect Optimization (Phase 11)

- **SEO-T08**: Convert 307 temporary redirects to 301 permanent for /matches/UUID → /leagues/* URLs (118 redirects) — v1.2 Phase 11
- **SEO-T09**: Remove noindex from league hub pages or redirect to canonical URLs (34 pages) — v1.2 Phase 11
- **SEO-T10**: Add internal linking to orphan pages or remove from sitemap (111 pages) — v1.2 Phase 11

### Internal Linking (Phase 12)

- **SEO-T11**: Add cross-links between related matches (same competition, same teams) — v1.2 Phase 12
- **SEO-T12**: Add "Related models" section to model pages linking to top performers — v1.2 Phase 12
- **SEO-T13**: Add recent predictions widget to competition pages for internal linking — v1.2 Phase 12

## v1.3+ Requirements (Deferred)

Tracked but not in current roadmap.

### Advanced Metrics

- **ADV-01**: Model calibration metrics (how well probabilities match outcomes)
- **ADV-02**: Brier score calculation for prediction quality
- **ADV-03**: "What if" scenarios showing potential points

### GEO/Internationalization

- **GEO-01**: Spanish translations for key pages (largest football market)
- **GEO-02**: Hreflang tags for international SEO
- **GEO-03**: Football vs Soccer terminology by locale

### Advanced UX

- **AUX-01**: Visual performance comparison charts
- **AUX-02**: Model personality profiles
- **AUX-03**: Programmatic model × competition pages

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time prediction changes | Predictions locked at kickoff, changing creates trust issues |
| User accounts/predictions | View-only platform by design |
| Additional LLM providers | Together AI sufficient, adding complexity without benefit |
| Mobile native app | Web-first, responsive design covers mobile |
| Calibration metrics | Requires probability tracking infrastructure, defer to v1.3 |
| Full i18n | Complexity, defer to v1.3 after SEO foundation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEO-T01 | Phase 9 | Complete |
| SEO-T02 | Phase 9 | Complete |
| SEO-T03 | Phase 9 | Complete |
| SEO-T04 | Phase 9 | Complete |
| SEO-T05 | Phase 10 | Complete |
| SEO-T06 | Phase 10 | Complete |
| SEO-T07 | Phase 10 | Complete |
| SEO-T08 | Phase 11 | Pending |
| SEO-T09 | Phase 11 | Pending |
| SEO-T10 | Phase 11 | Pending |
| SEO-T11 | Phase 12 | Pending |
| SEO-T12 | Phase 12 | Pending |
| SEO-T13 | Phase 12 | Pending |

**Coverage:**
- v1.2 requirements: 13 total
- Completed: 7/13 (54%)

---
*Last updated: 2026-02-02*
