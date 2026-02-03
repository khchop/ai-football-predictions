# Phase 11: Redirect Optimization - Research

**Researched:** 2026-02-02
**Domain:** HTTP redirects, SEO noindex strategy, internal linking
**Confidence:** HIGH

## Summary

Phase 11 focuses on three SEO optimization areas that were identified in an Ahrefs audit but deferred from Phase 9:

1. **SEO-T08**: 118 redirects from `/matches/{uuid}` using temporary 307 status instead of permanent 301/308
2. **SEO-T09**: 34 league hub pages with noindex directives that should be indexed
3. **SEO-T10**: 111 orphan pages with no internal links

**Primary recommendation:** The 307 redirect issue is already resolved (Phase 9 implementation uses permanent redirects). Focus on verifying redirect status codes and addressing noindex/orphan page issues.

## Current State Analysis

### 1. Redirect Status Investigation (SEO-T08)

**Finding:** The 118 redirects mentioned in requirements likely stem from legacy `/matches/{uuid}` URLs redirecting to new slug-based URLs.

**Current Implementation (from Phase 9):**

```typescript
// src/app/matches/[id]/page.tsx (line 83)
if (match.slug && competition.id) {
  redirect(`/leagues/${competition.id}/${match.slug}`, RedirectType.replace);
}
```

**Analysis:**
- Phase 9-03 implemented this redirect using `RedirectType.replace`
- The plan specified `RedirectType.permanent` for 308 status
- Implementation uses `RedirectType.replace` instead
- Phase 9 verification flagged this as "UNCERTAIN" - needs HTTP status verification

**Critical Question:** Does `RedirectType.replace` return:
- 307 Temporary Redirect (problem - needs fix)
- 308 Permanent Redirect (correct - meets requirement)
- Client-side only (problem - no HTTP status)

**Next.js Documentation Context:**
- `redirect()` without type = 307 temporary (default)
- `permanentRedirect()` = 308 permanent
- `RedirectType.replace` = affects browser history, status code unclear
- `RedirectType.push` = affects browser history, status code unclear

**Evidence from Phase 9:**
```typescript
// next.config.ts uses permanent: true
{ source: '/leagues/premier-league/:path*', destination: '/leagues/epl/:path*', permanent: true }
// This returns 308 permanent redirect

// src/app/leagues/[slug]/page.tsx uses permanentRedirect()
permanentRedirect(`/leagues/${competition.id}`);
// This returns 308 permanent redirect
```

**Gap:** Legacy match page (src/app/matches/[id]/page.tsx) is the only place using `RedirectType.replace` instead of `permanentRedirect()`.

### 2. Noindex Pages Investigation (SEO-T09)

**Finding:** 34 league hub pages reportedly have noindex directives.

**Current League Page Metadata:**

```typescript
// src/app/leagues/[slug]/page.tsx (lines 69-73)
robots: {
  index: true,
  follow: true,
},
```

All league pages are currently set to `index: true`, meaning they should be indexed.

**Noindex Logic in Match Pages:**

```typescript
// src/lib/seo/metadata.ts (lines 84-90)
// Determine if match should be noindex (finished matches >30 days old)
let shouldNoIndex = false;
if (match.status === 'finished') {
  const matchDate = new Date(match.startDate);
  const daysSinceMatch = (Date.now() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
  shouldNoIndex = daysSinceMatch > 30;
}
```

Match pages older than 30 days get noindex, but league pages should not.

**Possible Causes of 34 Noindex Pages:**
1. **Historical issue**: Pages may have had noindex in past, Ahrefs cache not refreshed
2. **Dynamic generation**: Some league pages might be dynamically setting noindex (need to verify)
3. **Alias URLs**: Long-form URLs like `/leagues/premier-league` might have different metadata than canonical `/leagues/epl`
4. **Database-driven**: If league metadata comes from DB with noindex flag (unlikely based on code review)

**Verification Needed:**
- Test all league URLs for actual robots meta tag
- Check if alias URLs return different metadata
- Review historical commits for noindex implementation

### 3. Orphan Pages Investigation (SEO-T10)

**Finding:** 111 pages have no internal links pointing to them.

**What Pages Could Be Orphaned:**

1. **Model pages** (`/models/{id}`)
   - Currently linked from: leaderboard, match predictions
   - May not be linked from: league hubs, blog posts, methodology

2. **Old match pages** (finished >30 days ago)
   - Currently: No "related matches" widget
   - Currently: No "recent predictions" on league hubs
   - Currently: No cross-linking between same teams/competition

3. **Blog posts** (`/blog/{slug}`)
   - Currently: Footer links to /blog
   - May not be: Cross-linked between posts, linked from match pages

4. **Stats pages** (`/matches/{id}/stats`)
   - Exists in code but may not be linked from match pages
   - Check if link exists in match page UI

**Current Internal Linking:**

| Source | Target | Method | File |
|--------|--------|--------|------|
| Match card | Match detail | Link component | src/components/match-card.tsx:87-89 |
| Match page | Competition | Breadcrumb | src/app/leagues/[slug]/[match]/page.tsx |
| Leaderboard | Model detail | Link | src/components/leaderboard-table.tsx |
| Navigation | League hubs | Link | src/components/navigation.tsx |
| Footer | Static pages | Link | src/components/footer.tsx |
| League selector | League hubs | Link | src/components/league-selector.tsx |

**Missing Internal Links (Phase 12 scope but relevant):**
- Related matches (same teams, same competition)
- Recent predictions on league pages
- Model performance highlights on competition pages
- Cross-references in blog posts
- Stats page link from match detail page

## Root Cause Analysis

### Redirect Status Code Issue

**Why it exists:**
- Phase 9 implementation chose `RedirectType.replace` based on misunderstanding of Next.js API
- The plan called for `RedirectType.permanent` but implementation deviated
- No HTTP status verification was performed during Phase 9

**Impact:**
- If returning 307: Search engines treat as temporary, don't transfer PageRank
- If returning 308: Correct behavior, no action needed
- If client-side only: Invisible to crawlers, bad for SEO

**Fix complexity:** LOW - single line change if needed

### Noindex Pages Issue

**Why it exists:**
- Could be historical metadata that needs cleanup
- Could be Ahrefs cache showing outdated data
- Could be edge case in dynamic metadata generation

**Impact:**
- 34 league pages not indexed = missing valuable SEO traffic
- League hubs should be high-value pages (category pages in SEO terms)

**Fix complexity:** LOW if code already correct, verify and document

### Orphan Pages Issue

**Why it exists:**
- Site structure doesn't include "related content" sections
- No automated cross-linking between similar pages
- Blog posts don't link to relevant matches/models

**Impact:**
- 111 pages hard for crawlers to discover
- Lower crawl depth = less indexing priority
- Missed opportunity for internal link equity distribution

**Fix complexity:** MEDIUM - requires new UI components and linking logic

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redirect status detection | Custom HTTP testing | Next.js built-in `permanentRedirect()` | Standard pattern, clear semantics |
| Robots meta verification | Manual page checks | Automated metadata audit script | Scalable, repeatable |
| Orphan page detection | Custom crawler | Sitemap + internal link graph analysis | Sitemap is source of truth |
| Related content algorithm | Complex ML similarity | Simple competition/team matching | Sufficient for SEO needs |

## Solution Architecture

### Plan 11-01: Convert 307 Redirects to 301 Permanent

**Step 1:** Verify current redirect status
```bash
# Test legacy match redirect
curl -I https://kroam.xyz/matches/{some-uuid}
# Expected: 308 Permanent Redirect
# If 307: Need to fix
```

**Step 2:** Fix if needed
```typescript
// src/app/matches/[id]/page.tsx
// Change from:
redirect(`/leagues/${competition.id}/${match.slug}`, RedirectType.replace);

// To:
permanentRedirect(`/leagues/${competition.id}/${match.slug}`);
```

**Step 3:** Verify all redirects
- Check next.config.ts redirects (already use `permanent: true`)
- Check league page redirects (already use `permanentRedirect()`)
- Check match page redirects (already use `permanentRedirect()`)
- Only legacy match page needs verification/fix

**Complexity:** LOW
**Risk:** LOW - changing one redirect call
**Files:** 1 (src/app/matches/[id]/page.tsx)

### Plan 11-02: Fix Noindex Pages and Orphan Page Strategy

**Step 1:** Audit noindex status
```bash
# Fetch all league pages and check robots meta
for url in $(curl https://kroam.xyz/sitemap/leagues.xml | grep -oP '(?<=<loc>)[^<]+'); do
  curl -s "$url" | grep -i "robots" | grep -i "noindex"
done
```

**Step 2:** Verify league metadata
- Check all league pages return `index: true`
- Check alias URLs return same metadata as canonical
- Document findings

**Step 3:** Address orphan pages
Two approaches:

**Option A: Remove from sitemap (quick fix)**
- If pages aren't valuable, remove from sitemap
- They won't be crawled = no longer "orphan" issue
- Risk: Lose potential SEO value

**Option B: Add internal links (proper fix, Phase 12 scope)**
- Add "Related matches" widget to match pages
- Add "Recent predictions" to league hubs
- Add cross-links in blog posts
- Defer to Phase 12 requirements (SEO-T11, SEO-T12, SEO-T13)

**Recommendation for 11-02:**
1. Verify and document noindex status (quick)
2. Create strategy document for orphan pages (deferred to Phase 12)
3. Quick win: Add stats page link if missing from match detail page

**Complexity:** LOW to MEDIUM
**Risk:** LOW - mostly verification and documentation
**Files:** Various metadata files, possibly match page template

## Code Examples

### Fixing Legacy Match Redirect

```typescript
// src/app/matches/[id]/page.tsx

// Current (line 83):
redirect(`/leagues/${competition.id}/${match.slug}`, RedirectType.replace);

// Fixed:
permanentRedirect(`/leagues/${competition.id}/${match.slug}`);

// Import needed:
import { notFound, permanentRedirect } from 'next/navigation';
// Remove: import { redirect, RedirectType } from 'next/navigation';
```

### Verifying League Metadata

```typescript
// src/app/leagues/[slug]/page.tsx
// Already correct (lines 69-73):
robots: {
  index: true,  // ✓ Should be indexed
  follow: true, // ✓ Should follow links
},
```

### Adding Stats Link to Match Page (if missing)

```typescript
// src/app/leagues/[slug]/[match]/page.tsx
// Check if stats link exists in UI
// If not, add:
<Link href={`/matches/${match.id}/stats`}>
  View Detailed Statistics
</Link>
```

## Common Pitfalls

### Pitfall 1: Assuming Redirect Status Without Testing

**What goes wrong:** Code that looks correct might return wrong HTTP status
**Why it happens:** Next.js redirect APIs have subtle differences
**How to avoid:** Always test with curl -I or browser dev tools network tab
**Warning signs:** Ahrefs showing temporary redirects for supposedly permanent ones

### Pitfall 2: Confusing Browser History with HTTP Status

**What goes wrong:** `RedirectType.replace` affects browser, not necessarily HTTP
**Why it happens:** API naming suggests it controls redirect type
**How to avoid:** Use `permanentRedirect()` for SEO, clear semantic meaning
**Warning signs:** Client behavior correct but crawlers see different status

### Pitfall 3: Cached Noindex in Search Engines

**What goes wrong:** Pages were noindex historically, now indexed but Google hasn't refreshed
**Why it happens:** Search engine caches can persist for weeks
**How to avoid:** Request re-indexing via Search Console after fixing
**Warning signs:** Meta tag correct but Ahrefs still shows noindex

### Pitfall 4: Over-Engineering Orphan Detection

**What goes wrong:** Building complex internal link graph analysis
**Why it happens:** Interesting technical problem
**How to avoid:** Simple: pages in sitemap but not in any component's href
**Warning signs:** Days of work for what should be quick audit

## Files to Modify

### Primary Changes (11-01)

| File | Change | Complexity |
|------|--------|------------|
| src/app/matches/[id]/page.tsx | Change redirect to permanentRedirect | LOW |

### Verification Tasks (11-02)

| Task | Tool | Output |
|------|------|--------|
| Test all league pages | curl + grep | List of any with noindex |
| Test legacy redirects | curl -I | HTTP status codes |
| Find orphan pages | Sitemap + link audit | List of unlinked URLs |

### Documentation Updates

| File | Change | Complexity |
|------|--------|------------|
| .planning/STATE.md | Add Phase 11 decisions | LOW |
| Phase 11 SUMMARY | Document findings and fixes | LOW |

## Verification Checklist

After implementation:

**Redirect Verification:**
- [ ] Legacy match redirect returns 308 (not 307)
- [ ] League alias redirects return 308 (already verified in Phase 9)
- [ ] No 307 temporary redirects in entire site
- [ ] All redirects are single-hop (no chains)

**Noindex Verification:**
- [ ] All league hub pages return `index: true` in robots meta
- [ ] No unexpected noindex on important pages
- [ ] Match pages >30 days correctly have noindex
- [ ] Match pages <30 days correctly are indexed

**Orphan Page Strategy:**
- [ ] List of 111 orphan pages identified
- [ ] Strategy documented for Phase 12
- [ ] Quick wins implemented (if any)

## Open Questions

1. **Redirect Status Verification**
   - What we know: Code uses `RedirectType.replace`
   - What's unclear: Actual HTTP status returned (307 vs 308 vs client-only)
   - Recommendation: Test with curl immediately
   - Decision needed: Fix if 307, document if 308

2. **Noindex Page Count**
   - What we know: Ahrefs reports 34 pages with noindex
   - What's unclear: Which specific URLs, when data collected
   - Recommendation: Fresh audit of all league pages
   - Decision needed: If code correct, request Ahrefs re-crawl

3. **Orphan Page Scope**
   - What we know: 111 pages have no internal links
   - What's unclear: Which pages, are they valuable
   - Recommendation: Export list from Ahrefs, categorize
   - Decision needed: Fix now vs defer to Phase 12

4. **Stats Page Accessibility**
   - What we know: Stats pages exist at `/matches/{id}/stats`
   - What's unclear: Are they linked from match detail pages
   - Recommendation: Check match page UI for stats link
   - Decision needed: Add link if missing (quick SEO win)

## Prior Art and Decisions

### Phase 9 Decisions (relevant to Phase 11)

From STATE.md:
- Use 308 Permanent Redirect instead of 301 (Next.js permanentRedirect uses 308)
- Add aliases array to CompetitionConfig instead of separate mapping
- Query both competition.id and competition.slug in database for backward compatibility
- Edge-level redirects in next.config.ts for faster redirects before routing

**Implication for Phase 11:**
- Should use `permanentRedirect()` consistently (308 status)
- RedirectType.replace was deviation from plan, likely needs correction
- Edge-level redirects in next.config.ts already return 308

### Phase 10 Decisions (relevant to noindex)

From STATE.md:
- Use sr-only class for H1 tags to preserve visual design
- Title formats optimized for 60 char limit

**No noindex decisions mentioned** - suggests noindex logic was implemented earlier (Phase 7) and hasn't been modified.

## Sources

### Primary (HIGH confidence)
- Codebase investigation: All files in src/app/matches, src/app/leagues, src/lib/seo
- Phase 9 verification report: Explicitly flagged RedirectType.replace as uncertain
- Phase 9 implementation summary: Documents use of RedirectType.replace
- next.config.ts: Shows use of permanent: true for edge redirects
- Git history: Shows noindex implementation in Phase 7 (commit 6555b9e)

### Secondary (MEDIUM confidence)
- Requirements document: Lists 118 redirects, 34 noindex pages, 111 orphan pages
- Ahrefs audit: Source of SEO-T08, SEO-T09, SEO-T10 requirements
- Next.js documentation: permanentRedirect vs redirect vs RedirectType behavior

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Redirect code location | HIGH | Direct code inspection |
| Redirect status issue | MEDIUM | Need HTTP testing to confirm |
| Noindex code correctness | HIGH | Code review shows index: true |
| Noindex actual status | LOW | Need fresh audit of live pages |
| Orphan page problem | MEDIUM | Reported by Ahrefs, need verification |
| File changes needed | HIGH | Clear from code review |

## Metadata

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable patterns)
**Dependencies:** Phase 9 (completed), Ahrefs audit data
**Blocks:** Phase 12 (internal linking depends on orphan page strategy)
