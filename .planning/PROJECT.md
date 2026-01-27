# BettingSoccer

Open source AI model prediction competition for football matches.

## What This Is

A personal project tracking how different open-source LLM models perform against each other on football match predictions. Models compete at three levels:

- **Overall:** Aggregate performance across all matches
- **Competition:** Performance within specific leagues (Premier League, Eredivisie, etc.)
- **Club:** Performance for individual clubs (e.g., "Which model is best at predicting Arsenal?")

## Core Value

Automated, continuous prediction generation and scoring with detailed statistical analysis and SEO-optimized match roundups.

## Scoring System (Kicktipp)

| Outcome | Points |
|---------|--------|
| Correct Tendency (win/draw/loss) | 2-6 (based on rarity) |
| Goal Difference | +1 bonus |
| Exact Score | +3 bonus |
| **Maximum per match** | **10 points** |

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Open source models only | Personal curiosity, transparency, cost control | — Pending |
| No reasoning/thinking models | Faster, cheaper, consistent output format | — Pending |
| Pre-match predictions via worker | Avoid runtime latency, batch processing | — Pending |
| Stats at 3 granularity levels | Enable deep analysis of model strengths/weaknesses | — Pending |
| SEO-optimized roundups | Discoverability, sharing, long-term value | — Pending |

## Constraints

- Together.ai API only (already integrated)
- Models without reasoning/thinking chains
- Automated workflow (cron/workers handle everything)
- PostgreSQL + Redis stack (current infrastructure)

## Out of Scope

- Real-money betting integration
- User accounts/authentication (personal project)
- Social features (sharing, comments)
- Mobile app

---
*Last updated: 2026-01-27 after initialization*
