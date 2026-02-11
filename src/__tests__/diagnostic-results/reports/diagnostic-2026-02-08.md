# Diagnostic Report - 2026-02-08

**Generated:** 2026-02-08 11:58:17 UTC
**Total Models Tested:** 42

## Summary

**Success Rate:** 27/42 (64.3%)

- **Passed:** 27 models
- **Failed:** 15 models

### Failure Distribution

- **empty-response**: 7 models
- **api-error**: 8 models

## Failure Breakdown by Category

### API-ERROR (8 models)

**Affected Models:**
- `qwen2.5-72b-turbo`
- `llama-4-scout`
- `llama-3.1-405b-turbo`
- `llama-3-70b-reference`
- `cogito-70b`
- `cogito-109b-moe`
- `cogito-405b`
- `glm-4.7-syn`

**Recommended Fix:**
```
Check API service status, reduce concurrency, or implement circuit breaker
```

**Sample Errors:**
- `qwen2.5-72b-turbo`: API error: {
  "id": "oWYc9Zd-6Ng1vN-9caaf3ac6ad1e532",
  "error": {
    "message": "Unable to acces...
- `llama-4-scout`: API error: {
  "id": "oWYc9Lb-2kFHot-9caaf3ac7a5fe51d",
  "error": {
    "message": "Unable to acces...
- `llama-3.1-405b-turbo`: API error: {
  "id": "oWYc9Xx-3pDw3Z-9caaf3b18fbbc760",
  "error": {
    "message": "Unable to acces...

### EMPTY-RESPONSE (7 models)

**Affected Models:**
- `kimi-k2-instruct`
- `nemotron-nano-9b-v2`
- `gemma-3n-e4b`
- `deepseek-r1-0528-syn`
- `qwen3-235b-thinking-syn`
- `deepseek-v3.2-syn`
- `kimi-k2.5-syn`

**Recommended Fix:**
```
Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)
```

**Sample Errors:**
- `kimi-k2-instruct`: No prediction returned
- `nemotron-nano-9b-v2`: No valid JSON found in response (preview: {
  "match_id": "diag-standard",
  "home_score": 1,
  "awa...
- `gemma-3n-e4b`: No valid predictions parsed

## Per-Model Results

| Model | Provider | Status | Duration | Category | Error |
|-------|----------|--------|----------|----------|-------|
| `llama-3.1-405b-turbo` | together | FAIL | 0.1s | api-error | API error: {
  "id": "oWYc9Xx-3pDw3Z-9caaf3b18fbbc... |
| `cogito-70b` | together | FAIL | 0.2s | api-error | API error: {
  "id": "oWYc9wu-4YNCb4-9caaf3b9d910c... |
| `llama-3-70b-reference` | together | FAIL | 0.2s | api-error | API error: {
  "id": "oWYc9br-62bZhn-9caaf3b27bdfe... |
| `cogito-405b` | together | FAIL | 0.3s | api-error | API error: {
  "id": "oWYcA5c-zqrih-9caaf3bc9975c7... |
| `cogito-109b-moe` | together | FAIL | 0.3s | api-error | API error: {
  "id": "oWYcA1T-62bZhn-9caaf3bafc02c... |
| `llama-4-scout` | together | FAIL | 0.3s | api-error | API error: {
  "id": "oWYc9Lb-2kFHot-9caaf3ac7a5fe... |
| `qwen2.5-72b-turbo` | together | FAIL | 0.4s | api-error | API error: {
  "id": "oWYc9Zd-6Ng1vN-9caaf3ac6ad1e... |
| `glm-4.7-syn` | synthetic | FAIL | 0.5s | api-error | API error: {"error":"response_format.type = json_s... |
| `gemma-3n-e4b` | together | FAIL | 0.6s | empty-response | No valid predictions parsed |
| `kimi-k2-instruct` | together | FAIL | 1.2s | empty-response | No prediction returned |
| `deepseek-r1-0528-syn` | synthetic | FAIL | 1.5s | empty-response | No valid predictions parsed |
| `nemotron-nano-9b-v2` | together | FAIL | 7.8s | empty-response | No valid JSON found in response (preview: {
  "mat... |
| `deepseek-v3.2-syn` | synthetic | FAIL | 8.8s | empty-response | No valid JSON found in response (preview: {"match_... |
| `kimi-k2.5-syn` | synthetic | FAIL | 13.0s | empty-response | No valid JSON found in response (preview:  The use... |
| `qwen3-235b-thinking-syn` | synthetic | FAIL | 15.4s | empty-response | No valid JSON found in response (preview: Okay, le... |
| `rnj-1-instruct` | together | PASS | 0.4s | - | - |
| `llama-3.1-8b-turbo` | together | PASS | 0.4s | - | - |
| `qwen3-next-80b-instruct` | together | PASS | 0.5s | - | - |
| `marin-8b-instruct` | together | PASS | 0.6s | - | - |
| `mistral-7b-v0.3` | together | PASS | 0.6s | - | - |
| `llama-3.3-70b-turbo` | together | PASS | 0.6s | - | - |
| `qwen3-235b-instruct` | together | PASS | 0.7s | - | - |
| `mistral-small-3-24b` | together | PASS | 0.8s | - | - |
| `llama-4-maverick` | together | PASS | 0.8s | - | - |
| `cogito-671b` | together | PASS | 1.0s | - | - |
| `qwen3-coder-480b-syn` | synthetic | PASS | 1.2s | - | - |
| `llama-3-8b-lite` | together | PASS | 1.2s | - | - |
| `mistral-7b-v0.2` | together | PASS | 1.2s | - | - |
| `kimi-k2-0905` | together | PASS | 1.2s | - | - |
| `deepseek-r1` | together | PASS | 1.2s | - | - |
| `deepseek-v3.1-terminus-syn` | synthetic | PASS | 1.6s | - | - |
| `ministral-3-14b` | together | PASS | 1.6s | - | - |
| `kimi-k2-thinking-syn` | synthetic | PASS | 1.8s | - | - |
| `deepseek-v3-0324-syn` | synthetic | PASS | 1.8s | - | - |
| `qwen2.5-7b-turbo` | together | PASS | 3.6s | - | - |
| `llama-3.2-3b-turbo` | together | PASS | 3.7s | - | - |
| `minimax-m2-syn` | synthetic | PASS | 3.7s | - | - |
| `gpt-oss-120b-syn` | synthetic | PASS | 4.2s | - | - |
| `minimax-m2.1-syn` | synthetic | PASS | 4.5s | - | - |
| `gpt-oss-20b` | together | PASS | 5.0s | - | - |
| `glm-4.6-syn` | synthetic | PASS | 7.8s | - | - |
| `deepseek-v3.1` | together | PASS | 23.5s | - | - |

## Raw Responses

Full diagnostic results with raw LLM responses saved to:
`src/__tests__/diagnostic-results/raw-responses/`

Each model has a JSON file with complete response data for debugging.
