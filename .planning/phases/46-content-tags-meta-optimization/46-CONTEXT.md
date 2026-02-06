# Phase 46: Content Tags & Meta Optimization - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix H1 tags, meta descriptions, title lengths, and Open Graph tags across all page types. Add CollectionPage structured data to /leagues and /models index pages. Add build-time validation for meta tag compliance. This phase does NOT add new pages or features — it optimizes metadata on existing pages to pass Ahrefs audit checks.

</domain>

<decisions>
## Implementation Decisions

### Title tag formulas
- Match pages: `{Home} vs {Away} Prediction | Kroam`
- League pages: `{League} AI Predictions | Kroam`
- Model pages: `{Model} Football Predictions | Kroam`
- All titles must stay under 60 characters
- When title exceeds 60 chars due to long names, drop the ` | Kroam` suffix rather than abbreviating names

### Meta description formulas
- Match pages: AI prediction focus — template like "Get AI predictions for {Home} vs {Away} from 42 models. See scores, analysis, and betting insights for {League}."
- Descriptions must be 100-160 characters
- When descriptions would be too short (under 100 chars), pad with generic supplementary text to reach minimum length
- Blog posts, league pages, model pages all follow the same 100-160 char rule

### H1 tag strategy
- Match pages: `{Home} vs {Away} Prediction`
- League pages: `{League} Predictions`
- Model pages: `{Model} Football Predictions`
- Strict one H1 per page — audit all pages and demote any extra H1s to H2
- Blog posts must also have exactly one H1 (the post title)

### Open Graph images
- Dynamic OG image generation for ALL page types (match, league, model, blog, leaderboard, homepage)
- Text-on-gradient style — page title/key info overlaid on a branded gradient background
- Dark theme: navy/charcoal gradient with light text — professional, data/analytics vibe
- Pages without a dynamic template fall back to a generic Kroam branded image
- Use @vercel/og or Next.js built-in OG image generation

### OG tag completeness
- All indexable pages must have: og:title, og:description, og:image, og:url
- og:title and og:description should match the page's title and meta description
- og:url should be the canonical URL

### Build-time validation
- Extend existing Phase 45 audit script to validate meta tag lengths
- Check title tags (max 60 chars), meta descriptions (100-160 chars)
- Check H1 count (exactly 1 per page type)
- Fail build on violations (same severity model as sitemap audit)

### Blog content enforcement
- Blog posts follow the same title (60 char) and description (100-160 char) limits as all other pages
- LLM-generated blog content must comply — truncate or adjust at generation time if needed

### Claude's Discretion
- Exact gradient colors and OG image typography/spacing
- How to structure the @vercel/og route handlers
- CollectionPage structured data schema details for /leagues and /models
- Homepage and leaderboard H1 text (follow same keyword patterns)
- Specific padding text templates for short descriptions

</decisions>

<specifics>
## Specific Ideas

- Title pattern is consistent: `{Entity} {Keyword} | Kroam` with suffix dropped when too long
- H1 pattern mirrors title but without the ` | Kroam` branding suffix
- OG images should look good in dark social media feeds (Twitter/X, Discord, Slack)
- Build-time audit creates a safety net so meta tag regressions are caught before deploy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-content-tags-meta-optimization*
*Context gathered: 2026-02-06*
