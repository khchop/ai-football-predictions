---
phase: 19-blog-page-rebuild
plan: 02
subsystem: blog
tags: [faq, accordion, schema, geo, seo]
dependency-graph:
  requires: [19-01]
  provides: [faq-extraction, blog-faq-component]
  affects: [19-05]
tech-stack:
  added: []
  patterns: [native-details-summary, faq-schema, answer-first]
key-files:
  created:
    - src/lib/blog/extract-faqs.ts
    - src/components/blog/blog-faq.tsx
  modified: []
decisions:
  - TL;DR question first in FAQ list for AI citation priority
  - Native details/summary for zero-JS accordion
  - 300 char answer truncation for schema best practice
  - 5 FAQ max default for reasonable schema size
metrics:
  duration: 4m
  completed: 2026-02-03
---

# Phase 19 Plan 02: FAQ Section with Schema Summary

**TL;DR:** FAQ extraction utility auto-generates FAQs from markdown headings, BlogFAQ component provides native accordion with FAQPage schema injection for GEO optimization.

## What Was Built

### FAQ Extraction Utility (`src/lib/blog/extract-faqs.ts`)

Auto-generates FAQs from blog content using multiple extraction strategies:

1. **Question Headings** (primary): Extracts `## heading ending with ?` as questions, content until next heading as answers
2. **Q:/A: Patterns**: Extracts explicit Q:/A: formatted content
3. **Bolded Questions**: Extracts `**question?**` followed by answer text
4. **TL;DR Option**: When enabled, adds "What is this article about?" as FIRST FAQ for AI citation priority

Configuration options:
- `maxFaqs`: Default 5, limits extracted FAQs
- `includeDefaultTLDR`: Adds TL;DR question first
- `excerpt`: Used as TL;DR answer

Answer processing:
- Truncated to 300 characters (schema best practice)
- Markdown stripped for clean text
- Deduplicated by question text (case-insensitive)

### BlogFAQ Component (`src/components/blog/blog-faq.tsx`)

Native accordion with FAQPage schema:

```tsx
<BlogFAQ faqs={extractFAQs(markdown, { maxFaqs: 5 })} />
```

Features:
- Native `<details>`/`<summary>` for zero-JS accordion
- Chevron rotation on open (`group-open:rotate-180`)
- FaqSchema injection for JSON-LD
- Returns null for empty faqs (no section rendered)
- Matches match-faq.tsx pattern exactly

## Key Implementation Details

### GEO Optimization

Per Phase 19 RESEARCH.md:
- FAQ schema is 3.2x more likely to appear in AI Overviews
- TL;DR question first provides immediate answer for AI citation
- FAQPage JSON-LD recognized by all major AI platforms

### Accessibility

Native details/summary provides:
- Keyboard accessible by default
- Screen reader compatible
- No JavaScript required
- Works with SSR/server components

### Pattern Consistency

BlogFAQ mirrors match-faq.tsx exactly:
- Same section structure (`mt-16 pt-8 border-t`)
- Same accordion styling (border, rounded-lg, hover states)
- Same chevron animation pattern

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4a3483e | feat(19-02): create FAQ extraction utility |
| 2 | 9a9ea97 | feat(19-02): create BlogFAQ component |

## Verification Results

- Build succeeds without TypeScript errors
- extractFAQs correctly extracts question headings
- extractFAQs returns empty array when no questions found
- TL;DR option adds question as first FAQ
- BlogFAQ renders native accordion with schema

## Deviations from Plan

None - plan executed exactly as written.

## Integration Notes

Ready for Plan 05 (Blog Page Integration):
```tsx
import { extractFAQs } from '@/lib/blog/extract-faqs';
import { BlogFAQ } from '@/components/blog/blog-faq';

// In blog page
const faqs = extractFAQs(post.content, {
  maxFaqs: 5,
  includeDefaultTLDR: true,
  excerpt: post.excerpt
});

<BlogFAQ faqs={faqs} />
```

## Next Phase Readiness

Plan 02 artifacts complete:
- `extractFAQs` exported from `src/lib/blog/extract-faqs.ts`
- `BlogFAQ` exported from `src/components/blog/blog-faq.tsx`

Plan 05 can integrate these components into the blog page.
