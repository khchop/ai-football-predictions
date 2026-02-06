# Requirements: v2.6 SEO/GEO Site Health

**Defined:** 2026-02-05
**Core Value:** Fix all SEO/GEO issues identified by Ahrefs audit to maximize search visibility and crawl efficiency

## v2.6 Requirements

Requirements for v2.6 milestone. Each maps to roadmap phases.

### Redirects & Canonicals

- [ ] **REDIR-01**: All www.kroam.xyz requests return 301 (not 302) to https://kroam.xyz
- [ ] **REDIR-02**: All http://kroam.xyz requests return 301 (not 302) to https://kroam.xyz
- [ ] **REDIR-03**: No redirect chains exist (single-hop from any entry point to canonical URL)
- [ ] **REDIR-04**: Root layout does not set canonical URL (no cascading canonical to child pages)
- [ ] **REDIR-05**: All match pages at /leagues/{slug}/{match} have self-referential canonical URLs
- [x] **REDIR-06**: Internal links use short-form league slugs (epl, ucl, etc.) to avoid triggering 308 redirects

### Index Pages

- [ ] **INDEX-01**: /leagues returns 200 with a listing of all leagues with descriptions and internal links
- [ ] **INDEX-02**: /models returns 200 with a listing of all models with performance stats and internal links
- [ ] **INDEX-03**: /leagues page has proper generateMetadata (title, description, canonical, OG tags)
- [ ] **INDEX-04**: /models page has proper generateMetadata (title, description, canonical, OG tags)
- [x] **INDEX-05**: /leagues page includes CollectionPage or ItemList structured data
- [x] **INDEX-06**: /models page includes CollectionPage or ItemList structured data

### Sitemap Hygiene

- [x] **SMAP-01**: Sitemap index file exists at /sitemap.xml referencing all sub-sitemaps
- [x] **SMAP-02**: No /matches/UUID URLs appear in any sitemap (only canonical /leagues/{slug}/{match} URLs)
- [x] **SMAP-03**: All league pages appear in sitemap (including non-club competitions if applicable)
- [x] **SMAP-04**: /models and /leagues index pages appear in sitemap

### Internal Linking

- [x] **LINK-01**: All model pages have at least 3 internal links pointing to them (from /models index and cross-links)
- [x] **LINK-02**: Zero orphan match pages (all matches reachable via internal links)
- [x] **LINK-03**: League pages include links to related models (cross-linking widget)
- [x] **LINK-04**: Model pages include links to recent matches they predicted (cross-linking widget)
- [x] **LINK-05**: Pages with only 1 dofollow internal link are reduced by >50%

### Content Tags

- [x] **CTAG-01**: All match pages at /leagues/{slug}/{match} have an H1 tag ("{HomeTeam} vs {AwayTeam}")
- [x] **CTAG-02**: Zero meta descriptions shorter than 100 characters on indexable pages
- [x] **CTAG-03**: Zero meta descriptions longer than 160 characters on indexable pages
- [x] **CTAG-04**: Zero title tags longer than 60 characters on indexable pages
- [x] **CTAG-05**: All indexable pages have complete Open Graph tags (og:title, og:description, og:image, og:url)
- [x] **CTAG-06**: League index and model index pages have H1 tags

### Structured Data

- [x] **SCHEMA-01**: No duplicate Organization or WebSite schemas on any page (single source of truth)
- [x] **SCHEMA-02**: SportsEvent schema passes Google Rich Results Test validation
- [x] **SCHEMA-03**: Article/FAQPage schemas pass Google Rich Results Test validation
- [x] **SCHEMA-04**: BreadcrumbList schema is valid on all page types
- [x] **SCHEMA-05**: Schema.org validation errors reduced from 4365 to <50

### Hreflang Cleanup

- [ ] **I18N-01**: Root layout does not declare language alternates for non-functional subdomains
- [ ] **I18N-02**: No hreflang tags pointing to URLs that return 503 or non-200 status codes

### Performance

- [ ] **PERF-01**: Pages with TTFB >2 seconds are investigated and optimized where possible
- [ ] **PERF-02**: /matches/UUID redirect pages respond within 500ms (no unnecessary rendering)

## v2.7+ Requirements (Deferred)

### Internationalization

- **I18N-D01**: Subdomain routing for es/fr/it/de.kroam.xyz with translated content
- **I18N-D02**: Hreflang tags with x-default pointing to English version
- **I18N-D03**: robots.txt accessible and correct on all language subdomains

### Advanced SEO

- **ASEO-D01**: Automated structured data validation in CI pipeline
- **ASEO-D02**: PageSpeed Insights score >90 on all page types
- **ASEO-D03**: Core Web Vitals all green in Google Search Console

## Out of Scope

| Feature | Reason |
|---------|--------|
| i18n implementation (next-intl) | Subdomains non-functional, no translated content exists. Remove broken hreflang instead. |
| New language content/translations | Requires content creation effort beyond technical SEO fixes |
| next-sitemap package | Next.js 16 native sitemap APIs sufficient |
| Google Rich Results Test CI automation | No official API, brittle. Use manual spot-checks. |
| Aggressive pagination on index pages | Keep all pages indexable per SEO best practices |
| Blocking /matches/UUID with 404/410 | URL exists in backlinks, must redirect to preserve link equity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REDIR-01 | Phase 44 | Complete |
| REDIR-02 | Phase 44 | Complete |
| REDIR-03 | Phase 44 | Complete |
| REDIR-04 | Phase 44 | Complete |
| REDIR-05 | Phase 44 | Complete |
| REDIR-06 | Phase 45 | Complete |
| INDEX-01 | Phase 44 | Complete |
| INDEX-02 | Phase 44 | Complete |
| INDEX-03 | Phase 44 | Complete |
| INDEX-04 | Phase 44 | Complete |
| INDEX-05 | Phase 46 | Complete |
| INDEX-06 | Phase 46 | Complete |
| SMAP-01 | Phase 45 | Complete |
| SMAP-02 | Phase 45 | Complete |
| SMAP-03 | Phase 45 | Complete |
| SMAP-04 | Phase 45 | Complete |
| LINK-01 | Phase 45 | Complete |
| LINK-02 | Phase 45 | Complete |
| LINK-03 | Phase 45 | Complete |
| LINK-04 | Phase 45 | Complete |
| LINK-05 | Phase 45 | Complete |
| CTAG-01 | Phase 46 | Complete |
| CTAG-02 | Phase 46 | Complete |
| CTAG-03 | Phase 46 | Complete |
| CTAG-04 | Phase 46 | Complete |
| CTAG-05 | Phase 46 | Complete |
| CTAG-06 | Phase 46 | Complete |
| SCHEMA-01 | Phase 47 | Complete |
| SCHEMA-02 | Phase 47 | Complete |
| SCHEMA-03 | Phase 47 | Complete |
| SCHEMA-04 | Phase 47 | Complete |
| SCHEMA-05 | Phase 47 | Complete |
| I18N-01 | Phase 44 | Complete |
| I18N-02 | Phase 44 | Complete |
| PERF-01 | Phase 48 | Pending |
| PERF-02 | Phase 48 | Pending |

**Coverage:**
- v2.6 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-06 after Phase 46 completion*
