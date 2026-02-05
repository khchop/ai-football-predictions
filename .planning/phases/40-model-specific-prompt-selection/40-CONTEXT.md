# Phase 40: Model-Specific Prompt Selection - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Route failing models (GLM, Kimi, DeepSeek, Qwen thinking models) to specialized prompts and timeouts so they return valid JSON reliably. This phase handles prompt selection and response handling configuration — fallback chains are Phase 41.

</domain>

<decisions>
## Implementation Decisions

### Prompt Variants
- Named templates: `base`, `english-enforced`, `json-strict`, `thinking-stripped`
- Models reference variants by name in their config
- All prompts stored as templates (including base) for consistency
- Variants extend base prompt — each variant = base + additional instructions appended
- Three variant types needed:
  - English enforcement (GLM models returning Chinese)
  - JSON-only output (DeepSeek V3.2 adding explanations)
  - Thinking tag removal (DeepSeek R1, Qwen3-235B-Thinking wrapping in `<think>` tags)

### Selection Logic
- Explicit `promptVariant` field per model in config
- Missing/unspecified defaults to `base` (safe default)
- Single variant only — create combo variants if model needs multiple treatments (e.g., `english-thinking-stripped`)
- Model config also specifies `responseHandler` for post-processing: `"default"`, `"extract-json"`, `"strip-thinking-tags"`

### Timeout Behavior
- Per-model `timeoutMs` field in model config
- Timeout range: 30s (fast) → 60s (standard) → 90s (slow thinking models)
- Hard fail on timeout — let Phase 41's fallback logic handle retry
- Distinct error types: `TimeoutError` vs `ApiError` vs `ParseError` for differentiated handling

### Configuration Storage
- Extend existing AI_MODELS array/config with new fields (`promptVariant`, `timeoutMs`, `responseHandler`)
- Prompt templates stored in TypeScript constants file (`prompts.ts` with exported `PROMPT_VARIANTS`)
- Build-time validation with TypeScript — invalid variant names caught at compile
- Response handlers type-safe: `ResponseHandler` enum with `'default' | 'extract-json' | 'strip-thinking-tags'`

### Claude's Discretion
- Exact prompt wording for each variant
- Which combo variants to create if needed
- Internal implementation of response handlers
- File organization within existing structure

</decisions>

<specifics>
## Specific Ideas

- Variants extend base prompt rather than duplicating — keeps maintenance simple
- Type-safe config means refactoring catches all usages
- Error type distinction enables Phase 41 to handle timeouts differently from parse failures

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-model-specific-prompt-selection*
*Context gathered: 2026-02-05*
