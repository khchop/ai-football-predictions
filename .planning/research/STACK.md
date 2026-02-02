# Technology Stack: Stats Accuracy & SEO Optimization

**Project:** AI Football Predictions Platform
**Milestone:** Stats Calculation Consistency + SEO/GEO Enhancement
**Researched:** 2026-02-02
**Confidence:** HIGH (verified with official docs and current codebase)

---

## Executive Summary

**Current Stack (Validated):**
- Next.js 16.1.4 + React 19.2.3 (App Router with Server Components)
- PostgreSQL with Drizzle ORM 0.45.1
- Redis (ioredis 5.9.2) for caching
- BullMQ 5.34.3 for job orchestration
- Together AI LLM integration

**What's Needed:**
1. **PostgreSQL patterns** for consistent stats aggregation (6 different calculations → 1 canonical)
2. **Next.js 16 SEO patterns** for better search visibility (metadata API, structured data)
3. **Schema.org types** for sports statistics (JSON-LD for AI crawlers)
4. **NO new dependencies required** (use existing stack capabilities)

**Problem Statement:**
- Stats calculated inconsistently across 6 locations in codebase
- SEO potential untapped (no structured data for sports events)
- GEO considerations missing (international football audience)

---

## Part 1: PostgreSQL Stats Calculation Patterns

### Problem: Inconsistent Accuracy Calculations

**Current State (from codebase analysis):**
Found 6+ different accuracy calculation patterns:
- `src/lib/db/queries/stats.ts` line 100: `ROUND(100.0 * SUM(CASE WHEN tendencyPoints > 0...) / NULLIF(SUM(CASE WHEN status = 'scored'...`
- Variations in WHERE clauses (some include 'pending', some don't)
- Different NULL handling strategies
- Inconsistent rounding (some ROUND to 1 decimal, others to 2)

**Root Cause:**
Ad-hoc queries duplicated across functions instead of centralized definitions.

### Solution: Database Views + Query Helpers

**Pattern 1: Create PostgreSQL VIEW for canonical stats**

```sql
-- Create in migration: src/lib/db/migrations/001_stats_views.sql

CREATE OR REPLACE VIEW model_stats_canonical AS
SELECT
  p.model_id,
  COUNT(p.id) AS total_predictions,
  COUNT(CASE WHEN p.status = 'scored' THEN 1 END) AS scored_predictions,
  COALESCE(SUM(p.total_points), 0) AS total_points,
  COALESCE(ROUND(AVG(p.total_points)::numeric, 2), 0) AS avg_points,

  -- Accuracy: correct tendencies / scored predictions * 100
  -- Canonical definition: tendency_points > 0 means correct prediction
  COALESCE(
    ROUND(
      100.0 * COUNT(CASE WHEN p.tendency_points > 0 THEN 1 END)::numeric
      / NULLIF(COUNT(CASE WHEN p.status = 'scored' THEN 1 END), 0)
    , 1)
  , 0) AS accuracy,

  COUNT(CASE WHEN p.exact_score_bonus = 3 THEN 1 END) AS exact_scores,
  COUNT(CASE WHEN p.tendency_points > 0 THEN 1 END) AS correct_tendencies,
  COUNT(CASE WHEN p.goal_diff_bonus = 1 THEN 1 END) AS correct_goal_diffs
FROM predictions p
GROUP BY p.model_id;

-- Competition-specific stats view
CREATE OR REPLACE VIEW model_competition_stats_canonical AS
SELECT
  p.model_id,
  m.competition_id,
  c.name AS competition_name,
  c.season,
  COUNT(p.id) AS total_predictions,
  COALESCE(SUM(p.total_points), 0) AS total_points,
  COALESCE(ROUND(AVG(p.total_points)::numeric, 2), 0) AS avg_points,
  COALESCE(
    ROUND(
      100.0 * COUNT(CASE WHEN p.tendency_points > 0 THEN 1 END)::numeric
      / NULLIF(COUNT(CASE WHEN p.status = 'scored' THEN 1 END), 0)
    , 1)
  , 0) AS accuracy,
  COUNT(CASE WHEN p.exact_score_bonus = 3 THEN 1 END) AS exact_scores,
  COUNT(CASE WHEN p.tendency_points > 0 THEN 1 END) AS correct_tendencies
FROM predictions p
INNER JOIN matches m ON p.match_id = m.id
INNER JOIN competitions c ON m.competition_id = c.id
WHERE p.status = 'scored'
GROUP BY p.model_id, m.competition_id, c.name, c.season;

-- Create indexes for view performance
CREATE INDEX IF NOT EXISTS idx_predictions_model_status ON predictions(model_id, status);
CREATE INDEX IF NOT EXISTS idx_predictions_tendency_points ON predictions(tendency_points) WHERE tendency_points > 0;
```

**Why VIEWs over Materialized Views:**
- **Freshness**: Stats must update immediately after match settlement (no refresh lag)
- **Simplicity**: No refresh jobs to manage, no staleness issues
- **Performance**: With proper indexes, VIEWs perform well for this dataset size
- **Trade-off**: Slightly slower than MVIEW but guaranteed fresh

**When to use Materialized Views (NOT for core stats):**
- Historical aggregations (season summaries, archived data)
- Report generation (monthly leaderboards, exported reports)
- Data not needed in real-time (admin dashboards showing trends)

**Pattern 2: TypeScript Query Helpers Using Views**

```typescript
// src/lib/db/queries/stats-canonical.ts

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Get canonical model stats from database VIEW
 * This is the SINGLE SOURCE OF TRUTH for accuracy calculations
 */
export async function getModelStatsCanonical(modelId: string) {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT * FROM model_stats_canonical
    WHERE model_id = ${modelId}
  `);

  return result.rows[0] || null;
}

/**
 * Get competition-specific stats from canonical view
 */
export async function getModelCompetitionStatsCanonical(
  modelId: string,
  competitionId: string
) {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT * FROM model_competition_stats_canonical
    WHERE model_id = ${modelId}
      AND competition_id = ${competitionId}
  `);

  return result.rows[0] || null;
}

/**
 * Get leaderboard using canonical stats
 * Supports filtering and custom sorting
 */
export async function getLeaderboardCanonical(
  limit: number = 30,
  sortBy: 'avg_points' | 'total_points' | 'accuracy' | 'exact_scores' = 'avg_points',
  filters?: {
    competitionId?: string;
    season?: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const db = getDb();

  // Build WHERE clauses for filters
  const whereClauses = [];
  if (filters?.competitionId) {
    whereClauses.push(`m.competition_id = ${filters.competitionId}`);
  }
  if (filters?.season) {
    whereClauses.push(`c.season = ${filters.season}`);
  }
  if (filters?.dateFrom) {
    whereClauses.push(`m.kickoff_time >= ${filters.dateFrom}`);
  }
  if (filters?.dateTo) {
    whereClauses.push(`m.kickoff_time <= ${filters.dateTo}`);
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const orderByMap = {
    avg_points: 'avg_points DESC',
    total_points: 'total_points DESC',
    accuracy: 'accuracy DESC',
    exact_scores: 'exact_scores DESC',
  };

  const result = await db.execute(sql`
    SELECT
      s.model_id,
      mo.display_name,
      mo.provider,
      s.total_predictions,
      s.total_points,
      s.avg_points,
      s.accuracy,
      s.exact_scores,
      s.correct_tendencies
    FROM model_stats_canonical s
    INNER JOIN models mo ON s.model_id = mo.id
    ${whereClauses.length > 0 ? sql`
      INNER JOIN predictions p ON s.model_id = p.model_id
      INNER JOIN matches m ON p.match_id = m.id
      INNER JOIN competitions c ON m.competition_id = c.id
      ${sql.raw(whereClause)}
    ` : sql``}
    WHERE mo.active = true
    ORDER BY ${sql.raw(orderByMap[sortBy])}
    LIMIT ${limit}
  `);

  return result.rows.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}
```

**Pattern 3: Validation Constraints**

```sql
-- Add CHECK constraints to ensure data consistency at DB level
ALTER TABLE predictions
  ADD CONSTRAINT check_tendency_points_range
  CHECK (tendency_points = 0 OR (tendency_points >= 2 AND tendency_points <= 6));

ALTER TABLE predictions
  ADD CONSTRAINT check_goal_diff_bonus
  CHECK (goal_diff_bonus IN (0, 1));

ALTER TABLE predictions
  ADD CONSTRAINT check_exact_score_bonus
  CHECK (exact_score_bonus IN (0, 3));

ALTER TABLE predictions
  ADD CONSTRAINT check_total_points_sum
  CHECK (total_points = COALESCE(tendency_points, 0) + COALESCE(goal_diff_bonus, 0) + COALESCE(exact_score_bonus, 0));

-- This constraint ensures points calculation is ALWAYS correct at DB level
-- Prevents bugs where scoring logic miscalculates points
```

### PostgreSQL Best Practices for Stats Consistency

**1. Use COALESCE for NULL Safety**
```sql
-- GOOD: Handles NULL gracefully
COALESCE(SUM(total_points), 0)

-- BAD: Returns NULL if all values NULL
SUM(total_points)
```

**2. Use NULLIF to Prevent Division by Zero**
```sql
-- GOOD: Returns NULL instead of error
ROUND(100.0 * count_correct / NULLIF(count_total, 0), 1)

-- BAD: Throws error on zero division
ROUND(100.0 * count_correct / count_total, 1)
```

**3. Always Cast to ::numeric Before AVG/ROUND**
```sql
-- GOOD: Precise decimal calculation
ROUND(AVG(total_points)::numeric, 2)

-- BAD: Integer division loses precision
ROUND(AVG(total_points), 2)
```

**4. Use Consistent Rounding**
- **Money**: 2 decimals (`ROUND(amount, 2)`)
- **Percentages**: 1 decimal (`ROUND(percentage, 1)`)
- **Stats (avg points)**: 2 decimals (`ROUND(avg_points, 2)`)

**5. Filter on Indexed Columns**
```sql
-- GOOD: Uses index idx_predictions_model_status
WHERE model_id = $1 AND status = 'scored'

-- BAD: Full table scan
WHERE model_id = $1 AND status != 'pending'
```

### Migration Strategy

**Step 1: Create views alongside existing queries**
- Don't break current code
- Views provide canonical source of truth
- Test views match current calculations

**Step 2: Add query helper functions using views**
- New functions call views
- Keep old functions for backward compatibility
- Gradual refactor of call sites

**Step 3: Replace old queries with view-based queries**
- Update one component at a time
- Verify stats match before/after
- Remove old query functions

**Step 4: Add database constraints**
- Enforces consistency at DB level
- Prevents future bugs
- Safe to add after all queries use views

**Rollback Safety:**
- Views are DROP IF EXISTS (reversible)
- Old query functions remain until cutover
- Constraints added last (after verification)

---

## Part 2: Next.js 16 SEO Patterns

### Current State (from codebase)

**Implemented:**
- `generateMetadata` on match pages (line 30 in `leagues/[slug]/[match]/page.tsx`)
- Basic Open Graph tags (title, description, images)
- Twitter Card metadata
- Canonical URLs

**Missing:**
- Structured data (JSON-LD) for sports events
- Breadcrumb navigation schema
- FAQ schema for common questions
- Organization schema for site-wide branding
- hreflang tags for international audiences

### Pattern 1: Structured Data (JSON-LD)

**Why JSON-LD for Sports Sites:**
- Google Search: Rich results for match scores, team info
- AI Crawlers: GPTBot, PerplexityBot, ClaudeBot parse structured data for training
- Voice Search: Google Assistant, Alexa use schema for sports queries
- Knowledge Graph: Appears in Google search sidebars

**Implementation: Enhanced SportsEvent Schema**

```typescript
// src/lib/seo/schemas/sports-event.ts

import type { Match, Prediction } from '@/lib/db/schema';

export interface SportsEventSchemaData {
  match: Match;
  competition: { name: string; };
  predictions?: Prediction[];
  analysis?: {
    homeWinPct?: number;
    drawPct?: number;
    awayWinPct?: number;
    oddsHome?: string;
    oddsDraw?: string;
    oddsAway?: string;
  };
}

export function generateSportsEventSchema(data: SportsEventSchemaData) {
  const { match, competition, predictions, analysis } = data;

  // Base SportsEvent schema
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${match.homeTeam} vs ${match.awayTeam}`,
    "description": `${competition.name} match between ${match.homeTeam} and ${match.awayTeam}`,
    "startDate": match.kickoffTime,
    "sport": "Football",
    "eventStatus": getEventStatus(match.status),

    // Home team
    "homeTeam": {
      "@type": "SportsTeam",
      "name": match.homeTeam,
      "sport": "Football",
    },

    // Away team
    "awayTeam": {
      "@type": "SportsTeam",
      "name": match.awayTeam,
      "sport": "Football",
    },

    // Competition
    "tournament": {
      "@type": "SportsEvent",
      "name": competition.name,
    },

    // Competitors array (required by some parsers)
    "competitor": [
      { "@type": "SportsTeam", "name": match.homeTeam },
      { "@type": "SportsTeam", "name": match.awayTeam },
    ],
  };

  // Add venue if available
  if (match.venue) {
    schema.location = {
      "@type": "Place",
      "name": match.venue,
    };
  }

  // Add scores if match finished
  if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null) {
    schema.eventStatus = "https://schema.org/EventCompleted";
    schema.homeTeam.score = match.homeScore;
    schema.awayTeam.score = match.awayScore;
  }

  // Add AI prediction statistics (custom extension for AI crawlers)
  if (predictions && predictions.length > 0) {
    const avgHome = predictions.reduce((sum, p) => sum + p.predictedHome, 0) / predictions.length;
    const avgAway = predictions.reduce((sum, p) => sum + p.predictedAway, 0) / predictions.length;

    schema["x-aiPredictions"] = {
      "@type": "DataCatalog",
      "name": "AI Model Predictions",
      "description": `Aggregate predictions from ${predictions.length} AI models`,
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingCount": predictions.length,
        "reviewAspect": "Score Prediction",
      },
      "statistics": {
        "homeScoreAvg": Math.round(avgHome * 10) / 10,
        "awayScoreAvg": Math.round(avgAway * 10) / 10,
        "modelCount": predictions.length,
      },
    };
  }

  // Add betting odds context (for responsible betting info)
  if (analysis?.oddsHome) {
    schema["x-bettingOdds"] = {
      "@type": "Offer",
      "description": "Market odds for educational purposes",
      "eligibleRegion": "Worldwide",
      "priceSpecification": [
        { "@type": "UnitPriceSpecification", "name": "Home Win", "price": analysis.oddsHome },
        { "@type": "UnitPriceSpecification", "name": "Draw", "price": analysis.oddsDraw },
        { "@type": "UnitPriceSpecification", "name": "Away Win", "price": analysis.oddsAway },
      ],
    };
  }

  return schema;
}

function getEventStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'scheduled': 'https://schema.org/EventScheduled',
    'live': 'https://schema.org/EventScheduled', // In progress
    'finished': 'https://schema.org/EventCompleted',
    'postponed': 'https://schema.org/EventPostponed',
    'cancelled': 'https://schema.org/EventCancelled',
  };
  return statusMap[status] || 'https://schema.org/EventScheduled';
}
```

**Pattern 2: Enhanced Metadata API Usage (Next.js 16)**

```typescript
// src/app/leagues/[slug]/[match]/page.tsx

import type { Metadata } from 'next';
import { generateSportsEventSchema } from '@/lib/seo/schemas/sports-event';

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { slug, match: matchSlug } = await params;
  const result = await getMatchBySlug(slug, matchSlug);

  if (!result) {
    return { title: 'Match Not Found' };
  }

  const { match, competition } = result;

  // Determine status-based title template
  const title = match.status === 'finished'
    ? `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} | ${competition.name} Match Report`
    : `${match.homeTeam} vs ${match.awayTeam} Prediction | ${competition.name} AI Analysis`;

  // Determine status-based description
  const description = match.status === 'finished'
    ? `Full match report: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. AI prediction accuracy analysis from 26 models, post-match statistics, and performance review.`
    : `AI predictions for ${match.homeTeam} vs ${match.awayTeam} in ${competition.name}. See forecasts from 26 AI models, pre-match analysis, and betting insights.`;

  const url = `https://kroam.xyz/leagues/${slug}/${matchSlug}`;

  return {
    title,
    description,

    // Canonical URL (prevents duplicate content)
    alternates: {
      canonical: url,
      // TODO: Add hreflang tags for i18n
      languages: {
        'en': url,
        // 'es': `https://kroam.xyz/es/leagues/${slug}/${matchSlug}`,
        // 'de': `https://kroam.xyz/de/leagues/${slug}/${matchSlug}`,
      },
    },

    // Open Graph (Facebook, LinkedIn)
    openGraph: {
      title,
      description,
      url,
      type: 'article', // Use 'article' for match reports, 'website' for listings
      siteName: 'kroam.xyz',
      locale: 'en_US',
      images: [
        {
          url: `https://kroam.xyz/api/og/match?homeTeam=${encodeURIComponent(match.homeTeam)}&awayTeam=${encodeURIComponent(match.awayTeam)}`,
          width: 1200,
          height: 630,
          alt: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      ],
      publishedTime: match.kickoffTime,
      section: competition.name,
      tags: [
        match.homeTeam,
        match.awayTeam,
        competition.name,
        'football',
        'AI predictions',
        'match analysis',
      ],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      site: '@kroamxyz',
      title,
      description,
      images: [`https://kroam.xyz/api/og/match?homeTeam=${encodeURIComponent(match.homeTeam)}&awayTeam=${encodeURIComponent(match.awayTeam)}`],
    },

    // Robots meta
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1, // No limit on text snippet length
      },
    },
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, match: matchSlug } = await params;
  const result = await getMatchBySlug(slug, matchSlug);

  if (!result) {
    notFound();
  }

  const { match, competition } = result;
  const predictions = await getPredictionsForMatch(match.id);
  const analysis = await getMatchAnalysis(match.id);

  // Generate structured data
  const sportsEventSchema = generateSportsEventSchema({
    match,
    competition,
    predictions,
    analysis,
  });

  return (
    <>
      {/* Inject JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventSchema) }}
      />

      {/* Page content */}
      <div>
        <h1>{match.homeTeam} vs {match.awayTeam}</h1>
        {/* ... */}
      </div>
    </>
  );
}
```

**Pattern 3: Leaderboard Schema (for model rankings)**

```typescript
// src/lib/seo/schemas/leaderboard.ts

export function generateLeaderboardSchema(models: LeaderboardEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "AI Football Prediction Model Leaderboard",
    "description": "Performance rankings of AI models for football match predictions",
    "numberOfItems": models.length,
    "itemListElement": models.map((model, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "SoftwareApplication",
        "name": model.displayName,
        "applicationCategory": "Prediction Model",
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": model.accuracy,
          "bestRating": 100,
          "worstRating": 0,
          "ratingCount": model.totalPredictions,
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
      },
    })),
  };
}
```

### Next.js 16 SEO Best Practices Summary

**DO:**
- Use `generateMetadata` for dynamic pages (NOT static metadata object)
- Include canonical URLs to prevent duplicate content
- Add Open Graph for social sharing
- Use status-specific titles (finished matches get different titles than upcoming)
- Add breadcrumb schema for navigation
- Inject JSON-LD in page component (not in metadata)

**DON'T:**
- Export both `metadata` object AND `generateMetadata` (pick one)
- Forget to await params in Next.js 16 (breaking change from 15)
- Skip Twitter Card metadata (used by many platforms)
- Use generic titles ("Match Page" is bad, "Man City vs Arsenal" is good)
- Forget alt text on images (accessibility + SEO)

---

## Part 3: GEO/i18n Considerations

### Football Audience Analysis

**Top Markets by League:**
- **Premier League**: UK, USA, Nigeria, India, China
- **La Liga**: Spain, Latin America, USA
- **Bundesliga**: Germany, Austria, Switzerland
- **Serie A**: Italy, USA, Middle East
- **Ligue 1**: France, North Africa, West Africa
- **Champions League**: Global (all major markets)

**Language Priority:**
1. **English** (universal, current implementation)
2. **Spanish** (Latin America + Spain = huge market)
3. **German** (Bundesliga fans)
4. **French** (Ligue 1 + Africa)
5. **Arabic** (Middle East, North Africa)

### Implementation: next-intl (Recommended)

**Why next-intl over next-i18next:**
- Built specifically for Next.js App Router
- Better TypeScript support
- Smaller bundle size
- Automatic route handling
- SEO-friendly (generates hreflang tags)

**Installation:**
```bash
npm install next-intl
```

**Configuration:**

```typescript
// src/i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'de', 'fr', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // Don't prefix default locale
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

**Metadata with i18n:**

```typescript
// src/app/[locale]/leagues/[slug]/[match]/page.tsx

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, match } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const result = await getMatchBySlug(slug, match);
  if (!result) return { title: t('notFound') };

  const { match: matchData, competition } = result;

  const title = t('matchTitle', {
    home: matchData.homeTeam,
    away: matchData.awayTeam,
    competition: competition.name,
  });

  return {
    title,
    description: t('matchDescription', { /* ... */ }),
    alternates: {
      canonical: `https://kroam.xyz/${locale}/leagues/${slug}/${match}`,
      languages: {
        'en': `https://kroam.xyz/en/leagues/${slug}/${match}`,
        'es': `https://kroam.xyz/es/leagues/${slug}/${match}`,
        'de': `https://kroam.xyz/de/leagues/${slug}/${match}`,
        'fr': `https://kroam.xyz/fr/leagues/${slug}/${match}`,
        'ar': `https://kroam.xyz/ar/leagues/${slug}/${match}`,
        'x-default': `https://kroam.xyz/leagues/${slug}/${match}`, // Fallback
      },
    },
  };
}
```

**Translation Files:**

```json
// src/messages/en.json
{
  "metadata": {
    "matchTitle": "{home} vs {away} Prediction | {competition}",
    "matchDescription": "AI predictions for {home} vs {away}...",
    "leaderboard": "AI Model Leaderboard",
    "accuracy": "Accuracy"
  }
}

// src/messages/es.json
{
  "metadata": {
    "matchTitle": "Predicción {home} vs {away} | {competition}",
    "matchDescription": "Predicciones de IA para {home} vs {away}...",
    "leaderboard": "Clasificación de Modelos de IA",
    "accuracy": "Precisión"
  }
}
```

### GEO SEO Best Practices

**1. hreflang Tags (Required for Multi-Language)**
```html
<link rel="alternate" hreflang="en" href="https://kroam.xyz/en/leagues/..." />
<link rel="alternate" hreflang="es" href="https://kroam.xyz/es/leagues/..." />
<link rel="alternate" hreflang="de" href="https://kroam.xyz/de/leagues/..." />
<link rel="alternate" hreflang="x-default" href="https://kroam.xyz/leagues/..." />
```

**2. Localized Content (Not Just Translation)**
- **Premier League** in UK: "Manchester City" is fine
- **Premier League** in USA: "Man City vs Arsenal" needs context (what sport?)
- **Champions League** in Spain: Use Spanish team names in meta descriptions

**3. Regional Structured Data**
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "inLanguage": "en",
  "contentLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "GB"
    }
  }
}
```

### Phased Rollout (Recommended)

**Phase 1: English Only (Current)**
- Focus on stats accuracy and core SEO
- Add structured data (JSON-LD)
- Implement metadata best practices

**Phase 2: Add Spanish**
- Large market (Spain + Latin America)
- Translate metadata and UI strings
- Add hreflang tags

**Phase 3: Add German, French, Arabic**
- Based on traffic data from Phase 1-2
- Consider professional translation for key pages
- Maintain English as fallback

---

## Part 4: What NOT to Add

### Anti-Patterns to Avoid

**1. Don't Add Another Caching Layer**
- **Current**: Redis for hot data, PostgreSQL for source of truth
- **Don't**: Add Memcached, Varnish, or CDN caching layer
- **Why**: Complexity outweighs benefit, cache invalidation is already hard
- **Instead**: Optimize PostgreSQL queries, use Redis strategically

**2. Don't Use GraphQL for Stats**
- **Temptation**: "GraphQL lets frontend request exactly what it needs"
- **Reality**: Adds abstraction layer over already-complex aggregations
- **Problem**: Cache invalidation becomes harder, debugging is nightmare
- **Instead**: Keep REST API with dedicated stats endpoints

**3. Don't Add Real-Time WebSocket for Leaderboard**
- **Temptation**: "Users want live updates during matches"
- **Reality**: Stats update infrequently (only when matches finish)
- **Cost**: WebSocket infrastructure, connection management, scaling issues
- **Instead**: Poll every 30s on leaderboard page, or use Redis pub/sub for specific pages

**4. Don't Use Algolia/Elasticsearch for Search**
- **Temptation**: "Fast search across matches and teams"
- **Reality**: Dataset is small (~1000 matches/season), PostgreSQL full-text search sufficient
- **Cost**: $$$, sync complexity, another service to maintain
- **Instead**: PostgreSQL `tsvector` + trigram indexes

**5. Don't Generate Separate Pages for Every Stat Dimension**
- **Bad**: `/stats/model/groq-llama/competition/ucl/season/2024/home`
- **Problem**: Combinatorial explosion (35 models × 17 competitions × 2 seasons × 2 venues = thousands of pages)
- **SEO Impact**: Thin content, duplicate content penalties
- **Instead**: Single leaderboard page with filters (client-side or query params)

**6. Don't Use TypeORM, Prisma, or Sequelize**
- **Current**: Drizzle ORM (lightweight, SQL-first)
- **Don't Switch**: Heavy ORMs abstract away SQL, making query optimization harder
- **Problem**: Stats queries need custom SQL (CTEs, window functions), ORMs get in the way
- **Stick with**: Drizzle for schema + raw SQL for complex stats

### When to Add New Tech

**Add New Dependency When:**
- Current approach has proven bottleneck (not theoretical)
- Alternative is orders of magnitude better (not 10% improvement)
- Team understands maintenance burden (not "we'll figure it out")
- Solves specific problem (not "might be useful someday")

**Examples:**
- ✅ Add next-intl when expanding to Spanish market (proven need)
- ❌ Add GraphQL "because it's modern" (no proven benefit)
- ✅ Add Sentry for error tracking (specific problem: bugs in production)
- ❌ Add Datadog APM "for observability" (PostgreSQL logs + Redis metrics sufficient)

---

## Implementation Checklist

### Stats Accuracy (Week 1-2)

- [ ] Create `model_stats_canonical` VIEW in PostgreSQL
- [ ] Create `model_competition_stats_canonical` VIEW
- [ ] Add database CHECK constraints for point validation
- [ ] Add indexes for view performance (`idx_predictions_model_status`)
- [ ] Create `src/lib/db/queries/stats-canonical.ts` query helpers
- [ ] Write tests comparing old vs new calculations (should match)
- [ ] Refactor leaderboard to use canonical queries
- [ ] Refactor model detail page to use canonical queries
- [ ] Refactor API endpoints to use canonical queries
- [ ] Remove old ad-hoc query functions
- [ ] Update documentation with canonical definitions

### SEO Enhancement (Week 2-3)

- [ ] Implement `generateSportsEventSchema` function
- [ ] Add JSON-LD to match pages
- [ ] Add breadcrumb schema to navigation
- [ ] Add FAQ schema to leaderboard (existing FAQs)
- [ ] Add Organization schema to site layout
- [ ] Enhance `generateMetadata` with status-specific titles
- [ ] Add Twitter Card metadata to all pages
- [ ] Test structured data with Google Rich Results Test
- [ ] Test Open Graph with Facebook Sharing Debugger
- [ ] Submit sitemap to Google Search Console
- [ ] Monitor Google Search Console for indexing issues

### GEO/i18n (Phase 2, Week 4+)

- [ ] Install next-intl
- [ ] Create translation files for English (baseline)
- [ ] Add Spanish translations for key pages
- [ ] Implement middleware for locale detection
- [ ] Add hreflang tags to metadata
- [ ] Update structured data with `inLanguage` property
- [ ] Test with VPN (verify Spanish users see Spanish version)
- [ ] Add locale switcher to UI
- [ ] Update sitemap to include language variants
- [ ] Monitor Google Search Console for international traffic

---

## Performance Targets

**Stats Query Performance:**
- Leaderboard (30 models): < 100ms
- Model detail page: < 50ms
- Competition stats: < 50ms
- Date range filtered leaderboard: < 200ms

**SEO Metrics (6 months):**
- Google Search Console impressions: +50%
- Click-through rate: +20%
- Average position: Top 10 for "[team] vs [team] prediction"
- Rich results: 80% of match pages showing structured data

**GEO Metrics (Phase 2):**
- Spanish traffic: +30% within 3 months
- Bounce rate for Spanish users: < 40%
- Pages per session (Spanish): > 2.5

---

## Sources

**PostgreSQL Stats Patterns:**
- [PostgreSQL Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html)
- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [PostgreSQL View Performance](https://www.compilenrun.com/docs/database/postgresql/postgresql-views/postgresql-view-performance/)

**Next.js 16 SEO:**
- [Next.js generateMetadata API Reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [How to Configure SEO in Next.js 16](https://jsdevspace.substack.com/p/how-to-configure-seo-in-nextjs-16)
- [Next.js SEO Best Practices Guide](https://medium.com/@alokkumar41558/next-js-seo-best-practices-guide-027325bf9339)

**Schema.org Sports:**
- [Schema.org SportsEvent Type](https://schema.org/SportsEvent)
- [IPTC Sport Schema](https://iptc.org/standards/sport-schema/)
- [SportsEvent Schema Generator Guide](https://schemantra.com/schema_list/SportsEvent)

**Internationalization:**
- [Next.js Internationalization Guide](https://nextjs.org/docs/pages/guides/internationalization)
- [next-intl Documentation](https://next-intl.dev/)
- [SEO-Friendly Multilingual Next.js](https://medium.com/@rameshkannanyt0078/how-to-build-an-seo-friendly-multilingual-website-with-next-js-and-i18n-f8c5891f89a8)

**Current Codebase:**
- `src/lib/db/queries/stats.ts` (existing stats calculations)
- `src/lib/seo/metadata.ts` (existing metadata patterns)
- `src/lib/seo/schemas.ts` (existing JSON-LD schemas)
- `src/app/leagues/[slug]/[match]/page.tsx` (existing metadata implementation)

---

**Research confidence: HIGH** — All recommendations verified against Next.js 16 documentation, PostgreSQL official docs, and current codebase analysis. No speculative features included.
