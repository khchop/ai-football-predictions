# Synthetic.new Integration Research

**Project:** AI Football Predictions Platform - v2.4 Synthetic.new Provider
**Domain:** Multi-provider LLM integration for sports predictions
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

Integrating Synthetic.new as a second LLM provider is straightforward due to its **OpenAI-compatible API**. The existing `OpenAICompatibleProvider` base class can be reused with minimal changes. The main work is:

1. **Create SyntheticProvider class** extending `OpenAICompatibleProvider` with `https://api.synthetic.new/openai/v1/chat/completions` endpoint
2. **Define 14 model configurations** using the `hf:org/model` ID format
3. **Handle JSON mode uncertainty** - Synthetic docs don't mention JSON mode support, so we may need to remove `response_format` or test each model
4. **Register models in database** via seed script
5. **Handle thinking model output** - parsing already strips `<think>` tags

**Key risks:**
- **JSON mode unknown**: May need to rely on prompts alone (your parser already handles non-JSON)
- **Rate limits**: 135 requests/5hrs on Standard tier = ~27/hour. With 14 models × multiple matches, could hit limits
- **No per-token pricing published**: Usage-based tier needed for cost tracking

## Synthetic.new API Details

### Endpoint
```
https://api.synthetic.new/openai/v1/chat/completions
```

### Authentication
```
Authorization: Bearer ${SYNTHETIC_API_KEY}
```

### Model ID Format
```
model: "hf:deepseek-ai/DeepSeek-R1-0528"
```

### Rate Limits
| Tier | Requests/5hrs | Per Hour | Cost |
|------|---------------|----------|------|
| Standard | 135 | ~27 | $20/mo |
| Pro | 1,350 | ~270 | $60/mo |
| Usage-based | Unlimited | - | Per-token |

**Optimization**: Requests under 2048 tokens count as 0.2 requests. Your predictions are ~500 input / ~50 output, so effectively 5x the limit (675 requests/5hrs on Standard).

### JSON Mode
**NOT DOCUMENTED**. Options:
1. Try `response_format: { type: 'json_object' }` and see if it works
2. Remove response_format and rely on prompts + existing multi-strategy parser

## Integration Architecture

### Option A: Extend TogetherProvider (Recommended)
Create `SyntheticProvider` class that overrides endpoint and headers:

```typescript
export class SyntheticProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://api.synthetic.new/openai/v1/chat/completions';

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.SYNTHETIC_API_KEY;
    if (!apiKey) throw new Error('Synthetic API key not configured');
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
```

### Model Definitions (14 models)

**Reasoning models (3):**
| ID | Model | Context |
|----|-------|---------|
| deepseek-r1-0528-syn | hf:deepseek-ai/DeepSeek-R1-0528 | 128k |
| kimi-k2-thinking-syn | hf:moonshotai/Kimi-K2-Thinking | 256k |
| qwen3-235b-thinking-syn | hf:Qwen/Qwen3-235B-A22B-Thinking-2507 | 256k |

**DeepSeek family (3):**
| ID | Model | Context |
|----|-------|---------|
| deepseek-v3-0324-syn | hf:deepseek-ai/DeepSeek-V3-0324 | 128k |
| deepseek-v3.1-terminus-syn | hf:deepseek-ai/DeepSeek-V3.1-Terminus | 128k |
| deepseek-v3.2-syn | hf:deepseek-ai/DeepSeek-V3.2 | 159k |

**MiniMax (2):**
| ID | Model | Context |
|----|-------|---------|
| minimax-m2-syn | hf:MiniMaxAI/MiniMax-M2 | 192k |
| minimax-m2.1-syn | hf:MiniMaxAI/MiniMax-M2.1 | 192k |

**Moonshot (1):**
| ID | Model | Context |
|----|-------|---------|
| kimi-k2.5-syn | hf:moonshotai/Kimi-K2.5 | 256k |

**GLM (2):**
| ID | Model | Context |
|----|-------|---------|
| glm-4.6-syn | hf:zai-org/GLM-4.6 | 198k |
| glm-4.7-syn | hf:zai-org/GLM-4.7 | 198k |

**Qwen (1):**
| ID | Model | Context |
|----|-------|---------|
| qwen3-coder-480b-syn | hf:Qwen/Qwen3-Coder-480B-A35B-Instruct | 256k |

**OpenAI (1):**
| ID | Model | Context |
|----|-------|---------|
| gpt-oss-120b-syn | hf:openai/gpt-oss-120b | 128k |

### Database Registration
Add to seed script or migration:
```sql
INSERT INTO models (id, name, display_name, provider, is_active)
VALUES
  ('deepseek-r1-0528-syn', 'synthetic', 'DeepSeek R1 0528 (Synthetic)', 'synthetic', true),
  -- ... 13 more
```

## Recommended Phase Structure

### Phase 37: Synthetic Provider Foundation
- Create `src/lib/llm/providers/synthetic.ts` with `SyntheticProvider` class
- Define 14 model configurations
- Export `SYNTHETIC_PROVIDERS` array
- Add to provider registry

### Phase 38: Database Integration
- Add seed script for 14 new models
- Update model count in PROJECT.md (29 → 43)
- Run migration to register models

### Phase 39: Testing & Validation
- Test each model with a sample prediction
- Validate JSON parsing works (with or without response_format)
- Handle any model-specific quirks (GLM Chinese output, thinking tags)
- Document which models work reliably

### Phase 40: Production Enablement
- Add rate limit awareness (pause on 429)
- Add Synthetic-specific error handling
- Enable models in production
- Monitor first prediction cycle

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JSON mode not supported | Medium | Low | Parser already handles non-JSON output |
| Rate limits hit | High (Standard) | Medium | Use Pro tier ($60/mo) or usage-based |
| GLM outputs Chinese | Medium | Low | Already have parsing, monitor output |
| Thinking tokens counted | Unknown | Medium | May inflate costs for R1/thinking models |
| Model unavailability | Low | Medium | Auto-disable after 3 failures (existing pattern) |

## Cost Estimation

Assuming Usage-based tier (no published per-token prices yet):

| Model Category | Est. Cost/1M tokens |
|----------------|---------------------|
| Budget models | ~$0.50-$1.00 |
| Standard models | ~$1.00-$2.00 |
| Premium/Thinking | ~$3.00-$7.00 |

With 14 models × ~500 tokens/prediction × 25 matches/day = ~175,000 tokens/day
Estimated: $0.50-$2.00/day additional cost

## Sources

- [Synthetic.new API Overview](https://dev.synthetic.new/docs/api/overview) - Endpoints, rate limits
- [Synthetic.new Models](https://dev.synthetic.new/docs/api/models) - Model IDs, context windows
- [Synthetic.new Pricing](https://synthetic.new/pricing) - Tier costs, request counting
- Existing codebase: `src/lib/llm/providers/base.ts`, `src/lib/llm/providers/together.ts`

---
*Research completed: 2026-02-04*
*Ready for requirements: yes*
