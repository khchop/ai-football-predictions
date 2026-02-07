# Quick Task 022: Fix match_previews unique constraint

## Changes

- `src/lib/db/schema.ts` — Added `.unique()` to `matchPreviews.matchId`
- `src/lib/deploy/post-deploy.ts` — Added `add-match-previews-unique-constraint-v1` post-deploy task

## Result

After deploy, the post-deploy task will add the UNIQUE constraint on `match_previews.match_id`. This enables the `ON CONFLICT` upsert in `generator.ts` to work correctly, allowing match previews to be saved to the database.

## Notes

- The existing regular index `idx_match_previews_match_id` is kept for consistency with `matchContent` table pattern
- 343 DLQ entries from failed preview jobs will need previews regenerated (content worker will retry on next match scheduling)
- Analysis queue failures (34) and 0% prediction coverage are a separate issue — API-Football not returning data at T-6h for some matches
