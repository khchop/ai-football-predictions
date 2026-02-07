# Quick-036 Summary: Refocus Match Roundup Prompt on AI Model Performance Only

## What Changed

Rewrote the post-match roundup prompt to focus exclusively on AI model prediction accuracy. Removed all sections that invited filler text about match events, tactics, or statistics.

## Files Modified

- **src/lib/content/prompts.ts** — Replaced 7-section roundup structure with AI-prediction-only structure (Prediction Landscape, Top Performers, Worst Performers, Tendency Analysis, Score Distribution, Takeaway). Removed Extended Statistics, Key Events Timeline, and Narrative Angles sections. Added explicit "NEVER discuss match events, tactics, or player performances" rule.
- **src/lib/content/generator.ts** — Updated system prompt from generic "football analyst" to "AI prediction analyst" role with explicit instruction to never discuss match events.

## Root Cause

The previous prompt had 7 sections including "Extended Statistics", "Key Events Timeline", and "Narrative Analysis". When event/stat data was sparse, the LLM filled these sections with filler like "Despite the absence of detailed match events and statistics..." — even though CRITICAL RULES said not to. The fix: remove those sections entirely so the LLM has no reason to mention them.

## Key Decision

- Every paragraph in the roundup must contain model names and prediction data — no generic match commentary allowed

## Commit

14f59e9
