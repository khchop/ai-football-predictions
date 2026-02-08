# Phase 59: Provider Integration Foundations - Research

**Researched:** 2026-02-08
**Domain:** OpenRouter API Integration, Provider Architecture, Model Identity
**Confidence:** HIGH

## Summary

Phase 59 establishes the OpenRouter provider class as a third LLM source alongside Together AI and Synthetic.new, enabling multi-provider routing and model consolidation. The integration follows the existing OpenAICompatibleProvider pattern, requiring minimal architectural changes.

OpenRouter uses an OpenAI-compatible API at `https://openrouter.ai/api/v1/chat/completions` with two provider-specific headers (HTTP-Referer and X-Title) for attribution. Model IDs follow `vendor/model-name` format (e.g., `deepseek/deepseek-r1`), distinct from Together's direct model paths and Synthetic's `hf:org/model` format.

The existing provider architecture (OpenAICompatibleProvider base class, conditional provider inclusion based on API key, model validation scripts) provides all necessary infrastructure. The main implementation challenge is ensuring no duplicate model IDs across the three provider arrays when creating OPENROUTER_PROVIDERS.

**Primary recommendation:** Extend OpenAICompatibleProvider with OpenRouter-specific headers and endpoint. Validate model IDs against existing providers before deployment to prevent duplicate ID conflicts.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenAICompatibleProvider | Current | Base class for OpenAI-compatible APIs | Already used by TogetherProvider and SyntheticProvider, proven pattern |
| fetchWithRetry | Current | Resilient API calls with automatic retries | Existing utility in @/lib/utils/api-client, handles 429/5xx/timeouts |
| PromptConfig | Current | Model-specific prompt variants and handlers | Established in Phase 56-57 for model-specific configurations |
| ResponseHandler | Current | Post-processing of API responses | Used for thinking tag stripping, JSON extraction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ModelPricing | Current | Cost tracking per model | Required for all provider instances (cost estimation) |
| ModelTier | Current | Budget tier classification | Used for priority and filtering (free/ultra-budget/budget/premium) |
| loggers.llm | Current | Provider-specific logging | Track API calls, fallbacks, errors |

### Environment Variables
| Variable | Purpose | Validation |
|----------|---------|------------|
| OPENROUTER_API_KEY | Authentication bearer token | Required for OpenRouter provider instances |
| NEXT_PUBLIC_APP_URL | HTTP-Referer header value | Defaults to localhost:3000 if not set |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenAICompatibleProvider | Custom OpenRouterProvider from scratch | Duplicates retry logic, timeout handling, JSON parsing already implemented |
| fetchWithRetry | Direct fetch() calls | Loses automatic retry on 429/5xx, timeout handling, structured error types |
| Conditional inclusion | Always include OpenRouter providers | Forces all deployments to have OpenRouter key even if not used |

**Installation:**
No new packages required - uses existing provider architecture.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/llm/
├── index.ts                    # Provider registry + getActiveProviders()
├── providers/
│   ├── base.ts                # OpenAICompatibleProvider (shared logic)
│   ├── together.ts            # TogetherProvider (29 models)
│   ├── synthetic.ts           # SyntheticProvider (13 models)
│   └── openrouter.ts          # NEW: OpenRouterProvider (TBD count)
├── prompt-variants.ts          # PromptConfig type
└── response-handlers.ts        # ResponseHandler enum
```

### Pattern 1: Provider Class Extension
**What:** OpenRouterProvider extends OpenAICompatibleProvider with provider-specific configuration.

**When to use:** Creating any new OpenAI-compatible LLM provider.

**Example:**
```typescript
// src/lib/llm/providers/openrouter.ts
// Source: Existing Together/Synthetic provider pattern

import { OpenAICompatibleProvider } from './base';
import { ModelPricing, ModelTier } from './together';
import { PromptConfig } from '../prompt-variants';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  public readonly tier: ModelTier;
  public readonly pricing: ModelPricing;
  public readonly promptConfig: PromptConfig;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly model: string, // OpenRouter model ID format: vendor/model-name
    public readonly displayName: string,
    tier: ModelTier,
    pricing: ModelPricing,
    public readonly isPremium: boolean = false,
    promptConfig: PromptConfig = {}
  ) {
    super();
    this.tier = tier;
    this.pricing = pricing;
    this.promptConfig = promptConfig;
  }

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured (OPENROUTER_API_KEY)');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Football AI Predictions',
    };
  }
}
```

**Rationale:**
- Reuses all base class logic (callAPI, retry, timeout, JSON parsing, response handlers)
- Only overrides provider-specific configuration (endpoint, headers)
- Matches existing TogetherProvider and SyntheticProvider patterns exactly

### Pattern 2: Conditional Provider Inclusion
**What:** Include provider array in ALL_PROVIDERS only when API key is configured.

**When to use:** Any provider requiring authentication.

**Example:**
```typescript
// src/lib/llm/index.ts
// Source: Existing getActiveProviders() implementation

import { TOGETHER_PROVIDERS } from './providers/together';
import { SYNTHETIC_PROVIDERS } from './providers/synthetic';
import { OPENROUTER_PROVIDERS } from './providers/openrouter'; // NEW

export const ALL_PROVIDERS: LLMProvider[] = [
  ...TOGETHER_PROVIDERS,
  ...SYNTHETIC_PROVIDERS,
  // OpenRouter providers conditionally added based on API key availability
  // Not included here to avoid "API key not configured" errors
];

export async function getActiveProviders(): Promise<LLMProvider[]> {
  const disabledIds = await getAutoDisabledModelIds();
  const activeProviders: LLMProvider[] = [];

  // Add Together providers if API key configured
  if (process.env.TOGETHER_API_KEY) {
    activeProviders.push(
      ...TOGETHER_PROVIDERS.filter(p => !disabledIds.has(p.id))
    );
  }

  // Add Synthetic providers if API key configured
  if (process.env.SYNTHETIC_API_KEY) {
    activeProviders.push(
      ...SYNTHETIC_PROVIDERS.filter(p => !disabledIds.has(p.id))
    );
  }

  // Add OpenRouter providers if API key configured (NEW)
  if (process.env.OPENROUTER_API_KEY) {
    activeProviders.push(
      ...OPENROUTER_PROVIDERS.filter(p => !disabledIds.has(p.id))
    );
  }

  return activeProviders;
}
```

**Rationale:**
- Graceful degradation when API key not available
- Prevents runtime errors from missing credentials
- Enables local development with subset of providers
- Matches existing pattern for Together and Synthetic

### Pattern 3: OpenRouter Model ID Format Handling
**What:** OpenRouter model IDs use `vendor/model-name` format, distinct from Together (direct model paths) and Synthetic (`hf:org/model`).

**When to use:** Creating OpenRouter provider instances.

**Example:**
```typescript
// OpenRouter model ID format: vendor/model-name
// Example from official docs: deepseek/deepseek-r1

export const DeepSeekR1_OpenRouterProvider = new OpenRouterProvider(
  'deepseek-r1',                    // Internal ID (matches Together/Synthetic for consolidation)
  'openrouter',                     // Provider name
  'deepseek/deepseek-r1',          // OpenRouter API model ID (vendor/model-name format)
  'DeepSeek R1 (OpenRouter)',      // Display name
  'premium',
  { promptPer1M: 0.55, completionPer1M: 2.19 }, // OpenRouter pricing
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
  }
);
```

**Rationale:**
- Internal ID (`deepseek-r1`) stays consistent across providers for model consolidation
- OpenRouter API model ID (`deepseek/deepseek-r1`) passed to OpenRouter API
- Display name differentiates provider in UI
- Enables transparent provider routing without UI changes

### Anti-Patterns to Avoid

- **Anti-pattern:** Adding OpenRouter providers to ALL_PROVIDERS array unconditionally
  - **Why bad:** Throws errors on every request if OPENROUTER_API_KEY not set
  - **Instead:** Only include via getActiveProviders() when key configured

- **Anti-pattern:** Creating separate model IDs for each provider (e.g., `deepseek-r1-openrouter`)
  - **Why bad:** Fragments leaderboard, duplicates predictions, complicates routing
  - **Instead:** Use same model ID across providers, track provider in predictions.provider_used

- **Anti-pattern:** Hardcoding HTTP-Referer and X-Title headers
  - **Why bad:** Wrong values in production, can't customize per deployment
  - **Instead:** Use environment variables (NEXT_PUBLIC_APP_URL) with localhost fallback

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compatible API integration | Custom OpenRouter client | OpenAICompatibleProvider base class | Retry logic, timeout handling, JSON parsing, response handlers already implemented |
| API authentication | Custom header builder | getHeaders() pattern from existing providers | Consistent error messages, environment variable validation |
| Rate limit handling | Manual retry with exponential backoff | fetchWithRetry utility | Handles 429/5xx/timeouts with configurable retry strategy |
| Model ID validation | Runtime duplicate checks | Pre-deployment validation script | Catches conflicts during development, not production |

**Key insight:** The existing provider architecture handles all common LLM API patterns. Custom implementations would duplicate 200+ lines of tested retry/parsing/error handling logic and risk introducing subtle bugs (incorrect timeout calculation, missing error types, incomplete JSON extraction).

## Common Pitfalls

### Pitfall 1: Duplicate Model IDs Across Providers
**What goes wrong:** Creating OpenRouter provider instances with IDs already used by Together or Synthetic providers causes runtime conflicts in getActiveProviders() and leaderboard queries.

**Why it happens:** No compile-time check prevents duplicate IDs across separate provider arrays. Developers copy-paste provider definitions without checking ALL_PROVIDERS for conflicts.

**How to avoid:**
1. Run validation script before deployment: `npm run validate:model-ids`
2. Script checks for duplicates across TOGETHER_PROVIDERS, SYNTHETIC_PROVIDERS, OPENROUTER_PROVIDERS
3. Fail CI build if duplicates detected

**Warning signs:**
- Leaderboard shows same model twice with different providers
- getProviderById() returns inconsistent results (depends on array order)
- Model pages show conflicting provider information

### Pitfall 2: Missing HTTP-Referer and X-Title Headers
**What goes wrong:** OpenRouter API accepts requests without these headers but tracks app as "unknown" in analytics, preventing visibility in OpenRouter rankings.

**Why it happens:** Headers are optional for API functionality but required for attribution. Developers test basic requests, see success, assume complete.

**How to avoid:**
1. Include headers in getHeaders() method (see Pattern 1)
2. Use NEXT_PUBLIC_APP_URL environment variable for Referer
3. Set X-Title to app name for analytics tracking

**Warning signs:**
- App doesn't appear in OpenRouter leaderboards
- OpenRouter dashboard shows traffic but no app attribution
- Analytics show requests from "localhost" in production

### Pitfall 3: Incorrect Model ID Format in API Requests
**What goes wrong:** Sending internal model ID (`deepseek-r1`) instead of OpenRouter model ID (`deepseek/deepseek-r1`) to API causes "model not found" errors.

**Why it happens:** Confusion between internal model IDs (for database consistency) and provider-specific API model IDs.

**How to avoid:**
1. Store OpenRouter API model ID in `model` field of provider instance
2. Base class callAPI() uses `this.model` in API request body
3. Internal `id` field only used for database references and routing

**Warning signs:**
- OpenRouter API returns 400 errors with "model not found" message
- Successful requests to Together/Synthetic but all OpenRouter requests fail
- Error logs show model ID without vendor prefix

### Pitfall 4: Cache Invalidation After Model Consolidation
**What goes wrong:** Renaming model IDs (e.g., `deepseek-r1-0528-syn` → `deepseek-r1`) invalidates model-keyed caches, but developers only flush direct caches, missing derived caches like leaderboard and stats.

**Why it happens:** Cache keys embed model IDs but are scattered across codebase. Pattern-based invalidation is too broad or too narrow.

**How to avoid:**
1. Document all cache keys that include model IDs during migration planning
2. Flush ALL caches during migration (`FLUSHDB` during low-traffic window)
3. Implement cache dependency tracking for future model renames

**Warning signs:**
- Model pages return 404 despite model existing in database
- Leaderboard shows old model IDs intermittently
- `/api/models` returns different counts on repeated calls

### Pitfall 5: Foreign Key Migration Without Referential Integrity Validation
**What goes wrong:** Renaming model IDs breaks foreign key relationships in predictions.modelId, orphaning records and corrupting leaderboard aggregations.

**Why it happens:** PostgreSQL string primary keys don't auto-update foreign keys. Developers assume UPDATE cascades without explicit ON UPDATE CASCADE or manual migration.

**How to avoid:**
1. Pre-migration validation: count all foreign key references per model
2. Use expand/contract pattern: add new column, backfill, switch reads, drop old
3. Post-migration validation: checksum row counts, verify no orphaned records

**Warning signs:**
- Queries return fewer rows after migration
- Models missing from leaderboard despite having predictions
- Constraint violation errors on INSERT/UPDATE

## Code Examples

Verified patterns from official sources and existing codebase:

### OpenRouter API Request Format
```typescript
// Source: OpenRouter API documentation + existing OpenAICompatibleProvider

const response = await fetchWithRetry(
  'https://openrouter.ai/api/v1/chat/completions',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Football AI Predictions',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-r1', // OpenRouter model ID format
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 150, // Single prediction
      response_format: { type: 'json_object' },
    }),
  },
  TOGETHER_PREDICTION_RETRY, // Reuse existing retry config
  timeout,
  SERVICE_NAMES.TOGETHER_PREDICTIONS // Reuse service name for consistency
);
```

### Provider Instance Creation
```typescript
// Source: Existing TogetherProvider and SyntheticProvider patterns

export const DeepSeekR1_OpenRouterProvider = new OpenRouterProvider(
  'deepseek-r1',                    // Internal ID (database references)
  'openrouter',                     // Provider name
  'deepseek/deepseek-r1',          // OpenRouter API model ID
  'DeepSeek R1 (OpenRouter)',      // Display name (UI)
  'premium',                        // Tier for filtering
  { promptPer1M: 0.55, completionPer1M: 2.19 }, // Cost tracking
  true,                             // isPremium flag
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000, // 2 minutes for reasoning models
  }
);

export const OPENROUTER_PROVIDERS = [
  DeepSeekR1_OpenRouterProvider,
  // Additional models...
];
```

### Model ID Validation Script
```typescript
// Source: Existing validate-all-models.ts pattern

import { TOGETHER_PROVIDERS } from '../src/lib/llm/providers/together';
import { SYNTHETIC_PROVIDERS } from '../src/lib/llm/providers/synthetic';
import { OPENROUTER_PROVIDERS } from '../src/lib/llm/providers/openrouter';

function validateUniqueModelIds() {
  const allProviders = [
    ...TOGETHER_PROVIDERS,
    ...SYNTHETIC_PROVIDERS,
    ...OPENROUTER_PROVIDERS,
  ];

  const idCounts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const provider of allProviders) {
    const count = (idCounts.get(provider.id) || 0) + 1;
    idCounts.set(provider.id, count);

    if (count > 1 && !duplicates.includes(provider.id)) {
      duplicates.push(provider.id);
    }
  }

  if (duplicates.length > 0) {
    console.error('ERROR: Duplicate model IDs detected:');
    for (const id of duplicates) {
      console.error(`  - ${id} (appears ${idCounts.get(id)} times)`);
    }
    process.exit(1);
  }

  console.log(`✓ All ${allProviders.length} model IDs are unique`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual API key checking | Conditional provider inclusion in getActiveProviders() | Phase 37 (v2.4) | Graceful degradation without runtime errors |
| Separate provider classes | Shared OpenAICompatibleProvider base | Phase 37 (v2.4) | 200+ lines of shared retry/timeout/parsing logic |
| Model-specific timeout hardcoding | PromptConfig with configurable timeouts | Phase 56-57 (v2.8) | Reasoning models get 120s, standard models 15s |
| Manual response parsing | ResponseHandler enum with standardized patterns | Phase 56-57 (v2.8) | Thinking tag stripping, JSON extraction consistent |

**Deprecated/outdated:**
- **Direct fetch() calls:** Replaced with fetchWithRetry for automatic retry on 429/5xx/timeouts
- **Provider-specific error types:** Unified APIError and RateLimitError in @/lib/utils/api-client
- **Hardcoded model counts:** getActiveModelCount() queries database for current count (Phase 58)

## Open Questions

1. **How many models to include in OPENROUTER_PROVIDERS initially?**
   - What we know: Phase 59 is "foundations" scope, not full integration
   - What's unclear: Should we include just 1-2 test models or all re-activated + Synthetic models?
   - Recommendation: Start with 2-3 models (1 reasoning, 1 standard, 1 Synthetic-equivalent) to validate pattern, full roster in Phase 60+

2. **Should OpenRouter providers have internal IDs matching existing models or new IDs?**
   - What we know: PROV-04 mentions handling model ID format, CONS-01 requires -syn model consolidation
   - What's unclear: Does "consolidation" happen in Phase 59 or later phase?
   - Recommendation: Phase 59 creates OpenRouter providers with NEW IDs (no conflicts), consolidation in Phase 60 after routing infrastructure exists

3. **Does validation script (PROV-05) run at build time or runtime?**
   - What we know: Success criteria mentions "validation script confirms no duplicate model IDs"
   - What's unclear: npm script vs runtime check vs CI/CD gate?
   - Recommendation: Create npm script (`npm run validate:model-ids`), add to CI/CD, not runtime (performance cost)

## Sources

### Primary (HIGH confidence)
- OpenRouter API Documentation: [API Reference](https://openrouter.ai/docs/api/reference/overview)
- OpenRouter Authentication: [Authentication Guide](https://openrouter.ai/docs/api/reference/authentication)
- OpenRouter App Attribution: [HTTP-Referer and X-Title Headers](https://openrouter.ai/docs/app-attribution)
- DeepSeek R1 Model Page: [Model ID Format](https://openrouter.ai/deepseek/deepseek-r1)
- Existing codebase: src/lib/llm/providers/together.ts, src/lib/llm/providers/synthetic.ts, src/lib/llm/providers/base.ts
- Phase 56-57 research: .planning/phases/56-language-json-fixes/, .planning/phases/57-category-fixes-fallbacks-validation/

### Secondary (MEDIUM confidence)
- OpenRouter Models Overview: [Access 400+ AI Models](https://openrouter.ai/docs/guides/overview/models)
- Multi-provider architecture research: .planning/research/OPENROUTER_ARCHITECTURE.md
- Provider unification pitfalls: .planning/research/PROVIDER_UNIFICATION_PITFALLS.md

### Tertiary (LOW confidence)
- WebSearch results on model ID format (no official spec found, inferred from examples)
- Duplicate validation patterns (extrapolated from existing validate-all-models.ts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenAICompatibleProvider pattern proven across 2 providers (Together, Synthetic) with 42 models
- Architecture: HIGH - Pattern 1-3 directly mirror existing TogetherProvider/SyntheticProvider implementations
- Pitfalls: HIGH - Pitfall 1-5 documented from prior research (.planning/research/PROVIDER_UNIFICATION_PITFALLS.md)
- Model ID format: MEDIUM - Confirmed from official OpenRouter model pages but no formal API spec

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days - stable domain, unlikely API changes)
