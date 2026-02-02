# Phase 18: Match Page Rebuild - Research

**Researched:** 2026-02-02
**Domain:** Next.js 16 PPR, React Suspense, Match Page Architecture, GEO/SEO
**Confidence:** HIGH

## Summary

Researched rebuilding match pages with Next.js 16 Partial Prerendering (PPR), score deduplication, GEO-optimized FAQ structure, and content visibility patterns. The project already uses Next.js 16.1.4, React 19, and has existing match page infrastructure with mobile/desktop patterns, Suspense boundaries, and sticky headers.

The standard approach centers on Next.js 16's Cache Components configuration for PPR, native Intersection Observer API for sticky header triggers, CSS shimmer skeletons for loading states, and FAQ schema (JSON-LD) for GEO optimization. The current codebase already implements many patterns: MatchHeaderSticky component, PredictionsSkeleton, ReadMoreText expansion, and mobile tab architecture.

Key architectural decisions from user context: score appears only in hero + sticky header (aggressive deduplication), content visibility varies by match state (upcoming/live/finished), "Read More" jumps to full section rather than inline expansion, prediction explanations collapsed by default, and FAQ placed at bottom for SEO value.

**Primary recommendation:** Enable Cache Components (cacheComponents: true), wrap dynamic predictions in Suspense with shimmer skeleton, use Intersection Observer to trigger sticky header when hero scrolls out, implement scroll-to-anchor for "Read More" links, and add FAQ schema component at page bottom for GEO without cluttering primary UX.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Cache Components | 16.1+ | PPR infrastructure | Official Next.js 16 rendering strategy, replaces experimental.ppr flag |
| React Suspense | 19.2.3 | Streaming dynamic content | Built into React 19, zero-bundle cost, native server streaming |
| Intersection Observer API | Native | Sticky header scroll detection | Native browser API, async performance, ~96% support |
| CSS line-clamp | Native | Text truncation | Native CSS, no JS needed, works with SSR |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-loading-skeleton | ^3.5.0 | Shimmer skeletons | Already in use, provides shimmer animation pattern |
| schema-dts | ^1.1.5 | Type-safe JSON-LD | Already in use, generates valid FAQ schema |
| Element.scrollIntoView | Native | Smooth scroll to anchor | Native API, behavior: 'smooth' for animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Intersection Observer | Scroll event listeners | Scroll events = main thread blocking, lower performance |
| Native scrollIntoView | react-scroll library | react-scroll adds bundle size, native API sufficient |
| CSS line-clamp | JavaScript truncation | JS = client-side only, layout shift, slower |
| Cache Components | force-dynamic + revalidate | Loses PPR benefits, all-or-nothing rendering |

**Installation:**
```bash
# All dependencies already installed
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── leagues/[slug]/[match]/page.tsx  # Main match page (already exists)
├── components/
│   └── match/
│       ├── match-header.tsx             # Hero with score (exists)
│       ├── match-header-sticky.tsx      # Sticky header (exists)
│       ├── MatchContent.tsx             # Narrative content (exists)
│       ├── predictions-section.tsx      # Suspense boundary (exists)
│       ├── predictions-skeleton.tsx     # Shimmer skeleton (exists)
│       ├── ReadMoreText.tsx             # Inline expansion (exists)
│       ├── match-faq.tsx                # NEW: FAQ component for GEO
│       └── scroll-to-section.tsx        # NEW: Jump-to-section links
└── lib/
    └── seo/
        └── faq-generator.ts             # NEW: Dynamic FAQ generation
```

### Pattern 1: Next.js 16 Cache Components (PPR)

**What:** Enable PPR to stream dynamic content while serving static shell instantly
**When to use:** Match pages with mix of static (hero, teams) and dynamic (predictions, live scores)
**Example:**
```ts
// Source: https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,  // Enable PPR (replaces experimental.ppr in Next.js 16)
  experimental: {
    viewTransition: true,  // Already enabled in project
  },
}

export default nextConfig
```

```tsx
// app/leagues/[slug]/[match]/page.tsx
export default async function MatchPage({ params }) {
  const { match, competition } = await getMatchBySlug(slug, matchSlug);

  return (
    <>
      {/* Static shell: Hero with teams, competition badge */}
      <MatchHeader match={match} competition={competition} />

      {/* Dynamic: Predictions stream in */}
      <Suspense fallback={<PredictionsSkeleton />}>
        <PredictionsSection matchId={match.id} />
      </Suspense>

      {/* Static: FAQ for GEO (generated at build time) */}
      <MatchFAQSection match={match} competition={competition} />
    </>
  )
}
```

### Pattern 2: Intersection Observer for Sticky Header

**What:** Trigger sticky header appearance when hero section scrolls out of viewport
**When to use:** Score deduplication - sticky header only visible when main score not on screen
**Example:**
```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
// components/match/match-header-with-observer.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { MatchHeader } from './match-header'
import { MatchHeaderSticky } from './match-header-sticky'

export function MatchHeaderWithObserver({ match, competition, isLive, isFinished }) {
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return

    // Observer triggers when hero exits viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroVisible(entry.isIntersecting)
      },
      {
        threshold: 0,           // Trigger as soon as any part leaves
        rootMargin: '-1px 0px', // Account for rounding errors
      }
    )

    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* Hero section - observed for visibility */}
      <div ref={heroRef}>
        <MatchHeader
          match={match}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />
      </div>

      {/* Sticky header - only visible when hero not visible */}
      {!isHeroVisible && (
        <MatchHeaderSticky
          match={match}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />
      )}
    </>
  )
}
```

### Pattern 3: Shimmer Loading Skeleton (Performance-First)

**What:** Pure CSS shimmer animation for loading states without JS overhead
**When to use:** Suspense fallback for predictions, stats, dynamic content
**Example:**
```tsx
// Source: https://www.matsimon.dev/blog/simple-skeleton-loaders
// components/match/predictions-skeleton.tsx (already exists, enhance shimmer)
'use client'

export function PredictionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50 overflow-hidden relative"
        >
          {/* Shimmer overlay */}
          <div className="shimmer-overlay" />

          {/* Content placeholders */}
          <div className="w-10 h-10 rounded-lg bg-muted/50" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/50 rounded w-1/3" />
            <div className="h-3 bg-muted/50 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

```css
/* globals.css - Shimmer animation */
/* Source: https://codewithbilal.medium.com/how-to-create-a-skeleton-loading-shimmer-effect-with-pure-css-7f9041ec9134 */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.shimmer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 2s infinite;
}

/* Dark mode variant */
:root.dark .shimmer-overlay {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .shimmer-overlay {
    animation: none;
  }
}
```

### Pattern 4: FAQ Schema for GEO (AI Citation Optimization)

**What:** Auto-generated FAQ section at bottom of page with JSON-LD schema for AI search engines
**When to use:** All match pages - supplementary SEO value without cluttering primary UX
**Example:**
```tsx
// Source: https://developers.google.com/search/docs/appearance/structured-data/faqpage
// components/match/match-faq.tsx
import { FaqSchema } from '@/components/FaqSchema'
import type { Match, Competition } from '@/lib/db/schema'

interface MatchFAQProps {
  match: Match
  competition: Competition
}

export function MatchFAQ({ match, competition }: MatchFAQProps) {
  // Generate dynamic FAQs based on match state
  const faqs = generateMatchFAQs(match, competition)

  return (
    <div className="mt-16 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      {/* Visual FAQ display */}
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="group">
            <summary className="cursor-pointer font-medium text-lg py-2">
              {faq.question}
            </summary>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>

      {/* JSON-LD schema for search engines */}
      <FaqSchema faqs={faqs} />
    </div>
  )
}

function generateMatchFAQs(match: Match, competition: Competition) {
  const isUpcoming = match.status === 'scheduled'
  const isFinished = match.status === 'finished'

  const faqs = []

  // TL;DR question - always first
  if (isFinished) {
    faqs.push({
      question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}. The match was played in the ${competition.name} on ${new Date(match.kickoffTime).toLocaleDateString()}.`,
    })
  } else if (isUpcoming) {
    faqs.push({
      question: `Who is predicted to win ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `AI models predict an average score based on team form, historical matchups, and player performance. View the predictions table above for individual model forecasts and confidence scores.`,
    })
  }

  // Match-specific questions
  faqs.push(
    {
      question: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `The match kicks off on ${new Date(match.kickoffTime).toLocaleString()} at ${match.venue || 'TBD venue'}.`,
    },
    {
      question: `What competition is ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `This match is part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. Follow AI model predictions for this competition on kroam.xyz.`,
    },
    {
      question: 'How accurate are AI predictions for football matches?',
      answer: 'AI models use historical data, team form, and statistical patterns to forecast outcomes. Accuracy varies by model and competition, but predictions should be one information source among many including team news and context.',
    }
  )

  return faqs
}
```

### Pattern 5: Scroll-to-Section for "Read More" Links

**What:** Jump to full narrative section further down page instead of inline expansion
**When to use:** Preview text above the fold with link to full content below predictions
**Example:**
```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
// components/match/narrative-preview.tsx
'use client'

export function NarrativePreview({ previewText, fullSectionId }: {
  previewText: string
  fullSectionId: string
}) {
  const scrollToFull = () => {
    const element = document.getElementById(fullSectionId)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-foreground leading-relaxed">
        {previewText}
      </p>
      <button
        onClick={scrollToFull}
        className="text-primary hover:underline font-medium text-sm min-h-[44px] inline-flex items-center"
        type="button"
      >
        Read Full Analysis →
      </button>
    </div>
  )
}

// Further down the page
export function FullNarrativeSection({ fullText }: { fullText: string }) {
  return (
    <section id="full-narrative" className="scroll-mt-20">
      <h2 className="text-2xl font-bold mb-4">Match Analysis</h2>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        {fullText}
      </div>
    </section>
  )
}
```

```css
/* globals.css - Scroll margin for sticky header offset */
.scroll-mt-20 {
  scroll-margin-top: 5rem; /* Account for sticky header height */
}
```

### Pattern 6: Content Visibility by Match State

**What:** Show different content sections based on match status (upcoming/live/finished)
**When to use:** Match pages where content relevance depends on match state
**Example:**
```tsx
// app/leagues/[slug]/[match]/page.tsx - already partially implemented
export default async function MatchPage({ params }) {
  const { match } = await getMatchBySlug(slug, matchSlug)
  const isUpcoming = match.status === 'scheduled'
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  return (
    <>
      {/* TL;DR - Always visible, content varies by state */}
      <MatchTLDR match={match} isFinished={isFinished} />

      {/* Upcoming: Preview + predictions */}
      {isUpcoming && (
        <>
          <NarrativePreview text={match.preMatchNarrative} />
          <Suspense fallback={<PredictionsSkeleton />}>
            <PredictionsGrid matchId={match.id} />
          </Suspense>
        </>
      )}

      {/* Live: Predictions + live score updates */}
      {isLive && (
        <>
          <LiveScoreWidget matchId={match.id} />
          <Suspense fallback={<PredictionsSkeleton />}>
            <PredictionsGrid matchId={match.id} />
          </Suspense>
        </>
      )}

      {/* Finished: Results + roundup + accuracy */}
      {isFinished && (
        <>
          <MatchRoundupSummary matchId={match.id} />
          <Suspense fallback={<div>Loading accuracy...</div>}>
            <PredictionAccuracy matchId={match.id} />
          </Suspense>
        </>
      )}

      {/* FAQ - Always at bottom for SEO */}
      <MatchFAQ match={match} competition={competition} />
    </>
  )
}
```

### Anti-Patterns to Avoid

- **Score duplication beyond hero + sticky:** Causes user confusion, violates requirement MTCH-01
- **Always-visible sticky header:** Should only appear when hero scrolls out (user specified exact trigger)
- **Inline expansion for narratives:** User specified jump-to-section pattern, not accordion-style
- **FAQ in primary flow:** User marked as "supplementary for SEO", place at bottom only
- **Client-side data fetching in PPR pages:** Use Suspense boundaries with server components instead
- **JavaScript-based scroll listeners:** Use Intersection Observer for performance
- **Loading all content at once:** Defeats PPR benefits, wrap dynamic sections in Suspense
- **Blocking dark mode scripts in streaming:** next-themes handles this, don't customize

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sticky header scroll detection | Custom scroll event handler | Intersection Observer API | Async performance, no main thread blocking, built-in threshold support |
| Smooth scrolling | Custom animation logic | Element.scrollIntoView({behavior: 'smooth'}) | Native API, respects prefers-reduced-motion, zero bundle cost |
| Loading skeletons | React components for each state | CSS shimmer animation | No JavaScript needed, works with SSR, better performance |
| FAQ schema generation | Manual JSON-LD writing | schema-dts library | Type-safe, already in project, prevents schema errors |
| PPR configuration | Manual caching strategies | Next.js Cache Components | Official solution, handles static/dynamic split automatically |
| Text truncation | JavaScript substring + state | CSS line-clamp utility | SSR-compatible, no layout shift, better performance |

**Key insight:** Match page performance is critical for user experience and SEO. Native browser APIs (Intersection Observer, scrollIntoView, CSS line-clamp) provide better performance than JavaScript solutions. PPR requires thinking in "static shell + dynamic islands" rather than all-or-nothing rendering.

## Common Pitfalls

### Pitfall 1: Score Appears More Than Twice
**What goes wrong:** Score shows in hero, sticky header, stats section, events section - user confusion about "which is truth"
**Why it happens:** Multiple components independently display score without coordination
**How to avoid:** Audit all components, enforce "score only in MatchHeader + MatchHeaderSticky" rule in code review
**Warning signs:** User feedback about duplicate information, design feels cluttered
**Verification:**
```bash
# Grep for score rendering in match components
grep -r "homeScore.*awayScore" src/components/match/ --exclude-dir=match-header
# Should only find hero and sticky header components
```

### Pitfall 2: Sticky Header Always Visible
**What goes wrong:** Sticky header appears immediately on page load, not after hero scrolls out
**Why it happens:** position: sticky CSS without Intersection Observer trigger logic
**How to avoid:** Use Intersection Observer to conditionally render sticky header based on hero visibility
**Warning signs:** Sticky header visible when page loads, score duplication above the fold

### Pitfall 3: Suspense Boundary Too Broad
**What goes wrong:** Entire page waits for slowest query (predictions) before rendering anything
**Why it happens:** Single Suspense boundary wrapping all dynamic content
**How to avoid:** Place Suspense boundaries as close to dynamic components as possible
**Warning signs:** Slow Time to First Byte (TTFB), loading spinner for entire page
**Verification:**
```tsx
// Bad: Entire page waits
<Suspense fallback={<PageSkeleton />}>
  <MatchHeader /> {/* Static but blocked */}
  <PredictionsSection /> {/* Dynamic, slow */}
</Suspense>

// Good: Static renders immediately
<MatchHeader /> {/* Static shell */}
<Suspense fallback={<PredictionsSkeleton />}>
  <PredictionsSection /> {/* Dynamic only */}
</Suspense>
```

### Pitfall 4: FAQ Clutters Primary UX
**What goes wrong:** FAQ section placed prominently, takes focus away from predictions and content
**Why it happens:** Misunderstanding GEO value - FAQ is for search engines, not primary navigation
**How to avoid:** Place FAQ at absolute bottom of page, below all primary content and related matches
**Warning signs:** Users scroll past FAQ to find predictions, design feels text-heavy

### Pitfall 5: Scroll Event Performance Issues
**What goes wrong:** Sticky header trigger uses scroll event listener, causes jank on mobile
**Why it happens:** Scroll events fire hundreds of times per scroll, blocking main thread
**How to avoid:** Use Intersection Observer which is async and fires only when threshold crossed
**Warning signs:** Janky scrolling on mobile, performance profiler shows script time spikes during scroll
**Verification:**
```tsx
// Bad: Scroll event listener
window.addEventListener('scroll', () => {
  const heroRect = heroRef.current?.getBoundingClientRect()
  setShowSticky(heroRect.top < 0) // Runs hundreds of times
})

// Good: Intersection Observer
const observer = new IntersectionObserver(([entry]) => {
  setShowSticky(!entry.isIntersecting) // Runs once per threshold
})
```

### Pitfall 6: "Read More" Inline Expansion
**What goes wrong:** "Read More" expands text inline instead of jumping to full section
**Why it happens:** Reusing existing ReadMoreText component pattern without checking user decision
**How to avoid:** User specified "jump to full narrative section further down page", not inline expansion
**Warning signs:** Content expands in preview area, doesn't match user specification

### Pitfall 7: Client-Side FAQ Generation
**What goes wrong:** FAQ content generated in 'use client' component, not available for SSR/PPR
**Why it happens:** Thinking FAQ needs to be dynamic, but it's deterministic from match data
**How to avoid:** Generate FAQ server-side based on match state, include in static shell
**Warning signs:** FAQ appears after page load, not in initial HTML, search engines can't see it

## Code Examples

Verified patterns from official sources:

### Enabling Cache Components in Next.js 16
```ts
// Source: https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,  // Enable PPR (Cache Components)
  experimental: {
    viewTransition: true,  // Already enabled
  },
}

export default nextConfig
```

### Match Page with PPR Boundaries
```tsx
// app/leagues/[slug]/[match]/page.tsx
import { Suspense } from 'react'
import { getMatchBySlug } from '@/lib/db/queries'
import { MatchHeader } from '@/components/match/match-header'
import { PredictionsSection } from '@/components/match/predictions-section'
import { PredictionsSkeleton } from '@/components/match/predictions-skeleton'
import { MatchFAQ } from '@/components/match/match-faq'

export const revalidate = 60 // ISR for live match updates

export default async function MatchPage({ params }) {
  const { slug, match } = await params
  const { match: matchData, competition } = await getMatchBySlug(slug, match)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Static shell - renders immediately */}
      <MatchHeader
        match={matchData}
        competition={competition}
        isLive={matchData.status === 'live'}
        isFinished={matchData.status === 'finished'}
      />

      {/* Dynamic content - streams in */}
      <Suspense fallback={<PredictionsSkeleton />}>
        <PredictionsSection
          matchId={matchData.id}
          match={matchData}
          isFinished={matchData.status === 'finished'}
        />
      </Suspense>

      {/* Static FAQ - in static shell for SEO */}
      <MatchFAQ match={matchData} competition={competition} />
    </div>
  )
}
```

### Intersection Observer Hook for Sticky Header
```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
// hooks/use-intersection-observer.ts
'use client'

import { useEffect, useState, useRef } from 'react'

export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(true)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: '-1px 0px', // Trigger just as element exits
        ...options,
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [options])

  return { ref, isIntersecting }
}

// components/match/match-page-header.tsx
'use client'

import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { MatchHeader } from './match-header'
import { MatchHeaderSticky } from './match-header-sticky'

export function MatchPageHeader({ match, competition, isLive, isFinished }) {
  const { ref, isIntersecting } = useIntersectionObserver()

  return (
    <>
      {/* Hero section - observed */}
      <div ref={ref}>
        <MatchHeader
          match={match}
          competition={competition}
          isLive={isLive}
          isFinished={isFinished}
        />
      </div>

      {/* Sticky header - appears when hero exits */}
      {!isIntersecting && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <MatchHeaderSticky
            match={match}
            competition={competition}
            isLive={isLive}
            isFinished={isFinished}
          />
        </div>
      )}
    </>
  )
}
```

### Shimmer Skeleton with CSS Animation
```tsx
// components/match/content-skeleton.tsx
export function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton-wrapper">
        <div className="h-8 bg-muted/50 rounded w-3/4" />
        <div className="shimmer" />
      </div>
      <div className="skeleton-wrapper">
        <div className="h-4 bg-muted/50 rounded w-full" />
        <div className="shimmer" />
      </div>
      <div className="skeleton-wrapper">
        <div className="h-4 bg-muted/50 rounded w-5/6" />
        <div className="shimmer" />
      </div>
    </div>
  )
}
```

```css
/* globals.css */
/* Source: https://www.matsimon.dev/blog/simple-skeleton-loaders */
.skeleton-wrapper {
  position: relative;
  overflow: hidden;
}

.shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 2s infinite;
}

:root.dark .shimmer {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .shimmer {
    animation: none;
  }
}
```

### FAQ Schema Component
```tsx
// Source: https://developers.google.com/search/docs/appearance/structured-data/faqpage
// components/match/match-faq-schema.tsx
import type { FAQPage } from 'schema-dts'
import type { Match, Competition } from '@/lib/db/schema'

export function MatchFAQSchema({ match, competition }: {
  match: Match
  competition: Competition
}) {
  const isFinished = match.status === 'finished'
  const isUpcoming = match.status === 'scheduled'

  const questions = []

  // TL;DR question
  if (isFinished) {
    questions.push({
      name: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}. The match was played in the ${competition.name}.`,
      },
    })
  } else if (isUpcoming) {
    questions.push({
      name: `Who is predicted to win ${match.homeTeam} vs ${match.awayTeam}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: 'AI models predict the outcome based on team form, historical matchups, and statistical analysis. View the predictions table for detailed forecasts.',
      },
    })
  }

  // Additional questions
  questions.push(
    {
      name: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `The match kicks off on ${new Date(match.kickoffTime).toLocaleString()}.`,
      },
    },
    {
      name: `What competition is this match in?`,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: `This is a ${competition.name} match${match.round ? ` in ${match.round}` : ''}.`,
      },
    }
  )

  const schema: FAQPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.name,
      acceptedAnswer: q.acceptedAnswer,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| experimental.ppr flag | cacheComponents: true | Next.js 16 (2024) | Official API, stable production use |
| Scroll event listeners | Intersection Observer API | ~2023-2024 | Async performance, no main thread blocking |
| react-scroll library | Native scrollIntoView | 2024-2025 | Zero bundle cost, respects prefers-reduced-motion |
| JavaScript text truncation | CSS line-clamp | 2023-2024 | SSR-compatible, no layout shift |
| FAQPage for all sites | Restricted to gov/health | 2025-2026 | Rich results limited, but schema still valuable for GEO |
| force-dynamic for live data | PPR + ISR hybrid | Next.js 16 | Static shell + dynamic updates, best of both |

**Deprecated/outdated:**
- **experimental.ppr in next.config:** Next.js 16 uses cacheComponents flag instead
- **dynamic = 'force-dynamic' for all pages:** PPR allows mixing static and dynamic per-component
- **react-scroll for anchor links:** Native scrollIntoView has better browser support and performance
- **Always-on scroll listeners:** Intersection Observer is standard for scroll-triggered UI changes
- **FAQ rich results for all sites:** Google restricted to authoritative sites in 2025, but schema still valuable for AI search

## Open Questions

Things that couldn't be fully resolved:

1. **TL;DR format (natural vs structured)**
   - What we know: User marked as "Claude's discretion", should be 1-2 sentence summary, vary by match state
   - What's unclear: Specific template for each match state (upcoming/live/finished)
   - Recommendation: Upcoming = "AI models predict [outcome]", Finished = "[Winner] won [score] in [competition]", Live = "[Score] as of [minute]"

2. **Optimal Suspense boundaries for prediction grid**
   - What we know: User marked as "Claude's discretion", need to balance performance with UX
   - What's unclear: Should entire prediction table be one boundary, or split by model provider?
   - Recommendation: Single boundary around entire prediction table - splitting by provider adds complexity without clear benefit

3. **Shimmer skeleton design details**
   - What we know: User marked as "Claude's discretion", current PredictionsSkeleton exists but basic
   - What's unclear: Match visual hierarchy of actual content, number of placeholder rows
   - Recommendation: 8 skeleton rows (matches typical viewport), mimic prediction card structure (icon + name + score boxes)

4. **FAQ question selection and wording**
   - What we know: User marked as "Claude's discretion", questions like "Who is predicted to win?" and "What was the final score?"
   - What's unclear: Optimal number of questions, priority order
   - Recommendation: 4-6 questions, prioritize TL;DR question first, then match-specific (when/where/what competition), then generic (prediction accuracy)

5. **Live match polling frequency**
   - What we know: User specified "ISR for initial load, client polling only when match status is 'Live'"
   - What's unclear: Polling interval (30s? 60s? event-driven?)
   - Recommendation: 60s polling for live matches, matches ISR revalidate setting, prevents excessive API calls

## Sources

### Primary (HIGH confidence)
- [Next.js Partial Prerendering Documentation](https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering) - Official PPR guide
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) - Cache Components announcement
- [React Suspense Documentation](https://react.dev/reference/react/Suspense) - Official Suspense patterns
- [Intersection Observer API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Native scroll detection
- [Element.scrollIntoView (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) - Native smooth scrolling
- [Google FAQ Structured Data](https://developers.google.com/search/search-central/docs/appearance/structured-data/faqpage) - Official FAQ schema guide

### Secondary (MEDIUM confidence)
- [Next.js Streaming Guide](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/) - Suspense best practices (Next.js 15, applies to 16)
- [Skeleton Loading Animation Guide](https://www.matsimon.dev/blog/simple-skeleton-loaders) - CSS shimmer patterns
- [GEO Guide 2026](https://www.dojoai.com/blog/what-is-geo-generative-engine-optimization-a-2026-guide) - Generative Engine Optimization
- [FAQ Schema for SEO](https://studiohawk.com.au/blog/faq-schema/) - Implementation best practices
- [Intersection Observer for Sticky Headers](https://dhanrajsp.me/blog/using-the-intersectionobserver-api) - Sticky trigger patterns

### Tertiary (LOW confidence - ecosystem/community)
- [Next.js Streaming Layouts React Suspense](https://bitskingdom.com/blog/nextjs-streaming-layouts-react-suspense/) - Community patterns
- [React Scroll to Element](https://spacejelly.dev/posts/how-to-scroll-to-an-element-in-react) - Smooth scrolling techniques

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js 16, React 19, native APIs all verified in official docs
- PPR implementation: HIGH - Official Next.js 16 feature, documented configuration
- Intersection Observer: HIGH - Native API, MDN documentation, 96% browser support
- FAQ schema: MEDIUM - Schema valid but rich results restricted to gov/health sites (2026), still valuable for GEO
- Scroll-to-anchor: HIGH - Native API, no library needed
- Shimmer skeletons: MEDIUM - Pattern well-established, CSS implementation varies

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - rendering patterns evolve with framework updates)

**Stack versions verified:**
- Next.js: 16.1.4 (current project version)
- React: 19.2.3 (current project version)
- react-loading-skeleton: 3.5.0 (current project version)
- schema-dts: 1.1.5 (current project version)

**Browser support targets:**
- Intersection Observer API: ~96% (Chrome 51+, Safari 12.1+, Firefox 55+, Edge 15+)
- Element.scrollIntoView({behavior: 'smooth'}): ~96% (Chrome 61+, Safari 14+, Firefox 36+)
- CSS line-clamp: ~95% (Chrome 88+, Safari 14.1+, Firefox 68+)
- View Transitions API: ~93% (already enabled in project)
