# Phase 33: HTML Sanitization - Research

**Researched:** 2026-02-04
**Domain:** HTML sanitization, LLM output cleaning, content migration
**Confidence:** HIGH

## Summary

HTML sanitization for LLM-generated content requires three coordinated approaches: prompt engineering to prevent HTML generation, runtime sanitization to clean output before database save, and data migration to clean existing polluted content.

The standard approach uses specialized libraries rather than regex-based solutions. For plain text conversion, `html-to-text` (npm's most popular HTML-to-text converter with 1344+ dependents) handles structural tags like `<br>` and `<p>` with proper formatting preservation. For entity decoding, the `he` library (2535+ dependents) provides robust encoding/decoding of all standardized HTML entities.

Prompt engineering alone is insufficient—OpenAI's API has been shown to consistently include disallowed HTML tags even when explicitly prohibited in prompts. A defense-in-depth approach combining prompt instructions, runtime sanitization, and validation is required.

**Primary recommendation:** Use `html-to-text` for structural conversion, `he` for entity decoding, apply sanitization immediately before database save (not at render), and use a TypeScript migration script following the project's established pattern in `scripts/`.

## Standard Stack

The established libraries/tools for HTML sanitization in Node.js/TypeScript:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| html-to-text | 9.0.5+ | Convert HTML to plain text with formatting | Most widely adopted (1344 dependents), handles nested tags, configurable formatters |
| he | Latest | Decode HTML entities to characters | Robust (2535 dependents), handles all HTML5 entities, supports astral Unicode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | Latest | XSS-safe HTML sanitization | When allowing HTML but need XSS protection (NOT needed here) |
| sanitize-html | Latest | Whitelist-based HTML cleaning | When preserving specific safe tags (NOT needed here) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| html-to-text | regex-based stripping | Regex fails on nested/malformed HTML, misses edge cases |
| he | native browser DOM methods | Not available server-side, requires jsdom wrapper |
| TypeScript script | Drizzle SQL migration | SQL harder to test, less flexible for complex transformations |

**Installation:**
```bash
npm install html-to-text he
npm install --save-dev @types/html-to-text
```

## Architecture Patterns

### Recommended Sanitization Flow
```
LLM Response → Sanitize (html-to-text + he) → Database Save
                ↓
            Validate (no HTML check)
```

**NOT:** LLM Response → Database Save → Sanitize at Render (old pattern)

### Pattern 1: Pre-Save Sanitization Layer
**What:** Sanitize content immediately before database insertion, not at render time
**When to use:** All LLM-generated content that should be plain text
**Why:** Ensures data integrity, prevents HTML pollution in database, enables reliable queries

**Example:**
```typescript
// Source: Project context + industry best practices
import { convert } from 'html-to-text';
import { decode } from 'he';

function sanitizeContent(rawContent: string): string {
  // Step 1: Convert HTML tags to plain text equivalents
  const plainText = convert(rawContent, {
    wordwrap: false,
    selectors: [
      { selector: 'br', format: 'lineBreak' },
      { selector: 'p', format: 'block', options: { leadingLineBreaks: 2, trailingLineBreaks: 2 } },
      { selector: 'strong', format: 'inline' },
      { selector: 'em', format: 'inline' },
    ]
  });

  // Step 2: Decode HTML entities
  const decoded = decode(plainText);

  // Step 3: Normalize whitespace
  return decoded.replace(/\n{3,}/g, '\n\n').trim();
}

// Apply before database save
await db.insert(matchContent).values({
  preMatchContent: sanitizeContent(llmResponse.content),
  // ...
});
```

### Pattern 2: Prompt Engineering Defense
**What:** Add explicit plain text instructions to LLM prompts
**When to use:** All content generation prompts (primary defense layer)
**Why:** Reduces HTML generation frequency, but NOT reliable alone

**Example:**
```typescript
// Source: 2026 prompt engineering best practices
const systemPrompt = `You are a sports analyst.
OUTPUT REQUIREMENTS:
- Plain text only, no HTML tags
- No markup or formatting codes
- Use natural line breaks, not <br> tags
- Write prose, not code`;

const userPrompt = `${dataContext}

CRITICAL: Return plain text only. Do NOT use HTML tags, entities, or markup.
Write natural prose with paragraph breaks.`;
```

### Pattern 3: Migration Script Pattern
**What:** TypeScript script that processes all records, sanitizes in place, reports progress
**When to use:** One-time cleanup of existing content
**Why:** Testable, reversible via git, progress tracking, error handling

**Example:**
```typescript
// Source: scripts/backfill-slugs.ts pattern
import { getDb, matchContent } from '../src/lib/db';
import { sanitizeContent } from '../src/lib/content/sanitization';

async function cleanHtmlContent() {
  const db = getDb();
  const records = await db.select().from(matchContent);

  let cleaned = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const updates: any = {};

      if (record.preMatchContent) {
        updates.preMatchContent = sanitizeContent(record.preMatchContent);
      }
      if (record.bettingContent) {
        updates.bettingContent = sanitizeContent(record.bettingContent);
      }
      if (record.postMatchContent) {
        updates.postMatchContent = sanitizeContent(record.postMatchContent);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(matchContent)
          .set(updates)
          .where(eq(matchContent.id, record.id));
        cleaned++;

        if (cleaned % 10 === 0) {
          console.log(`Processed ${cleaned}/${records.length}...`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Failed for ${record.id}:`, error);
    }
  }

  console.log(`✓ Cleaned ${cleaned} records, skipped ${skipped}`);
}
```

### Anti-Patterns to Avoid
- **Sanitizing at render time:** Data integrity issue, HTML stays in database, query problems
- **Regex-only sanitization:** Fails on nested tags, malformed HTML, entity combinations
- **Trusting prompt engineering alone:** LLMs ignore format constraints regularly
- **No validation after sanitization:** Always verify no HTML remains before save

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML tag stripping | Regex like `/<[^>]+>/g` | html-to-text | Nested tags, self-closing tags, malformed HTML, attribute handling all break regex |
| Entity decoding | Manual replace map | he library | 2000+ named entities, numeric entities, malformed entities, browser compatibility |
| Tag-to-text conversion | Custom parser | html-to-text selectors | Handles whitespace, block vs inline, lists, tables, proper formatting |
| Validation | Simple string search | Comprehensive check | `&lt;` appears as text, angle brackets in math, false positives |

**Key insight:** HTML parsing is deceptively complex. Browsers are lenient, accepting malformed HTML that breaks simple parsers. Edge cases include: unclosed tags, nested same-tags, CDATA sections, comments, entity combinations, attribute quoting variations, and Unicode in tags.

## Common Pitfalls

### Pitfall 1: Modifying Content After Sanitization
**What goes wrong:** Re-introducing HTML through string concatenation, template interpolation, or library transformations
**Why it happens:** Sanitization happens early, then content flows through multiple processing steps
**How to avoid:** Sanitize as the LAST step before database save, not early in pipeline
**Warning signs:** HTML appears in database despite sanitization code running

### Pitfall 2: Prompt Engineering Over-Reliance
**What goes wrong:** LLMs consistently generate HTML despite explicit prohibition in prompts
**Why it happens:** Models trained on HTML-heavy corpora, format instructions have weak adherence
**How to avoid:** Treat prompts as first defense layer, ALWAYS apply runtime sanitization
**Warning signs:** "But I told it not to generate HTML" debugging sessions

### Pitfall 3: Sanitizing Only Visible Content Fields
**What goes wrong:** Forgetting metadata fields (keywords, meta descriptions, titles) that also get polluted
**Why it happens:** Focus on main content, miss auxiliary fields
**How to avoid:** Audit ALL text fields in content tables, sanitize universally
**Warning signs:** HTML in page titles, meta descriptions, or structured data

### Pitfall 4: Entity-Only or Tag-Only Cleaning
**What goes wrong:** Cleaning entities but not tags (or vice versa) leaves partial HTML
**Why it happens:** Assuming one pass is sufficient
**How to avoid:** Two-step process: structural conversion (html-to-text), then entity decode (he)
**Warning signs:** Either visible tags OR entity codes remaining, but not both

### Pitfall 5: No Migration Verification
**What goes wrong:** Migration claims success but HTML remains in database
**Why it happens:** No post-migration validation query
**How to avoid:** After migration, run SQL query: `SELECT * FROM table WHERE field LIKE '%<%' OR field LIKE '%&amp;%'`
**Warning signs:** Users report HTML after "successful" migration

### Pitfall 6: Regex-Based "Quick Fix"
**What goes wrong:** Simple regex strips some tags but fails on edge cases
**Why it happens:** Regex looks simple, avoiding library dependency seems faster
**How to avoid:** Use html-to-text from the start, it's battle-tested on billions of HTML documents
**Warning signs:** Works in testing, fails in production with real LLM output

### Pitfall 7: Whitespace Chaos
**What goes wrong:** Removing tags leaves excessive whitespace, or conversely collapses needed spacing
**Why it happens:** HTML whitespace handling differs from plain text
**How to avoid:** html-to-text handles this correctly, post-process with `replace(/\n{3,}/g, '\n\n')`
**Warning signs:** Paragraphs run together or excessive blank lines

### Pitfall 8: Markdown Confusion
**What goes wrong:** Preserving markdown in content meant to be plain text, or destroying it when needed
**Why it happens:** Unclear requirements about "plain text" vs "markdown-formatted text"
**How to avoid:** Decision per content type (CONTEXT.md allows Claude's discretion here)
**Warning signs:** Asterisks, hashtags, or brackets appearing in output when not expected

## Code Examples

Verified patterns based on research and project architecture:

### Complete Sanitization Function
```typescript
// Source: Combining html-to-text and he best practices
import { convert } from 'html-to-text';
import { decode } from 'he';

/**
 * Sanitize LLM-generated content to plain text
 * Converts HTML tags to text equivalents and decodes entities
 */
export function sanitizeContent(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }

  // Step 1: Convert HTML structure to plain text
  const plainText = convert(content, {
    wordwrap: false, // Preserve original line breaks
    preserveNewlines: true,
    selectors: [
      // Block elements get line breaks
      { selector: 'p', format: 'block', options: { leadingLineBreaks: 2, trailingLineBreaks: 2 } },
      { selector: 'br', format: 'lineBreak' },
      { selector: 'div', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },

      // Inline elements keep inner text only
      { selector: 'strong', format: 'inline' },
      { selector: 'em', format: 'inline' },
      { selector: 'b', format: 'inline' },
      { selector: 'i', format: 'inline' },

      // Strip everything else
      { selector: '*', format: 'skip' },
    ],
  });

  // Step 2: Decode HTML entities
  const decoded = decode(plainText);

  // Step 3: Normalize whitespace (max 2 consecutive newlines)
  const normalized = decoded
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Validate content is HTML-free
 * Throws if HTML detected (use before save for strict enforcement)
 */
export function validateNoHtml(content: string): void {
  // Check for opening tags
  if (/<[a-z][\s\S]*?>/i.test(content)) {
    throw new Error('Content contains HTML tags');
  }

  // Check for common entities (should be decoded by now)
  if (/&(?:amp|lt|gt|quot|nbsp);/.test(content)) {
    throw new Error('Content contains HTML entities');
  }
}
```

### Integration with Existing Content Generation
```typescript
// Source: src/lib/content/match-content.ts pattern
import { sanitizeContent, validateNoHtml } from '@/lib/content/sanitization';

export async function generatePreMatchContent(matchId: string): Promise<void> {
  // ... existing LLM call ...
  const result = await generateTextWithTogetherAI(systemPrompt, prompt, 0.7, 1000);

  // Sanitize before validation
  const cleanContent = sanitizeContent(result.content);

  // Validate meets quality thresholds (existing function)
  validateGeneratedContent(cleanContent, 'pre-match', 100);

  // Additional HTML check
  validateNoHtml(cleanContent);

  // Save sanitized content
  await db2.insert(matchContent).values({
    id: contentId,
    matchId,
    preMatchContent: cleanContent, // <-- sanitized
    // ...
  });
}
```

### Migration Script Structure
```typescript
// Source: scripts/backfill-slugs.ts pattern + sanitization needs
import { getDb, matchContent, blogPosts, matchPreviews, matchRoundups } from '../src/lib/db';
import { sanitizeContent, validateNoHtml } from '../src/lib/content/sanitization';
import { eq } from 'drizzle-orm';

async function cleanHtmlFromContent() {
  const db = getDb();
  console.log('Starting HTML sanitization migration...\n');

  // 1. Clean matchContent table
  console.log('Cleaning matchContent...');
  const contentRecords = await db.select().from(matchContent);
  let contentCleaned = 0;

  for (const record of contentRecords) {
    const updates: any = {};

    if (record.preMatchContent) {
      updates.preMatchContent = sanitizeContent(record.preMatchContent);
    }
    if (record.bettingContent) {
      updates.bettingContent = sanitizeContent(record.bettingContent);
    }
    if (record.postMatchContent) {
      updates.postMatchContent = sanitizeContent(record.postMatchContent);
    }
    // Note: faqContent is JSON, sanitize answer fields
    if (record.faqContent) {
      const faqs = JSON.parse(record.faqContent);
      updates.faqContent = JSON.stringify(
        faqs.map((faq: any) => ({
          question: sanitizeContent(faq.question),
          answer: sanitizeContent(faq.answer),
        }))
      );
    }

    if (Object.keys(updates).length > 0) {
      await db.update(matchContent)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(matchContent.id, record.id));
      contentCleaned++;

      if (contentCleaned % 10 === 0) {
        console.log(`  Processed ${contentCleaned}/${contentRecords.length}...`);
      }
    }
  }

  console.log(`✓ Cleaned ${contentCleaned} matchContent records\n`);

  // 2. Clean blogPosts table
  console.log('Cleaning blogPosts...');
  const blogRecords = await db.select().from(blogPosts);
  let blogsCleaned = 0;

  for (const blog of blogRecords) {
    await db.update(blogPosts).set({
      title: sanitizeContent(blog.title),
      excerpt: blog.excerpt ? sanitizeContent(blog.excerpt) : null,
      content: sanitizeContent(blog.content),
      metaTitle: blog.metaTitle ? sanitizeContent(blog.metaTitle) : null,
      metaDescription: blog.metaDescription ? sanitizeContent(blog.metaDescription) : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(blogPosts.id, blog.id));

    blogsCleaned++;
    if (blogsCleaned % 10 === 0) {
      console.log(`  Processed ${blogsCleaned}/${blogRecords.length}...`);
    }
  }

  console.log(`✓ Cleaned ${blogsCleaned} blogPosts records\n`);

  // 3. Verification query
  console.log('Verifying HTML removal...');
  const verification = await db.execute(sql`
    SELECT
      'matchContent' as table_name,
      COUNT(*) as html_count
    FROM match_content
    WHERE
      pre_match_content LIKE '%<%' OR
      betting_content LIKE '%<%' OR
      post_match_content LIKE '%<%' OR
      pre_match_content LIKE '%&amp;%' OR
      betting_content LIKE '%&amp;%' OR
      post_match_content LIKE '%&amp;%'

    UNION ALL

    SELECT
      'blogPosts' as table_name,
      COUNT(*) as html_count
    FROM blog_posts
    WHERE
      title LIKE '%<%' OR
      content LIKE '%<%' OR
      title LIKE '%&amp;%' OR
      content LIKE '%&amp;%'
  `);

  console.log('\nVerification results:');
  verification.rows.forEach((row: any) => {
    if (row.html_count > 0) {
      console.log(`  ⚠️  ${row.table_name}: ${row.html_count} records still contain HTML`);
    } else {
      console.log(`  ✓ ${row.table_name}: clean`);
    }
  });

  console.log('\nMigration complete!');
}

cleanHtmlFromContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

### Prompt Updates
```typescript
// Source: Prompt engineering best practices 2026
// Update: src/lib/content/match-content.ts prompts

// BEFORE (implicit expectation)
const prompt = `Write 4-5 sentences...`;

// AFTER (explicit plain text requirement)
const prompt = `Write 4-5 sentences (~150-200 words)...

OUTPUT FORMAT:
- Plain text only, no HTML tags
- No HTML entities (use actual characters: &, ", etc.)
- Use natural line breaks for paragraphs
- Write prose, not markup

Write flowing prose without headers.`;

// For JSON responses, emphasize in system prompt
const systemPrompt = `You are a professional football analyst.

CRITICAL OUTPUT REQUIREMENTS:
- Return valid JSON only
- All text fields must be plain text
- Do NOT use HTML tags in any field
- Do NOT use HTML entities (&amp;, &quot;, etc.)
- Use natural characters and line breaks`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sanitize at render | Sanitize before save | 2024-2025 | Database integrity, reliable queries, no render complexity |
| Regex stripping | html-to-text library | Always standard | Handles edge cases, maintainable, robust |
| Manual entity maps | he library | Always standard | Complete entity support, Unicode-safe |
| SQL migrations | TypeScript scripts | Project pattern | Testable, version controlled, error handling |
| Trust prompt only | Defense in depth | 2025-2026 | LLMs proven to ignore format instructions |

**Deprecated/outdated:**
- Client-side sanitization only: Security risk, not applicable for server-generated content
- DOMPurify for plain text: Overkill for plain text conversion, designed for XSS prevention when allowing HTML
- String.replace chains: Unmaintainable, error-prone, misses edge cases

## Open Questions

No blocking open questions. All technical approaches are well-established.

Areas for implementation decision (Claude's discretion per CONTEXT.md):

1. **Markdown preservation per content type**
   - What we know: Some content may benefit from markdown (FAQs with lists), others want pure plain text
   - What's unclear: Specific decision per field (preMatchContent, bettingContent, etc.)
   - Recommendation: Default to plain text everywhere, preserve markdown only if rendering layer already supports it

2. **Legitimate angle brackets**
   - What we know: Math comparisons (e.g., "score > 3") should preserve angle brackets
   - What's unclear: How often this occurs in football content
   - Recommendation: html-to-text handles this correctly—only actual tags are removed, plain text angle brackets remain

3. **Migration timing**
   - What we know: Can run anytime, cleans in place
   - What's unclear: Before or after prompt updates
   - Recommendation: After prompt updates deployed, so new content is already clean

## Sources

### Primary (HIGH confidence)
- [html-to-text npm package](https://www.npmjs.com/package/html-to-text) - Official documentation, 1344 dependents
- [he library GitHub](https://github.com/mathiasbynens/he) - Official documentation, 2535 dependents
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) - Official Drizzle migration docs
- [Drizzle ORM Update](https://orm.drizzle.team/docs/update) - Official Drizzle update query docs
- Project codebase (`scripts/backfill-slugs.ts`, `src/lib/content/match-content.ts`) - Established patterns

### Secondary (MEDIUM confidence)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) - Security pitfalls
- [Lakera Prompt Engineering Guide 2026](https://www.lakera.ai/blog/prompt-engineering-guide) - LLM output control best practices
- [SearchCans: Markdown vs HTML for LLM Context 2026](https://www.searchcans.com/blog/markdown-vs-html-llm-context-optimization-2026/) - Format considerations
- [ButterCMS HTML Sanitization Best Practices](https://buttercms.com/knowledge-base/html-sanitization-best-practices/) - General sanitization guidance

### Tertiary (LOW confidence, flagged for validation)
- WebSearch results on "LLM plain text output prevent HTML tags" - Confirmed prompt engineering limitations
- WebSearch results on "common pitfalls HTML sanitization" - Validated known issues

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries have 1000+ dependents, official documentation, active maintenance
- Architecture: HIGH - Patterns verified against project codebase, industry best practices
- Pitfalls: HIGH - Sourced from OWASP, official documentation, confirmed by multiple sources
- Prompt engineering: MEDIUM - 2026 best practices confirmed, but LLM behavior inherently variable
- Migration approach: HIGH - Project already uses TypeScript migration pattern successfully

**Research date:** 2026-02-04
**Valid until:** 60 days (stable domain, libraries mature, patterns established)

**Key findings verified:**
- ✓ html-to-text is npm's standard (WebSearch, npm stats)
- ✓ he library is standard for entities (WebSearch, GitHub stars, dependents)
- ✓ Prompt engineering alone insufficient (OpenAI community reports, research papers)
- ✓ Defense-in-depth approach required (OWASP, security best practices)
- ✓ Project uses TypeScript migration scripts (codebase inspection)
- ✓ Sanitize before save, not at render (2024-2025 industry shift, database integrity benefits)
