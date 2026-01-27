# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5 - Main application language
- CSS (Tailwind CSS 4) - Styling

**Secondary:**
- JavaScript (for build scripts and migrations)

## Runtime

**Environment:**
- Node.js (version managed via package.json devDependencies `@types/node: ^20`)
- Next.js 16.1.4 (App Router framework)

**Package Manager:**
- npm (standard npm workflow)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.4 - React framework with App Router
  - Location: `src/app/`
  - Features: Server Components, API Routes, Image Optimization
- React 19.2.3 - UI library
- React DOM 19.2.3

**UI Components:**
- shadcn/ui - Component library built on Radix UI primitives
  - Location: `src/components/ui/`
  - Components: button, card, table, tabs, dialog, select, badge, etc.
- class-variance-authority 0.7.1 - Variant management for components
- tailwind-merge 3.4.0 - Tailwind class merging utility
- clsx 2.1.1 - Conditional className utility
- tw-animate-css 1.4.0 - CSS animation utilities

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
  - Config: `postcss.config.mjs`
  - Theme: `src/app/globals.css`
- @tailwindcss/postcss 4

## Data Layer

**ORM:**
- drizzle-orm 0.45.1 - Type-safe PostgreSQL ORM
  - Location: `src/lib/db/`
  - Config: `drizzle.config.ts`
- drizzle-kit 0.31.8 - Migration tool

**Database:**
- PostgreSQL - Primary database
  - Connection: `DATABASE_URL` environment variable
  - Client: `pg` package via Drizzle
  - Pool configuration: `DB_POOL_MAX` (default: 10), `DB_POOL_MIN` (default: 2)

## Caching & Queues

**Caching:**
- Redis with ioredis 5.9.2
  - Location: `src/lib/cache/redis.ts`
  - Purpose: API response caching, session storage
  - TTL presets defined for different data types

**Job Queue:**
- BullMQ 5.34.3 - Redis-based job queue
  - Location: `src/lib/queue/`
  - Separate queues: analysis, predictions, lineups, odds, live, settlement, fixtures, backfill, content, model-recovery, standings
- @bull-board/api 6.16.2 - Queue monitoring UI
- @bull-board/express 6.16.2 - Express adapter for Bull Board

## LLM/AI Integration

**Primary Provider:**
- Together AI - LLM provider for predictions and content
  - 29 open-source models available
  - Location: `src/lib/llm/providers/together.ts`
  - Primary model: Llama 4 Maverick (meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8)
  - Content generation: Llama 4 Maverick via `/v1/chat/completions`

**Model Tiers:**
- Free: Gemma 3n E4B
- Ultra-budget: Llama 3.1 8B Turbo, Llama 3.2 3B Turbo, Llama 3 8B Lite, GPT-OSS 20B, Marin 8B Instruct
- Budget: Most models (DeepSeek V3.1, Qwen, Llama 3.3 70B, Mistral, etc.)
- Premium: DeepSeek R1, Qwen3 235B, Llama 3.1 405B Turbo, Cogito models

## External APIs

**Football Data:**
- API-Football (v3)
  - Base URL: `https://v3.football.api-sports.io`
  - Location: `src/lib/football/api-football.ts`
  - Endpoints: fixtures, standings, odds, lineups, events, h2h

## Validation

**Schema Validation:**
- Zod 4.3.6 - Schema validation and type inference
  - Location: `src/lib/validation/schemas.ts`
  - Used for: API route query params, request bodies

## Logging

**Structured Logging:**
- Pino 10.2.1 - JSON logger
- pino-pretty 13.1.3 - Development formatting
  - Location: `src/lib/logger/`
  - Features: Child loggers by module, metrics logging

## Error Tracking

**Monitoring:**
- Sentry (via @sentry/nextjs 10.36.0)
  - Config: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`
  - Supports GlitchTip (self-hosted Sentry alternative)

## Build & Development

**Build:**
- TypeScript 5 - Compiles to JavaScript
- Next.js build system (`npm run build`)

**Dev Server:**
- Next.js dev server (`npm run dev` - localhost:3000)

**Type Checking:**
- TypeScript compiler (strict mode enabled)

**Linting:**
- ESLint 9 with eslint-config-next
  - Config: `eslint.config.mjs`
  - Includes: Next.js core web vitals, TypeScript support

**Code Execution:**
- tsx 4.21.0 - TypeScript execution for scripts
  - Used for: Database migrations, maintenance scripts

## Charts & Data Visualization

**Visualization:**
- recharts 3.6.0 - React charting library
  - Used for: Leaderboard charts, statistics

## Markdown

**Content Rendering:**
- react-markdown 10.1.0 - Markdown rendering
  - Used for: Blog posts, match content

## Utilities

**Date Handling:**
- date-fns 4.1.0 - Date manipulation

**Icons:**
- lucide-react 0.562.0 - Icon library

**UUID:**
- uuid 13.0.0 - UUID generation

**Rate Limiting:**
- p-limit 7.2.0 - Promise concurrency limiting

## Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript configuration (strict mode, paths: `@/*` → `./src/*`) |
| `next.config.ts` | Next.js configuration with Sentry integration |
| `eslint.config.mjs` | ESLint configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `postcss.config.mjs` | PostCSS configuration for Tailwind |
| `.env.example` | Environment variable template |

## Deployment Target

**Platform:**
- Coolify (recommended for self-hosting)
- Docker-ready architecture (uses environment variables for configuration)

---

*Stack analysis: 2026-01-27*
