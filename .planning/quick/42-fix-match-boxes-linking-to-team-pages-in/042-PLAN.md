---
type: quick
task: 042
description: Fix match card click navigation - card body should go to match detail, team names to team pages
---

<objective>
Fix the match card overlay anchor pattern that causes broken navigation. The overlay `<a>` at z-0 with `absolute inset-0` creates nested anchor tags with team `<Link>` elements, causing browsers to navigate unpredictably. Replace with onClick handler on the card div + pointer-events-none on the SEO anchor.
</objective>

## Tasks

### Task 1: Fix match-card.tsx click handling

**File:** `src/components/match-card.tsx`

**Problem:** Overlay `<a href={matchUrl}>` at z-0 with absolute positioning creates invalid nested `<a>` tags when combined with team name `<Link>` elements at z-10. Browsers can't reliably handle this.

**Fix:**
1. Add `pointer-events-none` and `tabIndex={-1}` to the overlay anchor (keeps it for SEO crawlers but non-interactive)
2. Add `onClick` handler to the card `<div>` that navigates to matchUrl
3. In the onClick handler, check if the click target is inside a team link (`a[href^="/teams/"]`) and bail if so
4. Support cmd/ctrl+click for new tab
5. Add `relative z-20` to team name Links for clear stacking
6. Add `cursor-pointer` to the card div
