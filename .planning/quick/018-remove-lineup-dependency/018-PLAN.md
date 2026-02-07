---
phase: quick-018
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  # DELETE
  - src/lib/football/lineups.ts
  - src/lib/queue/workers/lineups.worker.ts
  # MODIFY - Schema & DB
  - src/lib/db/schema.ts
  - src/lib/db/queries.ts
  - src/lib/football/match-analysis.ts
  - drizzle/0013_drop_lineup_columns.sql
  # MODIFY - Queue system
  - src/lib/queue/index.ts
  - src/lib/queue/types.ts
  - src/lib/queue/scheduler.ts
  - src/lib/queue/workers/index.ts
  - src/lib/queue/workers/backfill.worker.ts
  - src/lib/queue/workers/predictions.worker.ts
  # MODIFY - Prompts & content
  - src/lib/football/prompt-builder.ts
  - src/lib/football/api-client.ts
  # MODIFY - UI & text
  - src/app/about/page.tsx
  - src/components/prediction-table.tsx
  - src/lib/league/generate-league-faqs.ts
  # MODIFY - Infrastructure
  - src/lib/logger/modules.ts
  - src/lib/cache/redis.ts
  - src/types/index.ts

must_haves:
  truths:
    - "getMatchesMissingPredictions() returns matches with analysis but WITHOUT requiring lineupsAvailable=true"
    - "Scheduler schedules 4 jobs per match (analysis, odds, predictions, live) - no lineups job"
    - "No lineups worker is created or started"
    - "Backfill worker does not check for or queue missing lineups jobs"
    - "Prompt builder does not include lineup/formation data in prompts"
    - "Build passes with zero TypeScript errors"
  artifacts:
    - path: "drizzle/0013_drop_lineup_columns.sql"
      provides: "Migration to drop 9 lineup columns from match_analysis"
    - path: "src/lib/football/lineups.ts"
      provides: "DELETED - must not exist"
    - path: "src/lib/queue/workers/lineups.worker.ts"
      provides: "DELETED - must not exist"
  key_links:
    - from: "src/lib/db/queries.ts"
      to: "match_analysis table"
      via: "getMatchesMissingPredictions no longer filters on lineupsAvailable"
      pattern: "getMatchesMissingPredictions"
    - from: "src/lib/queue/scheduler.ts"
      to: "queue index"
      via: "No longer imports lineupsQueue or schedules FETCH_LINEUPS"
      pattern: "scheduleMatchJobs"
---

<objective>
Remove all lineup-related code from the codebase. The prediction pipeline currently gates on lineups being available before generating predictions, but this is legacy behavior - the LLM models do not need lineup data. Removing this dependency means predictions can be generated as soon as analysis is complete (at T-30m), without waiting for the T-60m lineups fetch.

Purpose: Simplify the prediction pipeline from 5 scheduled jobs to 4, eliminate a dependency that causes missed predictions when lineups are unavailable, and remove dead code.

Output: Clean codebase with no lineup references, a migration file to drop lineup columns, and a passing build.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/db/schema.ts
@src/lib/db/queries.ts
@src/lib/queue/index.ts
@src/lib/queue/types.ts
@src/lib/queue/scheduler.ts
@src/lib/queue/workers/index.ts
@src/lib/queue/workers/lineups.worker.ts
@src/lib/queue/workers/backfill.worker.ts
@src/lib/queue/workers/predictions.worker.ts
@src/lib/football/lineups.ts
@src/lib/football/api-client.ts
@src/lib/football/prompt-builder.ts
@src/lib/football/match-analysis.ts
@src/lib/logger/modules.ts
@src/lib/cache/redis.ts
@src/types/index.ts
@src/app/about/page.tsx
@src/components/prediction-table.tsx
@src/lib/league/generate-league-faqs.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove lineup schema columns and create migration</name>
  <files>
    src/lib/db/schema.ts
    drizzle/0013_drop_lineup_columns.sql
    src/lib/db/queries.ts
    src/lib/football/match-analysis.ts
  </files>
  <action>
1. **src/lib/db/schema.ts** - Remove these 9 column definitions from the `matchAnalysis` table (lines 191-199 and line 219):
   - Remove lines 191-199 (the comment block and columns: homeFormation, awayFormation, homeStartingXI, awayStartingXI, homeCoach, awayCoach, lineupsAvailable, lineupsUpdatedAt)
   - Remove line 219: `rawLineupsData: text('raw_lineups_data'),`

2. **drizzle/0013_drop_lineup_columns.sql** - Create migration file:
   ```sql
   -- Migration: Drop lineup columns from match_analysis
   -- Lineups are no longer used by the prediction pipeline

   ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_formation;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_formation;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_starting_xi;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_starting_xi;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_coach;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_coach;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_available;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_updated_at;
   ALTER TABLE match_analysis DROP COLUMN IF EXISTS raw_lineups_data;
   ```

3. **src/lib/db/queries.ts** - Three changes:
   - **Remove `updateMatchAnalysisLineups` function** (lines 1427-1453) - entire function deleted
   - **Remove `getMatchesMissingLineups` function** (lines 1666-1688) - entire function deleted
   - **Fix `getMatchesMissingPredictions`** (line 2289): Remove `eq(matchAnalysis.lineupsAvailable, true),` from the `and()` clause. Also update the comment on line 2278 from "Find matches with analysis and lineups but no predictions" to "Find matches with analysis but no predictions"

4. **src/lib/football/match-analysis.ts** - Remove lineup preservation lines (509-518):
   - Remove the comment `// Keep existing lineup data if present` and the following 9 lines that set homeFormation, awayFormation, homeStartingXI, awayStartingXI, homeCoach, awayCoach, lineupsAvailable, lineupsUpdatedAt, rawLineupsData from existing data
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -50` to check for type errors related to removed columns. Grep for `lineupsAvailable|homeFormation|awayFormation|homeStartingXI|awayStartingXI|homeCoach|awayCoach|lineupsUpdatedAt|rawLineupsData|updateMatchAnalysisLineups|getMatchesMissingLineups` across `src/` to find remaining references.</verify>
  <done>Schema has no lineup columns, migration file exists, queries no longer reference lineup fields, match-analysis no longer preserves lineup data.</done>
</task>

<task type="auto">
  <name>Task 2: Remove lineups queue, worker, scheduler job, and backfill step</name>
  <files>
    src/lib/football/lineups.ts
    src/lib/queue/workers/lineups.worker.ts
    src/lib/queue/index.ts
    src/lib/queue/types.ts
    src/lib/queue/scheduler.ts
    src/lib/queue/workers/index.ts
    src/lib/queue/workers/backfill.worker.ts
    src/lib/queue/workers/predictions.worker.ts
  </files>
  <action>
1. **DELETE** `src/lib/football/lineups.ts` - Remove entire file

2. **DELETE** `src/lib/queue/workers/lineups.worker.ts` - Remove entire file

3. **src/lib/queue/index.ts** - Remove lineups queue:
   - Remove `FETCH_LINEUPS: 'fetch-lineups',` from JOB_TYPES (line 23)
   - Remove `LINEUPS: 'lineups-queue',` from QUEUE_NAMES (line 177)
   - Remove the lineups queue factory block (lines 291-296): the `_lineupsQueue` variable, `getLineupsQueue()` function, and `lineupsQueue` proxy export
   - Remove the `case QUEUE_NAMES.LINEUPS:` block from `getQueue()` (lines 383-384)
   - Remove `getLineupsQueue(),` from `getAllQueues()` (line 415)

4. **src/lib/queue/types.ts** - Remove lineup types:
   - Remove the `FetchLineupsPayload` interface (lines 25-31) and its comment
   - Remove `force?: boolean; // Generate even without lineups` from `PredictMatchPayload` (line 38)
   - Remove `| FetchLineupsPayload` from the `JobPayload` union type (line 127)

5. **src/lib/queue/scheduler.ts** - Remove lineups scheduling:
   - Remove `lineupsQueue,` from imports (line 16)
   - Update file header comment: remove "- T-60m: Lineups" line (line 8)
   - Update JOB_PRIORITIES comment: change "lineups, predictions" to just "predictions" (line 35)
   - Remove `[JOB_TYPES.FETCH_LINEUPS]` timeout entry (line 51)
   - Remove the T-60m lineups job object from `jobsToSchedule` array (lines 152-165, the entire object from `// T-60m: Fetch lineups` through `priority:...}`)
   - Update the T-30m comment: change "Generate predictions (single attempt after lineups available)" to "Generate predictions" (line 166)
   - Remove `JOB_TYPES.FETCH_LINEUPS,` from `lateRunnableJobs` set (line 200)
   - Remove `{ queue: lineupsQueue, jobId: \`lineups-\${matchId}\` },` from `cancelMatchJobs` (line 285)

6. **src/lib/queue/workers/index.ts** - Remove lineups worker:
   - Remove `import { createLineupsWorker } from './lineups.worker';` (line 11)
   - Remove `{ name: 'lineups', create: createLineupsWorker },` from workerConfigs array (line 82)

7. **src/lib/queue/workers/backfill.worker.ts** - Remove lineups backfill:
   - Remove `lineupsQueue,` from the import (line 12)
   - Remove `getMatchesMissingLineups,` from the queries import (line 17)
   - Remove `const lineupsHoursAhead = 12;` (line 71)
   - Remove `lineupsTriggered: 0,` from results (line 77)
   - Remove `lineups: lineupsHoursAhead,` from windows (line 84)
   - Update the analysis chain log message (line 155): change "lineups/predictions will be backfilled" to "predictions will be backfilled"
   - Remove entire section 3 "Find matches missing lineups" (lines 214-267)
   - Update the total calculation (line 576-577): remove `results.lineupsTriggered +`
   - Update the log line (line 581): remove `lineups: results.lineupsTriggered,`

8. **src/lib/queue/workers/predictions.worker.ts** - Update comment:
   - Update file header comment (line 6): change "Runs at T-30m (after lineups are available)." to "Runs at T-30m before each match."
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -50`. Verify deleted files don't exist: `ls src/lib/football/lineups.ts src/lib/queue/workers/lineups.worker.ts 2>&1` should show "No such file". Grep for `lineupsQueue|createLineupsWorker|FETCH_LINEUPS|lineupsWorker|getMatchesMissingLineups|updateMatchLineups|areLineupsAvailable|FetchLineupsPayload` across `src/` to confirm zero references.</verify>
  <done>Lineups worker deleted, lineups.ts deleted, queue system has no lineups queue or job type, scheduler schedules 4 jobs (analysis, odds, predictions, live), backfill does not check or queue lineups.</done>
</task>

<task type="auto">
  <name>Task 3: Clean up prompts, API client, types, content, and UI text</name>
  <files>
    src/lib/football/prompt-builder.ts
    src/lib/football/api-client.ts
    src/types/index.ts
    src/lib/logger/modules.ts
    src/lib/cache/redis.ts
    src/app/about/page.tsx
    src/components/prediction-table.tsx
    src/lib/league/generate-league-faqs.ts
  </files>
  <action>
1. **src/lib/football/prompt-builder.ts** - Remove lineup sections from prompts:
   - Line 31: Change `DATA FORMAT: H2H, Form (WDLWW), Stats (%), Lineups, Absences, Table Position` to `DATA FORMAT: H2H, Form (WDLWW), Stats (%), Absences, Table Position`
   - Lines 311-315: Remove the entire lineup block:
     ```
     // Lineups - compressed format (formation + notable absences only)
     if (analysis.lineupsAvailable && analysis.homeFormation && analysis.awayFormation) {
       lines.push(`LINEUPS: ${analysis.homeFormation} vs ${analysis.awayFormation} (confirmed)`);
       lines.push('');
     }
     ```
   - Line 367: Change `DATA: H2H, Form, Stats %, Lineups, Absences` to `DATA: H2H, Form, Stats %, Absences`
   - Lines 456-459: Remove the entire lineups indicator block:
     ```
     // Lineups indicator
     if (analysis.lineupsAvailable) {
       lines.push(`    Lineups: ${analysis.homeFormation || '?'} vs ${analysis.awayFormation || '?'} (confirmed)`);
     }
     ```

2. **src/lib/football/api-client.ts** - Remove fetchLineups function and its type import:
   - Remove `APIFootballLineupsResponse` from the type import on line 122 (keep the other 4 types)
   - Remove the entire `fetchLineups` function (lines 212-228)

3. **src/types/index.ts** - Keep `APIFootballLineupsResponse` interface (lines 322-359). It may still be used by team statistics response at line 413 (`lineups: Array<{...}>` which is formations data, not match lineups). Actually, check: the `lineups` field on line 413 is inside `APIFootballTeamStatisticsResponse` and refers to formation usage stats, NOT match lineups. The `APIFootballLineupsResponse` type is only used by `api-client.ts` (which we're removing the function from) and `lineups.ts` (which is deleted). So REMOVE the `APIFootballLineupsResponse` interface (lines 322-359) and its comment (line 322).

4. **src/lib/logger/modules.ts** - Remove lineup loggers:
   - Remove `lineupsWorker: createLogger('worker:lineups'),` (line 22)
   - Remove `lineups: createLogger('lineups'),` (line 38)

5. **src/lib/cache/redis.ts** - Remove lineup cache entries:
   - Remove `LINEUPS: 300,` and its comment from CACHE_TTL (line 220)
   - Remove `lineups: (fixtureId: number) => \`api:lineups:\${fixtureId}\`,` from cacheKeys (line 376)

6. **src/app/about/page.tsx** - Update text (lines 95-102):
   - Line 95: Change "About 1 hour before kickoff (when lineups are confirmed), we send the same data" to "About 30 minutes before kickoff, we send the same data"
   - Line 102: Change `Recent Form | Team Comparison | Confirmed Lineups | Injuries` to `Recent Form | Team Comparison | Injuries | League Standings`

7. **src/components/prediction-table.tsx** - Update text (line 44):
   - Change "AI predictions are generated when lineups are confirmed (~1 hour before kickoff)" to "AI predictions are generated approximately 30 minutes before kickoff"

8. **src/lib/league/generate-league-faqs.ts** - Update FAQ text:
   - Line 81: Change "The models analyze team form, head-to-head records, standings, and lineups to generate predictions approximately 30 minutes before kickoff." to "The models analyze team form, head-to-head records, and standings to generate predictions approximately 30 minutes before kickoff."
   - Line 93: Change "Predictions for ${name} matches are generated approximately 30 minutes before kickoff, once official team lineups are announced. This ensures predictions incorporate the most relevant team information." to "Predictions for ${name} matches are generated approximately 30 minutes before kickoff. This ensures predictions incorporate the most up-to-date team and match information."
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -50` for type check. Do a final comprehensive grep: `grep -ri "lineup" src/ --include="*.ts" --include="*.tsx" -l` should return zero results (or only `src/types/index.ts` for the team stats `lineups` field which is formation usage stats, not match lineups). Run `npm run build` to verify full production build passes.</verify>
  <done>No lineup references remain in prompts, API client, types, loggers, cache, or UI text. Build passes cleanly. The word "lineup" only appears in `APIFootballTeamStatisticsResponse.lineups` which is formation usage statistics, not match lineup data.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npm run build` completes successfully (use `--webpack` flag if turbopack has SWC issues locally)
3. `grep -ri "lineup" src/ --include="*.ts" --include="*.tsx"` only returns the `lineups` field in `APIFootballTeamStatisticsResponse` (formation usage stats, unrelated)
4. `grep -ri "lineupsAvailable\|lineupsQueue\|FETCH_LINEUPS\|lineupsWorker\|fetchLineups\|updateMatchLineups\|areLineupsAvailable\|getMatchesMissingLineups\|updateMatchAnalysisLineups\|FetchLineupsPayload\|rawLineupsData" src/` returns zero results
5. `ls src/lib/football/lineups.ts src/lib/queue/workers/lineups.worker.ts 2>&1` shows both files do not exist
6. `cat drizzle/0013_drop_lineup_columns.sql` shows 9 ALTER TABLE DROP COLUMN statements
</verification>

<success_criteria>
- Zero lineup-related code remains in the codebase (except `APIFootballTeamStatisticsResponse.lineups` formation stats field)
- Prediction pipeline: analysis -> predictions (no lineups gate)
- Scheduler creates 4 jobs per match (was 5)
- Backfill worker checks 6 things (was 7, no lineups step)
- Migration file ready to run on production database
- Production build passes
</success_criteria>

<output>
After completion, create `.planning/quick/018-remove-lineup-dependency/018-SUMMARY.md`
</output>
