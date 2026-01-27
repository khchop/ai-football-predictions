# Quick Summary: Fix deployment failure - missing matchday property

## Completed
- Added `matchday: null` to match object in fixtures.worker.ts line 106

## Files Changed
- `src/lib/queue/workers/fixtures.worker.ts` - Added missing matchday property

## Verification
- Build should now succeed (matchday property no longer missing)