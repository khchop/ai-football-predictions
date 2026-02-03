# Phase 9: Critical SEO Errors

## Goal

Eliminate all critical SEO errors: 500 errors, 404 pages in sitemap, and broken redirect chains.

## Requirements

- **SEO-T01**: Fix 500 error on Genoa vs Bologna match page
- **SEO-T02**: Fix broken redirect chain leading to 500 error
- **SEO-T03**: Create league index pages for long-form slugs (7 404s)
- **SEO-T04**: Update internal links to use correct league slugs (128 pages)

## Issues Found (from Ahrefs audit)

### 500 Errors (1 page)
- `/leagues/seriea/genoa-vs-bologna-2026-01-25` — Server error, needs debugging

### Broken Redirect (1 chain)
- Redirect chain that ultimately leads to the 500 error page

### 404 Pages in Sitemap (7 pages)
These URLs are in sitemap but return 404:
- `/leagues/premier-league`
- `/leagues/la-liga`
- `/leagues/bundesliga`
- `/leagues/serie-a`
- `/leagues/ligue-1`
- `/leagues/champions-league`
- `/leagues/europa-league`

**Root cause**: Valid competition IDs are short slugs (`epl`, `laliga`, `bundesliga`, etc.) but sitemap/content config uses long-form slugs.

### Links to 404 Pages (128 pages)
Match pages have breadcrumbs or navigation linking to the non-existent long-form league URLs.

## Technical Context

### Competition Slugs (src/lib/football/competitions.ts)
```
ucl -> UEFA Champions League
uel -> UEFA Europa League
epl -> Premier League
laliga -> La Liga
bundesliga -> Bundesliga
seriea -> Serie A
ligue1 -> Ligue 1
```

### Content Config (src/lib/content/config.ts)
Uses long-form slugs: `premier-league`, `champions-league`, etc.

### Solution Options

1. **Add slug aliases to competition config** — Support both short and long-form slugs
2. **Create redirect rules** — Redirect long-form to short-form
3. **Update sitemap generation** — Use correct short slugs

Recommended: Option 1 (aliases) for best SEO (no redirect chain) + Option 2 (redirects) for legacy URL support.

## Success Criteria

- [ ] Zero 500 errors on any page
- [ ] Zero 404s in sitemap
- [ ] All internal links resolve to valid pages
- [ ] Ahrefs re-crawl shows critical issues resolved
