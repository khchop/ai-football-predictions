---
phase: 47
plan: 04
subsystem: seo-validation
tags: [json-ld, schema-validation, build-audit, cheerio, structured-data]
requires:
  - 47-01: Root schema single source of truth with @id constants
  - 47-02: SportsEvent/Article schema validation fixes
  - 45-04: Build-time audit infrastructure (Pass 1-4)
provides:
  - pass5JsonLdValidation function in audit-internal-links.ts
  - Schema validation helper functions (validateSportsEvent, validateArticle, validateBreadcrumbList, validateFAQPage)
  - extractAllSchemaTypes function for @graph flattening
  - Build-time JSON-LD regression prevention
affects:
  - future-schema-changes: All schema modifications validated at build time
  - deployment-safety: Schema errors caught before production
tech-stack:
  added: []
  patterns:
    - "cheerio JSON-LD extraction via script[type='application/ld+json']"
    - "Build-time validation with targeted sampling (AUDIT_SAMPLE env var)"
    - "Per-entity validation functions (SportsEvent, Article, BreadcrumbList, FAQPage)"
key-files:
  created: []
  modified:
    - scripts/audit-internal-links.ts: "Add Pass 5 JSON-LD validation (380 lines added)"
key-decisions:
  - decision: "Pass 5 only runs when AUDIT_BASE_URL is set"
    rationale: "Consistent with Pass 1 and Pass 4 pattern, allows CI to skip network-dependent validation"
    alternatives: "Always run Pass 5 (rejected: requires running server)"
  - decision: "FAQPage <2 questions is warning, not failure"
    rationale: "Google recommendation, not requirement — shouldn't block build"
    alternatives: "Make it a hard failure (rejected: too strict for content variations)"
  - decision: "Sample URLs using existing AUDIT_SAMPLE env var (default 50)"
    rationale: "Reuse Pass 4 sampling logic for consistency and performance"
    alternatives: "Check all URLs (rejected: too slow for large sites)"
  - decision: "Validate publisher.logo as ImageObject requirement"
    rationale: "Google Rich Results Test requires ImageObject with url property for Article schemas"
    alternatives: "Accept string logos (rejected: fails Google validation)"
duration: 152
completed: 2026-02-06
---

# Phase 47 Plan 04: Build-Time JSON-LD Validation Summary

**One-liner:** Pass 5 JSON-LD validation extracts schemas via cheerio, validates SCHEMA-01-05 requirements, and reports totalSchemaErrors targeting <50

## Performance

- **Duration:** 152 seconds (2.5 minutes)
- **Started:** 2026-02-06T12:10:37Z
- **Completed:** 2026-02-06T12:13:09Z
- **Tasks:** 1/1 complete
- **Files modified:** 1
- **Lines added:** 380

## Accomplishments

### Pass 5 JSON-LD Validation Infrastructure

Added comprehensive build-time validation for JSON-LD structured data:

**1. Pass5Result Interface**
- Tracks 7 validation metrics: duplicateOrganization, duplicateWebSite, invalidSportsEvent, invalidArticle, invalidBreadcrumb, invalidFaq, totalSchemaErrors
- Extends AuditResult with pass/failures/warnings pattern

**2. Schema Extraction Helpers**
- `extractAllSchemaTypes()`: Flattens @graph arrays and returns all schema objects
- Handles both single schema objects and @graph-wrapped arrays

**3. Entity-Specific Validators**
- `validateSportsEvent()`: Checks name, startDate, location with @type Place and address
- `validateArticle()`: Checks headline, author, publisher with logo as ImageObject (or @id reference)
- `validateBreadcrumbList()`: Ensures all itemListElement entries have 'item' property
- `validateFAQPage()`: Warns on <2 questions (Google recommendation, not hard requirement)

**4. Pass 5 Validation Function**
- Fetches sitemap URLs using Pass 1 pattern
- Samples URLs (AUDIT_SAMPLE env var, default 50) for performance
- Extracts JSON-LD using cheerio selector: `script[type="application/ld+json"]`
- Validates all 5 SCHEMA requirements:
  - SCHEMA-01: Duplicate Organization/WebSite detection
  - SCHEMA-02: SportsEvent required properties
  - SCHEMA-03: Article required properties (including FAQPage)
  - SCHEMA-04: BreadcrumbList item property
  - SCHEMA-05: Total error count targeting <50

**5. Integration**
- Pass 5 integrated into main runAudit() flow after Pass 4
- Only runs when AUDIT_BASE_URL is set (consistent with Pass 1/4)
- Results included in aggregate failures/warnings arrays
- Clear console output showing error counts by type

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Pass 5 JSON-LD validation to audit script | 2b1478f | scripts/audit-internal-links.ts |

## Files Created

None — extended existing audit infrastructure.

## Files Modified

### scripts/audit-internal-links.ts
- **Line 9:** Updated header comment to include Pass 5
- **Lines 70-77:** Added Pass5Result interface
- **Lines 322-461:** Added helper functions (extractAllSchemaTypes, validateSportsEvent, validateArticle, validateBreadcrumbList, validateFAQPage)
- **Lines 596-783:** Added pass5JsonLdValidation function
- **Lines 871-909:** Integrated Pass 5 into main runAudit() flow
- **Lines 914-924:** Added pass5 to aggregate failures/warnings arrays
- **Total:** 380 lines added

## Decisions Made

### 1. Pass 5 Conditional Execution
**Decision:** Pass 5 only runs when `AUDIT_BASE_URL` environment variable is set.

**Context:** Pass 5 requires fetching rendered HTML from a running server, similar to Pass 1 (sitemap URL validation) and Pass 4 (meta tag validation).

**Rationale:**
- Consistent pattern with existing passes (Pass 1, 4 require server)
- Allows CI environments without deployed preview to skip network-dependent validation
- Local `npm run build` doesn't block on server availability
- Production deployments set AUDIT_BASE_URL for full validation

**Alternatives considered:**
- Always run Pass 5 → Rejected: blocks local builds, requires server setup
- Separate env var for Pass 5 → Rejected: unnecessary complexity, reuse existing pattern

### 2. FAQPage Warning vs Failure
**Decision:** FAQPage with <2 questions triggers warning, not build failure.

**Context:** Google recommends minimum 2 questions for FAQ rich results, but it's not a hard requirement for schema validity.

**Rationale:**
- Content flexibility — some pages may legitimately have 1 FAQ as introduction
- Google treats it as recommendation (warning in Rich Results Test)
- Platform FAQ generators (generateLeagueFAQs, generateMatchFAQs) already create 3-5 questions
- Warnings alert developers without blocking deployments

**Alternatives considered:**
- Hard failure on <2 questions → Rejected: too strict, blocks valid content variations
- No validation → Rejected: misses optimization opportunity

### 3. URL Sampling Strategy
**Decision:** Reuse `AUDIT_SAMPLE` env var (default 50) from Pass 4 for consistent sampling.

**Context:** Sites with hundreds of URLs would make Pass 5 very slow if checking all pages.

**Rationale:**
- Performance: 50 URLs covers diverse page types (match, league, model, blog)
- Consistency: Same sampling logic as Pass 4 meta tag validation
- Configurability: Can increase sample size via env var for deeper audits
- Statistical validity: 50 random pages sufficient to detect systemic issues

**Alternatives considered:**
- Check all URLs → Rejected: too slow, 5s timeout × 500 URLs = 40+ minutes
- Fixed 10 URL sample → Rejected: might miss page type variations
- Per-page-type sampling → Rejected: overcomplicated, 50 random URLs sufficient

### 4. Publisher Logo Validation
**Decision:** Validate Article publisher.logo as ImageObject (not string), or allow @id reference.

**Context:** Google Rich Results Test requires publisher.logo to be ImageObject with url property. Platform code historically used string URLs.

**Rationale:**
- Google requirement: String logos fail Rich Results Test validation
- schema-dts types allow string OR ImageObject, but Google enforces ImageObject
- @id reference acceptable: Points to Organization defined in root schema
- Dual validation: Accept full ImageObject OR @id stub (flexible, correct)

**Alternatives considered:**
- Accept string logos → Rejected: fails Google validation, no rich results
- Require full ImageObject always → Rejected: unnecessarily rigid, @id references valid

## Deviations from Plan

None — plan executed exactly as specified.

## Issues & Blockers

**None.**

Pass 5 validation infrastructure is complete and ready for use. Next steps:

1. Set `AUDIT_BASE_URL` in CI/CD environment to enable Pass 5 validation
2. Run audit against deployed preview to measure current schema error count
3. Use results to prioritize remaining schema fixes in Phase 47 follow-up work

## Next Phase Readiness

**Status:** Ready for production use

**Validation coverage:**
- ✅ SCHEMA-01: Duplicate Organization/WebSite detection
- ✅ SCHEMA-02: SportsEvent required properties (name, startDate, location with Place)
- ✅ SCHEMA-03: Article required properties (headline, author, publisher with logo)
- ✅ SCHEMA-04: BreadcrumbList item property validation
- ✅ SCHEMA-05: Total error count reporting (targeting <50)

**Limitations:**
- Pass 5 requires AUDIT_BASE_URL (running server or deployed preview)
- URL sampling (default 50) may miss rare edge cases
- Validation is syntactic (checks property existence), not semantic (doesn't validate property values match reality)

**Recommendations for next phase:**
1. Run full audit with Pass 5 enabled against production to establish baseline
2. Monitor totalSchemaErrors trend over time (should decrease toward <50)
3. Consider adding JSON-LD unit tests for individual schema builders
4. Extend validation to check @id uniqueness across pages (detect collisions)

---

## Self-Check: PASSED

All files and commits verified:
- ✓ scripts/audit-internal-links.ts exists
- ✓ Commit 2b1478f exists

**Phase 47 Plan 04 complete.** Build-time JSON-LD validation operational.
