# Domain Pitfalls: SEO/GEO Site Health Fixes

**Domain:** Technical SEO fixes for Next.js 16 sports prediction platform
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This research focuses on pitfalls specific to fixing 24 SEO issues on an EXISTING production Next.js 16 site. The platform already has well-structured SEO primitives. The key risks are:

1. **Breaking existing redirects** while fixing redirect architecture (production traffic at risk)
2. **Canonical conflicts** between root layout and page-level metadata
3. **Structured data regressions** when fixing validation errors (breaking what works)
4. **Hreflang misconfiguration** making i18n worse than no i18n
5. **Sitemap changes triggering re-crawl storms** that temporarily hurt rankings

---

## Critical Pitfalls

### Pitfall 1: Meta Refresh vs permanentRedirect() Confusion

**Risk:** HIGH | **Likelihood:** Already encountered
**Category:** Misdiagnosis

**The trap:** Ahrefs reports 172 pages with meta refresh, but codebase shows `/matches/[id]/page.tsx` already uses `permanentRedirect()`. This could mean:
1. Ahrefs cached old crawl data (before recent fix)
2. The permanentRedirect runs after a client-side render (React hydration sends HTML first)
3. A different code path serves meta refresh in some conditions

**Why it matters:** If you "fix" meta refresh that's already fixed, you waste effort. If you assume it's fixed when it's not, the biggest SEO issue persists.

**Mitigation:**
- Verify production behavior with `curl -I https://kroam.xyz/matches/[known-uuid]` — check for HTTP 308
- If 308 confirmed, re-crawl with Ahrefs to update stale data
- If meta refresh still present, investigate SSR vs CSR rendering path

**Evidence:** Ahrefs sometimes caches crawl results for days/weeks. Particularly common after recent code changes.

---

### Pitfall 2: Canonical Tag Cascading in App Router Layouts

**Risk:** HIGH | **Likelihood:** HIGH (matches reported issue)
**Category:** Architecture

**The trap:** In Next.js App Router, metadata from parent layouts merges with child page metadata. If `src/app/layout.tsx` (root layout) sets a canonical URL, it can cascade to all child pages unless explicitly overridden.

**Specific scenario:**
```typescript
// Root layout (src/app/layout.tsx) - currently has:
metadata = {
  alternates: {
    canonical: 'https://kroam.xyz',  // ← This cascades!
    languages: { ... }
  }
}

// Match page tries to override:
export async function generateMetadata() {
  return {
    alternates: {
      canonical: '/leagues/epl/some-match'  // ← May NOT override
    }
  }
}
```

**Why it matters:** This is likely the root cause of 177 match pages with canonical pointing to `/`. The root layout's canonical cascades because Next.js metadata merging may not deeply override `alternates`.

**Mitigation:**
- Remove `canonical` from root layout metadata (let each page set its own)
- Or use `metadataBase` + relative canonicals in each page
- Test with `next build` + verify HTML output for canonical tags
- Reference: Next.js metadata merging docs — `alternates` is shallow-merged

---

### Pitfall 3: Removing Structured Data Instead of Fixing It

**Risk:** MEDIUM | **Likelihood:** MEDIUM
**Category:** Over-correction

**The trap:** When faced with 4365 structured data errors, the temptation is to simplify schemas or remove entities. This destroys rich result eligibility.

**Specific risks:**
1. Removing FAQPage schema eliminates FAQ rich results
2. Removing SportsEvent schema eliminates event rich results
3. Simplifying @graph pattern breaks entity relationships
4. Removing Article schema hurts GEO (freshness signals)

**Why it matters:** Rich results drive 20-30% higher CTR. Fixing errors is better than removing schemas.

**Mitigation:**
- Fix errors one entity type at a time
- Use Schema.org validator to test each entity independently
- Keep @graph pattern (it's correct architecture)
- Common fixes: add missing `name` property, fix date formats, use correct @type values
- Test with Google Rich Results Test after each entity fix

---

### Pitfall 4: Hreflang Pointing to Non-Functional Subdomains

**Risk:** HIGH | **Likelihood:** ALREADY HAPPENING
**Category:** Active harm

**The trap:** The root layout declares hreflang alternates for es/fr/it/de.kroam.xyz, but these subdomains return 503. This is **actively harming SEO** because:
1. Google sees hreflang pointing to broken URLs → treats as misconfiguration
2. May apply penalties for misleading international targeting
3. Wastes crawl budget on 503 responses
4. Creates confusion about which version is canonical

**Why it matters:** It's worse than having no hreflang at all. Google may devalue the entire domain's international signals.

**Mitigation:**
- **Immediate:** Remove language alternates from root layout metadata
- **Do NOT** install next-intl until subdomains actually serve content
- **Do NOT** fix robots.txt on subdomains — fix the root cause (no content) first
- Add hreflang back only when translations are ready

---

### Pitfall 5: Breaking Redirect Chains While Fixing Individual Redirects

**Risk:** MEDIUM | **Likelihood:** MEDIUM
**Category:** Regression

**The trap:** The current redirect flow is:
```
http://www.kroam.xyz → (302) → https://www.kroam.xyz → (302) → https://kroam.xyz
```
If you fix the first hop (301) but not the second, or vice versa, you still have a chain. If you fix both independently, you might create a different chain.

**Why it matters:** Redirect chains waste crawl budget and lose PageRank at each hop (~15% loss per redirect).

**Mitigation:**
- Fix at infrastructure level (Coolify) to go directly: http://www.kroam.xyz → (301) → https://kroam.xyz
- Single-hop redirect, not two-hop
- Test all entry points: http://kroam.xyz, http://www.kroam.xyz, https://www.kroam.xyz
- Verify with `curl -IL` to trace full redirect chain

---

### Pitfall 6: Sitemap Changes Triggering Crawl Budget Storms

**Risk:** MEDIUM | **Likelihood:** LOW
**Category:** Timing

**The trap:** When you simultaneously:
1. Remove 172 non-canonical URLs from sitemaps
2. Add new index pages to sitemaps
3. Create sitemap index file

Google may re-crawl aggressively, temporarily increasing server load and potentially discovering pages in transition states.

**Why it matters:** Temporary 500 errors during heavy crawling can hurt rankings more than the original sitemap issues.

**Mitigation:**
- Stage sitemap changes over 2-3 deploys, not all at once
- Deploy sitemap index first (pointing to existing sitemaps)
- Then clean up match sitemaps (remove non-canonical URLs)
- Then add new pages to sitemaps
- Monitor Google Search Console crawl stats after each change

---

### Pitfall 7: Duplicate Organization Schema

**Risk:** LOW | **Likelihood:** CONFIRMED
**Category:** Schema conflict

**The trap:** The root layout (`src/app/layout.tsx`) embeds Organization, WebSite, and SoftwareApplication schemas. The `MatchPageSchema.tsx` also includes Organization and WebSite in its @graph. This means match pages have **duplicate** Organization and WebSite schemas.

**Why it matters:** Google may pick the wrong one, or flag as structured data error. This could account for some of the 2834 Rich Results errors.

**Mitigation:**
- Remove Organization and WebSite from root layout (let MatchPageSchema handle it)
- Or remove from MatchPageSchema (let root layout handle it)
- Ensure single source of truth with consistent @id references
- The @graph pattern with @id references is correct — just ensure no duplicates

---

### Pitfall 8: Internal Link Updates Breaking Existing URLs

**Risk:** LOW | **Likelihood:** LOW
**Category:** Regression

**The trap:** When updating internal links from long-form slugs (premier-league) to short-form (epl), if you miss the slug mapping or use wrong IDs, links break.

**Why it matters:** Broken internal links are worse than redirect links. A 404 is worse than a 308.

**Mitigation:**
- Use the `getCompetitionByIdOrAlias()` function to validate all slug mappings
- Test all link changes against COMPETITIONS config
- Keep redirect rules in next.config.ts as safety net (they catch old long-form URLs)
- Verify with automated link checker after deployment

---

### Pitfall 9: H1 Tag Duplication or Conflict with Title

**Risk:** LOW | **Likelihood:** MEDIUM
**Category:** Content

**The trap:** When adding H1 tags to 350 match pages, if the H1 duplicates the `<title>` tag exactly, Google may see it as thin content. If H1 conflicts with title, it confuses topic signals.

**Why it matters:** H1 should complement the title, not duplicate it. Title is for SERP display, H1 is for on-page structure.

**Mitigation:**
- Title: "Man Utd vs Liverpool AI Prediction | 35 Models | kroam.xyz"
- H1: "Manchester United vs Liverpool" (full names, no branding)
- Keep H1 simple: "{HomeTeam} vs {AwayTeam}" with optional score for finished matches
- Don't include model count or branding in H1

---

### Pitfall 10: Noindex on Redirect Pages Conflicting with 308

**Risk:** LOW | **Likelihood:** LOW
**Category:** Redundancy

**The trap:** `/matches/[id]/page.tsx` sets both `robots: { index: false }` AND returns a 308 redirect. The noindex is redundant because:
1. 308 redirects don't render page content
2. Google follows the redirect, doesn't index the source
3. The noindex meta tag may never be seen by crawlers

**Why it matters:** While not harmful, it indicates confusion about the redirect mechanism. If the page somehow renders (e.g., JavaScript error prevents redirect), the noindex provides a safety net.

**Mitigation:**
- Keep noindex as safety net, but don't rely on it
- The redirect is the primary mechanism
- If Ahrefs reports these as "noindex pages," it's because it processed the HTML before following the redirect — expected behavior for JS-rendered redirects

---

## Risk Priority Matrix

| Pitfall | Risk | Likelihood | Impact | Priority |
|---------|------|------------|--------|----------|
| #2 Canonical cascading | HIGH | HIGH | 177 pages | Fix first |
| #4 Hreflang to 503 | HIGH | CONFIRMED | All pages | Fix first |
| #1 Meta refresh confusion | HIGH | MEDIUM | 172 pages | Verify first |
| #5 Redirect chain breakage | MEDIUM | MEDIUM | All traffic | Fix carefully |
| #3 Removing structured data | MEDIUM | MEDIUM | Rich results | Fix incrementally |
| #7 Duplicate schemas | LOW | CONFIRMED | Match pages | Fix with #3 |
| #6 Sitemap crawl storm | MEDIUM | LOW | Temporary | Stage deploys |
| #8 Link slug errors | LOW | LOW | Internal nav | Test thoroughly |
| #9 H1/title duplication | LOW | MEDIUM | Content quality | Design carefully |
| #10 Noindex + redirect | LOW | LOW | None | Keep as safety net |

---

## Verification Checklist (Pre-Deploy)

For each phase of fixes, verify:

- [ ] `curl -I https://kroam.xyz/matches/[uuid]` returns 308 (not 200 with meta refresh)
- [ ] `curl -s https://kroam.xyz/leagues/epl/[match] | grep canonical` shows correct URL
- [ ] `curl -s https://kroam.xyz/leagues/epl/[match] | grep hreflang` shows nothing (after removal)
- [ ] `curl -IL http://www.kroam.xyz` shows single 301 hop to https://kroam.xyz
- [ ] Schema.org validator returns 0 errors for match page JSON-LD
- [ ] Google Rich Results Test shows eligible result types
- [ ] Sitemap index at /sitemap.xml returns valid XML
- [ ] No /matches/UUID URLs in any sitemap

---

## Sources

- Codebase analysis: src/lib/seo/, src/app/layout.tsx, src/middleware.ts
- Google: Canonical tag best practices (https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- Google: Hreflang best practices (https://developers.google.com/search/docs/specialty/international/localized-versions)
- Ahrefs: Meta refresh redirect documentation (https://help.ahrefs.com/en/articles/2433739)
- Next.js: Metadata merging behavior (https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging)
- Schema.org: @graph pattern (https://schema.org/docs/howwework.html)
