/**
 * Content Generation Client (DeepSeek V3.1 via OpenRouter)
 *
 * Uses DeepSeek V3.1 for high-quality content generation with JSON schema support.
 * Falls back to Llama 4 Maverick via OpenRouter on failure.
 */

import { fetchWithRetry } from '@/lib/utils/api-client';
import { loggers } from '@/lib/logger/modules';
import {
  OPENROUTER_CONTENT_RETRY,
  OPENROUTER_CONTENT_TIMEOUT_MS,
  OPENROUTER_CONTENT_FALLBACK_RETRY,
  OPENROUTER_CONTENT_FALLBACK_TIMEOUT_MS,
  SERVICE_NAMES,
  type ServiceName,
} from '@/lib/utils/retry-config';
import type { RetryConfig } from '@/lib/utils/api-client';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: string };
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GenerationResult<T = unknown> {
  content: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number; // In USD
}

interface TextGenerationResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number; // In USD
}

// Configuration
const MODEL = 'deepseek/deepseek-chat-v3.1';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PRICING = {
  inputCostPerMillion: 0.15,  // USD per 1M tokens
  outputCostPerMillion: 0.75, // USD per 1M tokens
};

// Fallback model config (when primary DeepSeek V3.1 fails)
const FALLBACK_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';
const FALLBACK_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_PRICING = {
  inputCostPerMillion: 0.10,
  outputCostPerMillion: 0.25,
};

/**
 * Strip thinking/reasoning tags from Kimi K2 Thinking model responses
 * Kimi K2 wraps reasoning in <think>...</think>, <thinking>...</thinking>, <reasoning>...</reasoning>
 * These must be removed BEFORE JSON parsing or text output
 */
function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
}

/**
 * Calculate content generation cost
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputCostPerMillion: number; outputCostPerMillion: number } = PRICING
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMillion;
  return inputCost + outputCost;
}

/**
 * Call content generation API with retry logic
 * Shared helper for both primary and fallback calls
 */
async function callContentAPI(params: {
  apiUrl: string;
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  temperature: number;
  maxTokens: number;
  retryConfig: Partial<RetryConfig>;
  timeoutMs: number;
  serviceName: ServiceName;
  responseFormat?: { type: string };
}): Promise<OpenRouterResponse> {
  const request: OpenRouterRequest = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: 0.9,
    ...(params.responseFormat && { response_format: params.responseFormat }),
  };

  const response = await fetchWithRetry(
    params.apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Football AI Predictions',
      },
      body: JSON.stringify(request),
    },
    params.retryConfig,
    params.timeoutMs,
    params.serviceName
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenRouterResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from API');
  }

  return data;
}

/**
 * Clean JSON string from AI responses
 * Fixes common issues like unescaped newlines, quotes, and control characters
 */
function cleanJSONString(jsonString: string): string {
  // Remove markdown code block markers if present
  let cleaned = jsonString
    .replace(/^```json\s*/g, '')
    .replace(/\s*```$/g, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '');

  // Replace literal newlines within string values with escaped newlines
  // This is the most common AI issue - unescaped newlines in JSON strings
  // Match quotes that contain literal newlines
  cleaned = cleaned.replace(/"([^"]*)\n([^"]*)"/g, (match, part1, part2) => {
    return `"${part1}\\n${part2}"`;
  });

  // Remove control characters except for valid whitespace
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Fix unescaped quotes within string values
  cleaned = cleaned.replace(/(?<!\\)"(?=[^"]*")/g, '\\"');

  // Fix common JSON formatting issues
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');

  return cleaned;
}

/**
 * Generate content using DeepSeek V3.1 via OpenRouter
 * Falls back to Llama 4 Maverick via OpenRouter if primary fails
 */
export async function generateWithOpenRouter<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 3000
): Promise<GenerationResult<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  let primaryError: Error | null = null;

  // Try primary model (DeepSeek V3.1) first
  try {
    const data = await callContentAPI({
      apiUrl: API_URL,
      apiKey,
      model: MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: OPENROUTER_CONTENT_RETRY,
      timeoutMs: OPENROUTER_CONTENT_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.OPENROUTER_CONTENT,
      responseFormat: { type: 'json_object' },
    });

    const content = data.choices[0].message.content;
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, PRICING);
    const duration = Date.now() - startTime;

    loggers.openrouterClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Content generated (DeepSeek V3.1 via OpenRouter)');

    // Parse JSON response
    let parsedContent: T;
    try {
      // Extract JSON from markdown code blocks if present
      let jsonString = content;

      // Check if wrapped in markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      const codeMatch = content.match(/```\n([\s\S]*?)\n```/);

      if (jsonMatch) {
        jsonString = jsonMatch[1];
      } else if (codeMatch) {
        jsonString = codeMatch[1];
      }

      // Remove any BOM or invisible characters at the start
      jsonString = jsonString.replace(/^\uFEFF/, '').replace(/^\u200B/, '').trim();

      // Remove control characters
      jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Fix unescaped newlines within strings by using a more careful approach
      // Split by quotes and rejoin, escaping newlines where needed
      const parts = jsonString.split('"');
      for (let i = 1; i < parts.length; i += 2) {
        // Odd indices are content between quotes
        parts[i] = parts[i].replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      }
      jsonString = parts.join('"');

      // Fix trailing commas
      jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

      parsedContent = JSON.parse(jsonString) as T;
    } catch (parseError) {
      // If JSON parsing fails, log and throw with more context
      loggers.openrouterClient.error({
        content: content.substring(0, 500), // First 500 chars for debugging
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, 'Failed to parse response as JSON');

      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : parseError}`);
    }

    return {
      content: parsedContent,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost,
    };
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
    loggers.openrouterClient.warn({ error: primaryError.message }, 'Primary content generation failed (DeepSeek V3.1), attempting fallback');
  }

  // Try fallback model (Llama 4 Maverick via OpenRouter)
  try {
    const data = await callContentAPI({
      apiUrl: FALLBACK_API_URL,
      apiKey,
      model: FALLBACK_MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: OPENROUTER_CONTENT_FALLBACK_RETRY,
      timeoutMs: OPENROUTER_CONTENT_FALLBACK_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.OPENROUTER_CONTENT_FALLBACK,
    });

    const content = data.choices[0].message.content;
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, FALLBACK_PRICING);
    const duration = Date.now() - startTime;

    loggers.openrouterClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Content generated (Llama 4 Maverick FALLBACK via OpenRouter)');

    // Parse JSON response
    let parsedContent: T;
    try {
      // Extract JSON from markdown code blocks if present
      let jsonString = content;

      // Check if wrapped in markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      const codeMatch = content.match(/```\n([\s\S]*?)\n```/);

      if (jsonMatch) {
        jsonString = jsonMatch[1];
      } else if (codeMatch) {
        jsonString = codeMatch[1];
      }

      // Remove any BOM or invisible characters at the start
      jsonString = jsonString.replace(/^\uFEFF/, '').replace(/^\u200B/, '').trim();

      // Remove control characters
      jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Fix unescaped newlines within strings by using a more careful approach
      // Split by quotes and rejoin, escaping newlines where needed
      const parts = jsonString.split('"');
      for (let i = 1; i < parts.length; i += 2) {
        // Odd indices are content between quotes
        parts[i] = parts[i].replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      }
      jsonString = parts.join('"');

      // Fix trailing commas
      jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

      parsedContent = JSON.parse(jsonString) as T;
    } catch (parseError) {
      // If JSON parsing fails, log and throw with more context
      loggers.openrouterClient.error({
        content: content.substring(0, 500), // First 500 chars for debugging
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, 'Failed to parse fallback response as JSON');

      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : parseError}`);
    }

    return {
      content: parsedContent,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost,
    };
  } catch (fallbackError) {
    loggers.openrouterClient.error({
      primaryError: primaryError?.message,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    }, 'Both primary and fallback content generation failed');
    throw fallbackError;
  }
}

/**
 * Generate plain text content using DeepSeek V3.1 via OpenRouter
 * Use this for prose content (match summaries, descriptions) that doesn't need JSON structure.
 * Avoids JSON parsing errors by returning raw text directly.
 */
export async function generateTextWithOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<TextGenerationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  let primaryError: Error | null = null;

  // Try primary model (DeepSeek V3.1) first
  try {
    const data = await callContentAPI({
      apiUrl: API_URL,
      apiKey,
      model: MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: OPENROUTER_CONTENT_RETRY,
      timeoutMs: OPENROUTER_CONTENT_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.OPENROUTER_CONTENT,
    });

    const content = data.choices[0].message.content;
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, PRICING);
    const duration = Date.now() - startTime;

    loggers.openrouterClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Text content generated (DeepSeek V3.1 via OpenRouter)');

    return {
      content,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost,
    };
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
    loggers.openrouterClient.warn({ error: primaryError.message }, 'Primary text generation failed (DeepSeek V3.1), attempting fallback');
  }

  // Try fallback model (Llama 4 Maverick via OpenRouter)
  try {
    const data = await callContentAPI({
      apiUrl: FALLBACK_API_URL,
      apiKey,
      model: FALLBACK_MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: OPENROUTER_CONTENT_FALLBACK_RETRY,
      timeoutMs: OPENROUTER_CONTENT_FALLBACK_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.OPENROUTER_CONTENT_FALLBACK,
    });

    const content = data.choices[0].message.content;
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, FALLBACK_PRICING);
    const duration = Date.now() - startTime;

    loggers.openrouterClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Text content generated (Llama 4 Maverick FALLBACK via OpenRouter)');

    return {
      content,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost,
    };
  } catch (fallbackError) {
    loggers.openrouterClient.error({
      primaryError: primaryError?.message,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    }, 'Both primary and fallback text generation failed');
    throw fallbackError;
  }
}
