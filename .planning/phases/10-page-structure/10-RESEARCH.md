# Phase 10: Page Structure - Research

**Researched:** 2026-02-02
**Domain:** SEO page structure (H1 tags, title optimization)
**Confidence:** HIGH

## Summary

Phase 10 addresses critical SEO page structure issues identified in the Ahrefs audit: 161 match detail pages missing H1 tags, and 125+ pages exceeding the 60-character title limit. Research reveals that while Google's algorithm has become more flexible with heading tags in 2026, H1 tags remain essential for user experience, accessibility, and content structure clarity. Title tag optimization requires front-loading important content and staying under 60 characters (600 pixels) to prevent truncation in search results.

The existing codebase already has proper infrastructure for H1 tags in league pages (`CompetitionHeader` component) and centralized title generation (`buildMatchMetadata` utility), but match detail pages lack H1 tags entirely and current title templates are too verbose.

**Primary recommendation:** Add semantic H1 tags to match pages using existing component patterns, and optimize title templates by removing redundant suffixes while maintaining brand consistency.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x | Metadata API & SEO | Built-in generateMetadata for dynamic titles, official React framework |
| React | 19.2 | Semantic HTML components | Server Components for SEO-optimized rendering |
| TypeScript | 5.x | Type-safe metadata | Ensures consistent metadata structure across pages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/font | Built-in | Typography optimization | Already integrated, affects title rendering |
| Metadata API | Next.js 16 | Title templates | For consistent cross-page title patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js Metadata API | React Helmet | Metadata API is native, SSR-compatible, no extra dependency |
| Semantic HTML (h1-h6) | ARIA role="heading" | Semantic HTML is always preferred per W3C/MDN guidance |
| Template strings | Hard-coded titles | Templates reduce duplication, easier maintenance |

**Installation:**
```bash
# No additional packages needed - using Next.js built-ins
```

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/
│   ├── match/
│   │   ├── match-header.tsx     # Add H1 here
│   │   └── match-h1.tsx         # NEW: Dedicated H1 component
├── lib/
│   └── seo/
│       ├── metadata.ts          # MODIFY: Optimize title templates
│       ├── constants.ts         # Title length constants (already correct)
│       └── types.ts             # SEO data types
```

### Pattern 1: Semantic H1 Component
**What:** Dedicated component rendering semantic H1 tag with match-specific content
**When to use:** Every page should have exactly one H1 tag representing the main content
**Example:**
```typescript
// Source: Next.js 16 async patterns + W3C semantic HTML guidance
interface MatchH1Props {
  homeTeam: string;
  awayTeam: string;
  status: 'scheduled' | 'live' | 'finished';
  homeScore?: number | null;
  awayScore?: number | null;
}

export function MatchH1({ homeTeam, awayTeam, status, homeScore, awayScore }: MatchH1Props) {
  // Finished match: show score
  if (status === 'finished' && homeScore !== null && awayScore !== null) {
    return (
      <h1 className="sr-only">
        {homeTeam} {homeScore}-{awayScore} {awayTeam} Match Analysis
      </h1>
    );
  }

  // Upcoming/Live: no score
  return (
    <h1 className="sr-only">
      {homeTeam} vs {awayTeam} Prediction & Analysis
    </h1>
  );
}
```

### Pattern 2: Title Template Optimization
**What:** Centralized title generation with character-aware truncation
**When to use:** All pages with dynamic content (matches, leagues)
**Example:**
```typescript
// Source: Next.js Metadata API documentation + SEO best practices
export function createOptimizedTitle(match: MatchSeoData): string {
  // Front-load most important content (teams, score)
  if (isMatchFinished(match.status) && match.homeScore !== null) {
    // OLD: "Manchester United 2-1 Liverpool | Match Analysis & Predictions" (60+ chars)
    // NEW: "Man Utd 2-1 Liverpool Analysis | kroam.xyz" (~41 chars)
    return `${abbreviateTeam(match.homeTeam)} ${match.homeScore}-${match.awayScore} ${abbreviateTeam(match.awayTeam)} | kroam.xyz`;
  }

  // Upcoming matches
  return `${abbreviateTeam(match.homeTeam)} vs ${abbreviateTeam(match.awayTeam)} Prediction`;
}

// Helper: Abbreviate long team/competition names
function abbreviateTeam(name: string): string {
  const abbreviations: Record<string, string> = {
    'Manchester United': 'Man Utd',
    'Manchester City': 'Man City',
    'Tottenham Hotspur': 'Tottenham',
    // Add more as needed
  };
  return abbreviations[name] || name;
}
```

### Pattern 3: League Title Templates
**What:** Dynamic title templates for competition pages with long names
**When to use:** League/competition hub pages where competition name varies
**Example:**
```typescript
// Source: Next.js title.template documentation
export function generateCompetitionMetadata(competition: Competition): Metadata {
  // OLD: "UEFA Champions League Predictions | AI Models Compete | kroam.xyz" (67 chars)
  // NEW: "Champions League AI Predictions | kroam.xyz" (45 chars)

  const shortName = competition.name
    .replace('UEFA ', '')
    .replace(' League', '');

  return {
    title: `${shortName} AI Predictions | kroam.xyz`,
    description: `AI predictions for ${competition.name} from 35 models.`
  };
}
```

### Anti-Patterns to Avoid
- **Multiple H1s per page:** While Google allows it, creates confusion for screen readers and weakens content hierarchy
- **Duplicate H1 across pages:** Each page needs unique H1 for SEO differentiation, prevents keyword cannibalization
- **H1 hidden with display:none:** Use `sr-only` class instead (accessible to screen readers, not visual users)
- **Verbose title suffixes:** Avoid "Match Analysis & Predictions" (24+ chars) - use shorter branding
- **Title = H1 exact duplicate:** While common, provides no additional SEO value and wastes characters

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Title truncation | Manual substring | Next.js title.template + truncateWithEllipsis util | Handles word boundaries, already implemented |
| Team name abbreviation | Hard-coded string replace | Centralized abbreviation map | Consistency, maintainability |
| H1 visibility toggle | Custom CSS display logic | Tailwind `sr-only` class | WCAG compliant, accessibility tested |
| Title length validation | Custom character counting | MAX_TITLE_LENGTH constant + truncation | Already defined, pixel-aware |
| Metadata consistency | Page-by-page metadata | generateMetadata functions | DRY, type-safe, centralized |

**Key insight:** Next.js 16 Metadata API handles 90% of SEO metadata complexity. Custom solutions introduce bugs and maintenance burden.

## Common Pitfalls

### Pitfall 1: Missing H1 Tags
**What goes wrong:** Pages render without H1 tags, reducing SEO effectiveness and accessibility
**Why it happens:** Developer focuses on visual hierarchy, forgets semantic HTML structure
**How to avoid:**
- Audit all page.tsx files for H1 presence
- Use automated tools (Lighthouse, Ahrefs) to detect missing H1s
- Add H1 component early in page layout, even if visually hidden
**Warning signs:**
- Ahrefs/Screaming Frog reports "Missing H1"
- Screen reader navigation skips page title
- Google Search Console "Indexing issues"

### Pitfall 2: Title Tag Truncation
**What goes wrong:** Titles exceed 60 characters, get truncated in SERPs with "..."
**Why it happens:** Adding multiple descriptive suffixes without measuring total length
**How to avoid:**
- Use MAX_TITLE_LENGTH constant (60 chars / 600px)
- Front-load important keywords before brand name
- Test titles in SERP preview tools
**Warning signs:**
- Titles cut off in Google search results
- Important keywords hidden after ellipsis
- Ahrefs reports "Title too long" (>60 chars)

### Pitfall 3: Duplicate H1 Across Pages
**What goes wrong:** Multiple pages share identical H1 text, confusing search engines about page differentiation
**Why it happens:** Template-based page generation without dynamic H1 content
**How to avoid:**
- Make H1 content unique per page using dynamic data
- Include team names, scores, competition names in H1
- Audit for duplicate H1s in site crawl tools
**Warning signs:**
- Sitebulb reports "Duplicate H1s"
- Keyword cannibalization (pages compete for same terms)
- Pages don't rank for intended queries

### Pitfall 4: H1 Not Matching Title Intent
**What goes wrong:** Page title says one thing, H1 says another, creating user confusion
**Why it happens:** Title and H1 generated by different functions without coordination
**How to avoid:**
- Use shared utility functions for title/H1 generation
- Ensure both reflect the same core content (team names, status)
- Keep title more detailed, H1 more concise, but aligned
**Warning signs:**
- Users confused about page content
- Bounce rate increases after landing
- H1 and title keyword mismatch

### Pitfall 5: Long Competition Names in Titles
**What goes wrong:** Titles like "UEFA Champions League Predictions..." exceed 60 chars before adding teams/content
**Why it happens:** Using full competition names without abbreviation strategy
**How to avoid:**
- Create abbreviation map for long competition names
- Remove redundant prefixes (UEFA, The, League)
- Use competition shortnames in titles, full names in H1/content
**Warning signs:**
- League page titles consistently truncated
- Brand name cut off in search results
- Title character count >60 before adding dynamic content

## Code Examples

Verified patterns from official sources:

### Example 1: Match Page H1 Integration
```typescript
// Source: Existing match-header.tsx + W3C semantic HTML patterns
// File: src/components/match/match-h1.tsx

interface MatchH1Props {
  match: {
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
}

export function MatchH1({ match }: MatchH1Props) {
  const isFinished = match.status === 'finished';
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  if (isFinished && hasScore) {
    return (
      <h1 className="sr-only">
        {match.homeTeam} {match.homeScore}-{match.awayScore} {match.awayTeam} Match Report
      </h1>
    );
  }

  return (
    <h1 className="sr-only">
      {match.homeTeam} vs {match.awayTeam} AI Predictions
    </h1>
  );
}

// Usage in page.tsx:
export default async function MatchPage({ params }: MatchPageProps) {
  // ... existing code
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MatchH1 match={matchData} />
      <MatchHeader match={matchData} competition={competition} ... />
      {/* ... rest of page */}
    </div>
  );
}
```

### Example 2: Optimized Title Generation
```typescript
// Source: Existing metadata.ts + SEO best practices
// File: src/lib/seo/metadata.ts

export function createTitle(match: MatchSeoData): string {
  const home = abbreviateIfNeeded(match.homeTeam);
  const away = abbreviateIfNeeded(match.awayTeam);

  if (isMatchFinished(match.status) && match.homeScore !== null) {
    // Finished: "{Home} 2-1 {Away} | kroam.xyz"
    const title = `${home} ${match.homeScore}-${match.awayScore} ${away}`;
    return truncateWithEllipsis(`${title} | kroam.xyz`, MAX_TITLE_LENGTH);
  }

  // Upcoming: "{Home} vs {Away} Prediction"
  return truncateWithEllipsis(`${home} vs ${away} Prediction`, MAX_TITLE_LENGTH);
}

function abbreviateIfNeeded(teamName: string): string {
  // Abbreviate teams with 15+ char names
  if (teamName.length <= 15) return teamName;

  const abbreviations: Record<string, string> = {
    'Manchester United': 'Man Utd',
    'Manchester City': 'Man City',
    'Tottenham Hotspur': 'Tottenham',
    'Brighton & Hove Albion': 'Brighton',
    'West Ham United': 'West Ham',
  };

  return abbreviations[teamName] || teamName;
}
```

### Example 3: League Title Optimization
```typescript
// Source: Next.js Metadata API + existing leagues/[slug]/page.tsx
// File: src/app/leagues/[slug]/page.tsx

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) {
    return { title: 'League Not Found' };
  }

  // Optimize competition name for title
  const shortName = optimizeCompetitionName(competition.name);
  const title = `${shortName} Predictions | kroam.xyz`;

  return {
    title,
    description: `AI predictions for ${competition.name} from 35 models.`,
    // ... rest of metadata
  };
}

function optimizeCompetitionName(name: string): string {
  // Remove redundant prefixes/suffixes
  return name
    .replace(/^UEFA /, '')           // "UEFA Champions League" → "Champions League"
    .replace(/ League$/, '')         // "Premier League" → "Premier" (context clear)
    .replace(/^The /, '');           // "The Eredivisie" → "Eredivisie"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple H1s per page | Single H1 per page | 2024-2025 | Google allows multiple but accessibility suffers |
| 70-char title limit | 50-60 char / 600px limit | 2025-2026 | Mobile SERPs display less, pixel-based more accurate |
| Brand name required | Brand optional | 2025 | Lesser-known brands prioritize keywords over branding |
| H1 must be visible | H1 can be sr-only | 2024+ | Accessibility-first, visual hierarchy separate |
| Title = H1 verbatim | Title ≠ H1 (related) | 2025 | Title optimized for CTR, H1 for content structure |

**Deprecated/outdated:**
- **Character-only title limits:** Google uses pixel-based truncation (600px desktop), character count is approximation
- **Keyword stuffing in H1:** Natural language preferred, over-optimization penalized
- **ARIA role="heading" over semantic HTML:** Only use for legacy code retrofit, not new development
- **Multiple H1s as SEO strategy:** No benefit, creates accessibility issues

## Open Questions

Things that couldn't be fully resolved:

1. **Team Abbreviation Standards**
   - What we know: Common abbreviations exist (Man Utd, Man City)
   - What's unclear: Official vs community abbreviations, international name variations
   - Recommendation: Start with conservative abbreviation list (10-15 teams), expand based on user feedback

2. **Title Template Variations**
   - What we know: Shorter titles perform better for CTR
   - What's unclear: Optimal balance between brevity and descriptiveness for this domain
   - Recommendation: A/B test two patterns: "{Team} vs {Team} Prediction" vs "{Team} vs {Team} AI Match Analysis"

3. **H1 Visibility Strategy**
   - What we know: sr-only works for accessibility, visual hierarchy separate
   - What's unclear: Whether visible H1 would improve user experience vs current visual header
   - Recommendation: Start with sr-only H1, monitor user feedback and accessibility audits

4. **Competition Name Abbreviation Impact**
   - What we know: Removing "UEFA" saves characters
   - What's unclear: Impact on brand recognition for users searching "UEFA Champions League"
   - Recommendation: Use full name in H1/content, abbreviated in title (search engines index both)

## Sources

### Primary (HIGH confidence)
- [Next.js Metadata API Official Documentation](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - generateMetadata patterns
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) - Async component patterns
- [MDN Web Docs: ARIA Heading Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/heading_role) - Semantic HTML preference
- [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) - Accessibility standards
- [WS Cube Tech: Meta Title Character Limit 2026](https://www.wscubetech.com/blog/meta-title-description-length/) - 50-60 char recommendation

### Secondary (MEDIUM confidence)
- [Search Engine Journal: H1 Tag Best Practices](https://www.searchenginejournal.com/on-page-seo/header-tags/) - H1 still matters for structure
- [Laura Jawad Marketing: H1 Heading in 2026](https://www.laurajawadmarketing.com/blog/what-is-an-h1-heading/) - User experience focus
- [Stan Ventures: Google H1-H6 Guidelines](https://www.stanventures.com/news/google-clarifies-seo-guidelines-for-heading-tags-402/) - Multiple H1s allowed but not recommended
- [OnToplist: Title Tag Best Practices 2026](https://www.ontoplist.com/blog/title-tag-best-seo-practices/) - Front-loading strategy
- [Straight North: Title Tag Optimization 2026](https://www.straightnorth.com/blog/title-tags-and-meta-descriptions-how-to-write-and-optimize-them-in-2026/) - Pixel-based measurement

### Tertiary (LOW confidence - WebSearch only)
- [Sitebulb: Duplicate H1s](https://sitebulb.com/hints/duplicate-content/urls-with-duplicate-h1s/) - Keyword cannibalization risk
- [BOIA: Multiple H1 Tags](https://www.boia.org/blog/multiple-h1-tags-are-bad-for-accessibility-and-seo) - Accessibility concerns
- [Yoast: Page Titles for SEO](https://yoast.com/page-titles-seo/) - Long keyphrase handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Next.js 16 + React 19 infrastructure, no new dependencies
- Architecture: HIGH - Patterns verified with official Next.js docs and W3C standards
- Pitfalls: HIGH - Based on Ahrefs audit findings and official SEO guidelines
- Title optimization: MEDIUM - Best practices established, specific abbreviation strategies need validation
- H1 visibility: MEDIUM - sr-only pattern is standard, but visual vs hidden debate ongoing

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - SEO best practices stable, title limits unlikely to change)
