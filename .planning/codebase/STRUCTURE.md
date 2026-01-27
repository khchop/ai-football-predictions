# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
bettingsoccer/
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── admin/              # Admin dashboard components
│   │   ├── match/              # Match-specific components
│   │   ├── competition/        # Competition components
│   │   └── *.tsx               # Shared components
│   ├── lib/                    # Core library code
│   │   ├── db/                 # Drizzle ORM (schema, queries, connection)
│   │   ├── cache/              # Redis caching layer
│   │   ├── queue/              # BullMQ queues + workers
│   │   ├── football/           # API-Football integration
│   │   ├── llm/                # LLM provider abstraction
│   │   ├── logger/             # Pino structured logging
│   │   ├── validation/         # Zod schemas + middleware
│   │   ├── utils/              # Utility functions
│   │   └── content/            # AI content generation
│   ├── types/                  # TypeScript type definitions
│   ├── middleware.ts           # Next.js middleware (CORS, security)
│   └── instrumentation.ts      # OpenTelemetry instrumentation
├── scripts/                    # Migration and maintenance scripts
├── drizzle/                    # Database migrations
├── public/                     # Static assets
├── .env.example                # Environment variable template
├── next.config.ts              # Next.js configuration
├── drizzle.config.ts           # Drizzle ORM configuration
└── package.json                # Dependencies and scripts
```

## Directory Purposes

### `src/app/` - Next.js App Router

**Purpose:** All page routes and API endpoints

**Structure:**
```
app/
├── (implicit root layout)
├── page.tsx                    # Homepage - live matches, upcoming, leaderboard preview
├── layout.tsx                  # Root layout (nav, footer, metadata, analytics)
├── error.tsx                   # Root error boundary
├── global-error.tsx            # Global error boundary for edge cases
├── robots.ts                   # robots.txt generator
├── sitemap.ts                  # sitemap.xml generator
│
├── matches/                    # Matches pages
│   ├── page.tsx                # Match list (search, filters, pagination)
│   ├── live-refresher.tsx      # Live match auto-refresh component
│   ├── [id]/
│   │   ├── page.tsx            # Individual match page
│   │   └── error.tsx           # Match-specific error boundary
│   └── error.tsx               # Matches error boundary
│
├── leaderboard/                # Leaderboard page
│   ├── page.tsx                # Leaderboard with filters (7d, 30d, 90d, all)
│   └── error.tsx
│
├── leagues/                    # Competition pages (SEO-friendly slugs)
│   ├── [slug]/
│   │   ├── page.tsx            # League hub (matches, stats)
│   │   ├── league-hub-content.tsx
│   │   └── [match]/
│   │       └── page.tsx        # Individual match in league context
│   └── [slug]/[match]/page.tsx # Redirect to match page
│
├── models/                     # Model detail pages
│   └── [id]/
│       ├── page.tsx            # Model performance, betting stats
│       └── error.tsx
│
├── admin/                      # Admin dashboard
│   └── page.tsx                # Admin dashboard (requires auth)
│
├── blog/                       # AI-generated blog posts
│   ├── page.tsx                # Blog listing
│   └── [slug]/page.tsx         # Individual post
│
├── api/                        # REST API endpoints
│   ├── health/route.ts         # GET /api/health - health check
│   ├── matches/
│   │   ├── route.ts            # GET /api/matches (list with filters)
│   │   └── [id]/route.ts       # GET /api/matches/:id
│   ├── leaderboard/route.ts    # GET /api/leaderboard
│   ├── models/[id]/bets/route.ts # GET model betting history
│   ├── og/                     # OpenGraph image generation
│   │   ├── match/route.tsx     # Match card image
│   │   ├── league/route.tsx    # League card image
│   │   └── model/route.tsx     # Model card image
│   ├── cron/                   # Cron endpoints (secret-protected)
│   │   └── generate-content/route.ts # POST /api/cron/generate-content
│   └── admin/                  # Admin operations
│       ├── queue-status/route.ts     # GET queue stats
│       ├── queues/[[...path]]/route.ts # Bull Board dashboard
│       ├── rescore/route.ts           # POST trigger re-scoring
│       ├── dlq/route.ts               # GET/DELETE dead letter queue
│       ├── data/route.ts              # GET database stats
│       ├── re-enable-model/route.ts   # POST re-enable auto-disabled model
│       └── trigger-roundups/route.ts  # POST generate league roundups
│
├── llms.txt/route.ts           # LLM text file listing models
└── llms-full.txt/route.ts      # Full LLM details
```

### `src/components/` - React Components

**Purpose:** UI components (Server and Client)

**Structure:**
```
components/
├── ui/                         # shadcn/ui base components
│   ├── button.tsx              # Button with variants
│   ├── card.tsx                # Card containers
│   ├── table.tsx               # Data tables
│   ├── dialog.tsx              # Modal dialogs
│   ├── sheet.tsx               # Slide-out panels
│   ├── tabs.tsx                # Tab navigation
│   ├── select.tsx              # Select dropdowns
│   ├── badge.tsx               # Status badges
│   ├── skeleton.tsx            # Loading skeletons
│   ├── collapsible.tsx         # Collapsible sections
│   ├── dropdown-menu.tsx       # Dropdown menus
│   ├── separator.tsx           # Visual separators
│   └── ...
│
├── admin/                      # Admin dashboard components
│   ├── admin-dashboard.tsx     # Main dashboard layout
│   ├── cost-summary.tsx        # LLM cost summary
│   └── model-health-table.tsx  # Model health status table
│
├── match/                      # Match-specific components
│   ├── MatchContent.tsx        # AI-generated match content
│   ├── MatchStats.tsx          # Match statistics display
│   ├── MatchFAQSchema.tsx      # FAQ Schema.org markup
│   └── PredictionInsightsBlockquote.tsx # AI insights
│
├── competition/                # Competition components
│   ├── competition-header.tsx  # League header
│   ├── competition-stats.tsx   # League statistics
│   ├── competition-prediction-summary.tsx
│   └── competition-top-models.tsx # Top performing models
│
├── navigation.tsx              # Main navigation bar
├── footer.tsx                  # Site footer
├── match-card.tsx              # Match preview card
├── match-events.tsx            # Match events timeline
├── leaderboard-table.tsx       # Leaderboard data table
├── leaderboard-filters.tsx     # Time range filters
├── prediction-table.tsx        # Predictions display
├── model-stats-grid.tsx        # Model statistics grid
├── model-performance-chart.tsx # Performance visualization
├── model-competition-breakdown.tsx # Per-competition stats
├── accuracy-chart.tsx          # Accuracy over time
├── league-selector.tsx         # Competition selector
├── league-card.tsx             # Competition card
├── competition-filter.tsx      # Competition filter
├── search-modal.tsx            # Global search
├── client-date.tsx             # Client-side date display
├── answer-capsule.tsx          # AI answer display
├── quick-league-links.tsx      # League shortcuts
│
└── *Schema.tsx                 # Schema.org JSON-LD markup
    ├── BreadcrumbSchema.tsx
    ├── FaqSchema.tsx
    ├── SportsEventSchema.tsx
    └── WebPageSchema.tsx
```

### `src/lib/` - Core Library Code

**Purpose:** Business logic, integrations, and utilities

**Structure:**
```
lib/
├── db/                         # Database layer
│   ├── index.ts                # Connection pool, getDb(), closePool()
│   ├── schema.ts               # All Drizzle table definitions
│   └── queries.ts              # 1700+ lines of query functions
│
├── cache/                      # Redis caching
│   └── redis.ts                # ioredis client, withCache(), cacheKeys
│
├── queue/                      # BullMQ job queues
│   ├── index.ts                # Queue setup, getQueue(), QUEUE_NAMES
│   ├── workers/                # Individual workers
│   │   ├── index.ts            # Worker startup/exports
│   │   ├── predictions.worker.ts
│   │   ├── fixtures.worker.ts
│   │   ├── analysis.worker.ts
│   │   ├── odds.worker.ts
│   │   ├── lineups.worker.ts
│   │   ├── live-score.worker.ts
│   │   ├── scoring.worker.ts
│   │   ├── content.worker.ts
│   │   ├── backfill.worker.ts
│   │   ├── model-recovery.worker.ts
│   │   └── standings.worker.ts
│
├── football/                   # API-Football integration
│   ├── api-client.ts           # HTTP client with rate limiting
│   ├── api-football.ts         # Main API functions
│   ├── standings.ts            # League standings
│   ├── match-analysis.ts       # Match data aggregation
│   ├── prompt-builder.ts       # LLM prompt construction
│   ├── h2h.ts                  # Head-to-head data
│   ├── lineups.ts              # Team lineups
│   └── team-statistics.ts      # Team statistics
│
├── llm/                        # LLM provider abstraction
│   ├── index.ts                # Provider management
│   ├── providers/
│   │   ├── base.ts             # Base provider interface
│   │   └── together.ts         # Together AI implementation
│   ├── budget.ts               # Daily budget tracking
│   └── prompt.ts               # Prediction prompts
│
├── logger/                     # Pino structured logging
│   ├── index.ts                # Logger factory
│   ├── modules.ts              # Named loggers (db, cache, queue, llm)
│   ├── worker-logger.ts        # Worker-specific logging
│   ├── metrics.ts              # Prometheus metrics
│   ├── timing.ts               # Performance timing utilities
│   └── request-context.ts      # Request-scoped context
│
├── validation/                 # Input validation
│   ├── middleware.ts           # validateQuery, validateBody
│   └── schemas.ts              # Zod schemas
│
├── content/                    # AI content generation
│   ├── index.ts
│   ├── match-content.ts        # Match previews, post-match content
│   └── blog-posts.ts           # League roundups, model reports
│
├── utils/                      # Utility functions
│   ├── rate-limiter.ts         # Token bucket rate limiting
│   ├── admin-auth.ts           # Admin authentication
│   ├── error-sanitizer.ts      # Error message sanitization
│   └── scoring.ts              # Kicktipp scoring logic
│
└── env.ts                      # Environment variable validation
```

### `src/types/` - TypeScript Types

**Purpose:** Type definitions exported for use across the app

**Location:** `src/types/index.ts`

**Key Types:**
```typescript
// Database types (re-exported from schema)
export type { Competition, Match, Model, Bet, Prediction, MatchAnalysis }

// Composite types
export interface MatchWithPredictions { /* ... */ }
export interface LeaderboardEntry { /* ... */ }

// API-Football response types
export interface APIFootballFixture { /* ... */ }
export interface APIFootballPredictionResponse { /* ... */ }
export interface APIFootballOddsResponse { /* ... */ }
export interface APIFootballLineupsResponse { /* ... */ }

// LLM types
export interface LLMProvider { /* ... */ }
export interface LLMPredictionResult { /* ... */ }

// Scoring types
export interface ScoringBreakdown { /* ... */ }
export interface EnhancedLeaderboardEntry { /* ... */ }
```

### `scripts/` - Maintenance Scripts

**Purpose:** One-time migrations and data operations

**Files:**
- `sync-models.ts` - Sync LLM models to database
- `clean-predictions.ts` - Clean prediction data
- `regenerate-post-match-content.ts` - Regenerate match content
- `migrate-betting-system.ts` - Betting system migration
- `backfill-post-match-content.ts` - Backfill historical content
- `check-accuracy.ts` - Verify prediction accuracy
- `generate-roundups.ts` - Generate league roundup posts
- `trigger-rescore.ts` - Trigger re-scoring for matches
- `migrate-predictions.ts` - Predictions migration
- `migrate-hotfix.ts` - Hotfix migrations
- `backfill-slugs.ts` - Generate URL slugs for matches
- `update-standings.ts` - Update league standings
- `fix-model-count.ts` - Fix model counts
- `check-standings.ts` - Verify standings data
- `test-season.ts` - Test season functionality
- `apply-constraint-fix.ts` - Apply database constraints

**Usage:** `npm run db:migrate` for schema changes, `npx tsx scripts/script.ts` for scripts

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration (experimental features, images) |
| `drizzle.config.ts` | Drizzle CLI configuration for migrations |
| `tsconfig.json` | TypeScript configuration |
| `eslint.config.mjs` | ESLint rules |
| `postcss.config.mjs` | PostCSS for Tailwind |
| `components.json` | shadcn/ui component configuration |
| `.env.example` | Environment variable template |
| `.env` | Local environment (not committed) |

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Homepage
- `src/app/layout.tsx` - Root layout with providers
- `src/middleware.ts` - Request preprocessing

**Configuration:**
- `src/lib/db/index.ts` - Database connection
- `src/lib/cache/redis.ts` - Redis client
- `src/lib/queue/index.ts` - Queue setup
- `src/lib/env.ts` - Environment validation

**Core Logic:**
- `src/lib/db/schema.ts` - Database schema (483 lines)
- `src/lib/db/queries.ts` - Database queries (1700+ lines)
- `src/lib/queue/workers/predictions.worker.ts` - Prediction generation

**API Routes:**
- `src/app/api/matches/route.ts` - Match listing
- `src/app/api/admin/rescore/route.ts` - Trigger re-scoring
- `src/app/api/cron/generate-content/route.ts` - Content generation cron

## Where to Add New Code

### New Feature
1. **Pages:** `src/app/[feature]/page.tsx` (Server Component)
2. **Components:** `src/components/[feature]-*.tsx`
3. **API:** `src/app/api/[feature]/route.ts`
4. **Database:** Add tables to `src/lib/db/schema.ts`, queries to `src/lib/db/queries.ts`
5. **Background Job:** Add worker to `src/lib/queue/workers/[feature].worker.ts`

### New API Endpoint
1. Create `src/app/api/[resource]/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Add rate limiting via `checkRateLimit()`
4. Add validation if needed via `validateQuery()`/`validateBody()`
5. Use `getDb()` for database access
6. Return `NextResponse.json()`

### New Database Query
1. Add to `src/lib/db/queries.ts`
2. Use existing query patterns (withCache for expensive queries)
3. Add proper error logging with `logQueryError()`
4. Export function for use in pages/routes

### New Background Job
1. Create `src/lib/queue/workers/[jobname].worker.ts`
2. Export worker function
3. Register queue in `src/lib/queue/index.ts` if new queue needed
4. Add job type constant to `JOB_TYPES`

### New Component
1. **UI Component:** Add to `src/components/ui/` (shadcn pattern)
2. **Feature Component:** Add to appropriate folder under `src/components/`
3. **Server Component:** Make async, fetch data directly
4. **Client Component:** Add `'use client'` directive

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `match-card.tsx`, `api-football.ts` |
| Components | PascalCase | `MatchCard`, `StatsBar` |
| Functions | camelCase | `getUpcomingMatches()` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL`, `CACHE_TTL` |
| Types/Interfaces | PascalCase | `MatchWithPredictions` |
| DB tables | camelCase | `matches`, `modelBalances` |
| Queue names | kebab-case | `analysis-queue`, `predictions-queue` |
| Job types | kebab-case | `settle-match`, `fetch-fixtures` |

## Import Order

```typescript
// 1. External packages
import { Suspense } from 'react';
import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';

// 2. Internal imports using @/ alias
import { getDb, matches, models } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';

// 3. Type-only imports
import type { Match, Model } from '@/lib/db/schema';
```

---

*Structure analysis: 2026-01-27*
