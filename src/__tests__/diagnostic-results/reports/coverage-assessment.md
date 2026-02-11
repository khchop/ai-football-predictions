# Phase 57 Coverage Assessment Report

**Generated:** 2026-02-08 11:58:32 UTC
**Total Models in Inventory:** 42
**Models Tested:** 42
**Target Success Rate:** 95%

## Executive Summary

| Metric | Value |
|--------|-------|
| Models Passing | 27/42 (64.3%) |
| Models Failing (Fixable) | 12 |
| Models Failing (Unfixable) | 3 |
| Models Skipped | 0 |
| Target (95%) | NOT MET |

**Result:** Success rate of 64.3% does NOT meet the Phase 57 target of 95%. Need 13 more model(s) passing to reach target.

## Model Coverage Matrix

| Model ID | Provider | Status | Fallback | Config | Category | Notes |
|----------|----------|--------|----------|--------|----------|-------|
| `deepseek-v3.2-syn` | synthetic | **FAIL-UNFIXABLE** | - | json-strict/extract-json | empty-response | Synthetic exclusive, no fallback, config already applied |
| `glm-4.7-syn` | synthetic | **FAIL-UNFIXABLE** | - | english-enforced/extract-json | api-error | Synthetic exclusive, no fallback, config already applied |
| `qwen3-235b-thinking-syn` | synthetic | **FAIL-UNFIXABLE** | - | thinking-stripped/strip-thinking-tags | empty-response | Synthetic exclusive, no fallback, config already applied |
| `cogito-109b-moe` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `cogito-405b` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `cogito-70b` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `deepseek-r1-0528-syn` | synthetic | **FAIL-FIXABLE** | -> deepseek-r1 | thinking-stripped/strip-thinking-tags | empty-response | Has fallback to deepseek-r1 |
| `gemma-3n-e4b` | together | **FAIL-FIXABLE** | - | default | empty-response | Together AI model - prompt/handler tuning available |
| `kimi-k2-instruct` | together | **FAIL-FIXABLE** | - | default | empty-response | Together AI model - prompt/handler tuning available |
| `kimi-k2.5-syn` | synthetic | **FAIL-FIXABLE** | -> kimi-k2-instruct | default | empty-response | Has fallback to kimi-k2-instruct |
| `llama-3-70b-reference` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `llama-3.1-405b-turbo` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `llama-4-scout` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `nemotron-nano-9b-v2` | together | **FAIL-FIXABLE** | - | default | empty-response | Together AI model - prompt/handler tuning available |
| `qwen2.5-72b-turbo` | together | **FAIL-FIXABLE** | - | default | api-error | Together AI model - prompt/handler tuning available |
| `cogito-671b` | together | **PASS** | - | default | - | Valid prediction produced |
| `deepseek-r1` | together | **PASS** | - | thinking-stripped/strip-thinking-tags | - | Valid prediction produced |
| `deepseek-v3-0324-syn` | synthetic | **PASS** | - | default | - | Valid prediction produced |
| `deepseek-v3.1` | together | **PASS** | - | default | - | Valid prediction produced |
| `deepseek-v3.1-terminus-syn` | synthetic | **PASS** | - | default | - | Valid prediction produced |
| `glm-4.6-syn` | synthetic | **PASS** | - | english-enforced/default | - | Valid prediction produced |
| `gpt-oss-120b-syn` | synthetic | **PASS** | - | json-strict/extract-json | - | Valid prediction produced |
| `gpt-oss-20b` | together | **PASS** | - | default | - | Valid prediction produced |
| `kimi-k2-0905` | together | **PASS** | - | default | - | Valid prediction produced |
| `kimi-k2-thinking-syn` | synthetic | **PASS** | -> kimi-k2-instruct | thinking-stripped/strip-thinking-tags | - | Valid prediction produced |
| `llama-3-8b-lite` | together | **PASS** | - | default | - | Valid prediction produced |
| `llama-3.1-8b-turbo` | together | **PASS** | - | default | - | Valid prediction produced |
| `llama-3.2-3b-turbo` | together | **PASS** | - | default | - | Valid prediction produced |
| `llama-3.3-70b-turbo` | together | **PASS** | - | default | - | Valid prediction produced |
| `llama-4-maverick` | together | **PASS** | - | default | - | Valid prediction produced |
| `marin-8b-instruct` | together | **PASS** | - | default | - | Valid prediction produced |
| `minimax-m2-syn` | synthetic | **PASS** | - | default | - | Valid prediction produced |
| `minimax-m2.1-syn` | synthetic | **PASS** | - | default | - | Valid prediction produced |
| `ministral-3-14b` | together | **PASS** | - | default | - | Valid prediction produced |
| `mistral-7b-v0.2` | together | **PASS** | - | default | - | Valid prediction produced |
| `mistral-7b-v0.3` | together | **PASS** | - | default | - | Valid prediction produced |
| `mistral-small-3-24b` | together | **PASS** | - | default | - | Valid prediction produced |
| `qwen2.5-7b-turbo` | together | **PASS** | - | default | - | Valid prediction produced |
| `qwen3-235b-instruct` | together | **PASS** | - | default | - | Valid prediction produced |
| `qwen3-coder-480b-syn` | synthetic | **PASS** | - | default | - | Valid prediction produced |
| `qwen3-next-80b-instruct` | together | **PASS** | - | default | - | Valid prediction produced |
| `rnj-1-instruct` | together | **PASS** | - | default | - | Valid prediction produced |

## Failure Analysis

### API-ERROR (8 models)

**`qwen2.5-72b-turbo`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {
  "id": "oWYc9Zd-6Ng1vN-9caaf3ac6ad1e532",
  "error": {
    "message": "Unable to access non-serverless model Qwen/Qwen2.5-72B-Instruct-Turbo. Please visit https://api.together.ai/models/Qwen/Qwen2.5-72B-Instruct-Turbo to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`llama-4-scout`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {
  "id": "oWYc9Lb-2kFHot-9caaf3ac7a5fe51d",
  "error": {
    "message": "Unable to access non-serverless model meta-llama/Llama-4-Scout-17B-16E-Instruct. Please visit https://api.together.ai/models/meta-llama/Llama-4-Scout-17B-16E-Instruct to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`llama-3.1-405b-turbo`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** CRITICAL
- **Error:** API error: {
  "id": "oWYc9Xx-3pDw3Z-9caaf3b18fbbc760",
  "error": {
    "message": "Unable to access non-serverless model meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo. Please visit https://api.together.ai/models/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`llama-3-70b-reference`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {
  "id": "oWYc9br-62bZhn-9caaf3b27bdfe51d",
  "error": {
    "message": "Unable to access non-serverless model meta-llama/Llama-3-70b-chat-hf. Please visit https://api.together.ai/models/meta-llama/Llama-3-70b-chat-hf to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`cogito-70b`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {
  "id": "oWYc9wu-4YNCb4-9caaf3b9d910c760",
  "error": {
    "message": "Unable to access non-serverless model deepcogito/cogito-v2-preview-llama-70B. Please visit https://api.together.ai/models/deepcogito/cogito-v2-preview-llama-70B to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`cogito-109b-moe`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {
  "id": "oWYcA1T-62bZhn-9caaf3bafc02c760",
  "error": {
    "message": "Unable to access non-serverless model deepcogito/cogito-v2-preview-llama-109B-MoE. Please visit https://api.together.ai/models/deepcogito/cogito-v2-preview-llama-109B-MoE to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`cogito-405b`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** CRITICAL
- **Error:** API error: {
  "id": "oWYcA5c-zqrih-9caaf3bc9975c760",
  "error": {
    "message": "Unable to access non-serverless model deepcogito/cogito-v2-preview-llama-405B. Please visit https://api.together.ai/models/deepcogito/cogito-v2-preview-llama-405B to create and start a new dedicated endpoint for the model.",
    "type": "invalid_request_error",
    "param": null,
    "code": "model_not_available"
  }
}
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Check API service status, reduce concurrency, or implement circuit breaker

**`glm-4.7-syn`** (synthetic)
- **Status:** FAIL-UNFIXABLE
- **Severity:** MEDIUM
- **Error:** API error: {"error":"response_format.type = json_schema and json_object are currently not supported for GLM 4.7 due to a structured output bug in SGLang. A fix is being worked on."}
- **Fallback Available:** No
- **Current Config:** english-enforced + extract-json
- **Mitigation:** Auto-disable after consecutive failures; document as accepted limitation

### EMPTY-RESPONSE (7 models)

**`kimi-k2-instruct`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** No prediction returned
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)

**`nemotron-nano-9b-v2`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** No valid JSON found in response (preview: {
  "match_id": "diag-standard",
  "home_score": 1,
  "away_score": 1
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
...)
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)

**`gemma-3n-e4b`** (together)
- **Status:** FAIL-FIXABLE
- **Severity:** LOW
- **Error:** No valid predictions parsed
- **Fallback Available:** No
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)

**`deepseek-r1-0528-syn`** (synthetic)
- **Status:** FAIL-FIXABLE
- **Severity:** HIGH
- **Error:** No valid predictions parsed
- **Fallback Available:** Yes (-> deepseek-r1)
- **Current Config:** thinking-stripped + strip-thinking-tags
- **Mitigation:** Fallback to `deepseek-r1` on failure

**`qwen3-235b-thinking-syn`** (synthetic)
- **Status:** FAIL-UNFIXABLE
- **Severity:** HIGH
- **Error:** No valid JSON found in response (preview: Okay, let's tackle this prediction. So, the match is Everton vs Crystal Palace in the Premier League...)
- **Fallback Available:** No
- **Current Config:** thinking-stripped + strip-thinking-tags
- **Mitigation:** Auto-disable after consecutive failures; document as accepted limitation

**`deepseek-v3.2-syn`** (synthetic)
- **Status:** FAIL-UNFIXABLE
- **Severity:** MEDIUM
- **Error:** No valid JSON found in response (preview: {"match_id": "uuid1", "home_score": X, "away_score": Y}...)
- **Fallback Available:** No
- **Current Config:** json-strict + extract-json
- **Mitigation:** Auto-disable after consecutive failures; document as accepted limitation

**`kimi-k2.5-syn`** (synthetic)
- **Status:** FAIL-FIXABLE
- **Severity:** MEDIUM
- **Error:** No valid JSON found in response (preview:  The user wants a prediction for a specific match: Everton vs Crystal Palace in the Premier League.
...)
- **Fallback Available:** Yes (-> kimi-k2-instruct)
- **Current Config:** Default (BASE + DEFAULT)
- **Mitigation:** Fallback to `kimi-k2-instruct` on failure

## Unfixable / Skipped Models

### Unfixable (3 models)

These models have no Together AI fallback, special configs already applied, and still fail.

#### Model: qwen3-235b-thinking-syn
- **Provider:** Synthetic
- **Failure Category:** empty-response
- **Root Cause:** No valid JSON found in response (preview: Okay, let's tackle this prediction. So, the match is Everton vs Crystal Palace in the Premier League...)
- **Fallback Available:** No (Synthetic exclusive, no Together AI equivalent)
- **Config Applied:** thinking-stripped + strip-thinking-tags
- **Severity:** HIGH
- **Mitigation Plan:**
  - Auto-disable after 5 consecutive failures
  - Admin notification when disabled
  - Redirect predictions to alternative models in same tier
- **Status:** SKIP (accepted limitation)

#### Model: deepseek-v3.2-syn
- **Provider:** Synthetic
- **Failure Category:** empty-response
- **Root Cause:** No valid JSON found in response (preview: {"match_id": "uuid1", "home_score": X, "away_score": Y}...)
- **Fallback Available:** No (Synthetic exclusive, no Together AI equivalent)
- **Config Applied:** json-strict + extract-json
- **Severity:** MEDIUM
- **Mitigation Plan:**
  - Auto-disable after 5 consecutive failures
  - Admin notification when disabled
  - Redirect predictions to alternative models in same tier
- **Status:** SKIP (accepted limitation)

#### Model: glm-4.7-syn
- **Provider:** Synthetic
- **Failure Category:** api-error
- **Root Cause:** API error: {"error":"response_format.type = json_schema and json_object are currently not supported for GLM 4.7 due to a structured output bug in SGLang. A fix is being worked on."}
- **Fallback Available:** No (Synthetic exclusive, no Together AI equivalent)
- **Config Applied:** english-enforced + extract-json
- **Severity:** MEDIUM
- **Mitigation Plan:**
  - Auto-disable after 5 consecutive failures
  - Admin notification when disabled
  - Redirect predictions to alternative models in same tier
- **Status:** SKIP (accepted limitation)

## Recommendations

### Priority Actions

**1. Fix Critical/High Severity Failures (4 models)**
   - `llama-3.1-405b-turbo`: api-error - fixable
   - `cogito-405b`: api-error - fixable
   - `deepseek-r1-0528-syn`: empty-response - fixable
   - `qwen3-235b-thinking-syn`: empty-response - needs acceptance

**2. Address Fixable Failures (12 models)**
   Apply recommended fixes from Failure Analysis section above.
   Re-run diagnostics after each fix to measure improvement.

**3. Accept Unfixable Limitations (3 models)**
   Document in production runbook. Ensure auto-disable is configured.

---

*Report generated by `scripts/diagnostic/generate-coverage-report.ts`*
*Raw diagnostic data: `src/__tests__/diagnostic-results/raw-responses/`*
*Run `npm run diagnose` to refresh diagnostic results before regenerating this report.*
