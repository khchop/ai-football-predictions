---
phase: quick
plan: 021
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/deploy/post-deploy.ts
  - src/instrumentation.ts
  - src/lib/queue/types.ts
  - src/lib/queue/workers/backfill.worker.ts
autonomous: true

must_haves:
  truths:
    - "Post-deploy tasks run automatically on every app startup"
    - "Completed tasks are never re-run (idempotent via deploy_tasks table)"
    - "Failed tasks do not block app startup"
    - "Deep retroactive backfill (90 days) queues through BullMQ workers"
    - "Lineup columns are dropped from match_analysis table"
  artifacts:
    - path: "src/lib/deploy/post-deploy.ts"
      provides: "Post-deploy task runner with PostgreSQL tracking"
      exports: ["runPostDeployTasks"]
    - path: "src/instrumentation.ts"
      provides: "Startup integration calling runPostDeployTasks"
  key_links:
    - from: "src/instrumentation.ts"
      to: "src/lib/deploy/post-deploy.ts"
      via: "dynamic import and call runPostDeployTasks()"
      pattern: "runPostDeployTasks"
    - from: "src/lib/deploy/post-deploy.ts"
      to: "src/lib/queue/index.ts"
      via: "dynamic import for backfill queue"
      pattern: "backfillQueue"
---

<objective>
Automate all post-deploy tasks so nothing requires manual intervention after deploy.

Purpose: Eliminate manual psql commands and script execution after every deployment. Future deploy tasks just get added to a TASKS array.
Output: Idempotent post-deploy task runner integrated into startup flow, with two initial tasks registered (drop lineup columns, deep retroactive backfill).
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/instrumentation.ts
@src/lib/db/index.ts
@src/lib/queue/index.ts
@src/lib/queue/types.ts
@src/lib/queue/workers/backfill.worker.ts
@drizzle/0013_drop_lineup_columns.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create post-deploy task runner and register initial tasks</name>
  <files>
    src/lib/deploy/post-deploy.ts
    src/lib/queue/types.ts
    src/lib/queue/workers/backfill.worker.ts
  </files>
  <action>
Create `src/lib/deploy/post-deploy.ts` (NEW file) with:

1. **PostDeployTask interface:**
```typescript
interface PostDeployTask {
  id: string;       // Unique, never reused (e.g., "drop-lineup-columns-v1")
  name: string;     // Human-readable description
  run: () => Promise<void>;
}
```

2. **deploy_tasks tracking table** (raw SQL via drizzle `db.execute(sql\`...\`)`):
- Use `CREATE TABLE IF NOT EXISTS deploy_tasks (id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), result TEXT)` on each run
- Import `getDb` from `@/lib/db` and `sql` from `drizzle-orm`

3. **runPostDeployTasks() function:**
- Create a logger via `loggers.deploy` (add `deploy` to logger modules if needed, or use `loggers.instrumentation.child({ component: 'post-deploy' })`)
- Ensure deploy_tasks table exists (CREATE TABLE IF NOT EXISTS)
- Query all completed task IDs: `SELECT id FROM deploy_tasks`
- Iterate through TASKS array
- Skip tasks whose id is already in completed set
- For each new task: try/catch the `run()`, then INSERT into deploy_tasks with result 'success' or the error message
- Log each task start/skip/success/failure
- NEVER throw - all errors are caught and logged, startup continues

4. **TASKS array** with two initial tasks:

**Task: drop-lineup-columns-v1**
- Run 9 ALTER TABLE DROP COLUMN IF EXISTS statements on match_analysis (matching `drizzle/0013_drop_lineup_columns.sql` exactly)
- Use `db.execute(sql\`ALTER TABLE match_analysis DROP COLUMN IF EXISTS ...\`)` for each column
- Columns: home_formation, away_formation, home_starting_xi, away_starting_xi, home_coach, away_coach, lineups_available, lineups_updated_at, raw_lineups_data
- Use a single sql template literal with all 9 statements separated by semicolons

**Task: deep-retroactive-backfill-90d-v1**
- Dynamically import `backfillQueue` and `JOB_TYPES` from `@/lib/queue`
- Queue a single backfill job:
  ```typescript
  await backfillQueue.add(
    JOB_TYPES.BACKFILL_MISSING,
    { manual: true, retroDays: 90 },
    { jobId: 'deploy-deep-backfill-90d', delay: 30000, priority: 3 }
  );
  ```
- The 30s delay ensures workers are fully booted before this runs

5. **Modify `src/lib/queue/types.ts`:**
- Add `retroDays?: number` to `BackfillMissingPayload` interface (after the `type` field)

6. **Modify `src/lib/queue/workers/backfill.worker.ts`:**
- In step 7 (retroactive backfill, around line 358-359), destructure `retroDays` from `job.data` alongside `hoursAhead` and `type` on line 30
- Change `getMatchesMissingRetroactivePredictions(30)` to `getMatchesMissingRetroactivePredictions(retroDays ?? 30)` so the deploy task can pass 90 for a one-time deep scan
- No other changes to the backfill worker logic

**Important:** Use dynamic imports for queue modules inside the task runner to avoid importing queue infrastructure at module level (same pattern as instrumentation.ts).
  </action>
  <verify>
- `npx tsc --noEmit` passes (no type errors)
- `npm run build` (or `npx next build --webpack` if turbopack SWC missing) succeeds
- Verify `src/lib/deploy/post-deploy.ts` exists and exports `runPostDeployTasks`
- Verify `BackfillMissingPayload` in types.ts includes `retroDays?: number`
- Verify backfill worker references `retroDays ?? 30` instead of hardcoded 30
  </verify>
  <done>
- Post-deploy task runner exists with PostgreSQL-backed idempotency tracking
- Two tasks registered: lineup column drop and deep 90-day retroactive backfill
- Backfill worker accepts optional `retroDays` parameter
- All code compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate post-deploy runner into startup flow</name>
  <files>
    src/instrumentation.ts
  </files>
  <action>
Modify `src/instrumentation.ts` to call the post-deploy task runner.

Insert a new step between step 1 (model sync) and step 1.5 (cache warming). Call it step 1.2:

```typescript
// 1.2. Run post-deploy tasks (idempotent, non-fatal)
try {
  const { runPostDeployTasks } = await import('./lib/deploy/post-deploy');
  const deployResult = await runPostDeployTasks();
  loggers.instrumentation.info(
    { ran: deployResult.ran, skipped: deployResult.skipped, failed: deployResult.failed },
    'Post-deploy tasks completed'
  );
} catch (deployError) {
  loggers.instrumentation.warn(
    { error: deployError instanceof Error ? deployError.message : String(deployError) },
    'Post-deploy tasks failed (non-fatal)'
  );
}
```

This means `runPostDeployTasks()` should return `{ ran: number, skipped: number, failed: number }`. Update the function signature in `src/lib/deploy/post-deploy.ts` accordingly:
- Track counts: ran (successfully executed), skipped (already completed), failed (errored)
- Return the counts object

**Placement rationale:** After model sync (need DB), before cache warming (migrations may affect cache), before workers start (backfill task queues jobs that workers will pick up).
  </action>
  <verify>
- `npx tsc --noEmit` passes
- `npm run build` (or `npx next build --webpack`) succeeds
- Verify instrumentation.ts has the post-deploy step between model sync and cache warming
- Grep for `runPostDeployTasks` in instrumentation.ts confirms integration
  </verify>
  <done>
- App startup calls runPostDeployTasks() after model sync, before cache warming
- Startup continues even if post-deploy tasks fail
- Logging shows task execution counts (ran/skipped/failed)
- Zero manual intervention required after deploy
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit` - no errors
2. Production build: `npm run build` or `npx next build --webpack` - succeeds
3. Code review: `src/lib/deploy/post-deploy.ts` has idempotent task runner with deploy_tasks table
4. Code review: `src/instrumentation.ts` calls runPostDeployTasks() in correct position
5. Code review: `src/lib/queue/types.ts` has `retroDays?: number` on BackfillMissingPayload
6. Code review: backfill worker uses `retroDays ?? 30` for retroactive scan window
</verification>

<success_criteria>
- Post-deploy task runner exists and is called on every startup
- deploy_tasks PostgreSQL table provides idempotent tracking
- Two tasks registered: drop-lineup-columns-v1, deep-retroactive-backfill-90d-v1
- Failed tasks do not block startup
- Completed tasks are never re-run
- Adding future tasks = add object to TASKS array, done
</success_criteria>

<output>
After completion, create `.planning/quick/021-auto-post-deploy-tasks/021-SUMMARY.md`
</output>
