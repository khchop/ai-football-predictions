# Phase 20: League Page Rebuild - Research

**Researched:** 2026-02-03
**Domain:** League page SEO optimization, structured data (SportsOrganization/SportsLeague), FAQ schema, stats dashboards, data visualization
**Confidence:** HIGH

## Summary

Research confirms that league pages require a combination of SEO-optimized metadata, rich structured data (Schema.org SportsOrganization), FAQ schema for GEO/AI search optimization, and a stats dashboard for user engagement. The existing codebase has strong foundations: the league page already uses SportsOrganization schema (`buildCompetitionSchema`), has competition stats components (`CompetitionStats`, `CompetitionPredictionSummary`), and follows established patterns for FAQ rendering (native `<details>`/`<summary>` with JSON-LD injection).

The primary enhancements needed are: (1) expanding SportsOrganization schema with additional properties (sport, memberOf, areaServed), (2) adding FAQPage schema following the existing `BlogFAQ`/`MatchFAQ` pattern, (3) improving metadata generation with dynamic stats integration, and (4) creating a historical performance trends visualization using CSS-only techniques (matching the design token infrastructure). The existing design system provides chart colors (`--chart-1` through `--chart-5`), accuracy colors, and CSS utilities that can power data visualization without additional JavaScript libraries.

**Primary recommendation:** Extend existing patterns (FAQ from Phase 19, schema from v1.1, stats components from v1.2) rather than building new infrastructure. Focus on SportsOrganization schema enrichment, FAQPage schema addition, and CSS-only trend visualization using existing chart color tokens.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| schema-dts | 1.1.5 | TypeScript types for Schema.org | Already in package.json, type-safe structured data |
| Native `<details>`/`<summary>` | HTML5 | FAQ accordions | Already used in match-faq.tsx and blog-faq.tsx, zero-JS |
| CSS Custom Properties | Native | Chart/trend visualization | Already established in globals.css with chart colors |
| lucide-react | 0.562.0 | Dashboard icons | Already in package.json, used in competition components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/og | Built-in | Dynamic OG images | Already used for league OG images |
| Tailwind CSS | 4.x | Utility styling | Already in stack, chart colors defined |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only charts | Chart.js/D3.js | JS libraries add weight; CSS sufficient for simple trend bars |
| Native `<details>` | Radix Accordion | Radix supports animation but requires JS; user chose zero-JS |
| SportsOrganization | SportsLeague | SportsLeague is not a Schema.org type; use SportsOrganization with sport property |

**Installation:**
```bash
# No new dependencies required - all tools already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── league/
│   │   ├── league-faq.tsx              # FAQ section (adapt blog-faq.tsx pattern)
│   │   ├── league-stats-dashboard.tsx  # Stats overview with accuracy
│   │   └── league-trend-chart.tsx      # CSS-only historical trends
│   ├── competition/                     # (exists) Reuse existing components
│   │   ├── competition-stats.tsx        # (exists) Match statistics
│   │   └── competition-prediction-summary.tsx # (exists) AI insights
│   └── FaqSchema.tsx                    # (exists) Schema injection
├── lib/
│   ├── seo/
│   │   ├── schema/
│   │   │   └── competition.ts           # (exists) Enhance with more properties
│   │   └── schemas.ts                   # (exists) generateFAQPageSchema
│   └── league/
│       ├── generate-league-faqs.ts      # Auto-generate FAQs for league
│       └── get-league-trends.ts         # Historical performance data
└── app/
    └── leagues/
        └── [slug]/
            └── page.tsx                 # (exists) Enhance with FAQ, better schema
```

### Pattern 1: Enhanced SportsOrganization Schema
**What:** Extend existing schema with additional Schema.org properties
**When to use:** Every league page
**Example:**
```typescript
// lib/seo/schema/competition.ts (enhanced)
import type { SportsOrganization, WithContext } from 'schema-dts';
import { BASE_URL } from '../constants';
import type { CompetitionConfig } from '@/lib/football/competitions';

export interface EnhancedCompetitionData {
  competition: CompetitionConfig;
  stats?: {
    totalMatches: number;
    avgGoalsPerMatch: number;
  };
}

export function buildEnhancedCompetitionSchema(
  data: EnhancedCompetitionData
): WithContext<SportsOrganization> {
  const { competition, stats } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    '@id': `${BASE_URL}/leagues/${competition.id}#organization`,
    name: competition.name,
    url: `${BASE_URL}/leagues/${competition.id}`,
    sport: 'Football',
    // Geographic area served (country/region)
    areaServed: competition.country || 'Europe',
    // Description with dynamic stats
    description: stats
      ? `${competition.name} football competition with ${stats.totalMatches} matches tracked and AI predictions from 35 models.`
      : `AI predictions and analysis for ${competition.name} football matches.`,
    // Same as for linking to authoritative sources
    sameAs: competition.externalUrl ? [competition.externalUrl] : undefined,
  };
}
```

### Pattern 2: League FAQ Generation
**What:** Auto-generate common FAQs for each league with dynamic data
**When to use:** Every league page
**Example:**
```typescript
// lib/league/generate-league-faqs.ts
import type { FAQItem } from '@/lib/seo/schemas';
import type { CompetitionConfig } from '@/lib/football/competitions';

interface LeagueFAQData {
  competition: CompetitionConfig;
  stats: {
    totalMatches: number;
    avgAccuracy: number;
    bestModel: string;
  };
}

export function generateLeagueFAQs(data: LeagueFAQData): FAQItem[] {
  const { competition, stats } = data;

  return [
    // TL;DR question first (user decision from Phase 19)
    {
      question: `What are the AI predictions for ${competition.name}?`,
      answer: `Our platform uses 35 AI models to predict exact scores for ${competition.name} matches. The models analyze team form, head-to-head records, standings, and lineups to generate predictions approximately 30 minutes before kickoff.`,
    },
    {
      question: `How accurate are AI predictions for ${competition.name}?`,
      answer: `Across ${stats.totalMatches} ${competition.name} matches, our AI models achieve an average tendency accuracy of ${stats.avgAccuracy.toFixed(1)}%. The best performing model for this competition is ${stats.bestModel}.`,
    },
    {
      question: `How many ${competition.name} matches have been predicted?`,
      answer: `We have tracked and predicted ${stats.totalMatches} ${competition.name} matches with AI analysis and exact score predictions from 35 different models.`,
    },
    {
      question: `When are ${competition.name} predictions available?`,
      answer: `Predictions for ${competition.name} matches are generated approximately 30 minutes before kickoff, once official team lineups are announced. This ensures predictions incorporate the most relevant team information.`,
    },
    {
      question: `What scoring system is used for ${competition.name} predictions?`,
      answer: `We use the Kicktipp quota scoring system where correct predictions earn 2-6 points based on rarity, with an additional 3-point bonus for exact score matches (maximum 10 points per prediction).`,
    },
  ].slice(0, 5); // User decision from Phase 19: 5 FAQ max
}
```

### Pattern 3: League FAQ Component (Matching Blog/Match Pattern)
**What:** Render FAQ section with native accordion and schema injection
**When to use:** Every league page (at bottom, per Phase 19 decision)
**Example:**
```typescript
// components/league/league-faq.tsx
import type { FAQItem } from '@/lib/seo/schemas';
import { FaqSchema } from '@/components/FaqSchema';

interface LeagueFAQProps {
  faqs: FAQItem[];
}

export function LeagueFAQ({ faqs }: LeagueFAQProps) {
  if (!faqs || faqs.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="group border border-border/50 rounded-lg">
            <summary className="cursor-pointer font-medium text-base md:text-lg py-4 px-4 hover:bg-muted/30 transition-colors list-none flex items-center justify-between">
              <span>{faq.question}</span>
              <svg
                className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 text-muted-foreground leading-relaxed text-sm md:text-base border-t border-border/30">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <FaqSchema faqs={faqs} />
    </section>
  );
}
```

### Pattern 4: CSS-Only Trend Chart
**What:** Simple bar chart showing historical performance using CSS custom properties
**When to use:** League stats dashboard for trend visualization
**Example:**
```typescript
// components/league/league-trend-chart.tsx
interface TrendData {
  period: string;  // e.g., "Week 1", "Jan"
  value: number;   // e.g., accuracy percentage
}

interface LeagueTrendChartProps {
  data: TrendData[];
  maxValue?: number;
  label: string;
}

export function LeagueTrendChart({
  data,
  maxValue = 100,
  label
}: LeagueTrendChartProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">{label}</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((item, i) => {
          const height = (item.value / maxValue) * 100;
          // Color based on accuracy thresholds (user decision)
          const colorClass =
            item.value < 40 ? 'bg-loss' :
            item.value < 70 ? 'bg-draw' :
            'bg-win';

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${colorClass} transition-all duration-300`}
                style={{ height: `${height}%` }}
                title={`${item.period}: ${item.value.toFixed(1)}%`}
              />
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {item.period}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 5: Enhanced Metadata Generation
**What:** Dynamic metadata with stats integration for better CTR
**When to use:** generateMetadata function in league page
**Example:**
```typescript
// Enhanced generateMetadata for league pages
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) {
    return { title: 'League Not Found' };
  }

  // Fetch dynamic stats for rich description
  const stats = await getCompetitionStats(competition.id);

  const shortName = abbreviateCompetition(competition.name);
  const title = `${shortName} AI Predictions | 35 Models | kroam.xyz`;

  // Dynamic description with stats
  const description = stats?.totalMatches > 0
    ? `AI predictions for ${competition.name} from 35 models. ${stats.finishedMatches} matches analyzed with ${stats.avgGoalsPerMatch} avg goals. Track model accuracy and compare predictions.`
    : `AI predictions for ${competition.name} from 35 models. Track accuracy, compare predictions, and see which AI performs best.`;

  const url = `${BASE_URL}/leagues/${competition.id}`;

  return {
    title,
    description,
    keywords: [
      competition.name,
      'AI predictions',
      'football predictions',
      'machine learning',
      `${competition.name} predictions`,
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'kroam.xyz',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

### Anti-Patterns to Avoid
- **SportsLeague schema type:** Does not exist in Schema.org. Use SportsOrganization with `sport: 'Football'` property.
- **FAQs without visible content:** Google penalizes pages where FAQ schema doesn't match visible content. Always render FAQs visually.
- **JavaScript chart libraries for simple visualizations:** CSS-only charts are sufficient for trend bars; avoid Chart.js/D3.js overhead.
- **Hardcoded FAQ content:** Generate FAQs dynamically with league stats for accuracy and freshness.
- **Duplicate schema injections:** Combine all schema types into single `@graph` array for cleaner output.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FAQ rendering | Custom accordion with ARIA | Native `<details>`/`<summary>` (match-faq.tsx pattern) | Built-in accessibility, no JS, already proven in codebase |
| FAQ schema | Manual JSON construction | `generateFAQPageSchema()` from schemas.ts | Type-safe, follows schema.org spec, tested |
| Competition schema | Custom schema builder | Enhance existing `buildCompetitionSchema()` | Foundation already works, just needs properties |
| Stats display | Custom stat cards | Reuse `CompetitionStats`, `CompetitionPredictionSummary` | Components already built in Phase 1.2 |
| Color-coded accuracy | Custom color logic | `AccuracyBadge` component | Thresholds already defined (<40% red, 40-70% amber, >70% green) |
| Chart colors | Hardcoded hex values | CSS custom properties (`--chart-1` through `--chart-5`) | Already defined in globals.css with dark mode support |

**Key insight:** The codebase already has 90% of the infrastructure needed. Phase 20 is primarily about composition and enhancement, not new construction. Reuse existing components (`CompetitionStats`, `CompetitionPredictionSummary`, `FaqSchema`, `AccuracyBadge`) and patterns (native `<details>`, JSON-LD injection).

## Common Pitfalls

### Pitfall 1: Using Non-Existent SportsLeague Schema Type
**What goes wrong:** Implementing `@type: "SportsLeague"` which is not a valid Schema.org type.
**Why it happens:** Intuitive assumption that sports leagues have their own type.
**How to avoid:** Use `SportsOrganization` with `sport: "Football"` property. Schema.org uses SportsOrganization for leagues, conferences, and teams.
**Warning signs:** Google Rich Results Test shows "Invalid type" errors.

### Pitfall 2: FAQ Content Mismatch
**What goes wrong:** JSON-LD schema contains different questions/answers than visible page content.
**Why it happens:** Schema generated from one source, UI from another, leading to drift.
**How to avoid:** Generate both UI and schema from same `faqs` array. Pass identical data to `LeagueFAQ` component which renders both visual FAQ and `FaqSchema`.
**Warning signs:** Search Console warnings about mismatched structured data.

### Pitfall 3: Static FAQ Content Gets Stale
**What goes wrong:** Hardcoded FAQ answers show outdated statistics (e.g., "100 matches" when there are now 500).
**Why it happens:** FAQ content written once at development time, never updated.
**How to avoid:** Generate FAQs dynamically with current stats from database. Use `generateLeagueFAQs(stats)` pattern.
**Warning signs:** Users report inaccurate information, FAQ answers contradict visible stats.

### Pitfall 4: Over-Engineering Trend Charts
**What goes wrong:** Installing Chart.js or D3.js for simple bar charts, adding 50KB+ to bundle.
**Why it happens:** Habit of reaching for charting libraries.
**How to avoid:** CSS-only charts are sufficient for simple trend visualization. Use existing `--chart-*` and `--win`/`--draw`/`--loss` color tokens.
**Warning signs:** Large bundle size increase, Lighthouse performance warnings.

### Pitfall 5: Multiple Separate Schema Script Tags
**What goes wrong:** Each schema type (SportsOrganization, FAQPage, BreadcrumbList) injected as separate `<script>` tags.
**Why it happens:** Following component isolation too strictly.
**How to avoid:** Combine all schemas into single `@graph` array in one `<script type="application/ld+json">` tag. This is the current pattern in the codebase (see existing league page).
**Warning signs:** Multiple JSON-LD scripts in page source, potential parsing issues.

### Pitfall 6: Forgetting OG Image Stats
**What goes wrong:** OG image shows "0 matches" because stats aren't passed to image generator.
**Why it happens:** OG image URL is built before stats are fetched.
**How to avoid:** Fetch stats in `generateMetadata`, pass to OG image URL parameters. Existing pattern passes `matchCount` and `upcomingCount`.
**Warning signs:** Social previews show placeholder data instead of real stats.

## Code Examples

Verified patterns from official sources and existing codebase:

### Combined Schema Graph (Existing Pattern)
```typescript
// Source: Existing league page.tsx pattern
const competitionSchema = buildEnhancedCompetitionSchema({ competition, stats });
const breadcrumbs = buildBreadcrumbSchema([
  { name: 'Home', url: BASE_URL },
  { name: 'Leagues', url: `${BASE_URL}/leagues` },
  { name: competition.name, url: `${BASE_URL}/leagues/${competition.id}` },
]);
const faqSchema = generateFAQPageSchema(faqs);

const schema = {
  '@context': 'https://schema.org',
  '@graph': [competitionSchema, breadcrumbs, faqSchema],
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

### Native Details/Summary FAQ (Existing Pattern)
```tsx
// Source: src/components/blog/blog-faq.tsx (verified working)
<details className="group border border-border/50 rounded-lg">
  <summary className="cursor-pointer font-medium text-base md:text-lg py-4 px-4 hover:bg-muted/30 transition-colors list-none flex items-center justify-between">
    <span>{faq.question}</span>
    <svg className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" ...>
      <path d="M19 9l-7 7-7-7" />
    </svg>
  </summary>
  <div className="px-4 pb-4 pt-2 text-muted-foreground leading-relaxed">
    {faq.answer}
  </div>
</details>
```

### AccuracyBadge Usage (Existing Component)
```tsx
// Source: src/components/ui/accuracy-badge.tsx (verified)
import { AccuracyBadge } from '@/components/ui/accuracy-badge';

// Automatic color coding: <40% red, 40-70% amber, >70% green
<AccuracyBadge percentage={stats.tendencyAccuracy} />
<AccuracyBadge percentage={stats.exactScoreAccuracy} decimals={2} />
```

### CSS Chart Colors (Existing Tokens)
```css
/* Source: src/app/globals.css (verified) */
:root {
  --chart-1: oklch(0.55 0.17 162.5);  /* Green */
  --chart-2: oklch(0.60 0.15 200);     /* Blue */
  --chart-3: oklch(0.65 0.19 70.1);    /* Amber */
  --chart-4: oklch(0.55 0.22 25.3);    /* Red */
  --chart-5: oklch(0.55 0.12 264);     /* Gray */

  /* Accuracy thresholds */
  --accuracy-low: oklch(0.55 0.22 25.3);   /* Red */
  --accuracy-mid: oklch(0.65 0.19 70.1);   /* Amber */
  --accuracy-high: oklch(0.55 0.17 162.5); /* Green */
}
```

### Parallel Data Fetching (Existing Pattern)
```typescript
// Source: src/app/leagues/[slug]/league-hub-content.tsx (verified)
const [topModels, stats, predictionSummary, nextMatch, matches] = await Promise.all([
  getTopModelsByCompetition(competitionId, 5),
  getCompetitionStats(competitionId),
  getCompetitionPredictionSummary(competitionId),
  getNextMatchForCompetition(competitionId),
  getMatchesByCompetitionId(competitionId, 1),
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SportsLeague schema type | SportsOrganization with sport property | Always (SportsLeague never existed) | Correct schema validation |
| Static FAQ content | Dynamic FAQ generation with live stats | 2024-2025 best practice | Fresh, accurate content for AI crawlers |
| Google FAQ rich snippets | AI platform citation (ChatGPT, Perplexity) | August 2023 | FAQ schema now targets GEO, not just rich results |
| Chart.js for all charts | CSS-only for simple visualizations | 2025-2026 trend | Better Core Web Vitals, smaller bundles |
| Separate schema scripts | Combined @graph array | Schema.org best practice | Cleaner parsing, single source of truth |

**Deprecated/outdated:**
- **Google FAQ rich snippets:** Google restricted FAQ rich results in August 2023 to government/health sites only. However, FAQ schema is MORE important now for AI platforms (ChatGPT, Perplexity, Google AI Overviews), which consume FAQPage schema extensively. Keep implementing FAQ schema for GEO.
- **Heavy charting libraries for simple stats:** Core Web Vitals pressure has shifted best practice toward CSS-only solutions for simple visualizations. Reserve Chart.js/D3.js for complex interactive dashboards.

## Open Questions

Things that couldn't be fully resolved:

1. **Historical Trend Data Source**
   - What we know: LEAG-05 requires "historical performance trends visualization"
   - What's unclear: What historical data exists in the database? Weekly accuracy? Monthly? Seasonal?
   - Recommendation: Query existing prediction data grouped by time period. If insufficient data, show rolling averages. Planner should verify available data during task creation.

2. **League External URLs for sameAs**
   - What we know: Schema.org `sameAs` property benefits from linking to authoritative sources
   - What's unclear: Does CompetitionConfig have external URLs (Wikipedia, official league sites)?
   - Recommendation: Add optional `externalUrl` to CompetitionConfig if not present. Can be deferred if time-consuming.

3. **OG Image Dynamic Stats**
   - What we know: Current OG image accepts `matchCount` and `upcomingCount` but shows "0"
   - What's unclear: Is the OG image route fetching stats or just using URL params?
   - Recommendation: Verify OG image route implementation. May need stats passed via URL params from generateMetadata.

## Sources

### Primary (HIGH confidence)
- [Schema.org SportsOrganization](https://schema.org/SportsOrganization) - Official schema type documentation
- Existing codebase: `src/lib/seo/schema/competition.ts`, `src/components/FaqSchema.tsx`, `src/components/blog/blog-faq.tsx`, `src/components/match/match-faq.tsx` - Verified implementation patterns
- `src/app/globals.css` - Design tokens and chart colors (verified OKLCH)
- `src/components/ui/accuracy-badge.tsx` - Accuracy color thresholds (verified)

### Secondary (MEDIUM confidence)
- [INSIDEA: FAQ Schema and Structured Data for GEO](https://insidea.com/blog/seo/geo/faq-schema-and-structured-data-for-geo/) - FAQ schema for AI platform optimization
- [Frase.io: FAQ Schema for AI Search](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) - GEO/AEO optimization patterns
- [Charts.css](https://chartscss.org/) - CSS-only chart patterns
- [FreeFrontend: CSS Charts](https://freefrontend.com/css-charts-and-graphs/) - CSS chart techniques
- [TailwindFlex Stats Components](https://tailwindflex.com/tag/stats) - Dashboard UI patterns

### Tertiary (LOW confidence)
- WebSearch results for "sports league structured data 2026" - Multiple sources agree on SportsOrganization pattern
- WebSearch results for "CSS-only charts vs JavaScript libraries" - Community consensus, not official guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, patterns already in codebase
- Architecture: HIGH - Patterns directly extend existing implementations (blog-faq.tsx, competition.ts)
- Pitfalls: MEDIUM - Based on Schema.org documentation and common issues from web search
- Visualization: MEDIUM - CSS-only charts are established pattern but less documented than JS libraries

**Research date:** 2026-02-03
**Valid until:** ~30 days (stable domain - Schema.org changes slowly, CSS patterns are stable)
