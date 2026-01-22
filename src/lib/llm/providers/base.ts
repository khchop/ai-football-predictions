import { LLMPredictionResult, LLMProvider } from '@/types';
import { 
  SYSTEM_PROMPT, 
  BATCH_SYSTEM_PROMPT,
  createUserPrompt, 
  parsePredictionResponse,
  parseBatchPredictionResponse,
  BatchParsedResult,
} from '../prompt';
import { fetchWithRetry, APIError, RateLimitError } from '@/lib/utils/api-client';

// Result for batch predictions
export interface BatchPredictionResult {
  predictions: Map<string, { homeScore: number; awayScore: number }>;
  rawResponse: string;
  success: boolean;
  error?: string;
  processingTimeMs: number;
  failedMatchIds?: string[];
}

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

  // Batch prediction method - predict multiple matches in one API call
  async predictBatch(
    batchPrompt: string,
    expectedMatchIds: string[]
  ): Promise<BatchPredictionResult> {
    const startTime = Date.now();

    try {
      const rawResponse = await this.callAPI(BATCH_SYSTEM_PROMPT, batchPrompt);
      const processingTimeMs = Date.now() - startTime;

      const parsed: BatchParsedResult = parseBatchPredictionResponse(rawResponse, expectedMatchIds);

      if (!parsed.success || parsed.predictions.length === 0) {
        return {
          predictions: new Map(),
          rawResponse,
          success: false,
          error: parsed.error || 'No predictions parsed',
          processingTimeMs,
          failedMatchIds: parsed.failedMatchIds,
        };
      }

      // Convert array to Map for easy lookup
      const predictionsMap = new Map<string, { homeScore: number; awayScore: number }>();
      for (const pred of parsed.predictions) {
        predictionsMap.set(pred.matchId, {
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
        });
      }

      return {
        predictions: predictionsMap,
        rawResponse,
        success: true,
        processingTimeMs,
        failedMatchIds: parsed.failedMatchIds,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      return {
        predictions: new Map(),
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        failedMatchIds: expectedMatchIds,
      };
    }
  }
}

// OpenAI-compatible API format (used by Groq, OpenRouter, Together, etc.)
export abstract class OpenAICompatibleProvider extends BaseLLMProvider {
  protected abstract endpoint: string;
  protected abstract getHeaders(): Record<string, string>;
  
  // Request timeout in milliseconds (15 seconds for single, 20 for batch)
  // Reduced for faster failure detection in parallel processing
  protected readonly requestTimeout = 15000;
  protected readonly batchRequestTimeout = 20000;

  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Use longer timeout for batch requests (detected by system prompt)
    const isBatch = systemPrompt === BATCH_SYSTEM_PROMPT;
    const timeout = isBatch ? this.batchRequestTimeout : this.requestTimeout;
    
    // OPTIMIZED: Reduced max_tokens since JSON responses are small
    // Single prediction: ~30 tokens, Batch of 10: ~300 tokens
    const maxTokens = isBatch ? 800 : 100;
    
    try {
      // Use fetchWithRetry for automatic retry on transient failures
      // Retries: 429 (rate limit), 5xx (server errors), timeouts
      const response = await fetchWithRetry(
        this.endpoint,
        {
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
            // OPTIMIZED: Lower temperature for more reliable JSON output
            temperature: 0.3,
            max_tokens: maxTokens,
            // Force JSON output mode for all models
            response_format: { type: 'json_object' },
          }),
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
        timeout
      );

      if (!response.ok) {
        // Safely read error text
        let errorText = 'No error details available';
        try {
          errorText = await response.text();
        } catch {
          // Ignore if body can't be read
        }
        
        // Throw specific error for rate limiting
        if (response.status === 429) {
          throw new RateLimitError(
            `Rate limit exceeded: ${errorText}`,
            this.endpoint
          );
        }
        
        throw new APIError(
          `API error: ${errorText}`,
          response.status,
          this.endpoint
        );
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new APIError('API returned invalid JSON response', response.status, this.endpoint);
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
      throw new APIError(
        'API response contained no usable content (no content, reasoning, or reasoning_details)',
        response.status,
        this.endpoint
      );
    } catch (error) {
      // Re-throw APIError and RateLimitError as-is
      if (error instanceof APIError || error instanceof RateLimitError) {
        throw error;
      }
      
      // Wrap other errors
      if (error instanceof Error) {
        throw new APIError(error.message, undefined, this.endpoint, error);
      }
      
      throw new APIError('Unknown error', undefined, this.endpoint, error);
    }
  }
}
