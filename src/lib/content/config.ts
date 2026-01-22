/**
 * Content Generation Configuration
 * 
 * Uses Google Gemini 3 Flash Preview via OpenRouter
 * Pricing: $0.50/M input, $3.00/M output
 * 
 * Estimated monthly volume (90 match previews/week + 6 league roundups + reports):
 * - Match previews: ~90/week × 4 weeks = 360/month
 * - League roundups: ~6/week × 4 weeks = 24/month
 * - Model reports: ~4/month
 * Total: ~388 articles/month
 * 
 * Cost estimate: ~€1.13/month (based on ~2K input + 1.5K output per article)
 */

export const CONTENT_CONFIG = {
  // OpenRouter API configuration
  provider: 'openrouter',
  model: 'google/gemini-3-flash-preview:free', // Free tier with generous limits
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  
  // Token limits and pricing (for cost tracking)
  pricing: {
    inputCostPerMillion: 0.50, // USD
    outputCostPerMillion: 3.00, // USD
  },
  
  // Generation parameters
  temperature: 0.7, // Balance between creativity and consistency
  maxTokens: 2000, // Limit output length
  topP: 0.9,
  
  // Content generation schedules (cron expressions)
  schedules: {
    // Generate match previews 6 hours before kickoff
    matchPreviews: '0 */1 * * *', // Every hour (checks for matches needing previews)
    
    // Generate league roundups every Monday at 10 AM
    leagueRoundup: '0 10 * * 1',
    
    // Generate model performance reports every Sunday at 22:00
    modelReport: '0 22 * * 0',
  },
  
  // Content types configuration
  contentTypes: {
    matchPreview: {
      enabled: true,
      hoursBeforeKickoff: 6, // Generate 6h before match
      minHoursBeforeKickoff: 1, // Don't generate if < 1h to kickoff
      sections: [
        'introduction',
        'teamFormAnalysis',
        'headToHead',
        'keyPlayers',
        'tacticalAnalysis',
        'prediction',
        'bettingInsights',
      ],
    },
    leagueRoundup: {
      enabled: true,
      competitions: [
        'champions-league',
        'europa-league',
        'la-liga',
        'bundesliga',
        'serie-a',
        'ligue-1',
      ],
    },
    modelReport: {
      enabled: true,
      topModelsCount: 5, // Report on top 5 performing models
    },
  },
  
  // SEO optimization settings
  seo: {
    keywordsCount: 5, // Number of keywords to extract
    excerptLength: 160, // Meta description length
    titleMaxLength: 60, // Meta title max length
  },
} as const;

export type ContentType = 'matchPreview' | 'leagueRoundup' | 'modelReport';

// Cost estimation helper
export function estimateContentCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * CONTENT_CONFIG.pricing.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * CONTENT_CONFIG.pricing.outputCostPerMillion;
  return inputCost + outputCost;
}
