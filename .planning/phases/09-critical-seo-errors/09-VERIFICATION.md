---
phase: 09-critical-seo-errors
verified: 2026-02-02T15:45:00Z
status: human_needed
score: 11/12 must-haves verified
human_verification:
  - test: "Test legacy match redirect with curl"
    expected: "Permanent redirect (308) from /matches/{uuid} to /leagues/{id}/{slug}"
    why_human: "RedirectType.replace is client-side, need to verify actual HTTP status code"
  - test: "Test long-form league URLs"
    expected: "308 redirect from /leagues/premier-league to /leagues/epl"
    why_human: "Verify edge-level redirects work as expected in production"
  - test: "Verify no 404s in sitemap"
    expected: "All sitemap URLs return 200 OK"
    why_human: "Need to crawl sitemap and verify all URLs resolve"
  - test: "Test Genoa vs Bologna match page"
    expected: "Returns 404 or 200, not 500"
    why_human: "Need to verify specific match mentioned in requirements"
---

# Phase 9: Critical SEO Errors Verification Report

**Phase Goal:** Eliminate 500 errors, 404s in sitemap, and broken redirects
**Verified:** 2026-02-02T15:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | /leagues/epl returns 200 with Premier League content | ✓ VERIFIED | Page component exists, uses getCompetitionByIdOrAlias('epl'), returns competition |
| 2 | /leagues/premier-league redirects to /leagues/epl with 301 | ✓ VERIFIED | next.config.ts has permanent redirect + app-level permanentRedirect() |
| 3 | /leagues/ucl returns 200 with Champions League content | ✓ VERIFIED | Same implementation as epl, config has ucl entry |
| 4 | /leagues/champions-league redirects to /leagues/ucl with 301 | ✓ VERIFIED | next.config.ts has permanent redirect + app-level permanentRedirect() |
| 5 | Match pages under alias slugs redirect to canonical URLs | ✓ VERIFIED | Match page has permanentRedirect when slug !== competition.id (line 92) |
| 6 | Sitemap at /sitemap/leagues.xml lists only canonical short-form URLs | ✓ VERIFIED | Uses COMPETITIONS config, filters to competition.id |
| 7 | Match sitemap URLs use competition.id not database slug | ✓ VERIFIED | Query selects competitions.id, URL uses competitionId |
| 8 | Match card links use /leagues/{competition.id}/{match-slug} format | ✓ VERIFIED | match-card.tsx line 87-89 uses competition.id |
| 9 | No internal links point to long-form league slugs | ✓ VERIFIED | Grep shows no URL generation using competition.slug |
| 10 | /matches/{uuid} redirects to /leagues/{competition.id}/{match-slug} with 301 | ? UNCERTAIN | Uses RedirectType.replace (line 83), need to verify actual HTTP status |
| 11 | No redirect chains exist (single hop from alias to canonical) | ✓ VERIFIED | All redirects use competition.id directly, no intermediate hops |
| 12 | 500 error on Genoa vs Bologna page is resolved or identified as data issue | ✓ VERIFIED | Defensive error handling added (try/catch, notFound on failure) |
| 13 | All redirects are permanent (301/308) not temporary (307) | ? UNCERTAIN | next.config permanent:true ✓, permanentRedirect() ✓, but RedirectType.replace unclear |

**Score:** 11/13 truths verified, 2 need human testing

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/lib/football/competitions.ts | Alias lookup function and aliases field | ✓ VERIFIED | aliases field present (lines 12, 33, 42, 64, 74, 93, 103), getCompetitionByIdOrAlias exported (lines 195-202), 214 lines substantive, exported and imported 8 times |
| src/app/leagues/[slug]/page.tsx | League page with alias support and canonical redirect | ✓ VERIFIED | Uses getCompetitionByIdOrAlias (line 20, 101), permanentRedirect on alias (line 109), 137 lines substantive, imported from league-hub-content |
| src/app/leagues/[slug]/[match]/page.tsx | Match page with alias support | ✓ VERIFIED | Uses getCompetitionByIdOrAlias (line 11, 88, 458, 486), permanentRedirect on alias (line 92), 532 lines substantive, defensive error handling present |
| src/app/sitemap/leagues.xml/route.ts | Sitemap generating canonical league URLs from static config | ✓ VERIFIED | Imports COMPETITIONS (line 2), uses competition.id in URLs (line 15), 38 lines substantive |
| src/components/match-card.tsx | Match card with corrected link URLs | ✓ VERIFIED | Uses competition.id for URL (line 87-89), 348 lines substantive, imported in multiple pages |
| src/app/matches/[id]/page.tsx | Legacy match page with corrected redirect URL | ⚠️ PARTIAL | Uses competition.id (line 83), but RedirectType.replace may not be 308 permanent redirect, 157 lines substantive |
| next.config.ts | Redirect rules for legacy long-form URLs | ✓ VERIFIED | Contains 6 permanent redirects (lines 22-27), permanent: true flag set, 42 lines substantive |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| src/app/leagues/[slug]/page.tsx | getCompetitionByIdOrAlias | import and call | ✓ WIRED | Imports line 4, calls line 20 and 101, result used for redirect check |
| src/app/sitemap/leagues.xml/route.ts | COMPETITIONS | import from competitions.ts | ✓ WIRED | Imports line 2, used line 12-14 to generate URLs |
| src/components/match-card.tsx | competition.id | URL construction | ✓ WIRED | Uses competition.id in template literal line 88, rendered in href line 92 |
| src/app/matches/[id]/page.tsx | /leagues/{id}/{slug} | redirect call | ✓ WIRED | Redirect call line 83 with competition.id, triggered on line 82 condition |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SEO-T01: Fix 500 error on Genoa vs Bologna match page | ✓ VERIFIED | Defensive error handling added with try/catch blocks, database errors return 404 not 500, supplementary queries degrade gracefully |
| SEO-T02: Fix broken redirect chain | ✓ VERIFIED | All redirects use competition.id directly, no intermediate hops through long-form slugs |
| SEO-T03: Create league index pages for long-form slugs | ✓ VERIFIED | Alias system + redirects make long-form slugs work, sitemap uses only canonical URLs |
| SEO-T04: Update internal links to use correct league slugs | ✓ VERIFIED | Match cards, match pages, sitemaps all use competition.id, no competition.slug in URL generation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

**Notes:**
- No TODO/FIXME comments found in critical files
- No placeholder content or stub patterns detected
- No console.log-only implementations
- All files substantive with proper implementations

### Human Verification Required

#### 1. Verify Legacy Match Redirect HTTP Status

**Test:** 
```bash
curl -IL http://localhost:3000/matches/{valid-uuid}
# Or in production:
curl -IL https://kroam.xyz/matches/{valid-uuid}
```

**Expected:** HTTP 308 Permanent Redirect to /leagues/{id}/{slug}

**Why human:** The code uses `RedirectType.replace` (line 83 of src/app/matches/[id]/page.tsx). According to Next.js documentation:
- `RedirectType.replace` replaces current history entry (client-side behavior)
- `RedirectType.push` adds new history entry
- Neither explicitly guarantees 308 HTTP status code

The plan (09-03-PLAN.md line 77-79) required using `redirect(url, RedirectType.permanent)` for 308 redirects. The summary claims "RedirectType.replace provides permanent redirect semantic" but this needs verification.

**Possible gap:** If RedirectType.replace does NOT return 308, this violates SEO-T02 requirement for permanent redirects.

#### 2. Verify Edge-Level Redirects Work

**Test:**
```bash
# Test each long-form URL redirect
curl -IL https://kroam.xyz/leagues/premier-league
curl -IL https://kroam.xyz/leagues/champions-league
curl -IL https://kroam.xyz/leagues/europa-league
curl -IL https://kroam.xyz/leagues/la-liga
curl -IL https://kroam.xyz/leagues/serie-a
curl -IL https://kroam.xyz/leagues/ligue-1
```

**Expected:** Each returns HTTP 308 Permanent Redirect to short-form canonical URL

**Why human:** next.config.ts redirects with `permanent: true` should return 308, but need to verify this works in deployed environment (may differ in dev vs production).

#### 3. Verify Sitemap Contains No 404s

**Test:**
1. Fetch sitemap: `curl https://kroam.xyz/sitemap/leagues.xml`
2. Extract all URLs from XML
3. Test each URL: `curl -I {url}` and verify returns 200 OK

**Expected:** All URLs in sitemap return 200, no 404s

**Why human:** Need to verify generated sitemap URLs actually resolve. Code looks correct (uses COMPETITIONS config with competition.id) but need end-to-end verification.

#### 4. Test Genoa vs Bologna Specific Match

**Test:**
```bash
curl -I https://kroam.xyz/leagues/seriea/genoa-vs-bologna-2026-01-25
```

**Expected:** Returns 404 (not found) or 200 (if match exists), NOT 500 (server error)

**Why human:** This specific match was mentioned in SEO-T01. Need to verify the defensive error handling prevents 500 errors for this URL.

---

## Summary

### Strengths

1. **Comprehensive alias system:** All 6 competitions with slug mismatches have aliases configured
2. **Dual-layer redirects:** Both edge-level (next.config.ts) and application-level (permanentRedirect) ensure aliases work
3. **Defensive error handling:** Extensive try/catch blocks prevent database failures from causing 500 errors
4. **Consistent URL generation:** All internal links use competition.id, no URL generation uses competition.slug
5. **Sitemap quality:** League sitemap uses static config as source of truth, match sitemap queries competition.id
6. **No stub patterns:** All implementations substantive with real logic, no TODOs or placeholders

### Potential Gap

**RedirectType.replace in legacy match page (src/app/matches/[id]/page.tsx line 83):**

The plan specified using `RedirectType.permanent` for 308 redirects, but the implementation uses `RedirectType.replace`. The summary claims this "provides permanent redirect semantic" but:

1. Next.js docs indicate `RedirectType.replace` is for history API replacement, not HTTP status control
2. For SEO, need actual HTTP 308/301, not just client-side history manipulation
3. Plan 09-03 task 1 explicitly called for `redirect(url, RedirectType.permanent)`

**If this is confirmed to NOT return 308:** This would be a gap blocking full achievement of SEO-T02 and SEO-T08.

**If this IS confirmed to return 308:** Then it's just a documentation/naming confusion, and the implementation is correct.

### Recommendations

1. **Immediate:** Test legacy match redirect HTTP status to confirm 308
2. **If gap confirmed:** Change line 83 to use `permanentRedirect()` or `redirect(url, RedirectType.permanent)` 
3. **Post-deployment:** Monitor Ahrefs/Google Search Console for:
   - 404 count drop from 7 to 0
   - Internal link error count drop from 128 to 0
   - No redirect chain warnings
   - No 500 errors on match pages

### Human Testing Checklist

- [ ] Test legacy match redirect returns 308 (not 307 or client-side only)
- [ ] Test all 6 long-form league URLs redirect with 308
- [ ] Crawl league sitemap and verify all URLs return 200
- [ ] Test Genoa vs Bologna match page doesn't return 500
- [ ] Verify no redirect chains exist (max 1 hop)
- [ ] Confirm internal match card links use canonical URLs

---

_Verified: 2026-02-02T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
