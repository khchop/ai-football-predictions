# Requirements: v1.3 Match Page Refresh

**Defined:** 2026-02-02
**Core Value:** Mobile-first match pages with consolidated content and AI search optimization

## v1.3 Requirements

Requirements for match page refresh. Each maps to roadmap phases.

### Mobile Layout & De-duplication

- [x] **MOBL-01**: Match score displays exactly once in sticky header (remove from roundup viewer, stats)
- [x] **MOBL-02**: AI predictions consolidated into single expandable section (merge table, roundup predictions, top performers)
- [x] **MOBL-03**: Advanced match stats collapsed behind "View More" progressive disclosure
- [x] **MOBL-04**: Tabbed navigation implemented (Summary/Stats/Predictions/Analysis)
- [x] **MOBL-05**: Swipe gestures work between tabs on mobile devices
- [x] **MOBL-06**: Touch targets meet 44x44px minimum for mobile accessibility

### Content Generation Pipeline

- [x] **CONT-01**: Pre-match LLM content renders on upcoming match pages
- [x] **CONT-02**: Prediction content renders on match pages with predictions
- [x] **CONT-03**: Post-match LLM content renders on finished match pages
- [x] **CONT-04**: Unified content query fetches from both matchContent and matchRoundups tables
- [x] **CONT-05**: Long narrative content chunked with "Read More" expansion (150-200 word preview)

### Performance & Caching

- [ ] **PERF-01**: Match pages use ISR with appropriate revalidation (60s live, 300s scheduled, 3600s finished)
- [ ] **PERF-02**: Match data, predictions, and content fetched in parallel with Promise.all
- [ ] **PERF-03**: TTFB under 400ms on mobile networks (currently ~800ms with force-dynamic)

### AI Search Optimization

- [ ] **SRCH-01**: robots.txt allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Amazonbot)
- [ ] **SRCH-02**: llms.txt file provides structured content paths for AI training/RAG
- [ ] **SRCH-03**: Single consolidated Schema.org JSON-LD graph per match page (SportsEvent + WebPage + BreadcrumbList)
- [ ] **SRCH-04**: AI-generated content visible to crawlers (not hidden behind client-side rendering)

## Future Requirements

Deferred to later milestones.

### Advanced Features

- **ADVN-01**: Real-time prediction updates during live matches (WebSocket)
- **ADVN-02**: Model performance tracking (hot/cold streak indicators)
- **ADVN-03**: Historical prediction accuracy visualization (charts)
- **ADVN-04**: Multi-language support (Spanish, German translations)

### Pipeline Cleanup

- **PIPE-01**: Migrate to single-table content storage (deprecate dual writes)
- **PIPE-02**: Add hallucination validation for match content
- **PIPE-03**: Make content generation queue workers idempotent

## Out of Scope

Explicitly excluded from this milestone.

| Feature | Reason |
|---------|--------|
| Real-time WebSocket updates | High complexity, requires backend changes beyond UI refresh |
| Multi-language translations | GEO internationalization is separate milestone scope |
| Database migration/cleanup | Keep dual-table support for rollback safety during transition |
| New content types | Focus on fixing existing pipeline before adding new content |
| Model performance charts | Visual enhancements after core UX fixed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 13 | Complete |
| CONT-02 | Phase 13 | Complete |
| CONT-03 | Phase 13 | Complete |
| CONT-04 | Phase 13 | Complete |
| CONT-05 | Phase 13 | Complete |
| MOBL-01 | Phase 14 | Complete |
| MOBL-02 | Phase 14 | Complete |
| MOBL-03 | Phase 14 | Complete |
| MOBL-04 | Phase 14 | Complete |
| MOBL-05 | Phase 14 | Complete |
| MOBL-06 | Phase 14 | Complete |
| PERF-01 | Phase 15 | Pending |
| PERF-02 | Phase 15 | Pending |
| PERF-03 | Phase 15 | Pending |
| SRCH-01 | Phase 16 | Pending |
| SRCH-02 | Phase 16 | Pending |
| SRCH-03 | Phase 16 | Pending |
| SRCH-04 | Phase 16 | Pending |

**Coverage:**
- v1.3 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after Phase 14 complete*
