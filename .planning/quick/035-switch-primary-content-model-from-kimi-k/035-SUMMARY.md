# Quick-035 Summary: Switch Primary Content Model from Kimi K2 to DeepSeek V3.1

## What Changed

Replaced Kimi K2 Thinking (Synthetic API) with DeepSeek V3.1 (Together API) as the primary content generation model.

## Files Modified

- **src/lib/content/together-client.ts** — Switched MODEL to `deepseek-ai/DeepSeek-V3.1`, API_URL to `api.together.xyz`, updated pricing ($0.60/$1.70 vs $2.00/$6.00), added `response_format: { type: "json_object" }` for JSON calls, removed `stripThinkingTags` calls, simplified to single `TOGETHER_API_KEY`
- **src/lib/utils/retry-config.ts** — Updated comments to reflect DeepSeek V3.1, reduced primary timeout from 90s to 60s

## Key Decisions

- **DeepSeek V3.1 over Qwen3 235B** — User chose slightly higher quality over lowest cost
- **JSON mode via `response_format`** — Together.ai grammar-constrained decoding prevents truncated/invalid JSON (root cause of Kimi K2 failures)
- **Single API key** — Both primary (DeepSeek V3.1) and fallback (Llama 4 Maverick) use `TOGETHER_API_KEY`, eliminating `SYNTHETIC_API_KEY` dependency for content
- **No thinking tag stripping** — DeepSeek V3.1 in non-thinking mode doesn't produce reasoning tags
- **`stripThinkingTags()` preserved** — Function definition kept for potential future use
- **60s timeout** — Non-reasoning model doesn't need the 90s reasoning timeout

## Cost Impact

- **Before:** ~$15/month (Kimi K2 Thinking @ $2.00/$6.00 per M tokens)
- **After:** ~$4.50/month (DeepSeek V3.1 @ $0.60/$1.70 per M tokens)
- **Savings:** ~70% reduction in content generation costs

## Commit

218831d
