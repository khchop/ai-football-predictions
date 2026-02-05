import { LLMPredictionResult, LLMProvider, BatchPredictionResult } from '@/types';
import {
  SYSTEM_PROMPT,
  BATCH_SYSTEM_PROMPT,
  createUserPrompt,
  parsePredictionResponse,
  parseBatchPredictionResponse,
  parseBatchPredictionEnhanced,
  EnhancedParseResult,
  BatchParsedResult,
} from '../prompt';
import { loggers } from '@/lib/logger/modules';
import { getFallbackProvider } from '../index';

const logger = loggers.llm;
import { fetchWithRetry, APIError, RateLimitError } from '@/lib/utils/api-client';
import { TOGETHER_PREDICTION_RETRY, TOGETHER_PREDICTION_TIMEOUT_MS, TOGETHER_PREDICTION_BATCH_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';
import { PromptVariant, PromptConfig, getEnhancedSystemPrompt } from '../prompt-variants';
import { ResponseHandler, RESPONSE_HANDLERS } from '../response-handlers';

// Re-export for backward compatibility
export type { BatchPredictionResult } from '@/types';

// Result for fallback-aware API calls
export interface FallbackAPIResult {
  response: string;
  usedFallback: boolean;
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

  // Simplified getPredictions method - uses enhanced multi-strategy parser
  // This is the main method for batch predictions with robust parsing
  async getPredictions(matchIds: string[]): Promise<Array<{ matchId: string; homeScore: number; awayScore: number }>> {
    try {
      // Build the batch prompt with matchIds
      const batchPrompt = `Provide predictions for ${matchIds.length} match(es).
Match IDs: ${matchIds.join(', ')}
Respond with JSON array containing match_id, home_score, away_score for each match.`;

      const rawResponse = await this.callAPI(BATCH_SYSTEM_PROMPT, batchPrompt);

      // Use the enhanced multi-strategy parser
      const parsed: EnhancedParseResult = parseBatchPredictionEnhanced(rawResponse, matchIds);

      if (!parsed.success) {
        logger.warn({
          providerId: this.id,
          error: parsed.error,
        }, 'Failed to parse predictions with enhanced parser, trying original parser');

        // Fallback to original parser if enhanced fails
        const originalParsed: BatchParsedResult = parseBatchPredictionResponse(rawResponse, matchIds);
        if (originalParsed.success && originalParsed.predictions.length > 0) {
          return originalParsed.predictions;
        }

        return [];
      }

      return parsed.predictions || [];

    } catch (error) {
      logger.error({
        providerId: this.id,
        error: error instanceof Error ? error.message : String(error),
      }, 'API call failed in getPredictions');
      throw error;
    }
  }

  // Batch prediction method - predict multiple matches in one API call
  // This is an alternative method that returns more detailed results
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

  // Model-specific configuration (optional, subclasses can override)
  protected promptConfig?: PromptConfig;

  // Request timeout in milliseconds (configurable via environment)
  // Default: 15 seconds for single, 20 for batch
  // Can be overridden with LLM_REQUEST_TIMEOUT_MS and LLM_BATCH_TIMEOUT_MS
  protected readonly requestTimeout = parseInt(
    process.env.LLM_REQUEST_TIMEOUT_MS || '15000',
    10
  );
  protected readonly batchRequestTimeout = parseInt(
    process.env.LLM_BATCH_TIMEOUT_MS || '20000',
    10
  );

  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Apply prompt variant to system prompt
    const variant = this.promptConfig?.promptVariant ?? PromptVariant.BASE;
    const enhancedSystemPrompt = getEnhancedSystemPrompt(systemPrompt, variant);

    // Use longer timeout for batch requests (detected by system prompt)
    const isBatch = systemPrompt === BATCH_SYSTEM_PROMPT;
    // Use model-specific timeout if configured, otherwise default
    const modelTimeout = this.promptConfig?.timeoutMs;
    const timeout = modelTimeout ?? (isBatch ? this.batchRequestTimeout : this.requestTimeout);
    
    // OPTIMIZED: Reduced max_tokens since JSON responses are small
    // Single prediction: ~60-80 tokens (with array format and match_id)
    // Batch of 10: ~600-800 tokens
    // Increased from 100 to 150 to prevent truncation for single predictions
    const maxTokens = isBatch ? 800 : 150;
    
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
               { role: 'system', content: enhancedSystemPrompt },
               { role: 'user', content: userPrompt },
             ],
              // OPTIMIZED: Moderate temperature for more varied predictions while maintaining coherence
              // Increased from 0.3 to 0.5 to encourage diversity (Jan 2026 - prompt diversity improvements)
              temperature: 0.5,
             max_tokens: maxTokens,
             // Force JSON output mode for all models
             response_format: { type: 'json_object' },
           }),
         },
         TOGETHER_PREDICTION_RETRY,
         timeout,
         SERVICE_NAMES.TOGETHER_PREDICTIONS
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
       let parseError: Error | null = null;
       let retries = 0;
       const maxParseRetries = 2; // Retry up to 2 times on parse failure
       
       while (retries <= maxParseRetries) {
         try {
           // Clone response to retry parsing if needed
           const cloneResponse = response.clone ? response.clone() : response;
           data = await cloneResponse.json();
           parseError = null;
           break;
         } catch (e) {
           parseError = e instanceof Error ? e : new Error('Unknown parse error');
           retries++;
           
           // Retry if we haven't exceeded limit
           if (retries <= maxParseRetries) {
             // Wait before retrying (exponential backoff: 100ms, 200ms)
             await new Promise(resolve => setTimeout(resolve, 100 * retries));
             continue;
           }
           
           // All retries exhausted
           throw new APIError(
             `API returned invalid JSON response (after ${maxParseRetries} retries): ${parseError.message}`,
             response.status,
             this.endpoint
           );
         }
       }
      
      const message = data.choices?.[0]?.message;

      // Extract content from whichever field is available
      let content: string | undefined;

      // Try content first (standard models)
      if (message?.content) {
        content = message.content;
      }
      // For reasoning models, check reasoning field for JSON
      else if (message?.reasoning) {
        content = message.reasoning;
      }
      // For models with reasoning_details array
      else if (message?.reasoning_details) {
        for (const detail of message.reasoning_details) {
          if (detail.summary) {
            content = detail.summary;
            break;
          }
        }
      }

      // No usable content found
      if (!content) {
        throw new APIError(
          'API response contained no usable content (no content, reasoning, or reasoning_details)',
          response.status,
          this.endpoint
        );
      }

      // Apply response handler AFTER all extraction, BEFORE returning
      const handler = this.promptConfig?.responseHandler ?? ResponseHandler.DEFAULT;
      const processedContent = RESPONSE_HANDLERS[handler](content);
      return processedContent;
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

  /**
   * Call API with automatic fallback to Together AI on failure
   *
   * User decisions (from CONTEXT.md):
   * - Any error triggers fallback (timeout, parse error, empty response, API error, rate limit)
   * - No retries on original model - first failure immediately triggers fallback
   * - If fallback also fails, throw error (max depth 1, no fallback chains)
   * - Attribution: return original model's response context, track fallback internally
   */
  async callAPIWithFallback(
    systemPrompt: string,
    userPrompt: string
  ): Promise<FallbackAPIResult> {
    try {
      // Try original model first
      const response = await this.callAPI(systemPrompt, userPrompt);
      return { response, usedFallback: false };
    } catch (originalError) {
      // Get fallback provider for this model
      const fallbackProvider = getFallbackProvider(this.id);

      if (!fallbackProvider) {
        // No fallback available, propagate original error
        throw originalError;
      }

      // Log fallback attempt
      logger.warn({
        originalModel: this.id,
        fallbackModel: fallbackProvider.id,
        error: originalError instanceof Error ? originalError.message : String(originalError),
      }, 'Model failed, attempting fallback to Together AI');

      try {
        // Try fallback provider (direct callAPI call, NOT recursive)
        // Cast needed because getFallbackProvider returns LLMProvider interface
        const fallbackResult = await (fallbackProvider as OpenAICompatibleProvider).callAPI(
          systemPrompt,
          userPrompt
        );

        logger.info({
          originalModel: this.id,
          fallbackModel: fallbackProvider.id,
        }, 'Fallback succeeded');

        return { response: fallbackResult, usedFallback: true };
      } catch (fallbackError) {
        // Fallback also failed - max depth 1, no more retries
        logger.error({
          originalModel: this.id,
          fallbackModel: fallbackProvider.id,
          originalError: originalError instanceof Error ? originalError.message : String(originalError),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        }, 'Both original and fallback models failed');

        // Throw the fallback error (more recent/relevant)
        throw fallbackError;
      }
    }
  }
}
