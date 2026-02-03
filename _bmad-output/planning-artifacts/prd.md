
---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-success", "step-04-journeys", "step-05-domain", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish"]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-bettingsoccer-2026-01-28.md
workflowType: 'prd'
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 0
classification:
  projectType: web_app
  domain: general (sports/football predictions)
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - bettingsoccer

**Author:** Pieter
**Date:** 2026-01-28

## Executive Summary
BettingSoccer is a Next.js web app that compares football match predictions from multiple LLM models. The immediate priority is reliability: core routes (notably Match Details and the Leaderboard) must not error or show incorrect empty states. The primary user value is match-level auditability: visitors should be able to see all predictions made by an LLM for a match, compare models side-by-side, and trust the displayed scoring. The secondary value is operational control: admin tooling must surface pipeline failures quickly and enable bounded recovery actions (retry/backfill/rescore) so public pages stay correct and fresh.

## Project Classification
- Project type: web_app
- Domain: general (sports/football predictions)
- Complexity: medium
- Context: greenfield

## Success Criteria

### User Success
- Core journeys are consistently usable:
  - Compare models via Leaderboard
  - Drill into Match Details to inspect per-model predictions and outcomes
- Must-work routes load without errors: Home, Matches, Match Details, Leagues, Leaderboard, Blog, Admin
- Data trust:
  - Leaderboard is never empty when scored predictions exist
  - Match Details never hard-fails; missing content shows “not generated yet” (clear empty state)

### Business Success
- Stability phase completed in ~2 weeks: core routes stable, major errors eliminated, pipelines producing expected outputs
- Foundation established to compete on differentiation (multi-LLM comparison + richer insights) after MVP
- Operational confidence: failures become visible quickly and do not linger

### Technical Success
- Availability/error rate:
  - 5xx rate per must-work route < 1% over rolling 7 days (goal ~0%)
  - Near-zero uncaught client runtime errors (via logging/Sentry)
- Freshness/staleness:
  - “Empty leaderboard with scored predictions present” = 0 incidents/week
  - Stale/missing data is detected and surfaced in Admin within minutes
- Worker/queue health:
  - Failed jobs + retry backlog visible in Admin; no stuck failures beyond an agreed window
  - Manual retry actions available for key pipelines

### Measurable Outcomes
- Synthetic journey pass rate (automated):
  - Home loads
  - Matches list loads and shows rows
  - Match details loads and shows predictions + score (when available)
  - Leaderboard loads and shows rows (when scored predictions exist)
  - Leagues load and shows matches
  - Blog loads and shows posts
  - Admin loads and shows system status
- Performance baseline:
  - P95 page load time thresholds: TBD (you set target)

## Product Scope

### MVP - Minimum Viable Product
- Stability + correctness across core pages; correct validated KPIs
- Match Details shows: score/live score, per-model predictions, pre/mid/post analysis sections, odds
- Leagues filter/show matches correctly (no empty pages due to filtering issues)
- Leaderboard:
  - Non-empty when scored predictions exist
  - Avg points per game validated and correct
  - Basic filtering (league/competition and key dimensions)
- Admin:
  - Failed jobs, stale data, missing data, last-run timestamps/last activity
  - Manual retry actions

### Growth Features (Post-MVP)
- Richer prediction insights (deeper stats/visualizations)
- User alerts (interesting matches, consensus shifts)
- More powerful leaderboard views (segmentation, time windows, etc.)

### Vision (Future)
- Proactive admin alerting/notifications on pipeline failures
- Best-in-class transparent multi-LLM evaluation and “why” explanations at match + aggregate level

## User Journeys

### Journey 1: Visitor Happy Path (Homepage → Proof → Match Audit)
A casual football fan lands on the homepage, curious whether LLMs can actually predict football. They scan the page for a quick “is this alive?” signal (recent matches, upcoming fixtures, top models, last updated). They click into a match that already has predictions and a known result.

On the match detail page, they see a clear list of “all predictions made by this LLM” for the match (and other LLMs), alongside the actual score/outcome. The page reads like an audit trail: what the model predicted, what happened, and what points it earned. They click a second match to confirm it wasn’t a fluke. They leave feeling: “Ok, I can verify what each model said and judge how good it is.”

Failure points + recovery:
- If some content isn’t generated yet, they see a clear “not generated yet” state and what to expect next (instead of an error).
- If results aren’t final yet, they see “live/in progress” and when it last updated.

### Journey 2: Visitor Edge Case (Missing Data + Contradictions + Staleness)
The same visitor returns later and opens the homepage again. They click a match but hit three trust breakers:
1) Missing data: predictions exist for some models but not others, or post-match content is absent.
2) Contradictory predictions: models disagree heavily (home vs away vs draw).
3) Staleness: match is finished but the score/points/leaderboard hasn’t updated.

Instead of a broken page or confusing emptiness, the UI makes the situation legible:
- Missing pieces are labeled per model/section (“pending”, “failed”, “not scheduled”, etc.) with a last-attempt timestamp when relevant.
- Contradictions are presented as a comparison (not hidden): visitor can quickly see which model said what, and how they’re scored.
- If stale, the page signals “data may be stale” with last updated time and which pipeline stage is lagging (results vs scoring vs aggregation/cache).

Resolution: the visitor can still complete their goal—auditing what was predicted—while understanding what’s incomplete and why, preserving trust.

### Journey 3: Admin/Operator Happy Path (Daily Health Check → Fix Before Users Notice)
The operator opens Admin to answer: “Is the site safe right now?” They see an at-a-glance health panel:
- queue/worker health, failed jobs, retries/backlog
- freshness indicators (last-run times; number of matches missing predictions/results/scoring beyond expected windows)
- a specific red flag: “leaderboard empty while scored predictions exist” (should never happen)

They click into the issue and take action:
- retry failed jobs for a match/model batch
- trigger a backfill/rescore for a date range or competition
- confirm the pipeline has recovered (status turns green; affected pages show data)

They leave with confidence that failures won’t linger silently.

### Journey 4: Admin/Operator Edge Case (Incident Response: Queue Stuck + Rate Limits + DB Inconsistency)
A user reports “match details errors” or “leaderboard empty.” Admin shows multiple simultaneous failure modes:
- queue is stuck (workers not consuming or jobs repeatedly failing)
- API-Football rate limit caused fetch gaps
- DB inconsistency or partial writes created “present-but-incomplete” aggregates

The operator follows a guided troubleshooting flow:
- identify the failing stage (fixtures fetch vs analysis generation vs predictions vs scoring vs aggregation/cache)
- inspect a failure reason (error messages, last attempt, affected match IDs/models)
- apply the appropriate fix:
  - rate limit: throttle/retry later, rerun missing window
  - queue stuck: restart worker, requeue dead-letter, clear stuck locks (safe tooling)
  - DB inconsistency: rerun scoring/aggregation for affected range, validate counts
- verify recovery with the same synthetic journey checks users depend on (homepage/matches/match detail/leaderboard)

Resolution: the operator can restore correctness without guessing, and the system leaves an audit trail of what was rerun and why.

### Journey Requirements Summary
These journeys imply capabilities for:
- Homepage that clearly routes to “audit a match” and shows freshness/last-updated signals
- Match Details as an audit surface:
  - per-model “all predictions for this match” visibility
  - clear states for missing/not-yet-generated/failed sections
  - timestamps (“last updated”, “last attempted”) where relevant
- Trust-preserving failure UX (no hard crashes; legible incomplete states)
- Freshness detection and staleness surfacing (match finished but results/scoring/leaderboard lagging)
- Admin operations:
  - job/queue health, failed jobs, retries/backlog, last-run timestamps
  - drilldowns by match/model/stage
  - safe manual actions: retry, backfill, rescore, re-aggregate
  - incident troubleshooting flow (queue stuck, rate limits, DB inconsistencies)
- Validation hooks:
  - synthetic journey checks to confirm end-to-end usability after fixes
  - “leaderboard empty while scored predictions exist” treated as a first-class incident

## Domain-Specific Requirements

### Compliance & Regulatory
- GDPR baseline (EU-hosted):
  - No tracking cookies/analytics by default; avoid non-essential cookies
  - Keep any logs free of personal data by design (no accounts assumed); if IPs are logged, treat as personal data and keep retention minimal and explicit

### Technical Constraints
- Data source dependency:
  - API-Football is the single source of truth for fixtures/results/odds; design for outages, rate limits, and partial responses
- Freshness target:
  - Live match updates should reflect within ~1 minute of source updates (where feasible)
- Correctness-first:
  - Prefer “unknown / pending / not generated yet” states over showing unvalidated or inconsistent data
  - Treat leaderboard/model KPIs as derived data that must be reproducible from underlying match + prediction records

### Integration Requirements
- API-Football integration requirements:
  - Clear provenance per match: source IDs, last fetched timestamp, last successful fetch timestamp
  - Resilient fetching: retries/backoff for rate limit and transient errors; capture failure reasons for admin visibility
- Worker/queue + Redis always-on:
  - Queue state is authoritative for pipeline progression; admin should surface queue health, failures, and retry/backfill controls

### Risk Mitigations
- Wrong data display (highest risk):
  - Validate critical fields (scores, match status, competition mapping) before surfacing
  - Add sanity checks for derived stats (leaderboard averages, counts) and flag anomalies
- Calculation correctness for leaderboard/model metrics:
  - Define and enforce calculation invariants (e.g., points per game based on scored predictions only)
  - Detect and alert on impossible states (e.g., “leaderboard empty while scored predictions exist”)
- Staleness:
  - Detect finished matches without final result/scoring beyond expected windows; surface as incidents in Admin
- External dependency failure:
  - Graceful degradation when API-Football fails/rate-limits: keep last-known good data, mark stale, and show “last updated” timestamps

## Web App Specific Requirements

### Project-Type Overview
BettingSoccer is an SEO-first Next.js web app (MPA-style navigation is acceptable) where the primary user value is auditing LLM predictions on match detail pages. Key public pages (home, matches, match detail, leagues, leaderboard, blog) must be indexable and resilient to partial/missing data.

### Technical Architecture Considerations
- Rendering approach:
  - Prefer server-rendered pages (MPA feel) for crawlability and predictable performance.
  - Use stable, shareable URLs for matches/leagues/models so pages are linkable and indexable.
- Auto-refresh behavior:
  - Match Details and Leaderboard should auto-refresh to reflect live updates (target cadence: ~60s).
  - Auto-refresh must degrade safely: avoid request storms, respect rate limits, and show “last updated” timestamps.
- Caching and freshness:
  - SEO pages should remain cache-friendly while still meeting freshness needs (clear revalidation/polling strategy per route).
  - Ensure cached aggregates never present incorrect emptiness (e.g., leaderboard empty while scored predictions exist).
- Error handling:
  - No hard crashes on public routes; prefer explicit empty/pending/error states and preserve the audit trail of what exists.

### Browser Support Matrix
- Supported:
  - Chrome (latest 2 versions)
  - Firefox (latest 2 versions)
  - Safari (latest 2 major versions)
  - Edge (latest 2 versions)
  - iOS Safari (latest 2 major versions)
- Not supported: Internet Explorer

### Responsive Design
- Mobile-first, fully responsive across phone/tablet/desktop.
- Match and leaderboard tables must remain usable on mobile (horizontal overflow handling, stacked key fields, readable typography).

### SEO Strategy (SEO + GEO)
- SEO must be a first-class requirement for: Homepage, Matches, Match Details, Leagues, Leaderboard, Blog
- SEO basics:
  - Unique titles/descriptions per page; canonical URLs; open graph metadata
  - XML sitemaps for matches/leagues/blog; robots.txt configured intentionally
  - Structured data where appropriate (e.g., match/event schema, breadcrumb schema)
- GEO (Generative Engine Optimization) basics:
  - Pages should have clear, structured headings and concise summaries so LLMs can quote/ground answers.
  - Prefer consistent, machine-readable sections (e.g., “Predictions”, “Outcome”, “Model Performance”) to improve extractability.

### Accessibility Level
- Best-effort accessibility:
  - Semantic HTML, keyboard support for key flows, visible focus states
  - Basic contrast and readable text sizing across devices

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience + Operations MVP
- Experience MVP: SEO-first public product that lets visitors audit LLM predictions on match detail pages (trust loop).
- Operations MVP: admin tooling that prevents silent pipeline failures that break public pages and trust.

**Resource Requirements:** Solo developer
- Prioritize “reliability and correctness” over feature breadth.
- Minimize new surface area: ship with narrow, high-leverage admin capabilities instead of broad dashboards.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Visitor: Homepage → choose match → audit “all predictions by an LLM” on Match Details → compare across models
- Visitor edge cases: missing data + contradictory predictions + staleness handled with clear states (no hard failures)
- Admin: daily health check → detect failures/staleness → retry/backfill/rescore → verify recovery

**Must-Have Capabilities:**
- No user accounts/login (ever); public, linkable experience
- SEO + GEO:
  - Indexable pages for home/matches/match details/leagues/leaderboard/blog
  - Stable URLs and metadata; sitemap/robots; structured headings for extractability
- Match Details as audit surface:
  - Show per-model predictions + outcome + points/scoring
  - Include the 3 analysis sections as a core trust feature
  - Auto-refresh (~60s) with safe behavior and “last updated” timestamps
  - Clear pending/failed/not-generated states rather than errors
- Leaderboard correctness:
  - Avg points per game and related KPIs validated and reproducible from underlying records
  - “Leaderboard empty while scored predictions exist” treated as a critical invariant
  - Auto-refresh (~60s) where relevant
- Admin/Operations (keep tight):
  - Queue/worker health (running, failing, stuck), failed jobs, retry backlog
  - Staleness/missing-data detection (predictions/results/scoring beyond expected windows)
  - Manual actions: retry, backfill, rescore/re-aggregate for a range/competition
  - Enough diagnostics to identify failing pipeline stage and reason (rate limit, job failure, partial data)

### Post-MVP Features

**Phase 2 (Post-MVP):**
- Richer prediction insights and visualizations beyond baseline auditability
- More powerful leaderboard segmentation/time windows
- Better contradiction visualization/consensus indicators
- Proactive admin alerting (notifications) once signal quality is good

**Phase 3 (Expansion):**
- “Best-in-class” transparent model evaluation:
  - deeper “why” explanations at match + aggregate level
  - public-facing reliability/freshness reporting (“status” for data pipelines)
- Broader content/SEO expansion (more leagues, more derived pages)

### Risk Mitigation Strategy

**Technical Risks:** Admin/worker observability and silent pipeline failures
- Mitigation:
  - Make pipeline stages explicit in Admin (fetch → analysis → prediction → results → scoring → aggregation/cache)
  - Surface last-success timestamps and counts for each stage
  - Provide safe rerun controls with bounded scopes (date range, competition, match IDs)
  - Add invariant checks for correctness (leaderboard non-empty when data exists; KPI sanity checks)

**Market Risks:** Visitors don’t trust LLM predictions or don’t find it useful
- Mitigation:
  - Lead with match-level auditability and clarity (“what was predicted vs what happened”)
  - SEO/GEO ensures discoverability; match pages should stand alone as credible artifacts
  - Keep UX fast and reliable; no broken/empty pages

**Resource Risks:** Solo bandwidth limits
- Mitigation:
  - Aggressively limit admin surface area to the minimum needed to prevent/repair breakages
  - Defer all “nice-to-have insights” until reliability and pipeline visibility are stable
  - Prefer simple, testable invariants + synthetic journey checks over heavy monitoring systems

## Functional Requirements

### Public Navigation & Discovery
- FR1: Visitors can access the homepage as the primary entrypoint.
- FR2: Visitors can navigate from the homepage to matches, leagues, leaderboard, blog, and model pages.
- FR3: Visitors can access a matches listing and open an individual match details page.
- FR4: Visitors can access league pages and view matches scoped to a league/competition.
- FR5: Visitors can access a leaderboard view of model performance.
- FR6: Visitors can access a model page for an individual LLM model.
- FR7: Visitors can navigate between a model page, match pages, and the leaderboard without losing context (via linkable URLs).

### Match Audit (Core Differentiator)
- FR8: Visitors can view match metadata (teams, kickoff time, competition) on a match details page.
- FR9: Visitors can view the match status (scheduled/live/finished) on a match details page.
- FR10: Visitors can view the match score when available on a match details page.
- FR11: Visitors can view per-model predictions for a match on a match details page.
- FR12: Visitors can view the points/scoring outcome for each model’s prediction when the match is scoreable.
- FR13: Visitors can view the required analysis sections on a match details page (pre-match analysis, model prediction, post-match analysis) when available.
- FR14: Visitors can view odds on a match details page when available.
- FR15: Visitors can compare multiple models’ predictions for the same match on the match details page.

### Missing/Incomplete Data Handling (Trust Preservation)
- FR16: Visitors can distinguish between “not generated yet”, “missing”, and “failed” content states for match-related content.
- FR17: Visitors can view a clear indication when match data is stale and when it was last updated.
- FR18: Visitors can access match pages even when some content is incomplete, without encountering a hard failure.
- FR19: Visitors can understand which portions of match content are pending or unavailable without ambiguity.

### Leaderboard & Model Performance
- FR20: Visitors can view a non-empty leaderboard when scored predictions exist.
- FR21: Visitors can view model performance metrics including average points per game on the leaderboard.
- FR22: Visitors can filter leaderboard views by competition/league (and other key dimensions as supported).
- FR23: Visitors can open a model page from the leaderboard.
- FR24: Visitors can view a model’s performance summary on a model page.
- FR25: Visitors can view the set of matches/predictions associated with a model on the model page.
- FR26: Visitors can drill down from a model page into a specific match to audit that model’s prediction.

### Auto-Refresh & Freshness (User-Facing)
- FR27: Visitors can have match details data auto-refresh while viewing a match.
- FR28: Visitors can have leaderboard/model performance views auto-refresh.
- FR29: Visitors can see a “last updated” indicator on auto-refreshing views.

### Blog & Content
- FR30: Visitors can view a blog index/listing.
- FR31: Visitors can open and read an individual blog post.

### Admin: Monitoring & Health
- FR32: Admin operators can access an admin area to view system health signals.
- FR33: Admin operators can view queue/worker status including failing and stuck conditions.
- FR34: Admin operators can view failed jobs and their failure reasons.
- FR35: Admin operators can view retry backlog and job state distribution.
- FR36: Admin operators can view freshness indicators and last-run timestamps for key pipeline stages.
- FR37: Admin operators can identify matches missing predictions, missing results, missing scoring, or missing aggregates beyond expected windows.
- FR38: Admin operators can detect and view incidents where derived public data is inconsistent with underlying data (e.g., leaderboard empty while scored predictions exist).

### Admin: Manual Recovery Actions
- FR39: Admin operators can retry failed jobs.
- FR40: Admin operators can trigger backfill for missing data over a bounded scope (e.g., date range, competition, match IDs).
- FR41: Admin operators can trigger rescore/re-aggregation over a bounded scope.
- FR42: Admin operators can verify that recovery actions have restored expected public data availability.

### SEO/GEO Support (Capability Level)
- FR43: The system can present indexable, stable URLs for public pages (matches, leagues, models, leaderboard, blog).
- FR44: The system can provide unique page metadata per public page (title/description and canonical URL).
- FR45: The system can provide sitemap outputs for indexable content areas.
- FR46: The system can present consistently structured page content sections to support machine readability (GEO).

### Data Provenance (Public + Admin)
- FR47: Admin operators can view source identifiers and last successful fetch timestamps for match data sourced from API-Football.
- FR48: The system can surface the data source provenance (at least “last updated”) on public match pages.

## Non-Functional Requirements

### Performance
- Public pages should meet Core Web Vitals targets (p75):
  - LCP ≤ 2.5s
  - INP ≤ 200ms
  - CLS ≤ 0.1
- Indexable pages should avoid unnecessary client-side work that harms crawlability and performance.

### Reliability
- Must-work routes (Home, Matches, Match Details, Leagues, Leaderboard, Blog, Admin) should sustain a 7-day rolling 5xx rate below 1% (goal: ~0%).
- Public pages should fail gracefully (no hard crashes) when data is missing or incomplete.

### Freshness
- For live matches, user-facing pages that display live status/scores should reflect updates within ~1 minute (where source updates are available).
- For non-live periods, leaderboard/model pages may refresh at a slower cadence (up to ~5 minutes) while still showing a clear “last updated” timestamp.

### Security
- Admin access must be protected with a simple mechanism (e.g., shared-secret/basic protection) appropriate for a solo-operated system.
- The system should avoid exposing internal failure details to public users beyond safe, user-facing “pending/failed” states.

### Integration
- External dependency (API-Football) failures and rate limits must not break public pages; the system should degrade safely and surface staleness.

### Privacy (GDPR Baseline)
- The product should avoid non-essential cookies/tracking by default.
- Operational logs should be retained for ~14 days and avoid storing personal data by design where feasible.
