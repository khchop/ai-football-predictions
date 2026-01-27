# Phase 5 Context: SEO + Publication

**Phase:** 05-seo-publication  
**Created:** January 27, 2026  
**Status:** Context gathering complete

---

## Overview

This phase implements SEO optimization and publication infrastructure for the BettingSoccer platform. Key deliverables include dynamic metadata, Open Graph images, JSON-LD structured data, and automated sitemap generation.

---

## Core Requirements

### Pages to Optimize
- `/matches/{id}` — Match report page with LLM-generated roundup
- `/matches/{id}/stats` — Match statistics and model prediction breakdown
- Leaderboard pages (already implemented)
- Homepage and competition listing pages

### Infrastructure Needs
- Dynamic meta tag generation based on match state
- Template-based OG image generation (3 states)
- Structured data injection for rich search results
- Sitemap index with daily regeneration

---

## Decisions Captured

### 1. Metadata Structure

#### Meta Title Format
**Selected:** Result-focused format with score

```
"{Home Team} {Score}-{Score} {Away Team} | Match Analysis & Predictions"
```

**Rationale:** Prioritizes actual results (if available) while highlighting value proposition (analysis + predictions).

#### Meta Description Format
**Selected:** Data-focused format with competition + specific data points

```
"Comprehensive coverage of {Home} vs {Away} in {Competition}. Match stats, AI predictions from {N} models, and model leaderboard rankings."
```

**Rationale:** Emphasizes unique value (AI predictions) with concrete data points that differentiate from generic sports coverage.

#### Description Strategy
**Selected:** Separate descriptions per match state

**State-specific descriptions:**

**Upcoming:**
```
"Get AI predictions for {Home} vs {Away}. See which models forecast the winner before kickoff on {Date}."
```

**Live:**
```
"Follow {Home} vs {Away} live. Track AI predictions in real-time and see how models perform as the action unfolds."
```

**Finished:**
```
"Comprehensive coverage of {Home} vs {Away} in {Competition}. Match stats, AI predictions from {N} models, and model leaderboard rankings."
```

---

### 2. Open Graph Images

#### Generation Strategy
**Selected:** Template-based with dynamic text overlay

**Rationale:** Consistent visual identity, lower compute cost, easier to maintain than fully dynamic images per match.

#### Template Content
**Selected:** Full match card display

**Elements included:**
- Teams (home + away)
- Score (if available)
- Competition badge/logo
- Prediction outcome
- BettingSoccer branding

#### Template Variations
**Selected:** 3 templates (one per match state)

**Upcoming template:**
- Team logos
- "vs" separator
- Prediction summary
- "Predictions Open" badge
- Competition badge
- Match date/time
- BettingSoccer branding

**Live template:**
- Team logos
- Live indicator
- Current score (large)
- Time remaining
- Competition badge
- BettingSoccer branding

**Finished template:**
- Team logos
- Score (large)
- Winner indicator
- Model accuracy %
- Competition badge
- BettingSoccer branding

---

### 3. JSON-LD Schema

#### Schema Stack
**Selected:** Full schema stack

**Includes:**
- `SportsEvent` — Match-level schema
- `SportsOrganization` — BettingSoccer platform
- `Person` — LLM models as performers
- `Article` — Match report content

#### SportsEvent Properties
**All properties included:**
```json
{
  "@type": "SportsEvent",
  "name": "{Home Team} vs {Away Team}",
  "startDate": "ISO 8601 timestamp",
  "endDate": "ISO 8601 timestamp (post-match)",
  "eventStatus": "Scheduled | LivePostponed | Cancelled | Completed",
  "homeTeam": { Team schema reference },
  "awayTeam": { Team schema reference },
  "competitor": [ { Team schema }, { Team schema } ],
  "venue": { Place schema },
  "sport": "Football",
  "description": "Brief match description",
  "performer": [ { Team schema }, { Person schema } ]
}
```

#### Article Properties
**All properties included:**
```json
{
  "@type": "NewsArticle",
  "headline": "{from meta title}",
  "image": "{OG image URL}",
  "datePublished": "{match start or article creation}",
  "dateModified": "{last update timestamp}",
  "author": { Organization schema },
  "publisher": { Organization schema },
  "articleSection": "Match Reports",
  "keywords": "{teams}, {competition}, {match round}",
  "about": { SportsEvent reference },
  "articleBody": "{LLM-generated roundup content}"
}
```

#### Schema Injection Strategy
**Selected:** Single graph approach

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { SportsOrganization schema },
    { Person schemas (models) },
    { SportsEvent schema },
    { Article schema }
  ]
}
</script>
```

**Rationale:** Google's recommended approach, single HTTP request, clean separation.

---

### 4. Sitemap Strategy

#### Match Page Coverage
**Selected:** All matches (historical + current)

**Includes:**
- Every match ever played
- Matches from all competitions
- Historical data for SEO value

#### Sitemap Structure
**Selected:** Sitemap index with multiple sitemap files

**Rationale:** Scalable approach, avoids 50K URL limit per file, faster parsing.

#### Chunking Strategy
**Selected:** Hybrid (by year, split by competition within each year)

**Structure:**
```
sitemap.xml (index)
├── sitemap-2023-premier-league.xml
├── sitemap-2023-la-liga.xml
├── sitemap-2024-premier-league.xml
├── sitemap-2024-la-liga.xml
├── sitemap-2025-premier-league.xml
├── sitemap-2025-la-liga.xml
└── ...
```

**Benefits:**
- Easy to locate specific competition data
- Can regenerate single competition without full rebuild
- Logical grouping for debugging

#### Regeneration Schedule
**Selected:** Daily

**Implementation:**
- Cron job runs once per day
- Generates sitemap index + all sitemap files
- Updates lastmod timestamps

---

## Implementation Notes

### Dependencies
- Match pages already exist (`/matches/{id}`, `/matches/{id}/stats`)
- LLM roundup content already generated (Phase 4)
- Database has all match data needed for schema generation

### Technical Considerations

#### OG Image Generation
- Use `@vercel/og` or similar Next.js OG image solution
- Templates designed for 1200x630 (standard OG size)
- Caching strategy needed for performance

#### Schema Injection
- Create reusable schema builder functions
- Validate with Google Rich Results Test
- Handle null/missing data gracefully

#### Sitemap Generation
- Use `next-sitemap` or custom implementation
- Store sitemaps in `public/` for direct access
- Submit to Google Search Console via API

### Potential Complications

1. **Live match updates** — Schema needs refresh on score changes
2. **Model references** — Person schema for models needs naming convention
3. **Competition logos** — Need reliable URL for OG images
4. **Historical data gaps** — Some older matches may lack complete data

---

## Out of Scope

- **A/B testing meta descriptions** — Can add later
- **Multi-language support** — Not required for MVP
- **Canonical URL management** — Assume single locale for now
- **Robots.txt rules** — Allow all match pages
- **404 handling** — Already implemented

---

## Questions Resolved

All gray areas addressed during context gathering:
1. ✅ Meta title format (result-focused)
2. ✅ Meta description format (data-focused)
3. ✅ Separate vs unified descriptions (separate)
4. ✅ Description drafts (approved)
5. ✅ OG image strategy (template-based)
6. ✅ OG template content (full match card)
7. ✅ Template variations (3 states)
8. ✅ Visual elements (all included)
9. ✅ Schema stack (full)
10. ✅ SportsEvent properties (all)
11. ✅ Article properties (all)
12. ✅ Schema injection (single graph)
13. ✅ Sitemap coverage (all matches)
14. ✅ Sitemap structure (index + chunks)
15. ✅ Chunking strategy (hybrid year/competition)
16. ✅ Regeneration schedule (daily)

---

## Ready For

- [ ] **Research** (`/gsd-research-phase 5`) — Technical implementation patterns
- **Planning** (`/gsd-plan-phase 5`) — Task breakdown and dependency analysis
