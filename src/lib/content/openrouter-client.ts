/**
 * OpenRouter API Client for AI Content Generation
 * 
 * Handles communication with OpenRouter API to generate content
 * using Google Gemini 3 Flash Preview model.
 */

import { CONTENT_CONFIG, estimateContentCost } from './config';

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

export class OpenRouterClient {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }
    
    this.apiKey = apiKey;
    this.apiUrl = CONTENT_CONFIG.apiUrl;
    this.model = CONTENT_CONFIG.model;
  }

  /**
   * Generate content using the AI model
   */
  async generate<T = unknown>(prompt: string): Promise<GenerationResult<T>> {
    const request: OpenRouterRequest = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert football analyst and sports journalist. Generate high-quality, SEO-optimized content for football match predictions and betting insights.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: CONTENT_CONFIG.temperature,
      max_tokens: CONTENT_CONFIG.maxTokens,
      top_p: CONTENT_CONFIG.topP,
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://kroam.xyz', // Required by OpenRouter
          'X-Title': 'Kroam Football AI', // Optional but recommended
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter API');
      }

      const content = data.choices[0].message.content;
      const usage = data.usage;

      // Calculate cost
      const cost = estimateContentCost(usage.prompt_tokens, usage.completion_tokens);

      // Parse JSON response
      let parsedContent: T;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        parsedContent = JSON.parse(jsonString.trim()) as T;
      } catch (parseError) {
        // If JSON parsing fails, try to clean and retry
        const cleanedContent = content
          .replace(/^[^{]*/, '') // Remove leading non-JSON text
          .replace(/[^}]*$/, ''); // Remove trailing non-JSON text
        
        try {
          parsedContent = JSON.parse(cleanedContent) as T;
        } catch {
          console.error('Failed to parse AI response as JSON:', content);
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
        console.error('[OpenRouter] Generation failed:', error.message);
        throw error;
      }
      throw new Error('Unknown error during content generation');
    }
  }

  /**
   * Check if the API key is valid by making a test request
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generate<{ test: string }>('Return JSON: {"test": "success"}');
      return result.content.test === 'success';
    } catch (error) {
      console.error('[OpenRouter] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get estimated cost for a prompt
   */
  estimateCost(promptLength: number, expectedOutputLength: number): number {
    // Rough estimate: 4 chars per token
    const estimatedInputTokens = Math.ceil(promptLength / 4);
    const estimatedOutputTokens = Math.ceil(expectedOutputLength / 4);
    return estimateContentCost(estimatedInputTokens, estimatedOutputTokens);
  }
}

// Singleton instance
let clientInstance: OpenRouterClient | null = null;

/**
 * Get or create the OpenRouter client instance
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!clientInstance) {
    clientInstance = new OpenRouterClient();
  }
  return clientInstance;
}
