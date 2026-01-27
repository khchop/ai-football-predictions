# Stack Research

## Multi-Granularity Statistics Engine

### Database Layer

**PostgreSQL with Drizzle ORM** (current stack)
- Excellent for aggregation queries across multiple dimensions
- Use GROUP BY with ROLLUP for hierarchical statistics
- Materialized views for pre-computed stats at each level
- Index strategy: composite indexes on (competition_id, season), (club_id, season)

**Recommended additions:**
- TimescaleDB extension if match data grows significantly (time-series optimization)
- Partial indexes for active season filtering

### Caching Layer

**Redis** (current stack)
- Cache pre-computed stats at each granularity level
- Use separate keys with TTL for each level:
  - `stats:overall:{model_id}:{season}`
  - `stats:competition:{model_id}:{competition_id}:{season}`
  - `stats:club:{model_id}:{club_id}:{season}`
- Invalidation strategy: invalidate child levels when parent updates

### Content Generation

**LLM Integration** (Together.ai, current stack)
- Use structured output (JSON mode) for consistent stats formatting
- Prompt engineering: provide context windows with relevant historical data
- Temperature 0.1-0.3 for consistent, factual analysis

**Content Pipeline:**
1. Trigger: Match completed → scores updated
2. Generate: LLM writes analysis based on match stats + model predictions
3. Render: Next.js SSG/ISR to static HTML
4. Cache: CDN caching for SEO performance

### Visualization

**Chart.js or Recharts**
- React-compatible, good for stats dashboards
- Lightweight compared to D3
- Good for line charts (trends), bar charts (comparisons)

**tanstack-table**
- For sortable/filterable stats tables
- Good for leaderboards with multiple sort dimensions

### SEO Optimization

**Next.js Metadata API**
- Dynamic Open Graph images for each match/competition
- Structured data (JSON-LD) for sports events
- Sitemap generation for all match pages

**Vercel ISR (Incremental Static Regeneration)**
- Pre-render match roundups
- Revalidate on new content

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Match Completion                          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BullMQ Worker                             │
│  1. Update scores                                           │
│  2. Trigger stats recalculation                             │
│  3. Queue content generation job                           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stats Engine                              │
│  - Recalculate affected granularity levels                  │
│  - Update materialized views                                │
│  - Invalidate Redis cache                                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Content Generator                            │
│  - Fetch match data + model predictions                     │
│  - Generate LLM analysis                                    │
│  - Render to static HTML                                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cache + CDN                               │
│  - Redis for API responses                                  │
│  - Vercel ISR for static pages                              │
│  - Structured data for SEO                                  │
└─────────────────────────────────────────────────────────────┘
```

## Confidence Levels

| Component | Recommendation | Confidence |
|-----------|---------------|------------|
| PostgreSQL/Drizzle | Continue current stack | High |
| Redis caching | Continue, add tiered keys | High |
| LLM content | Continue Together.ai, add structured output | High |
| Charting | Chart.js or Recharts | Medium |
| SEO | Next.js ISR + JSON-LD | High |
