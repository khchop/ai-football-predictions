# Phase 25: Content Rendering Fix - Research

**Researched:** 2026-02-03
**Domain:** HTML content sanitization, React text rendering
**Confidence:** HIGH

## Summary

The BettingSoccer application has a content rendering problem where narrative content (pre-match, betting, and post-match sections) displays raw HTML tags instead of clean, formatted text. This occurs because:

1. **Root cause at generation time**: The LLM prompts instruct the AI to generate "HTML format with `<h2>`, `<p>`, `<ul>`, `<table>` tags" for roundup narratives, but the short-form narrative content (pre-match, betting, post-match in `matchContent` table) is generated as plain prose via `generateTextWithTogetherAI`.

2. **Dual content sources**: The `getMatchContentUnified` function merges content from two tables:
   - `matchContent` table: Contains plain text prose (pre-match, betting, short post-match)
   - `matchRoundups` table: Contains HTML-formatted narrative (long-form post-match)

3. **Inconsistent rendering**: The `MatchContentSection` component renders content as plain text, but the unified query may return HTML from `matchRoundups.narrative`. Meanwhile, `RoundupViewer` and `AnalysisTab` use `dangerouslySetInnerHTML` for HTML content.

**Primary recommendation:** Strip HTML tags from narrative content at the rendering layer, ensuring all text displays as clean prose. Use `isomorphic-dompurify` for SSR-compatible sanitization, with `ALLOWED_TAGS: []` to extract plain text.

## Standard Stack

The established libraries for HTML sanitization in React/Next.js:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| isomorphic-dompurify | ^2.20.0 | SSR-compatible HTML sanitization | Works in both server and client environments, required for Next.js App Router |
| dompurify | ^3.3.x | Underlying sanitization engine | Industry-standard XSS sanitizer, battle-tested, fast |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| string-strip-html | ^13.x | Pure regex-based tag stripping | Lightweight alternative if SSR sanitization not needed |
| sanitize-html | ^2.x | Server-side sanitization | When fine-grained tag whitelist control needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| isomorphic-dompurify | Pure regex `/\<[^>]*>/g` | Regex can fail on malformed HTML, misses edge cases |
| isomorphic-dompurify | string-strip-html | Doesn't handle HTML entities, smaller but less robust |
| DOMPurify in client component | Server Component with textContent | Requires `'use client'` directive, increases client bundle |

**Installation:**
```bash
npm install isomorphic-dompurify
```

## Architecture Patterns

### Recommended Approach: Utility Function + Component Wrapper

```
src/
  lib/
    utils/
      strip-html.ts          # Core HTML stripping utility
  components/
    content/
      safe-text.tsx          # Reusable component for rendering sanitized text
      entity-linked-text.tsx # Existing, receives clean text
```

### Pattern 1: HTML Stripping Utility
**What:** A utility function that removes all HTML tags from a string, preserving text content.
**When to use:** Before rendering any LLM-generated narrative content.
**Example:**
```typescript
// src/lib/utils/strip-html.ts
import DOMPurify from 'isomorphic-dompurify';

/**
 * Strip all HTML tags from a string, returning plain text.
 * Handles edge cases like malformed HTML, HTML entities, and nested tags.
 *
 * @param html - String potentially containing HTML tags
 * @returns Plain text with all HTML tags removed
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  // DOMPurify with no allowed tags = strip all HTML, keep text
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  // Normalize whitespace and trim
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Strip HTML tags but preserve paragraph breaks as newlines.
 * Useful for multi-paragraph content display.
 */
export function stripHtmlPreserveBreaks(html: string | null | undefined): string {
  if (!html) return '';

  // Replace block-level tags with newlines before stripping
  const withBreaks = html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  return stripHtml(withBreaks)
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .trim();
}
```

### Pattern 2: Safe Text Rendering Component
**What:** A component that safely renders text with optional entity linking.
**When to use:** Replace direct text interpolation in narrative sections.
**Example:**
```typescript
// src/components/content/safe-text.tsx
import { stripHtml } from '@/lib/utils/strip-html';
import { EntityLinkedText } from './entity-linked-text';

interface SafeTextProps {
  text: string | null | undefined;
  enableEntityLinking?: boolean;
  teams?: string[];
  models?: Array<{ id: string; displayName: string }>;
  maxLinks?: number;
  className?: string;
}

export function SafeText({
  text,
  enableEntityLinking = false,
  teams = [],
  models = [],
  maxLinks = 5,
  className,
}: SafeTextProps) {
  const cleanText = stripHtml(text);

  if (!cleanText) return null;

  if (enableEntityLinking && (teams.length > 0 || models.length > 0)) {
    return (
      <EntityLinkedText
        text={cleanText}
        teams={teams}
        models={models}
        maxLinks={maxLinks}
        className={className}
      />
    );
  }

  return <span className={className}>{cleanText}</span>;
}
```

### Pattern 3: Database Content Cleaning (Migration)
**What:** Clean existing HTML fragments from database content.
**When to use:** One-time migration script to fix stored data.
**Example:**
```typescript
// scripts/clean-narrative-content.ts
import { getDb, matchContent } from '@/lib/db';
import { stripHtml } from '@/lib/utils/strip-html';

async function cleanStoredContent() {
  const db = getDb();

  // Get all content records
  const records = await db.select().from(matchContent);

  for (const record of records) {
    // Only clean short-form prose content, not full HTML roundups
    const updates: Record<string, string> = {};

    if (record.preMatchContent && record.preMatchContent.includes('<')) {
      updates.preMatchContent = stripHtml(record.preMatchContent);
    }
    if (record.bettingContent && record.bettingContent.includes('<')) {
      updates.bettingContent = stripHtml(record.bettingContent);
    }

    if (Object.keys(updates).length > 0) {
      await db.update(matchContent)
        .set(updates)
        .where(eq(matchContent.id, record.id));
    }
  }
}
```

### Anti-Patterns to Avoid
- **Using regex alone for HTML stripping:** Regex like `/<[^>]*>/g` fails on malformed HTML (`<div>foo</bar>`) and doesn't handle HTML entities (`&amp;`).
- **Stripping HTML at query time:** SQL `REPLACE` or regex in database adds complexity and doesn't handle all cases.
- **Using `dangerouslySetInnerHTML` for prose content:** Exposes XSS risk and renders HTML when plain text is expected.
- **Client-side only sanitization:** Fails during SSR with "window is undefined" errors.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Strip HTML tags | Regex `/\<[^>]*>/g` | DOMPurify with `ALLOWED_TAGS: []` | Handles malformed HTML, entities, nested tags |
| Decode HTML entities | Manual `&amp;` → `&` mapping | DOMPurify's built-in decoding | Covers all 2,231 HTML entities |
| SSR-safe sanitization | Conditional `typeof window` checks | isomorphic-dompurify | Already handles jsdom setup for server |
| XSS prevention | Manual escaping | DOMPurify | Battle-tested against mutation XSS and edge cases |

**Key insight:** HTML sanitization has numerous edge cases (mutation XSS, Unicode normalization, entity decoding) that DOMPurify handles through years of security research. Rolling custom regex solutions will miss edge cases.

## Common Pitfalls

### Pitfall 1: SSR Window Undefined
**What goes wrong:** DOMPurify uses browser DOM APIs, causing `ReferenceError: window is not defined` in Next.js server components.
**Why it happens:** Next.js App Router renders components on the server by default.
**How to avoid:** Use `isomorphic-dompurify` which wraps DOMPurify with jsdom for server environments.
**Warning signs:** Error appears during `next build` or on first page load.

### Pitfall 2: Mixed Content Sources
**What goes wrong:** The unified query merges plain text and HTML content, but rendering assumes consistent format.
**Why it happens:** `COALESCE(matchRoundups.narrative, matchContent.postMatchContent)` returns HTML if roundup exists, plain text otherwise.
**How to avoid:** Always strip HTML at rendering time, treating all content as potentially containing HTML.
**Warning signs:** Post-match content shows HTML tags only for matches with roundups generated.

### Pitfall 3: Entity Linking on HTML
**What goes wrong:** EntityLinkedText adds `<Link>` components around text, but if the text contains HTML, the regex matching breaks.
**Why it happens:** Regex word boundary matching `\b` doesn't account for HTML tags within entity names.
**How to avoid:** Strip HTML before passing to EntityLinkedText.
**Warning signs:** Partial entity matches, broken links, or HTML tags appearing inside link text.

### Pitfall 4: Whitespace Normalization
**What goes wrong:** After stripping HTML, content has excessive whitespace from removed tags.
**Why it happens:** HTML like `<p>Foo</p><p>Bar</p>` becomes `Foo  Bar` with extra spaces.
**How to avoid:** Normalize whitespace after stripping: `.replace(/\s+/g, ' ').trim()`.
**Warning signs:** Content has multiple spaces or leading/trailing whitespace.

### Pitfall 5: Modifying LLM Prompts
**What goes wrong:** Changing prompts to not generate HTML breaks existing pipelines and creates inconsistent content.
**Why it happens:** Some content types (roundup narrative) legitimately need HTML for structure.
**How to avoid:** Keep prompts as-is, handle formatting at rendering layer. Defense in depth.
**Warning signs:** Existing HTML-rendered roundups break if prompts change.

## Code Examples

Verified patterns for this implementation:

### Stripping HTML with DOMPurify
```typescript
// Source: DOMPurify documentation - https://github.com/cure53/DOMPurify
import DOMPurify from 'isomorphic-dompurify';

// Strip all HTML, keep text content
const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: [],  // No tags allowed
  KEEP_CONTENT: true, // Keep text nodes
});
```

### Using in MatchContentSection
```typescript
// Current (problematic):
{content.preMatchContent}

// Fixed:
import { stripHtml } from '@/lib/utils/strip-html';
{stripHtml(content.preMatchContent)}

// Or with entity linking:
<SafeText
  text={content.preMatchContent}
  enableEntityLinking={teams.length > 0 || models.length > 0}
  teams={teams}
  models={models}
/>
```

### NarrativePreview Update
```typescript
// Current: word splitting on potentially HTML content
const words = previewText.split(/\s+/)

// Fixed: strip HTML first
import { stripHtml } from '@/lib/utils/strip-html';
const cleanText = stripHtml(previewText);
const words = cleanText.split(/\s+/);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dangerouslySetInnerHTML everywhere | Selective HTML vs plain text rendering | 2024-2025 | Better security, cleaner UX |
| DOMPurify + jsdom manual setup | isomorphic-dompurify package | 2022 | Simpler SSR configuration |
| Regex-based tag stripping | DOMPurify ALLOWED_TAGS: [] | Ongoing | Handles edge cases, HTML entities |

**Deprecated/outdated:**
- **Manual jsdom initialization for DOMPurify**: Use isomorphic-dompurify instead
- **striptags v3**: Newer versions have different API, use v5+ or string-strip-html

## Open Questions

Things that couldn't be fully resolved:

1. **Database cleanup scope**
   - What we know: Some `matchContent` records may have HTML in prose fields
   - What's unclear: Exact count and pattern of affected records
   - Recommendation: Add logging to identify affected records before migration, clean on first render

2. **Long-form roundup narrative rendering**
   - What we know: `matchRoundups.narrative` is intentionally HTML for structure (headings, lists, tables)
   - What's unclear: Should unified content distinguish "short prose" vs "long HTML" explicitly?
   - Recommendation: For Phase 25, strip HTML from all content displayed in MatchContentSection; leave RoundupViewer as-is since it expects HTML

3. **Performance impact of sanitization**
   - What we know: DOMPurify is highly optimized, benchmarks show ~3ms for typical content
   - What's unclear: Impact on Server Component rendering with many matches
   - Recommendation: Measure in development, consider caching if needed (unlikely to be significant)

## Sources

### Primary (HIGH confidence)
- [DOMPurify GitHub Repository](https://github.com/cure53/DOMPurify) - API documentation, configuration options
- [isomorphic-dompurify npm](https://www.npmjs.com/package/isomorphic-dompurify) - SSR usage patterns
- Codebase analysis: `src/components/match/MatchContent.tsx`, `src/lib/content/match-content.ts`, `src/lib/content/prompts.ts`

### Secondary (MEDIUM confidence)
- [DOMPurify vs sanitize-html comparison](https://npm-compare.com/dompurify,sanitize-html,xss) - Library selection rationale
- [Sentry: dangerouslySetInnerHTML in Next.js](https://sentry.io/answers/using-dangerouslysetinnerhtml-in-next-js/) - SSR patterns
- [GeeksforGeeks: Strip HTML tags](https://www.geeksforgeeks.org/javascript/how-to-strip-out-html-tags-from-a-string-using-javascript/) - Alternative approaches

### Tertiary (LOW confidence)
- General web search results for React HTML sanitization patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - DOMPurify is established industry standard, isomorphic-dompurify solves SSR problem
- Architecture: HIGH - Patterns verified against existing codebase structure
- Pitfalls: HIGH - Based on direct codebase analysis and identified mixed content sources

**Research date:** 2026-02-03
**Valid until:** 90 days (stable domain, DOMPurify major versions rare)
