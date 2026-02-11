---
quick: 017
type: execute
autonomous: true
files_modified:
  - src/lib/db/queries.ts
  - src/lib/queue/workers/backfill.worker.ts
---

<objective>
Add automated retroactive prediction backfill as step 8 in the hourly backfill worker.

**Purpose:** Eliminate manual retroactive backfill script runs by automating detection and queuing of matches from the last 7 days that have fewer than 42 predictions.

**Output:** Worker automatically queues retroactive analysis/prediction/settlement jobs for matches that slipped through the forward-looking pipeline (server restarts, API failures, worker crashes).
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
**Current state:**
- Backfill worker runs hourly with 7 steps (stuck matches, analysis, odds, lineups, predictions, settlement, zero-prediction settlement, pipeline health)
- All existing steps use forward-looking queries (`status='scheduled'`, `kickoffTime >= now`)
- Retroactive script exists (`scripts/backfill-retroactive-predictions.ts`) but runs manually
- Retroactive script uses backward-looking query (7 days, `status IN ('scheduled','live','finished')`, `allowRetroactive: true`)

**The gap:**
Forward-looking steps miss finished/live matches that had pipeline failures. Retroactive backfill currently requires manual intervention.

**Key difference:**
- Forward-looking: `WHERE status = 'scheduled' AND kickoffTime >= now`
- Retroactive: `WHERE status IN ('scheduled', 'live', 'finished') AND kickoffTime >= (now - 7 days) AND predictionCount < 42`

**Files:**
@src/lib/queue/workers/backfill.worker.ts (existing 7 steps)
@scripts/backfill-retroactive-predictions.ts (query pattern to copy)
@src/lib/db/queries.ts (add new query function)
</context>

<tasks>

<task type="auto">
  <name>Add retroactive predictions query to queries.ts</name>
  <files>src/lib/db/queries.ts</files>
  <action>
Add `getMatchesMissingRetroactivePredictions(days: number)` after the existing `getMatchesMissingPredictions()` function (around line 2301).

**Implementation:**
1. Use the query from `scripts/backfill-retroactive-predictions.ts` lines 54-88 as template
2. Return type: `Promise<Match[]>` (same as other getMatchesMissing* functions)
3. Query logic:
   - `LEFT JOIN` predictions, `LEFT JOIN` matchAnalysis
   - `WHERE`: kickoffTime >= (now - days), externalId IS NOT NULL, status IN ('scheduled','live','finished')
   - `GROUP BY` all match columns
   - `HAVING`: COUNT(DISTINCT predictions.id) < 42
   - `ORDER BY` kickoffTime DESC
4. Also return `hasAnalysis` boolean (for worker to decide if analysis job needed)

**Important:** Keep the same GROUP BY fields as `getMatchesMissingPredictions()` for consistency (all match columns).

**Example return shape:**
```typescript
// Return full Match object (consistent with other queries)
// Worker will check matchAnalysis.favoriteTeamName separately if needed
return results.map(r => r.match);
```
  </action>
  <verify>
TypeScript compiles without errors (`npm run build`).
Query returns matches from last 7 days with < 42 predictions.
  </verify>
  <done>
New query function exists in queries.ts and exports correctly.
  </done>
</task>

<task type="auto">
  <name>Add retroactive backfill step to worker</name>
  <files>src/lib/queue/workers/backfill.worker.ts</files>
  <action>
Add step 8 (retroactive backfill) after step 7 (zero-prediction settlement) and before pipeline health check.

**Location:** Insert between line 407 (end of step 7) and line 409 (pipeline health check comment).

**Implementation:**
1. Import the new query: `import { ..., getMatchesMissingRetroactivePredictions } from '@/lib/db/queries';`
2. Add step comment: `// 8. Retroactive backfill - find matches from last 7 days with < 42 predictions`
3. Call query: `const retroGaps = await getMatchesMissingRetroactivePredictions(7);`
4. For each gap:
   - Check if analysis exists (query matchAnalysis table by matchId)
   - If no analysis AND externalId exists: queue analysis job with `jobId: retro-analyze-${matchId}`, payload includes `allowRetroactive: true`
   - Always queue predictions job with `jobId: retro-predict-${matchId}`, payload includes `allowRetroactive: true`
   - If status === 'finished' AND scores exist: queue settlement job with `jobId: retro-settle-${matchId}`
5. Track counts in results object: `retroAnalysisTriggered`, `retroPredictionsTriggered`, `retroScoringsTriggered`
6. Wrap entire step in try/catch (log warning, don't throw - step is non-critical)
7. Use same error tracking pattern as other steps (addError helper)
8. Check for existing jobs before queuing (same pattern as other steps)

**CRITICAL: Use allowRetroactive flag:**
```typescript
await analysisQueue.add(JOB_TYPES.ANALYZE_MATCH, {
  matchId: match.id,
  externalId: match.externalId,
  homeTeam: match.homeTeam,
  awayTeam: match.awayTeam,
  allowRetroactive: true, // ← Bypass status checks in worker
}, { jobId: `retro-analyze-${match.id}`, delay: 1000 });
```

**Don't wait for jobs** — unlike the manual script, just queue and let workers process asynchronously.

**Log at INFO level when retroactive gaps found** (similar to existing steps).
  </action>
  <verify>
1. Worker compiles: `npm run build`
2. Worker logs show step 8 executing after step 7
3. Test query returns matches with < 42 predictions from last 7 days
4. Jobs queued with `retro-*` prefix and `allowRetroactive: true` payload
  </verify>
  <done>
Backfill worker runs step 8 hourly, queuing retroactive jobs for matches from last 7 days with < 42 predictions.
Manual script still exists as fallback but no longer required for routine backfill.
  </done>
</task>

</tasks>

<verification>
**Query verification:**
```bash
# Check query exists and exports
grep -n "getMatchesMissingRetroactivePredictions" src/lib/db/queries.ts
```

**Worker verification:**
```bash
# Check retroactive step exists
grep -n "retroactive backfill" src/lib/queue/workers/backfill.worker.ts
grep -n "allowRetroactive: true" src/lib/queue/workers/backfill.worker.ts
```

**Build verification:**
```bash
npm run build
```

**Integration check (optional — requires dev environment):**
```bash
# Trigger backfill job manually to test retroactive step
curl -X POST http://localhost:3000/api/admin/queue/backfill
# Check worker logs for "retroactive backfill" step output
```
</verification>

<success_criteria>
- [ ] `getMatchesMissingRetroactivePredictions(days)` function exists in queries.ts
- [ ] Function returns matches from last N days with < 42 predictions (scheduled, live, or finished)
- [ ] Backfill worker imports new query function
- [ ] Step 8 runs after step 7, before pipeline health check
- [ ] Retroactive jobs queued with `retro-*` job IDs and `allowRetroactive: true` flag
- [ ] Worker logs retroactive gaps at INFO level (when found)
- [ ] Build passes without errors
- [ ] Manual script (`scripts/backfill-retroactive-predictions.ts`) still exists as fallback
</success_criteria>

<output>
After completion, create `.planning/quick/017-automate-retroactive-backfill/017-SUMMARY.md` with:
- Implementation details (query pattern, step location, job IDs)
- Testing notes (how to verify retroactive step works)
- Manual script status (still exists as fallback)
</output>
