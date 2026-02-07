/**
 * Synthetic API Content Generation Client (Kimi K2 Thinking)
 *
 * Uses Kimi K2 Thinking (moonshotai) for high-quality reasoning-based content generation.
 * Replaces Together AI (Llama 4 Maverick) for enhanced content quality.
 */

import { fetchWithRetry } from '@/lib/utils/api-client';
import { loggers } from '@/lib/logger/modules';
import {
  TOGETHER_CONTENT_RETRY,
  TOGETHER_CONTENT_TIMEOUT_MS,
  TOGETHER_CONTENT_FALLBACK_RETRY,
  TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS,
  SERVICE_NAMES,
  type ServiceName,
} from '@/lib/utils/retry-config';
import type { RetryConfig } from '@/lib/utils/api-client';

interface TogetherMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TogetherRequest {
  model: string;
  messages: TogetherMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface TogetherResponse {
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
const MODEL = 'hf:moonshotai/Kimi-K2-Thinking';
const API_URL = 'https://api.synthetic.new/openai/v1/chat/completions';
const PRICING = {
  inputCostPerMillion: 2.00,  // USD per 1M tokens
  outputCostPerMillion: 6.00, // USD per 1M tokens
};

// Fallback model config (when primary Kimi K2 Thinking fails)
const FALLBACK_MODEL = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
const FALLBACK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const FALLBACK_PRICING = {
  inputCostPerMillion: 0.27,
  outputCostPerMillion: 0.85,
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
  messages: TogetherMessage[];
  temperature: number;
  maxTokens: number;
  retryConfig: Partial<RetryConfig>;
  timeoutMs: number;
  serviceName: ServiceName;
}): Promise<TogetherResponse> {
  const request: TogetherRequest = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: 0.9,
  };

  const response = await fetchWithRetry(
    params.apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
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

  const data = await response.json() as TogetherResponse;

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
 * Generate content using Kimi K2 Thinking via Synthetic API
 * Falls back to Llama 4 Maverick via Together API if primary fails
 */
export async function generateWithTogetherAI<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 3000
): Promise<GenerationResult<T>> {
  const primaryApiKey = process.env.SYNTHETIC_API_KEY;
  const fallbackApiKey = process.env.TOGETHER_API_KEY;

  if (!primaryApiKey && !fallbackApiKey) {
    throw new Error('Neither SYNTHETIC_API_KEY nor TOGETHER_API_KEY environment variable is set');
  }

  const messages: TogetherMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  let primaryError: Error | null = null;

  // Try primary model (Kimi K2 Thinking) first
  if (primaryApiKey) {
    try {
      const data = await callContentAPI({
        apiUrl: API_URL,
        apiKey: primaryApiKey,
        model: MODEL,
        messages,
        temperature,
        maxTokens,
        retryConfig: TOGETHER_CONTENT_RETRY,
        timeoutMs: TOGETHER_CONTENT_TIMEOUT_MS,
        serviceName: SERVICE_NAMES.TOGETHER_CONTENT,
      });

      const rawContent = data.choices[0].message.content;
      const content = stripThinkingTags(rawContent);
      const usage = data.usage;
      const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, PRICING);
      const duration = Date.now() - startTime;

      loggers.togetherClient.info({
        duration,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        cost,
      }, 'Content generated (Kimi K2 Thinking)');

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
        loggers.togetherClient.error({
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
      loggers.togetherClient.warn({ error: primaryError.message }, 'Primary content generation failed, attempting fallback');
    }
  }

  // Try fallback model (Llama 4 Maverick)
  if (!fallbackApiKey) {
    loggers.togetherClient.error({}, 'TOGETHER_API_KEY not set, cannot attempt fallback');
    throw primaryError || new Error('TOGETHER_API_KEY not set');
  }

  try {
    const data = await callContentAPI({
      apiUrl: FALLBACK_API_URL,
      apiKey: fallbackApiKey,
      model: FALLBACK_MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: TOGETHER_CONTENT_FALLBACK_RETRY,
      timeoutMs: TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.TOGETHER_CONTENT_FALLBACK,
    });

    const content = data.choices[0].message.content; // No stripThinkingTags for Llama 4
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, FALLBACK_PRICING);
    const duration = Date.now() - startTime;

    loggers.togetherClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Content generated (Llama 4 Maverick FALLBACK)');

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
      loggers.togetherClient.error({
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
    loggers.togetherClient.error({
      primaryError: primaryError?.message,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    }, 'Both primary and fallback content generation failed');
    throw fallbackError;
  }
}

/**
 * Generate plain text content using Kimi K2 Thinking via Synthetic API
 * Use this for prose content (match summaries, descriptions) that doesn't need JSON structure.
 * Avoids JSON parsing errors by returning raw text directly.
 */
export async function generateTextWithTogetherAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<TextGenerationResult> {
  const primaryApiKey = process.env.SYNTHETIC_API_KEY;
  const fallbackApiKey = process.env.TOGETHER_API_KEY;

  if (!primaryApiKey && !fallbackApiKey) {
    throw new Error('Neither SYNTHETIC_API_KEY nor TOGETHER_API_KEY environment variable is set');
  }

  const messages: TogetherMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  let primaryError: Error | null = null;

  // Try primary model (Kimi K2 Thinking) first
  if (primaryApiKey) {
    try {
      const data = await callContentAPI({
        apiUrl: API_URL,
        apiKey: primaryApiKey,
        model: MODEL,
        messages,
        temperature,
        maxTokens,
        retryConfig: TOGETHER_CONTENT_RETRY,
        timeoutMs: TOGETHER_CONTENT_TIMEOUT_MS,
        serviceName: SERVICE_NAMES.TOGETHER_CONTENT,
      });

      const rawContent = data.choices[0].message.content;
      const content = stripThinkingTags(rawContent);
      const usage = data.usage;
      const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, PRICING);
      const duration = Date.now() - startTime;

      loggers.togetherClient.info({
        duration,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        cost,
      }, 'Text content generated (Kimi K2 Thinking)');

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
      loggers.togetherClient.warn({ error: primaryError.message }, 'Primary text generation failed, attempting fallback');
    }
  }

  // Try fallback model (Llama 4 Maverick)
  if (!fallbackApiKey) {
    loggers.togetherClient.error({}, 'TOGETHER_API_KEY not set, cannot attempt fallback');
    throw primaryError || new Error('TOGETHER_API_KEY not set');
  }

  try {
    const data = await callContentAPI({
      apiUrl: FALLBACK_API_URL,
      apiKey: fallbackApiKey,
      model: FALLBACK_MODEL,
      messages,
      temperature,
      maxTokens,
      retryConfig: TOGETHER_CONTENT_FALLBACK_RETRY,
      timeoutMs: TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS,
      serviceName: SERVICE_NAMES.TOGETHER_CONTENT_FALLBACK,
    });

    const content = data.choices[0].message.content; // No stripThinkingTags for Llama 4
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, FALLBACK_PRICING);
    const duration = Date.now() - startTime;

    loggers.togetherClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Text content generated (Llama 4 Maverick FALLBACK)');

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
    loggers.togetherClient.error({
      primaryError: primaryError?.message,
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    }, 'Both primary and fallback text generation failed');
    throw fallbackError;
  }
}
