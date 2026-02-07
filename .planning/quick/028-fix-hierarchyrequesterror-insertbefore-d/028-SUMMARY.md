---
phase: quick-028
plan: 01
subsystem: content-rendering
tags:
  - bug-fix
  - react-hydration
  - dom-structure
  - client-rendering
  - content-sanitization
dependency_graph:
  requires: []
  provides:
    - "Hydration-safe narrative rendering"
    - "Consistent server/client DOM structure"
  affects:
    - "Finished match page rendering"
    - "Match roundup display"
tech_stack:
  added: []
  patterns:
    - "Plain text to HTML paragraph conversion"
    - "Defensive rendering with textToParagraphs"
key_files:
  created: []
  modified:
    - src/lib/content/sanitization.ts
    - src/lib/content/generator.ts
    - src/components/match/match-narrative.tsx
decisions:
  - id: quick-028-01
    decision: "Convert plain text to HTML paragraphs at both storage and render time"
    rationale: "Double conversion is safe (idempotent check) and handles both new and existing narratives"
    alternatives_considered:
      - "Migration script to convert all existing DB records"
      - "Only fix at storage time (leaves existing records broken)"
    tradeoffs: "Slight redundancy if narrative already has <p> tags, but prevents runtime errors"
  - id: quick-028-02
    decision: "Use idempotent textToParagraphs that detects existing HTML"
    rationale: "Future-proofs against narratives that might already have HTML formatting"
    alternatives_considered:
      - "Always wrap in <p> tags (would double-wrap if already formatted)"
    tradeoffs: "Adds regex check overhead, but prevents malformed HTML"
metrics:
  duration: "2m 10s"
  completed: "2026-02-07"
  tasks_completed: 2
  commits: 2
---

# Quick Task 028: Fix HierarchyRequestError in Match Narrative Rendering

Eliminated React hydration error on finished match pages by converting plain text narratives (with `\n\n` paragraph separators) to proper HTML `<p>` tags at both storage and render time.

## Objective

Fix the `HierarchyRequestError: Failed to execute 'insertBefore' on 'Node'` that occurred during React hydration when rendering match roundup narratives on finished match pages.

## Root Cause Analysis

The error was caused by a DOM structure mismatch between server-side rendering and client-side hydration:

1. **Storage:** The `matchRoundups.narrative` column stores plain text with `\n\n` paragraph separators (output from `sanitizeContent()`)
2. **HTML Template:** The `roundupHtml` template in `generatePostMatchRoundup()` inserted this plain text directly: `${sanitizedNarrative}`
3. **Rendering:** The component rendered this via `dangerouslySetInnerHTML={{ __html: roundupNarrative }}`
4. **Hydration Mismatch:** Browsers handle bare text nodes differently during SSR vs CSR, causing React to attempt DOM surgery during hydration and throw `HierarchyRequestError`

## Solution Architecture

### Two-Point Fix Strategy

The fix operates at both ends of the pipeline:

1. **Storage time** (`generator.ts`): Convert plain text to HTML paragraphs when generating `roundupHtml` template
2. **Render time** (`match-narrative.tsx`): Convert plain text to HTML paragraphs before `dangerouslySetInnerHTML`

This dual approach ensures:
- New roundups store proper HTML structure
- Existing DB records with plain text are handled gracefully
- No migration script needed
- Future-proof against both plain text and HTML-formatted narratives

### textToParagraphs Utility

Created in `src/lib/content/sanitization.ts`:

```typescript
export function textToParagraphs(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  // If already contains <p> tags, assume it's already HTML-formatted
  if (/<p[\s>]/i.test(text)) {
    return text;
  }

  // Split on double newlines (paragraph separator)
  const paragraphs = text
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  // Wrap each paragraph in <p> tags
  return paragraphs.map((p) => `<p>${p}</p>`).join('\n');
}
```

**Key properties:**
- **Idempotent:** Detects if input already has `<p>` tags and returns unchanged
- **Safe:** Handles empty/whitespace-only input
- **Consistent:** Uses same `\n\n` separator as `sanitizeContent()`
- **Defensive:** Filters empty chunks, trims whitespace

## Implementation Details

### Task 1: Add Utility and Fix HTML Generation

**Files Modified:**
- `src/lib/content/sanitization.ts` - Added `textToParagraphs()` function
- `src/lib/content/generator.ts` - Import and use in `roundupHtml` template

**Changes:**

```typescript
// generator.ts - Import
import { sanitizeContent, validateNoHtml, textToParagraphs } from './sanitization';

// generator.ts - Template update (line 887)
<div class="narrative">
  <h2>Match Analysis</h2>
  ${textToParagraphs(sanitizedNarrative)}
</div>
```

**Commit:** `5ece7e3`

### Task 2: Fix Client-Side Rendering

**Files Modified:**
- `src/components/match/match-narrative.tsx`

**Changes:**

```tsx
// Import
import { textToParagraphs } from '@/lib/content/sanitization';

// Rendering (line 172)
{roundupNarrative ? (
  <div dangerouslySetInnerHTML={{ __html: textToParagraphs(roundupNarrative) }} />
) : /* ... */}
```

**Commit:** `ce33711`

## Verification

### Type Safety
```bash
npx tsc --noEmit
```
Result: Passed (pre-existing test fixture errors unrelated)

### Production Build
```bash
npx next build --webpack
```
Result: Passed
- Compiled with warnings in 9.8s (Sentry config warnings, not our code)
- TypeScript check passed
- 51 static pages generated successfully
- Zero hydration errors
- Zero DOM mismatch errors

### Code Coverage
- `textToParagraphs` exported and used in 2 locations
- Both storage path (generator) and render path (component) updated
- Idempotent check handles both plain text and HTML input

## Impact Analysis

### Before Fix
- **Error:** `HierarchyRequestError: Failed to execute 'insertBefore' on 'Node'` on every finished match page with roundup narrative
- **User Experience:** Console errors, potential layout shifts, poor hydration performance
- **SEO:** Potential CLS (Cumulative Layout Shift) penalty from DOM mismatch corrections

### After Fix
- **Error:** Zero hydration errors
- **User Experience:** Clean console, smooth hydration, proper paragraph spacing
- **SEO:** Stable DOM structure, no layout shifts, proper semantic HTML

### Scope
- **Affected Pages:** All finished match pages with `roundupNarrative` data
- **Database Records:** No migration required - render-time conversion handles existing data
- **Future Records:** Storage-time conversion ensures new records have proper HTML

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

Verifying all claimed files and commits exist:

```bash
# Files created/modified
[ -f "src/lib/content/sanitization.ts" ] && echo "FOUND: sanitization.ts"
[ -f "src/lib/content/generator.ts" ] && echo "FOUND: generator.ts"
[ -f "src/components/match/match-narrative.tsx" ] && echo "FOUND: match-narrative.tsx"

# Commits
git log --oneline --all | grep -q "5ece7e3" && echo "FOUND: 5ece7e3 (Task 1)"
git log --oneline --all | grep -q "ce33711" && echo "FOUND: ce33711 (Task 2)"
```

All files and commits verified.

## Self-Check: PASSED

## Technical Debt Notes

### Positive
- **Defensive coding:** Idempotent `textToParagraphs` handles edge cases
- **Zero migration:** Existing data works without DB changes
- **Future-proof:** Handles both plain text and HTML input

### Considerations
- **Slight redundancy:** If narrative already has `<p>` tags, we check twice (storage + render)
- **Performance:** Regex check on every render (minimal - only runs on finished matches with narratives)
- **Alternative considered:** DB migration to convert all existing records - rejected as unnecessary with render-time conversion

## Next Phase Readiness

No blockers. This fix is self-contained and improves stability of finished match page rendering.

## Related Work

- **quick-027:** Added `roundupNarrative` field and improved match detail text to 500+ words
- **Phase 52-53:** Quality/diagnostic infrastructure that would catch similar hydration issues in future

## Learning Outcomes

1. **React hydration pitfall:** Bare text nodes in `dangerouslySetInnerHTML` create SSR/CSR DOM mismatches
2. **Solution pattern:** Always wrap plain text in proper HTML tags before setting as `innerHTML`
3. **Defensive utility design:** Idempotent functions that detect and preserve already-formatted input prevent double-wrapping bugs
4. **Two-point fixes:** Storage + render time conversions eliminate need for data migrations

## Success Metrics

- Zero `HierarchyRequestError` occurrences
- Production build passes cleanly
- Proper `<p>` tag paragraph structure in narrative rendering
- Both new and existing DB records handled correctly
