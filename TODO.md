# TODO: Content System Implementation

**Generated:** 2026-01-23  
**Goal:** Replace raw odds panel with 3-section narrative content + blog pages  
**Total Word Count:** ~500 words per match  
**Status:** In Progress

---

## Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database & Schema | In Progress |
| 2 | Content Generation Functions | Pending |
| 3 | Hook into Job Flow | Pending |
| 4 | Update Match Page | Pending |
| 5 | Blog Pages | Pending |
| 6 | Test & Verify | Pending |

---

## Phase 1: Database & Schema

### Tasks

- [x] Delete old TODO.md
- [ ] Create migration `drizzle/0008_add_match_content.sql`
- [ ] Add `matchContent` table to `src/lib/db/schema.ts`
- [ ] Run `npx drizzle-kit push` to apply migration

### Files to Create/Modify

| File | Action |
|------|--------|
| `drizzle/0008_add_match_content.sql` | Create |
| `src/lib/db/schema.ts` | Edit (add matchContent table) |

---

## Phase 2: Content Generation Functions

### Tasks

- [ ] Create `src/lib/content/match-content.ts` with 3 functions
- [ ] Add prompts for pre-match (~150-200 words), betting (~150-200 words), post-match (~150-200 words)
- [ ] Update `src/lib/content/queries.ts` with content CRUD queries
- [ ] Test content generation locally

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/content/match-content.ts` | Create |
| `src/lib/content/queries.ts` | Edit |

### Content Distribution

- **Pre-match:** ~150-200 words (odds/market summary)
- **Betting:** ~150-200 words (AI predictions summary)
- **Post-match:** ~150-200 words (results/performance)
- **Total:** ~500 words per match

---

## Phase 3: Hook into Job Flow

### Tasks

- [ ] `odds.worker.ts` - Trigger pre-match content after odds refresh
- [ ] `predictions.worker.ts` - Trigger betting content after predictions
- [ ] `scoring.worker.ts` - Trigger post-match content after scoring

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/lib/queue/workers/odds.worker.ts` | ~48 | Add generatePreMatchContent() call (non-blocking) |
| `src/lib/queue/workers/predictions.worker.ts` | ~166 | Add generateBettingContent() call (non-blocking) |
| `src/lib/queue/workers/scoring.worker.ts` | ~165 | Add generatePostMatchContent() call (non-blocking) |

---

## Phase 4: Update Match Page

### Tasks

- [ ] Create `src/components/match/MatchContent.tsx` component
- [ ] Remove odds panel from match page (lines 268-494)
- [ ] Add MatchContentSection component to page
- [ ] Keep AI Model Bets table (lines 496-575)

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/match/MatchContent.tsx` | Create |
| `src/app/predictions/[league]/[slug]/page.tsx` | Edit |

---

## Phase 5: Blog Pages

### Tasks

- [ ] Install `react-markdown` dependency
- [ ] Create `src/app/blog/page.tsx` (blog index)
- [ ] Create `src/app/blog/[slug]/page.tsx` (blog post with markdown)
- [ ] Add blog queries to `src/lib/db/queries.ts`

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/blog/page.tsx` | Create |
| `src/app/blog/[slug]/page.tsx` | Create |
| `src/lib/db/queries.ts` | Edit |

---

## Phase 6: Test & Verify

### Tasks

- [ ] Verify build passes (`npm run build`)
- [ ] Test content generation manually
- [ ] Verify match page displays content
- [ ] Verify blog pages render markdown
- [ ] Verify no TypeScript errors

---

## Technical Details

### Content Generation Triggers

| Content | Trigger | Worker | Timing |
|---------|---------|--------|--------|
| Pre-match | After odds refresh | odds.worker.ts | ~6h before |
| Betting | After predictions | predictions.worker.ts | ~30m before |
| Post-match | After scoring | scoring.worker.ts | After match |

### Database Schema

**Table:** `match_content`

- `id` TEXT PRIMARY KEY
- `match_id` TEXT UNIQUE (cascade delete)
- `pre_match_content` TEXT (nullable)
- `pre_match_generated_at` TEXT (nullable)
- `betting_content` TEXT (nullable)
- `betting_generated_at` TEXT (nullable)
- `post_match_content` TEXT (nullable)
- `post_match_generated_at` TEXT (nullable)
- `generated_by` TEXT (default: Llama 4 Maverick)
- `total_tokens` INTEGER
- `total_cost` TEXT
- `created_at` TEXT
- `updated_at` TEXT

### Implementation Notes

- All content generation is **non-blocking** - failures logged but don't affect job success
- Show **nothing** if content missing (user preference)
- Use **markdown** for blog posts (better SEO via semantic HTML)
- Content progresses: pre-match → betting → post-match
- Each section is independent and can be regenerated

---

**Last Updated:** 2026-01-23
