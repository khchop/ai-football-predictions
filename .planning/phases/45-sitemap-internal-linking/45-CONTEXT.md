# Phase 45: Sitemap & Internal Linking - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean sitemaps with proper URL structure, eliminate orphan pages, and create cross-linking widgets between models/leagues/matches so every page is discoverable. Covers sitemap generation, internal link architecture, orphan page rescue, and canonical slug enforcement.

</domain>

<decisions>
## Implementation Decisions

### Sitemap structure
- Split by page type: separate sitemaps for leagues, models, matches, blog posts, static pages
- Sitemap index at /sitemap.xml referencing all sub-sitemaps
- Use lastmod from most recent prediction or result update timestamp
- Include priority/changefreq values — higher for league hubs and recent matches, lower for old matches and static pages
- Include ALL matches (no time-based filtering) — maximize indexed pages
- No /matches/UUID URLs in any sitemap

### Cross-linking widgets
- Model pages link to BOTH recent predictions (match pages) AND leagues covered
- League pages show top 5 most accurate models for that league with links to model pages
- Match pages link to ALL models that made predictions for that match
- Visual style: Claude's discretion based on existing design system and page context

### Orphan page rescue
- Link sources for model pages: leaderboard page + /models index + league pages (top-5 section) — covers 3+ inbound links
- Build-time audit script that crawls internal links and reports any page with <3 inbound links
- Audit ALL page types (models, leagues, matches, blog) — not just model pages
- Threshold: 3+ inbound links for all page types — consistent standard

### Link format & slugs
- Create centralized link helper (getInternalUrl) for ALL internal link types — not just league slugs
- One-time cleanup: find-and-replace all existing long-form league slugs in source code
- Audit script cross-validates sitemap URLs match canonical slug forms — no redirect-triggering URLs in sitemaps
- Audit script runs as part of build — build fails if orphan pages or bad slugs detected

### Claude's Discretion
- Cross-linking widget visual design (cards, lists, sections — match existing design system)
- Exact number of recent predictions to show on model pages
- Sitemap priority/changefreq exact values per page type
- Internal link audit script implementation approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: build must fail on link quality issues.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-sitemap-internal-linking*
*Context gathered: 2026-02-06*
