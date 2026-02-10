#!/usr/bin/env npx tsx
/**
 * Model Diagnostic Script
 *
 * Tests each LLM model individually with a simple prediction prompt
 * to identify what's failing and why.
 *
 * Usage:
 *   npx tsx scripts/diagnose-models.ts              # Test all models
 *   npx tsx scripts/diagnose-models.ts --provider together  # Test Together AI only
 *   npx tsx scripts/diagnose-models.ts --provider synthetic # Test Synthetic only
 *   npx tsx scripts/diagnose-models.ts --model deepseek-r1  # Test one model
 *   npx tsx scripts/diagnose-models.ts --db           # Show DB health data only (no API calls)
 */

import 'dotenv/config';

// Minimal test prompt - very simple so parsing shouldn't be the bottleneck
const TEST_SYSTEM_PROMPT = `You are a football prediction AI. Respond with ONLY valid JSON, no other text.

OUTPUT FORMAT:
[{"match_id": "test-match-1", "home_score": X, "away_score": Y}]`;

const TEST_USER_PROMPT = `Predict the score for:
[1] match_id: "test-match-1"
    Manchester City vs Arsenal | Premier League | 2026-02-15 15:00 UTC
    Form: H=WWDWW (8GF/3GA) | A=WDWWL (7GF/4GA)
    H2H (5): 3W-1D-1L (last 5: 2-1, 1-1, 3-0, 0-1, 2-0)
    Table: Man City 2nd (45pts, +28GD) | Arsenal 1st (48pts, +32GD)

---
JSON: [{"match_id": "...", "home_score": X, "away_score": Y}]`;

interface TestResult {
  modelId: string;
  displayName: string;
  provider: string;
  status: 'success' | 'api_error' | 'parse_error' | 'timeout' | 'no_api_key';
  responseTimeMs: number;
  error?: string;
  rawResponsePreview?: string;
  parsedPrediction?: { home: number; away: number };
  httpStatus?: number;
}

// Direct API test for Together AI
async function testTogetherModel(
  modelId: string,
  modelName: string,
  displayName: string,
  promptConfig?: { promptVariant?: string; responseHandler?: string; timeoutMs?: number }
): Promise<TestResult> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    return { modelId, displayName, provider: 'together', status: 'no_api_key', responseTimeMs: 0, error: 'TOGETHER_API_KEY not set' };
  }

  const start = Date.now();
  const timeout = promptConfig?.timeoutMs || 30000; // 30s default for testing

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: TEST_USER_PROMPT },
        ],
        temperature: 0.5,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error body');
      return {
        modelId,
        displayName,
        provider: 'together',
        status: 'api_error',
        responseTimeMs: elapsed,
        error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        httpStatus: response.status,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const elapsed2 = Date.now() - start;

    // Try to parse the prediction
    try {
      const cleaned = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      let parsed: any;
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      } else {
        parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) parsed = [parsed];
      }

      const pred = parsed[0];
      const home = pred?.home_score ?? pred?.homeScore ?? pred?.home;
      const away = pred?.away_score ?? pred?.awayScore ?? pred?.away;

      if (home !== undefined && away !== undefined) {
        return {
          modelId,
          displayName,
          provider: 'together',
          status: 'success',
          responseTimeMs: elapsed2,
          parsedPrediction: { home: Number(home), away: Number(away) },
          rawResponsePreview: content.slice(0, 200),
        };
      }

      return {
        modelId,
        displayName,
        provider: 'together',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: 'Could not extract home_score/away_score from response',
        rawResponsePreview: content.slice(0, 500),
      };
    } catch (parseErr) {
      return {
        modelId,
        displayName,
        provider: 'together',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: parseErr instanceof Error ? parseErr.message : 'Parse error',
        rawResponsePreview: content.slice(0, 500),
      };
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      return {
        modelId,
        displayName,
        provider: 'together',
        status: 'timeout',
        responseTimeMs: elapsed,
        error: `Timeout after ${timeout}ms`,
      };
    }

    return {
      modelId,
      displayName,
      provider: 'together',
      status: 'api_error',
      responseTimeMs: elapsed,
      error: errMsg.slice(0, 500),
    };
  }
}

// Direct API test for Synthetic.new
async function testSyntheticModel(
  modelId: string,
  modelName: string,
  displayName: string,
  promptConfig?: { promptVariant?: string; responseHandler?: string; timeoutMs?: number }
): Promise<TestResult> {
  const apiKey = process.env.SYNTHETIC_API_KEY;
  if (!apiKey) {
    return { modelId, displayName, provider: 'synthetic', status: 'no_api_key', responseTimeMs: 0, error: 'SYNTHETIC_API_KEY not set' };
  }

  const start = Date.now();
  const timeout = promptConfig?.timeoutMs || 45000; // 45s for synthetic (they can be slow)

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://api.synthetic.new/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: TEST_USER_PROMPT },
        ],
        temperature: 0.5,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error body');
      return {
        modelId,
        displayName,
        provider: 'synthetic',
        status: 'api_error',
        responseTimeMs: elapsed,
        error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        httpStatus: response.status,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const elapsed2 = Date.now() - start;

    // Try to parse
    try {
      const cleaned = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      let parsed: any;
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      } else {
        parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) parsed = [parsed];
      }

      const pred = parsed[0];
      const home = pred?.home_score ?? pred?.homeScore ?? pred?.home;
      const away = pred?.away_score ?? pred?.awayScore ?? pred?.away;

      if (home !== undefined && away !== undefined) {
        return {
          modelId,
          displayName,
          provider: 'synthetic',
          status: 'success',
          responseTimeMs: elapsed2,
          parsedPrediction: { home: Number(home), away: Number(away) },
          rawResponsePreview: content.slice(0, 200),
        };
      }

      return {
        modelId,
        displayName,
        provider: 'synthetic',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: 'Could not extract home_score/away_score',
        rawResponsePreview: content.slice(0, 500),
      };
    } catch (parseErr) {
      return {
        modelId,
        displayName,
        provider: 'synthetic',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: parseErr instanceof Error ? parseErr.message : 'Parse error',
        rawResponsePreview: content.slice(0, 500),
      };
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      return {
        modelId,
        displayName,
        provider: 'synthetic',
        status: 'timeout',
        responseTimeMs: elapsed,
        error: `Timeout after ${timeout}ms`,
      };
    }

    return {
      modelId,
      displayName,
      provider: 'synthetic',
      status: 'api_error',
      responseTimeMs: elapsed,
      error: errMsg.slice(0, 500),
    };
  }
}

// Direct API test for OpenRouter
async function testOpenRouterModel(
  modelId: string,
  modelName: string,
  displayName: string,
  promptConfig?: { promptVariant?: string; responseHandler?: string; timeoutMs?: number }
): Promise<TestResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { modelId, displayName, provider: 'openrouter', status: 'no_api_key', responseTimeMs: 0, error: 'OPENROUTER_API_KEY not set' };
  }

  const start = Date.now();
  const timeout = promptConfig?.timeoutMs || 30000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://kroam.xyz',
        'X-Title': 'BettingSoccer Diagnostic',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: TEST_USER_PROMPT },
        ],
        temperature: 0.5,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error body');
      return {
        modelId,
        displayName,
        provider: 'openrouter',
        status: 'api_error',
        responseTimeMs: elapsed,
        error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        httpStatus: response.status,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const elapsed2 = Date.now() - start;

    try {
      const cleaned = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      let parsed: any;
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      } else {
        parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) parsed = [parsed];
      }

      const pred = parsed[0];
      const home = pred?.home_score ?? pred?.homeScore ?? pred?.home;
      const away = pred?.away_score ?? pred?.awayScore ?? pred?.away;

      if (home !== undefined && away !== undefined) {
        return {
          modelId,
          displayName,
          provider: 'openrouter',
          status: 'success',
          responseTimeMs: elapsed2,
          parsedPrediction: { home: Number(home), away: Number(away) },
          rawResponsePreview: content.slice(0, 200),
        };
      }

      return {
        modelId,
        displayName,
        provider: 'openrouter',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: 'Could not extract home_score/away_score',
        rawResponsePreview: content.slice(0, 500),
      };
    } catch (parseErr) {
      return {
        modelId,
        displayName,
        provider: 'openrouter',
        status: 'parse_error',
        responseTimeMs: elapsed2,
        error: parseErr instanceof Error ? parseErr.message : 'Parse error',
        rawResponsePreview: content.slice(0, 500),
      };
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      return {
        modelId,
        displayName,
        provider: 'openrouter',
        status: 'timeout',
        responseTimeMs: elapsed,
        error: `Timeout after ${timeout}ms`,
      };
    }

    return {
      modelId,
      displayName,
      provider: 'openrouter',
      status: 'api_error',
      responseTimeMs: elapsed,
      error: errMsg.slice(0, 500),
    };
  }
}

// All models to test (from providers/together.ts, providers/synthetic.ts, providers/openrouter.ts)
interface ModelDef {
  id: string;
  model: string;
  displayName: string;
  provider: 'together' | 'synthetic' | 'openrouter';
  promptConfig?: { promptVariant?: string; responseHandler?: string; timeoutMs?: number };
}

const MODELS: ModelDef[] = [
  // Together AI (30 models)
  { id: 'deepseek-v3.1', model: 'deepseek-ai/DeepSeek-V3.1', displayName: 'DeepSeek V3.1', provider: 'together' },
  { id: 'deepseek-r1', model: 'deepseek-ai/DeepSeek-R1', displayName: 'DeepSeek R1', provider: 'together', promptConfig: { timeoutMs: 120000 } },
  { id: 'kimi-k2-0905', model: 'moonshotai/Kimi-K2-Instruct-0905', displayName: 'Kimi K2 0905', provider: 'together' },
  { id: 'kimi-k2-instruct', model: 'moonshotai/Kimi-K2-Instruct', displayName: 'Kimi K2 Instruct', provider: 'together' },
  { id: 'kimi-k2.5', model: 'moonshotai/Kimi-K2.5', displayName: 'Kimi K2.5', provider: 'together' },
  { id: 'qwen3-235b-instruct', model: 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput', displayName: 'Qwen3 235B', provider: 'together' },
  { id: 'qwen3-next-80b-instruct', model: 'Qwen/Qwen3-Next-80B-A3B-Instruct', displayName: 'Qwen3 Next 80B', provider: 'together' },
  { id: 'qwen2.5-7b-turbo', model: 'Qwen/Qwen2.5-7B-Instruct-Turbo', displayName: 'Qwen 2.5 7B', provider: 'together' },
  { id: 'qwen2.5-72b-turbo', model: 'Qwen/Qwen2.5-72B-Instruct-Turbo', displayName: 'Qwen 2.5 72B', provider: 'together' },
  { id: 'llama-4-maverick', model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', displayName: 'Llama 4 Maverick', provider: 'together' },
  { id: 'llama-4-scout', model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', displayName: 'Llama 4 Scout', provider: 'together' },
  { id: 'llama-3.3-70b-turbo', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', displayName: 'Llama 3.3 70B', provider: 'together' },
  { id: 'llama-3.1-8b-turbo', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', displayName: 'Llama 3.1 8B', provider: 'together' },
  { id: 'llama-3.1-405b-turbo', model: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', displayName: 'Llama 3.1 405B Turbo', provider: 'together' },
  { id: 'llama-3.2-3b-turbo', model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', displayName: 'Llama 3.2 3B', provider: 'together' },
  { id: 'llama-3-8b-lite', model: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite', displayName: 'Llama 3 8B Lite', provider: 'together' },
  { id: 'llama-3-70b-reference', model: 'meta-llama/Llama-3-70b-chat-hf', displayName: 'Llama 3 70B Ref', provider: 'together' },
  { id: 'gpt-oss-20b', model: 'openai/gpt-oss-20b', displayName: 'GPT-OSS 20B', provider: 'together' },
  { id: 'cogito-70b', model: 'deepcogito/cogito-v2-preview-llama-70B', displayName: 'Cogito v2 70B', provider: 'together' },
  { id: 'cogito-109b-moe', model: 'deepcogito/cogito-v2-preview-llama-109B-MoE', displayName: 'Cogito 109B MoE', provider: 'together' },
  { id: 'cogito-405b', model: 'deepcogito/cogito-v2-preview-llama-405B', displayName: 'Cogito v2 405B', provider: 'together' },
  { id: 'cogito-671b', model: 'deepcogito/cogito-v2-1-671b', displayName: 'Cogito v2.1 671B', provider: 'together' },
  { id: 'ministral-3-14b', model: 'mistralai/Ministral-3-14B-Instruct-2512', displayName: 'Ministral 3 14B', provider: 'together' },
  { id: 'mistral-small-3-24b', model: 'mistralai/Mistral-Small-24B-Instruct-2501', displayName: 'Mistral Small 3 24B', provider: 'together' },
  { id: 'mistral-7b-v0.2', model: 'mistralai/Mistral-7B-Instruct-v0.2', displayName: 'Mistral 7B v0.2', provider: 'together' },
  { id: 'mistral-7b-v0.3', model: 'mistralai/Mistral-7B-Instruct-v0.3', displayName: 'Mistral 7B v0.3', provider: 'together' },
  { id: 'nemotron-nano-9b-v2', model: 'nvidia/NVIDIA-Nemotron-Nano-9B-v2', displayName: 'Nemotron Nano 9B', provider: 'together' },
  { id: 'gemma-3n-e4b', model: 'google/gemma-3n-E4B-it', displayName: 'Gemma 3n E4B', provider: 'together' },
  { id: 'rnj-1-instruct', model: 'essentialai/rnj-1-instruct', displayName: 'Rnj-1 Instruct', provider: 'together' },
  { id: 'marin-8b-instruct', model: 'marin-community/marin-8b-instruct', displayName: 'Marin 8B', provider: 'together' },

  // Synthetic.new (11 models)
  { id: 'qwen3-235b-thinking', model: 'hf:Qwen/Qwen3-235B-A22B-Thinking-2507', displayName: 'Qwen3 235B Thinking', provider: 'synthetic', promptConfig: { timeoutMs: 120000 } },
  { id: 'deepseek-v3-0324', model: 'hf:deepseek-ai/DeepSeek-V3-0324', displayName: 'DeepSeek V3 0324', provider: 'synthetic' },
  { id: 'deepseek-v3.1-terminus', model: 'hf:deepseek-ai/DeepSeek-V3.1-Terminus', displayName: 'DeepSeek V3.1 Terminus', provider: 'synthetic' },
  { id: 'deepseek-v3.2', model: 'hf:deepseek-ai/DeepSeek-V3.2', displayName: 'DeepSeek V3.2', provider: 'synthetic', promptConfig: { timeoutMs: 45000 } },
  { id: 'minimax-m2', model: 'hf:MiniMaxAI/MiniMax-M2', displayName: 'MiniMax M2', provider: 'synthetic' },
  { id: 'minimax-m2.1', model: 'hf:MiniMaxAI/MiniMax-M2.1', displayName: 'MiniMax M2.1', provider: 'synthetic' },
  { id: 'glm-4.6', model: 'hf:zai-org/GLM-4.6', displayName: 'GLM 4.6', provider: 'synthetic', promptConfig: { timeoutMs: 60000 } },
  { id: 'glm-4.7', model: 'hf:zai-org/GLM-4.7', displayName: 'GLM 4.7', provider: 'synthetic', promptConfig: { timeoutMs: 60000 } },
  { id: 'qwen3-coder-480b', model: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct', displayName: 'Qwen3 Coder 480B', provider: 'synthetic' },
  { id: 'gpt-oss-120b', model: 'hf:openai/gpt-oss-120b', displayName: 'GPT-OSS 120B', provider: 'synthetic', promptConfig: { timeoutMs: 45000 } },
  { id: 'kimi-k2.5-syn', model: 'hf:moonshotai/Kimi-K2.5', displayName: 'Kimi K2.5 (Syn)', provider: 'synthetic' },

  // OpenRouter primary-only models (2)
  { id: 'glm-4.7-flash', model: 'z-ai/glm-4.7-flash', displayName: 'GLM 4.7 Flash', provider: 'openrouter', promptConfig: { timeoutMs: 60000 } },
  { id: 'deepseek-r1-0528', model: 'deepseek/deepseek-r1-0528', displayName: 'DeepSeek R1 0528', provider: 'openrouter', promptConfig: { timeoutMs: 120000 } },
];

async function runDiagnostics(filter?: { provider?: string; model?: string }) {
  console.log('\n====================================');
  console.log('  MODEL DIAGNOSTIC REPORT');
  console.log(`  ${new Date().toISOString()}`);
  console.log('====================================\n');

  // Check API keys
  const keys = {
    together: !!process.env.TOGETHER_API_KEY,
    synthetic: !!process.env.SYNTHETIC_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
  console.log('API Keys:');
  console.log(`  Together AI: ${keys.together ? 'SET' : 'MISSING'}`);
  console.log(`  Synthetic:   ${keys.synthetic ? 'SET' : 'MISSING'}`);
  console.log(`  OpenRouter:  ${keys.openrouter ? 'SET' : 'MISSING'}`);
  console.log('');

  // Filter models
  let modelsToTest = MODELS;
  if (filter?.provider) {
    modelsToTest = modelsToTest.filter(m => m.provider === filter.provider);
  }
  if (filter?.model) {
    modelsToTest = modelsToTest.filter(m => m.id === filter.model || m.id.includes(filter.model!));
  }

  console.log(`Testing ${modelsToTest.length} models...\n`);

  const results: TestResult[] = [];

  // Test sequentially to avoid rate limiting
  for (const model of modelsToTest) {
    process.stdout.write(`  Testing ${model.displayName} (${model.id})...`);

    let result: TestResult;
    switch (model.provider) {
      case 'together':
        result = await testTogetherModel(model.id, model.model, model.displayName, model.promptConfig);
        break;
      case 'synthetic':
        result = await testSyntheticModel(model.id, model.model, model.displayName, model.promptConfig);
        break;
      case 'openrouter':
        result = await testOpenRouterModel(model.id, model.model, model.displayName, model.promptConfig);
        break;
    }

    results.push(result);

    // Color-coded status
    const statusStr = result.status === 'success'
      ? `\x1b[32mOK\x1b[0m ${result.parsedPrediction?.home}-${result.parsedPrediction?.away} (${result.responseTimeMs}ms)`
      : result.status === 'api_error'
        ? `\x1b[31mAPI ERROR\x1b[0m ${result.error?.slice(0, 100)}`
        : result.status === 'parse_error'
          ? `\x1b[33mPARSE ERROR\x1b[0m ${result.error?.slice(0, 80)}\n    Raw: ${result.rawResponsePreview?.slice(0, 120)}`
          : result.status === 'timeout'
            ? `\x1b[31mTIMEOUT\x1b[0m ${result.error}`
            : `\x1b[90mSKIPPED\x1b[0m ${result.error}`;

    console.log(` ${statusStr}`);

    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n====================================');
  console.log('  SUMMARY');
  console.log('====================================\n');

  const grouped = {
    success: results.filter(r => r.status === 'success'),
    api_error: results.filter(r => r.status === 'api_error'),
    parse_error: results.filter(r => r.status === 'parse_error'),
    timeout: results.filter(r => r.status === 'timeout'),
    no_api_key: results.filter(r => r.status === 'no_api_key'),
  };

  console.log(`  \x1b[32mSuccess:\x1b[0m     ${grouped.success.length}`);
  console.log(`  \x1b[31mAPI Errors:\x1b[0m  ${grouped.api_error.length}`);
  console.log(`  \x1b[33mParse Errors:\x1b[0m ${grouped.parse_error.length}`);
  console.log(`  \x1b[31mTimeouts:\x1b[0m    ${grouped.timeout.length}`);
  console.log(`  \x1b[90mSkipped:\x1b[0m     ${grouped.no_api_key.length}`);

  if (grouped.api_error.length > 0) {
    console.log('\n--- API Errors (models likely removed/deprecated) ---');
    for (const r of grouped.api_error) {
      console.log(`  ${r.displayName} [${r.provider}] (${r.modelId})`);
      console.log(`    HTTP ${r.httpStatus}: ${r.error?.slice(0, 200)}`);
    }
  }

  if (grouped.parse_error.length > 0) {
    console.log('\n--- Parse Errors (models returning wrong format) ---');
    for (const r of grouped.parse_error) {
      console.log(`  ${r.displayName} [${r.provider}] (${r.modelId})`);
      console.log(`    Error: ${r.error}`);
      console.log(`    Raw:   ${r.rawResponsePreview?.slice(0, 200)}`);
    }
  }

  if (grouped.timeout.length > 0) {
    console.log('\n--- Timeouts ---');
    for (const r of grouped.timeout) {
      console.log(`  ${r.displayName} [${r.provider}] (${r.modelId}) - ${r.error}`);
    }
  }

  if (grouped.success.length > 0) {
    console.log('\n--- Response Times (successful models) ---');
    const sorted = [...grouped.success].sort((a, b) => a.responseTimeMs - b.responseTimeMs);
    for (const r of sorted) {
      const speed = r.responseTimeMs < 3000 ? '\x1b[32m' : r.responseTimeMs < 8000 ? '\x1b[33m' : '\x1b[31m';
      console.log(`  ${speed}${r.responseTimeMs.toString().padStart(6)}ms\x1b[0m  ${r.displayName} [${r.provider}] → ${r.parsedPrediction?.home}-${r.parsedPrediction?.away}`);
    }
  }

  console.log('\n');
}

// Parse CLI args
const args = process.argv.slice(2);
const filter: { provider?: string; model?: string } = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--provider' && args[i + 1]) {
    filter.provider = args[i + 1];
    i++;
  }
  if (args[i] === '--model' && args[i + 1]) {
    filter.model = args[i + 1];
    i++;
  }
  if (args[i] === '--db') {
    console.log('DB-only mode not yet implemented. Run without --db to test API calls.');
    process.exit(0);
  }
}

runDiagnostics(filter).catch(console.error);
