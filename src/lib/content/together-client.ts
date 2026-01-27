/**
 * Together AI Content Generation Client
 * 
 * Uses Llama 4 Maverick for high-quality blog content generation.
 * Replaces OpenRouter for unified LLM provider infrastructure.
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
const MODEL = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
const API_URL = 'https://api.together.xyz/v1/chat/completions';
const PRICING = {
  inputCostPerMillion: 0.27,  // USD per 1M tokens
  outputCostPerMillion: 0.85, // USD per 1M tokens
};

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
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/g, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/g, '');

  // Remove control characters (except \n \r \t which are valid in JSON strings)
  // This fixes "Bad control character in string literal" errors
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Fix unescaped literal newlines within string values
  // Match text between quotes that contains literal newlines not preceded by backslash
  cleaned = cleaned.replace(/"([^"]*)\n([^"]*)"/g, (match, before, after) => {
    return `"${before}\\n${after}"`;
  });

  // Fix unescaped quotes within string values
  cleaned = cleaned.replace(/(?<!\\)"([^"]*?)"([^"]*?)"/g, '\\"$1\\"$2\\"');

  // Fix common JSON formatting issues
  cleaned = cleaned.replace(/,\s*}/g, '}');  // Trailing commas before }
  cleaned = cleaned.replace(/,\s*]/g, ']');  // Trailing commas before ]

  return cleaned;
}

/**
 * Generate content using Llama 4 Maverick via Together AI
 */
export async function generateWithTogetherAI<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 3000
): Promise<GenerationResult<T>> {
  const apiKey = process.env.TOGETHER_API_KEY;
  
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is not set');
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
      throw new Error(`Together AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as TogetherResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Together AI API');
    }

    const content = data.choices[0].message.content;
    const usage = data.usage;
     const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens);
     const duration = Date.now() - startTime;

     loggers.togetherClient.info({
       duration,
       inputTokens: usage.prompt_tokens,
       outputTokens: usage.completion_tokens,
       cost,
     }, 'Content generated');

    // Parse JSON response
    let parsedContent: T;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      let jsonString = jsonMatch ? jsonMatch[1] : content;

      // Clean up the JSON string - remove control characters and fix common AI JSON issues
      jsonString = cleanJSONString(jsonString);

      parsedContent = JSON.parse(jsonString.trim()) as T;
    } catch (parseError) {
      // If JSON parsing fails, try to clean and retry with more aggressive cleaning
      let cleanedContent = content
        .replace(/^[^{]*/, '')    // Remove leading non-JSON text
        .replace(/[^}]*$/, '');   // Remove trailing non-JSON text

      cleanedContent = cleanJSONString(cleanedContent);

      try {
        parsedContent = JSON.parse(cleanedContent) as T;
      } catch {
        loggers.togetherClient.error({ content }, 'Failed to parse response as JSON');
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
      }
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
 * Generate plain text content using Together AI
 * Use this for prose content (match summaries, descriptions) that doesn't need JSON structure.
 * Avoids JSON parsing errors by returning raw text directly.
 */
export async function generateTextWithTogetherAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<TextGenerationResult> {
  const apiKey = process.env.TOGETHER_API_KEY;
  
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is not set');
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
      throw new Error(`Together AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as TogetherResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Together AI API');
    }

    const content = data.choices[0].message.content;
    const usage = data.usage;
    const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens);
    const duration = Date.now() - startTime;

    loggers.togetherClient.info({
      duration,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost,
    }, 'Text content generated (no JSON parsing)');

    return {
      content, // Raw text, no JSON parsing
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
