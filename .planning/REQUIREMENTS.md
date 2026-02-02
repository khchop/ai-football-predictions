# Requirements: v1.3 Match Page Refresh

**Defined:** 2026-02-02
**Core Value:** Mobile-first match pages with consolidated content and AI search optimization

## v1.3 Requirements

Requirements for match page refresh. Each maps to roadmap phases.

### Mobile Layout & De-duplication

- [ ] **MOBL-01**: Match score displays exactly once in sticky header (remove from roundup viewer, stats)
- [ ] **MOBL-02**: AI predictions consolidated into single expandable section (merge table, roundup predictions, top performers)
- [ ] **MOBL-03**: Advanced match stats collapsed behind "View More" progressive disclosure
- [ ] **MOBL-04**: Tabbed navigation implemented (Summary/Stats/Predictions/Analysis)
- [ ] **MOBL-05**: Swipe gestures work between tabs on mobile devices
- [ ] **MOBL-06**: Touch targets meet 44x44px minimum for mobile accessibility

### Content Generation Pipeline

- [ ] **CONT-01**: Pre-match LLM content renders on upcoming match pages
- [ ] **CONT-02**: Prediction content renders on match pages with predictions
- [ ] **CONT-03**: Post-match LLM content renders on finished match pages
- [ ] **CONT-04**: Unified content query fetches from both matchContent and matchRoundups tables
- [ ] **CONT-05**: Long narrative content chunked with "Read More" expansion (150-200 word preview)

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
| MOBL-01 | TBD | Pending |
| MOBL-02 | TBD | Pending |
| MOBL-03 | TBD | Pending |
| MOBL-04 | TBD | Pending |
| MOBL-05 | TBD | Pending |
| MOBL-06 | TBD | Pending |
| CONT-01 | TBD | Pending |
| CONT-02 | TBD | Pending |
| CONT-03 | TBD | Pending |
| CONT-04 | TBD | Pending |
| CONT-05 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |
| PERF-03 | TBD | Pending |
| SRCH-01 | TBD | Pending |
| SRCH-02 | TBD | Pending |
| SRCH-03 | TBD | Pending |
| SRCH-04 | TBD | Pending |

**Coverage:**
- v1.3 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 (pending roadmap creation)

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
