# Features Research: Match Page UX Redesign

**Domain:** Mobile-first AI sports prediction platform
**Research Date:** 2026-02-02
**Focus:** Match detail page consolidation and mobile UX patterns
**Confidence:** MEDIUM (verified with competitor analysis, mobile UX principles)

## Summary

Best-in-class sports prediction sites in 2026 prioritize mobile-first design with progressive disclosure, tabbed navigation, and aggressive de-duplication. The dominant pattern is a persistent sticky header showing live score, followed by tabbed sections (Summary/Stats/Predictions/Odds) that prevent vertical scroll fatigue. AI-generated narrative content is displayed in digestible chunks (150-200 words) with "Read More" expansion, not full articles. The key insight: users expect single-source-of-truth for each data point - score appears once (sticky header), predictions appear once (dedicated tab), not scattered across 10+ cards.

## Table Stakes (Must Have for Mobile Match Pages)

### Score & Header Management
- **Persistent Sticky Header**: Score stays visible during scroll, contextually shows (Complexity: Low)
  - Only ONE score display on entire page (in sticky header)
  - Team logos, match status badge (Live/FT/Pre-match)
  - Auto-hides on scroll down, reveals on scroll up (typical mobile pattern)
  - Source: ESPN, SofaScore pattern; reduces duplicate score displays

- **Match Status Indicators**: Clear visual differentiation for pre/live/post-match (Complexity: Low)
  - Color-coded status badges (green=live, gray=finished, blue=upcoming)
  - Time display changes contextually (countdown → live clock → final whistle time)
  - Source: FlashScore, theScore apps

### Content Organization
- **Tabbed Navigation**: Primary pattern for organizing dense match information (Complexity: Medium)
  - Standard tabs: Summary | Stats | Predictions | Odds | [Timeline/Events]
  - Summary tab = most important info only (recent form, key stats, venue)
  - Each tab is single-source-of-truth for its domain (no duplication across tabs)
  - Source: FlashScore full-page redesign, SofaScore mobile pattern
  - Dependencies: Requires refactoring current card-based layout

- **Progressive Disclosure**: Show essentials, hide advanced features until requested (Complexity: Medium)
  - Collapsed sections with "Show More" for secondary information
  - Advanced stats behind expansion (xG details, model breakdowns)
  - Source: Nielsen Norman Group 2026 best practices, mobile IA principles
  - Critical for mobile: users engage 15-30 second bursts, need quick task completion

### Prediction Display
- **Consolidated Prediction Panel**: Single location for all AI predictions (Complexity: Medium)
  - Lives in dedicated "Predictions" tab, not scattered across page
  - Top 3-5 models highlighted with consensus view
  - Full model table behind "View All 35 Models" expansion
  - Source: Sports-AI.dev card pattern, Rithmm "Smart Signals" approach
  - Eliminates current duplication: table + roundup HTML + top performers

- **Narrative Prediction Summary**: AI-generated explanation (150-200 words max) (Complexity: Low)
  - Shows WHY prediction is made: "Team X favored due to stronger defense (0.9 goals allowed, 20% better than average) and 5-game win streak"
  - Expandable "Read Full Analysis" for longer content
  - Source: Rithmm explanation philosophy, United Robots sports content patterns
  - Dependencies: Requires LLM content to render properly (current blocker)

### Betting Odds
- **Odds Comparison Card**: Simple, scannable format (Complexity: Low)
  - Top markets only: 1X2, BTTS, O/U 2.5
  - Advanced markets behind "More Markets" expansion
  - No duplication with prediction probabilities (keep separate)
  - Source: OddsTrader app pattern, mobile betting UX 2026

### Match Timeline
- **Event Stream**: Chronological match events (Complexity: Low)
  - Goals, cards, substitutions with timestamps
  - Player names linked to player pages
  - Lives in Summary tab (top) or dedicated Timeline tab
  - Source: Standard across ESPN, FlashScore, SofaScore

## Differentiators (Competitive Advantage in AI Prediction Space)

### AI Transparency & Explanation
- **Model Performance Tracking**: Show which models are hot/cold (Complexity: Medium)
  - "Model X has predicted 8 of last 10 matches correctly"
  - Recent accuracy badges (🔥 Hot Streak, ❄️ Cold Streak)
  - Source: Rithmm Smart Signals approach, differentiation for AI prediction platforms
  - Builds trust through transparency

- **Confidence Levels with Context**: Not just percentages, but explanation (Complexity: Medium)
  - "82% confidence - High: Both teams' last 5 meetings produced BTTS"
  - Visual confidence indicators (strong/moderate/weak)
  - Source: AI prediction best practices 2026, user trust building
  - Current gap: predictions shown without confidence context

- **Real-Time Prediction Updates**: Live match = updated predictions (Complexity: High)
  - "Before match: 60% Home Win → After first goal: 75% Home Win"
  - Shows how live events impact model predictions
  - Source: Sports-AI.dev real-time predictions, advanced ML feature
  - Requires: Live data integration, model re-computation

### Content Quality
- **Post-Match AI Roundup**: Narrative match recap with key moments (Complexity: Medium - already built)
  - Currently exists but not rendering properly
  - Should be PRIMARY content in Summary tab post-match
  - 300-500 words max, scannable with bullets
  - Source: United Robots sports narratives, match report best practices
  - Fix rendering issue to unlock differentiation

- **Pre-Match Storylines**: AI-generated preview narratives (Complexity: Medium - partially built)
  - Head-to-head history, form analysis, injury impact
  - 200-300 words, expandable
  - Current gap: content exists but not displaying
  - Source: Football Manager 2026 pre-match hub pattern

### Mobile UX Polish
- **Thumb-Friendly Tabs**: Tab bar within thumb reach (Complexity: Low)
  - Sticky tab navigation at thumb zone (not top of page)
  - Swipeable tabs for quick switching
  - Source: Mobile betting UX 2026, navigation best practices
  - Enhances one-handed mobile use

- **Smart Default Tab**: Context-aware default view (Complexity: Low)
  - Pre-match → Summary tab (form, preview content)
  - Live match → Timeline tab (events stream)
  - Post-match → Predictions tab (results + accuracy)
  - Source: Personalization best practices, reduce cognitive load

## Anti-Features (Don't Build - Common Mistakes)

### Information Duplication
- **Score Displayed Multiple Times**: NEVER show score in 3+ places (Complexity: N/A)
  - Current issue: header + roundup scoreboard + stats
  - Anti-pattern: increases cognitive load, looks amateurish
  - Solution: Sticky header ONLY
  - Source: Nielsen Norman duplicate links research - "users rarely understand duplicates, waste time"

- **Predictions in Multiple Sections**: Don't scatter predictions across page (Complexity: N/A)
  - Current issue: table + roundup HTML + top performers section
  - Anti-pattern: users don't know which is "official" prediction
  - Solution: Single Predictions tab as source of truth
  - Source: Mobile UX de-duplication principles

- **Redundant Team Information**: Team logos/names repeated excessively (Complexity: N/A)
  - Sticky header provides context - don't repeat in every card
  - Anti-pattern: wastes screen real estate on mobile
  - Solution: Cards reference "Home team" not "Athletic Club" repeatedly

### Over-Complicated Layouts
- **10+ Separate Cards**: Avoid card proliferation (Complexity: N/A)
  - Current issue: excessive fragmentation requires vertical scrolling
  - Anti-pattern: "information overload and clutter" (Sports Betting UX 2026)
  - Solution: Tabbed sections consolidate related information
  - Source: Mobile-first sportsbook design, cognitive load reduction

- **Full-Length AI Articles**: Don't show 1000+ word articles inline (Complexity: N/A)
  - Anti-pattern: mobile users scan, don't read long-form content inline
  - Solution: 150-200 word summaries + "Read More" expansion
  - Source: AI readability optimization - 5th-8th grade reading level, 25-30 words per sentence

- **All Stats Visible**: Don't dump entire stats table on page load (Complexity: N/A)
  - Anti-pattern: overwhelming, users can't find relevant metrics
  - Solution: Top 5 stats visible, "View All Stats" for rest
  - Source: FlashScore stats categorization - separate TOP stats from other metrics

### Feature Creep
- **Player Heatmaps on Match Page**: Belongs on player pages, not match pages (Complexity: N/A)
  - Anti-pattern: dilutes match-level focus
  - Solution: Link to player pages for deep dives
  - Source: Information architecture best practices

- **Social Sharing for Every Section**: One share button for match, not per card (Complexity: N/A)
  - Anti-pattern: clutters UI, low usage
  - Solution: Single share action in header

- **Real-Time Chat/Comments**: Avoid for MVP (Complexity: High if built)
  - Anti-pattern: moderation burden, low engagement for prediction sites
  - Solution: Focus on prediction accuracy, not social features
  - Note: Could be post-launch feature if data shows demand

## Mobile UX Patterns Summary

### Layout Architecture
**Primary Pattern: Sticky Header + Tabbed Content**

```
┌─────────────────────────────────┐
│ [Sticky Header]                 │
│ Home Logo 1-1 Away Logo   [FT]  │ ← Only score display
├─────────────────────────────────┤
│ Summary | Stats | Pred. | Odds  │ ← Sticky tabs (thumb zone)
├─────────────────────────────────┤
│                                 │
│ [Tab Content - Progressive      │
│  Disclosure Pattern]            │
│                                 │
│  ▼ Match Info                   │ ← Expanded by default
│  ▶ Advanced Stats               │ ← Collapsed
│  ▶ Full Model Breakdown         │ ← Collapsed
│                                 │
└─────────────────────────────────┘
```

### Tab Breakdown
**Summary Tab** (Default for pre-match/post-match)
- Match details (date, venue, referee)
- Team form (last 5 matches - visual indicators W/D/L)
- Head-to-head record (compact: 3 wins, 2 draws, 5 losses)
- AI narrative preview/recap (150-200 words, expandable)
- Key stats (3-5 most important only)

**Stats Tab**
- Top 5 stats visible immediately
- Categorized sections (Attacking | Defending | Discipline)
- "View All Stats" expansion for full dataset
- Comparison visualization (bar charts, not tables)

**Predictions Tab**
- AI consensus view (single prediction with confidence %)
- Top 5 model predictions (compact cards)
- "Why We Predict This" narrative (150 words)
- "View All 35 Models" expansion for full table
- Model performance indicators (hot/cold streaks)

**Odds Tab**
- Top markets (1X2, BTTS, O/U 2.5)
- Odds comparison across bookmakers (if available)
- "More Markets" expansion for exotics
- Time-stamped (odds as of XX:XX)

**Timeline Tab** (Live/post-match only)
- Chronological event stream
- Filterable (Goals only | Cards only | All events)
- Auto-scrolls to latest event during live matches

### Progressive Disclosure Triggers
- "Read Full Analysis" → Expands narrative content
- "View All Models" → Shows complete prediction table
- "Show Advanced Stats" → Reveals xG, pass accuracy, etc.
- "More Markets" → Displays exotic betting options
- "Match History" → Head-to-head detail view

### Mobile-Specific Optimizations
- **Touch targets**: 48px minimum for tap areas
- **Swipe gestures**: Left/right swipe between tabs
- **Pull-to-refresh**: Updates live match data
- **Skeleton screens**: Show layout while data loads (no blank screens)
- **Lazy loading**: Images load as user scrolls
- **Thumb zone navigation**: Tabs at bottom third of screen (not top)

## Content Hierarchy for Mobile

### Pre-Match Priority Order
1. Match info + team form (Summary tab - top)
2. AI prediction + explanation (Predictions tab - featured)
3. Betting odds comparison (Odds tab)
4. Head-to-head history (Summary tab - expanded)
5. Team news/injuries (Summary tab - expanded)
6. Full stats comparison (Stats tab)

### Live Match Priority Order
1. Live score + match clock (Sticky header)
2. Latest events (Timeline tab - auto-scroll)
3. Updated stats (Stats tab - real-time)
4. In-play odds (Odds tab - if available)
5. Live prediction updates (Predictions tab - differentiator)

### Post-Match Priority Order
1. Final score + match result (Sticky header)
2. AI match roundup narrative (Summary tab - PRIMARY CONTENT)
3. Prediction accuracy analysis (Predictions tab - featured)
4. Final stats comparison (Stats tab)
5. Match highlights/key moments (Timeline tab)

## Feature Dependencies & Implementation Notes

### Critical Fixes Required
1. **LLM Content Rendering** (blocker for differentiation)
   - Pre-match storylines not displaying
   - Post-match roundups not displaying
   - Fix: Debug rendering pipeline, ensure content reaches frontend
   - Impact: Without this, AI narrative advantage is lost

2. **Score Display Consolidation** (quick win)
   - Remove score from all sections except sticky header
   - Effort: 2-3 hours refactoring
   - Impact: Immediate visual de-cluttering

3. **Card-to-Tab Refactoring** (medium effort)
   - Convert 10+ cards to 4-5 tabbed sections
   - Effort: 2-3 days frontend work
   - Impact: Resolves excessive scrolling, improves mobile UX

### Dependencies on Existing Features
- Match events timeline → Already built, can move to Timeline tab
- Betting odds panel → Already built, can move to Odds tab
- AI predictions table → Already built, needs consolidation in Predictions tab
- Match stats grid → Already built, needs progressive disclosure in Stats tab
- Related matches widget → Keep at bottom, below tabs (discovery feature)

### Phase Recommendations
**Phase 1: De-duplication (Quick Wins)**
- Remove duplicate score displays
- Consolidate predictions into single section
- Collapse advanced stats behind expansions

**Phase 2: Tabbed Navigation**
- Implement sticky header + tab system
- Migrate existing components into tabs
- Add swipe gestures

**Phase 3: Content Rendering Fixes**
- Debug LLM content pipeline
- Ensure pre/post-match narratives display
- Implement progressive disclosure for long content

**Phase 4: Polish & Optimization**
- Real-time prediction updates (live matches)
- Model performance tracking
- Thumb-zone navigation refinements

## Complexity Assessment

| Feature Category | Complexity | Rationale |
|-----------------|------------|-----------|
| Sticky Header | Low | Standard React pattern, simple state management |
| Tabbed Navigation | Medium | Requires routing/state, swipe gesture handling |
| Progressive Disclosure | Medium | Collapse/expand state, content chunking |
| Score De-duplication | Low | Remove existing displays, single source |
| Predictions Consolidation | Medium | Refactor existing components, new layout |
| LLM Content Rendering | High | Debug pipeline, backend-frontend integration |
| Real-Time Updates | High | Live data streaming, model re-computation |
| Model Performance Tracking | Medium | Requires historical accuracy data, new calculations |

## Sources

### Mobile UX & Design Patterns
- [Sports Betting App UX & UI in 2026](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/)
- [Mobile-First Sportsbook Design: UX Best Practices](https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435)
- [Progressive Disclosure in Mobile Information Architecture](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [Nielsen Norman Group: Duplicate Links Research](https://www.nngroup.com/articles/duplicate-links/)
- [Card UI Design Best Practices](https://www.eleken.co/blog-posts/card-ui-examples-and-best-practices-for-product-owners)

### Competitor Analysis
- [FlashScore Match Detail Redesign](https://www.flashscore.com/news/new-look-match-details-on-flashscore-a-full-page-instead-of-a-small-window/QJg8Wtgg/)
- [SofaScore Success Story](https://www.techgropse.com/success-story/sofascore)
- [ESPN Match Center Pattern](https://www.espn.com/espn/redesign/index)
- [Sports-AI.dev Platform Analysis](https://www.sports-ai.dev/) (via WebFetch)
- [Rithmm AI Predictions Approach](https://www.rithmm.com/) (via WebFetch)

### AI Prediction & Content Best Practices
- [AI Sports Predictions 2026: Why Traditional Methods Are Obsolete](https://wsc-sports.com/blog/industry-insights/ai-sports-predictions-for-2026-why-traditional-methods-are-now-obsolete/)
- [Best AI Sports Prediction Tools 2026](https://theaisurf.com/ai-sports-predictions-tools/)
- [AI Readability Optimization Best Practices](https://www.gravitatedesign.com/blog/ai-readability-optimization/)
- [United Robots: Automated Sports News](https://www.unitedrobots.ai/content-services/sports)
- [OddsTrader App Features](https://www.oddstrader.com/sports-betting-app/)

### Mobile Navigation & Information Architecture
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [Progressive Disclosure Matters: 2026 AI Applications](https://aipositive.substack.com/p/progressive-disclosure-matters)
- [Sports Data Widgets - Opta](https://www.optasports.com/services/widgets/football/)

### Domain-Specific Insights
- [Best Features for Sports Apps 2026: AI & Real-Time Intelligence](https://www.sportsfirst.net/post/best-features-for-sports-apps-in-2026-ai-automation-real-time-intelligence)
- [theScore App Best Practices](https://play.google.com/store/apps/details?id=com.fivemobile.thescore&hl=en_US)

### Research Methodology
- Context7: Not used (no library-specific queries needed)
- Official Documentation: FlashScore, Rithmm, Sports-AI.dev via WebFetch
- WebSearch: 15 queries for ecosystem discovery (all 2026-dated)
- Verification: Cross-referenced patterns across 3+ sources
- Current Site Analysis: kroam.xyz via WebFetch

**Confidence Level: MEDIUM**
- HIGH confidence: Mobile UX patterns (verified across multiple sources)
- MEDIUM confidence: AI prediction display patterns (limited to 2-3 platforms analyzed)
- MEDIUM confidence: Content hierarchy (inferred from general mobile IA principles + competitor analysis)
- LOW confidence: Real-time prediction updates (emerging feature, limited implementation data)
