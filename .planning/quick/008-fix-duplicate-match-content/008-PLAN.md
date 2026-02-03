# Quick Task 008: Fix Duplicate Match Content

**Description:** Fix duplicate content rendering on match detail pages where pre-match and post-match sections show the same text twice (preview + full section)

**Directory:** `.planning/quick/008-fix-duplicate-match-content/`

## Problem

The `MatchContentSection` component renders pre-match and post-match content twice:
1. First in a `NarrativePreview` component (truncated preview)
2. Then in a "Full" section below (complete content)

This creates visible duplication where users see the same text repeated on the page.

The **betting section** renders correctly — once, as a direct paragraph.

## Solution

Refactor pre-match and post-match sections to match the betting section pattern:
- Render content once per section
- Use collapsible/expandable pattern for long content instead of preview+full
- Keep the same visual hierarchy (h3 headers, timestamps)

## Tasks

### Task 1: Refactor MatchContentSection to eliminate duplication

**File:** `src/components/match/MatchContent.tsx`

**Changes:**
1. Remove the dual-render pattern (NarrativePreview + Full Section) for pre-match
2. Remove the dual-render pattern for post-match
3. Render each section once, matching the betting section approach
4. Use NarrativePreview for long content collapse (single instance, not preview+full)

**Expected sections after fix:**
- Pre-match: Single section with "Match Preview" header
- Betting: Single section with "AI Model Predictions" header (unchanged)
- Post-match: Single section with "Match Report" header

**Verification:**
- Build succeeds
- Each section renders exactly once
- Long content still collapsible via NarrativePreview
- All 3 sections visible for finished matches

## Success Criteria

- [ ] Pre-match content renders once (not preview + full)
- [ ] Post-match content renders once (not preview + full)
- [ ] Betting section unchanged (already correct)
- [ ] Long content still expandable
- [ ] Build passes
- [ ] Commit made

---
*Quick task 008 | 2026-02-03*
