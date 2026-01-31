# Technology Stack

**Analysis Date:** 2026-01-31

## Languages

**Primary:**
- TypeScript 5.x - Full codebase, strict mode enabled
- React 19.2.3 - UI components and client-side rendering
- Node.js - Server-side runtime for API routes, workers, and utilities

**Secondary:**
- JavaScript - Configuration files (postcss.config.mjs, eslint.config.mjs)
- SQL - PostgreSQL queries via Drizzle ORM

## Runtime

**Environment:**
- Node.js (inferred from package.json and Next.js 16.1.4)
- Next.js 16.1.4 - Full-stack framework with App Router

**Package Manager:**
- npm (inferred from package-lock.json pattern)
- Lockfile: Yes (standard npm lockfile present)

## Frameworks

**Core:**
- Next.js 16.1.4 - Framework for React app, API routes, SSR, SSG
- React 19.2.3 - UI library with latest concurrent features
- Express 5.2.1 - HTTP server for queue UI (Bull Board)

**Database & ORM:**
- Drizzle ORM 0.45.1 - Type-safe SQL query builder
- drizzle-kit 0.31.8 - Migration and schema management tool
- PostgreSQL via pg 8.17.2 - Database driver

**Queue/Background Jobs:**
- BullMQ 5.34.3 - Job queue library (Redis-backed)
- @bull-board/api 6.16.2 - Queue UI API
- @bull-board/express 6.16.2 - Queue UI Express middleware

**UI Components:**
- Radix UI - Accessible component primitives
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-dropdown-menu 2.1.16
  - @radix-ui/react-select 2.2.6
  - @radix-ui/react-separator 1.1.8
  - @radix-ui/react-slot 1.2.4
  - @radix-ui/react-tabs 1.1.13

**Styling:**
- TailwindCSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind v4
- PostCSS - CSS transformation (postcss.config.mjs)
- class-variance-authority 0.7.1 - Component variants
- tailwind-merge 3.4.0 - Merge Tailwind class conflicts
- tw-animate-css 1.4.0 - Animation utilities

**Data Visualization:**
- Recharts 3.6.0 - React charting library for statistics

**Tables & Data Display:**
- @tanstack/react-table 8.21.3 - Headless table component

**Utilities:**
- date-fns 4.1.0 - Date manipulation and formatting
- uuid 13.0.0 - UUID generation
- pino 10.2.1 - JSON logger
- pino-pretty 13.1.3 - Pretty-print pino logs in development
- zod 4.3.6 - Runtime schema validation
- react-markdown 10.1.0 - Markdown rendering
- react-loading-skeleton 3.5.0 - Loading skeleton UI
- lucide-react 0.562.0 - Icon library
- clsx 2.1.1 - Conditional classname utility
- p-limit 7.2.0 - Concurrency control
- schema-dts 1.1.5 - Schema.org TypeScript definitions

**Caching:**
- ioredis 5.9.2 - Redis client (supports both direct and Upstash)

**Error Tracking & Monitoring:**
- @sentry/nextjs 10.36.0 - Error tracking integrated with GlitchTip

**Testing & Quality:**
- ESLint 9 - Linting
- eslint-config-next 16.1.4 - Next.js ESLint preset
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions
- @types/pg 8.16.0 - PostgreSQL driver types

**Development:**
- tsx 4.21.0 - TypeScript executor for scripts

## Key Dependencies

**Critical:**
- drizzle-orm 0.45.1 - Type-safe database layer; all data access flows through this
- bullmq 5.34.3 - Background job processing; entire prediction pipeline depends on queue workers
- @sentry/nextjs 10.36.0 - Error tracking; integrates with GlitchTip for production monitoring
- next 16.1.4 - Core framework; enables App Router, API routes, SSR/SSG

**Infrastructure:**
- pg 8.17.2 - Direct PostgreSQL connection (via Drizzle pool)
- ioredis 5.9.2 - Redis client for both caching and BullMQ queue
- pino 10.2.1 - Structured logging throughout the application
- zod 4.3.6 - Runtime validation for API responses and environment variables

**External API Clients:**
- Node.js built-in fetch (no axios/external HTTP client; fetch used for API-Football)
- @sentry/nextjs with OpenAI-compatible protocol for LLM provider abstraction

## Configuration

**Environment:**
Environment variables are validated in `src/lib/env.ts`. Required at startup:
- `DATABASE_URL` - PostgreSQL connection string (required)

Optional with defaults:
- `NODE_ENV` - development or production (default: development)
- `DAILY_BUDGET` - USD budget for paid models (default: 1.00)
- `DB_POOL_MAX` - max connections (default: 10)
- `DB_POOL_MIN` - min connections (default: 2)
- `REDIS_URL` - Redis connection (optional; caching disabled if not set)

Required for API features (checked at usage time):
- `API_FOOTBALL_KEY` - Football data API key
- `TOGETHER_API_KEY` - Together AI API key (primary LLM provider)

Optional for features:
- `CRON_SECRET` - Authentication for scheduled tasks
- `NEXT_PUBLIC_APP_URL` - App URL for headers
- `INDEXNOW_KEY` - SEO URL submission
- `NEXT_PUBLIC_SENTRY_DSN` - GlitchTip error tracking endpoint
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` - Sentry integration configuration (if using Sentry instead of GlitchTip)

**Build:**
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2017
  - Strict mode enabled
  - Path aliases: `@/*` → `./src/*`
  - JSX: react-jsx
- `next.config.ts` - Next.js build configuration
  - Remote image patterns configured for api-sports.io
  - Sentry integration with webpack plugin
- `postcss.config.mjs` - PostCSS configuration
  - TailwindCSS v4 plugin
- `eslint.config.mjs` - ESLint configuration
  - Next.js core web vitals
  - TypeScript preset
  - Custom ignores for build artifacts

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from TypeScript target and Next.js 16 requirements)
- PostgreSQL 12+ (Drizzle supports modern versions)
- Redis 6+ (for caching and BullMQ job queue)
- npm 9+ (for workspaces and modern features)

**Production:**
- Deployment target: Coolify (mentioned in .env.example)
- Container-friendly: Uses PostgreSQL + Redis
- Supports edge deployment (Next.js Edge Runtime for API routes)
- Environment: Node.js runtime (instrumentation.ts runs in Node.js only)

---

*Stack analysis: 2026-01-31*
