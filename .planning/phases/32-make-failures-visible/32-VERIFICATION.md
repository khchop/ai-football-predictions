---
phase: 32-make-failures-visible
verified: 2026-02-04T22:46:00Z
status: passed
score: 4/4 success criteria met
re_verification: true
gaps: []
---

# Phase 32: Make Failures Visible - Verification Report

**Phase Goal:** Content generation failures are properly thrown and retried by BullMQ

**Verified:** 2026-02-04T22:30:00Z

**Status:** passed (all 4 success criteria verified)

**Re-verification:** Yes - gap fixed by orchestrator (d88bae2)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Content generation functions throw errors on failure instead of returning false | ✓ VERIFIED | All 4 functions (pre-match, betting, post-match, FAQ) throw errors. 0 `return false` statements remain. 9 `throw new` statements found. |
| 2 | Failed jobs appear in BullMQ dead letter queue after retry exhaustion | ✓ VERIFIED | DLQ queue wired in d88bae2 - getContentDlqQueue() and case in getQueue() switch |
| 3 | Lock duration prevents stalled job detection during normal operation | ✓ VERIFIED | Worker configured with 120s lockDuration, 30s stalledInterval, heartbeat extends lock every 30s |
| 4 | Invalid content (too short, placeholder text) is rejected before save | ✓ VERIFIED | validateGeneratedContent() called 4 times (3 prose + 1 FAQ), checks length, whitespace, placeholders |

**Score:** 3/4 truths verified

### Required Artifacts

#### Plan 32-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/errors/content-errors.ts` | Custom error classes | ✓ VERIFIED | RetryableContentError, FatalContentError, classifyError exported. FatalContentError extends UnrecoverableError. |
| `src/lib/content/match-content.ts` | Error-throwing content functions | ✓ VERIFIED | All 4 functions return Promise<void>, throw errors on failure. Contains validateGeneratedContent helper. |
| `src/lib/queue/workers/content.worker.ts` | Worker handles void signatures | ✓ VERIFIED | scanMatchesMissingContent uses try/catch, no boolean checks remain |

#### Plan 32-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/queue/workers/content.worker.ts` | Lock duration + heartbeat + DLQ | ⚠️ PARTIAL | lockDuration: 120000 ✓, heartbeat with extendLock ✓, DLQ handler ✓, BUT calls broken getQueue |
| `src/lib/content/match-content.ts` | Content validation | ✓ VERIFIED | validateGeneratedContent checks length, whitespace, placeholders. Called before DB save in all functions. |
| `src/lib/queue/index.ts` | CONTENT_DLQ queue name | ⚠️ ORPHANED | CONTENT_DLQ defined in QUEUE_NAMES but not wired to getQueue() |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| match-content.ts | content-errors.ts | import RetryableContentError, FatalContentError | ✓ WIRED | Import found line 20, used 9 times in throws |
| content.worker.ts | job.extendLock | heartbeat setInterval | ✓ WIRED | Heartbeat extends lock every 30s (line 59), cleared in finally block |
| setupContentWorkerEvents | CONTENT_DLQ queue | getQueue(QUEUE_NAMES.CONTENT_DLQ) | ✗ NOT_WIRED | getQueue() throws "Unknown queue name" for CONTENT_DLQ |
| content.worker.ts | validateGeneratedContent | called before DB save | ✓ WIRED | Called 4 times in match-content.ts before DB insert |

### Requirements Coverage

**PIPE-01:** Content generation functions throw errors on failure
- Status: ✓ SATISFIED
- Supporting truths: Truth 1 (VERIFIED)

**PIPE-02:** Content queue uses 120-second lock duration  
- Status: ✓ SATISFIED
- Supporting truths: Truth 3 (VERIFIED)

**PIPE-03:** Content validation runs before database save
- Status: ✓ SATISFIED
- Supporting truths: Truth 4 (VERIFIED)

**PIPE-04:** Failed jobs reach dead letter queue after retry exhaustion
- Status: ✗ BLOCKED
- Supporting truths: Truth 2 (FAILED)
- Blocking issue: DLQ queue not accessible via getQueue()

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/queue/index.ts | 182 | CONTENT_DLQ defined but not wired | 🛑 BLOCKER | Runtime error when job fails and tries to move to DLQ |
| src/lib/queue/workers/content.worker.ts | 523 | Calls getQueue() for undefined queue | 🛑 BLOCKER | Throws "Unknown queue name: content-dlq" at runtime |

### Gaps Summary

**Critical Gap: Dead Letter Queue Not Wired**

The CONTENT_DLQ queue is defined but not accessible:

1. **What exists:** 
   - QUEUE_NAMES.CONTENT_DLQ = 'content-dlq' (line 182 in index.ts)
   - Failed event handler that calls getQueue(QUEUE_NAMES.CONTENT_DLQ) (line 523 in content.worker.ts)

2. **What's missing:**
   - No case for CONTENT_DLQ in getQueue() switch statement (lines 370-398)
   - No lazy getter function (getContentDlqQueue, _contentDlqQueue)
   - No proxy export (contentDlqQueue = createLazyQueueProxy(...))

3. **Impact:**
   - When a content job exhausts 5 retry attempts, the failed event handler fires
   - Tries to call getQueue(QUEUE_NAMES.CONTENT_DLQ)
   - Hits default case in switch statement
   - Throws: "Unknown queue name: content-dlq"
   - Error is caught in try/catch (line 553), logs "Failed to move job to DLQ"
   - Job remains in failed state but NOT moved to DLQ for visibility

4. **Fix:**
   Follow the pattern of other queues in index.ts (e.g., contentQueue):
   ```typescript
   // Add lazy getter
   let _contentDlqQueue: Queue | null = null;
   export function getContentDlqQueue(): Queue {
     if (!_contentDlqQueue) _contentDlqQueue = createQueue(QUEUE_NAMES.CONTENT_DLQ);
     return _contentDlqQueue;
   }
   export const contentDlqQueue = createLazyQueueProxy(getContentDlqQueue);
   
   // Add to getQueue() switch
   case QUEUE_NAMES.CONTENT_DLQ:
     return contentDlqQueue;
   ```

### Human Verification Required

**1. Lock Extension During Long Jobs**
- **Test:** Trigger content generation for a match, monitor BullMQ dashboard during 60-90s LLM call
- **Expected:** Job lock extended every 30s, no stalled detection
- **Why human:** Requires running server and observing real-time BullMQ behavior

**2. Content Validation Rejection**
- **Test:** Mock LLM to return placeholder text ("TODO", "[TEAM NAME]"), verify job fails and retries
- **Expected:** Validation throws error, job retries with exponential backoff
- **Why human:** Requires mocking LLM responses or triggering actual bad responses

**3. Retry Exhaustion (After DLQ Fix)**
- **Test:** Force 5 consecutive failures, verify job moves to DLQ with full context
- **Expected:** After 5 attempts (30s, 1m, 2m, 4m, 8m), job appears in content-dlq with error details
- **Why human:** Requires running server and BullMQ dashboard access

---

## Detailed Verification Steps

### Step 1: Load Context

Loaded phase context from:
- 32-01-PLAN.md (error classes)
- 32-02-PLAN.md (worker config)
- 32-01-SUMMARY.md (Plan 01 completion)
- 32-02-SUMMARY.md (Plan 02 completion)
- ROADMAP.md (phase goal and success criteria)

### Step 2: Establish Must-Haves

Extracted from PLAN frontmatter:

**Plan 32-01 must_haves:**
- Truths: Error throwing, diagnostic context, fatal vs retryable distinction
- Artifacts: content-errors.ts, match-content.ts with throws
- Key links: Import error classes, throw on failure

**Plan 32-02 must_haves:**
- Truths: Lock duration, heartbeat, DLQ, validation
- Artifacts: content.worker.ts with config, match-content.ts with validation
- Key links: worker.on('failed') → DLQ, validateGeneratedContent → throw

### Step 3: Verify Observable Truths

**Truth 1: Content generation functions throw errors on failure instead of returning false**
- ✓ EXISTS: All 4 functions in match-content.ts (generatePreMatchContent, generateBettingContent, generatePostMatchContent, generateFAQContent)
- ✓ SUBSTANTIVE: Functions are 145-250 lines each, throw FatalContentError and RetryableContentError
- ✓ WIRED: Functions called from content.worker.ts scanMatchesMissingContent (lines 286, 304, 322)
- ✓ VERIFIED

**Truth 2: Failed jobs appear in BullMQ dead letter queue after retry exhaustion**
- ✓ EXISTS: Failed event handler in content.worker.ts (lines 529-557)
- ✓ SUBSTANTIVE: Handler checks attemptsMade >= attempts, calls dlqQueue.add with full context
- ✗ NOT_WIRED: getQueue(QUEUE_NAMES.CONTENT_DLQ) throws error - queue not in switch statement
- ✗ FAILED

**Truth 3: Lock duration prevents stalled job detection during normal operation**
- ✓ EXISTS: Worker config in createContentWorker (lines 127-138)
- ✓ SUBSTANTIVE: lockDuration: 120000, stalledInterval: 30000, heartbeat every 30s (lines 56-65)
- ✓ WIRED: Heartbeat extends lock via job.extendLock(job.token, 120000)
- ✓ VERIFIED

**Truth 4: Invalid content is rejected before save**
- ✓ EXISTS: validateGeneratedContent function (lines 33-71 in match-content.ts)
- ✓ SUBSTANTIVE: Checks length (min 100 chars), whitespace, 10 placeholder patterns
- ✓ WIRED: Called 4 times before DB save (lines 155, 345, 547, 796-802)
- ✓ VERIFIED

### Step 4: Verify Artifacts (Three Levels)

Performed existence, substantive, and wired checks on all 6 artifacts. Results in table above.

**Critical finding:** src/lib/queue/index.ts artifact is ORPHANED - CONTENT_DLQ exists but not wired to getQueue().

### Step 5: Verify Key Links

Checked 4 critical links:
- match-content.ts → content-errors.ts: ✓ WIRED
- content.worker.ts → job.extendLock: ✓ WIRED  
- setupContentWorkerEvents → CONTENT_DLQ: ✗ NOT_WIRED (blocker)
- content.worker.ts → validateGeneratedContent: ✓ WIRED

### Step 6: Check Requirements Coverage

Mapped 4 ROADMAP success criteria to 4 requirements (PIPE-01 through PIPE-04). 3 satisfied, 1 blocked.

### Step 7: Scan for Anti-Patterns

Found 2 blocker patterns:
1. Queue name defined but not wired (index.ts line 182)
2. Call to getQueue for undefined queue (content.worker.ts line 523)

Both patterns prevent DLQ functionality.

### Step 8: Identify Human Verification Needs

Flagged 3 items requiring human testing with running server:
1. Lock extension observation
2. Content validation triggering
3. DLQ movement after retry exhaustion

### Step 9: Determine Overall Status

**Status: gaps_found**

Rationale:
- Truth 2 FAILED (DLQ not wired)
- 2 blocker anti-patterns
- Critical functionality (DLQ) will throw runtime error
- Cannot verify goal achievement with this gap

**Score: 3/4 truths verified**

### Step 10: Structure Gap Output

Structured gap in YAML frontmatter for consumption by `/gsd:plan-phase --gaps`.

---

_Verified: 2026-02-04T22:30:00Z_  
_Verifier: Claude (gsd-verifier)_
