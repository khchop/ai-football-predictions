# Phase 57: Category Fixes - Fallbacks & Validation - Research

**Researched:** 2026-02-08
**Domain:** LLM fallback orchestration, diagnostic validation, model coverage assessment
**Confidence:** HIGH

## Summary

Phase 57 focuses on expanding fallback chains to maximize model success rates and validating that fixes from Phases 55-56 achieve 95%+ model reliability. The platform already has proven fallback infrastructure (Phase 41) with 3 configured mappings, comprehensive diagnostic tooling (Phase 54), and systematic fixes for timeout/language/JSON issues (Phases 55-56). The research gap is identifying which additional Synthetic models can leverage Together AI fallbacks and validating the cumulative impact of all fixes.

**Current state analysis:**
- **Fallback infrastructure:** Operational since Phase 41 with cycle detection, cost tracking, and boolean flag in predictions table
- **Existing mappings:** 3 Synthetic → Together fallbacks (DeepSeek R1, Kimi K2 Thinking, Kimi K2.5)
- **Expansion opportunity:** 10 Synthetic-exclusive models have no fallback (DeepSeek V3 variants, MiniMax, GLM, Qwen Coder, GPT-OSS)
- **Validation foundation:** Diagnostic runner (Phase 54) with 6-category failure classification, golden fixtures, raw response capture

**Architecture approach:** Expand `MODEL_FALLBACKS` mapping conservatively — only add fallbacks where: (1) Together AI has same/similar model, (2) diagnostic evidence shows Synthetic version failing, (3) cost multiplier <2x. Run final diagnostic validation to measure success rate improvement and document remaining gaps with severity assessment.

**Primary recommendation:** Start with diagnostic run to establish baseline success rate, expand fallbacks based on failure patterns, re-run diagnostics to measure improvement, document any unfixable models (3B-7B small models) with rationale.

## Standard Stack

Infrastructure already exists — no new dependencies required:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MODEL_FALLBACKS mapping | Current | Synthetic → Together fallback configuration | Phase 41 infrastructure, validated with cycle detection |
| Diagnostic runner | Current | Model testing with failure categorization | Phase 54 infrastructure, captures raw responses, generates reports |
| callAPIWithFallback | Current | Provider-level fallback orchestration | Phase 41 implementation, max depth 1, cycle prevention |
| predictions.usedFallback | Current | Database tracking for admin visibility | Boolean flag already in schema, admin API aggregates metrics |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| getFallbackProvider | Current | Lookup Together AI equivalent | Called when Synthetic model fails |
| validateFallbackMapping | Current | Build-time cycle detection | Startup validation prevents invalid configs |
| categorizeFailure | Current | 6-category failure classification | Identify why models fail (timeout, parse, language, etc.) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conservative expansion | Aggressive fallback-all | Conservative prevents cost explosion, only adds where diagnostics show need |
| Manual expansion | Auto-discovery | Manual explicit config prevents unexpected fallback behavior (Phase 41 decision) |
| Diagnostic-driven | Preemptive fallbacks | Diagnostic-driven requires evidence before adding complexity |

**Installation:** No new packages required — all infrastructure exists from Phases 41, 54.

## Architecture Patterns

### Current Fallback Infrastructure (Phase 41)

```
Fallback orchestration pattern:
1. Try: Call original model via callAPI
2. Catch: Classify error (any error triggers fallback)
3. Check: Does model have fallbackModelId in MODEL_FALLBACKS?
4. Attempt: Call fallback model via callAPI (max depth 1)
5. Track: Set usedFallback=true on prediction
6. Return: Response attributed to original model
```

**Key constraints:**
- Max depth 1 (no chains, if fallback fails → fail prediction)
- Any error triggers fallback (timeout, parse, API error, rate limit)
- No retries on original model (first failure → immediate fallback)
- User-facing attribution to original model (fallback is internal)

### Pattern 1: Conservative Fallback Expansion

**What:** Add fallbacks only when diagnostic evidence shows Synthetic model failing AND Together AI has equivalent
**When to use:** After Phase 56 fixes applied, baseline diagnostic run shows which models still failing
**Example:**

```typescript
// Source: Existing MODEL_FALLBACKS in src/lib/llm/index.ts
export const MODEL_FALLBACKS: Record<string, string> = {
  // EXISTING (Phase 41)
  'deepseek-r1-0528-syn': 'deepseek-r1',           // Reasoning model, version mismatch
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',      // Thinking → Instruct variant
  'kimi-k2.5-syn': 'kimi-k2-instruct',             // K2.5 → K2 Instruct fallback

  // EXPANSION CANDIDATES (based on diagnostic failures):
  // DeepSeek V3 variants - NO Together AI equivalent (Synthetic exclusive)
  // MiniMax M2/M2.1 - NO Together AI equivalent
  // GLM 4.6/4.7 - NO Together AI equivalent
  // Qwen3 Coder 480B - NO Together AI equivalent
  // GPT-OSS 120B - Together only has 20B (different model)

  // CONCLUSION: 10 Synthetic-exclusive models CANNOT have fallbacks
  // If diagnostics show failures, document as "unfixable" with skip status
};
```

**Decision criteria for expansion:**
1. **Model equivalence:** Together AI has same model family/version
2. **Diagnostic evidence:** Baseline diagnostic shows Synthetic version failing
3. **Cost check:** Fallback cost <2x original (Phase 41 warning threshold)
4. **Explicit config:** No auto-discovery, manual mapping required

### Pattern 2: Diagnostic Validation Workflow

**What:** Multi-stage diagnostic validation to measure fix effectiveness
**When to use:** Before and after fallback expansion to quantify improvement
**Example:**

```bash
# Stage 1: Baseline (after Phase 56)
npm run diagnose
# Output: diagnostic-2026-02-08-baseline.md
# Success rate: 38/42 (90.5%) - hypothetical

# Stage 2: Expand fallbacks based on failure patterns
# Review raw responses in src/__tests__/diagnostic-results/raw-responses/
# Add fallbacks for models with equivalents on Together AI
# Edit src/lib/llm/index.ts MODEL_FALLBACKS

# Stage 3: Post-expansion validation
npm run diagnose
# Output: diagnostic-2026-02-08-post-fallbacks.md
# Success rate: 40/42 (95.2%) - target achieved

# Stage 4: Document remaining gaps
# Review 2 failing models, categorize as unfixable:
# - Model A: 3B size, timeout on complex prompts → skip
# - Model B: Synthetic-exclusive, no fallback available → skip
```

### Pattern 3: Unfixable Model Documentation

**What:** Document models that cannot reach 95% success with severity assessment
**When to use:** When diagnostic shows persistent failures after all fixes applied
**Example:**

```markdown
## Unfixable Models

### Model: minimax-m2.1-syn
- **Category:** TIMEOUT
- **Reason:** 3B model, extended inference time on complex prompts
- **Fallback Available:** No (MiniMax not on Together AI)
- **Severity:** LOW - Ultra-budget model, alternative models available
- **Mitigation:** Auto-disable if consecutive failures >5, redirect users to budget tier
- **Status:** SKIP (accepted limitation)

### Model: glm-4.6-syn
- **Category:** LANGUAGE
- **Reason:** Bilingual model, occasional Chinese output despite ENGLISH_ENFORCED
- **Fallback Available:** No (GLM not on Together AI)
- **Severity:** MEDIUM - English enforcement reduces but doesn't eliminate issue
- **Mitigation:** Fallback to GLM-4.7-syn (has EXTRACT_JSON for cleanup)
- **Status:** SKIP (acceptable with mitigation)
```

### Anti-Patterns to Avoid

- **Preemptive fallback expansion:** Don't add fallbacks without diagnostic evidence (violates diagnostic-driven approach)
- **Fallback chains >1 depth:** Phase 41 constraint — max depth 1 prevents cost explosions
- **Auto-discovery:** Phase 41 decision — explicit config prevents unexpected behavior
- **Ignoring cost multiplier:** Phase 41 warning threshold — fallback >2x original cost needs review

## Don't Hand-Roll

Problems with existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fallback orchestration | New wrapper system | Existing `callAPIWithFallback` in base.ts | Phase 41 implementation with cycle detection, cost tracking, max depth 1 |
| Failure categorization | Custom error parser | Existing `categorizeFailure()` from Phase 54 | 6-category taxonomy covers all LLM failure modes |
| Diagnostic validation | Manual testing | Existing `run-diagnostics.ts` script | Automated testing with golden fixtures, raw response capture, report generation |
| Cost calculation | Real-time billing | Existing `estimateCost()` methods | Conservative estimates with published pricing rates |

**Key insight:** Phases 41, 54, 55, 56 already built comprehensive infrastructure. Phase 57 is validation + expansion, not new architecture.

## Common Pitfalls

### Pitfall 1: Expanding Fallbacks Without Evidence
**What goes wrong:** Add fallbacks preemptively "just in case", increasing complexity without measurable benefit
**Why it happens:** Pressure to maximize coverage, not trusting diagnostic-driven approach
**How to avoid:**
- Run baseline diagnostic BEFORE expanding fallbacks
- Only add fallbacks for models with documented failure patterns
- Measure success rate improvement after expansion
**Warning signs:** Added fallback but diagnostic shows original model was already working

### Pitfall 2: Fallback Cost Explosion
**What goes wrong:** Fallback model is 3x-5x more expensive than original, budget overruns
**Why it happens:** Not checking cost multiplier before adding fallback mapping
**How to avoid:**
- Use `estimateCost()` to compare original vs fallback before mapping
- Phase 41 threshold: Alert if fallback >2x original cost
- Consider skipping model instead of expensive fallback
**Warning signs:** Admin dashboard shows fallback costs consistently >2x threshold

### Pitfall 3: Misinterpreting Diagnostic Results
**What goes wrong:** One-off API failures interpreted as systematic model issues
**Why it happens:** Single diagnostic run affected by transient issues (rate limits, server downtime)
**How to avoid:**
- Run diagnostics multiple times to confirm failure patterns
- Review raw responses to distinguish transient (API_ERROR) from systematic (TIMEOUT, PARSE)
- Check error category distribution: API_ERROR = transient, TIMEOUT = systematic
**Warning signs:** Diagnostic shows API_ERROR but re-run shows success

### Pitfall 4: Accepting Low Success Rate for Unfixable Models
**What goes wrong:** Document models as "unfixable" without exploring all mitigation options
**Why it happens:** Assuming no fallback available = no solution
**How to avoid:**
- Mitigation hierarchy: (1) fallback, (2) prompt tuning, (3) auto-disable, (4) skip
- Consider cross-family fallbacks: GLM-4.6 → Qwen3 if both fail
- Review Phase 55-56 fixes: Did we apply all handlers correctly?
**Warning signs:** Model documented as unfixable but still active in production

### Pitfall 5: Ignoring Regression from Fallback Expansion
**What goes wrong:** Adding fallbacks breaks previously-working models
**Why it happens:** Cycle detection bug, invalid mapping, wrong model ID
**How to avoid:**
- Build-time validation: `validateFallbackMapping()` runs at startup
- Test fallback mappings in isolation before merging
- Compare pre/post diagnostic reports: Success rate should not decrease
**Warning signs:** Post-expansion diagnostic shows lower success rate than baseline

## Code Examples

Verified patterns from existing codebase:

### Fallback Mapping Expansion
```typescript
// Source: src/lib/llm/index.ts (current state)
export const MODEL_FALLBACKS: Record<string, string> = {
  // Existing (Phase 41)
  'deepseek-r1-0528-syn': 'deepseek-r1',
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',
  'kimi-k2.5-syn': 'kimi-k2-instruct',

  // NEW: Expansion candidates (only if diagnostic shows failures)
  // Example: If diagnostic shows Qwen3 235B Thinking failing on Synthetic
  // 'qwen3-235b-thinking-syn': 'qwen3-235b-instruct', // Same family fallback
};
```

### Diagnostic Baseline Capture
```bash
# Source: scripts/diagnostic/run-diagnostics.ts (Phase 54)
# Run baseline diagnostic after Phase 56 fixes applied
npm run diagnose

# Output files:
# - src/__tests__/diagnostic-results/reports/diagnostic-2026-02-08.md
# - src/__tests__/diagnostic-results/raw-responses/*.json (one per model)

# Parse success rate from report:
# "Successful: 38/42 (90.5%)"
```

### Cost Comparison Before Fallback
```typescript
// Source: Existing estimateCost() methods in providers
import { getProviderById, getFallbackProvider } from '@/lib/llm';

function checkFallbackCostMultiplier(syntheticModelId: string): {
  hasFallback: boolean;
  costMultiplier?: number;
  exceeds2x?: boolean;
} {
  const original = getProviderById(syntheticModelId);
  const fallback = getFallbackProvider(syntheticModelId);

  if (!original || !fallback) {
    return { hasFallback: false };
  }

  // Conservative estimates: 500 input, 50 output tokens
  const originalCost = original.estimateCost(500, 50);
  const fallbackCost = fallback.estimateCost(500, 50);
  const costMultiplier = fallbackCost / originalCost;

  return {
    hasFallback: true,
    costMultiplier,
    exceeds2x: costMultiplier > 2.0,
  };
}

// Usage before adding fallback mapping:
const check = checkFallbackCostMultiplier('deepseek-v3.2-syn');
if (check.exceeds2x) {
  console.warn(`Fallback cost ${check.costMultiplier.toFixed(2)}x original - review before mapping`);
}
```

### Unfixable Model Documentation Template
```markdown
## Remaining Failures (2/42 models)

### Model: minimax-m2.1-syn
- **Provider:** Synthetic
- **Failure Category:** TIMEOUT
- **Failure Rate:** 80% (8/10 diagnostics)
- **Root Cause:** 3B model size, extended inference on complex prompts (>45s)
- **Fallback Available:** No (MiniMax not on Together AI)
- **Fix Attempted:** Increased timeout to 60s (Phase 55) — insufficient
- **Severity:** LOW
  - Ultra-budget tier ($0.55/$1.10 per 1M tokens)
  - Alternative models available: DeepSeek V3.1, Qwen3 Next 80B
  - Usage: <5% of predictions
- **Mitigation Plan:**
  - Auto-disable after 5 consecutive failures
  - Admin notification when disabled
  - Redirect new predictions to budget tier alternatives
- **Status:** SKIP (accepted limitation)

### Model: glm-4.7-syn
- **Provider:** Synthetic
- **Failure Category:** PARSE
- **Failure Rate:** 10% (1/10 diagnostics)
- **Root Cause:** Occasional markdown wrapping despite EXTRACT_JSON handler
- **Fallback Available:** No (GLM not on Together AI)
- **Fix Attempted:** JSON_STRICT + EXTRACT_JSON (Phase 56) — 90% effective
- **Severity:** LOW
  - 90% success rate meets threshold
  - Parser covers most wrapping patterns
  - Remaining 10% may be edge cases
- **Mitigation Plan:**
  - Monitor fallback rate in production
  - Investigate raw responses for 10% failures
  - Consider additional parser patterns if systematic
- **Status:** ACCEPTABLE (95%+ success across all models, 10% failure acceptable)
```

### Production Validation Query
```typescript
// Source: Phase 41 admin API patterns
// Validate fallback rates in production after expansion
async function getProductionFallbackRates(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db
    .select({
      modelId: predictions.modelId,
      totalPredictions: sql<number>`count(*)::int`,
      fallbackCount: sql<number>`count(*) filter (where ${predictions.usedFallback} = true)::int`,
      fallbackRate: sql<number>`(count(*) filter (where ${predictions.usedFallback} = true)::float / count(*)::float)`,
    })
    .from(predictions)
    .where(
      and(
        gte(predictions.createdAt, startDate.toISOString()),
        eq(predictions.status, 'scored')
      )
    )
    .groupBy(predictions.modelId);

  return stats.filter(s => s.fallbackRate > 0.05); // Models using fallback >5%
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual testing | Automated diagnostics with categorization | 2025-2026 | Phase 54 systematic failure analysis |
| Fix all models | Diagnostic-driven fixes | 2026 | Phase 56 only changed 4 models (evidence-based) |
| Single provider | Multi-provider with fallbacks | 2025 | Phase 41 Together AI fallbacks for resilience |
| Pass/fail validation | 6-category failure taxonomy | 2026 | Phase 54 actionable fix recommendations |

**Current best practices (2026):**
- **Diagnostic-driven:** Don't apply fixes without evidence of failure
- **Conservative fallbacks:** Only add where model equivalent exists and diagnostics show need
- **Max depth 1:** Prevent cascading failures and cost explosions
- **Belt-and-suspenders:** Multiple defense layers (prompt variant + response handler + parser)

**Deprecated/outdated:**
- **Preemptive fixes:** Applying handlers to all models "just in case" (breaks working models)
- **Unlimited fallback depth:** Best practice is 1-2 hops maximum (Phase 41 constraint)
- **Auto-discovery fallbacks:** Modern pattern is explicit configuration (prevents surprises)

## Open Questions

### 1. Success Rate Threshold for Unfixable Classification
- **What we know:** Phase 57 target is 95%+ overall, but individual model threshold unclear
- **What's unclear:** Is 90% success rate for individual model acceptable if overall >95%?
- **Recommendation:** Accept individual model 90%+ if: (1) overall >95%, (2) mitigation exists, (3) severity LOW

### 2. Fallback Cost Alert Mechanism
- **What we know:** Phase 41 defined >2x cost multiplier as warning threshold
- **What's unclear:** Should high-cost fallbacks block deployment or just alert?
- **Recommendation:** Alert only (non-blocking), admin dashboard shows warning badge, document in RESEARCH.md

### 3. Cross-Family Fallback Strategy
- **What we know:** Current fallbacks are same-model (DeepSeek → DeepSeek, Kimi → Kimi)
- **What's unclear:** Should we add cross-family fallbacks for exclusive models (GLM → Qwen)?
- **Recommendation:** No — Phase 41 decision was 1:1 same-model mapping, cross-family adds complexity without evidence of need

### 4. Diagnostic Re-Run Frequency
- **What we know:** Need baseline + post-expansion diagnostics
- **What's unclear:** How many re-runs needed to confirm stability (transient vs systematic failures)?
- **Recommendation:** Minimum 3 runs: (1) baseline, (2) post-expansion, (3) confirmation. If results vary >5%, investigate transient issues

### 5. Auto-Disable Threshold for Unfixable Models
- **What we know:** Models with persistent failures should be disabled
- **What's unclear:** What's the consecutive failure threshold for auto-disable?
- **Recommendation:** Use existing Phase 40 threshold — 5 consecutive failures triggers auto-disable, admin notification

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/llm/index.ts` - MODEL_FALLBACKS, getFallbackProvider, validateFallbackMapping
- Existing codebase: `src/lib/llm/providers/base.ts` - callAPIWithFallback implementation (lines 370-423)
- Existing codebase: `scripts/diagnostic/run-diagnostics.ts` - Diagnostic runner with categorization
- Existing codebase: `scripts/diagnostic/categorize-failure.ts` - 6-category failure taxonomy
- Phase 41 RESEARCH.md: Fallback infrastructure patterns, cost tracking, cycle detection
- Phase 54 RESEARCH.md: Diagnostic testing patterns, failure categorization, report generation
- Phase 56 VERIFICATION.md: Language enforcement and JSON extraction fixes validated
- Phase 41 CONTEXT.md: User decisions on fallback behavior (max depth 1, minimal tracking)

### Secondary (MEDIUM confidence)
- Phase 56-01 SUMMARY.md: Language enforcement audit findings (GLM models configured)
- Phase 56-02 SUMMARY.md: JSON extraction audit findings (3 models with handlers)
- Phase 39 testing infrastructure: Regression test patterns, golden fixtures

### Tertiary (LOW confidence)
- None applicable — all research based on existing codebase and prior phase documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists from Phases 41, 54
- Architecture: HIGH - Expansion pattern follows Phase 41 constraints
- Pitfalls: HIGH - Based on existing fallback infrastructure and diagnostic patterns
- Validation workflow: HIGH - Diagnostic runner proven in Phase 54
- Unfixable model strategy: MEDIUM - Classification criteria needs refinement during execution

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, existing infrastructure)

**Key constraints from prior phases:**
- Phase 41: Max depth 1, no fallback chains
- Phase 41: Explicit mapping, no auto-discovery
- Phase 41: Minimal tracking (boolean flag only)
- Phase 54: 6-category failure taxonomy
- Phase 56: Diagnostic-driven fixes (evidence required)
- Phase 56: Belt-and-suspenders approach (prompt variant + response handler)

**Current model inventory:**
- 29 Together AI models
- 13 Synthetic models
- 3 existing fallback mappings
- 10 Synthetic-exclusive models (no Together AI equivalent)

**Success criteria:**
- 95%+ overall success rate (40+ of 42 models)
- Remaining failures documented with severity assessment
- Fallback expansion cost-justified (<2x multiplier)
- Production validation confirms no regressions
