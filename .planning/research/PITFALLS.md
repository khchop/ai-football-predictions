# LLM Model Coverage Pitfalls

**Domain:** Achieving 100% prediction coverage across 42 heterogeneous LLM models in production
**Researched:** 2026-02-07
**Confidence:** HIGH (based on existing v2.5 implementation + verified production patterns)

## Executive Summary

Achieving 100% coverage across 42 models (29 Together AI + 13 Synthetic.new) spanning 3B-671B parameters, multiple model families (DeepSeek, Qwen, Llama, Mistral, GLM, Kimi, MiniMax, Cogito, Gemma, Nemotron), and different languages (English/Chinese defaults) is fundamentally a **heterogeneity management problem**. The primary danger is creating a whack-a-mole situation where fixing Model A breaks Model B, leading to oscillating failures and spiraling costs.

Research shows that production multi-model systems fail not from individual model issues, but from **incorrect assumptions about universality** — believing that a prompt/timeout/parsing strategy that works for one model will work for all models in that category. The v2.5 implementation already addresses the basic architecture (model-specific prompts, fallbacks, timeouts), but the pitfalls below focus on the **integration and validation challenges** specific to scaling to 100% coverage.

**Critical insight from production data:** Most "100% coverage" initiatives fail because teams optimize for **making models work** rather than **keeping models working**. The difference is regression detection, budget discipline, and quality validation.

---

## Critical Pitfalls

Mistakes that cause rewrites, production incidents, or cost spirals.

---

### Pitfall 1: Whack-a-Mole Prompt Tuning (The Oscillation Trap)

**Risk:** CRITICAL | **Likelihood:** HIGH
**Category:** Regression

**What goes wrong:** Tuning prompts to fix Model A breaks Model B that was working. Teams enter an oscillation cycle where total coverage never increases, just shuffles which models fail.

**Why it happens:**
- Prompt variants are tested in isolation, not validated against the full model set
- Changes to base prompts (SYSTEM_PROMPT, BATCH_SYSTEM_PROMPT) propagate to all models using `PromptVariant.BASE`
- No regression test suite exists to catch when a change breaks previously working models
- Teams assume "more explicit instructions = better" but some models interpret verbose prompts differently

**Real example from research:**
> "Prompts that work perfectly in testing often start failing after a model update, JSON parsers break on unexpected field types, and applications crash because LLMs rename fields without warning." ([Agenta structured outputs guide](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms))

**Project-specific risk:**
- Base prompts in `src/lib/llm/prompt.ts` (SYSTEM_PROMPT, BATCH_SYSTEM_PROMPT) affect 30+ models
- Adding "CRITICAL: Respond ONLY in English" to base prompt may confuse non-Chinese models
- JSON_STRICT variant adds 5 lines of instructions — some models may over-focus on format and ignore content

**Consequences:**
- Total working models oscillates between 35-39 instead of progressing to 42
- Development velocity drops as each fix requires full regression testing
- Team morale degrades ("we're not making progress")
- Budget waste from repeated failed predictions during testing

**Prevention:**

1. **Immutable base prompts rule:** Never modify SYSTEM_PROMPT or BATCH_SYSTEM_PROMPT after v2.5. All fixes must use variants.

2. **Regression test harness (MUST BUILD):**
   ```typescript
   // Test suite that runs on every prompt/timeout change
   describe('Model regression tests', () => {
     WORKING_MODELS.forEach(modelId => {
       it(`${modelId} still produces valid JSON`, async () => {
         const result = await provider.predict(/* ... */);
         expect(result.success).toBe(true);
         expect(result.homeScore).toBeGreaterThanOrEqual(0);
       });
     });
   });
   ```

3. **Change log discipline:** Track which models work with which config in `.planning/model-status.json`:
   ```json
   {
     "deepseek-r1": {
       "working_since": "2026-02-05",
       "config": {
         "promptVariant": "THINKING_STRIPPED",
         "timeoutMs": 60000
       },
       "last_validated": "2026-02-07"
     }
   }
   ```

4. **Staged rollout protocol:**
   - Change affects 1 model → Test that model + 5 random working models
   - Change affects base prompt → Test ALL 42 models before deploy
   - Any regression → Rollback immediately, investigate offline

**Detection (warning signs):**
- Coverage percentage stagnates or oscillates (37% → 39% → 36% → 38%)
- Git history shows repeated modifications to same prompt files
- Logs show models that worked last week now failing
- "We fixed X but broke Y" appears in commit messages

**Remediation if caught:**
1. Freeze all base prompt changes immediately
2. Establish baseline: which models work RIGHT NOW with current config
3. Create regression test suite for baseline models
4. Only proceed with new fixes after regression protection exists

---

### Pitfall 2: Aggressive Timeout Escalation (The Cost Spiral)

**Risk:** CRITICAL | **Likelihood:** HIGH
**Category:** Budget/Performance

**What goes wrong:** Increasing timeouts to fix slow models creates cascading cost and pipeline problems. A model that takes 90s to respond blocks the prediction job, burns tokens on reasoning steps that don't improve accuracy, and costs 3x more than budgeted.

**Why it happens:**
- Timeout errors are easy to "fix" by increasing timeout (appears to solve problem immediately)
- Teams don't measure whether longer timeouts actually improve success rate
- No visibility into **token consumption during reasoning** (DeepSeek R1 may use 5000 tokens for thinking, 50 for answer)
- Pipeline timing assumes 30-60s prediction window, but 90s timeout breaks this assumption

**Real example from research:**
> "When traffic arrives, rate limits appear, tools time out, the model retries, and agents can enter a loop burning through requests until the pager reminds you that 'autonomy' is just 'automation with a larger blast radius.'" ([Medium: LLM Tool-Calling in Production](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8))

**Project-specific risk:**
- Budget limit is $1-5/day across 42 models
- Predictions must complete 30 minutes before kickoff (T-30m job scheduling)
- If 5 reasoning models take 90s each (450s total), batch prediction window becomes infeasible
- Current fallback chains can double timeout (original model 60s + fallback 60s = 120s)
- Synthetic.new models may have different rate limits than Together AI (unknown)

**Consequences:**
- Daily budget exhausted by 3pm instead of lasting full day
- Prediction jobs miss kickoff deadline (predictions not ready when match starts)
- Pipeline backs up when multiple matches scheduled close together
- Fallback chains timeout completely (original + fallback both 90s = 3 min per prediction)

**Prevention:**

1. **Timeout ceiling enforcement:**
   ```typescript
   // In prompt-variants.ts or model config
   const MAX_TIMEOUT_MS = 60000; // 60s hard cap
   const MAX_PREMIUM_TIMEOUT_MS = 90000; // 90s for expensive models only

   // Validate at provider instantiation
   if (timeoutMs > MAX_TIMEOUT_MS && !isPremium) {
     throw new Error(`Non-premium model ${id} exceeds timeout ceiling`);
   }
   ```

2. **Success rate monitoring by timeout tier:**
   ```typescript
   // Track whether timeout increases actually help
   const timeoutTiers = {
     '30s': { attempts: 0, successes: 0 },
     '60s': { attempts: 0, successes: 0 },
     '90s': { attempts: 0, successes: 0 },
   };

   // If 60s→90s increase only improves success rate by 5%, not worth it
   ```

3. **Token budget per model:**
   ```typescript
   // Calculate expected cost BEFORE deploying timeout change
   interface ModelBudget {
     maxTokensPerPrediction: number;
     predictionsPerDay: number;
     costPerPrediction: number;
   }

   // DeepSeek R1 reasoning: 5000 tokens avg * $3/1M = $0.015 per prediction
   // At 100 predictions/day = $1.50/day for ONE model (30% of total budget)
   ```

4. **Pipeline timing validation:**
   - Total prediction time per match = (# models) * (avg timeout / 2) / (parallelism factor)
   - Example: 42 models * 45s avg / 10 parallel = ~189s (~3 min)
   - If > 10 minutes total, pipeline breaks (matches within 30 min won't complete)

5. **Timeout escalation protocol:**
   - 30s → 45s: Requires proof that model succeeds at 45s (manual testing)
   - 45s → 60s: Requires success rate data showing >20% improvement
   - 60s → 90s: ONLY for premium reasoning models, requires cost/benefit analysis
   - >90s: Forbidden (mark model as incompatible instead)

**Detection (warning signs):**
- Daily API budget exhausted early (monitoring alert)
- BullMQ job queue backlog grows (jobs not completing in time)
- Matches within 30 min of kickoff missing predictions (MON-03 alert)
- Cost per prediction increasing week-over-week (cost tracking dashboard)
- Logs show many timeout errors at 90s boundary (model genuinely can't complete)

**Remediation if caught:**
1. Rollback timeout increases immediately
2. Identify which models TRULY need longer timeouts (success rate data)
3. Mark genuinely slow models as "inactive" temporarily (don't fight physics)
4. Investigate alternative approaches: smaller model variants, simplified prompts, batch reduction

---

### Pitfall 3: Fighting Unfixable Models (The Sunk Cost Fallacy)

**Risk:** HIGH | **Likelihood:** MEDIUM
**Category:** Resource waste

**What goes wrong:** Team spends days/weeks trying to fix a fundamentally broken model (3B parameter model that can't do JSON, API endpoint that's genuinely unstable, model deprecated by provider) instead of accepting it won't work and moving on.

**Why it happens:**
- "We're at 97% coverage, just need these 2 models!" — proximity to goal blinds team to diminishing returns
- Ego investment ("I should be able to make this work")
- Lack of objective criteria for "this model is unfixable"
- Pressure to hit 100% metric even if some models provide no value

**Real example from research:**
> "Three budget models—GLM-4.5, Grok-3 Mini, and GPT-5 Nano—delivered near-perfect structured output, showing that predictability doesn't always require big or expensive models." ([Medium: Which LLMs Actually Produce Valid JSON](https://medium.com/@lyx_62906/which-llms-actually-produce-valid-json-7c7b1a56c225))

**Inverse lesson:** If small budget models CAN produce JSON reliably, a model that repeatedly fails after extensive tuning is likely fundamentally unsuited.

**Project-specific risk:**
- GLM models currently marked inactive in v2.4 (TEST-03: "auto-disabled (timeout/API bug detected)")
- Very small models (3B, 7B) may genuinely lack JSON formatting capability
- Synthetic.new is newer/less mature than Together AI (API bugs more likely)
- Chinese-language-default models may have tokenizer issues with English JSON

**Objective "unfixable" criteria:**

1. **After 5 distinct fix attempts (prompt/timeout/handler combinations), success rate < 50%**
   - Fix attempt 1: Base prompt + 30s timeout → 10% success
   - Fix attempt 2: JSON_STRICT variant + 30s timeout → 20% success
   - Fix attempt 3: JSON_STRICT + 60s timeout → 25% success
   - Fix attempt 4: EXTRACT_JSON handler + 60s timeout → 40% success
   - Fix attempt 5: Combo variant + 90s timeout → 45% success
   - **Verdict:** Unfixable. Mark inactive, document why, move on.

2. **API endpoint genuinely unstable (>30% 5xx errors, not transient)**
   - 5xx errors are server-side, not fixable by client
   - If provider's API is broken, no amount of retry logic helps
   - Check provider status page, test with other models on same provider
   - If provider-wide issue, wait for provider to fix (not your problem)

3. **Model outputs valid JSON but predictions are nonsensical (always predicts 1-0, ignores context)**
   - This is a quality issue, not a coverage issue
   - Model "works" (no errors) but provides no value
   - Better to exclude than include bad predictions (pollutes leaderboard)

4. **Cost per successful prediction > 10x median model cost**
   - Example: DeepSeek R1 costs $0.015/prediction, median is $0.002/prediction (7.5x)
   - If a model costs $0.03/prediction due to retries/fallbacks/reasoning tokens, too expensive
   - Budget math: $5/day budget ÷ $0.03/prediction = 166 predictions/day max (across ALL models)
   - Not sustainable for 100 predictions/day * 42 models = 4200 predictions/day

**Give-up protocol:**

1. **After 5 fix attempts OR 2 days of effort:**
   - Document all attempted fixes in model-status.json
   - Mark model as `active: false` with reason
   - Add to "Known Incompatible Models" section in docs
   - Move on to next model

2. **Quarterly review process:**
   - Every 3 months, re-test inactive models (providers update models)
   - Check if provider released new version (e.g., GLM 5.0 fixes JSON issues)
   - Test with current prompt configuration (may work with improved base prompts)
   - If still broken, remain inactive

3. **Coverage target adjustment:**
   - 100% coverage of ACTIVE models (42 models - incompatible models)
   - If 3 models are truly unfixable, target is 39/39 = 100%, not 39/42 = 93%
   - Communicate clearly: "100% of viable models" not "100% of registered models"

**Detection (warning signs):**
- Same model appears in daily standup for >5 days straight
- Git history shows >10 commits attempting to fix one model
- Team discussions include phrases like "just one more thing to try"
- Model's failure mode hasn't changed despite different fix attempts

**Remediation if caught:**
1. Call explicit "give up" meeting for the model
2. Document everything tried (prevents future re-investigation)
3. Mark inactive with clear reason (timeout issues, API instability, etc.)
4. Celebrate progress on other models instead (focus on what works)

---

### Pitfall 4: JSON Mode False Security (Schema vs Syntax)

**Risk:** HIGH | **Likelihood:** HIGH
**Category:** Data quality

**What goes wrong:** Model returns syntactically valid JSON but with wrong schema (unexpected fields, wrong types, missing required fields), and system crashes downstream despite passing initial validation.

**Why it happens:**
- `response_format: { type: "json_object" }` only guarantees parseable JSON, not correct structure
- Parser checks for `homeScore`/`awayScore` existence but not type validation
- Models invent fields (`home_goals`, `away_goals`) or nest structure (`scores: { home: 2 }`)
- Small models (3B-7B) struggle with consistent schema even when JSON is valid

**Real example from research:**
> "JSON mode represents the first generation of solutions, eliminating the need to strip markdown formatting, but doesn't guarantee the JSON matches your expected schema—the model might still return valid JSON with unexpected fields or structures." ([LangChain structured output guide](https://docs.langchain.com/oss/python/langchain/structured-output))

**Project-specific risk:**
- Current parsing in `parsePredictionResponse` and `parseBatchPredictionEnhanced` uses fallback strategies but may accept malformed predictions
- No Zod schema validation on LLM responses (unlike API endpoints which use Zod extensively)
- Small parameter models (Gemma 3B, Llama 7B, Qwen 7B variants) may produce valid JSON with wrong structure
- Batch predictions have more complex schema (array of objects) — more failure modes

**Observed failure modes from research:**

1. **Type coercion issues:**
   ```json
   {"homeScore": "2", "awayScore": "1"}  // Strings not numbers
   ```

2. **Field naming variations:**
   ```json
   {"home_score": 2, "away_score": 1}     // Snake case
   {"homeGoals": 2, "awayGoals": 1}       // Different naming
   ```

3. **Nested structure:**
   ```json
   {"prediction": {"homeScore": 2, "awayScore": 1}}  // Wrapped
   ```

4. **Extra fields that break parsing:**
   ```json
   {"homeScore": 2, "awayScore": 1, "confidence": "high", "reasoning": "..."}  // Extra data
   ```

5. **Batch prediction field confusion:**
   ```json
   [
     {"match_id": "123", "home": 2, "away": 1},  // Wrong field names
     {"id": "456", "homeScore": 1, "awayScore": 0}  // Inconsistent naming
   ]
   ```

**Prevention:**

1. **Zod schema validation for all LLM responses:**
   ```typescript
   // src/lib/llm/validation.ts
   import { z } from 'zod';

   export const PredictionSchema = z.object({
     homeScore: z.number().int().min(0).max(20),
     awayScore: z.number().int().min(0).max(20),
   });

   export const BatchPredictionSchema = z.array(
     z.object({
       matchId: z.string(),
       homeScore: z.number().int().min(0).max(20),
       awayScore: z.number().int().min(0).max(20),
     })
   );

   // In parsePredictionResponse
   const parsed = JSON.parse(response);
   const validated = PredictionSchema.safeParse(parsed);

   if (!validated.success) {
     throw new ParseError(
       `Schema validation failed: ${validated.error.message}`,
       response
     );
   }
   ```

2. **Schema enforcement in prompt:**
   ```typescript
   // Add to SYSTEM_PROMPT and variants
   const SCHEMA_INSTRUCTION = `
   REQUIRED JSON SCHEMA - DO NOT DEVIATE:
   {
     "homeScore": <number 0-20>,
     "awayScore": <number 0-20>
   }

   - Field names MUST be exactly "homeScore" and "awayScore" (camelCase)
   - Values MUST be integers between 0 and 20
   - Do NOT add extra fields
   - Do NOT nest the object
   `;
   ```

3. **Graceful coercion with logging:**
   ```typescript
   // Attempt to fix common variations before rejecting
   function coerceToSchema(parsed: any): { homeScore: number; awayScore: number } | null {
     const variations = [
       // Try direct access
       { home: parsed.homeScore, away: parsed.awayScore },
       // Try snake_case
       { home: parsed.home_score, away: parsed.away_score },
       // Try nested prediction
       { home: parsed.prediction?.homeScore, away: parsed.prediction?.awayScore },
       // Try alternative naming
       { home: parsed.homeGoals, away: parsed.awayGoals },
     ];

     for (const variant of variations) {
       const home = Number(variant.home);
       const away = Number(variant.away);

       if (Number.isInteger(home) && Number.isInteger(away) &&
           home >= 0 && home <= 20 && away >= 0 && away <= 20) {

         // Log successful coercion for monitoring
         if (variant !== variations[0]) {
           logger.warn({ parsed, coerced: { homeScore: home, awayScore: away } },
             'Schema coercion applied - model using non-standard format');
         }

         return { homeScore: home, awayScore: away };
       }
     }

     return null; // Unfixable
   }
   ```

**Detection (warning signs):**
- Database logs show type coercion warnings
- Predictions stored with 0-0 scores (failed coercion to number)
- Error logs show "Cannot read property X of undefined" in prediction processing
- Model returns JSON that parses but predictions don't appear on match page

**Remediation if caught:**
1. Add Zod validation to ALL parsing functions immediately
2. Review last 7 days of predictions for invalid data (data quality check)
3. Add schema instruction to prompts for models with violations
4. Consider response handler for models that consistently use wrong field names

---

### Pitfall 5: Dev-Prod Environment Divergence (The "Works on My Machine" Trap)

**Risk:** CRITICAL | **Likelihood:** HIGH
**Category:** Deployment

**What goes wrong:** Models work perfectly in development/testing but fail consistently in production due to environment differences (rate limits, parallel execution, network latency, Redis state, job queue timing).

**Why it happens:**
- Dev testing uses sequential calls (one model at a time), prod uses parallel (10+ concurrent)
- Dev has unlimited API quota, prod hits rate limits after N requests
- Dev uses localhost Redis, prod uses networked Redis (latency differences)
- Dev uses small match count (1-5 matches), prod processes 50+ matches in batch
- BullMQ job scheduling differs between environments (dev immediate, prod delayed)

**Real example from research:**
> "Testing in development or staging often involves predefined datasets and scenarios that may not capture the full range of potential user interactions or uncover all the possible model shortcomings. In contrast, in production, language models encounter a wide range of real-world data and scenarios that may not have been fully covered in the training and validation stages." ([LeewayHertz LLM testing guide](https://www.leewayhertz.com/how-to-test-llms-in-production/))

**Project-specific risk:**
- Production uses BullMQ with delayed jobs (T-30m scheduling), dev may test immediately
- Prod has budget enforcement ($5/day limit), dev uses test API keys with higher limits
- Prod runs 17 leagues * ~10 matches/day * 42 models = ~7000 predictions/day
- Prod has Coolify/Nixpacks deployment (different Next.js build than local `npm run dev`)
- Turbopack in prod vs webpack in dev (circular dependency issues like quick-013)

**Known environment differences:**

| Aspect | Development | Production | Impact on Models |
|--------|-------------|------------|------------------|
| Parallelism | Sequential (1 at a time) | Parallel (10-20 concurrent) | Rate limits, timeout distribution |
| API Budget | Unlimited test key | $5/day enforced | Models disabled after budget exhausted |
| Redis | localhost (0.1ms latency) | networked (5-20ms) | Cache staleness, job timing |
| BullMQ | Immediate execution | Delayed jobs (T-30m) | Lineup availability, match state |
| Next.js | Dev server (`npm run dev`) | Turbopack production build | Circular deps, import resolution |
| Network | Localhost (fast) | Internet (variable) | Timeout rates, retry behavior |
| Match data | Small test set (5 matches) | Full production (50+ matches) | Batch size, job queue load |

**Prevention:**

1. **Production-like staging environment (MUST BUILD):**
   ```yaml
   # docker-compose.staging.yml
   services:
     redis:
       image: redis:7
       # Simulate network latency
       command: redis-server --slowlog-log-slower-than 1000

     postgres:
       image: postgres:16
       # Use prod-size dataset (not 5 test matches)
       volumes:
         - ./prod-data-snapshot.sql:/docker-entrypoint-initdb.d/init.sql

     app:
       build:
         context: .
         # Use production build (Turbopack)
         args:
           - NODE_ENV=production
       environment:
         # Use prod-like budget limits
         - DAILY_API_BUDGET=5.00
         # Use prod-like parallelism
         - BULLMQ_CONCURRENCY=10
   ```

2. **Production validation protocol (before marking "fixed"):**
   - ✅ Model works in dev (local testing)
   - ✅ Model works in staging (prod-like environment)
   - ✅ Model works in prod with single match (canary test)
   - ✅ Model works in prod with full match schedule (soak test)
   - ✅ Model works for 3 consecutive days without auto-disable
   - **Only then:** Mark model as "working" in coverage metrics

**Detection (warning signs):**
- "Works in dev" but fails in prod consistently
- Failure rate increases during peak match hours (parallel load)
- Rate limit errors only appear in prod logs
- Job queue backlog only in prod, never in dev
- Circular dependency errors only in prod build logs

**Remediation if caught:**
1. Stop trusting dev environment as validation
2. Build staging environment that mirrors prod (budget, parallelism, data size)
3. Implement canary deployment process (test in prod with limited traffic first)
4. Add prod-specific monitoring (rate limits, job timing, budget consumption)

---

## Moderate Pitfalls

Mistakes that cause delays, debugging time, or technical debt.

---

### Pitfall 6: Ignoring Budget Impact of Fallback Chains

**Risk:** MEDIUM | **Likelihood:** HIGH
**Category:** Cost management

**What goes wrong:** Fallback chains (Synthetic → Together AI) double or triple the cost per prediction without explicit tracking. Budget appears fine during testing but exhausts quickly in production under load.

**Why it happens:**
- Fallback triggers are logged but cost impact isn't calculated
- Budget tracking measures API calls, not "effective cost per prediction"
- Team focuses on success rate, not cost per success
- Fallback cost warning (COST-01) exists but isn't monitored actively

**Project-specific risk:**
- v2.5 implements fallback orchestrator (FALL-01 through FALL-06)
- Synthetic models fall back to Together equivalents automatically
- COST-01: "Fallback logs warning if >2x more expensive"
- COST-02: "Cost metadata tracked in prediction record"
- COST-03: "Daily fallback cost visible in admin dashboard"
- **But:** No budget enforcement that considers fallback costs

**Example cost calculation:**
```
Scenario: Kimi K2.5-Syn fails, falls back to Kimi K2.5-Together

Original attempt:
- Synthetic pricing: $0.40 prompt / $0.80 completion per 1M tokens
- 100 tokens prompt + 50 tokens completion = $0.000080

Fallback attempt:
- Together pricing: $0.60 prompt / $1.20 completion per 1M tokens
- Same token usage = $0.000120

Total cost: $0.000200 (2.5x more expensive than successful first attempt)

At 1000 predictions/day with 30% fallback rate:
- Without fallbacks: 1000 * $0.000080 = $0.08/day
- With fallbacks: (700 * $0.000080) + (300 * $0.000200) = $0.056 + $0.060 = $0.116/day
- 45% cost increase from fallbacks
```

**Prevention:**

1. **Effective cost per prediction metric:**
   ```typescript
   // Track total cost including fallbacks
   interface PredictionCost {
     modelId: string;
     attemptCount: number;
     originalCost: number;
     fallbackCost: number;
     totalCost: number;
     usedFallback: boolean;
   }
   ```

2. **Fallback cost ceiling:**
   ```typescript
   // Refuse fallback if cost increase > 3x
   async function callAPIWithFallback(...): Promise<FallbackAPIResult> {
     try {
       const response = await this.callAPI(systemPrompt, userPrompt);
       return { response, usedFallback: false };
     } catch (originalError) {
       const fallbackProvider = getFallbackProvider(this.id);

       if (!fallbackProvider) {
         throw originalError;
       }

       // Check cost increase
       const costIncrease =
         fallbackProvider.pricing.promptPer1M / this.pricing.promptPer1M;

       if (costIncrease > 3.0) {
         logger.error({
           originalModel: this.id,
           fallbackModel: fallbackProvider.id,
           costIncrease: `${costIncrease.toFixed(1)}x`,
         }, 'Fallback rejected: cost increase exceeds 3x ceiling');

         throw originalError; // Don't use expensive fallback
       }

       // Proceed with fallback...
     }
   }
   ```

**Detection (warning signs):**
- Budget exhausted early despite low prediction count
- COST-01 warnings appear frequently in logs
- Success rate is high but cost per prediction trending up
- Admin dashboard shows fallback rate > 25%

---

### Pitfall 7: Quality Validation Blindness (The Garbage Output Trap)

**Risk:** MEDIUM | **Likelihood:** MEDIUM
**Category:** Data quality

**What goes wrong:** Model produces technically valid predictions (JSON parses, schema matches) but outputs are nonsensical (always predicts 1-0, ignores team context, predicts 20-20 for every match). System marks model as "working" but predictions pollute leaderboard.

**Why it happens:**
- Success criteria focused on technical validity (JSON format, API success) not semantic quality
- No validation that predictions vary by match context
- No detection of "stuck" models that output same score regardless of input
- Small models (3B-7B) may memorize format but not understand task

**Real example from research:**
> "Hallucination detection can analyze internal attention kernel maps, hidden activations and output prediction probabilities of an LLM itself, using an auxiliary substitute model if white-box access is unavailable." ([GitHub: LLM hallucination detection](https://github.com/GaurangSriramanan/LLM_Check_Hallucination_Detection))

**Quality anti-patterns:**

1. **Constant predictions:** Always 1-0 regardless of context
2. **Draws only:** Every prediction is 1-1, 2-2, or 0-0
3. **Unrealistic scores:** Consistently predicts 8-7, 12-9, 20-15
4. **Context ignorance:** Top team vs bottom team → same prediction as evenly matched teams

**Prevention:**

1. **Diversity validation:**
   ```typescript
   // Check that model produces varied predictions
   function validatePredictionDiversity(
     predictions: Array<{ homeScore: number; awayScore: number }>
   ): boolean {
     const scoreStrings = predictions.map(p => `${p.homeScore}-${p.awayScore}`);
     const unique = new Set(scoreStrings);

     // If >50% of predictions are identical, model is stuck
     const mostCommon = scoreStrings
       .reduce((acc, score) => {
         acc[score] = (acc[score] || 0) + 1;
         return acc;
       }, {} as Record<string, number>);

     const maxCount = Math.max(...Object.values(mostCommon));
     const percentage = (maxCount / predictions.length) * 100;

     if (percentage > 50) {
       logger.warn({
         mostCommonScore: Object.entries(mostCommon).find(([_, count]) => count === maxCount)?.[0],
         percentage,
       }, 'Model failed diversity check - stuck on single prediction');
       return false;
     }

     return true;
   }
   ```

2. **Realism validation:**
   ```typescript
   // Check that predictions are football-realistic
   function validateRealism(homeScore: number, awayScore: number): boolean {
     const total = homeScore + awayScore;

     if (total > 10 || homeScore > 8 || awayScore > 8) {
       logger.warn({ homeScore, awayScore }, 'Unrealistic score detected');
       return false;
     }

     return true;
   }
   ```

**Detection (warning signs):**
- Model has 100% success rate but 0% accuracy on finished matches
- Leaderboard shows model always in last place despite no errors
- Logs show identical predictions across different matches
- Model produces valid JSON but predictions never vary

---

## Minor Pitfalls

Issues that cause annoyance but are easily fixable.

---

### Pitfall 8: Inadequate Logging for Per-Model Diagnosis

**What goes wrong:** Model fails but logs don't contain enough context to diagnose root cause. Team can't tell if failure is timeout, parse error, API issue, or bad response format.

**Prevention:**
- Include model ID, prompt variant, timeout used, response length, error type in all log entries
- Use structured logging (pino already in use) with consistent fields
- Log raw response on parse failures (truncated to 500 chars to avoid log bloat)

```typescript
logger.error({
  modelId: this.id,
  promptVariant: this.promptConfig.promptVariant,
  timeoutMs: this.promptConfig.timeoutMs,
  responseLength: rawResponse.length,
  responsePreview: rawResponse.substring(0, 500),
  errorType: error.name,
  errorMessage: error.message,
}, 'Prediction failed');
```

---

### Pitfall 9: No Audit Trail for Model Configuration Changes

**What goes wrong:** Model config changes frequently during debugging but no record exists of what was tried and when. Team forgets what config was tested, re-tests same config, wastes time.

**Prevention:**
- Track all config changes in git commit messages (atomic commits per model)
- Maintain `.planning/model-status.json` with change history
- Log config on every prediction attempt (can reconstruct what config was live when)

---

### Pitfall 10: Race Conditions in Model Config Changes

**What goes wrong:** Changing model configuration (timeout, prompt variant, response handler) while prediction jobs are already queued causes inconsistent behavior — some predictions use old config, some use new config, results are unpredictable.

**Why it happens:**
- BullMQ jobs are queued hours in advance (T-6h for analysis, T-30m for predictions)
- Provider instances are created at startup with config, changes require restart
- Job retries may use different config than original attempt
- No atomicity between config change and job queue flush

**Prevention:**

1. **Job queue flush protocol for config changes:**
   ```typescript
   // scripts/flush-prediction-queue.ts
   async function flushPredictionQueue() {
     const queue = getPredictionQueue();

     // 1. Pause queue (no new jobs processed)
     await queue.pause();

     // 2. Get all delayed jobs
     const delayed = await queue.getDelayed();

     // 3. Remove all delayed jobs
     await Promise.all(delayed.map(job => job.remove()));

     // 4. Resume queue
     await queue.resume();

     logger.info({
       flushedCount: delayed.length
     }, 'Prediction queue flushed for config change');
   }

   // Run before deploying config change
   // Then reschedule jobs with new config after deploy
   ```

2. **Config version tracking in jobs:**
   ```typescript
   // Add config version to job data
   interface PredictionJobData {
     matchId: string;
     modelId: string;
     configVersion: string; // e.g., "v2.5.1"
     promptVariant: PromptVariant;
     timeoutMs: number;
   }
   ```

**Detection (warning signs):**
- Config deployed but models still using old timeout (logs show old value)
- Success rate doesn't improve after config change (change not applied)
- Some jobs succeed, some fail with same model (config inconsistency)

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Diagnostic tooling | Building complex tooling instead of manual testing | Start with scripts, automate only if running >10 times |
| Per-model fixes | Whack-a-mole prompt tuning (Pitfall 1) | Regression test suite BEFORE fixing models |
| Validation | Trusting dev environment (Pitfall 5) | Build staging environment, prod-like testing |
| Budget tracking | Ignoring fallback costs (Pitfall 6) | Implement effective cost per prediction metric |
| Quality validation | Accepting garbage predictions (Pitfall 7) | Diversity + realism + context checks |

---

## Research Methodology

**Sources consulted:**

### High Confidence
- [Multi-provider LLM orchestration in production (DEV Community)](https://dev.to/ash_dubai/multi-provider-llm-orchestration-in-production-a-2026-guide-1g10)
- [LLM Tool-Calling in Production: Rate Limits, Retries (Medium)](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8)
- [Structured Outputs Guide (Agenta)](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Handle Invalid JSON Output for Small Size LLM (Medium)](https://watchsound.medium.com/handle-invalid-json-output-for-small-size-llm-a2dc455993bd)
- [LLM Testing in Production (LeewayHertz)](https://www.leewayhertz.com/how-to-test-llms-in-production/)
- [Structured Output (LangChain)](https://docs.langchain.com/oss/python/langchain/structured-output)
- Existing project files: `.planning/PROJECT.md`, `.planning/phases/40-model-specific-prompt-selection/40-RESEARCH.md`, `src/lib/llm/providers/base.ts`

### Medium Confidence
- [Provider fallbacks: Ensuring LLM availability (Statsig)](https://www.statsig.com/perspectives/providerfallbacksllmavailability)
- [Budget limits and alerts in LLM apps (Portkey)](https://portkey.ai/blog/budget-limits-and-alerts-in-llm-apps/)
- [Which LLMs Actually Produce Valid JSON (Medium)](https://medium.com/@lyx_62906/which-llms-actually-produce-valid-json-7c7b1a56c225)
- [LLM hallucination detection (GitHub)](https://github.com/GaurangSriramanan/LLM_Check_Hallucination_Detection)

### Low Confidence
- None — all critical claims verified with multiple sources or project context

**Research date:** 2026-02-07
**Valid until:** ~30 days (providers update models frequently, new issues emerge)

---

## Downstream Impact

How this research informs roadmap creation:

| Pitfall | Roadmap Implication |
|---------|---------------------|
| Whack-a-mole (1) | Phase 1: Build regression test suite BEFORE fixing models |
| Timeout escalation (2) | Phase 2: Implement timeout ceilings and budget monitoring |
| Unfixable models (3) | Phase 3: Define "unfixable" criteria, accept <100% if needed |
| JSON schema (4) | Phase 1: Add Zod validation to all parsing functions |
| Dev-prod divergence (5) | Phase 0: Build staging environment, prod-like testing |
| Race conditions (10) | Phase 2: Implement config versioning in jobs |
| Fallback costs (6) | Phase 2: Extend COST-03 with fallback cost breakdown |
| Quality validation (7) | Phase 3: Implement diversity/realism/context checks |

**Key insight:** Phases should be ordered:
1. **Foundations (regression tests, Zod validation, staging env)** — prevent making things worse
2. **Diagnosis (tooling to identify which models fail and why)** — understand the problem
3. **Fixes (per-model config, timeout tuning, prompt variants)** — solve incrementally
4. **Validation (quality checks, budget monitoring, prod soak testing)** — ensure solutions work

**Don't start with fixes — start with protection.**
