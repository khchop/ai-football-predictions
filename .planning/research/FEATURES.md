# Feature Landscape: UI/UX Overhaul

**Domain:** Sports prediction platform
**Researched:** 2026-02-02
**Confidence:** HIGH (verified against multiple authoritative sources)

## Table Stakes

Features users expect. Missing = product feels incomplete or unprofessional.

### Navigation & Layout

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Bottom navigation bar** | 21% faster navigation, thumb-zone optimized (bottom 45% = easy reach) | Medium | None | 4-5 items max. Height 56-64px. Icons + labels (92% correct interpretation vs 73% icon-only) |
| **Mobile-first responsive design** | 64.95% of sports fans access on mobile; 5x abandonment for non-mobile-friendly | High | Design system | Build mobile-first, adapt up to desktop. Not the reverse. |
| **Touch targets 44x44px minimum** | Already validated in v1.3 (MOBL-06); accessibility standard | Low | Already done | Verify in redesign |
| **Fast page loads (<2.5s LCP)** | Google CWV threshold; 24% less abandonment when met | High | ISR, lazy loading | Already have ISR (60s revalidate) |
| **Sticky header with score** | Users on mobile want score visible while scrolling stats | Low | Already have | Already implemented; preserve in redesign |
| **Clear visual hierarchy** | Sports fans scanning for quick info; reduces cognitive load | Medium | Design system | Headers, spacing, contrast ratios |
| **Breadcrumb navigation** | SEO benefit + user orientation; already have schema | Low | Already have | Already implemented |

### Match Pages

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Live score updates** | 92% of fans say most important feature | Low | Already built | Already have WebSocket/polling |
| **Match events timeline** | Users expect goals, cards, subs chronologically | Low | Already built | Have MatchEvents component |
| **Score + team crests prominent** | Visual anchor, instant recognition | Low | MatchHeader | Already have; verify in redesign |
| **Match status indicator** | Upcoming/Live/Finished clear at glance | Low | Already built | Badge or visual state |
| **Tabbed content organization** | Already validated v1.3 (MOBL-04); reduces scroll fatigue | Low | Already built | Summary/Stats/Predictions/Analysis |

### Leaderboard

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Sortable columns** | Users expect to sort by different metrics | Low | Already built | Have LeaderboardTable |
| **Filter by competition** | Users want league-specific rankings | Low | Already built | LeaderboardFilters component |
| **Scoring system explanation** | Without explanation, numbers meaningless | Low | Already built | Kicktipp scoring card |
| **Model profile links** | Click model to see details | Low | Already built | Links to /models/[id] |

### Blog/Content

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Readable line width** | 600-700px optimal; current blog is full-width | Low | CSS update | max-w-prose or max-w-2xl |
| **Clear typography hierarchy** | Headers, body, captions distinct | Medium | Design system | Already have ReactMarkdown styling |
| **Estimated read time** | Busy users appreciate time expectation | Low | Word count calc | Add to blog metadata display |
| **Back to list navigation** | Users expect easy return; already have | Low | Already built | ArrowLeft link |
| **Publication date** | Trust signal; already have | Low | Already built | Calendar icon + date |

### SEO/GEO Fundamentals

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Schema.org structured data** | Already have; maintain/expand | Medium | Already built | SportsEvent, Article, BreadcrumbList |
| **Canonical URLs** | Prevent duplicate content issues | Low | Already built | alternates.canonical |
| **Meta descriptions <160 chars** | Already validated v1.1 (SEO-06) | Low | Already done | Maintain |
| **Open Graph images** | Social sharing previews | Low | Already built | /api/og/* routes |
| **robots.txt + llms.txt** | Already validated v1.3 (SRCH-01, SRCH-02) | Low | Already done | Maintain |

---

## Differentiators

Features that set platform apart. Not expected, but create competitive advantage.

### AI Citation Optimization (GEO)

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **FAQ sections on all major pages** | 3.2x more likely to appear in AI Overviews; 28% more AI citations with FAQ schema | Medium | FAQPage schema | Already have on leaderboard; expand to match, league, model pages |
| **Question-answer format content** | Matches how AI platforms present info; reduces interpretive burden | Medium | Content templates | Structure content as Q&A where natural |
| **Structured comparison tables** | AI platforms favor comparison content for citation | Medium | Component library | Model vs model, league vs league comparisons |
| **Recent content updates** | Content updated within 30 days earns 3.2x more AI citations | Low | Existing pipeline | Post-match roundups already provide this |
| **Original research/data** | 4.1x more citations for original research | Low | Existing data | Our 35-model benchmark IS original research - emphasize this |
| **Encyclopedia-style neutral tone** | ChatGPT favors neutral, authoritative content | Medium | Content guidelines | Match analysis should be factual, not hype |

### Internal Linking Excellence

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Contextual body links** | Most valuable for SEO; "editorial endorsements" | High | Content analysis | Auto-link team names, model names, competitions in text |
| **Related matches widget** | Already validated v1.2 (SEO-T11); drives discovery | Low | Already built | Cross-links between related matches |
| **Related models widget** | Already validated v1.2 (SEO-T12); cross-page linking | Low | Already built | "Related models" on model pages |
| **Recent predictions widget** | Already validated v1.2 (SEO-T13); competition pages | Low | Already built | On competition/league pages |
| **Sidebar "Popular this week"** | Curated evergreen content; rotate monthly | Medium | Analytics integration | 1-3 top articles with thumbnails |
| **Dynamic related posts** | Topic clusters; avoid cross-topic recent posts | Medium | Content categorization | Related posts on article pages based on category |

### Speed-Optimized Navigation

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Prefetch on hover/focus** | Instant perceived navigation | Medium | Next.js Link | Use prefetch prop strategically |
| **Skeleton loading states** | Perceived speed; already have some | Low | Component library | Consistent skeleton patterns |
| **Predictive preloading** | AI-driven preload of likely next pages | High | Analytics + ML | Advanced; defer to later phase |
| **Progressive disclosure** | Already validated v1.3 (MOBL-03); reduces initial load | Low | Already built | Collapse advanced stats |

### Leaderboard Gamification

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Micro-leaderboards** | Regional/competition-specific reduces demoralization | Low | Filter system | Already have competition filter |
| **Time-based leaderboards** | Weekly/monthly fresh start increases engagement | Low | Time filters | Add "This Week" / "This Month" views |
| **Streak badges** | Visual recognition of consistent performance | Medium | Streak tracking | Already track streaks in DB |
| **Model performance trends** | Line chart showing improvement/decline over time | Medium | Chart component | Adds "story" to static numbers |
| **Position change indicators** | Up/down arrows showing rank movement | Low | Historical data | Compare current vs previous period |

### Mobile UX Excellence

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Swipe gestures between tabs** | Already validated v1.3 (MOBL-05); native feel | Low | Already built | react-swipeable |
| **Pull-to-refresh** | Native mobile pattern for live content | Medium | React hook | Add to match pages, leaderboard |
| **Floating action button** | Quick access to key actions in thumb zone | Medium | Component | "Share" or "Favorites" quick action |
| **Collapsible sections** | Already have; ensure consistent pattern | Low | Component library | Standardize accordion behavior |
| **Bottom sheet modals** | Native mobile pattern; thumb-friendly | Medium | Component library | For filters, sharing, etc. |

### Content Engagement

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Table of contents (long posts)** | Improves navigation for 1500+ word posts | Low | Auto-generate from headers | Add to blog posts |
| **Sticky sharing buttons** | Always accessible without scroll-back | Low | CSS position:sticky | Mobile: bottom bar; Desktop: sidebar |
| **Content chunking with "Read More"** | Already validated v1.3 (CONT-05); manages long content | Low | Already built | Preserve pattern |
| **Reading progress indicator** | Engagement signal; encourages completion | Low | Scroll listener | Thin progress bar at top |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

### Avoid: Over-Gamification

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Achievement badges everywhere** | Users came for predictions, not badge collecting; creates noise | Subtle streak indicators only; no badge pop-ups |
| **Points for user actions** | View-only platform; no user accounts to track | Keep gamification in model competition only |
| **Daily login rewards** | No user accounts; creates obligation anxiety | N/A - not possible |
| **Competitive pressure notifications** | No user accounts; would require engagement dark patterns | Clean notification-free experience |

### Avoid: Information Overload

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **All 35 model predictions visible at once** | Overwhelming; cognitive overload | Already solved with expandable section (MOBL-02) |
| **Every stat metric on initial view** | Users need progressive discovery | Progressive disclosure (MOBL-03) already implemented |
| **Auto-playing video content** | Bandwidth intensive; annoying on mobile | Static content; user-initiated only |
| **Infinite scroll for match lists** | SEO-unfriendly; users can't bookmark positions | Paginated with unique URLs; load-more button if needed |
| **Live ticker/marquee** | Distracting; accessibility issue | Static last-updated timestamp |

### Avoid: Dark Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Forced newsletter popups** | View-only platform; creates friction | No popups; footer signup if added later |
| **Interstitial ads** | Destroys trust and UX | No ads (current model) |
| **Hidden navigation** | Hamburger-only nav fails 62% of users | Bottom nav + hamburger for secondary items |
| **Fake urgency indicators** | Betting adjacent = scrutinized; trust critical | Honest match status only |
| **Social proof manipulation** | "42 people viewing" etc.; erodes trust | No fake metrics |

### Avoid: Performance Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Lazy-loading above-fold content** | Causes visible content delay; hurts LCP | Eager load above fold; lazy load below |
| **Third-party script bloat** | Analytics, chat widgets compete for bandwidth | Minimal scripts; defer non-critical |
| **Uncompressed images** | Largest cause of slow LCP | WebP format; proper sizing; responsive images |
| **Layout shift from ads/content** | CLS penalty; user frustration | Reserve space before load; no ads |
| **Redirect chains** | Already fixed (SEO-T02); avoid recreating | Direct links always |

### Avoid: SEO Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Orphan pages** | Not discoverable by crawlers | Every page linked from at least one other |
| **Thin content pages** | Low value for SEO; may be ignored | Add FAQ sections; ensure substantive content |
| **Generic anchor text** | "Click here" doesn't help SEO | Descriptive anchor text: "Premier League predictions" |
| **Multiple pages for similar content** | Keyword cannibalization | Single comprehensive page per topic |
| **Heavy client-side rendering** | AI crawlers struggle; already fixed (SRCH-04) | SSR for all content |

### Avoid: Mobile Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Top-only navigation** | Hard to reach zone (top 25%); 21% slower | Bottom navigation for primary actions |
| **Small tap targets** | Already validated minimum 44x44 (MOBL-06) | Maintain minimum sizes |
| **Hover-dependent interactions** | Touch has no hover state | Always show interaction affordances |
| **Fixed position elements covering content** | Reduces readable area on small screens | Minimal fixed elements; collapse on scroll |
| **Horizontal scrolling** | Unexpected on mobile; breaks mental model | Vertical scroll only; responsive tables |

---

## Feature Dependencies

```
Design System
    |
    +-- Navigation Components
    |       +-- Bottom Nav Bar
    |       +-- Header (existing)
    |       +-- Breadcrumbs (existing)
    |
    +-- Content Components
    |       +-- FAQ Section
    |       +-- Internal Link Widgets
    |       +-- Read More/Progressive Disclosure (existing)
    |
    +-- Data Display Components
            +-- Leaderboard Table (existing)
            +-- Match Card
            +-- Model Card
            +-- Trend Charts (new)

Internal Linking System
    |
    +-- Auto-linker (content analysis)
    |       |
    |       +-- Team entity recognition
    |       +-- Model entity recognition
    |       +-- Competition entity recognition
    |
    +-- Related Content Widgets (existing)
    |       +-- Related Matches
    |       +-- Related Models
    |       +-- Recent Predictions
    |
    +-- Sidebar Widgets (new)
            +-- Popular This Week
            +-- Related Posts

GEO Optimization
    |
    +-- FAQ Schema (expand existing)
    |       +-- Match page FAQs
    |       +-- League page FAQs
    |       +-- Model page FAQs
    |
    +-- Content Structure
            +-- Q&A format templates
            +-- Comparison tables
```

---

## MVP Recommendation

For UI/UX overhaul MVP, prioritize:

### Phase 1: Foundation (Must Have)
1. **Design system refresh** - Colors, typography, spacing, component library
2. **Bottom navigation** - Mobile-first navigation pattern
3. **Blog readability fix** - Line width, typography, read time

### Phase 2: GEO Enhancement
4. **FAQ sections on all pages** - Expand from leaderboard to match, league, model
5. **Internal linking widgets** - Consistent sidebar pattern across pages

### Phase 3: Polish
6. **Leaderboard enhancements** - Time filters, trend indicators
7. **Speed optimization** - Prefetch, skeleton consistency

### Defer to Post-MVP
- **Predictive preloading** - Requires analytics + ML; high complexity
- **Pull-to-refresh** - Nice-to-have, not critical
- **Reading progress indicator** - Minor enhancement
- **Model comparison tables** - Valuable but scope creep risk
- **Achievement badges** - Avoid over-gamification

---

## Sources

### UI/UX Design Patterns
- [Sports Betting App UX & UI in 2026](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/) - Mobile-first, personalization, live betting UX
- [Sportsbook UX Design Tips](https://altenar.com/blog/how-to-design-a-sportsbook-user-experience-ux-that-wins-in-live-play/) - Live play design, stability during updates
- [Mobile-First Sportsbook Design](https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435) - Thumb zone, performance
- [10 UI/UX Design Challenges in Sports Betting Apps](https://sportbex.com/blog/ui-ux-design-challenges-in-sports-betting-apps/) - Common challenges and solutions

### AI Citation Optimization (GEO)
- [AI Platform Citation Patterns](https://www.tryprofound.com/blog/ai-platform-citation-patterns) - ChatGPT vs Perplexity vs Google AI Overviews
- [How to Get Cited by AI](https://searchengineland.com/how-to-get-cited-by-ai-seo-insights-from-8000-ai-citations-455284) - 8,000 citation analysis
- [2025 AI Visibility Report](https://thedigitalbloom.com/learn/2025-ai-citation-llm-visibility-report/) - 4.1x citations for original research
- [FAQ Schema for AI Search](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) - 3.2x more AI Overview appearances

### Internal Linking
- [Internal Linking for SEO](https://yoast.com/internal-linking-for-seo-why-and-how/) - Types and value hierarchy
- [How to Create Sidebars That Help SEO](https://www.siegemedia.com/seo/create-sidebars-help-seo) - Widget strategies
- [Internal Linking Best Practices](https://www.6thman.digital/articles/internal-linking-best-practices-for-2025) - Contextual links most valuable

### Mobile Navigation
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) - Bottom nav patterns
- [Thumb-Zone Optimization](https://webdesignerindia.medium.com/thumb-zone-optimization-mobile-navigation-patterns-9fbc54418b81) - 55% reduced user effort
- [Mobile UX Design Trends 2026](https://webdesignerindia.medium.com/10-mobile-ux-design-trends-2026-231783d97d28) - Emerging patterns

### Performance & Core Web Vitals
- [Core Web Vitals Optimization Guide 2026](https://skyseodigital.com/core-web-vitals-optimization-complete-guide-for-2026/) - LCP, CLS, INP thresholds
- [Core Web Vitals 2026: Technical SEO](https://almcorp.com/blog/core-web-vitals-2026-technical-seo-guide/) - Tiebreaker for rankings
- [Lazy Loading Best Practices](https://nitropack.io/blog/what-is-lazy-loading/) - When and how to lazy load

### Competitor Analysis
- [FotMob vs SofaScore Comparison](https://www.saashub.com/compare-fotmob-vs-sofascore) - UI design differences
- [FotMob Case Study](https://sevenpeakssoftware.com/case-studies/app-for-football/) - UX improvements
- [FotMob User Insights](https://www.anecdoteai.com/insights/fotmob) - User feedback patterns

### Blog Design
- [Blog Layout Best Practices 2025](https://www.linnworks.com/blog/blog-layout-best-practices/) - Line width, whitespace
- [12 Blog Layout Best Practices](https://www.impactplus.com/blog/blog-layout-best-practices) - Hero images, CTAs
- [Sports Website Design](https://seahawkmedia.com/design/sports-website-design/) - Sports-specific patterns

### Gamification
- [How to Design Effective Leaderboards](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/) - Micro-leaderboards, refresh cycles
- [Gamification Strategy: Leaderboards](https://medium.com/design-bootcamp/gamification-strategy-when-to-use-leaderboards-7bef0cf842e1) - When to use, when to avoid

---

*Confidence: HIGH - Cross-referenced multiple sources; patterns consistent across sports betting, sports stats, and general mobile UX literature. Existing implementation already validates many patterns (v1.3 requirements).*
