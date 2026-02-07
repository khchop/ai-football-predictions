/**
 * Content Generation Configuration
 *
 * Uses Kimi K2 Thinking via Synthetic API for high-quality reasoning-based content.
 * Pricing: $2.00/M input, $6.00/M output
 *
 * Estimated monthly volume:
 * - Match previews: ~280/month (65/week avg)
 * - League roundups: ~32/month (8 leagues/week, 4 weeks)
 * - Model reports: ~4/month (weekly instead of monthly)
 * Total: ~316 articles/month
 *
 * Cost estimate: ~$5/month (higher due to reasoning model premium, but better quality)
 */

export const CONTENT_CONFIG = {
  // Synthetic API configuration (Kimi K2 Thinking)
  provider: 'synthetic',
  model: 'hf:moonshotai/Kimi-K2-Thinking',
  apiUrl: 'https://api.synthetic.new/openai/v1/chat/completions',

  // Token limits and pricing (for cost tracking)
  pricing: {
    inputCostPerMillion: 2.00,  // USD
    outputCostPerMillion: 6.00, // USD
  },
  
  // Generation parameters (tuned for content quality)
  temperature: 0.7, // Balance between creativity and consistency
  maxTokens: 3000,  // Increased for long-form articles
  topP: 0.9,
  
  // Content generation schedules (cron expressions)
  schedules: {
    // Generate match previews every hour (checks for matches 1-6h to kickoff)
    matchPreviews: '0 */1 * * *',
    
    // Generate league roundups every Monday at 10 AM (UTC)
    leagueRoundup: '0 10 * * 1',
    
    // Generate model performance reports every Sunday at 22:00 (UTC)
    modelReport: '0 22 * * 0',
  },
  
  // Content types configuration
  contentTypes: {
    matchPreview: {
      enabled: true,
      hoursBeforeKickoff: 6,      // Generate 6h before match
      minHoursBeforeKickoff: 1,   // Don't generate if < 1h to kickoff
      sections: [
        'introduction',
        'teamFormAnalysis',
        'keyPlayers',
        'tacticalAnalysis',
        'prediction',
        'bettingInsights',
      ],
    },
    leagueRoundup: {
      enabled: true,
      // All tracked domestic leagues + European competitions
      competitions: [
        'premier-league',
        'champions-league',
        'europa-league',
        'conference-league',
        'la-liga',
        'bundesliga',
        'serie-a',
        'ligue-1',
        'eredivisie',
      ],
    },
    modelReport: {
      enabled: true,
      frequency: 'weekly',         // Changed from monthly to weekly
      topModelsCount: 10,          // Report on top 10 models
    },
  },
  
  // SEO optimization settings
  seo: {
    keywordsCount: 5,     // Number of keywords to extract
    excerptLength: 160,   // Meta description length
    titleMaxLength: 60,   // Meta title max length
  },
} as const;

export type ContentType = 'matchPreview' | 'leagueRoundup' | 'modelReport';

// Cost estimation helper
export function estimateContentCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * CONTENT_CONFIG.pricing.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * CONTENT_CONFIG.pricing.outputCostPerMillion;
  return inputCost + outputCost;
}
