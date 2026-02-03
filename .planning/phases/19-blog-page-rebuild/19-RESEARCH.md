# Phase 19: Blog Page Rebuild - Research

**Researched:** 2026-02-03
**Domain:** Blog content presentation, typography, navigation, and GEO optimization
**Confidence:** HIGH

## Summary

Research confirms that blog readability follows well-established best practices: 60-75 characters per line (600-700px), consistent with user decisions. Table of contents implementation uses Intersection Observer API with heading extraction from React Markdown. FAQ schema is critical for GEO in 2026, with AI platforms (ChatGPT, Perplexity, Google AI Overviews) preferring FAQPage structured data. Related articles use content-based filtering with TF-IDF or semantic similarity. Native `<details>`/`<summary>` elements provide accessible, zero-JS accordions (already used in match-faq.tsx pattern).

The codebase already has strong foundations: system font stack, 1.2 type scale, FAQ schema components (FaqSchema.tsx, match-faq.tsx), and React Markdown rendering. Phase 19 extends these patterns to blog posts.

**Primary recommendation:** Follow existing match page FAQ pattern (native `<details>` with schema injection), build Intersection Observer TOC with `useRef` for performance, extract headings via React Markdown custom renderers, use TF-IDF or tag-based similarity for related articles.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | 10.1.0 | Markdown rendering | Already in package.json, customizable renderers for heading extraction |
| Intersection Observer API | Native | Scroll spy tracking | Native browser API, no library needed, performant |
| `<details>`/`<summary>` | Native HTML | FAQ accordions | Native accessibility, no JS required, already used in match-faq.tsx |
| schema-dts | 1.1.5 | TypeScript types for schema | Already in package.json for type-safe structured data |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-intersection-observer | 9.x (optional) | Hook wrapper for IO | If custom hook becomes complex, consider this battle-tested wrapper |
| lucide-react | 0.562.0 | Icons (chevron for TOC) | Already in package.json for UI icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Intersection Observer | react-intersection-observer | Library adds 3KB, provides optimization like observer instance reuse. Use if custom hook becomes complex. |
| Native `<details>` | Radix Collapsible | Radix provides animation support but requires JS. User chose native for zero-JS, accessibility. |
| Regex heading extraction | remark-toc plugin | remark-toc generates static TOC in markdown. We need dynamic TOC with scroll spy. |

**Installation:**
```bash
# No new dependencies required - all tools already in package.json
# Optional if custom IO hook becomes complex:
npm install react-intersection-observer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── blog/
│   │   ├── blog-toc.tsx              # Table of contents with scroll spy
│   │   ├── blog-content.tsx          # Markdown renderer with custom heading components
│   │   ├── blog-faq.tsx              # FAQ accordion (adapt match-faq.tsx pattern)
│   │   ├── related-articles.tsx     # Related posts widget
│   │   └── reading-time.tsx          # Reading time estimate (optional)
│   ├── FaqSchema.tsx                 # (exists) Schema injection component
│   └── BreadcrumbSchema.tsx          # (exists) Breadcrumb structured data
├── lib/
│   ├── blog/
│   │   ├── extract-headings.ts       # Parse markdown for TOC
│   │   ├── related-articles.ts       # Content similarity algorithm
│   │   ├── extract-faqs.ts           # Auto-generate FAQs from content
│   │   └── reading-time.ts           # Word count calculation (optional)
│   └── seo/
│       └── schemas.ts                # (exists) generateFAQPageSchema already implemented
└── app/
    └── blog/
        └── [slug]/
            └── page.tsx              # Blog post page (exists, needs enhancement)
```

### Pattern 1: Heading Extraction with Custom Renderers
**What:** Extract headings during React Markdown rendering for TOC generation
**When to use:** Every blog post with 500+ words
**Example:**
```typescript
// lib/blog/extract-headings.ts
export interface Heading {
  id: string;
  text: string;
  level: number; // 2 or 3 (H2, H3)
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split('\n');

  lines.forEach(line => {
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h2Match) {
      const text = h2Match[1];
      headings.push({
        id: text.toLowerCase().replace(/[^\w]+/g, '-'),
        text,
        level: 2
      });
    } else if (h3Match) {
      const text = h3Match[1];
      headings.push({
        id: text.toLowerCase().replace(/[^\w]+/g, '-'),
        text,
        level: 3
      });
    }
  });

  return headings;
}
```

### Pattern 2: Intersection Observer TOC with useRef
**What:** Track visible headings with Intersection Observer, use `useRef` to avoid re-renders
**When to use:** Every TOC component
**Example:**
```typescript
// components/blog/blog-toc.tsx
import { useEffect, useRef, useState } from 'react';

export function BlogTOC({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Performance: Store visibility in Map to avoid state updates
    const visibilityMap = new Map<string, boolean>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          visibilityMap.set(entry.target.id, entry.isIntersecting);
        });

        // Find first visible heading
        const firstVisible = headings.find(h => visibilityMap.get(h.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
        }
      },
      {
        rootMargin: '-80px 0px -80% 0px', // Trigger when heading near top
        threshold: 0.5
      }
    );

    // Observe all heading elements
    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [headings]);

  return (
    <nav className="sticky top-24 hidden lg:block">
      <h2 className="font-semibold mb-2">On this page</h2>
      <ul className="space-y-1">
        {headings.map(h => (
          <li
            key={h.id}
            className={h.level === 3 ? 'ml-4' : ''}
          >
            <a
              href={`#${h.id}`}
              className={activeId === h.id ? 'text-primary' : 'text-muted-foreground'}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

### Pattern 3: Native `<details>` FAQ (Match Existing Pattern)
**What:** Use native HTML accordion with FAQ schema injection
**When to use:** Every blog post with FAQ section
**Example:**
```typescript
// components/blog/blog-faq.tsx (based on match-faq.tsx)
import { FaqSchema } from '@/components/FaqSchema';

export function BlogFAQ({ faqs }: { faqs: FAQItem[] }) {
  return (
    <section className="mt-12 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="group border border-border/50 rounded-lg">
            <summary className="cursor-pointer font-medium py-4 px-4 hover:bg-muted/30 transition-colors list-none flex items-center justify-between">
              <span>{faq.question}</span>
              <svg className="w-5 h-5 transition-transform group-open:rotate-180">
                {/* Chevron icon */}
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 text-muted-foreground leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <FaqSchema faqs={faqs} />
    </section>
  );
}
```

### Pattern 4: Related Articles with Content Similarity
**What:** Find similar blog posts using tag overlap or TF-IDF
**When to use:** Every blog post (show 1-3 related articles)
**Example:**
```typescript
// lib/blog/related-articles.ts
export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  tags?: string[];
  slug: string;
}

export function findRelatedArticles(
  currentPost: BlogPost,
  allPosts: BlogPost[],
  limit = 3
): BlogPost[] {
  // Simple tag-based similarity (sufficient for MVP)
  const currentTags = new Set(currentPost.tags || []);

  const scored = allPosts
    .filter(p => p.id !== currentPost.id)
    .map(post => {
      const postTags = new Set(post.tags || []);
      const overlap = [...currentTags].filter(t => postTags.has(t)).length;
      return { post, score: overlap };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.post);
}
```

### Pattern 5: Reading Time Calculation
**What:** Estimate reading time based on word count
**When to use:** Optional (user decision: "Claude's Discretion")
**Example:**
```typescript
// lib/blog/reading-time.ts
export function calculateReadingTime(markdown: string): number {
  const wordsPerMinute = 265; // Medium's standard
  const words = markdown.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes;
}
```

### Anti-Patterns to Avoid
- **Full-page scroll listeners:** Don't use `onScroll` for TOC tracking. Use Intersection Observer for performance.
- **State updates in IO callback:** Don't store all heading visibility in state. Use `useRef` or Map to track visibility, only update `activeId` state.
- **Custom accordion with ARIA:** Native `<details>` has built-in accessibility. Don't rebuild with divs + ARIA unless animation is required.
- **Markdown parsing with complex regex:** Use React Markdown's custom renderers or AST traversal, not fragile regex.
- **TF-IDF for <50 posts:** Tag-based similarity is sufficient for small content sets. Don't over-engineer.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to HTML | Custom parser | react-markdown (already installed) | Handles edge cases (nested lists, code blocks, tables), extensible with plugins |
| Scroll tracking | `window.onscroll` listener | Intersection Observer API | Native, performant, offloads to browser's compositor thread |
| Accessible accordion | Custom div with ARIA | Native `<details>`/`<summary>` | Built-in keyboard nav, screen reader support, no JS required |
| Heading slugification | Custom regex | Existing utility or markdown-it-anchor pattern | Handles unicode, duplicates, special chars correctly |
| FAQ schema | Manual JSON construction | generateFAQPageSchema (exists in schemas.ts) | Type-safe, follows schema.org spec, already tested |
| Content similarity | Custom NLP | TF-IDF library or simple tag overlap | Tag overlap sufficient for <100 posts, TF-IDF for larger sets |

**Key insight:** Typography and reading experience are solved problems. Research from Baymard Institute and WCAG 2.1 converges on 50-75 characters per line. User's 700px decision aligns perfectly with this research. Native HTML provides accessible accordions. Intersection Observer is the standard for scroll tracking. Don't reinvent these wheels.

## Common Pitfalls

### Pitfall 1: Line Length Measured in Pixels, Not Characters
**What goes wrong:** Setting `max-width: 700px` on blog content works, but doesn't adapt to font size changes.
**Why it happens:** Pixels are absolute, but readability depends on character count, which varies with font size.
**How to avoid:** Use CSS `ch` unit: `max-width: 70ch` (70 characters). This scales with font size automatically.
**Warning signs:** Users complain text is too wide when they increase browser font size.

### Pitfall 2: TOC Observes Too Many Elements
**What goes wrong:** Observing 50+ headings causes performance issues, janky scrolling.
**Why it happens:** Each observed element has memory and computation cost, even with Intersection Observer.
**How to avoid:** Only observe H2 and H3 headings (user decision). Limit TOC to articles with 500+ words (user decision). Disconnect observer on component unmount.
**Warning signs:** Slow scroll performance on long articles, high memory usage.

### Pitfall 3: FAQ Content Doesn't Match Schema
**What goes wrong:** Google penalizes pages where FAQ schema doesn't match visible content.
**Why it happens:** Schema is generated from one source (database), UI from another (markdown), they drift.
**How to avoid:** Generate both UI and schema from single source of truth. Pass same `faqs` array to both BlogFAQ component and FaqSchema component.
**Warning signs:** Search Console warnings about mismatched content, FAQ rich results removed.

### Pitfall 4: Mobile TOC Overlays Content
**What goes wrong:** Fixed sidebar TOC on desktop becomes overlay on mobile, blocks reading.
**Why it happens:** `position: fixed` or `sticky` doesn't adapt to small viewports.
**How to avoid:** Hide TOC on mobile with `hidden lg:block`, or use dropdown/bottom sheet pattern (user decision: "Claude's Discretion").
**Warning signs:** Mobile users can't tap content, TOC blocks first paragraph.

### Pitfall 5: Related Articles Infinite Loop
**What goes wrong:** Article A links to B, B links to A, user bounces between same 2 articles.
**Why it happens:** Simple similarity often produces reciprocal relationships.
**How to avoid:** Show 3 related articles (user decision), include fallback to recent posts, add "More articles" link to full blog index.
**Warning signs:** Users complain about seeing same articles repeatedly.

### Pitfall 6: Heading IDs Collide with Existing IDs
**What goes wrong:** Two headings with same text generate duplicate IDs, TOC links to wrong section.
**Why it happens:** Slugification doesn't check for uniqueness.
**How to avoid:** Track generated IDs, append `-2`, `-3` suffix for duplicates. Or use heading position: `heading-2-1` for first H2.
**Warning signs:** Clicking TOC link jumps to wrong section.

## Code Examples

Verified patterns from official sources:

### Reading Width with CSS `ch` Unit
```css
/* Source: WCAG 2.1, Baymard Institute research */
.blog-content {
  max-width: 70ch; /* ~700px at 16px font, scales with font size */
  margin: 0 auto;
  padding: 0 1rem;
}

.blog-content code {
  max-width: 100%; /* Constrain to content width */
  overflow-x: auto;
}

.blog-content img {
  max-width: 100%; /* Match content width */
  height: auto;
}
```

### Heading Rendering with Auto-ID
```typescript
// Source: React Markdown custom components pattern
import ReactMarkdown from 'react-markdown';

const components = {
  h2: ({ children }) => {
    const text = children?.toString() || '';
    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
    return (
      <h2 id={id} className="text-2xl font-bold mb-3 mt-6 scroll-mt-20">
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const text = children?.toString() || '';
    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
    return (
      <h3 id={id} className="text-xl font-semibold mb-3 mt-4 scroll-mt-20">
        {children}
      </h3>
    );
  },
};

<ReactMarkdown components={components}>{content}</ReactMarkdown>
```

### Intersection Observer Cleanup
```typescript
// Source: MDN Web Docs, react-intersection-observer patterns
useEffect(() => {
  const observer = new IntersectionObserver(callback, options);

  elements.forEach(el => observer.observe(el));

  // CRITICAL: Always disconnect on unmount
  return () => observer.disconnect();
}, [elements]);
```

### Mobile-Responsive TOC
```tsx
// Source: Mobbin UI patterns, NN/G mobile TOC research
<aside className="
  hidden lg:block lg:sticky lg:top-24
  lg:max-h-[calc(100vh-6rem)] lg:overflow-auto
">
  <nav>
    <h2 className="font-semibold mb-2">On this page</h2>
    {/* TOC links */}
  </nav>
</aside>

{/* Mobile: Dropdown or no TOC (user decision: "Claude's Discretion") */}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `scroll` event listener | Intersection Observer API | ~2016 (Chrome 51) | Massive performance improvement, offloads to compositor |
| Custom ARIA accordions | Native `<details>`/`<summary>` | Stable ~2020 | Zero JS, built-in accessibility, mobile support |
| Google FAQ rich snippets | AI platform citation (ChatGPT, Perplexity) | 2023-2026 | FAQ schema now targets AI overviews, not just rich results |
| TF-IDF for all content sizes | Tag-based for <100 posts | Ongoing | Simpler implementation, sufficient accuracy for small sets |
| `max-width` in pixels | `max-width` in `ch` units | Ongoing best practice | Scales with user font size preferences |

**Deprecated/outdated:**
- **Google FAQ rich snippets for all sites:** Google restricted FAQ rich results in August 2023 to government/health sites only. However, FAQ schema is MORE important now for AI platforms (ChatGPT, Perplexity, Google AI Overviews), which consume FAQPage schema extensively. Don't remove schema just because rich results are gone.
- **Complex remark plugins for TOC:** Simple heading extraction with regex or custom renderers is sufficient. Remark plugins add complexity without major benefit for dynamic TOCs.
- **scroll-behavior: smooth for TOC clicks:** Works but causes accessibility issues (motion sickness). Use `prefers-reduced-motion: reduce` to disable, or avoid entirely (user decision: disable all transitions for reduced-motion users).

## Open Questions

Things that couldn't be fully resolved:

1. **FAQ Auto-Generation Strategy**
   - What we know: User wants FAQs auto-generated from content (extract questions from headings/content programmatically)
   - What's unclear: Best extraction heuristic (heading-based vs NLP-based), accuracy threshold
   - Recommendation: Start simple with heading pattern matching (headings ending in "?"), iterate based on quality. Fallback to manual FAQs if extraction fails.

2. **Related Articles Algorithm Preference**
   - What we know: User marked algorithm choice as "Claude's Discretion" (tag-based, recency, hybrid)
   - What's unclear: Content volume, tag density, whether recency should override similarity
   - Recommendation: Tag-based similarity with recency tiebreaker. If <3 results, backfill with recent posts. Monitor click-through to tune.

3. **Mobile TOC Pattern**
   - What we know: User marked mobile collapse pattern as "Claude's Discretion" (dropdown, bottom sheet, etc.)
   - What's unclear: User preference, whether mobile users need TOC at all
   - Recommendation: Hide TOC on mobile initially (`hidden lg:block`). If analytics show mobile users scrolling extensively, add dropdown TOC in header. Simplest approach: no mobile TOC (desktop-only feature).

4. **Reading Time Display**
   - What we know: User marked as "Claude's Discretion" (show or not based on typical patterns)
   - What's unclear: Whether users value this feature, whether it affects engagement
   - Recommendation: Include reading time (1-line implementation, standard pattern). Place near publish date. Easy to remove if not valuable.

## Sources

### Primary (HIGH confidence)
- [Intersection Observer API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Native browser API documentation
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Official React Markdown library
- [Accessible accordions with details/summary - Hassell Inclusion](https://www.hassellinclusion.com/blog/accessible-accordions-part-2-using-details-summary/) - Native HTML accordion accessibility
- [FAQ Schema - Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/faqpage) - Official FAQPage schema documentation
- Existing codebase: FaqSchema.tsx, match-faq.tsx, schemas.ts (verified implementation patterns)

### Secondary (MEDIUM confidence)
- [Optimal Line Length for Readability - UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/) - 50-75 character research
- [Line Length Readability - Baymard Institute](https://baymard.com/blog/line-length-readability) - 66 character sweet spot
- [Scrollspy demystified - Maxime Heckel](https://blog.maximeheckel.com/posts/scrollspy-demystified/) - Intersection Observer TOC implementation
- [React Intersection Observer - Builder.io](https://www.builder.io/blog/react-intersection-observer) - React patterns and performance
- [FAQ Schema for GEO - INSIDEA](https://insidea.com/blog/seo/geo/faq-schema-and-structured-data-for-geo/) - 2026 AI platform targeting
- [Schema Markup in 2026 - ALM Corp](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) - Current structured data practices
- [Content-Based Filtering - Shaped.ai](https://www.shaped.ai/blog/content-based-filtering-explained-recommending-based-on-what-you-like) - Recommendation algorithms
- [Reading Time Calculation - Medium Blog](https://blog.medium.com/read-time-and-you-bc2048ab620c) - 265 WPM standard
- [Mobile Table of Contents - NN/G](https://www.nngroup.com/videos/mobile-table-of-contents/) - Mobile UX patterns

### Tertiary (LOW confidence)
- WebSearch results for "TOC heading depth" and "mobile TOC dropdown" - No definitive source found, marked for validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, native APIs well-documented
- Architecture: HIGH - Patterns match existing codebase (match-faq.tsx), verified with MDN and library docs
- Pitfalls: MEDIUM - Based on common issues from NN/G, MDN, and community patterns, but not all project-specific

**Research date:** 2026-02-03
**Valid until:** ~30 days (stable domain - typography, accessibility, schema practices change slowly)
