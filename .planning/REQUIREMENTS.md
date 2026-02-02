# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-02
**Core Value:** Prediction pipeline reliably generates scores from 35 LLMs before kickoff and accurately calculates Kicktipp quota points when matches complete

## v1.1 Requirements

Requirements for Stats Accuracy & SEO milestone. Each maps to roadmap phases.

### Stats Calculation

- [ ] **STAT-01**: All accuracy calculations use single standardized formula (`tendencyPoints > 0` / scored predictions)
- [ ] **STAT-02**: Fix IS NOT NULL vs > 0 mismatch in `getTopModelsByCompetition()` and `getModelPredictionStats()`
- [ ] **STAT-03**: Add NULLIF() protection to all division operations in stats queries
- [ ] **STAT-04**: Consistent denominators across all queries (scored predictions only, not all predictions)
- [ ] **STAT-05**: Create canonical stats service layer to centralize calculation logic
- [ ] **STAT-06**: Model detail page shows correct tendency accuracy (not exact score %)

### Data Migration

- [ ] **MIGR-01**: Recalculate historical accuracy for all models using corrected formula
- [ ] **MIGR-02**: Invalidate all stats-related caches atomically after recalculation
- [ ] **MIGR-03**: Verify leaderboard rankings match corrected calculations

### SEO Enhancement

- [ ] **SEO-01**: Add Schema.org SportsEvent structured data to match pages
- [ ] **SEO-02**: Add Schema.org Article structured data to blog/roundup pages
- [ ] **SEO-03**: Add BreadcrumbList structured data to all pages
- [ ] **SEO-04**: Fix OG image to show correct metric with clear label
- [ ] **SEO-05**: Add metadata (title, description, OG tags) to competition pages
- [ ] **SEO-06**: Optimize meta descriptions to < 160 characters
- [ ] **SEO-07**: Ensure all pages have unique, descriptive titles

### UX Transparency

- [ ] **UX-01**: Display accuracy with denominator visible (e.g., "81/160 (50.6%)")
- [ ] **UX-02**: Add tooltips explaining what each metric means
- [ ] **UX-03**: Leaderboard shows correct, trustworthy numbers after stats fix

## v1.2+ Requirements (Deferred)

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
| Calibration metrics | Requires probability tracking infrastructure, defer to v1.2 |
| Full i18n | Complexity, defer to v1.2 after SEO foundation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAT-01 | TBD | Pending |
| STAT-02 | TBD | Pending |
| STAT-03 | TBD | Pending |
| STAT-04 | TBD | Pending |
| STAT-05 | TBD | Pending |
| STAT-06 | TBD | Pending |
| MIGR-01 | TBD | Pending |
| MIGR-02 | TBD | Pending |
| MIGR-03 | TBD | Pending |
| SEO-01 | TBD | Pending |
| SEO-02 | TBD | Pending |
| SEO-03 | TBD | Pending |
| SEO-04 | TBD | Pending |
| SEO-05 | TBD | Pending |
| SEO-06 | TBD | Pending |
| SEO-07 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 0 (awaiting roadmap)
- Unmapped: 19

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
