---
phase: 71
plan: 01
subsystem: content-generation
tags:
  - ai-content
  - seo
  - team-pages
  - database
dependency_graph:
  requires:
    - team-stats queries (phase 67)
    - OpenRouter client (phase 59-62)
    - Redis cache (v1.0)
  provides:
    - teamContent table schema
    - team content query functions
    - team analysis generation
    - team FAQ generation
  affects:
    - team page rendering (phase 71-02)
    - content queue workers (phase 71-02)
tech_stack:
  added:
    - team_content table (PostgreSQL)
  patterns:
    - Direct imports to avoid circular deps
    - Redis caching with 5min TTL
    - Upsert on conflict (teamName unique)
    - Anti-hallucination prompts
key_files:
  created:
    - src/lib/content/team-content.ts
    - src/lib/db/queries/team-content.ts
    - scripts/migrate-team-content.ts
  modified:
    - src/lib/db/schema.ts
decisions:
  - title: Use text timestamps (not timestamp type)
    rationale: Match existing matchContent pattern for consistency
    alternatives: [timestamp type, integer unix timestamps]
  - title: Separate analysisGeneratedAt and faqGeneratedAt
    rationale: Allow independent generation of analysis vs FAQs
    alternatives: [single generatedAt field]
  - title: Skip teams with <5 matches
    rationale: Insufficient data for meaningful analysis
    alternatives: [generate anyway with disclaimer, set higher threshold]
  - title: Direct imports (./together-client vs barrel)
    rationale: Avoid circular dependency issues (MEMORY.md lesson)
    alternatives: [use barrel file with dynamic imports]
metrics:
  duration_seconds: 275
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  commits: 2
  completed_at: "2026-02-12T10:10:41Z"
---

# Phase 71 Plan 01: Team Content Database and Generation Summary

**One-liner:** Team analysis and FAQ generation infrastructure using DeepSeek V3.1 with anti-hallucination prompts and <5 match filtering

## Objective

Add the database schema and AI content generation infrastructure for team pages. Create the data layer (teamContent table) and generation functions (analysis prose + FAQ JSON) that Phase 71 Plan 02 will wire into the queue worker and team page UI.

## Implementation

### Task 1: Database Schema and Query Functions

**Commit:** 6a13171

**Schema additions:**
- Added `teamContent` table to schema.ts after matchContent definition
- Columns: id (PK), teamName (unique), analysis, analysisGeneratedAt, faqContent, faqGeneratedAt, generatedBy, totalTokens, totalCost, timestamps
- Index on teamName for fast lookups
- Follows matchContent patterns: text timestamps, string cost for precision

**Query functions:**
- `getTeamContent(teamName)`: Fetch with Redis caching (5 min TTL), uses `withCache` helper
- `upsertTeamAnalysis()`: Insert/update analysis text, invalidate cache with `cacheDelete`
- `upsertTeamFAQs()`: Insert/update FAQ JSON array, invalidate cache
- Uses `onConflictDoUpdate` targeting `teamContent.teamName` for idempotent upserts

**Migration:**
- Created TypeScript migration script using Drizzle `db.execute(sql`...`)`
- Ran with `node -r dotenv/config -r tsx/cjs` to load env vars
- Created table and index successfully

### Task 2: Content Generation Functions

**Commit:** 2836cd3

**generateTeamAnalysis(teamName):**
- Fetches: team stats, form guide (5 matches), model leaderboard (top 5)
- Skips teams with <5 matches (logs warning, returns early)
- Prompt: 3-4 paragraphs (200-250 words) covering form, goals, AI model performance
- Anti-hallucination rules: no player names, injuries, managers, transfers, league positions
- Uses actual model names from leaderboard (displayName, not generic placeholders)
- Sanitizes + validates content before saving
- Records tokens and cost estimate

**generateTeamFAQs(teamName):**
- Fetches: team stats, form guide, model leaderboard, overall stats (active model count)
- Skips teams with <5 matches
- Prompt: 5-7 structured Q&A pairs with required questions:
  1. Win-loss record (exact stats)
  2. Best performing AI model (name + accuracy)
  3. AI prediction accuracy (percentages from top models)
  4. Recent form (interpret W/D/L string)
  5. How many AI models track this team
  6-7. Optional: home/away, goals per game
- Returns JSON array with `{question, answer}` format
- Validates array, sanitizes fields, checks min lengths
- Stores as JSON string in faqContent column

**Shared patterns:**
- Direct imports: `./together-client`, `./config`, `./sanitization` (no barrel file)
- Error handling: throws RetryableContentError for BullMQ retry logic
- Logging: uses `loggers.content` for success/failure tracking
- Validation: `validateGeneratedContent()`, `validateNoHtml()`
- Uses DeepSeek V3.1 via OpenRouter (CONTENT_CONFIG.model)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

**TypeScript compilation:**
```bash
npx tsc --noEmit --skipLibCheck
# No errors in team-content.ts or schema.ts
```

**Schema export verification:**
```typescript
import { teamContent, TeamContent } from '@/lib/db';
// Types accessible via barrel re-export
```

**Query function signatures:**
- `getTeamContent(teamName: string): Promise<TeamContent | null>` ✓
- `upsertTeamAnalysis(teamName, analysis, metadata): Promise<void>` ✓
- `upsertTeamFAQs(teamName, faqs, metadata): Promise<void>` ✓

**Generation function signatures:**
- `generateTeamAnalysis(teamName: string): Promise<void>` ✓
- `generateTeamFAQs(teamName: string): Promise<void>` ✓

**Import verification:**
- No imports from `@/lib/content` barrel file ✓
- All direct imports: `./together-client`, `./config`, `./sanitization` ✓

**Database migration:**
```
✓ Migration complete
- team_content table created
- idx_team_content_team_name index created
```

## Technical Notes

**Circular dependency prevention:**
Following MEMORY.md lesson from phase quick-013, team-content.ts uses only direct imports. The LLM barrel file (`src/lib/content/index.ts`) can safely re-export from team-content.ts without creating a cycle because team-content.ts never imports back from the barrel.

**Cache strategy:**
- Read: 5 min TTL via `withCache(key, ttl, fetchFn)`
- Write: Immediate invalidation via `cacheDelete(key)`
- Targeted invalidation (one team at a time, not global flush)

**Type corrections during implementation:**
LeaderboardEntryWithTrend uses `displayName` (not `modelName`) and `correctTendencies` (not `correctPredictions`). Fixed in prompts to use correct property names.

**Cost estimation:**
DeepSeek V3.1 pricing: $0.15/M input, $0.75/M output
- Analysis generation: ~600 tokens (prompt) + ~300 tokens (output) = ~$0.0003/team
- FAQ generation: ~800 tokens (prompt) + ~500 tokens (output) = ~$0.0006/team
- Total per team: ~$0.0009 (less than $0.001)
- 200 teams × $0.001 = ~$0.20 total for full generation batch

## Self-Check: PASSED

**Created files exist:**
```bash
[ -f "src/lib/content/team-content.ts" ] && echo "FOUND: src/lib/content/team-content.ts"
# FOUND: src/lib/content/team-content.ts

[ -f "src/lib/db/queries/team-content.ts" ] && echo "FOUND: src/lib/db/queries/team-content.ts"
# FOUND: src/lib/db/queries/team-content.ts

[ -f "scripts/migrate-team-content.ts" ] && echo "FOUND: scripts/migrate-team-content.ts"
# FOUND: scripts/migrate-team-content.ts
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "6a13171" && echo "FOUND: 6a13171"
# FOUND: 6a13171

git log --oneline --all | grep -q "2836cd3" && echo "FOUND: 2836cd3"
# FOUND: 2836cd3
```

**Schema modification verified:**
```bash
grep -q "teamContent = pgTable" src/lib/db/schema.ts && echo "FOUND: teamContent table definition"
# FOUND: teamContent table definition
```

All artifacts present and verified.

## Next Steps

Phase 71 Plan 02 will:
1. Create BullMQ worker to process team content generation queue
2. Wire generateTeamAnalysis and generateTeamFAQs into queue jobs
3. Add team content rendering to team detail pages
4. Create admin trigger to queue all teams for content generation

---

*Completed 2026-02-12 in 275 seconds (2 tasks, 2 commits)*
