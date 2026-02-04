# Roadmap: v2.3 Content Pipeline & SEO

## Overview

This milestone fixes the broken content generation pipeline that left all matches from 2026-02-03 without content, then hardens the pipeline for reliability and optimizes content prompts for SEO/GEO visibility. The journey moves from diagnosis through error handling fixes, HTML sanitization, monitoring infrastructure, prompt optimization, and finally blog generation completion.

## Milestones

- v1.0 MVP: Phases 1-4 (shipped 2026-02-01)
- v1.1 Stats Accuracy & SEO: Phases 5-8 (shipped 2026-02-02)
- v1.2 Technical SEO Fixes: Phases 9-12 (shipped 2026-02-02)
- v1.3 Match Page Refresh: Phases 13-16 (shipped 2026-02-02)
- v2.0 UI/UX Overhaul: Phases 17-23 (shipped 2026-02-03)
- v2.1 Match Page Simplification: Phases 24-25 (shipped 2026-02-03)
- v2.2 Match Page Rewrite: Phases 26-30 (shipped 2026-02-04)
- **v2.3 Content Pipeline & SEO: Phases 31-36 (in progress)**

## Phases

**Phase Numbering:**
- Integer phases (31, 32, 33): Planned milestone work
- Decimal phases (32.1, 32.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 31: Investigation & Diagnosis** - Confirm root cause and affected scope before making changes
- [x] **Phase 32: Make Failures Visible** - Convert silent failures to thrown errors with proper retry
- [x] **Phase 33: HTML Sanitization** - Strip HTML from prompts and content before database save
- [x] **Phase 34: Pipeline Hardening** - Add circuit breaker, heartbeat monitoring, and completeness alerts
- [x] **Phase 35: SEO/GEO Content Quality** - Optimize prompts for answer-first structure and match-specific FAQs
- [x] **Phase 36: Blog Generation** - Complete blog pipeline with reliable triggers and error handling

## Phase Details

### Phase 31: Investigation & Diagnosis
**Goal**: Confirm the root cause of missing content and quantify affected matches before making code changes
**Depends on**: Nothing (first phase of v2.3)
**Requirements**: None (diagnostic work)
**Success Criteria** (what must be TRUE):
  1. Worker process status is verified (running or not)
  2. Queue counts and DLQ entries are documented
  3. Count of matches missing content in last 7 days is known
  4. Root cause is confirmed (silent failures vs scheduling vs other)
**Plans**: 1 plan

Plans:
- [x] 31-01-PLAN.md — Run diagnostic queries and document findings in INVESTIGATION.md

### Phase 32: Make Failures Visible
**Goal**: Content generation failures are properly thrown and retried by BullMQ
**Depends on**: Phase 31
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. Content generation functions throw errors on failure instead of returning false
  2. Failed jobs appear in BullMQ dead letter queue after retry exhaustion
  3. Lock duration prevents stalled job detection during normal operation
  4. Invalid content (too short, placeholder text) is rejected before save
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md — Create error classes and convert return false to throw error
- [x] 32-02-PLAN.md — Configure lock duration, DLQ handling, and content validation

### Phase 33: HTML Sanitization
**Goal**: All LLM-generated content is plain text without HTML artifacts
**Depends on**: Phase 32
**Requirements**: HTML-01, HTML-02, HTML-03, HTML-04
**Success Criteria** (what must be TRUE):
  1. LLM prompts explicitly request plain text output
  2. HTML tags are stripped before database save (not just at render)
  3. Existing content with HTML is cleaned via migration
  4. Match pages render without visible HTML artifacts
**Plans**: 3 plans

Plans:
- [x] 33-01-PLAN.md — Create sanitization module and update prompts for plain text
- [x] 33-02-PLAN.md — Integrate sanitization before database save
- [x] 33-03-PLAN.md — Run migration to clean existing content

### Phase 34: Pipeline Hardening
**Goal**: Content pipeline has observability and automatic protection against cascading failures
**Depends on**: Phase 33
**Requirements**: PIPE-05, PIPE-06, PIPE-07
**Success Criteria** (what must be TRUE):
  1. Queue pauses automatically after 5 consecutive rate limit errors
  2. Worker heartbeat monitoring detects process death
  3. Finished matches without content trigger alerts
**Plans**: 2 plans

Plans:
- [x] 34-01-PLAN.md — Queue-level circuit breaker for rate limits
- [x] 34-02-PLAN.md — Worker health monitoring and content completeness alerts

### Phase 35: SEO/GEO Content Quality
**Goal**: Content prompts produce answer-first, match-specific content optimized for AI search visibility
**Depends on**: Phase 34
**Requirements**: SGEO-01, SGEO-02, SGEO-03, SGEO-04, SGEO-05, SGEO-06, SGEO-07, SGEO-08
**Success Criteria** (what must be TRUE):
  1. Pre-match content states prediction in first 30-60 words
  2. Post-match content states result in first 30-60 words
  3. FAQ questions are match-specific with actual data (teams, scores, dates)
  4. Upcoming matches generate 5 state-specific FAQ questions
  5. Finished matches include accuracy FAQ ("X/35 models predicted correctly")
**Plans**: 3 plans

Plans:
- [x] 35-01-PLAN.md — Answer-first prompts for pre-match and post-match content
- [x] 35-02-PLAN.md — Match-specific FAQ generation with accuracy data
- [x] 35-03-PLAN.md — Article schema with datePublished/dateModified

### Phase 36: Blog Generation
**Goal**: Blog posts generate reliably for eligible matches with proper error handling
**Depends on**: Phase 35
**Requirements**: BLOG-01, BLOG-02, BLOG-03, BLOG-04, PIPE-08
**Success Criteria** (what must be TRUE):
  1. Blog generation jobs trigger reliably for eligible matches
  2. Blog content uses same error handling pattern as match content (throws on failure)
  3. Blog content is HTML-sanitized before save
  4. Blog posts include answer-first summary paragraph
**Plans**: 2 plans

Plans:
- [x] 36-01-PLAN.md — Answer-first prompts for blog content (league roundups, model reports)
- [x] 36-02-PLAN.md — Error handling alignment and job scheduler verification

## Progress

**Execution Order:**
Phases execute in numeric order: 31 -> 32 -> 33 -> 34 -> 35 -> 36

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 31. Investigation & Diagnosis | 1/1 | Complete | 2026-02-04 |
| 32. Make Failures Visible | 2/2 | Complete | 2026-02-04 |
| 33. HTML Sanitization | 3/3 | Complete | 2026-02-04 |
| 34. Pipeline Hardening | 2/2 | Complete | 2026-02-04 |
| 35. SEO/GEO Content Quality | 3/3 | Complete | 2026-02-04 |
| 36. Blog Generation | 2/2 | Complete | 2026-02-04 |

---
*Roadmap created: 2026-02-04*
*Milestone: v2.3 Content Pipeline & SEO*
