import { LLMPredictionResult, LLMProvider } from '@/types';
import { SYSTEM_PROMPT, createUserPrompt, parsePredictionResponse } from '../prompt';

// Base class for LLM providers with common functionality
export abstract class BaseLLMProvider implements LLMProvider {
  abstract id: string;
  abstract name: string;
  abstract model: string;
  abstract displayName: string;
  isPremium: boolean = false;

  // Subclasses implement this to make the actual API call
  protected abstract callAPI(systemPrompt: string, userPrompt: string): Promise<string>;

  // Standard predict method (backward compatible)
  async predict(
    homeTeam: string,
    awayTeam: string,
    competition: string,
    matchDate: string
  ): Promise<LLMPredictionResult> {
    const userPrompt = createUserPrompt(homeTeam, awayTeam, competition, matchDate);
    return this.predictWithPrompt(userPrompt);
  }

  // Enhanced predict method with custom prompt
  async predictWithPrompt(userPrompt: string): Promise<LLMPredictionResult> {
    const startTime = Date.now();

    try {
      const rawResponse = await this.callAPI(SYSTEM_PROMPT, userPrompt);
      const processingTimeMs = Date.now() - startTime;

      const parsed = parsePredictionResponse(rawResponse);

      if (!parsed.success) {
        return {
          homeScore: 0,
          awayScore: 0,
          rawResponse,
          success: false,
          error: parsed.error,
          processingTimeMs,
        };
      }

      return {
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        rawResponse,
        success: true,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      return {
        homeScore: 0,
        awayScore: 0,
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
      };
    }
  }
}

// OpenAI-compatible API format (used by Groq, OpenRouter, Together, etc.)
export abstract class OpenAICompatibleProvider extends BaseLLMProvider {
  protected abstract endpoint: string;
  protected abstract getHeaders(): Record<string, string>;
  
  // Request timeout in milliseconds (30 seconds)
  protected readonly requestTimeout = 30000;

  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getHeaders(),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500, // Increased for reasoning models
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Safely read error text
        let errorText = 'No error details available';
        try {
          errorText = await response.text();
        } catch {
          // Ignore if body can't be read
        }
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('API returned invalid JSON response');
      }
      
      const message = data.choices?.[0]?.message;
      
      // Try content first (standard models)
      if (message?.content) {
        return message.content;
      }
      
      // For reasoning models, check reasoning field for JSON
      if (message?.reasoning) {
        return message.reasoning;
      }
      
      // For models with reasoning_details array
      if (message?.reasoning_details) {
        for (const detail of message.reasoning_details) {
          if (detail.summary) {
            return detail.summary;
          }
        }
      }
      
      // No usable content found - throw descriptive error instead of returning empty string
      throw new Error('API response contained no usable content (no content, reasoning, or reasoning_details)');
    } catch (error) {
      // Handle abort (timeout) specifically
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.requestTimeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
