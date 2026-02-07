/**
 * Synthetic API Content Generation Client (Kimi K2 Thinking)
 *
 * Uses Kimi K2 Thinking (moonshotai) for high-quality reasoning-based content generation.
 * Replaces Together AI (Llama 4 Maverick) for enhanced content quality.
 */

import { fetchWithRetry } from '@/lib/utils/api-client';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_CONTENT_RETRY, TOGETHER_CONTENT_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';

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
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * PRICING.outputCostPerMillion;
  return inputCost + outputCost;
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
 */
export async function generateWithTogetherAI<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 3000
): Promise<GenerationResult<T>> {
  const apiKey = process.env.SYNTHETIC_API_KEY;

  if (!apiKey) {
    throw new Error('SYNTHETIC_API_KEY environment variable is not set');
  }

  const request: TogetherRequest = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature,
    max_tokens: maxTokens,
    top_p: 0.9,
  };

  const startTime = Date.now();

  try {
    const response = await fetchWithRetry(
      API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
      },
      TOGETHER_CONTENT_RETRY,
      TOGETHER_CONTENT_TIMEOUT_MS,
      SERVICE_NAMES.TOGETHER_CONTENT
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Synthetic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as TogetherResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Synthetic API');
    }

    const rawContent = data.choices[0].message.content;
    const content = stripThinkingTags(rawContent);
    const usage = data.usage;
     const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens);
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
     if (error instanceof Error) {
       loggers.togetherClient.error({ error: error.message }, 'Content generation failed');
       throw error;
     }
      loggers.togetherClient.error({}, 'Unknown error during content generation');
      throw new Error('Unknown error during content generation');
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
  const apiKey = process.env.SYNTHETIC_API_KEY;

  if (!apiKey) {
    throw new Error('SYNTHETIC_API_KEY environment variable is not set');
  }

  const request: TogetherRequest = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    top_p: 0.9,
  };

  const startTime = Date.now();

  try {
    const response = await fetchWithRetry(
      API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
      },
      TOGETHER_CONTENT_RETRY,
      TOGETHER_CONTENT_TIMEOUT_MS,
      SERVICE_NAMES.TOGETHER_CONTENT
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Synthetic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as TogetherResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Synthetic API');
    }

    const rawContent = data.choices[0].message.content;
    const content = stripThinkingTags(rawContent);
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens);
    const duration = Date.now() - startTime;

    loggers.togetherClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Text content generated (Kimi K2 Thinking, no JSON parsing)');

    return {
      content, // Thinking tags stripped, no JSON parsing
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost,
    };
  } catch (error) {
    if (error instanceof Error) {
      loggers.togetherClient.error({ error: error.message }, 'Text content generation failed');
      throw error;
    }
    loggers.togetherClient.error({}, 'Unknown error during text content generation');
    throw new Error('Unknown error during text content generation');
  }
}
