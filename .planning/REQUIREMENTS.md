# Requirements: AI Football Predictions Platform

**Defined:** 2026-02-08
**Core Value:** The prediction pipeline must reliably generate scores from LLMs before kickoff and accurately score them when matches complete

## v2.9 Requirements

Requirements for v2.9 Provider Unification & Maximum Coverage. Each maps to roadmap phases.

### Provider Integration

- [ ] **PROV-01**: OpenRouterProvider class extends OpenAICompatibleProvider with correct endpoint and headers
- [ ] **PROV-02**: Provider uses `OPENROUTER_API_KEY` environment variable for authentication
- [ ] **PROV-03**: Provider sends required `HTTP-Referer` and `X-Title` headers per OpenRouter API spec
- [ ] **PROV-04**: Provider handles OpenRouter model ID format correctly (e.g., `deepseek/deepseek-r1`)
- [ ] **PROV-05**: OpenRouter providers conditionally included when API key is configured

### Provider Routing

- [ ] **ROUT-01**: Each model has an ordered provider priority list (e.g., Synthetic → Together → OpenRouter)
- [ ] **ROUT-02**: Provider routing tries providers in priority order, failing over to next on error
- [ ] **ROUT-03**: Max fallback depth enforced (3 providers max per prediction attempt)
- [ ] **ROUT-04**: Cycle detection prevents infinite fallback loops across providers
- [ ] **ROUT-05**: Provider priority list is configurable per model (not all models exist on all providers)
- [ ] **ROUT-06**: Existing MODEL_FALLBACKS map replaced with provider priority routing system

### Provider Attribution

- [ ] **ATTR-01**: Each prediction records which provider actually served the request
- [ ] **ATTR-02**: Provider attribution stored in predictions table (provider_used field)
- [ ] **ATTR-03**: Admin dashboard shows provider distribution for recent predictions
- [ ] **ATTR-04**: Fallback events logged with original provider and fallback provider

### Model Consolidation

- [ ] **CONS-01**: 13 Synthetic -syn models merged into base model IDs (e.g., deepseek-r1-0528-syn → deepseek-r1)
- [ ] **CONS-02**: Prediction history from -syn models migrated to consolidated model IDs
- [ ] **CONS-03**: 6 Synthetic-only models renamed without -syn suffix (e.g., minimax-m2-syn → minimax-m2)
- [ ] **CONS-04**: Foreign keys updated across all referencing tables (predictions, llm_model_stats, bets, model_balances)
- [ ] **CONS-05**: Duplicate predictions for same match/model resolved with deterministic precedence rules
- [ ] **CONS-06**: Leaderboard aggregates recalculated after model consolidation
- [ ] **CONS-07**: Cache invalidation covers all model-keyed caches after migration
- [ ] **CONS-08**: Migration is idempotent and includes pre/post validation (row count checksums, referential integrity)

### Model Re-Activation

- [ ] **REACT-01**: 7 deprecated Together AI models re-activated with OpenRouter as primary provider
- [ ] **REACT-02**: Re-activated models use correct OpenRouter model IDs verified against OpenRouter API
- [ ] **REACT-03**: Re-activated models tested for valid JSON prediction output before going live
- [ ] **REACT-04**: Model count updated from 35 to target count after consolidation and re-activation
- [ ] **REACT-05**: Dynamic model count (getActiveModelCount) reflects new consolidated count across SEO, content, and system prompts

### Cost & Budget Control

- [ ] **COST-01**: Actual provider cost tracked per prediction including fallback costs
- [ ] **COST-02**: Budget circuit breaker pauses OpenRouter fallback when daily cost exceeds threshold
- [ ] **COST-03**: Cost comparison visible per provider in admin dashboard
- [ ] **COST-04**: Warning logged when fallback to more expensive provider is triggered

### Provider Health Monitoring

- [ ] **HLTH-01**: Per-provider success rate tracked (not just per-model)
- [ ] **HLTH-02**: Provider latency tracked and visible in admin dashboard
- [ ] **HLTH-03**: Provider health cards added to admin dashboard alongside model health cards
- [ ] **HLTH-04**: Regression alert when provider-wide success rate drops below threshold

## v3.0 Requirements

Requirements for v3.0 Club/Team Pages. Each maps to roadmap phases.

### Team Pages

- [ ] **PAGE-01**: User can view a dedicated team page at `/teams/[slug]` for any club across all 17 leagues
- [ ] **PAGE-02**: User can browse all clubs on the `/teams` index page with logos and league grouping
- [ ] **PAGE-03**: Team slugs correctly resolve to stored team names including aliases (e.g., `/teams/man-city` → "Manchester City")
- [ ] **PAGE-04**: User sees breadcrumb navigation on team pages (Home > Teams > Club Name)

### Leaderboard & Stats

- [ ] **STAT-01**: User can see which AI models predict best for a specific club via per-club leaderboard
- [ ] **STAT-02**: User can filter club leaderboard by time period (all-time, season, monthly, weekly)
- [ ] **STAT-03**: User can see club statistics (W/D/L record, goals scored/conceded, averages)
- [ ] **STAT-04**: User can view model accuracy trends over time for a specific club

### Match Display

- [ ] **MTCH-01**: User can see upcoming match predictions for a club with model prediction distribution
- [ ] **MTCH-02**: User can see recent match results with scores and prediction accuracy for a club
- [ ] **MTCH-03**: User can see a visual form indicator (W/D/L timeline) for the club's last matches

### Navigation

- [ ] **NAV-01**: User can click team names on league pages to navigate to team pages
- [ ] **NAV-02**: User can click team names on match detail pages to navigate to team pages

### SEO & Content

- [ ] **SEO-01**: Team pages have Schema.org SportsTeam structured data markup (JSON-LD)
- [ ] **SEO-02**: Team pages have proper meta tags, canonical URLs, and OG images
- [ ] **SEO-03**: Team pages are included in sitemap with content quality filtering (5+ matches threshold)
- [ ] **SEO-04**: Team pages include AI-generated club analysis content (form, model trends, prediction patterns)
- [ ] **SEO-05**: Team pages include dynamically generated club-specific FAQs with FAQPage schema

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Routing (v2.9)

- **ADVR-01**: Weighted load balancing across providers based on health scores
- **ADVR-02**: Dynamic priority adjustment based on rolling window metrics
- **ADVR-03**: Latency-based routing (prefer fastest provider)
- **ADVR-04**: Geographic routing for latency optimization

### Advanced Team Features (v3.x)

- **ADVT-01**: Head-to-head model comparison for a specific club
- **ADVT-02**: Best/worst matchups analysis (model performance by opponent)
- **ADVT-03**: Model recommendation for upcoming matches based on historical accuracy
- **ADVT-04**: Interactive prediction accuracy heatmap
- **ADVT-05**: Team comparison tool (compare AI prediction accuracy across clubs)
- **ADVT-06**: Teams index page with filtering and search

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Weighted load balancing | Sequential fallback sufficient for current scale, adds complexity |
| Real-time provider switching | Deterministic routing preferred for reproducibility |
| New model additions (beyond re-activation) | Scope limited to unification, not expansion |
| Provider-level rate limiting | OpenRouter handles its own rate limiting |
| Staging environment for migration testing | Use production backup + transaction rollback instead |
| Real-time live match updates | Not our differentiator, adds complexity and API cost |
| Player-level statistics | Massive scope creep, not related to AI predictions core value |
| User comments/predictions | Moderation burden, distracts from AI focus |
| Betting odds integration | Regulatory/legal complexity, not our expertise |
| Club news aggregation | Content licensing issues, maintenance burden |
| Separate teams database table | Teams as text strings sufficient, avoid migration complexity |
| Historical data beyond 2-3 seasons | Diminishing returns, models didn't exist before 2023 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 59 | Pending |
| PROV-02 | Phase 59 | Pending |
| PROV-03 | Phase 59 | Pending |
| PROV-04 | Phase 59 | Pending |
| PROV-05 | Phase 59 | Pending |
| ROUT-01 | Phase 60 | Pending |
| ROUT-02 | Phase 60 | Pending |
| ROUT-03 | Phase 60 | Pending |
| ROUT-04 | Phase 60 | Pending |
| ROUT-05 | Phase 60 | Pending |
| ROUT-06 | Phase 60 | Pending |
| ATTR-01 | Phase 61 | Pending |
| ATTR-02 | Phase 61 | Pending |
| ATTR-03 | Phase 61 | Pending |
| ATTR-04 | Phase 61 | Pending |
| CONS-01 | Phase 62 | Pending |
| CONS-02 | Phase 62 | Pending |
| CONS-05 | Phase 62 | Pending |
| CONS-08 | Phase 62 | Pending |
| CONS-03 | Phase 63 | Pending |
| CONS-04 | Phase 63 | Pending |
| CONS-06 | Phase 63 | Pending |
| CONS-07 | Phase 63 | Pending |
| REACT-01 | Phase 64 | Pending |
| REACT-02 | Phase 64 | Pending |
| REACT-03 | Phase 64 | Pending |
| REACT-04 | Phase 64 | Pending |
| REACT-05 | Phase 64 | Pending |
| COST-01 | Phase 65 | Pending |
| COST-02 | Phase 65 | Pending |
| COST-03 | Phase 65 | Pending |
| COST-04 | Phase 65 | Pending |
| HLTH-01 | Phase 66 | Pending |
| HLTH-02 | Phase 66 | Pending |
| HLTH-03 | Phase 66 | Pending |
| HLTH-04 | Phase 66 | Pending |

**Coverage (v2.9):**
- v2.9 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

**Coverage (v3.0):**
- v3.0 requirements: 18 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 18

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-11 after v3.0 requirements definition*
