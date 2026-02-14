---
phase: quick-047
plan: 01
subsystem: prediction-pipeline
tags:
  - parser
  - llm-response
  - fallback
  - natural-language
dependency_graph:
  requires:
    - parseBatchPredictionResponse (basic JSON parser)
    - isValidScore (score validation)
  provides:
    - extractNaturalLanguageScores (Strategy 5)
    - Enhanced parser fallback in prediction worker
  affects:
    - prediction worker parse failure rate
    - thinking model prediction recovery
tech_stack:
  added:
    - Natural language regex patterns (4 strategies)
  patterns:
    - Multi-strategy parsing with fallbacks
    - Single-match prose extraction
key_files:
  created: []
  modified:
    - src/lib/llm/prompt.ts: +124 lines (Strategy 5 + patterns)
    - src/lib/queue/workers/predictions.worker.ts: +23 lines (enhanced fallback)
decisions:
  - Use 4 regex patterns in priority order: explicit prediction → score-at-end → home/away labeled → last X-Y occurrence
  - Only support single-match predictions for natural language (cannot reliably assign scores to matches from prose)
  - Guard against stats-heavy responses by rejecting >10 score-pattern matches
  - Handle both ASCII dash (-) and en-dash (–) in all patterns
  - Try enhanced parser only when basic parser fails (no overhead on happy path)
metrics:
  duration_minutes: ~10
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_date: 2026-02-14
---

# Quick Task 047: Add Natural Language Score Extraction Fallback

Add natural language score extraction as a fifth strategy to `parseBatchPredictionEnhanced` and wire the enhanced parser as a fallback in the prediction worker when the basic JSON parser fails.

## One-Liner

Natural language prose predictions (e.g., "my prediction is 0-2") are now parsed using 4 regex patterns, with enhanced parser tried as fallback when basic JSON parser fails.

## What Was Built

### Strategy 5: Natural Language Score Extraction

Added `extractNaturalLanguageScores` function in `src/lib/llm/prompt.ts` (after `extractFlexibleScores`, before `parseBatchPredictionEnhanced`).

**Features:**
- Only works for single-match predictions (`matchIds.length === 1`)
- Cleans thinking tags (`<think>`, `<thinking>`, `<reasoning>`) before parsing
- Tries 4 regex patterns in priority order:

1. **Explicit prediction pattern**: `(?:predict(?:ion)?|final\s*score|my\s*(?:prediction|score)|result)\s*(?:is|:)?\s*(\d+)\s*[-\u2013:]\s*(\d+)`
   - Matches: "prediction is 0-2", "my prediction: 1-1", "final score 2-1", "result: 3-0"

2. **Score-at-end pattern**: Searches last non-empty line for `(\d+)\s*[-\u2013:]\s*(\d+)`
   - Rationale: Thinking models put final prediction at end (e.g., "...Therefore 0-2")

3. **Home/away labeled pattern**: `(?:home|heim)\s*[:=]?\s*(\d+)[\s\S]*?(?:away|aus|gast)\s*[:=]?\s*(\d+)`
   - Matches: "Home: 2, Away: 1", "Home 2 - Away 1"

4. **Last X-Y occurrence**: Find all `(\d+)\s*[-\u2013]\s*(\d+)` matches, use last one
   - Guard: Skip if >10 occurrences (likely stats-heavy response where prediction is ambiguous)

All patterns handle both ASCII dash (`-`) and en-dash (`–`, \u2013).

**Validation:**
- Each extracted score validated with `isValidScore()` (0-20, integer, not NaN)
- Returns `[{ matchId, homeScore, awayScore }]` on success, `null` on failure

### Enhanced Parser Fallback in Prediction Worker

Modified `src/lib/queue/workers/predictions.worker.ts`:

1. **Import**: Added `parseBatchPredictionEnhanced` to imports (line 25)
2. **Variable change**: Changed `const parsed` to `let parsed` (line 227) to allow reassignment
3. **Fallback logic** (lines 229-261):
   - When basic parser fails: try `parseBatchPredictionEnhanced(rawResponse, [matchId])`
   - If enhanced parser succeeds: overwrite `parsed` with compatible structure, log with `strategy: 'enhanced-fallback'`
   - If both parsers fail: record failure (same as before)

**Type compatibility:**
- `BatchParsedResult` and `EnhancedParseResult` are compatible for the fields used downstream (`predictions[0].homeScore`, `predictions[0].awayScore`, `predictions[0].matchId`)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Strategy 5 - Natural Language Score Extraction | fea4caa | src/lib/llm/prompt.ts |
| 2 | Wire enhanced parser as fallback in prediction worker | c25e2a8 | src/lib/queue/workers/predictions.worker.ts |

## Verification

- [x] `npx tsc --noEmit` passes (no type errors in modified files)
- [x] `extractNaturalLanguageScores` function exists in prompt.ts (line 584)
- [x] Strategy 5 "Natural language" added to `parseBatchPredictionEnhanced` strategies array (line 724)
- [x] `parseBatchPredictionEnhanced` imported and called in predictions.worker.ts (lines 25, 231)
- [x] `let parsed` change confirmed (line 227)
- [x] 5 strategies in `parseBatchPredictionEnhanced`: Direct JSON, Markdown code block, Score pattern regex, Flexible pattern, Natural language

## Deviations from Plan

None - plan executed exactly as written.

## Impact

**Before:**
- Thinking models (Qwen3 235B, etc.) that respond with natural language analysis instead of JSON are treated as parse failures
- Prediction is lost, recorded as model failure

**After:**
- Natural language responses are parsed using 4 regex patterns in priority order
- Enhanced parser only tried when basic parser fails (no overhead on happy path)
- Thinking model predictions recovered, reducing parse failure rate

**Monitoring:**
- Enhanced parser fallback logs with `strategy: 'enhanced-fallback'` for tracking recovery rate
- Failure logs now indicate "basic + enhanced parsers failed" for debugging

## Self-Check

**Created files:**
None.

**Modified files:**
```bash
[ -f "/Users/pieterbos/Documents/bettingsoccer/src/lib/llm/prompt.ts" ] && echo "FOUND: src/lib/llm/prompt.ts" || echo "MISSING: src/lib/llm/prompt.ts"
[ -f "/Users/pieterbos/Documents/bettingsoccer/src/lib/queue/workers/predictions.worker.ts" ] && echo "FOUND: src/lib/queue/workers/predictions.worker.ts" || echo "MISSING: src/lib/queue/workers/predictions.worker.ts"
```

**Commits:**
```bash
git log --oneline --all | grep -q "fea4caa" && echo "FOUND: fea4caa" || echo "MISSING: fea4caa"
git log --oneline --all | grep -q "c25e2a8" && echo "FOUND: c25e2a8" || echo "MISSING: c25e2a8"
```

**Self-check results:**
```
FOUND: src/lib/llm/prompt.ts
FOUND: src/lib/queue/workers/predictions.worker.ts
FOUND: fea4caa
FOUND: c25e2a8
```

## Self-Check: PASSED

All files and commits verified.
