# Features Research: v2.2 Match Page Rewrite

**Domain:** Football match detail pages for AI prediction platform
**Researched:** 2026-02-03
**Confidence:** HIGH (verified against multiple authoritative sources)
**Focus:** SEO/GEO optimization, mobile-first single-scroll design, auto-generated FAQ

---

## Table Stakes (Must Have)

Essential features for SEO and GEO (Generative Engine Optimization). Missing any of these means losing visibility in both traditional search and AI-generated responses.

### Structured Data / Schema Markup

| Feature | Why Essential | Complexity | Notes |
|---------|---------------|------------|-------|
| **SportsEvent schema** | Google recognizes page as sports event; enables rich results | Low | Already have via MatchPageSchema; verify homeTeam/awayTeam/competitor properties |
| **FAQPage schema** | 3.2x more likely to appear in AI Overviews; 28% more AI citations | Low | Already have via MatchFAQSchema; expand question coverage |
| **BreadcrumbList schema** | Navigation context for search engines; already implemented | Low | Keep; validates page hierarchy |
| **Article schema for narratives** | Pre/post-match content recognized as editorial content | Low | Add for narrative sections; improves E-E-A-T signals |
| **JSON-LD @graph consolidation** | Single structured data block; avoids fragmentation | Medium | Consolidate all schemas into one @graph array |

### Content Structure for AI Citation

| Feature | Why Essential | Complexity | Notes |
|---------|---------------|------------|-------|
| **Answer-first content** | AI engines extract first paragraph as citation; 4.1x more citations for original research | Low | Lead with TL;DR/summary; already have MatchTLDR |
| **Clear H1 with match teams** | Crawlers and AI need unambiguous page topic | Low | Already have via MatchH1 |
| **Semantic heading hierarchy** | H1 -> H2 -> H3 flow; AI systems parse structure | Low | Audit current page; ensure no skipped levels |
| **Publication/update timestamps** | Freshness signal; content updated within 30 days gets 3.2x more citations | Low | Add dateModified to schema; show "Last updated" on page |
| **Author/source attribution** | E-E-A-T signal; AI engines prioritize authoritative sources | Medium | "Analysis by AI models" attribution; methodology link |

### Mobile-First Single-Scroll Design

| Feature | Why Essential | Complexity | Notes |
|---------|---------------|------------|-------|
| **Linear vertical scroll** | 64% of sports fans on mobile; single scroll = no hidden content | Low | Remove tabs entirely; stack all content vertically |
| **Touch targets 44x44px** | Accessibility standard; already validated v1.3 | Low | Maintain on all interactive elements |
| **Fast LCP (<2.5s)** | Core Web Vitals threshold; affects ranking | Medium | Priority on above-fold images; lazy load below |
| **No horizontal scrolling** | Unexpected on mobile; breaks mental model | Low | Responsive tables; wrap or truncate wide content |
| **Readable on small screens** | 320px minimum viewport support | Low | Test on iPhone SE size; ensure no overflow |

### Core Match Information

| Feature | Why Essential | Complexity | Notes |
|---------|---------------|------------|-------|
| **Score prominently displayed** | #1 user intent for match pages; 92% say most important | Low | Already have; single display location (no duplication) |
| **Match status indicator** | Upcoming/Live/Finished immediately clear | Low | Already have; keep in header area |
| **Kickoff time with timezone** | Critical user information; avoids confusion | Low | Already have; ensure ISO format in schema |
| **Competition context** | Users need to know league/round | Low | Already have via breadcrumbs and header |
| **Team names unambiguous** | Home vs Away clearly distinguished | Low | Already have; maintain visual distinction |

---

## Differentiators (Competitive Advantages)

Features that distinguish the platform from competitors and maximize AI citation potential.

### Advanced GEO Optimization

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Match-state-specific FAQ** | Different questions for upcoming/live/finished; more relevant citations | Medium | Expand existing generateMatchFAQs(); add 3-5 more per state |
| **Prediction accuracy FAQ** | "How accurate were predictions?" with actual data | Medium | Calculate and include post-match; unique data = citations |
| **Statistical comparison FAQ** | "What were the key stats?" from match data | Medium | Auto-generate from MatchStats data |
| **Hub-and-spoke content model** | Match page links to team, league, model pages; topical authority | Low | Already have; ensure bidirectional linking |
| **Entity consistency** | Same team names everywhere; AI recognizes entities | Low | Audit for variations (e.g., "Man United" vs "Manchester United") |

### Narrative Content Excellence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Pre-match preview narrative** | Context before predictions; improves engagement | Low | Already have via MatchContentSection |
| **Post-match analysis narrative** | Unique editorial content; E-E-A-T signal | Low | Already have via roundup; ensure prominent display |
| **Prediction performance summary** | "X models predicted correctly"; original data | Low | Calculate from predictions array |
| **Quotable blockquotes** | AI engines extract quotes as citations | Low | Already have PredictionInsightsBlockquote |

### Prediction Table Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **35 models displayed** | Unique value proposition; no competitor has this | Low | Already have; preserve |
| **Model accuracy indicators** | Trust signal; shows which models perform well | Low | Points already shown; add visual accuracy tier |
| **Consensus prediction** | "Most models predict X"; citation-worthy statement | Low | Already calculate average; make it a standalone statement |
| **Sort by accuracy (post-match)** | Shows best performers; engagement value | Low | Already implemented |

### Internal Linking Strategy

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Related matches widget** | Already implemented; drives page discovery | Low | Keep; validates SEO value |
| **Model profile links** | Each model in table links to /models/[id] | Low | Already have |
| **Competition page link** | Prominent link back to league | Low | Already have; keep prominent |
| **Team entity linking** | Link team names to team pages when available | Medium | Future enhancement; requires team pages |

### Performance Optimization

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Single data fetch pattern** | Eliminate query waterfall; faster TTFB | Medium | Already have Promise.all(); verify no sequential deps |
| **Skeleton loading states** | Perceived performance while data loads | Low | Add for predictions table |
| **Image optimization** | WebP format; responsive sizes | Low | Next.js Image component |
| **Minimal client JS** | Server-render everything possible | Medium | Audit 'use client' directives |

---

## Anti-Features (Do NOT Build)

Features to explicitly avoid. These are common patterns that harm SEO, GEO, or user experience for this page type.

### Navigation Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Tabbed content on mobile** | Hides content from crawlers; requires interaction to see predictions; SEO penalty for hidden content | Single-scroll layout; all content visible on load |
| **Accordion-only content** | Similar to tabs; content hidden by default | Use accordions only for optional deep-dive (e.g., all 35 models vs top 5) |
| **Infinite scroll** | No unique URLs for content sections; hard to bookmark | Finite page with anchor links |
| **Horizontal tab bars** | Requires scrolling to see all tabs on mobile; 73% miss tabs outside viewport | Stack sections vertically |

### Content Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Duplicate score display** | Current page shows score 3+ times; redundant; confusing | Single authoritative score location (MatchPageHeader) |
| **Auto-playing video** | Bandwidth intensive; unexpected; accessibility issue | User-initiated only if video added |
| **Generic FAQ answers** | "AI predictions are..." without match-specific data | Match-specific answers: "For this match, 23/35 models predicted..." |
| **Keyword stuffing** | "Man City vs Arsenal predictions Man City Arsenal betting tips" | Natural language; entity mentions feel editorial |
| **Thin content sections** | Empty cards when no data available | Hide sections with no data; or show meaningful "no data" message |

### Technical Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Client-side rendering for content** | AI crawlers struggle; content not in initial HTML | Server-render all match data; client only for interactivity |
| **Separate mobile/desktop pages** | Duplicate content; maintenance burden | Single responsive page |
| **Lazy-load above-fold content** | LCP regression; visible content delay | Eager load hero/score; lazy load below fold |
| **Multiple JSON-LD script blocks** | Schema fragmentation; harder for crawlers | Single @graph structure |
| **Redirect chains** | Slow; loses link equity | Direct links only |

### UX Anti-Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Pop-ups or interstitials** | View-only platform; creates friction | No pop-ups |
| **Sticky bottom banners** | Reduces readable area on mobile | Minimal fixed elements |
| **Social share pop-ups** | Unexpected; breaks flow | Inline share buttons if needed |
| **Loading spinners for critical content** | User sees spinner, not content; bad perceived perf | Skeleton with content shape |
| **"Load more" for predictions** | Hides unique value (35 models) behind interaction | Show all by default; optionally collapse to top 5 with "show all" |

---

## FAQ Auto-Generation Patterns

The existing `generateMatchFAQs()` function provides a foundation. Expand it for maximum GEO value.

### State-Specific FAQ Templates

**Upcoming Match (scheduled)**
```
1. Who is predicted to win [Home] vs [Away]?
   → "AI models predict..." + consensus + kickoff time

2. When is [Home] vs [Away]?
   → Full date/time + venue

3. What competition is this match in?
   → Competition name + round

4. How do AI models make predictions?
   → Methodology explanation + link to /methodology

5. What is [Home]'s recent form?
   → Last 5 results if available

6. What is [Away]'s recent form?
   → Last 5 results if available
```

**Live Match (live)**
```
1. What is the current score of [Home] vs [Away]?
   → Current score + minute

2. Who scored in [Home] vs [Away]?
   → Goal scorers if available

3. What were the pre-match predictions?
   → Consensus prediction + accuracy so far

4. When did this match start?
   → Kickoff time

5. What competition is this match in?
   → Competition + round
```

**Finished Match (finished)**
```
1. What was the final score of [Home] vs [Away]?
   → Final score + date + competition

2. How accurate were AI predictions for this match?
   → "X out of 35 models predicted the correct result"
   → "The consensus prediction was X-Y; actual was A-B"

3. Which AI model predicted this match best?
   → Top performer + their prediction + points earned

4. What were the key statistics?
   → Possession, shots, cards from MatchStats

5. What happened in the match?
   → Brief narrative from roundup or "Key events: [goals, cards]"

6. When was [Home] vs [Away] played?
   → Full date + venue

7. What competition was this match in?
   → Competition + round
```

### FAQ Generation Best Practices

| Practice | Rationale |
|----------|-----------|
| **Include match data in answers** | AI engines need data to cite; generic answers don't get cited |
| **Use full team names in questions** | "Manchester City vs Arsenal" not "Man City vs Arsenal" for SEO |
| **Keep answers 1-3 sentences** | Long answers get truncated by AI; concise = more citations |
| **Lead with the answer** | "The final score was 2-1" not "The match, which was played on..." |
| **Include dates** | Temporal context helps AI understand freshness |
| **Link to related pages** | "View the model leaderboard at kroam.xyz/leaderboard" in answers |

### Implementation Notes

The current `MatchFAQSchema.tsx` generates 4 FAQs. Expand to 5-7 per state:

```typescript
// Example expansion for finished matches
if (isFinished && predictions.length > 0) {
  const correctPredictions = predictions.filter(p => wasCorrect(p, match));
  faqs.push({
    question: `How accurate were AI predictions for ${match.homeTeam} vs ${match.awayTeam}?`,
    answer: `${correctPredictions.length} out of ${predictions.length} AI models predicted the correct result. The consensus prediction was ${consensusHome}-${consensusAway}, while the actual score was ${match.homeScore}-${match.awayScore}.`
  });
}
```

---

## Layout Specification

The required layout: **Match Info -> Narrative -> Predictions Table -> FAQ**

### Single-Scroll Section Order

```
1. BREADCRUMBS
   └── Leagues > [Competition] > [Match]

2. H1 (MatchH1)
   └── "[Home] vs [Away]" with score if finished

3. MATCH INFO (MatchPageHeader)
   └── Score/time, status, competition badge
   └── Single authoritative score display

4. TL;DR SUMMARY (MatchTLDR)
   └── State-aware summary (upcoming/live/finished)
   └── GEO answer-first content

5. MATCH EVENTS (if live/finished with events)
   └── Goals, cards, substitutions timeline

6. NARRATIVE CONTENT (MatchContentSection)
   └── Pre-match preview OR post-match analysis
   └── Full editorial content visible (no "read more" truncation for above-fold)

7. MATCH STATS (MatchStats)
   └── Key statistics comparison
   └── Only show if data available

8. PREDICTIONS TABLE
   └── All 35 models visible
   └── Sort controls
   └── Consensus summary
   └── Top performers (post-match)

9. RELATED MATCHES (RelatedMatchesWidget)
   └── Internal linking for SEO
   └── Next fixtures for these teams

10. FAQ SECTION (MatchFAQ)
    └── Expanded state-specific questions
    └── FAQPage schema for AI citation
    └── Accordion UI for visual display

11. EXPLORE MORE
    └── Links to competition, team pages
    └── Cross-linking for SEO
```

### Mobile Considerations

| Section | Mobile Treatment |
|---------|------------------|
| Breadcrumbs | Truncate if needed; always visible |
| H1 | Full width; may wrap to 2 lines |
| Match Info | Centered; score prominent |
| TL;DR | Full width; 16px+ font |
| Events | Timeline stacked vertically |
| Narrative | Full width; comfortable reading width |
| Stats | 2-column grid or stacked |
| Predictions | Horizontally scrollable table OR card layout |
| Related | Full-width cards |
| FAQ | Accordion pattern |
| Explore | Stacked links |

---

## Content Preservation Requirements

From milestone context - features to PRESERVE:

| Feature | Current Location | Status |
|---------|------------------|--------|
| 35 LLM predictions displayed | PredictionTable | Keep; core value prop |
| Pre-match narratives | MatchContentSection | Keep; GEO value |
| Post-match narratives | MatchContentSection + roundup | Keep; E-E-A-T signal |
| Live score updates | MatchPageHeader + polling | Keep; user expectation |
| Schema.org structured data | MatchPageSchema + MatchFAQSchema | Keep; expand |

---

## Sources

### SEO/GEO Optimization
- [Generative Engine Optimization Guide 2026](https://www.digitalapplied.com/blog/geo-guide-generative-engine-optimization-2026) - GEO fundamentals, citation patterns
- [GEO Best Practices 2026](https://www.firebrand.marketing/2025/12/geo-best-practices-2026/) - Content structure for AI citation
- [FAQ Schema for AI Search](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) - 3.2x AI Overview appearances with FAQ
- [10-Step GEO Framework 2025](https://www.tryprofound.com/guides/generative-engine-optimization-geo-guide-2025) - Citation optimization strategies

### Sports Betting SEO
- [Sports Betting SEO 2026](https://tentenseven.com/sports-betting-seo/) - Sports-specific SEO patterns
- [iGaming SEO 2025](https://affpapa.com/igaming-seo-strategies-you-need-a-practical-guide/) - E-E-A-T for betting content
- [Top Gambling SEO Strategies 2026](https://ambeywebmedia.com/top-gambling-seo-strategies-2026/) - Schema markup importance

### Mobile UX
- [Tabs UX Best Practices](https://www.eleken.co/blog-posts/tabs-ux) - When tabs fail on mobile
- [Mobile First Design 2025](https://wpbrigade.com/mobile-first-design-strategy/) - Single-scroll patterns
- [Mobile SEO 2025](https://www.upskillist.com/blog/seo-in-2025-mobile-first-tactics-that-will-keep-dominating/) - 64% mobile traffic

### Structured Data
- [Schema.org SportsEvent](https://schema.org/SportsEvent) - Official schema properties
- [Schema.org FAQPage](https://schema.org/FAQPage) - FAQ schema structure
- [Schema Markup 2026](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) - Implementation best practices
- [Structured Data for AI SEO 2026](https://www.digidop.com/blog/structured-data-secret-weapon-seo) - GPT-4 improves 16% to 54% with structured content

### E-E-A-T & Authority
- [SEO 2026 Predictions](https://yoast.com/2026-seo-predictions-by-yoast-experts/) - E-E-A-T as ranking filter
- [AI SEO Trends 2026](https://www.techmagnate.com/blog/ai-seo-trends-2026/) - Authority as currency

---

*Confidence: HIGH - Cross-referenced multiple sources; patterns consistent across GEO literature, sports SEO guides, and mobile UX research. Existing implementation already validates many patterns (v1.3 requirements, current FAQ schema).*
