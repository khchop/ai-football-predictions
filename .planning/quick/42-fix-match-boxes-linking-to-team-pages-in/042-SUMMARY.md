---
type: quick
task: 042
description: Fix match card click navigation
status: complete
---

## Summary

Fixed critical bug where match cards couldn't navigate to match detail pages after phase 70-02 added team name links.

**Root cause:** The overlay anchor pattern (`<a href={matchUrl} className="absolute inset-0 z-0">`) created invalid nested `<a>` tags when combined with Next.js `<Link>` elements for team names. Browsers handle nested anchors unpredictably.

**Fix:** Replaced the interactive overlay anchor with:
1. `pointer-events-none` on the overlay anchor (kept for SEO/accessibility only)
2. `onClick` handler on the card `<div>` for match detail navigation
3. Click handler checks if target is a team link (`a[href^="/teams/"]`) and skips navigation
4. Supports cmd/ctrl+click for new tab
5. Team name Links given `relative z-20` for clear visual stacking

**Files changed:** `src/components/match-card.tsx`

**Result:** Clicking card body/score → match detail page. Clicking team name → team page. Both work correctly.
