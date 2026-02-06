# Phase 44: Foundation — Redirects, Canonicals & Index Pages - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix critical SEO plumbing: remove cascading canonical from root layout, remove broken hreflang, create /models and /leagues index pages, fix www/protocol redirects. This phase establishes the SEO foundation that all subsequent phases (sitemap, meta tags, structured data) build on.

</domain>

<decisions>
## Implementation Decisions

### Index page content
- `/leagues` and `/models` pages need to return 200 with listing content (currently 404)
- Layout and content density: Claude's discretion based on existing design patterns
- Include a short intro paragraph (1-2 sentences) for SEO/GEO purposes on each index page
- Use Static Generation with ISR (Incremental Static Regeneration) for both pages

### Redirect behavior
- Handle www → non-www and HTTP → HTTPS redirects in Next.js middleware (not infrastructure)
- Collapse redirect chains into a single hop — middleware detects all issues in one pass and redirects to the final canonical URL directly
- Old `/matches/UUID` URLs: respond with 410 Gone (not redirect) — these URLs are permanently removed
- The PERF-02 requirement (redirect responds within 500ms) from Phase 48 applies to these redirects

### Canonical URL strategy
- Root layout canonical and per-page canonical approach: Claude's discretion based on Ahrefs findings and SEO best practices
- Trailing slash handling: Claude's discretion based on existing URL patterns in the codebase
- Query parameter handling in canonicals: Claude's discretion based on which params affect page content
- Canonical URLs must use the short-form league slug (e.g., `/leagues/premier-league`) even if accessed via a longer form

### Hreflang removal
- Remove all hreflang tags site-wide — no i18n plans for the foreseeable future
- Complete removal, not partial — strip from all page types
- Keep `html lang="en"` attribute — standard accessibility practice

### Claude's Discretion
- /leagues page layout and content density (simple list vs cards with stats)
- /models page layout and content density (simple list vs cards with performance)
- Root canonical strategy (remove entirely vs per-page override)
- Trailing slash convention
- Query parameter stripping in canonicals

</decisions>

<specifics>
## Specific Ideas

- Single-hop redirects: if a request hits both www and HTTP issues, resolve to the final `https://kroam.xyz/...` URL in one redirect
- 410 Gone for /matches/UUID rather than redirecting — clean break from old URL structure
- Short-form slugs as the canonical form for all league URLs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-foundation-redirects-canonicals-index-pages*
*Context gathered: 2026-02-06*
