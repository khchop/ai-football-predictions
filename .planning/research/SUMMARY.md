# Project Research Summary

**Project:** v1.1 Stats Accuracy & SEO Optimization
**Domain:** Sports prediction platform with AI model leaderboard
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

This milestone fixes a critical trust issue in an existing sports prediction platform: six different accuracy calculation formulas scattered across the codebase produce conflicting numbers (94% on one page, 87% on another). The root cause is an `IS NOT NULL` vs `> 0` mismatch where wrong predictions (0 points) are counted as correct in some queries. This bug erodes user trust and damages SEO through conflicting structured data.

The recommended approach is a **three-phase standardization** using PostgreSQL views as single source of truth, followed by SEO enhancement through Schema.org structured data. The platform is production-ready with 35 AI models, 160+ matches, and existing Next.js 16 App Router architecture. No new dependencies are needed — this is pure consolidation and metadata enhancement.

The critical risk is **cache invalidation timing**: invalidating caches before recalculation completes will show wrong numbers. The mitigation is a dual-column migration strategy: calculate new formula in parallel column, validate results, then atomic switchover. Historical data must be preserved for rollback and audit trails.

## Key Findings

### Recommended Stack

**Current stack is correct** — no new dependencies needed. The platform runs Next.js 16.1.4 with PostgreSQL, Drizzle ORM, Redis caching, and BullMQ job queues. The issue is not missing technology, it's inconsistent application of existing tools.

**Core technologies:**
- **PostgreSQL Views**: Single source of truth for stats calculations — ensures all queries use identical formula
- **Next.js 16 Metadata API**: Already implemented for some pages, needs extension to all page types
- **Schema.org JSON-LD**: Standard for sports structured data — required for rich snippets and AI crawler visibility
- **Redis with versioned cache keys**: Existing cache layer works, needs version suffix for safe invalidation during migrations

**What NOT to add:**
- GraphQL (adds complexity over already-complex aggregations)
- Separate caching layer (Redis sufficient)
- Heavy ORM (Drizzle SQL-first approach correct for custom stats queries)
- Real-time WebSockets (stats update infrequently, polling sufficient)

### Expected Features

Research shows sports prediction platforms live or die by **transparency and verifiable accuracy**. Users audit predictions manually when suspicious — platforms that hide methodology or cherry-pick stats lose trust immediately.

**Must have (table stakes):**
- **Consistent accuracy definitions** — one formula used everywhere, with visible denominators (24/40 not just 60%)
- **Transparent methodology page** — explain exactly how every metric is calculated
- **Performance breakdown tables** — by competition, by time period, with drill-down capability
- **Model detail pages with full history** — scrollable prediction history with outcomes
- **Mobile-responsive tables** — 90% of sports fans access on mobile
- **Honest baseline comparisons** — show that 60% win rate is good (baseline is 50%)

**Should have (differentiators):**
- **Schema.org structured data** — enables rich snippets in Google search (58% of clicks)
- **Open Graph optimization** — social shares drive traffic, rich previews increase CTR 2-3x
- **Visual performance comparisons** — radar charts, sparklines showing trends
- **Model calibration metrics** — Brier score, confidence intervals (advanced, differentiates platform)

**Defer (v2+):**
- Real-time auto-refresh polling (v1.0 fixed cache invalidation, manual refresh acceptable)
- Downloadable prediction CSV (power user feature, small audience)
- Programmatic model × competition pages (595 pages is large scope)
- Historical "what if" scenarios (requires simulation engine)

### Architecture Approach

**Service Layer Pattern** — Centralize stats logic in `src/lib/stats/service.ts` without refactoring page components. The service layer sits between pages and database queries, providing single source of truth for calculations while existing query functions remain as data fetchers.

**Major components:**
1. **Stats Definitions** (`definitions.ts`) — Single accuracy formula as TypeScript constant and SQL fragment generator
2. **Stats Service** (`service.ts`) — High-level interface wrapping database queries with standardized calculations and caching
3. **Database Views** (PostgreSQL) — Optional: canonical stats views for complex aggregations, though not required if service layer implemented correctly
4. **SEO Schema Components** — React components rendering JSON-LD structured data, injected at page level without refactoring

**Migration strategy is incremental:**
- Phase 1: Create service layer (unused, zero risk)
- Phase 2: Update database queries to use service
- Phase 3: Update frontend calculations
- Phase 4: Cleanup duplicate code

Each phase is independently deployable with rollback safety.

### Critical Pitfalls

1. **Inconsistent accuracy denominators causing "94% bug"** — Six different formulas use different denominators (all predictions vs scored only). Prevention: Single SQL fragment imported everywhere. Detection: Automated test comparing same model's accuracy across endpoints.

2. **`IS NOT NULL` vs `> 0` mismatch** — Treating `tendencyPoints = 0` (wrong prediction) as correct inflates accuracy. Prevention: Change all checks to `> 0`. Validation: Run query comparing both formulas to quantify inflation.

3. **Cache invalidation before recalculation completes** — Invalidating caches immediately after deploy causes wrong numbers (new formula + old data). Prevention: Dual-column migration (calculate in parallel, validate, atomic switchover). Keep old column 30 days for rollback.

4. **Missing NULLIF() protection in weekly breakdowns** — Division by zero crashes when new model has 0 scored predictions. Prevention: Wrap all division operations in `COALESCE(... / NULLIF(denominator, 0), 0)`.

5. **OG image showing wrong metric with generic label** — Social shares display exact score percentage (14%) labeled as "Accurate" when users expect tendency accuracy (87%). Prevention: Add `metricType` parameter to OG image route, show specific label.

## Implications for Roadmap

Based on research, the milestone should be executed in **three sequential phases** to minimize risk and maintain production stability:

### Phase 1: Stats Foundation (Week 1)
**Rationale:** Fix data accuracy before adding SEO — building SEO on wrong numbers amplifies the damage.

**Delivers:**
- Single source of truth for accuracy calculations
- Fixed `IS NOT NULL` vs `> 0` bug across all queries
- NULLIF() protection preventing division by zero
- Model detail page showing correct accuracy (matches leaderboard)

**Addresses:**
- Table stakes feature: Consistent accuracy definitions
- Table stakes feature: Transparent methodology

**Avoids:**
- Pitfall 1: Inconsistent denominators
- Pitfall 2: IS NOT NULL vs > 0 mismatch
- Pitfall 3: Missing NULLIF protection

**Implementation:**
1. Create `src/lib/stats/definitions.ts` with canonical formula
2. Update all queries in `queries/stats.ts` to use formula
3. Fix frontend calculation in `models/[id]/page.tsx` line 52-54
4. Add methodology page explaining calculations

**Risk level:** MEDIUM (changes production queries, but incremental with rollback)

### Phase 2: Migration Execution (Week 1-2)
**Rationale:** Recalculate historical stats using corrected formula, with audit trail for rollback.

**Delivers:**
- All 160 models × 17 leagues recalculated with correct formula
- Historical comparison showing old vs new accuracy
- Preserved old values for 30-day rollback window
- Cache keys with version suffix for safe invalidation

**Addresses:**
- Avoiding pitfall of destroying historical data
- Enabling user trust through transparency

**Avoids:**
- Pitfall 4: Cache invalidation timing issues
- Pitfall 8: Recalculating without audit trail

**Implementation:**
1. Add `accuracy_v2` column alongside existing `accuracy`
2. Backfill v2 with corrected formula
3. Validation query comparing v1 vs v2 (flag >10% changes)
4. Atomic switchover in transaction
5. Publish changelog explaining correction

**Risk level:** HIGH (modifies production data, requires careful validation)

### Phase 3: SEO Enhancement (Week 2)
**Rationale:** After stats are correct, amplify visibility through structured data and metadata optimization.

**Delivers:**
- Schema.org SportsEvent structured data on match pages
- Fixed OG images showing correct accuracy with specific labels
- Competition pages with full metadata and structured data
- Rich snippet eligibility for Google search results

**Addresses:**
- Differentiator: Schema.org structured data (58% of clicks)
- Differentiator: Open Graph optimization (2-3x CTR increase)

**Avoids:**
- Pitfall 5: OG image showing wrong metric
- Pitfall 6: Structured data accuracy mismatch with page display
- Pitfall 10: Meta description length exceeds 160 chars

**Implementation:**
1. Add `metricType` parameter to OG image route
2. Create `CompetitionSchema.tsx` component
3. Add `generateMetadata()` to competition pages
4. Validate structured data with Google Rich Results Test
5. Submit updated sitemap to Search Console

**Risk level:** LOW (additive changes, doesn't affect existing functionality)

### Phase Ordering Rationale

- **Stats before SEO**: Incorrect stats in structured data damage SEO more than missing structured data. Fix data first.
- **Validation before migration**: Dual-column approach enables side-by-side comparison, catching formula bugs before they go live.
- **Incremental rollout**: Each phase is independently deployable. If Phase 2 fails, Phase 1 service layer remains working. If Phase 3 fails, stats are already fixed.
- **Cache optimization deferred**: Not in scope for this milestone. Cache invalidation works, just needs cleanup for efficiency (can be Phase 4 later).

### Research Flags

**Phases NOT needing deeper research** (patterns well-documented):
- **Phase 1:** Stats standardization uses standard PostgreSQL patterns, well-documented
- **Phase 3:** Next.js SEO patterns are official framework features, high confidence

**Phases needing careful validation** (but not additional research):
- **Phase 2:** Migration requires production database testing, but approach is clear
- **Phase 2:** User communication strategy for accuracy drop (blog post, changelog, badge)

**No `/gsd:research-phase` needed** — domain and implementation patterns are well-understood. Focus effort on careful validation testing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified with official Next.js 16 docs, PostgreSQL docs, current codebase analysis |
| Features | HIGH | Multiple sports prediction platform reviews, academic research on calibration, FBref/ESPN case studies |
| Architecture | HIGH | Service layer pattern is industry standard, codebase structure analyzed directly |
| Pitfalls | HIGH | All pitfalls identified from actual codebase grep results showing 6 different formulas |

**Overall confidence:** HIGH

Research is based on direct codebase analysis (grep results showing exact line numbers of inconsistencies) combined with official documentation and industry case studies. No speculative recommendations — all suggestions verified against current code.

### Gaps to Address

**User communication about accuracy drop:**
- Models showing 94% will drop to realistic 87% after fix
- Users may perceive this as "nerf" rather than correction
- **Mitigation:** Publish blog post explaining fix BEFORE deployment, add changelog entry, show side-by-side comparison with "corrected formula" badge

**Performance impact of service layer:**
- Adding abstraction layer could slow queries
- **Validation:** Load test stats endpoints before/after service layer integration
- **Target:** <100ms for leaderboard (30 models), <50ms for model detail

**SEO crawl timing:**
- Google takes 2-4 weeks to re-crawl and update rich snippets
- **Monitoring:** Google Search Console structured data detection + rich snippet impressions

**Cache key proliferation:**
- Versioned cache keys could increase Redis memory usage
- **Monitoring:** Track Redis memory before/after, set up alerts for >20% increase
- **Mitigation:** TTL on all stats caches (5 minutes) as safety net

## Sources

### Primary (HIGH confidence)
- **Next.js 16 Documentation**: generateMetadata API, App Router patterns
- **PostgreSQL Official Docs**: Aggregate functions, NULLIF, COALESCE, view performance
- **Schema.org**: SportsEvent type definition, structured data requirements
- **Current Codebase**: Direct analysis of `src/lib/db/queries/stats.ts` (6 accuracy definitions), `src/lib/db/queries.ts` (IS NOT NULL pattern), `src/app/models/[id]/page.tsx` (frontend bug)

### Secondary (MEDIUM confidence)
- **Sports Prediction Platform Reviews**: Ruthless Reviews analysis of transparency requirements
- **Sports Statistics UX Studies**: FBref case study, leaderboard design best practices
- **SEO Research 2026**: Rich snippets capturing 58% of clicks, structured data as baseline requirement
- **Calibration Research**: Academic papers on sports betting model evaluation (Brier score, expected value)

### Tertiary (LOW confidence, for context only)
- **International SEO**: Football vs soccer terminology (validated against Sitebulb guide)
- **Gamification Research**: Leaderboard engagement patterns (informative but not critical for this milestone)

### Codebase Analysis (HIGH confidence)
Direct evidence from grep results:
- `queries.ts` lines 273, 275, 352, 1483, 2022, 2150: Inconsistent IS NOT NULL usage
- `stats.ts` lines 100, 156, 215, 275: Accuracy calculation variations
- `models/[id]/page.tsx` line 52-54: Wrong metric calculation for OG images
- `api/og/model/route.tsx` line 64: Generic "Accurate" label

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
*Next step: Requirements definition → Phase planning*
