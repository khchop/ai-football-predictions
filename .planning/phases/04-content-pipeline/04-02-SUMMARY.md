---
phase: 04-content-pipeline
plan: "02"
subsystem: content
tags: [content, roundup, llm, together-ai, post-match]
completed: 2026-01-27
duration: "5 minutes"
---

# Phase 4 Plan 2: LLM-Powered Post-Match Roundup Generation

## Objective

Implemented LLM-powered post-match roundup generation with structured prompt engineering. Roundups include scoreboard, events timeline, extended stats, model predictions table, top performers, and factual narrative analysis.

## Dependency Graph

**requires:**
- Phase 1-3: Stats foundation and UI components
- Plan 04-01: BullMQ content queue infrastructure

**provides:**
- `getMatchPredictionsWithAccuracy()` database query
- `buildPostMatchRoundupPrompt()` prompt template
- `generatePostMatchRoundup()` content generator
- Content worker integration for queue processing

**affects:**
- Future: Enhanced match pages with rich roundup content
- Future: SEO optimization for match-specific content

## Tech Stack Additions

**libraries:** No new libraries added
**patterns:**
- Structured prompt engineering with JSON output schemas
- Temperature-controlled generation (0.3-0.5) for factual content
- Narrative angle detection (derby, comeback, upset, milestone)
- Extended stats integration (possession, xG, shots, corners)

## Key Files Created/Modified

**created:** None
**modified:**
- `src/lib/db/queries.ts`: Added `getMatchPredictionsWithAccuracy()` function
- `src/lib/content/prompts.ts`: Added `buildPostMatchRoundupPrompt()` template
- `src/lib/content/generator.ts`: Added `generatePostMatchRoundup()` function
- `src/lib/queue/workers/content.worker.ts`: Wired roundup handler to queue

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Temperature 0.4 for factual content | Balanced between creativity and accuracy for match analysis |
| Extended stats included | xG, possession, shots provide context beyond final score |
| Narrative angle detection | Automated detection of derbies, comebacks, upsets, milestones |
| HTML table for predictions | Structured format with accuracy columns (tendency, exact score) |

## Deviations from Plan

**None** - Plan executed exactly as written.

## Authentication Gates

**None** - No external authentication required for this implementation.

## Verification Results

- [x] getMatchPredictionsWithAccuracy query fetches predictions with accuracy data
- [x] buildPostMatchRoundupPrompt produces structured prompt with all sections
- [x] generatePostMatchRoundup creates roundup with scoreboard, events, predictions, narrative
- [x] Content worker routes roundup jobs to generation function

## Success Criteria Met

- [x] Roundups include scoreboard header with final score
- [x] Events timeline shows goals, cards, key incidents
- [x] Extended stats: possession, shots, corners, xG displayed
- [x] Model predictions table shows each model's prediction vs actual with accuracy
- [x] Top 3 performers listed with predictions and points
- [x] LLM narrative is 1000+ words with factual analysis
- [x] Generation uses temperature 0.3-0.5 for factual content

## Commit History

- `63df9da`: feat(04-02): add getMatchPredictionsWithAccuracy query
- `d7a060d`: feat(04-02): add buildPostMatchRoundupPrompt to prompts.ts
- `4436c00`: feat(04-02): implement generatePostMatchRoundup function
- `40d52ed`: feat(04-02): wire roundup handler in content worker

## One-Liner

LLM-powered post-match roundup generation with structured prompt engineering, scoreboard → events → analysis structure, extended stats, model predictions table with accuracy columns, and narrative angle detection.
