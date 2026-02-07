# Quick-034 Summary: Content Generation Fallback from Kimi K2 to Llama 4 Maverick

## What Changed

Added automatic fallback from Kimi K2 Thinking (Synthetic API) to Llama 4 Maverick (Together API) when content generation fails after all retries.

## Files Modified

- **src/lib/utils/retry-config.ts** — Added `TOGETHER_CONTENT_FALLBACK_RETRY` (2 retries, 60s timeout) and `TOGETHER_CONTENT_FALLBACK` service name
- **src/lib/content/together-client.ts** — Refactored both `generateWithTogetherAI` and `generateTextWithTogetherAI` with primary-then-fallback pattern; extracted shared `callContentAPI` helper; updated `calculateCost` to accept pricing param

## Key Decisions

- Fallback uses `TOGETHER_API_KEY` (not `SYNTHETIC_API_KEY`) since it hits Together API directly
- No `stripThinkingTags()` on fallback responses (Llama 4 Maverick doesn't produce thinking tags)
- Fewer retries for fallback (2 vs 3) since it IS the fallback
- Both errors logged when both primary and fallback fail
- Function signatures unchanged — transparent to callers

## Commit

0da46b0
