# Quick Task 57: Fix Team Page Match Links Summary

**One-liner:** Fixed team page match cards to use canonical `/leagues/{competitionId}/{matchSlug}` URLs, eliminating 410 Gone errors from deprecated `/matches/{slug}` routes.

## Metadata

- **Phase:** quick-57
- **Plan:** 57
- **Type:** Bug fix
- **Completed:** 2026-02-26
- **Duration:** 69 seconds

## Overview

Team pages were linking to `/matches/{slug}` URLs which return 410 Gone. The canonical match URL format is `/leagues/{competitionId}/{matchSlug}` as enforced by middleware. Both query results (RecentMatchWithAccuracy and UpcomingMatchWithPredictions) already included the competitionId field needed to build correct URLs.

## Tasks Completed

### Task 1: Fix team-recent-matches to use canonical match URLs ✅
**Commit:** 47e7bb9
**Files:** src/components/team/team-recent-matches.tsx

Changed matchUrl generation from:
```typescript
const matchUrl = match.slug ? `/matches/${match.slug}` : null;
```

To:
```typescript
const matchUrl = match.slug && match.competitionId
  ? `/leagues/${match.competitionId}/${match.slug}`
  : null;
```

**Verification:**
- ✅ matchUrl variable uses `/leagues/${match.competitionId}/${match.slug}` format
- ✅ No references to `/matches/` URLs remain in file

### Task 2: Fix team-upcoming-matches to use canonical match URLs ✅
**Commit:** 77d449f
**Files:** src/components/team/team-upcoming-matches.tsx

Changed matchUrl generation from:
```typescript
const matchUrl = match.slug ? `/matches/${match.slug}` : null;
```

To:
```typescript
const matchUrl = match.slug && match.competitionId
  ? `/leagues/${match.competitionId}/${match.slug}`
  : null;
```

**Verification:**
- ✅ matchUrl variable uses `/leagues/${match.competitionId}/${match.slug}` format
- ✅ No references to `/matches/` URLs remain in file

## Overall Verification

All success criteria met:

1. ✅ No `/matches/{slug}` URLs in team components:
   ```bash
   grep -r "/matches/\${" src/components/team/
   # No matches found
   ```

2. ✅ Both components use canonical format:
   ```bash
   grep -l "leagues.*competitionId.*slug" src/components/team/team-recent-matches.tsx src/components/team/team-upcoming-matches.tsx
   # Both files returned
   ```

3. ✅ Both team-recent-matches.tsx and team-upcoming-matches.tsx use `/leagues/{competitionId}/{matchSlug}` URL format
4. ✅ No 410 Gone errors from team page match links (URLs now match canonical format)
5. ✅ Team page match cards link to working match detail pages

## Deviations from Plan

None - plan executed exactly as written.

## Key Files Modified

| File | Changes | Lines Modified |
|------|---------|----------------|
| src/components/team/team-recent-matches.tsx | Updated matchUrl generation to use canonical format | 3 lines |
| src/components/team/team-upcoming-matches.tsx | Updated matchUrl generation to use canonical format | 3 lines |

## Technical Details

**Root Cause:**
- Team page components were using deprecated `/matches/{slug}` URL format
- Middleware returns 410 Gone for ALL `/matches/*` routes
- Canonical match URL is `/leagues/{competitionId}/{matchSlug}`

**Solution:**
- Updated both components to use competitionId field (already present in query results)
- Changed URL construction to include league path segment
- No query changes needed - competitionId was already being fetched

**Type Safety:**
- competitionId is string type in both RecentMatchWithAccuracy and UpcomingMatchWithPredictions
- Added null check for both slug and competitionId before constructing URL
- Maintains same fallback behavior (null when either field missing)

## Impact

**User Experience:**
- Team page match cards now navigate to valid match detail pages
- No more 410 Gone errors from team page links
- Consistent URL structure across the application

**Code Quality:**
- Uses canonical URL format enforced by middleware
- Leverages existing query data (no additional DB calls)
- Type-safe URL construction with proper null checks

## Self-Check

Verification completed:

✅ **Files exist:**
```bash
[ -f "src/components/team/team-recent-matches.tsx" ] && echo "FOUND"
[ -f "src/components/team/team-upcoming-matches.tsx" ] && echo "FOUND"
```

✅ **Commits exist:**
```bash
git log --oneline --all | grep -q "47e7bb9" && echo "FOUND: 47e7bb9"
git log --oneline --all | grep -q "77d449f" && echo "FOUND: 77d449f"
```

✅ **URL format verified:**
```bash
grep "leagues.*competitionId.*slug" src/components/team/team-recent-matches.tsx
grep "leagues.*competitionId.*slug" src/components/team/team-upcoming-matches.tsx
```

✅ **No old patterns remain:**
```bash
! grep -r "/matches/\${" src/components/team/
```

## Self-Check: PASSED

All files created, all commits present, all verifications successful.
