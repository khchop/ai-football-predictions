# Phase 70: Navigation & Cross-Linking - Research

**Researched:** 2026-02-11
**Domain:** Next.js Link component, internal linking, SEO navigation patterns, accessibility
**Confidence:** HIGH

## Summary

Phase 70 adds clickable team names to league pages, match pages, and standings tables to enable user navigation to team detail pages created in Phase 69. This is pure integration work—no new infrastructure needed.

The technical domain is straightforward: wrap team names in Next.js Link components pointing to `/teams/[slug]` URLs, using the team slug mapping established in Phase 67. The codebase already has comprehensive breadcrumb infrastructure (Phase 68-01) and URL generation utilities (`src/lib/navigation/urls.ts`).

Internal linking SEO best practices for 2026 emphasize that strategic anchor text (team names) tells search engines what the linked page is about, improving topical authority and crawl depth. Next.js Link components provide automatic prefetching and client-side navigation, making clickable team names feel instant while preserving SEO benefits.

**Primary recommendation:** Use Next.js Link component to wrap team names in three key locations: (1) standings table team names, (2) match card team names/badges, and (3) match detail page team names. Use the existing `getTeamByIdOrAlias()` helper to resolve database team names to URL slugs. Follow established breadcrumb patterns for team page internal links back to leagues and matches.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/link | 16.1.5 | Internal navigation component | Next.js built-in, automatic prefetching, client-side transitions, SEO-friendly |
| @/lib/football/teams | N/A | Team name to slug mapping | Phase 67 infrastructure, canonical slug resolution |
| @/lib/navigation/urls | N/A | Centralized URL generation | Enforces canonical URLs, prevents redirect chains |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/navigation/breadcrumb-utils | N/A | Breadcrumb generation | Team page navigation back to leagues |
| @/components/navigation/breadcrumbs | N/A | Visual breadcrumb display | Phase 68-01 component, consistent hierarchy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js Link | HTML `<a>` tag | `<a>` tags work but miss prefetching, client-side nav, and Next.js router integration. Always use Link for internal navigation. |
| Manual slug construction | `getInternalUrl()` helper | Manual strings risk typos and alias bugs. Use centralized URL helper for consistency. |
| onClick navigation | useRouter().push() | onClick navigation works but misses right-click/cmd-click behavior. Link components support all user interaction patterns. |

**Installation:**
Already installed (zero new dependencies required).

## Architecture Patterns

### Recommended Component Structure
```
Components to modify (adding team links):
src/
├── app/
│   └── leagues/
│       └── [slug]/
│           └── league-hub-content.tsx    # Standings table team names
├── components/
│   ├── match-card.tsx                     # Team names in match cards
│   └── match/
│       └── match-layout.tsx               # Match detail team names
└── lib/
    └── navigation/
        ├── breadcrumb-utils.ts            # Team breadcrumbs (exists)
        └── urls.ts                         # URL helpers (exists)
```

### Pattern 1: Clickable Team Names in Standings Table
**What:** Wrap team names in standings with Link to team detail page
**When to use:** League standings tables, group tables, any team listing
**Example:**
```typescript
// Source: Context7 Next.js Link patterns + existing standings implementation
import Link from 'next/link';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

// In LeagueStandingsTable component (src/app/leagues/[slug]/league-hub-content.tsx lines 113-163)
{standings.map((team) => {
  const teamConfig = getTeamByIdOrAlias(team.teamName);

  return (
    <tr key={team.teamId} className="border-b border-border/30 hover:bg-muted/20">
      <td className="px-4 py-3">{team.position}</td>
      <td className="px-4 py-3 font-medium">
        {teamConfig ? (
          <Link
            href={`/teams/${teamConfig.slug}`}
            className="hover:text-primary transition-colors hover:underline"
          >
            {team.teamName}
          </Link>
        ) : (
          team.teamName
        )}
      </td>
      {/* ...rest of row */}
    </tr>
  );
})}
```

### Pattern 2: Clickable Team Names/Badges in Match Cards
**What:** Wrap team names or entire team section in Link to team page
**When to use:** Match cards, fixture lists, any match display
**Example:**
```typescript
// Source: Existing match-card.tsx pattern + Context7 Link examples
import Link from 'next/link';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

// In MatchCard component (src/components/match-card.tsx)
function TeamSection({ teamName, teamLogo, isHome }: TeamSectionProps) {
  const teamConfig = getTeamByIdOrAlias(teamName);
  const teamUrl = teamConfig ? `/teams/${teamConfig.slug}` : null;

  const content = (
    <>
      {/* Team logo */}
      <div className="h-6 w-6 rounded bg-muted/50">
        {teamLogo && <Image src={teamLogo} alt={`${teamName} logo`} width={24} height={24} />}
      </div>
      {/* Team name */}
      <p className="font-medium text-[13px] truncate" title={teamName}>
        {teamName}
      </p>
    </>
  );

  // Wrap in Link if team page exists
  if (teamUrl) {
    return (
      <Link
        href={teamUrl}
        className="flex items-center gap-1.5 min-w-0 hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()} // Prevent match card click
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-1.5 min-w-0">{content}</div>;
}
```

### Pattern 3: Team Links in Match Detail Header
**What:** Clickable team names in match detail page header
**When to use:** Match detail pages, head-to-head displays
**Example:**
```typescript
// In match detail page header
import Link from 'next/link';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

export function MatchDetailHeader({ match }: { match: Match }) {
  const homeTeam = getTeamByIdOrAlias(match.homeTeam);
  const awayTeam = getTeamByIdOrAlias(match.awayTeam);

  return (
    <div className="flex items-center justify-center gap-4">
      {homeTeam ? (
        <Link href={`/teams/${homeTeam.slug}`} className="hover:text-primary transition-colors">
          <h2 className="text-xl font-bold">{match.homeTeam}</h2>
        </Link>
      ) : (
        <h2 className="text-xl font-bold">{match.homeTeam}</h2>
      )}

      <span className="text-muted-foreground">vs</span>

      {awayTeam ? (
        <Link href={`/teams/${awayTeam.slug}`} className="hover:text-primary transition-colors">
          <h2 className="text-xl font-bold">{match.awayTeam}</h2>
        </Link>
      ) : (
        <h2 className="text-xl font-bold">{match.awayTeam}</h2>
      )}
    </div>
  );
}
```

### Pattern 4: Team Page Cross-Links to League and Matches
**What:** Add internal links from team pages back to league pages and recent matches
**When to use:** Team detail pages, creating bidirectional linking
**Example:**
```typescript
// Team page already has breadcrumbs (Home > Teams > Team)
// Add explicit league link and match links in content

// In team page (src/app/teams/[slug]/page.tsx)
const competition = getCompetitionById(team.league);

return (
  <div className="space-y-8">
    {/* Header with league link */}
    <div>
      <h1 className="text-3xl font-bold">{team.id}</h1>
      <p className="text-muted-foreground">
        {competition ? (
          <Link
            href={`/leagues/${competition.id}`}
            className="hover:text-primary transition-colors hover:underline"
          >
            {competition.name}
          </Link>
        ) : (
          team.league
        )}
        {' — '}{stats.totalMatches} matches tracked
      </p>
    </div>

    {/* Recent matches section with match links */}
    <section>
      <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
      <TeamRecentMatches matches={recentWithAccuracy} teamName={team.id} />
    </section>
  </div>
);
```

### Pattern 5: Preventing Link Conflicts in Nested Clickable Elements
**What:** Stop event propagation when team link is inside clickable match card
**When to use:** Links inside other clickable containers
**Example:**
```typescript
// Prevent team link from triggering match card click
<Link
  href={`/teams/${teamSlug}`}
  onClick={(e) => e.stopPropagation()}
  className="hover:text-primary transition-colors"
>
  {teamName}
</Link>
```

### Anti-Patterns to Avoid
- **Hardcoded team URLs:** Don't use `/teams/manchester-city` directly. Use `getTeamByIdOrAlias()` to resolve slug and handle aliases.
- **Linking unmapped teams:** Don't create links for teams not in `teams.ts`. Check if `getTeamByIdOrAlias()` returns a config before creating Link.
- **Missing fallback:** Always render team name as plain text if no team config exists. Don't show broken links.
- **Forgetting stopPropagation:** When team link is inside match card, prevent card click with `onClick={(e) => e.stopPropagation()}`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL generation for team pages | String concatenation `/teams/${team.toLowerCase().replace(' ', '-')}` | `getTeamByIdOrAlias()` + team.slug | Handles aliases, validates team exists, uses canonical slugs. Manual construction breaks on "Man. City" vs "Manchester City". |
| Client-side navigation | `window.location.href` or `router.push()` | Next.js Link component | Link provides prefetching, accessibility (keyboard, screen reader), right-click/cmd-click support. Manual navigation breaks user expectations. |
| Breadcrumb schema | Custom JSON-LD builder | `buildBreadcrumbSchema()` from Phase 68 | Existing helper generates correct Schema.org format, handles absolute URLs, tested. |
| Clickable team badges | Custom onClick handler with router | Link wrapping team logo/name | Link component handles all interaction patterns (click, keyboard, assistive tech). Custom onClick misses edge cases. |

**Key insight:** Next.js Link component solves deceptively complex problems (prefetching, history management, focus restoration, accessibility, scroll behavior). Using Link is not just "best practice"—it's required for proper Next.js navigation. Never use `<a>` tags or manual navigation for internal routes.

## Common Pitfalls

### Pitfall 1: Team Name Alias Mismatch
**What goes wrong:** Database returns "Man. City" but teams.ts has id: "Manchester City". Link fails to generate because `getTeamByIdOrAlias('Man. City')` returns undefined.
**Why it happens:** Database team names may use abbreviations or variants not listed in teams.ts aliases array.
**How to avoid:** Run validation script before deployment. For each unique team name in DB, verify it matches a team.id or appears in team.aliases. Add missing aliases to teams.ts.
**Warning signs:** Some teams in standings table are clickable, others are plain text. Console shows "Unknown team: Man. City" warnings.

### Pitfall 2: Link Inside Link Accessibility Violation
**What goes wrong:** Wrapping entire match card in Link and team name in separate Link creates nested links, failing WCAG 2.1 SC 2.4.4.
**Why it happens:** Intuitive to make whole card clickable AND team name clickable, but HTML spec forbids `<a>` inside `<a>`.
**How to avoid:** Use event.stopPropagation() on team link click to prevent card navigation. Or make card a `<button>` with onClick instead of Link.
**Warning signs:** Browser dev tools show "Error: Nested <a> tags" or "Element <a> is not allowed inside <a>". Screen readers announce "Link, Link" incorrectly.

### Pitfall 3: Missing Breadcrumb Updates After Team Page Addition
**What goes wrong:** Team pages lack proper breadcrumbs or breadcrumb schema is incomplete
**Why it happens:** Breadcrumbs were added in Phase 68 but not updated for team pages
**How to avoid:** Use existing `buildTeamBreadcrumbs()` helper. Verify Schema.org BreadcrumbList includes Teams index page.
**Warning signs:** Team pages missing visual breadcrumbs. Search Console shows "Breadcrumb errors" for /teams/* URLs.

### Pitfall 4: Prefetch Performance Impact
**What goes wrong:** League page with 20 teams in standings table triggers 20 prefetch requests on hover, slowing page
**Why it happens:** Next.js Link automatically prefetches on viewport entry or hover. Large lists create many prefetches.
**How to avoid:** Add `prefetch={false}` to team links in large tables. Prefetching on click is fast enough for internal navigation.
**Warning signs:** Network tab shows dozens of prefetch requests on page load. Slow 3G users see spinner on team link hover.

### Pitfall 5: Inconsistent Hover States
**What goes wrong:** Some team names have hover underline, others have color change, no consistent pattern
**Why it happens:** Different developers add links with different styles
**How to avoid:** Define consistent hover class: `hover:text-primary transition-colors hover:underline`. Use in all team links.
**Warning signs:** UX inconsistency. Some links show no hover feedback, confusing users about what's clickable.

### Pitfall 6: Team Page Cross-Links Missing
**What goes wrong:** Team pages link TO leagues/matches but leagues/matches don't link BACK to teams. One-way linking reduces SEO benefit.
**Why it happens:** Forgetting reciprocal linking when adding new page types
**How to avoid:** Audit all mentions of team names across site. Add team links in: league standings, match cards, match detail headers, prediction tables (if team is identifiable).
**Warning signs:** Search Console shows team pages have low internal link count. Team pages not appearing in "related pages" analytics.

## Code Examples

Verified patterns from Context7 and existing codebase:

### Team Link with Fallback (Defensive Pattern)
```typescript
// Always check if team config exists before creating link
import Link from 'next/link';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

function TeamNameLink({ teamName }: { teamName: string }) {
  const team = getTeamByIdOrAlias(teamName);

  // If team not in mapping, render plain text
  if (!team) {
    return <span className="font-medium">{teamName}</span>;
  }

  return (
    <Link
      href={`/teams/${team.slug}`}
      className="font-medium hover:text-primary transition-colors hover:underline"
    >
      {teamName}
    </Link>
  );
}
```

### Team Badge + Name Link (Compound Pattern)
```typescript
// Wrap both logo and name in single Link for larger click target
import Link from 'next/link';
import Image from 'next/image';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

function TeamBadgeLink({ teamName, logoUrl }: { teamName: string; logoUrl?: string | null }) {
  const team = getTeamByIdOrAlias(teamName);

  const content = (
    <>
      <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center">
        {logoUrl ? (
          <Image src={logoUrl} alt={`${teamName} logo`} width={32} height={32} />
        ) : (
          <span className="text-xs font-bold">{teamName.substring(0, 2).toUpperCase()}</span>
        )}
      </div>
      <span className="font-medium">{teamName}</span>
    </>
  );

  if (!team) {
    return <div className="flex items-center gap-2">{content}</div>;
  }

  return (
    <Link
      href={`/teams/${team.slug}`}
      className="flex items-center gap-2 hover:text-primary transition-colors group"
    >
      {content}
    </Link>
  );
}
```

### Dynamic Link Generation with Type Safety
```typescript
// Use centralized URL helper for type-safe link generation
import { getInternalUrl } from '@/lib/navigation/urls';
import { getTeamByIdOrAlias } from '@/lib/football/teams';

function generateTeamLink(teamName: string): string | null {
  const team = getTeamByIdOrAlias(teamName);
  if (!team) return null;

  // This throws if slug is invalid, catching bugs early
  return getInternalUrl('static', { slug: `/teams/${team.slug}` });
}
```

### League Page Team Cross-Links
```typescript
// Add team links to league standings table
async function LeagueStandingsTable({ competitionId }: { competitionId: string }) {
  const standings = await getStandingsByCompetitionId(competitionId);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/50 bg-muted/30">
          <th className="px-4 py-3 text-left font-semibold">#</th>
          <th className="px-4 py-3 text-left font-semibold">Team</th>
          {/* ...other headers */}
        </tr>
      </thead>
      <tbody>
        {standings.map((team) => {
          const teamConfig = getTeamByIdOrAlias(team.teamName);

          return (
            <tr key={team.teamId} className="border-b border-border/30 hover:bg-muted/20">
              <td className="px-4 py-3">{team.position}</td>
              <td className="px-4 py-3 font-medium">
                {teamConfig ? (
                  <Link
                    href={`/teams/${teamConfig.slug}`}
                    className="hover:text-primary transition-colors hover:underline"
                  >
                    {team.teamName}
                  </Link>
                ) : (
                  team.teamName
                )}
              </td>
              {/* ...other cells */}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

### Match Card Team Links with Event Handling
```typescript
// Team links inside match card need stopPropagation
// Pattern: entire card links to match, team names link to teams
function MatchCard({ match }: MatchCardProps) {
  const homeTeam = getTeamByIdOrAlias(match.homeTeam);
  const awayTeam = getTeamByIdOrAlias(match.awayTeam);

  return (
    <Link href={matchUrl} className="group block rounded-lg border p-4">
      <div className="flex items-center justify-between">
        {/* Home team - nested link */}
        <div className="flex items-center gap-2">
          {homeTeam ? (
            <Link
              href={`/teams/${homeTeam.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary transition-colors hover:underline"
            >
              {match.homeTeam}
            </Link>
          ) : (
            <span>{match.homeTeam}</span>
          )}
        </div>

        <span className="text-muted-foreground">vs</span>

        {/* Away team - nested link */}
        <div className="flex items-center gap-2">
          {awayTeam ? (
            <Link
              href={`/teams/${awayTeam.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary transition-colors hover:underline"
            >
              {match.awayTeam}
            </Link>
          ) : (
            <span>{match.awayTeam}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain text team names | Clickable team links | 2024+ internal linking SEO | Improves crawl depth, establishes topical authority, better user navigation. Search engines discover team pages via league/match pages. |
| Manual URL construction | Centralized `getInternalUrl()` helper | Phase 68 (next.js patterns) | Prevents redirect chains from alias mismatches, enforces canonical URLs, catches typos at build time. |
| Full page navigation | Next.js Link with prefetch | Next.js 13+ App Router | Instant navigation feel, reduced server load, better Core Web Vitals (LCP, CLS). |
| JavaScript click handlers | Semantic HTML links | WCAG 2.1+ accessibility | Screen reader support, keyboard navigation, right-click/cmd-click, better SEO. |
| Hardcoded breadcrumbs | Dynamic breadcrumb schema | 2025+ Google breadcrumb update | Maintains CTR even after visual prominence reduced. Signals site hierarchy to search engines. |

**Deprecated/outdated:**
- **`<a href>` for internal links:** Replaced by Next.js Link. Plain `<a>` tags work but miss prefetching and client-side navigation.
- **Router.push() for navigation:** Use Link component instead. Router.push() is for programmatic navigation (after form submit), not user clicks.
- **Relative URLs in breadcrumb schema:** Google requires absolute URLs in Schema.org. Use `${BASE_URL}${relativePath}` pattern.

## Open Questions

1. **Team logos in links**
   - What we know: Team logos available in `matches.homeTeamLogo` field
   - What's unclear: Should team links show logo + name or just name? Logo loading performance impact?
   - Recommendation: Start with name-only links for simplicity. Add logos in Phase 71 (performance optimization) if needed.

2. **Team links in prediction tables**
   - What we know: Match detail pages show prediction tables with team names
   - What's unclear: Should predicted scorelines include team links? May clutter narrow mobile tables.
   - Recommendation: Add team links in match detail header but NOT in prediction table. Table is about models, not teams.

3. **Team page "Related Matches" section**
   - What we know: Team pages show recent/upcoming matches
   - What's unclear: Should opponent team names in match list be clickable to opponent team pages?
   - Recommendation: Yes. Creates team-to-team navigation graph, improving internal linking structure.

4. **Prefetch strategy for team links**
   - What we know: Next.js Link auto-prefetches on viewport entry
   - What's unclear: Does prefetching 20 team links in standings table hurt performance on slow connections?
   - Recommendation: Disable prefetch (`prefetch={false}`) in large lists (standings >10 teams). Enable prefetch in match cards (only 2 teams).

## Sources

### Primary (HIGH confidence)
- Context7: `/vercel/next.js/v16.1.5` - Link component documentation and examples
- Codebase analysis:
  - `src/lib/football/teams.ts` - Team mapping and slug resolution (Phase 67)
  - `src/lib/navigation/urls.ts` - URL generation utilities (Phase 68)
  - `src/lib/navigation/breadcrumb-utils.ts` - Breadcrumb helpers (Phase 68-01)
  - `src/app/leagues/[slug]/league-hub-content.tsx` - Standings table structure (lines 113-163)
  - `src/components/match-card.tsx` - Match card team display (lines 149-252)
  - `src/app/leagues/[slug]/[match]/page.tsx` - Match detail page structure

### Secondary (MEDIUM confidence)
- [How Internal Linking Can Transform Your Next.js Website's SEO](https://medium.com/@brianmgwena/how-internal-linking-can-transform-your-next-js-websites-seo-323e038e2b69) - Internal linking strategy for Next.js
- [Internal Linking Strategy: Complete SEO Guide for 2026](https://www.ideamagix.com/blog/internal-linking-strategy-seo-guide-2026/) - 2026 SEO framework for internal links
- [What Are Breadcrumbs? SEO & UX Best Practices (2026)](https://www.yotpo.com/blog/what-are-breadcrumbs-seo/) - Breadcrumb SEO impact
- [SEO breadcrumbs: Structure, benefits & best practices](https://searchengineland.com/guide/seo-breadcrumbs) - Breadcrumb implementation patterns
- [ARIA Labels for Web Accessibility: Complete 2025 Implementation Guide](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility) - Accessibility best practices
- [ARIA: aria-label attribute - MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) - ARIA label usage

### Tertiary (LOW confidence)
- Phase 69 Research (`70-RESEARCH.md`) - UI component patterns and TanStack Table integration (informative but not directly applicable)

## Metadata

**Confidence breakdown:**
- Next.js Link patterns: HIGH - Official Context7 documentation and existing usage in codebase
- Team slug mapping: HIGH - Phase 67 infrastructure fully functional, tested in Phase 69
- URL generation: HIGH - Phase 68 utilities provide centralized, validated URL generation
- Internal linking SEO: MEDIUM - WebSearch findings verified with multiple 2026 sources
- Accessibility patterns: MEDIUM - WebSearch ARIA guidance from W3C/MDN sources

**Research date:** 2026-02-11
**Valid until:** 2026-03-13 (30 days, stable Next.js API and established patterns)
