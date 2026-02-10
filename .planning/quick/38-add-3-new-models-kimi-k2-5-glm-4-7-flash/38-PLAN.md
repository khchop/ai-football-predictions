---
phase: quick-38
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/together.ts
  - src/lib/llm/providers/synthetic.ts
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
autonomous: true
---

<objective>
Add 3 new models to the platform:
1. Kimi K2.5 — Together (primary) + Synthetic (2nd) + OpenRouter (3rd fallback) — 3-provider route
2. GLM 4.7 Flash — OpenRouter only (standalone primary) — no route needed, active via OR
3. DeepSeek R1-0528 — OpenRouter only (standalone primary) — no route needed, active via OR

After this: 42 total models → up to 44-45 models (depending on how we count).
</objective>

<tasks>

<task id="1" type="code">
  <name>Add Kimi K2.5 to all 3 providers and create 3-provider route</name>
  <details>
    **together.ts** — Add new TogetherProvider (model #30):
    ```
    id: 'kimi-k2.5'
    model: 'moonshotai/Kimi-K2.5'
    displayName: 'Kimi K2.5 (Moonshot)'
    tier: 'budget'
    pricing: { promptPer1M: 1.00, completionPer1M: 3.00 }  // same as other Kimi models
    isPremium: false
    ```
    Add to Moonshot section after kimi-k2-instruct. Update TOGETHER_PROVIDERS array (30 models).
    Update count comments from 29 to 30.

    **synthetic.ts** — Add new SyntheticProvider (model #11):
    ```
    id: 'kimi-k2.5-syn'
    model: 'hf:moonshotai/Kimi-K2.5'
    displayName: 'Kimi K2.5 (Synthetic)'
    tier: 'budget'
    pricing: { promptPer1M: 1.00, completionPer1M: 3.00 }
    isPremium: false
    ```
    Add in a new "Moonshot" section. Update SYNTHETIC_PROVIDERS array (11 models).
    Update count comments from 10 to 11.
    Add to ALL_PROVIDERS in index.ts comment update.

    **openrouter.ts** — Add new OpenRouterProvider:
    ```
    id: 'kimi-k2.5-or'
    model: 'moonshotai/kimi-k2.5'
    displayName: 'Kimi K2.5 (OpenRouter)'
    tier: 'budget'
    pricing: { promptPer1M: 0.45, completionPer1M: 2.25 }
    isPremium: false
    ```
    Add to OPENROUTER_PROVIDERS array.

    **index.ts** — Add 3-provider route:
    ```
    'kimi-k2.5': ['kimi-k2.5', 'kimi-k2.5-syn', 'kimi-k2.5-or'],
    ```
    Add in Together -> OpenRouter section. This is a 3-provider route (Together -> Synthetic -> OR).
    Update ALL_PROVIDERS comment from 39 to 40 total.
  </details>
</task>

<task id="2" type="code">
  <name>Add GLM 4.7 Flash and DeepSeek R1-0528 as OR-only models</name>
  <details>
    **openrouter.ts** — Add 2 new standalone OR primary models:

    GLM 4.7 Flash (ENGLISH_ENFORCED like other GLM models):
    ```
    id: 'glm-4.7-flash'
    model: 'z-ai/glm-4.7-flash'
    displayName: 'GLM 4.7 Flash (OpenRouter)'
    tier: 'budget'
    pricing: { promptPer1M: 0.06, completionPer1M: 0.40 }
    isPremium: false
    promptConfig: { promptVariant: ENGLISH_ENFORCED, responseHandler: EXTRACT_JSON, timeoutMs: 60000 }
    ```

    DeepSeek R1-0528 (THINKING_STRIPPED like DeepSeek R1):
    ```
    id: 'deepseek-r1-0528'
    model: 'deepseek/deepseek-r1-0528'
    displayName: 'DeepSeek R1 0528 (OpenRouter)'
    tier: 'budget'
    pricing: { promptPer1M: 0.40, completionPer1M: 1.75 }
    isPremium: false
    promptConfig: { promptVariant: THINKING_STRIPPED, responseHandler: STRIP_THINKING_TAGS, timeoutMs: 120000 }
    ```

    Add both to OPENROUTER_PROVIDERS array.
    These are NOT in any fallback route, so getActiveProviders() will include them as primary OR models.

    **index.ts** — Update ALL_PROVIDERS comment to reflect new total.
    No route needed for these 2 — they are standalone OR-only primary models.
  </details>
</task>

<task id="3" type="verify">
  <name>Build verification</name>
  <details>
    Run npm run build (or npx next build --webpack) to verify:
    - No TypeScript errors
    - Provider route validation passes
    - All provider IDs resolve correctly
  </details>
</task>

</tasks>

<verification>
- Kimi K2.5 exists in together.ts, synthetic.ts, and openrouter.ts
- 3-provider route for kimi-k2.5 in MODEL_PROVIDER_ROUTES
- GLM 4.7 Flash and DeepSeek R1-0528 exist in openrouter.ts
- No routes for OR-only models (they're standalone primaries)
- Build passes
</verification>
