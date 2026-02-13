---
phase: 74-discord-alert-service
plan: 01
subsystem: monitoring
tags: [discord, alerts, notifications, observability, model-health]
completed: 2026-02-13T20:08:12Z
duration: 173
dependency_graph:
  requires:
    - recordModelFailure (src/lib/db/queries.ts)
    - detectRegressions (src/lib/db/queries/model-stats.ts)
    - model-stats.worker aggregate-daily-stats and check-regressions jobs
  provides:
    - Discord rich embed alerts for model auto-disable events
    - Discord rich embed alerts for regression detection
    - DISCORD_WEBHOOK_URL optional env var configuration
  affects:
    - Model failure pipeline (auto-disable alerting)
    - Daily model stats aggregation (regression alerting)
    - Regression check job (regression alerting)
tech_stack:
  added:
    - Discord webhook API (native fetch, no SDK)
    - Rich embed formatting with color, fields, timestamps, footers
  patterns:
    - Fire-and-forget notification pattern
    - Graceful degradation for optional services
    - 5-second timeout on webhook requests
    - Never throw from notification layer (log errors only)
key_files:
  created:
    - src/lib/notifications/discord.ts (195 lines, 3 public exports)
  modified:
    - src/lib/env.ts (added DISCORD_WEBHOOK_URL optional env var)
    - .env.example (added Discord alerts section with webhook setup instructions)
    - src/lib/logger/modules.ts (added discord logger)
    - src/lib/db/queries.ts (added sendAutoDisableAlert call in recordModelFailure)
    - src/lib/queue/workers/model-stats.worker.ts (added sendRegressionAlert calls in both job cases)
key_decisions:
  - Read DISCORD_WEBHOOK_URL directly from process.env (not via env.ts getter) to avoid throws on missing value
  - Fire-and-forget for auto-disable alerts (.catch() with no await) to avoid pipeline latency
  - Await for regression alerts (daily job is not latency-sensitive)
  - Query model displayName and lastSuccessAt before sending auto-disable alert for richer context
  - Limit regression alerts to 10 models per embed (readability + Discord field limits)
  - Use emoji indicators for severity (🔴 critical, 🟡 warning)
  - 5-second timeout on webhook requests (prevent hanging)
  - Never throw from discord service (all errors logged via loggers.discord)
metrics:
  tasks: 2
  commits: 2
  files_created: 1
  files_modified: 5
---

# Phase 74 Plan 01: Discord Alert Service Summary

**Discord webhook notification service with rich embeds for model auto-disable and regression events, integrated into existing failure tracking and daily stats pipeline.**

## What Was Built

Created a Discord notification service that sends rich embed alerts when:
1. A model is auto-disabled after 5 consecutive model-specific failures
2. Daily regression detection finds models with >10% success rate drop

The service gracefully degrades when `DISCORD_WEBHOOK_URL` is not configured (silently skips alerts, no errors). All Discord calls use fire-and-forget pattern and cannot crash the pipeline.

## Tasks Completed

### Task 1: Create Discord notification service with rich embeds
**Commit:** `064a30a`
**Files:** `src/lib/notifications/discord.ts` (new), `src/lib/env.ts`, `.env.example`, `src/lib/logger/modules.ts`

Created a comprehensive Discord webhook service with:
- `sendDiscordAlert(embed)` - Core function that POSTs to webhook URL with 5s timeout, graceful handling of missing URL
- `sendAutoDisableAlert(params)` - Red embed with model name, consecutive failures, error, last success time, suggested SQL action
- `sendRegressionAlert(regressions)` - Orange/red embed (based on severity) with up to 10 regressing models, rate drops, severity emojis
- All functions wrapped in try/catch, never throw (fire-and-forget pattern)
- Added `DISCORD_WEBHOOK_URL` to `env.ts` and `.env.example` (optional, not in REQUIRED_ENV_VARS)
- Added `discord` logger to `modules.ts` Infrastructure section

**Verification:**
- `npx tsc --noEmit` passes (no type errors)
- `discord.ts` exists at expected path
- `DISCORD_WEBHOOK_URL` appears in `env.ts` and `.env.example`
- `discord: createLogger` in `modules.ts`

### Task 2: Integrate Discord alerts into auto-disable and regression flows
**Commit:** `438979d`
**Files:** `src/lib/db/queries.ts`, `src/lib/queue/workers/model-stats.worker.ts`

Integrated Discord alerts at the right hook points:

**Auto-disable integration** (in `recordModelFailure`):
- After `log.warn` when `autoDisabled` transitions to true
- Query model `displayName` and `lastSuccessAt` before alert (cheap single-row SELECT)
- Call `sendAutoDisableAlert()` with fire-and-forget pattern (`.catch(() => {})`, no await)
- Cannot add latency to failure recording path

**Regression integration** (in `model-stats.worker.ts`):
- After `log.error` in both `aggregate-daily-stats` and `check-regressions` cases
- Call `await sendRegressionAlert(regressions)` (await is fine here, daily job not latency-sensitive)
- 2 call sites (both inside `if (regressions.length > 0)` blocks)

**Verification:**
- `npx tsc --noEmit` passes (no type errors)
- `sendAutoDisableAlert` imported and called in `queries.ts`
- `sendRegressionAlert` imported and called twice in `model-stats.worker.ts`
- `npm run build --webpack` succeeds (production build)

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

- ✅ **DISC-01:** DISCORD_WEBHOOK_URL exists in .env.example and src/lib/env.ts (optional, not required)
- ✅ **DISC-02:** Discord service sends rich embeds with model name, error details, timestamps via webhook POST
- ✅ **DISC-03:** Alert fires in recordModelFailure when autoDisabled transitions to true (5+ consecutive failures)
- ✅ **DISC-04:** Alert fires in model-stats worker when detectRegressions returns regressions (>10% drop)
- ✅ **DISC-05:** Alerts include error type, failure count, last success time, severity, suggested action
- ✅ **Graceful degradation:** No errors when DISCORD_WEBHOOK_URL not set (debug log, silent return)
- ✅ **Pipeline integrity:** Discord calls cannot crash pipeline (fire-and-forget, all errors caught internally)

## Implementation Details

### Discord Service Architecture
- Native `fetch()` (no external library)
- `AbortSignal.timeout(5000)` for 5-second timeout
- Read webhook URL directly from `process.env.DISCORD_WEBHOOK_URL` (avoid env.ts getter which throws)
- All errors logged via `loggers.discord`, never thrown
- Rich embed structure: title, description, color, fields (name/value pairs), timestamp, footer

### Auto-Disable Alert Format
```
🔴 Model Auto-Disabled
Color: Red (0xFF0000)
Fields:
  - Model: {displayName} ({modelId})
  - Consecutive Failures: {count}
  - Last Success: {timestamp or "Never"}
  - Error: {reason truncated to 200 chars}
  - Suggested Action: SQL command to archive model
Footer: "Auto-Disable Alert | Threshold: 5 failures"
```

### Regression Alert Format
```
⚠️ Model Regression Detected (N)
Description: {X critical, Y warning}
Color: Red if any critical (0xFF0000), Orange if warnings only (0xFFA500)
Fields (up to 10):
  - 🔴/🟡 {displayName}: {prev%} → {curr%} (drop: {drop%})
  - Suggested Action: Review /admin dashboard
Footer: "Regression Alert | Threshold: >10% drop"
```

### Integration Patterns
**Auto-disable:** Query model info → Fire-and-forget alert → Invalidate caches
**Regression:** Log error → Await alert → Return

## Testing Recommendations

1. **Test auto-disable alert:**
   - Trigger 5 consecutive model-specific failures for a model
   - Verify Discord webhook receives red embed with model details
   - Verify pipeline continues without errors if DISCORD_WEBHOOK_URL not set

2. **Test regression alert:**
   - Run `aggregate-daily-stats` with >10% success rate drop for models
   - Verify Discord webhook receives orange/red embed with regression list
   - Test both `aggregate-daily-stats` and `check-regressions` job cases

3. **Test graceful degradation:**
   - Unset DISCORD_WEBHOOK_URL
   - Trigger auto-disable and regression events
   - Verify no errors in logs (only debug messages: "skipping alert")

4. **Test error handling:**
   - Set invalid webhook URL
   - Trigger alerts
   - Verify errors logged via `loggers.discord.error` but pipeline continues

## User Setup Required

Before Discord alerts will fire, user must:

1. Create a Discord webhook:
   - Open Discord server
   - Go to Channel Settings → Integrations → Webhooks
   - Click "New Webhook"
   - Copy Webhook URL

2. Set environment variable:
   ```bash
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/{id}/{token}
   ```

3. Restart application to load new env var

**If webhook URL is not set, alerts are silently skipped (no errors, no crashes).**

## Self-Check

Verifying all claimed files and commits exist:

```bash
# Files created
[ -f "src/lib/notifications/discord.ts" ] && echo "FOUND: src/lib/notifications/discord.ts" || echo "MISSING"
```
FOUND: src/lib/notifications/discord.ts

```bash
# Commits exist
git log --oneline --all | grep -q "064a30a" && echo "FOUND: 064a30a" || echo "MISSING"
git log --oneline --all | grep -q "438979d" && echo "FOUND: 438979d" || echo "MISSING"
```
FOUND: 064a30a
FOUND: 438979d

```bash
# Integrations exist
grep -q "sendAutoDisableAlert" src/lib/db/queries.ts && echo "FOUND: auto-disable integration" || echo "MISSING"
grep -c "sendRegressionAlert" src/lib/queue/workers/model-stats.worker.ts # Should be 2
```
FOUND: auto-disable integration
2

## Self-Check: PASSED

All files, commits, and integrations verified.

---

**Phase 74 Plan 01 complete.** Discord alert service is production-ready and integrated into the model health monitoring pipeline. Alerts will fire automatically when models are auto-disabled or show regression, providing real-time visibility into model health without manual log monitoring.
