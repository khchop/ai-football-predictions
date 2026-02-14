# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-14
**Core Value:** The prediction pipeline must reliably generate scores from 20 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete.

## v3.2 Requirements

Requirements for PageSpeed optimization milestone. Target: 90+ Lighthouse on all page types.

### CLS (Layout Stability)

- [ ] **CLS-01**: Homepage desktop CLS < 0.1 (currently 0.294 from footer shift caused by LiveMatches section expanding from zero height)
- [ ] **CLS-02**: LiveMatches section uses fixed-height container or skeleton fallback to prevent layout shift when live matches load
- [ ] **CLS-03**: All page types maintain CLS < 0.1 on desktop and mobile

### LCP (Largest Contentful Paint)

- [ ] **LCP-01**: Homepage mobile LCP < 2.5s (currently 4.2s — LCP element is hero `<p>` tag)
- [ ] **LCP-02**: Hero section text renders within first paint without blocking on font loading or JS hydration
- [ ] **LCP-03**: Match pages LCP < 2.5s on mobile
- [ ] **LCP-04**: Team pages LCP < 2.5s on mobile

### Bundle Optimization

- [ ] **BNDL-01**: Dynamic imports for below-fold modal components (SearchModal, CompareModal, LeagueSelector) to reduce initial JS payload
- [ ] **BNDL-02**: Eliminate legacy JavaScript polyfills (est. 14 KiB savings)
- [ ] **BNDL-03**: Reduce unused JavaScript (est. 78 KiB identified by Lighthouse)
- [ ] **BNDL-04**: Add @next/bundle-analyzer for ongoing bundle size monitoring

### DOM & Rendering

- [ ] **DOM-01**: Keep DOM elements < 1000 per page (currently 1,155 on homepage)
- [ ] **DOM-02**: Reduce main thread work to < 1.5s on mobile (currently 2.0s)

### Cross-cutting

- [ ] **PERF-01**: All page types score 90+ on Lighthouse desktop (currently 77 on homepage)
- [ ] **PERF-02**: All page types score 90+ on Lighthouse mobile (currently 86 on homepage)

## Future Requirements

### Advanced Performance

- **PERF-03**: Service worker for offline static shell
- **PERF-04**: Edge caching layer for API responses
- **PERF-05**: Image CDN with automatic format negotiation (WebP/AVIF)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CDN migration | Current Coolify deployment works, CDN is infrastructure-level change |
| SSG for all pages | Dynamic data (live scores) requires ISR/SSR |
| Server-side font hosting | next/font already handles optimal loading |
| PWA with full offline | View-only platform, offline has limited value |
| Third-party script optimization | No third-party scripts detected (0ms blocking) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLS-01 | TBD | Pending |
| CLS-02 | TBD | Pending |
| CLS-03 | TBD | Pending |
| LCP-01 | TBD | Pending |
| LCP-02 | TBD | Pending |
| LCP-03 | TBD | Pending |
| LCP-04 | TBD | Pending |
| BNDL-01 | TBD | Pending |
| BNDL-02 | TBD | Pending |
| BNDL-03 | TBD | Pending |
| BNDL-04 | TBD | Pending |
| DOM-01 | TBD | Pending |
| DOM-02 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |

**Coverage:**
- v3.2 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
