---
phase: 22
plan: 03
subsystem: content
tags: [entity-linking, internal-linking, seo, server-components]
dependency-graph:
  requires: [22-01]
  provides: [entity-dictionary, text-linking-utility, entity-linked-text-component]
  affects: [22-04, match-pages, blog-pages]
tech-stack:
  added: []
  patterns: [entity-linking, word-boundary-matching, server-component-rendering]
key-files:
  created:
    - src/lib/content/entity-linking.tsx
    - src/components/content/entity-linked-text.tsx
  modified: []
decisions:
  - id: entity-sorting
    choice: "Sort entities by name length descending"
    reason: "Prevents partial matches (e.g., 'Champions League' before 'League')"
  - id: max-links-default
    choice: "Default maxLinks=5 per content block"
    reason: "Prevents over-linking which hurts readability"
  - id: link-once
    choice: "Each entity linked only once per text block"
    reason: "Standard SEO practice, improves readability"
  - id: word-boundaries
    choice: "Regex word boundaries for matching"
    reason: "Prevents false positives like 'Arsenal' in 'Arsenaler'"
  - id: tsx-extension
    choice: "Use .tsx for entity-linking utility"
    reason: "Contains JSX (Link components), requires JSX parser"
metrics:
  duration: 5 minutes
  completed: 2026-02-03
---

# Phase 22 Plan 03: Entity Linking Utilities Summary

Entity dictionary builder and text linking utilities for automated internal linking.

## What Was Done

### Task 1: Create entity linking utilities
**Commit:** `c4ec6b3`
**Files:** `src/lib/content/entity-linking.tsx`

Created entity linking utilities with:
- `Entity` interface defining name, aliases, href, and type
- `buildEntityDictionary()` function that builds entity list from:
  - COMPETITIONS config (competitions with aliases)
  - Team names (unique, URL-encoded)
  - Model objects (id and displayName)
- `linkEntitiesInText()` function that converts text to React nodes with links:
  - Word boundary matching prevents false positives
  - Entities sorted by length descending (match longer names first)
  - Each entity linked only once per text block
  - maxLinks parameter limits total links (default: 5)
  - Preserves original casing from source text

### Task 2: Create EntityLinkedText server component
**Commit:** `6964aab`
**Files:** `src/components/content/entity-linked-text.tsx`

Created server component that:
- Accepts text, teams, models, and maxLinks props
- Calls buildEntityDictionary and linkEntitiesInText internally
- Renders as server component (no 'use client' directive)
- Supports optional className wrapper
- Ready for integration in match content and blog posts

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entity sorting | Length descending | Match "Champions League" before "League" |
| Max links default | 5 per block | Prevents over-linking, maintains readability |
| Link frequency | Once per entity | SEO best practice, cleaner UX |
| Matching method | Word boundaries | Prevents partial matches ("Arsenal" in "Arsenaler") |
| File extension | .tsx | Contains JSX (Link components) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed .ts to .tsx file extension**
- **Found during:** Task 1 verification
- **Issue:** File contained JSX (Link components) but had .ts extension
- **Fix:** Changed to .tsx extension for proper JSX parsing
- **Files modified:** `src/lib/content/entity-linking.tsx`
- **Commit:** c4ec6b3 (included in original commit)

## Technical Notes

### Entity Dictionary Structure
```typescript
interface Entity {
  name: string;        // Display name (e.g., "Premier League")
  aliases: string[];   // Alternative names (e.g., ["premier-league"])
  href: string;        // Link destination
  type: 'competition' | 'team' | 'model';
}
```

### Link Generation
- Competitions: `/leagues/{id}`
- Teams: `/matches?team={encodeURIComponent(team)}`
- Models: `/models/{id}`

### Regex Pattern
```typescript
const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');
```
- `\b` word boundaries prevent partial matches
- Case-insensitive (`i` flag) for flexible matching
- Global (`g` flag) for finding all occurrences

## Next Phase Readiness

Phase 22 Plan 04 can now:
- Use `EntityLinkedText` component in match content sections
- Use `buildEntityDictionary` for custom entity linking scenarios
- Pass team names from match data for automatic team linking

## Verification Results

All success criteria met:
- [x] buildEntityDictionary creates entity list from competitions, teams, and models
- [x] linkEntitiesInText converts text to React nodes with links
- [x] EntityLinkedText component ready for use in content sections
- [x] No client-side JavaScript required (server component)
