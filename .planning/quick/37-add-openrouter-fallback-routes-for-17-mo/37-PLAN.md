---
phase: quick-37
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
autonomous: true
---

<objective>
Add OpenRouter fallback routes for 13 models verified on OpenRouter API (2026-02-10).

After this task: 22 existing + 13 new = 35 OpenRouter fallback routes.
Only 4 models will remain without OR fallbacks: cogito-70b, cogito-109b-moe, cogito-405b, marin-8b-instruct (not available on OpenRouter).
</objective>

<tasks>

<task id="1" type="code">
  <name>Add 13 new OpenRouter provider instances to openrouter.ts</name>
  <details>
    Add new OpenRouterProvider instances for these models (verified on OR API 2026-02-10):

    Together AI models -> OR fallbacks (9):
    1. deepseek-v3.1-or -> deepseek/deepseek-chat-v3.1 ($0.15/$0.75, budget)
    2. kimi-k2-0905-or -> moonshotai/kimi-k2-0905 ($0.39/$1.90, budget)
    3. kimi-k2-instruct-or -> moonshotai/kimi-k2 ($0.50/$2.40, budget)
    4. gpt-oss-20b-or -> openai/gpt-oss-20b ($0.03/$0.14, ultra-budget)
    5. mistral-small-3-24b-or -> mistralai/mistral-small-24b-instruct-2501 ($0.05/$0.08, ultra-budget)
    6. mistral-7b-v0.2-or -> mistralai/mistral-7b-instruct-v0.2 ($0.20/$0.20, ultra-budget)
    7. mistral-7b-v0.3-or -> mistralai/mistral-7b-instruct-v0.3 ($0.20/$0.20, ultra-budget)
    8. nemotron-nano-9b-v2-or -> nvidia/nemotron-nano-9b-v2 ($0.04/$0.16, ultra-budget)
    9. gemma-3n-e4b-or -> google/gemma-3n-e4b-it ($0.02/$0.04, free)

    Synthetic models -> OR fallbacks (4):
    10. qwen3-235b-thinking-or -> qwen/qwen3-235b-a22b-thinking-2507 ($0.11/$0.60, budget)
        promptConfig: THINKING_STRIPPED + STRIP_THINKING_TAGS, 120s timeout
    11. deepseek-v3-0324-or -> deepseek/deepseek-chat-v3-0324 ($0.19/$0.87, budget)
    12. deepseek-v3.1-terminus-or -> deepseek/deepseek-v3.1-terminus ($0.21/$0.79, budget)
    13. gpt-oss-120b-or -> openai/gpt-oss-120b ($0.039/$0.19, ultra-budget)
        promptConfig: JSON_STRICT + EXTRACT_JSON, 45s timeout

    Add to OPENROUTER_PROVIDERS array. Update count comment.
  </details>
</task>

<task id="2" type="code">
  <name>Add 13 new routes to MODEL_PROVIDER_ROUTES in index.ts</name>
  <details>
    Add fallback routes for all 13 models. Update comments with new counts.

    Together -> OR (9 new):
    'deepseek-v3.1': ['deepseek-v3.1', 'deepseek-v3.1-or'],
    'kimi-k2-0905': ['kimi-k2-0905', 'kimi-k2-0905-or'],
    'kimi-k2-instruct': ['kimi-k2-instruct', 'kimi-k2-instruct-or'],
    'gpt-oss-20b': ['gpt-oss-20b', 'gpt-oss-20b-or'],
    'mistral-small-3-24b': ['mistral-small-3-24b', 'mistral-small-3-24b-or'],
    'mistral-7b-v0.2': ['mistral-7b-v0.2', 'mistral-7b-v0.2-or'],
    'mistral-7b-v0.3': ['mistral-7b-v0.3', 'mistral-7b-v0.3-or'],
    'nemotron-nano-9b-v2': ['nemotron-nano-9b-v2', 'nemotron-nano-9b-v2-or'],
    'gemma-3n-e4b': ['gemma-3n-e4b', 'gemma-3n-e4b-or'],

    Synthetic -> OR (4 new):
    'qwen3-235b-thinking': ['qwen3-235b-thinking', 'qwen3-235b-thinking-or'],
    'deepseek-v3-0324': ['deepseek-v3-0324', 'deepseek-v3-0324-or'],
    'deepseek-v3.1-terminus': ['deepseek-v3.1-terminus', 'deepseek-v3.1-terminus-or'],
    'gpt-oss-120b': ['gpt-oss-120b', 'gpt-oss-120b-or'],

    Update comment: "Together -> OpenRouter (25 models)" and "Synthetic -> OpenRouter (10 models)"
  </details>
</task>

<task id="3" type="verify">
  <name>Build verification</name>
  <details>
    Run npm run build to verify no TypeScript errors and provider route validation passes.
  </details>
</task>

</tasks>

<verification>
- All 13 new OR provider IDs exist in OPENROUTER_PROVIDERS array
- All 13 new routes added to MODEL_PROVIDER_ROUTES
- Provider route validation passes at module load (no duplicate IDs, all referenced providers exist)
- npm run build passes
- Total OR providers: 35 (22 existing + 13 new)
- Total routes: 35 (22 existing + 13 new)
</verification>

<notes>
Models NOT on OpenRouter (4 remain without fallback):
- cogito-70b, cogito-109b-moe, cogito-405b (only cogito-v2.1-671b on OR)
- marin-8b-instruct (niche community model)

User questions answered:
- Kimi K2.5: Available on OR (moonshotai/kimi-k2.5) but NOT in our primary models — would be a new model addition
- GLM 4.7: ALREADY has OR fallback route (glm-4.7-or)
- DeepSeek V3.2: ALREADY has OR fallback route (deepseek-v3.2-or)
- Notable 2026 models on OR we don't have: Kimi K2.5, GLM 4.7 Flash, DeepSeek R1-0528
</notes>
