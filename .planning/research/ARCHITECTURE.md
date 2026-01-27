# Architecture Research

## Multi-Granularity Stats Engine Architecture

### Core Design Principles

**Hierarchical Aggregation Pattern**
The stats engine operates at three levels, each building on the previous:
- **Overall:** Aggregates all matches across all competitions (no filters)
- **Competition:** Filters by competition_id, aggregates within that scope
- **Club:** Filters by home_team_id or away_team_id, aggregates match history

**Data Flow:**
```
Match Completed
    │
    ▼
┌───────────────────┐
│ Score Calculation │  (Kicktipp system: 2-6 tendency, +1 diff, +3 exact)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Stats Recalculation│  (Invalidate affected levels only)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Cache Invalidation│  (Redis: invalidate overall → competition → club)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ View Update       │  (Materialized views for fast queries)
└───────────────────┘
```

### Component Boundaries

**Stats Calculator Service**
- Single responsibility: calculate stats from raw predictions + results
- Input: match_id, model predictions, actual result
- Output: points_awarded, tendency_correct, goal_diff_correct, exact_score_correct
- No caching logic, no API concerns

**Aggregation Service**
- Input: model_id, date range (optional), filters
- Logic: GROUP BY with appropriate filters for each level
- Output: aggregated stats object per granularity
- Handles all three levels with same interface

**Cache Layer**
- Keys with prefix + granularity + filters + season
- TTL: 1 hour for active season, 24 hours for historical
- Write-through: update cache on recalculation
- Invalidation: cascade from parent to child

**Query Interface**
- Single endpoint with query params: ?level=overall|competition|club&model=X&competition=Y&club=Z
- Returns consistent structure regardless of level
- Type-safe response shapes

### Database Schema Implications

**Existing tables (from codebase map):**
- `matches` — match data with home/away teams, scores, competition
- `predictions` — model predictions with home_goals, away_goals
- `models` — model definitions

**New tables needed:**
- `model_stats` — denormalized aggregated stats (updated on match completion)
- No new tables for aggregation (use views)

**Materialized Views:**
- `mv_model_stats_overall` — refreshed on match completion
- `mv_model_stats_competition` — partitioned by competition
- `mv_model_stats_club` — partitioned by club

### Stats Points Aggregation

```sql
-- Example: Competition-level aggregation query
SELECT
  p.model_id,
  COUNT(*) as matches,
  SUM(CASE WHEN pts >= 2 THEN 1 ELSE 0 END) as tendency_correct,
  SUM(CASE WHEN pts = 10 THEN 1 ELSE 0 END) as exact_score,
  SUM(pts) as total_points,
  AVG(pts)::decimal as avg_points
FROM predictions p
JOIN matches m ON p.match_id = m.id
WHERE m.competition_id = $competition
  AND m.status = 'finished'
GROUP BY p.model_id
```

## Automated Content Generation Pipeline

### Pipeline Stages

```
Match Completed + Scores Updated
            │
            ▼
    ┌───────────────┐
    │ Trigger Event │  (BullMQ job: "generate-roundup-{match_id}")
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Data Gathering│  (fetch: match data, all model predictions, context)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ LLM Generation│  (prompt with structured context, JSON output)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Content Render│  (markdown/HTML with stats tables, charts)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ SEO Enrich    │  (metadata, JSON-LD, Open Graph)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Static Build  │  (ISR page generation)
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Cache + CDN   │  (Redis cache, Vercel edge)
    └───────────────┘
```

### Content Generation Details

**Data Gathering:**
- Match details (teams, score, events, timeline)
- All model predictions for this match
- Season stats for context (leaders, trends)
- Historical comparison (same fixtures in past)

**LLM Prompt Structure:**
```typescript
interface RoundUpPrompt {
  match: MatchDetails;
  predictions: ModelPrediction[];
  seasonContext: SeasonStats;
  historicalContext: HistoricalComparison[];
  tone: 'analytical' | 'narrative';
  seoKeywords: string[];
}

Generate match roundup:
- Summary: What happened, key moments
- Prediction Analysis: How did models perform?
- Model Leaders: Top 3 performers for this match
- Statistical Highlights: Notable numbers
- Looking Forward: Implications for upcoming matches
```

**Output Format:**
- JSON structure for programmatic use
- Markdown rendered to HTML
- SEO metadata separate

### SEO Architecture

**Page Structure:**
```
/matches/{id}/
  ├── meta-title: "{Home} vs {Away} - Match Analysis | BettingSoccer"
  ├── meta-description: "Detailed analysis of {Home} vs {Away}. See how {N} AI models predicted this {competition} match."
  ├── og-image: Dynamic image with score and top model
  └── json-ld: SportsEvent schema

/matches/{id}/stats
  ├── Detailed prediction breakdown
  ├── Model performance tables
  └── Historical comparisons
```

**ISR Strategy:**
- Revalidate: 60 seconds (fast enough for match updates)
- On-demand: Pre-build popular pages
- Stale-while-revalidate: Serve cached while regenerating

### Integration Points

**Existing System Integration:**
- Match data: Uses existing API-Football integration
- Predictions: Reads from existing predictions table
- Cron jobs: Extend existing cron patterns
- Admin: New admin pages for content preview

**New Dependencies:**
- LLM API: Together.ai (already integrated)
- Chart generation: Chart.js or Recharts
- SEO: Next.js Metadata API (existing)

## Build Order Implications

### Phase Dependencies

```
Phase 1: Stats Foundation
├── Database views/indexes
├── Stats calculation service
└── Basic aggregation API

Phase 2: Stats API + Caching
├── Multi-granularity query API
├── Redis caching layer
└── Cache invalidation logic

Phase 3: Stats UI
├── Leaderboard pages
├── Filter UI components
└── Chart visualizations

Phase 4: Content Pipeline
├── Data gathering service
├── LLM content generation
└── Content templates

Phase 5: SEO + Publication
├── SEO metadata generation
├── ISR page setup
└── JSON-LD structured data
```

### Parallelization Opportunities

**Can run in parallel:**
- Stats API development (Phase 2)
- Content pipeline data gathering (Phase 4)

**Must be sequential:**
- Stats foundation (1) → Stats API (2) → Stats UI (3)
- Content pipeline (4) → SEO publication (5)
