# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

### Football Data: API-Football

**Service:** API-Football v3
**Purpose:** Fetch football match data, standings, odds, lineups, and statistics
**Documentation:** https://dashboard.api-football.com/

**Configuration:**
- API Key: `API_FOOTBALL_KEY` environment variable
- Header: `x-apisports-key`

**Implementation:**
- Location: `src/lib/football/api-football.ts`
- Base URL: `https://v3.football.api-sports.io`
- Rate limiting: 300ms delay between requests (100 req/day free tier)

**Endpoints Used:**
| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/fixtures` | Match fixtures and schedules | Every 3 hours |
| `/fixtures/events` | Match events (goals, cards) | Per match |
| `/odds` | Betting odds | Every 10 minutes pre-match |
| `/standings` | League standings | Daily |
| `/teams` | Team information | As needed |
| `/teams/statistics` | Team statistics | Pre-match analysis |
| `/headtohead` | Historical matchups | Pre-match analysis |
| `/injuries` | Player injuries | Pre-match |
| `/lineups` | Starting formations | Near kickoff |

**Competitions Tracked:**
- UEFA Champions League (league ID: e.g., 2)
- Premier League (league ID: e.g., 39)
- Other configured in `src/lib/football/competitions.ts`

**Error Handling:**
- Retry mechanism with exponential backoff
- Timeout: 10 seconds per request
- Circuit breaker pattern for resilience

### LLM Provider: Together AI

**Service:** Together AI
**Purpose:** Generate match predictions and blog content using open-source LLMs
**Documentation:** https://docs.together.ai/

**Configuration:**
- API Key: `TOGETHER_API_KEY` environment variable
- Endpoint: `https://api.together.xyz/v1/chat/completions`

**Implementation:**
- Predictions: `src/lib/llm/providers/together.ts`
- Content generation: `src/lib/content/together-client.ts`
- Model: `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`

**Models Available (29 total):**

| Model Family | Models | Tier |
|--------------|--------|------|
| DeepSeek | V3.1, R1 | Budget, Premium |
| Moonshot | Kimi K2 (2 variants) | Budget |
| Qwen | 3 235B, 3 Next 80B, 2.5 7B/72B Turbo | Premium, Budget |
| Meta Llama | 4 Maverick, 4 Scout, 3.3 70B, 3.1 8B/405B, 3.2 3B, 3 8B Lite, 3 70B | Budget, Premium, Ultra-budget |
| OpenAI OSS | GPT-OSS 20B | Ultra-budget |
| Deep Cogito | v2 70B, v2 109B MoE, v2 405B, v2.1 671B | Budget, Premium |
| Mistral | Ministral 3 14B, Small 3 24B, 7B v0.2/v0.3 | Budget |
| NVIDIA | Nemotron Nano 9B v2 | Budget |
| Google | Gemma 3n E4B | Ultra-budget |
| Essential AI | Rnj-1 Instruct | Budget |
| Marin Community | Marin 8B Instruct | Ultra-budget |

**Pricing (per 1M tokens):**
- Llama 4 Maverick: $0.27 input, $0.85 output
- Ultra-budget models: $0.02-$0.20 per 1M tokens
- Premium models: $1.25-$7.00 per 1M tokens

**Budget Control:**
- `DAILY_BUDGET` environment variable (default: $1.00/day)
- Usage tracking per model in `model_usage` table

## Data Storage

### Database: PostgreSQL

**Provider:** Self-hosted PostgreSQL (recommended via Coolify)
**Connection:**
- Environment: `DATABASE_URL`
- Format: `postgresql://user:password@host:5432/database`
- Client: Drizzle ORM with pg driver

**ORM Configuration:**
- Location: `src/lib/db/index.ts`, `src/lib/db/schema.ts`
- Pool settings:
  - Max connections: `DB_POOL_MAX` (default: 10)
  - Min connections: `DB_POOL_MIN` (default: 2)
  - Idle timeout: 30 seconds
  - Connection timeout: 5 seconds

**Schema Tables:**
- `competitions` - Tracked leagues (UCL, EPL, etc.)
- `matches` - Match data with scores and status
- `models` - LLM models with health tracking
- `predictions` - Model predictions with scoring
- `model_usage` - Daily cost tracking
- `model_balances` - Budget allocation per model
- `bets` - Betting records
- `content` - Generated blog content
- `match_content` - Match-specific generated content
- `events` - Match events
- `odds` - Betting odds snapshots
- `team_statistics` - Pre-match team stats
- `head_to_head` - Historical matchups

### Cache: Redis

**Provider:** Redis (self-hosted or cloud)
**Connection:**
- Environment: `REDIS_URL`
- Client: ioredis 5.9.2

**Implementation:**
- Location: `src/lib/cache/redis.ts`
- Connection name: `bettingsoccer-cache`
- Connection timeout: 10 seconds
- Command timeout: 5 seconds
- Max retries per request: 3

**Cache TTL Presets:**
| Data Type | TTL | Purpose |
|-----------|-----|---------|
| Live fixtures | 30s | Real-time scores |
| Scheduled fixtures | 5min | Match schedules |
| Odds | 10min | Pre-match betting odds |
| Lineups | 5min | Starting formations |
| Standings | 4h | League tables |
| Team stats | 6h | Pre-match analysis |
| H2H data | 7d | Historical matchups |
| Predictions | 24h | Model predictions |
| Leaderboard | 1min | Performance rankings |

**Cache Key Patterns:**
- `api:fixtures:{date}` - Fixtures for a date
- `api:standings:{leagueId}:{season}` - League standings
- `db:models:active` - Active models list
- `db:leaderboard:{hash}` - Cached leaderboard

## Job Queue: BullMQ + Redis

**Implementation:**
- Location: `src/lib/queue/index.ts`, `src/lib/queue/setup.ts`
- Redis connection: Separate from cache Redis
- Job types: 10+ queues for different operations

**Queues:**
| Queue | Purpose | Schedule |
|-------|---------|----------|
| `fixtures-queue` | Fetch fixtures | Every 3 hours |
| `predictions-queue` | Generate predictions | Every 10 min |
| `analysis-queue` | Match analysis | Every 10 min |
| `lineups-queue` | Fetch lineups | Near kickoff |
| `odds-queue` | Refresh odds | Every 10 min |
| `live-queue` | Monitor live scores | Every minute |
| `settlement-queue` | Score predictions | Every 10 min |
| `content-queue` | Generate blog content | Hourly + on-demand |
| `backfill-queue` | Fill missing data | Hourly + on startup |
| `model-recovery-queue` | Re-enable failed models | Every 30 min |
| `standings-queue` | Update standings | Daily at 4 AM |

**Job Configuration:**
- Retry attempts: 5 with exponential backoff (30s → 480s)
- Job timeout: 2-10 minutes (queue-dependent)
- Remove on complete: 24 hours, 1000 jobs
- Remove on fail: 7 days

## Authentication & Security

### Cron Authentication

**Implementation:** `src/lib/auth/cron-auth.ts`
- Environment: `CRON_SECRET`
- Purpose: Authenticate cron job endpoints

### Admin Authentication

**Implementation:** `src/lib/utils/admin-auth.ts`
- Purpose: Protect admin endpoints

### API Rate Limiting

**Implementation:** `src/lib/utils/rate-limiter.ts`
- Purpose: Prevent API abuse

## Error Tracking: Sentry/GlitchTip

**Configuration:**
- Environment: `NEXT_PUBLIC_SENTRY_DSN`
- Config files:
  - `sentry.server.config.ts` - Server-side setup
  - `sentry.client.config.ts` - Client-side setup
  - `sentry.edge.config.ts` - Edge runtime setup

**Supported Platforms:**
- Sentry (cloud)
- GlitchTip (self-hosted, privacy-focused)

## Environment Configuration

**Required env vars:**
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `API_FOOTBALL_KEY` | Yes | Football data API |
| `TOGETHER_API_KEY` | Yes | LLM provider |
| `CRON_SECRET` | No | Cron endpoint auth |
| `REDIS_URL` | No | Cache/queue Redis |
| `DAILY_BUDGET` | No | LLM budget limit (default: 1.00) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Error tracking |
| `NEXT_PUBLIC_APP_URL` | No | App URL for API ref |

**Optional env vars:**
| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_POOL_MAX` | 10 | Max DB connections |
| `DB_POOL_MIN` | 2 | Min DB connections |
| `LOG_LEVEL` | debug/info | Logging verbosity |
| `NODE_ENV` | development | Environment |

## Webhooks & Callbacks

**Incoming Webhooks:**
- Cron endpoints at `/api/cron/` authenticated via `CRON_SECRET`

**Cron Endpoints:**
| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/update-live-scores` | Every minute | Live match updates |
| `/api/cron/fetch-fixtures` | Every 6 hours | Upcoming matches |
| `/api/cron/fetch-analysis` | Every 10 minutes | Match analysis |
| `/api/cron/generate-predictions` | Every 10 minutes | LLM predictions |
| `/api/cron/update-results` | Every 10 minutes | Final scores |

## Monitoring Endpoints

**Health Check:**
- Location: `src/app/api/health/route.ts`
- Returns: Service health status

**Admin Endpoints:**
- `/api/admin/queue-status` - Queue statistics
- `/api/admin/dlq` - Dead letter queue
- `/api/admin/rescore` - Rescore predictions
- `/api/admin/data` - Data management
- `/api/admin/re-enable-model` - Re-enable disabled model

---

*Integration audit: 2026-01-27*
