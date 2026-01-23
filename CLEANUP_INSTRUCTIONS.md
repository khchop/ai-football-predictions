# Fresh Start Cleanup Instructions

**Date:** 2026-01-23  
**Status:** Code changes deployed, awaiting database cleanup

---

## ✅ What's Been Done

### 1. Code Fixes (Deployed)
- ✅ **Scoring worker** - Now handles partial success (won't DLQ if some predictions work)
- ✅ **Database error logging** - Full error context logged for debugging
- ✅ **Removed .env.local** - Using Coolify environment variables
- ✅ **Deleted settlement.worker.ts** - Unused betting system worker removed
- ✅ **Schema ready** - Missing tables (blog_posts, match_previews) will auto-create on first query

### 2. Documentation
- ✅ **CLEANUP_DATABASE.sql** - SQL script for database cleanup
- ✅ **REMAINING_FIXES.md** - Updated to reflect current state
- ✅ **This file** - Step-by-step cleanup instructions

---

## 📋 What You Need to Do Now

### Step 1: Wait for Deployment

The code has been pushed. Wait for Coolify to:
1. Build the new Docker image
2. Deploy to production
3. Restart the server

**Check deployment status:** Monitor your Coolify dashboard or deployment logs.

---

### Step 2: Run Database Cleanup

Once deployed, connect to your PostgreSQL database and run the cleanup script.

#### Option A: Via psql (Command Line)
```bash
# Replace with your actual DATABASE_URL from Coolify
psql $DATABASE_URL < CLEANUP_DATABASE.sql
```

#### Option B: Via Database Admin Tool
1. Open your database admin tool (pgAdmin, DBeaver, etc.)
2. Connect to your production database
3. Open `CLEANUP_DATABASE.sql`
4. Execute the entire script
5. Verify the results in the final SELECT query

#### Option C: Via Drizzle Studio (if configured)
```bash
npm run db:studio
```
Then copy-paste the SQL queries from `CLEANUP_DATABASE.sql`.

---

### Step 3: Clear Redis Queues and DLQ

After database cleanup, clear all queue data:

#### Via Admin API (Recommended)

```bash
# Set your admin password from Coolify env
ADMIN_PASSWORD="your-admin-password-from-coolify"
DOMAIN="your-production-domain.com"

# Clear Dead Letter Queue
curl -X DELETE \
  -H "X-Admin-Password: $ADMIN_PASSWORD" \
  "https://$DOMAIN/api/admin/dlq"
```

#### Via Redis CLI (If you have direct access)

```bash
# Connect to your Redis instance
redis-cli -u $REDIS_URL

# Clear all BullMQ queues (use with caution!)
FLUSHDB

# Or selectively delete queue keys:
KEYS bull:*
# Then delete specific keys
```

---

### Step 4: Restart the Server

After cleanup, restart your application:

#### Via Coolify
1. Go to your project in Coolify
2. Click "Restart" button
3. Wait for workers to initialize

This will:
- Re-initialize all workers
- Run catch-up scheduling for today's matches
- Start fresh fixture fetching

---

### Step 5: Verify Everything Works

#### Check Logs
Monitor your application logs for:
- ✅ `[Instrumentation] Event-driven system initialized successfully`
- ✅ `[Workers] Created 9 workers`
- ✅ `[Env Validation] ✓ All required environment variables are set`
- ❌ NO errors about missing tables
- ❌ NO settlement worker errors

#### Check Queue Status
```bash
curl -H "X-Admin-Password: $ADMIN_PASSWORD" \
  "https://$DOMAIN/api/admin/queue-status"
```

Should show:
- Empty queues or only new jobs for today
- No old failed jobs
- Workers active and processing

#### Check DLQ
```bash
curl -H "X-Admin-Password: $ADMIN_PASSWORD" \
  "https://$DOMAIN/api/admin/dlq"
```

Should return:
```json
{
  "jobs": [],
  "total": 0
}
```

#### Check Database
```sql
-- Verify only today's data exists
SELECT 
  COUNT(*) as match_count,
  MIN(kickoff_time) as earliest_match,
  MAX(kickoff_time) as latest_match
FROM matches;

-- Should show earliest_match >= '2026-01-23'
```

---

## 🎯 Expected Results

After completing all steps:

1. **Database**
   - ✅ Only matches from 2026-01-23 onwards
   - ✅ No old predictions
   - ✅ All models active (consecutive_failures = 0)
   - ✅ Tables `blog_posts` and `match_previews` exist

2. **Queues**
   - ✅ Empty or only fresh jobs
   - ✅ No jobs in DLQ
   - ✅ 9 workers active

3. **System**
   - ✅ No errors in logs
   - ✅ Fresh fixtures being fetched
   - ✅ Predictions being generated for today's matches
   - ✅ Content worker no longer failing on missing tables

---

## 🚨 Troubleshooting

### If you see "relation match_previews does not exist"

The schema migration didn't apply. Run manually:

```sql
-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  -- ... (see CLEANUP_DATABASE.sql for full schema)
);

-- Create match_previews table
CREATE TABLE IF NOT EXISTS match_previews (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id),
  -- ... (see CLEANUP_DATABASE.sql for full schema)
);
```

### If scoring worker still fails

Check the detailed error logs now available:
```bash
# Look for [DB Query Error] updatePredictionScores
# It will show full error context including:
# - error.code
# - error.detail
# - error.constraint
# - predictionId
```

### If models are still auto-disabled

Re-run the model reset:
```sql
UPDATE models SET 
  consecutive_failures = 0,
  last_failure_at = NULL,
  failure_reason = NULL,
  auto_disabled = false
WHERE auto_disabled = true;
```

---

## 📞 Next Actions

After cleanup is complete and verified:

1. **Monitor for 1-2 hours** - Make sure new fixtures are being fetched and predictions are working
2. **Check the first match** - When a match finishes, verify predictions are scored correctly
3. **Review REMAINING_FIXES.md** - Continue with Batch 1 (fix remaining workers)

---

## 📝 Files Modified

### Committed (Deployed)
- `src/lib/queue/workers/scoring.worker.ts` - Partial success handling
- `src/lib/db/queries.ts` - Error logging utility
- `src/lib/queue/workers/settlement.worker.ts` - **DELETED**
- `.gitignore` - Added .env.local
- `REMAINING_FIXES.md` - Updated progress
- `CLEANUP_DATABASE.sql` - Created
- `CLEANUP_INSTRUCTIONS.md` - This file

### Not Committed (Local Only)
- None - everything is deployed

---

**Status:** Ready for database cleanup  
**Waiting on:** You to run CLEANUP_DATABASE.sql  
**Next:** Continue with remaining worker fixes from REMAINING_FIXES.md
