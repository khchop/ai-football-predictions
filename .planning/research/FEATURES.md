# Feature Landscape: Sports Statistics & Prediction Platforms

**Domain:** AI/LLM Sports Prediction Leaderboard Platform
**Researched:** 2026-02-02
**Context:** Fixing stats accuracy issues and adding SEO to existing platform with 35 LLM models predicting football matches

---

## Executive Summary

Sports prediction and statistics platforms live or die by user trust in their numbers. Research shows that **transparency and verifiable accuracy** are the minimum threshold for credibility, while **clear presentation of methodology and limitations** separates trustworthy platforms from marketing-driven ones that cherry-pick results.

The core insight: In sports prediction, **calibration matters more than raw accuracy**. A model that honestly reports "60% win rate" with verifiable track record is more valuable than one claiming "94% accuracy" without transparent calculation methodology.

**Critical finding for this platform:** Users expect ~50-60% baseline accuracy for sports predictions (slightly above random), with top AI models achieving 60-85% accuracy. Displaying "94% accuracy" immediately triggers skepticism and damages trust.

---

## Table Stakes Features

Features users MUST have to trust a sports statistics platform. Missing these = platform feels untrustworthy or incomplete.

### 1. Transparent Accuracy Calculations

**Why expected:** Every sports prediction site that cherry-picks results or hides methodology is immediately called out by experienced users.

**What's required:**
- **Formula visibility**: Show exactly how accuracy is calculated (e.g., "Correct predictions / Total scored predictions")
- **Sample size display**: Always show denominator (e.g., "24 correct out of 40 matches" not just "60%")
- **Methodology explanation**: Dedicated page explaining all metrics and their business logic
- **Consistent definitions**: One definition of "accuracy" used everywhere (no switching between exact score % vs tendency %)
- **Date ranges shown**: Clear time boundaries (e.g., "Last 30 days: 15/25 = 60%")

**Complexity:** Low (primarily UI presentation + documentation)

**Notes:**
- Research shows users audit predictions manually when suspicious - make this easy by showing raw counts
- Platforms that allow users to "click through to see each day's results" are trusted more than those hiding details
- The "94% accuracy" bug in current platform is exactly the type of credibility-killing error that research warns against

**Sources:**
- [Ruthless Review of Sports Prediction Platforms](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)
- [Calibration Over Accuracy in Sports Betting](https://opticodds.com/blog/calibration-the-key-to-smarter-sports-betting)

---

### 2. Performance Breakdown Tables

**Why expected:** Top sports stats sites (FBref, Opta) present data in clean, filterable tables with multiple views.

**What's required:**
- **Overall stats**: Total points, win rate, exact score rate, tendency rate (most common view)
- **Time-based breakdowns**: Last 7 days, last 30 days, all-time with clear date labels
- **Competition breakdowns**: Per-league accuracy (Premier League vs Serie A vs Champions League)
- **Form indicators**: Recent streak (5-game rolling), best/worst streaks
- **Head-to-head comparisons**: Compare 2+ models side-by-side

**Complexity:** Medium (requires consistent data aggregation across multiple time windows)

**Notes:**
- FBref's "simple tables" approach praised for function over form - clean > fancy
- Users expect to drill down from aggregate (overall ranking) to specific (per-league performance)
- Current platform has competition pages but may lack time-windowed breakdowns

**Sources:**
- [FBref UI Analysis](https://www.oreateai.com/blog/top-football-stats-websites-to-elevate-your-game-knowledge/2fdb584a6269b2e974720dc5cee903b6)
- [Best Football Stats Websites 2025](https://www.statshub.com/betting-academy/best-football-stats-websites)

---

### 3. Filtering & Sorting Capabilities

**Why expected:** Experienced users want to slice data by criteria that matter to them (favorite league, recent form, specific model types).

**What's required:**
- **Competition filter**: View leaderboard for Premier League only, or Champions League only
- **Time range filter**: Last 7 days, last 30 days, current season, all-time
- **Sort by multiple columns**: Total points, win rate, exact score %, streak, alphabetical
- **Persistent state**: Filters remembered between page loads (URL params or localStorage)
- **Clear active filters**: Visual indication of what filters are applied

**Complexity:** Medium (frontend state management + backend query optimization)

**Notes:**
- Research shows "filtering and sorting are essential features" for experienced users
- Users expect "intuitive sorting mechanisms" with "clear and consistent sorting options"
- Current platform has TanStack React Table which supports this, but may not expose all filters

**Sources:**
- [Leaderboard Filtering Best Practices](https://www.sportfitnessapps.com/blog/best-practices-for-designing-leaderboards)
- [Filter UI Design Best Practices](https://www.setproduct.com/blog/filter-ui-design)

---

### 4. Model/Player Detail Pages with Historical Track Record

**Why expected:** Users click into leaderboard entries to verify performance claims and see full history.

**What's required:**
- **Full prediction history**: Scrollable/paginated list of all predictions with outcomes
- **Visual indicators**: Green/red/yellow for exact/tendency/wrong predictions
- **Match context**: Date, competition, teams, actual score, predicted score, points earned
- **Downloadable data**: CSV export of prediction history (power users audit manually)
- **Stats dashboard**: Key metrics at top (accuracy, points, streaks) with sparklines/trends
- **Performance charts**: Win rate over time (line chart showing improvement/decline)

**Complexity:** Medium (data fetching optimization + chart libraries)

**Notes:**
- Transparency requirement: "Sites should allow bettors to audit performance themselves"
- Users specifically look for "ability to click through to see each day's results"
- Red flag: Sites that "quietly remove bad predictions from public view"

**Sources:**
- [Ruthless Review: Transparency in Sports Predictions](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)

---

### 5. Real-time Updates During Match Days

**Why expected:** Users return to check updated standings as matches complete, expect fresh data without manual refresh.

**What's required:**
- **Auto-refresh or polling**: Leaderboard updates every 60-120 seconds during match hours
- **Visual feedback**: "Last updated: 2 minutes ago" timestamp
- **Smooth transitions**: Animations when ranks change (not jarring jumps)
- **Loading states**: Skeleton loaders, not blank screens
- **Stale data indicators**: Warning if data is >10 minutes old

**Complexity:** Medium (polling implementation + cache invalidation coordination)

**Notes:**
- Research: "Real-time score updates keep users engaged with immediate feedback"
- 90% of users now use phones for analysis (mobile-first critical)
- Current platform has v1.0 fix for cache invalidation but may not have polling UI

**Sources:**
- [Real-time Leaderboard Best Practices](https://www.sportfitnessapps.com/blog/best-practices-for-designing-leaderboards)
- [2026 Sports Analytics Data Trends](https://www.nationalaccordnewspaper.com/the-science-of-probability-2026-research-in-sports-analytics/)

---

### 6. Honest Baseline Comparisons

**Why expected:** Users need context to judge if a model is actually good. "60% win rate" means nothing without knowing baseline is 50%.

**What's required:**
- **Random baseline**: Show "coin flip" accuracy (33.33% for 1X2, ~10% for exact scores)
- **Average performance**: Display leaderboard average or median as reference line
- **Betting odds baseline**: Favorite wins ~65% of time, show if models beat this
- **Comparison to humans**: If available, show how models compare to expert tipsters
- **Difficulty indicators**: Flag hard-to-predict leagues (lower accuracy is expected)

**Complexity:** Low (add calculated reference metrics to leaderboard)

**Notes:**
- Research: "Reliable doesn't mean 100%. Models still err on unpredictable games"
- Typical win rates: Casual bettor ~50%, AI-assisted ~60-70%, elite models 75-85%
- Current platform may lack this context, making 60% look bad when it's actually good

**Sources:**
- [AI Sports Prediction Accuracy Rates 2026](https://theaisurf.com/ai-sports-predictions-tools/)
- [Machine Learning Sports Betting Win Rates](https://wsc-sports.com/blog/industry-insights/machine-learning-sports-predictions-behind-big-wins/)

---

### 7. Mobile-Responsive Tables & Cards

**Why expected:** 90% of sports fans access statistics on mobile devices in 2026.

**What's required:**
- **Responsive breakpoints**: Desktop (full table), tablet (condensed columns), mobile (card view)
- **Horizontal scroll on tables**: If table too wide, enable smooth horizontal scrolling with sticky first column
- **Touch-friendly interactions**: Large tap targets (44px minimum), swipe gestures for navigation
- **Readable font sizes**: 14px minimum on mobile, sufficient contrast ratios
- **Progressive disclosure**: Show key stats first, "tap to expand" for details

**Complexity:** Medium (CSS responsive design + component variants)

**Notes:**
- Over 70% of sports fans access team websites on mobile in 2026
- Current platform has v1.0 mobile responsiveness fixes but may need iteration
- Critical: Match detail pages with 35 predictions must be scannable on mobile

**Sources:**
- [Sports Team Website Mobile Optimization](https://elementor.com/blog/how-to-create-a-sports-team-website/)
- [Sports Betting UX Mobile-First Design](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/)

---

## Differentiators

Features that set the platform apart from competitors. Not expected, but highly valued when present.

### 1. Model Calibration Metrics (Beyond Raw Accuracy)

**Value proposition:** Demonstrates sophistication and statistical rigor. Educates users on why "60% win rate, 58% calibration" is better than "94% accuracy."

**What it is:**
- **Calibration score**: How closely predicted probabilities match actual outcomes
- **Brier score**: Quantifies accuracy of probabilistic predictions (0 = perfect, 1 = worst)
- **Expected value (EV)**: Would following this model's predictions be profitable vs betting odds?
- **Confidence intervals**: Show uncertainty ranges (e.g., "60% ± 5%" vs claiming exact percentages)
- **Overconfidence indicators**: Flag models that predict 90% confidence but only win 60%

**Complexity:** High (requires probability tracking, not just score predictions - may need model output changes)

**Notes:**
- Research: "Calibration is a more important metric than accuracy for sports betting"
- This would be cutting-edge differentiation - most sites only show win rate
- Current platform predicts exact scores (2-1), may not track confidence levels per prediction

**Sources:**
- [Calibration vs Accuracy in Sports Betting](https://opticodds.com/blog/calibration-the-key-to-smarter-sports-betting)
- [ML Sports Betting Model Evaluation](https://arxiv.org/pdf/2303.06021)

---

### 2. Model "Personality" Profiles

**Value proposition:** Makes leaderboard engaging and memorable. Users develop favorites ("DeepSeek is cautious, Llama is aggressive").

**What it is:**
- **Prediction style classification**: Conservative (predicts draws often), aggressive (high-scoring predictions), contrarian (picks underdogs)
- **Risk profile**: Average confidence level, variance in predictions
- **League specialization**: "Claude Opus is best at Premier League, weak at Serie A"
- **Natural language descriptions**: "Mixtral favors home teams in tight matchups" (auto-generated from patterns)
- **Head-to-head rivalries**: "GPT-4 beats Claude 65% when they disagree"

**Complexity:** Medium (requires pattern analysis across predictions + narrative generation)

**Notes:**
- Makes AI vs AI comparison more narrative-driven, less dry statistics
- Opportunity to use LLMs to analyze LLM prediction patterns (meta-AI)
- Could drive social sharing ("My model has a personality!")

**Sources:**
- Inferred from gamification research: [Leaderboard Engagement Design](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/)

---

### 3. Visual Performance Comparisons (Radar Charts, Heatmaps)

**Value proposition:** Quick visual understanding of strengths/weaknesses. "This model is great at Premier League, terrible at Cup matches."

**What it is:**
- **Radar charts**: Multi-axis comparison (accuracy, consistency, boldness, league diversity)
- **Heatmaps**: League × model performance grid showing hot/cold spots
- **Sparklines in tables**: Tiny trend charts next to each model showing last 10 matches
- **Win probability curves**: Historical chart showing calibration drift over time
- **Comparison overlays**: Select 2-3 models, overlay their performance charts

**Complexity:** Medium (charting libraries + data aggregation for visualizations)

**Notes:**
- FBref praised for "impressive array of graphs and charts that make complex information digestible at a glance"
- Differentiates from pure-table competitors
- Mobile consideration: Charts must work on small screens (progressive disclosure)

**Sources:**
- [FBref Visualization Approach](https://www.sports-reference.com/blog/2022/10/fbref-leagues-%F0%9F%87%B5%F0%9F%87%B9-leagues-%F0%9F%87%A7%F0%9F%87%B7-leagues-%F0%9F%87%B2%F0%9F%87%BD-expanded-womens-and-mens-data-new-data-partner/)
- [10-Step Data Viz Guide for Sports](https://www.sportsmith.co/articles/10-step-data-viz-guide/)

---

### 4. Historical "What If" Scenarios

**Value proposition:** Engage power users who want to explore counterfactuals. "What if I followed only Claude's picks for Champions League?"

**What it is:**
- **Custom model portfolios**: Pick 3 models, see combined performance
- **Strategy backtesting**: "Always pick consensus prediction" vs "Always pick contrarian"
- **League-specific filtering**: "Show me top 5 models for Serie A only"
- **Time-window analysis**: "Which model was best in January 2026?"
- **Hypothetical betting bankroll**: "If you bet $10 per model prediction, P&L = ?"

**Complexity:** High (requires simulation engine + flexible querying)

**Notes:**
- Appeals to data-savvy users who want to "test hypotheses"
- Could drive return visits ("Let me check my strategy this week")
- Lower priority: Nice-to-have, not critical for trust

**Sources:**
- Inferred from prediction market features: [Best Prediction Market Apps 2026](https://www.legalsportsreport.com/prediction-markets/)

---

### 5. "Upset Detector" - Models Best at Picking Underdogs

**Value proposition:** Answers specific user question: "Which model is brave enough to pick upsets?"

**What it is:**
- **Underdog win rate**: Track accuracy when model predicts against betting favorite
- **Contrarian score**: How often model picks differently than consensus
- **High-value predictions**: Flag rare correct predictions that earned maximum quota points
- **Boldness leaderboard**: Separate ranking for "models that take risks and win"

**Complexity:** Low-Medium (requires betting odds integration to identify favorites)

**Notes:**
- Leverages Kicktipp quota scoring (rare correct predictions earn 6 points)
- Natural fit for "boldness vs accuracy" tradeoff discussion
- Could become signature feature ("We're the only site that ranks underdog specialists")

**Sources:**
- Inferred from quota scoring system and prediction market dynamics

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

### 1. Misleading "Overall Accuracy" Without Breakdown

**Why avoid:** This is exactly the trust-killing error causing the "94%" bug in current platform.

**What to do instead:**
- **Always show context**: "60% tendency accuracy, 15% exact score accuracy" not "60% accurate"
- **Multiple metrics side-by-side**: Win rate, exact score rate, points per match (no single "accuracy" number)
- **Denominator visibility**: Show "24/40 matches" not just "60%"
- **Avoid gaming metrics**: Don't count voided matches as wins, don't exclude tough leagues

**Why this matters:**
- Research shows experienced users immediately distrust sites that cherry-pick stats
- "Many sites quietly remove bad predictions from public view" - instant credibility loss
- Current platform's 94% bug is this exact anti-pattern

**Sources:**
- [Ruthless Review: Misleading Stats](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)
- Project context: v1.1 milestone fixing "IS NOT NULL vs > 0" mismatch causing 94% display

---

### 2. Real-Time Prediction Changes After Lineups

**Why avoid:** Destroys trust. Once a prediction is published (T-30m before kickoff), it must be immutable.

**What to do instead:**
- **Lock predictions at T-30m**: No edits after initial prediction
- **Show confidence change**: If lineup news would change prediction, show "Model would now pick 2-0 (was 1-0)" as note, but don't change recorded prediction
- **Audit trail**: If correction needed (API error), show strikethrough of old prediction with timestamp

**Why this matters:**
- Platforms that edit predictions retroactively are called out as fraudulent
- Users screenshot predictions to verify later - edits are caught immediately
- Current platform locks predictions at kickoff, this is correct approach

**Sources:**
- [Sports Prediction Platform Transparency](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)

---

### 3. Showing Only Top Performers (Survivorship Bias)

**Why avoid:** If you only show models with >65% win rate, you're hiding 25 failing models and misrepresenting overall performance.

**What to do instead:**
- **Show all active models**: Even if some have 40% win rate
- **Flag sample size**: "Only 3 predictions - not enough data yet"
- **Explain failures**: "Model disabled due to API errors" not quietly hidden
- **Historical inclusion**: Keep disabled models in leaderboard with "inactive" flag

**Why this matters:**
- Showing only winners makes platform look like marketing, not science
- Research: "Sites that let you filter... so you can spot consistency—or lack thereof—over time" are trusted
- Current platform shows all 35 models, this is correct approach

**Sources:**
- [Prediction Platform Trust Factors](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)

---

### 4. Claiming "AI Predictions" Without Model Attribution

**Why avoid:** Users want to know WHICH model made prediction. Aggregating "AI says 2-1" removes accountability.

**What to do instead:**
- **Individual model predictions**: Show all 35 models separately
- **Consensus as supplement**: "28 of 35 models predict home win" is fine as addition, not replacement
- **Model methodology visible**: Link to Together AI model cards for technical specs
- **No black-box aggregation**: Don't create "AI Aggregate Score" that obscures individual models

**Why this matters:**
- Transparency is primary trust driver
- Users want to pick favorite models and follow them specifically
- Current platform shows all 35 individually, this is correct approach

**Sources:**
- [AI Sports Betting Transparency 2026](https://www.parlaysavant.com/insights/mastering-ai-sports-betting-predictions)

---

### 5. "Guaranteed Wins" or Overpromising Accuracy Claims

**Why avoid:** Sports prediction is inherently uncertain. Even 85% accuracy means 15% wrong. Overpromising kills trust.

**What to do instead:**
- **Honest expectations**: "Best models achieve 60-75% win rate, significantly above 50% baseline"
- **Show failure cases**: Highlight interesting wrong predictions, explain why
- **Probabilistic language**: "Model confident in home win" not "guaranteed home win"
- **Embrace uncertainty**: "Football is unpredictable - that's what makes it interesting"

**Why this matters:**
- Research: "Reliable doesn't mean 100%. Models still err on unpredictable games"
- Over-promising leads to user disappointment and churn
- Under-promising and over-delivering builds long-term trust

**Sources:**
- [AI Sports Predictions Accuracy Reality Check](https://theaisurf.com/ai-sports-predictions-tools/)

---

## SEO-Specific Features

Features specifically for search engine visibility and discoverability.

### 1. Schema.org Structured Data Markup

**Why critical:** Enables rich snippets in Google search results, dramatically increasing click-through rate.

**What's required:**

**SportsEvent Schema** for each match:
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Manchester United vs Liverpool",
  "sport": "Soccer",
  "startDate": "2026-02-15T15:00:00Z",
  "location": {
    "@type": "Place",
    "name": "Old Trafford"
  },
  "homeTeam": {
    "@type": "SportsTeam",
    "name": "Manchester United"
  },
  "awayTeam": {
    "@type": "SportsTeam",
    "name": "Liverpool"
  },
  "competitor": [
    {"@type": "SportsTeam", "name": "Manchester United"},
    {"@type": "SportsTeam", "name": "Liverpool"}
  ]
}
```

**Article Schema** for blog posts:
- Enables "Top Stories" carousel placement
- Requires: headline, image, datePublished, author, publisher

**FAQPage Schema** for methodology page:
- Shows expandable Q&A directly in search results
- Questions like "How is accuracy calculated?" "What is Kicktipp scoring?"

**BreadcrumbList Schema**:
- Shows navigation path in search results
- Example: Home > Leaderboard > Claude Opus

**Complexity:** Low (JSON-LD injection in Next.js pages)

**Sources:**
- [Schema.org SportsEvent Documentation](https://schema.org/SportsEvent)
- [Schema Markup for Sports Websites](https://www.linkedin.com/advice/1/what-best-schema-types-sports-fitness)
- [Structured Data SEO Impact 2026](https://meetanshi.com/blog/google-rich-snippets-for-seo/)

---

### 2. Rich Snippet Optimization

**Why critical:** Rich results capture 58% of all clicks. Featured snippets get 31% more clicks than regular results.

**What's required:**
- **Statistics in title tags**: "Claude Opus: 62% Win Rate (24/40 Matches) - AI Football Predictions"
- **Meta descriptions with numbers**: Include concrete stats, not generic descriptions
- **Table markup**: Use proper `<table>` HTML for leaderboards so Google can extract
- **List structures**: Use `<ul>` or `<ol>` for rankings to trigger list snippets
- **Definition formatting**: Methodology explanations formatted as Q&A for featured snippet eligibility
- **Image alt text**: Descriptive alt tags for charts ("Line chart showing Claude Opus accuracy improving from 55% to 65% over 3 months")

**Complexity:** Low (primarily semantic HTML + metadata optimization)

**Notes:**
- Featured snippets appear at "position zero" before organic results
- Rich snippets don't directly improve ranking but increase CTR significantly
- Current platform likely needs metadata audit

**Sources:**
- [Rich Snippets SEO Impact 2026](https://www.seoraf.com/do-rich-snippets-help-seo/)
- [Featured Snippets Statistics 2026](https://dndseoservices.com/blog/seo-statistics-benchmarks-2026/)

---

### 3. Programmatic SEO: Model × Competition Landing Pages

**Why valuable:** Creates hundreds of indexed pages targeting long-tail queries like "Claude Opus Premier League predictions" or "Best AI model for Champions League."

**What's required:**
- **Dynamic page generation**: `/models/[modelId]/[competitionSlug]` pages
- **Unique content per page**: Not duplicate - each page shows model's specific performance for that competition
- **Internal linking**: Competition pages link to top 5 models for that competition
- **Canonical tags**: Prevent duplicate content issues
- **Sitemap inclusion**: All programmatic pages in XML sitemap

**Example pages:**
- `/models/claude-opus/premier-league` - "Claude Opus: 70% accuracy in Premier League (14/20)"
- `/models/deepseek/champions-league` - "DeepSeek: 55% accuracy in Champions League (11/20)"
- `/competitions/premier-league/models` - "Best AI Models for Premier League Predictions"

**Complexity:** Medium (Next.js dynamic routes + data fetching for all combinations)

**Notes:**
- With 35 models × 17 competitions = 595 potential landing pages
- Each targets specific long-tail search queries
- Must ensure each page has unique, valuable content (not thin doorway pages)

**Sources:**
- Inferred from SEO best practices and programmatic page strategies

---

### 4. XML Sitemap with Priority & Changefreq

**Why important:** Helps search engines discover and prioritize pages for crawling.

**What's required:**
- **Sitemap structure**: Separate sitemaps for static pages, models, matches, blog posts
- **Priority tags**: Homepage (1.0), leaderboard (0.9), model pages (0.8), match pages (0.7), blog (0.6)
- **Change frequency**: Homepage (daily), leaderboard (daily), matches (weekly after settlement), blog (monthly)
- **Last modified dates**: Accurate timestamps for cache control
- **Image sitemaps**: Separate sitemap for performance charts and OG images

**Complexity:** Low (Next.js sitemap.ts generation)

**Notes:**
- Current platform has sitemap (recent commit: "reorganize into scalable multi-sitemap architecture")
- May need priority/changefreq optimization

**Sources:**
- Recent git commit: "feat(sitemap): reorganize into scalable multi-sitemap architecture"

---

### 5. Open Graph & Twitter Card Optimization

**Why important:** Social shares drive traffic. Rich previews increase click-through rate from social media by 2-3x.

**What's required:**
- **Dynamic OG images**: Generate image per model/match with key stats overlaid
- **Specific titles**: "Claude Opus: 62% Win Rate | AI Football Predictions" not generic "Leaderboard"
- **Description with hooks**: "Claude Opus correctly predicted 24 of 40 matches in Premier League. See full prediction history."
- **Type declarations**: `og:type="website"` for pages, `article` for blog posts
- **Twitter card type**: `summary_large_image` for leaderboard, `summary` for text pages

**Example for model page:**
```html
<meta property="og:title" content="Claude Opus: 62% Win Rate (24/40 Matches)" />
<meta property="og:description" content="Claude Opus AI model predictions for football matches. View full prediction history, accuracy stats, and performance charts." />
<meta property="og:image" content="/og/models/claude-opus.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

**Complexity:** Medium (dynamic image generation + metadata per page type)

**Notes:**
- Current platform has OG image bug: "showing exact score % labeled as accuracy"
- This is exactly the type of detail that matters for social sharing trust

**Sources:**
- Project context: Known issue "OG image showing exact score % labeled as accuracy"

---

### 6. Internal Linking Strategy

**Why important:** Helps search engines understand site structure and passes PageRank between related pages.

**What's required:**
- **Contextual links**: Model pages link to their best competitions, competition pages link to top models
- **Breadcrumbs**: Every page shows path (Home > Leaderboard > Claude Opus)
- **Related models**: "Similar performance" links on model pages
- **Top performers sidebar**: Every page has "Top 5 Models This Week" widget
- **Blog post links**: Roundups link to specific models and matches mentioned
- **Anchor text variety**: Use descriptive anchors ("Claude Opus 62% win rate") not generic ("click here")

**Complexity:** Low-Medium (template updates + query optimization)

**Notes:**
- Internal links help both SEO and user navigation
- FBref's extensive cross-linking between players/teams/leagues is part of their SEO success

**Sources:**
- [SEO Best Practices 2026](https://content-whale.com/blog/best-seo-practices-2026/)

---

### 7. Performance Optimization (Core Web Vitals)

**Why important:** Page speed is direct ranking factor. Mobile performance especially critical (70%+ of traffic).

**What's required:**
- **LCP < 2.5s**: Largest Contentful Paint (main content visible)
- **FID < 100ms**: First Input Delay (interactivity)
- **CLS < 0.1**: Cumulative Layout Shift (visual stability)
- **Image optimization**: WebP format, responsive sizes, lazy loading
- **Code splitting**: Load leaderboard JavaScript only on leaderboard page
- **CDN for static assets**: Charts, images served from edge

**Complexity:** Medium (Next.js optimization + CDN configuration)

**Notes:**
- Current platform: Next.js 16 has built-in optimizations but may need tuning
- Match detail pages with 35 predictions noted as "slow" in PROJECT.md (v1.0 fixed)

**Sources:**
- [SEO Best Practices 2026: Core Web Vitals](https://svitla.com/blog/seo-best-practices/)
- [Sports Website Mobile Performance](https://elementor.com/blog/how-to-create-a-sports-team-website/)

---

## Feature Dependencies

Understanding which features must be built before others.

```
┌─────────────────────────────────────┐
│  Transparent Accuracy Calculations  │ ◄─── FOUNDATION (fixes 94% bug)
│  (correct formulas, consistent)     │
└─────────────────┬───────────────────┘
                  │
                  ├─────────────────────────────────────┐
                  │                                     │
                  ▼                                     ▼
    ┌──────────────────────────┐        ┌──────────────────────────┐
    │  Performance Breakdowns  │        │  Model Detail Pages      │
    │  (time, competition)     │        │  (historical tracking)   │
    └──────────────┬───────────┘        └──────────────┬───────────┘
                   │                                    │
                   └───────────┬────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │  Filtering & Sorting         │
                │  (requires clean data layer) │
                └──────────────┬───────────────┘
                               │
                ┌──────────────┴───────────────┬──────────────────────┐
                │                              │                      │
                ▼                              ▼                      ▼
    ┌──────────────────┐        ┌──────────────────────┐  ┌─────────────────┐
    │  Visual Charts   │        │  Real-time Updates   │  │  SEO Features   │
    │  (differentiator)│        │  (table stakes UX)   │  │  (discoverability)│
    └──────────────────┘        └──────────────────────┘  └─────────────────┘
```

**Critical path:**
1. **Fix accuracy calculations first** - Without correct base metrics, everything else is built on broken foundation
2. **Build performance breakdowns** - Requires consistent accuracy definitions
3. **Add filtering/sorting** - Depends on clean, queryable data structure
4. **Layer on visualizations** - Charts visualize the correct underlying data
5. **Implement SEO in parallel** - Can happen alongside UX features

---

## MVP Feature Recommendation for v1.1

Based on project context (fixing 94% accuracy bug + adding SEO), prioritize:

### Phase 1: Fix Trust Issues (Critical - Blocks Everything)

1. **Correct accuracy calculations** - Fix IS NOT NULL vs > 0, add NULLIF() protection
2. **Transparent metric display** - Show denominators (24/40 not just 60%)
3. **Consistent definitions** - One definition of each metric used everywhere
4. **Methodology page** - Explain how every stat is calculated

**Why first:** Without trust, no one cares about SEO or features. This is existential.

### Phase 2: SEO Foundation (High Value, Low Effort)

1. **Schema.org markup** - SportsEvent, Article, BreadcrumbList structured data
2. **OG image fixes** - Stop showing "94% accuracy" in social shares
3. **Rich snippet optimization** - Semantic HTML, meta descriptions with stats
4. **XML sitemap optimization** - Priority tags, changefreq for different page types

**Why second:** These are "easy wins" that drive discoverability while trust is rebuilding.

### Phase 3: UX Polish (Deferred to v1.2+)

1. Model calibration metrics
2. Visual performance comparisons (charts)
3. "Upset detector" leaderboard
4. Historical "what if" scenarios

**Why deferred:** Nice-to-have differentiators. Users need to trust the basic stats first before caring about advanced features.

---

## Defer to Post-v1.1

Features valuable but not critical for trust/SEO milestone:

### Real-time Auto-refresh
**Reason to defer:** v1.0 fixed cache invalidation. Manual refresh acceptable for now. Polling adds complexity.

### Downloadable Prediction History CSV
**Reason to defer:** Power user feature. Small audience. UI display sufficient for v1.1.

### Model Personality Profiles
**Reason to defer:** Requires pattern analysis across predictions. Fun but not critical.

### Programmatic Model × Competition Pages
**Reason to defer:** 595 pages is large scope. Start with main leaderboard + model pages, expand later.

### Performance Charts (Radar, Heatmaps)
**Reason to defer:** Requires charting library integration + design work. Table stats sufficient initially.

---

## Feature Risk Assessment

| Feature | Implementation Risk | User Value | Priority |
|---------|-------------------|------------|----------|
| Transparent accuracy calculations | LOW (SQL fixes) | CRITICAL | P0 |
| Schema.org structured data | LOW (JSON-LD) | HIGH | P0 |
| Performance breakdown tables | MEDIUM (query optimization) | HIGH | P1 |
| Filtering & sorting | MEDIUM (state management) | HIGH | P1 |
| Model detail pages | LOW (template + queries) | HIGH | P1 |
| OG image fixes | LOW (metadata) | MEDIUM | P0 |
| Real-time updates | MEDIUM (polling) | MEDIUM | P2 |
| Model calibration metrics | HIGH (needs probability tracking) | MEDIUM | P3 |
| Visual charts | MEDIUM (charting lib) | MEDIUM | P2 |
| Programmatic pages | HIGH (595 pages) | MEDIUM | P3 |
| Historical scenarios | HIGH (simulation engine) | LOW | P4 |

**P0 = Critical for v1.1, P1 = High priority, P2 = Medium priority, P3 = Low priority, P4 = Backlog**

---

## Confidence Assessment

| Feature Category | Confidence Level | Evidence Source |
|-----------------|------------------|-----------------|
| Table stakes accuracy features | HIGH | Multiple sports prediction platform reviews, research papers |
| SEO features (Schema.org, OG) | HIGH | Official Schema.org docs, SEO statistics 2026 |
| Leaderboard UX patterns | HIGH | Sports stats site analysis (FBref, ESPN), UX research |
| Calibration metrics | MEDIUM | Academic research on sports betting, may be too advanced for general users |
| Visual comparisons | HIGH | FBref case study, data visualization best practices |
| Anti-features | HIGH | Direct quotes from prediction platform reviews about trust issues |

**Overall confidence: HIGH for table stakes and SEO, MEDIUM for advanced differentiators**

---

## Sources

### Sports Prediction Transparency & Trust
- [Ruthless Review of Sports Prediction Platforms](https://www.ruthlessreviews.com/featured-posts/a-ruthless-review-of-sports-prediction-platforms/)
- [Calibration Over Accuracy in Sports Betting](https://opticodds.com/blog/calibration-the-key-to-smarter-sports-betting)
- [ML Sports Betting Model Evaluation](https://arxiv.org/pdf/2303.06021)
- [Sports Prediction Accuracy Analysis](https://cswsport.org.uk/do-football-prediction-sites-work-analyzing-their-accuracy-and-effectiveness/)

### Accuracy Rates & Expectations
- [AI Sports Prediction Tools 2026](https://theaisurf.com/ai-sports-predictions-tools/)
- [Machine Learning Sports Predictions](https://wsc-sports.com/blog/industry-insights/machine-learning-sports-predictions-behind-big-wins/)
- [AI Sports Betting Strategies 2026](https://www.parlaysavant.com/insights/mastering-ai-sports-betting-predictions)

### Sports Statistics UX & Design
- [FBref UI Analysis](https://www.oreateai.com/blog/top-football-stats-websites-to-elevate-your-game-knowledge/2fdb584a6269b2e974720dc5cee903b6)
- [Best Football Stats Websites 2025](https://www.statshub.com/betting-academy/best-football-stats-websites)
- [Leaderboard Design Best Practices](https://www.sportfitnessapps.com/blog/best-practices-for-designing-leaderboards)
- [Filter UI Design](https://www.setproduct.com/blog/filter-ui-design)
- [Leaderboard Engagement Strategies](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/)

### SEO & Structured Data
- [Schema.org SportsEvent](https://schema.org/SportsEvent)
- [Schema Markup for Sports Websites](https://www.linkedin.com/advice/1/what-best-schema-types-sports-fitness)
- [Google Rich Snippets Guide 2026](https://meetanshi.com/blog/google-rich-snippets-for-seo/)
- [Rich Snippets SEO Impact 2026](https://www.seoraf.com/do-rich-snippets-help-seo/)
- [SEO Statistics 2026](https://dndseoservices.com/blog/seo-statistics-benchmarks-2026/)
- [SEO Best Practices 2026](https://svitla.com/blog/seo-best-practices/)
- [Sports Team Website SEO](https://elementor.com/blog/how-to-create-a-sports-team-website/)

### Sports Analytics & Data Trends
- [2026 Sports Analytics Data Trends](https://www.nationalaccordnewspaper.com/the-science-of-probability-2026-research-in-sports-analytics/)
- [Sports Data Visualization Guide](https://www.sportsmith.co/articles/10-step-data-viz-guide/)

---

*Research completed: 2026-02-02*
*Confidence: HIGH for table stakes features and SEO, MEDIUM for advanced differentiators*
*Context: This research directly addresses the v1.1 milestone goal of fixing stats accuracy issues and adding SEO to build user trust.*
