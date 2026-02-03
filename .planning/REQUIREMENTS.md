# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-03
**Core Value:** Prediction pipeline reliably generates scores from 35 LLMs ~30 minutes before kickoff and accurately calculates Kicktipp quota points when matches complete

## v2.1 Requirements

Requirements for v2.1 Match Page Simplification milestone.

### Layout

- [ ] **LAYT-01**: Remove sticky header — header scrolls naturally with page on both desktop and mobile
- [ ] **LAYT-02**: Remove mobile tabbed navigation — single scrollable page on all devices
- [ ] **LAYT-03**: Unified layout order: Score → Scorers/Goals → Odds → Pre-match Report → Prediction Report → Post-match Report → Predictions Table → FAQ

### Content Filtering

- [ ] **FILT-01**: Hide H2H section completely from match pages
- [ ] **FILT-02**: Hide league standings section completely from match pages
- [ ] **FILT-03**: Hide empty sections (match events, stats, etc.) when no data exists
- [ ] **FILT-04**: No "unavailable" or "no data" placeholder messages shown to users

### Content Quality

- [x] **QUAL-01**: Strip/render HTML tags properly in narrative content — no raw `<h2>`, `<p>`, etc. visible
- [x] **QUAL-02**: Clean narrative output without HTML fragments in database content

## Future Requirements

Deferred to later milestones.

### Model Pages

- **MODL-01**: Model pages redesign
- **MODL-02**: Model comparison features

### Design System

- **DSGN-07**: Migrate remaining hardcoded colors to semantic tokens
- **DSGN-08**: ThemeToggle integration into Navigation

## Out of Scope

Explicitly excluded from v2.1.

| Feature | Reason |
|---------|--------|
| Model pages redesign | Separate scope, not related to match page fixes |
| New navigation patterns | Focus is simplification, not redesign |
| Mobile app | Web-only platform |
| Additional content sections | Goal is to remove, not add |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYT-01 | Phase 24 | Complete |
| LAYT-02 | Phase 24 | Complete |
| LAYT-03 | Phase 24 | Complete |
| FILT-01 | Phase 24 | Complete |
| FILT-02 | Phase 24 | Complete |
| FILT-03 | Phase 24 | Complete |
| FILT-04 | Phase 24 | Complete |
| QUAL-01 | Phase 25 | Complete |
| QUAL-02 | Phase 25 | Complete |

**Coverage:**
- v2.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after Phase 25 completion*
