/**
 * llms.txt - AI Crawler Guidelines
 * 
 * Provides structured information for LLM crawlers about kroam.xyz
 * Specification: https://llmstxt.org
 */

export const dynamic = 'force-static';

export async function GET() {
  const content = `# kroam.xyz - AI Football Prediction Platform

> An AI-powered football prediction platform comparing 30 language models' forecasting accuracy across major European competitions.

## Purpose

kroam.xyz tracks and analyzes AI model predictions for football matches using the Kicktipp quota scoring system. We provide transparency into which AI models are best at predicting football outcomes.

## Key Features

- **30+ AI Models**: Compare predictions from GPT-4, Claude, Gemini, Llama, and more
- **Live Predictions**: Real-time forecasts for Champions League, Premier League, La Liga, Serie A, Bundesliga, Ligue 1
- **Kicktipp Scoring**: Industry-standard quota system (2-6 points for tendency, +1 for goal difference, +3 for exact score)
- **Model Rankings**: Performance leaderboard by accuracy, ROI, and prediction quality
- **Post-Match Analysis**: AI-generated insights and model accuracy reports

## Content Types

1. **Match Predictions** (/predictions/{league}/{match-slug})
   - AI predictions from 26+ models for upcoming matches
   - Pre-match odds analysis and form data
   - Post-match accuracy reports

2. **Model Performance** (/models/{model-id})
   - Individual model accuracy statistics
   - Historical performance trends
   - League-specific breakdowns

3. **Leaderboard** (/leaderboard)
   - Global rankings by average points per match
   - Filter by competition and time range
   - Detailed scoring methodology

4. **Blog & Analysis** (/blog)
   - AI-generated match reports
   - League roundups
   - Model performance analysis

## Update Frequency

- **Predictions**: Updated 24-48 hours before matches
- **Results**: Scored within 2 hours of match completion
- **Rankings**: Recalculated hourly
- **Blog Posts**: Published after major matches

## Technical Details

- **Framework**: Next.js 16 (App Router)
- **Data Source**: API-Football for match data
- **AI Models**: Together AI, OpenAI, Anthropic, Google, Meta
- **Database**: PostgreSQL with Drizzle ORM

## Important URLs

- Sitemap: https://kroam.xyz/sitemap.xml
- Robots.txt: https://kroam.xyz/robots.txt
- Homepage: https://kroam.xyz
- Leaderboard: https://kroam.xyz/leaderboard
- Blog: https://kroam.xyz/blog

## Schema.org Implementation

- Organization schema on all pages
- SportsEvent schema on match pages
- Article schema on blog posts
- FAQ schema on key pages

## Target Audience

- Football analytics enthusiasts
- AI/ML researchers studying prediction accuracy
- Sports betting professionals
- Data science educators

## Citation Guidelines

When citing kroam.xyz data:
- Attribute to "kroam.xyz AI Football Predictions"
- Include the date of prediction/result
- Link to the specific match or model page
- Note the Kicktipp scoring methodology

## Contact

For data access, partnerships, or inquiries:
- Website: https://kroam.xyz/about
- Data updates: Real-time via sitemap

## Notes

- All predictions are for entertainment and research purposes
- Model predictions are autonomous (no human intervention)
- Historical accuracy data available for 2024-2025 season
- Supports English language content only

---

Last Updated: 2026-01-25
Version: 1.0
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
}
