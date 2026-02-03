---
phase: 19
plan: 01
subsystem: blog
status: complete
tags: [markdown, typography, headings, react-markdown]
dependency-graph:
  requires: [18-05]
  provides: [BlogContent, extractHeadings, heading-ids]
  affects: [19-04, 19-05]
tech-stack:
  added: []
  patterns: [70ch-max-width, scroll-mt-offset, heading-slugification]
file-tracking:
  key-files:
    created:
      - src/lib/blog/extract-headings.ts
      - src/components/blog/blog-content.tsx
    modified:
      - src/app/blog/[slug]/page.tsx
decisions:
  - heading-extraction-regex: "Simple regex over AST parsing (per research: sufficient for markdown headings)"
  - reading-time-included: "Added reading time (265 WPM) per Claude discretion from CONTEXT.md"
  - duplicate-id-suffix: "Use -2, -3 suffix for duplicate heading IDs"
metrics:
  duration: ~5 minutes
  completed: 2026-02-03
---

# Phase 19 Plan 01: Blog Typography & Content Summary

**One-liner:** BlogContent with 70ch readable width, heading IDs for TOC anchoring, extractHeadings utility

## What Was Built

### 1. Heading Extraction Utility (`src/lib/blog/extract-headings.ts`)

Extracts H2 and H3 headings from markdown for TOC generation:

```typescript
export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(markdown: string): Heading[]
```

Key features:
- Simple regex pattern matching for H2/H3 headings
- URL-safe ID slugification (lowercase, replace non-word chars with hyphens)
- Duplicate heading handling with -2, -3 suffix (per research pitfall #6)

### 2. BlogContent Component (`src/components/blog/blog-content.tsx`)

React Markdown renderer with typography styling:

- **Container:** `max-w-[70ch]` for readable line length (scales with font size)
- **Heading hierarchy:** H1 (3xl), H2 (2xl), H3 (xl) with distinct weights
- **Auto-generated IDs:** Same slugification as extractHeadings for TOC consistency
- **Scroll offset:** `scroll-mt-20` on all headings for sticky header compatibility
- **Content constraints:** Images and code blocks stay within 70ch width

### 3. Blog Page Integration (`src/app/blog/[slug]/page.tsx`)

Updated blog post page to use new components:

- Replaced inline ReactMarkdown with BlogContent component
- Added reading time estimate (265 WPM calculation per Medium's standard)
- Added Clock icon for reading time display

## Requirements Addressed

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| BLOG-01: Readable line width | Complete | `max-w-[70ch]` in BlogContent |
| BLOG-02: Clear heading hierarchy | Complete | H1/H2/H3 with distinct text-* classes |
| Heading IDs for TOC | Complete | Auto-generated via slugification |
| extractHeadings utility | Complete | Ready for Plan 04 TOC component |

## Decisions Made

1. **Regex over AST parsing:** Used simple regex patterns (`/^##\s+(.+)$/`) for heading extraction instead of remark plugins. Per research: "remark plugins add complexity without major benefit for dynamic TOCs"

2. **Reading time included:** Added reading time display (265 WPM) as optional feature per CONTEXT.md "Claude's Discretion" allowance

3. **Duplicate ID handling:** Implemented -2, -3 suffix pattern for duplicate headings (per research pitfall #6)

4. **Shared slugification:** Same slugify function in both extractHeadings and BlogContent ensures TOC links match heading IDs

## Technical Implementation

### Slugification Algorithm
```typescript
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')       // Spaces to hyphens
    .replace(/-+/g, '-')        // Collapse multiple hyphens
    .replace(/^-|-$/g, '');     // Trim leading/trailing hyphens
}
```

### Heading ID Counter (reset per render)
```typescript
let headingIdCounts = new Map<string, number>();
function getUniqueHeadingId(text: string): string {
  const baseId = slugify(text);
  const count = headingIdCounts.get(baseId) || 0;
  headingIdCounts.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}-${count + 1}`;
}
```

## Commits

| Commit | Description |
|--------|-------------|
| `d50d450` | feat(19-01): create heading extraction utility for TOC generation |
| `eb35c02` | feat(19-01): create BlogContent component with typography styling |
| `febc72d` | feat(19-02): integrate BlogContent and BlogFAQ in blog page |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for Plan 04 (TOC Component):**
- extractHeadings utility exports Heading interface
- BlogContent generates matching IDs via shared slugification
- scroll-mt-20 offset ready for anchor linking

**Ready for Plan 02 (FAQ Component):**
- BlogContent provides content rendering foundation
- Native `<details>` pattern documented in research
