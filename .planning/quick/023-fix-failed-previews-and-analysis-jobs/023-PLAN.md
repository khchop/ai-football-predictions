---
phase: quick-023
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/requeue-dlq-jobs.ts
autonomous: true

must_haves:
  truths:
    - "343 preview DLQ entries are requeued to content-queue and removed from DLQ"
    - "34 analysis DLQ entries are requeued to analysis-queue with allowRetroactive flag and removed from DLQ"
    - "Script reports summary of requeued vs skipped vs failed entries"
  artifacts:
    - path: "scripts/requeue-dlq-jobs.ts"
      provides: "One-time DLQ requeue script"
  key_links:
    - from: "scripts/requeue-dlq-jobs.ts"
      to: "src/lib/queue/dead-letter.ts"
      via: "getDeadLetterJobs, deleteDeadLetterEntry"
      pattern: "getDeadLetterJobs|deleteDeadLetterEntry"
    - from: "scripts/requeue-dlq-jobs.ts"
      to: "src/lib/queue/index.ts"
      via: "getQueue, QUEUE_NAMES"
      pattern: "getQueue|QUEUE_NAMES"
---

<objective>
Create and run a one-time script to requeue 343 preview and 34 analysis failed jobs from the DLQ back to their respective queues, now that the root causes are fixed (unique constraint for previews, retroactive flag for analysis).

Purpose: Clear DLQ backlog so failed jobs can succeed with the fixes deployed in quick-022 and earlier.
Output: `scripts/requeue-dlq-jobs.ts` — run once, then the DLQ should be empty or near-empty.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/queue/dead-letter.ts
@src/lib/queue/index.ts
@src/lib/queue/types.ts
@scripts/investigate-settlement-failures.ts (pattern reference for script structure)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create and run DLQ requeue script</name>
  <files>scripts/requeue-dlq-jobs.ts</files>
  <action>
Create `scripts/requeue-dlq-jobs.ts` following the pattern in `scripts/investigate-settlement-failures.ts` for env loading and Redis connection setup.

The script should:

1. **Load env and connect to Redis:**
   - `dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })`
   - Import `getQueueConnection`, `getQueue`, `QUEUE_NAMES` from `../src/lib/queue`
   - Import `getDeadLetterJobs`, `getDeadLetterCount`, `deleteDeadLetterEntry` from `../src/lib/queue/dead-letter`

2. **Read ALL DLQ entries:**
   - First call `getDeadLetterCount()` to get total count
   - Then `getDeadLetterJobs(totalCount, 0)` to get all entries in one call
   - Log total count found

3. **Categorize entries by queueName:**
   - Group into `content-queue` entries (previews) and `analysis-queue` entries
   - Log counts per queue
   - Log any entries from other queues (unexpected — skip these)

4. **Requeue content-queue (preview) entries:**
   - For each entry where `entry.queueName === 'content-queue'`:
     - Get the content queue: `getQueue(QUEUE_NAMES.CONTENT)`
     - The original job data is in `entry.data` which is a `GenerateContentPayload` (`{ type: 'match_preview', data: { matchId, homeTeam, awayTeam, ... } }`)
     - Add to queue: `contentQueue.add('generate-match-preview', entry.data, { jobId: \`requeue-preview-${entry.data.data.matchId}\` })`
     - Use `requeue-preview-` prefix on jobId to avoid collision with any existing `preview-` jobs
     - After successful add, delete from DLQ: `deleteDeadLetterEntry(entry.queueName, entry.jobId)`
     - Track success/fail counts
     - Wrap each in try/catch — if one fails (e.g., "job already exists"), log and continue

5. **Requeue analysis-queue entries:**
   - For each entry where `entry.queueName === 'analysis-queue'`:
     - Get the analysis queue: `getQueue(QUEUE_NAMES.ANALYSIS)`
     - The original job data is in `entry.data` which is an `AnalyzeMatchPayload` (`{ matchId, externalId, homeTeam, awayTeam }`)
     - IMPORTANT: Add `allowRetroactive: true` to the payload since these matches are now past kickoff
     - Add to queue: `analysisQueue.add('analyze-match', { ...entry.data, allowRetroactive: true }, { jobId: \`requeue-analyze-${entry.data.matchId}\`, priority: 3 })`
     - After successful add, delete from DLQ: `deleteDeadLetterEntry(entry.queueName, entry.jobId)`
     - Track success/fail counts

6. **Print summary:**
   ```
   === DLQ Requeue Summary ===
   Total DLQ entries found: X

   Content queue (previews):
     Found: X
     Requeued: X
     Failed/Skipped: X

   Analysis queue:
     Found: X
     Requeued: X
     Failed/Skipped: X

   Other queues (skipped): X

   DLQ entries remaining: X (call getDeadLetterCount again)
   ```

7. **Cleanup:** Call `closeQueueConnection()` and `process.exit(0)` at end (import `closeQueueConnection` from queue index).

**Important implementation details:**
- Add a small delay between requeues (50ms) to avoid overwhelming Redis — use `await new Promise(r => setTimeout(r, 50))`
- Use `--dry-run` flag support: if `process.argv.includes('--dry-run')`, log what WOULD be done but don't actually requeue or delete
- Handle the case where `entry.data` might be a string (JSON.parse it) since DLQ stores serialized data

**Run the script after creation:**
- First with `--dry-run`: `npx tsx scripts/requeue-dlq-jobs.ts --dry-run`
- If dry run looks correct, run for real: `npx tsx scripts/requeue-dlq-jobs.ts`
- NOTE: This must be run against the PRODUCTION Redis. If `.env.local` has production Redis URL, it will work. If not, this needs to be run on the server. In that case, skip running and note it needs to be run in production.

Check `.env.local` first to see if REDIS_URL is set. If it points to localhost or is missing, note this needs production execution and skip running.
  </action>
  <verify>
    - Script compiles: `npx tsx --eval "import './scripts/requeue-dlq-jobs'" 2>&1 | head -5` (just check syntax, don't run)
    - If safe to run locally: dry-run output shows correct categorization of DLQ entries
    - If run for real: DLQ count drops to 0 (or near-0 for any that legitimately can't be retried)
  </verify>
  <done>
    - Script exists at `scripts/requeue-dlq-jobs.ts` with dry-run support
    - Script categorizes DLQ entries by queue and requeues with correct payloads
    - Analysis jobs get `allowRetroactive: true` added
    - Preview jobs get requeued with original payload intact
    - Successfully requeued entries are removed from DLQ
    - Either script has been run and DLQ is cleared, OR instructions provided for production execution
  </done>
</task>

</tasks>

<verification>
- `scripts/requeue-dlq-jobs.ts` exists and has no TypeScript errors
- Script handles both content-queue and analysis-queue DLQ entries
- Analysis requeue adds `allowRetroactive: true`
- Script has `--dry-run` mode for safe testing
- DLQ cleared after successful run (or ready to be run in production)
</verification>

<success_criteria>
- 343 preview DLQ entries requeued to content-queue (or ready to be)
- 34 analysis DLQ entries requeued to analysis-queue with allowRetroactive (or ready to be)
- DLQ empty or near-empty after execution
- Script is idempotent (safe to run again — uses unique jobIds with `requeue-` prefix)
</success_criteria>

<output>
After completion, create `.planning/quick/023-fix-failed-previews-and-analysis-jobs/023-SUMMARY.md`
</output>
