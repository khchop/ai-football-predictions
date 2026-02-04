# Requirements: v2.3 Content Pipeline & SEO

**Defined:** 2026-02-04
**Core Value:** Content generation pipeline must reliably trigger and produce SEO/GEO optimized content for all matches

## v2.3 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Pipeline Reliability

- [ ] **PIPE-01**: Content generation functions throw errors on failure instead of returning false
- [ ] **PIPE-02**: Content queue uses 120-second lock duration for long-running jobs
- [ ] **PIPE-03**: Content validation runs before database save (min 100 chars, no placeholder text)
- [ ] **PIPE-04**: Failed jobs reach dead letter queue for visibility
- [ ] **PIPE-05**: Circuit breaker pauses queue after 5 consecutive rate limit errors
- [ ] **PIPE-06**: Worker heartbeat monitoring detects process death
- [ ] **PIPE-07**: Content completeness monitoring alerts when finished matches have no content
- [ ] **PIPE-08**: Blog generation pipeline triggers reliably

### HTML Sanitization

- [ ] **HTML-01**: LLM prompts include explicit "plain text only, no HTML" instruction
- [ ] **HTML-02**: HTML tags stripped before database save (not just at render)
- [ ] **HTML-03**: One-time migration cleans HTML from existing content
- [ ] **HTML-04**: Content rendered without visible HTML artifacts

### SEO/GEO Content Quality

- [ ] **SGEO-01**: Pre-match content uses answer-first structure (prediction in first 30-60 words)
- [ ] **SGEO-02**: Post-match content uses answer-first structure (result in first 30-60 words)
- [ ] **SGEO-03**: FAQ questions are match-specific with actual data (not generic)
- [ ] **SGEO-04**: Upcoming matches generate 5 state-specific FAQ questions
- [ ] **SGEO-05**: Finished matches generate 5 state-specific FAQ questions including accuracy
- [ ] **SGEO-06**: Finished match FAQ includes "How accurate were AI predictions?" with X/35 data
- [ ] **SGEO-07**: Content includes datePublished and dateModified schema properties
- [ ] **SGEO-08**: Entity names consistent throughout content (full team names, not abbreviations)

### Blog Generation

- [ ] **BLOG-01**: Blog generation jobs trigger reliably for eligible matches
- [ ] **BLOG-02**: Blog content uses same error handling pattern as match content
- [ ] **BLOG-03**: Blog content sanitized before save
- [ ] **BLOG-04**: Blog posts include answer-first summary paragraph

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Content Enhancements

- **CONT-01**: Video/multimedia content for match previews
- **CONT-02**: Real-time content updates when lineups announced
- **CONT-03**: Expert commentary layer (human editorial input)

### Topical Authority

- **AUTH-01**: Pillar content pages for each league (2500-4000 words)
- **AUTH-02**: Hub-and-spoke internal linking from matches to pillars
- **AUTH-03**: 8-12 cluster pages per pillar topic

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Alternative LLM providers | Adds complexity without solving actual issues |
| Client-side JSON-LD injection | SEO penalty risk |
| AMP pages | No longer provides ranking advantages in 2026 |
| Multi-platform citation tracking | Needs traffic baseline first |
| Temperature A/B testing | Can be done post-milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | TBD | Pending |
| PIPE-02 | TBD | Pending |
| PIPE-03 | TBD | Pending |
| PIPE-04 | TBD | Pending |
| PIPE-05 | TBD | Pending |
| PIPE-06 | TBD | Pending |
| PIPE-07 | TBD | Pending |
| PIPE-08 | TBD | Pending |
| HTML-01 | TBD | Pending |
| HTML-02 | TBD | Pending |
| HTML-03 | TBD | Pending |
| HTML-04 | TBD | Pending |
| SGEO-01 | TBD | Pending |
| SGEO-02 | TBD | Pending |
| SGEO-03 | TBD | Pending |
| SGEO-04 | TBD | Pending |
| SGEO-05 | TBD | Pending |
| SGEO-06 | TBD | Pending |
| SGEO-07 | TBD | Pending |
| SGEO-08 | TBD | Pending |
| BLOG-01 | TBD | Pending |
| BLOG-02 | TBD | Pending |
| BLOG-03 | TBD | Pending |
| BLOG-04 | TBD | Pending |

**Coverage:**
- v2.3 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after initial definition*
