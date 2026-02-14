# Quick Task 048: Fix Step 3.5 Flash Auto-Disable

## Problem
Step 3.5 Flash (OpenRouter) was auto-disabled after 5 consecutive failures with error:
`response_format json_object is not supported for this model`

The model's config had empty options `{}`, which defaulted `supportsJsonMode` to `true` (base class default at `base.ts:226`). This caused `response_format: { type: 'json_object' }` to be sent on every API request, which Step 3.5 Flash doesn't support.

## Fix
Set `supportsJsonMode: false` in Step 3.5 Flash's OpenRouterProvider config.

## Files Modified
- `src/lib/llm/providers/openrouter.ts`: Changed `{}` to `{ supportsJsonMode: false }` for Step35Flash_OR

## Impact
- Step 3.5 Flash will no longer receive `response_format` parameter
- Model will rely on prompt instructions for JSON output (same as other `supportsJsonMode: false` models like Qwen3 235B Thinking, MiniMax M2.1)
- Model needs to be re-enabled (recovery worker or manual)
