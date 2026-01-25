# AGENTS.md - BettingSoccer Development Guide

This guide is for AI coding agents working in the BettingSoccer codebase.

## Project Overview

A Next.js 16 application that tracks football match predictions from multiple LLM models. Uses PostgreSQL with Drizzle ORM, Redis caching, and BullMQ job queues.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Drizzle ORM, PostgreSQL, Redis, BullMQ, Pino logging, Zod validation, shadcn/ui components.

---

## Build/Lint/Test Commands

### Development
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database (Drizzle ORM)
```bash
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run migrations
npm run db:generate  # Generate new migration
npm run db:studio    # Open Drizzle Studio GUI
```

### Scripts
```bash
npm run sync-models           # Sync LLM models to database
npm run clean-predictions     # Clean prediction data
npm run regenerate-content    # Regenerate post-match content
npm run migrate:betting       # Run betting system migration
npm run migrate:predictions   # Run predictions migration
```

### Testing
**No test framework is currently configured.** When adding tests:
- Use Vitest (recommended for Next.js)
- Place tests in `__tests__/` directories or as `*.test.ts` files
- Run single test: `npx vitest run path/to/file.test.ts`
- Run with watch: `npx vitest path/to/file.test.ts`

---

## Project Structure

```
src/
  app/                    # Next.js App Router
    api/                  # API routes (REST endpoints)
      admin/              # Admin endpoints (queue, rescore, dlq)
      cron/               # Scheduled cron endpoints
      health/             # Health check
    (pages)/              # Page routes (matches, predictions, leaderboard)
  components/
    ui/                   # shadcn/ui components (button, card, table)
    admin/                # Admin-specific components
    match/                # Match-specific components
  lib/
    db/                   # Drizzle ORM (schema.ts, queries.ts, index.ts)
    cache/                # Redis caching layer
    football/             # API-Football integration
    llm/                  # LLM provider abstraction
    logger/               # Pino structured logging
    queue/                # BullMQ job queue & workers
    validation/           # Zod schemas & middleware
    utils/                # Utility functions
  types/                  # TypeScript type definitions
scripts/                  # Migration & maintenance scripts
drizzle/                  # Database migrations
```

---

## Code Style Guidelines

### Imports
Order imports as follows, with blank line between groups:
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

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `match-card.tsx`, `api-football.ts` |
| Components | PascalCase | `MatchCard`, `StatsBar` |
| Functions | camelCase | `getUpcomingMatches()` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL`, `CACHE_TTL` |
| Types/Interfaces | PascalCase | `MatchWithPredictions` |
| DB tables | camelCase | `matches`, `modelBalances` |

### TypeScript
- Strict mode is enabled - no implicit `any`
- Use path alias `@/*` for imports from `src/`
- Export types from schema using Drizzle's `$inferSelect`/`$inferInsert`:
```typescript
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
```

### React Components
- Use Server Components by default (async functions)
- Use `Suspense` for async data loading
- Use shadcn/ui patterns with `class-variance-authority` for variants:
```typescript
function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

### API Routes
```typescript
// src/app/api/example/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Validate with Zod, then process
  return NextResponse.json({ success: true });
}
```

### Error Handling
- Use structured logging with Pino:
```typescript
import { loggers } from '@/lib/logger/modules';

try {
  const data = await fetchData();
} catch (error) {
  loggers.db.error({ operation: 'fetchData', error: error.message }, 'Query failed');
  // Continue gracefully or rethrow
}
```

- Wrap database operations with error context:
```typescript
function logQueryError(operation: string, error: any, context?: Record<string, any>) {
  loggers.db.error({
    operation,
    message: error.message,
    code: error.code,
    ...context,
  }, 'Database query error');
}
```

### Database Patterns
- Use `getDb()` to get database instance
- Cache expensive queries with Redis:
```typescript
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';

export async function getActiveCompetitions() {
  return withCache(cacheKeys.activeCompetitions(), CACHE_TTL.COMPETITIONS, async () => {
    const db = getDb();
    return db.select().from(competitions).where(eq(competitions.active, true));
  });
}
```

### Validation
- Use Zod schemas in `src/lib/validation/`
- Validate API inputs before processing

---

## Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `API_FOOTBALL_KEY` - API-Football API key
- `TOGETHER_API_KEY` - Together AI API key
- `CRON_SECRET` - Secret for cron endpoint authentication
- `REDIS_URL` - Redis connection string (optional, for caching/queues)

---

## Cron Jobs

The application uses scheduled cron tasks (configured in deployment):
- `/api/cron/update-live-scores` - Every minute (live match updates)
- `/api/cron/fetch-fixtures` - Every 6 hours (upcoming matches)
- `/api/cron/fetch-analysis` - Every 10 minutes (match analysis)
- `/api/cron/generate-predictions` - Every 10 minutes (LLM predictions)
- `/api/cron/update-results` - Every 10 minutes (final scores)

---

## Common Patterns

### Adding a New API Endpoint
1. Create file at `src/app/api/{route}/route.ts`
2. Export `GET`, `POST`, etc. async functions
3. Use `NextResponse.json()` for responses
4. Add Zod validation for request bodies

### Adding a New Page
1. Create folder at `src/app/{route}/`
2. Add `page.tsx` with default export
3. Use Server Components with `Suspense` for data loading

### Adding a UI Component
1. For shadcn/ui: Run `npx shadcn@latest add {component}`
2. Components go in `src/components/ui/`
3. Use `cn()` utility for conditional classes

### Database Schema Changes
1. Modify `src/lib/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply

---

## Troubleshooting

- **Redis connection errors:** Check `REDIS_URL` or run without caching
- **Database errors:** Verify `DATABASE_URL` and run `npm run db:push`
- **API-Football rate limits:** Check quota, add delays between requests
- **LLM failures:** Models auto-disable after 3 consecutive failures


<!-- CLAVIX:START -->
# Clavix Instructions for Generic Agents

This guide is for agents that can only read documentation (no slash-command support). If your platform supports custom slash commands, use those instead.

---

## ⛔ CLAVIX MODE ENFORCEMENT

**CRITICAL: Know which mode you're in and STOP at the right point.**

**OPTIMIZATION workflows** (NO CODE ALLOWED):
- Improve mode - Prompt optimization only (auto-selects depth)
- Your role: Analyze, optimize, show improved prompt, **STOP**
- ❌ DO NOT implement the prompt's requirements
- ✅ After showing optimized prompt, tell user: "Run `/clavix:implement --latest` to implement"

**PLANNING workflows** (NO CODE ALLOWED):
- Conversational mode, requirement extraction, PRD generation
- Your role: Ask questions, create PRDs/prompts, extract requirements
- ❌ DO NOT implement features during these workflows

**IMPLEMENTATION workflows** (CODE ALLOWED):
- Only after user runs execute/implement commands
- Your role: Write code, execute tasks, implement features
- ✅ DO implement code during these workflows

**If unsure, ASK:** "Should I implement this now, or continue with planning?"

See `.clavix/instructions/core/clavix-mode.md` for complete mode documentation.

---

## 📁 Detailed Workflow Instructions

For complete step-by-step workflows, see `.clavix/instructions/`:

| Workflow | Instruction File | Purpose |
|----------|-----------------|---------|
| **Conversational Mode** | `workflows/start.md` | Natural requirements gathering through discussion |
| **Extract Requirements** | `workflows/summarize.md` | Analyze conversation → mini-PRD + optimized prompts |
| **Prompt Optimization** | `workflows/improve.md` | Intent detection + quality assessment + auto-depth selection |
| **PRD Generation** | `workflows/prd.md` | Socratic questions → full PRD + quick PRD |
| **Mode Boundaries** | `core/clavix-mode.md` | Planning vs implementation distinction |
| **File Operations** | `core/file-operations.md` | File creation patterns |
| **Verification** | `core/verification.md` | Post-implementation verification |

**Troubleshooting:**
- `troubleshooting/jumped-to-implementation.md` - If you started coding during planning
- `troubleshooting/skipped-file-creation.md` - If files weren't created
- `troubleshooting/mode-confusion.md` - When unclear about planning vs implementation

---

## 🔍 Workflow Detection Keywords

| Keywords in User Request | Recommended Workflow | File Reference |
|---------------------------|---------------------|----------------|
| "improve this prompt", "make it better", "optimize" | Improve mode → Auto-depth optimization | `workflows/improve.md` |
| "analyze thoroughly", "edge cases", "alternatives" | Improve mode (--comprehensive) | `workflows/improve.md` |
| "create a PRD", "product requirements" | PRD mode → Socratic questioning | `workflows/prd.md` |
| "let's discuss", "not sure what I want" | Conversational mode → Start gathering | `workflows/start.md` |
| "summarize our conversation" | Extract mode → Analyze thread | `workflows/summarize.md` |
| "refine", "update PRD", "change requirements", "modify prompt" | Refine mode → Update existing content | `workflows/refine.md` |
| "verify", "check my implementation" | Verify mode → Implementation verification | `core/verification.md` |

**When detected:** Reference the corresponding `.clavix/instructions/workflows/{workflow}.md` file.

---

## 📋 Clavix Commands (v5)

### Setup Commands (CLI)
| Command | Purpose |
|---------|---------|
| `clavix init` | Initialize Clavix in a project |
| `clavix update` | Update templates after package update |
| `clavix diagnose` | Check installation health |
| `clavix version` | Show version |

### Workflow Commands (Slash Commands)
All workflows are executed via slash commands that AI agents read and follow:

> **Command Format:** Commands shown with colon (`:`) format. Some tools use hyphen (`-`): Claude Code uses `/clavix:improve`, Cursor uses `/clavix-improve`. Your tool autocompletes the correct format.

| Slash Command | Purpose |
|---------------|---------|
| `/clavix:improve` | Optimize prompts (auto-selects depth) |
| `/clavix:prd` | Generate PRD through guided questions |
| `/clavix:plan` | Create task breakdown from PRD |
| `/clavix:implement` | Execute tasks or prompts (auto-detects source) |
| `/clavix:start` | Begin conversational session |
| `/clavix:summarize` | Extract requirements from conversation |
| `/clavix:refine` | Refine existing PRD or saved prompt |

### Agentic Utilities (Project Management)
These utilities provide structured workflows for project completion:

| Utility | Purpose |
|---------|---------|
| `/clavix:verify` | Check implementation against PRD requirements, run validation |
| `/clavix:archive` | Archive completed work to `.clavix/archive/` for reference |

**Quick start:**
```bash
npm install -g clavix
clavix init
```

**How it works:** Slash commands are markdown templates. When invoked, the agent reads the template and follows its instructions using native tools (Read, Write, Edit, Bash).

---

## 🔄 Standard Workflow

**Clavix follows this progression:**

```
PRD Creation → Task Planning → Implementation → Archive
```

**Detailed steps:**

1. **Planning Phase**
   - Run: `/clavix:prd` or `/clavix:start` → `/clavix:summarize`
   - Output: `.clavix/outputs/{project}/full-prd.md` + `quick-prd.md`
   - Mode: PLANNING

2. **Task Preparation**
   - Run: `/clavix:plan` transforms PRD into curated task list
   - Output: `.clavix/outputs/{project}/tasks.md`
   - Mode: PLANNING (Pre-Implementation)

3. **Implementation Phase**
   - Run: `/clavix:implement`
   - Agent executes tasks systematically
   - Mode: IMPLEMENTATION
   - Agent edits tasks.md directly to mark progress (`- [ ]` → `- [x]`)

4. **Completion**
   - Run: `/clavix:archive`
   - Archives completed work
   - Mode: Management

**Key principle:** Planning workflows create documents. Implementation workflows write code.

---

## 💡 Best Practices for Generic Agents

1. **Always reference instruction files** - Don't recreate workflow steps inline, point to `.clavix/instructions/workflows/`

2. **Respect mode boundaries** - Planning mode = no code, Implementation mode = write code

3. **Use checkpoints** - Follow the CHECKPOINT pattern from instruction files to track progress

4. **Create files explicitly** - Use Write tool for every file, verify with ls, never skip file creation

5. **Ask when unclear** - If mode is ambiguous, ask: "Should I implement or continue planning?"

6. **Track complexity** - Use conversational mode for complex requirements (15+ exchanges, 5+ features, 3+ topics)

7. **Label improvements** - When optimizing prompts, mark changes with [ADDED], [CLARIFIED], [STRUCTURED], [EXPANDED], [SCOPED]

---

## ⚠️ Common Mistakes

### ❌ Jumping to implementation during planning
**Wrong:** User discusses feature → agent generates code immediately

**Right:** User discusses feature → agent asks questions → creates PRD/prompt → asks if ready to implement

### ❌ Skipping file creation
**Wrong:** Display content in chat, don't write files

**Right:** Create directory → Write files → Verify existence → Display paths

### ❌ Recreating workflow instructions inline
**Wrong:** Copy entire fast mode workflow into response

**Right:** Reference `.clavix/instructions/workflows/improve.md` and follow its steps

### ❌ Not using instruction files
**Wrong:** Make up workflow steps or guess at process

**Right:** Read corresponding `.clavix/instructions/workflows/*.md` file and follow exactly

---

**Artifacts stored under `.clavix/`:**
- `.clavix/outputs/<project>/` - PRDs, tasks, prompts
- `.clavix/templates/` - Custom overrides

---

**For complete workflows:** Always reference `.clavix/instructions/workflows/{workflow}.md`

**For troubleshooting:** Check `.clavix/instructions/troubleshooting/`

**For mode clarification:** See `.clavix/instructions/core/clavix-mode.md`

<!-- CLAVIX:END -->
