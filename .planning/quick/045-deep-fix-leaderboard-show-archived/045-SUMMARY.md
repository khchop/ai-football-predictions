# Quick Task 045: Summary

## What was wrong

The "Show Archived" toggle on the leaderboard did nothing because:
1. **Zero models had `archived=true`** — the column existed but was never populated
2. The `deactivateOldModels()` function only set `active=false`, never `archived=true`
3. A third query branch in `getLeaderboard()` was missed by quick-044's fix

## What was fixed

1. **Database**: Ran migration to archive 37 inactive models that have scored predictions
2. **Code**: Updated `deactivateOldModels()` to set `archived: true` alongside `active: false`
3. **Code**: Fixed remaining unfiltered branch in `getLeaderboard()` query
4. **Migration**: Created `007_archive_inactive_models_with_predictions.sql` for tracking

## Result

- 17 active models (unchanged)
- 37 archived models with prediction history (now visible with toggle)
- 88 inactive models without data (not shown)

## Commit

3c71b7b
