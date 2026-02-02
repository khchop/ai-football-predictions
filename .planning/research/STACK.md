# Stack Research: Match Page Refresh

**Project:** Mobile-First Match Page Redesign & AI Search Optimization
**Researched:** 2026-02-02
**Confidence:** HIGH

## Summary

Your existing stack (Next.js 16, React 19, Tailwind CSS v4, shadcn/ui) already provides the foundation for mobile-first redesign and AI search optimization. No major framework changes needed. The focus should be on **configuration additions** (AI crawler access, llms.txt), **CSS patterns** (mobile-first responsive utilities), and **React 19 hooks** (useActionState, useOptimistic for interactive forms). The LLM content rendering issue is likely a hydration or data fetching bug, not a stack deficiency.

## Current Stack Assessment

### Already Validated (No Changes Needed)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 16.1.4 | ✅ Latest with PPR, React Compiler support |
| React | 19.2.3 | ✅ Latest with useActionState, useOptimistic |
| Tailwind CSS | v4 | ✅ Latest with CSS-first breakpoints |
| shadcn/ui | Current | ✅ Mobile-first Radix UI primitives |
| TypeScript | 5.x | ✅ Modern with proper strict mode |

Your stack is already optimized for 2026 mobile-first development. Next.js 16 includes Partial Prerendering (PPR), stable React Compiler support, and Turbopack for 5-10x faster builds.

## Recommended Additions

### Category: AI Search Optimization

#### 1. AI Crawler Configuration Files

**robots.txt** (create in `/public/robots.txt`)
- **Why needed:** Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot) to access your content
- **Current state:** No robots.txt detected in public directory
- **Implementation:** Plain text file with AI bot user-agents
- **Confidence:** HIGH (standard practice as of 2026)

```txt
# AI Search Crawlers (for visibility in ChatGPT, Claude, Perplexity)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

# Block training bots if desired (won't impact search visibility)
User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /
```

**llms.txt** (create in `/public/llms.txt`)
- **Why needed:** Guide AI systems to your most authoritative content for better citation rates
- **Format:** Simple markdown with key URLs
- **Adoption status:** 780+ sites including Cloudflare, Vercel (MEDIUM confidence - emerging standard)
- **Impact:** Potentially higher citation rates in AI search results (Perplexity, ChatGPT, Claude)

```markdown
# kroam.xyz - AI Football Prediction Platform

> Compare 29 open-source AI models predicting football across 17 competitions

## Key Pages

- Homepage: https://kroam.xyz/
- Predictions: https://kroam.xyz/predictions
- Leagues: https://kroam.xyz/leagues
- Models: https://kroam.xyz/models
- Leaderboard: https://kroam.xyz/leaderboard

## League Pages (Top Competitions)

- Champions League: https://kroam.xyz/leagues/ucl
- Premier League: https://kroam.xyz/leagues/epl
- La Liga: https://kroam.xyz/leagues/laliga
- Serie A: https://kroam.xyz/leagues/seriea
- Bundesliga: https://kroam.xyz/leagues/bundesliga

## Documentation

- About: https://kroam.xyz/about
```

#### 2. Metadata Enhancements for AI

**Next.js Metadata API** (update existing in layout.tsx)
- **Why needed:** Your existing metadata is solid but missing AI-specific optimization
- **Current state:** Good foundation with OpenGraph, Twitter cards
- **Add:** Structured data enhancements for SportsEvent schema

**No new libraries needed** - use existing Next.js metadata API and schema-dts (already installed v1.1.5).

### Category: Mobile-First Component Patterns

#### 1. Tailwind CSS v4 Mobile-First Utilities

**Configuration approach:** CSS-first with @theme
- **Why needed:** v4 changed from JavaScript config to CSS-first
- **Current state:** Using Tailwind v4 but may need explicit breakpoint customization
- **Implementation:** Create `src/app/globals.css` theme extensions

```css
@import "tailwindcss";

@theme {
  /* Mobile-first breakpoints (defaults are fine, but document them) */
  /* sm: 40rem (640px) - Large phones, small tablets */
  /* md: 48rem (768px) - Tablets */
  /* lg: 64rem (1024px) - Small laptops */
  /* xl: 80rem (1280px) - Desktops */
  /* 2xl: 96rem (1536px) - Large desktops */

  /* Add touch-friendly spacing if needed */
  --spacing-touch: 44px; /* Minimum touch target size */
  --spacing-thumb: 48px; /* Comfortable thumb reach */
}
```

**Mobile-First Pattern:**
```tsx
// ✅ Correct: mobile-first (unprefixed = mobile)
<div className="text-sm md:text-base lg:text-lg">

// ❌ Wrong: desktop-first
<div className="text-lg md:text-base sm:text-sm">
```

#### 2. React 19 Form Hooks (Already Available)

**useActionState** (React 19.2.3)
- **Why needed:** Simplified form state management with pending/error states
- **Current state:** Already in React 19.2.3, just needs implementation
- **Use case:** Match prediction forms, user interactions
- **No library needed:** Built into React 19

**useOptimistic** (React 19.2.3)
- **Why needed:** Instant UI feedback before server response (critical for mobile UX)
- **Current state:** Already in React 19.2.3, just needs implementation
- **Use case:** Prediction submissions, real-time updates
- **No library needed:** Built into React 19

Example pattern for mobile forms:
```tsx
'use client';
import { useActionState, useOptimistic } from 'react';

// Optimistic updates for better mobile UX
const [optimisticPredictions, addOptimistic] = useOptimistic(
  predictions,
  (state, newPrediction) => [...state, newPrediction]
);

// Form state with pending/error handling
const [state, formAction] = useActionState(submitPrediction, initialState);
```

#### 3. shadcn/ui Mobile Patterns

**Sheet component for navigation** (already available)
- **Why needed:** Mobile-first slide-out menus
- **Current state:** @radix-ui/react-dialog v1.1.15 already installed
- **Pattern:** Use Sheet for hamburger menus, filters on mobile

**Touch-friendly components:**
- Ensure minimum 44px touch targets (iOS guideline)
- Use appropriate spacing for thumb reach zones
- shadcn/ui already handles this with proper padding

### Category: Next.js 16 Performance Features

#### 1. Partial Prerendering (PPR)

**Enable in next.config.ts:**
- **Why needed:** Combine static shell with dynamic content for faster mobile loads
- **Current state:** Available in Next.js 16.1.4 but requires opt-in
- **Implementation:** Add experimental flag

```typescript
const nextConfig: NextConfig = {
  experimental: {
    cacheComponents: true, // Enables PPR + "use cache" directive
  },
  // ... existing config
};
```

**Usage pattern for match pages:**
```tsx
import { Suspense } from 'react';

export default function MatchPage() {
  return (
    <div>
      {/* Static shell - prerendered */}
      <MatchHeader />

      {/* Dynamic content - streamed */}
      <Suspense fallback={<PredictionsSkeleton />}>
        <MatchPredictions />
      </Suspense>

      <Suspense fallback={<ContentSkeleton />}>
        <LLMGeneratedContent />
      </Suspense>
    </div>
  );
}
```

#### 2. React Compiler (Optional)

**Enable in next.config.ts:**
- **Why consider:** Automatic memoization, fewer re-renders (especially on mobile)
- **Current state:** Stable in Next.js 16 but not enabled by default
- **Caution:** Not required for this milestone, test thoroughly before enabling

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true, // Automatic component memoization
};
```

## What NOT to Add

### ❌ Additional UI Libraries

**React Native / Nativecn UI**
- **Why not:** You're building a web app, not a native mobile app
- **Already have:** Tailwind responsive utilities + shadcn/ui for web

### ❌ Separate Mobile Framework

**Next.js with separate mobile build**
- **Why not:** Next.js 16 with responsive Tailwind is sufficient
- **Already have:** Mobile-first CSS framework and SSR

### ❌ External AI Search Monitoring Tools

**Otterly.ai, GEO tracking services**
- **Why not:** Premature optimization; focus on content quality first
- **Later consideration:** After baseline AI crawler access established

### ❌ Complex Animation Libraries

**Framer Motion, React Spring**
- **Why not:** Mobile performance overhead; CSS transitions sufficient
- **Already have:** Tailwind transitions + CSS animations (tw-animate-css v1.4.0)

### ❌ New State Management

**Redux, Zustand, Jotai**
- **Why not:** React 19's useActionState + Server Components handle form state
- **Already have:** Server Components for data fetching, client components for UI state

### ❌ Mobile Detection Library

**react-device-detect, mobile-detect**
- **Why not:** CSS media queries (Tailwind breakpoints) are the modern approach
- **Better pattern:** Responsive CSS, not JavaScript device detection

## Integration Notes

### Integrating AI Crawler Configuration

1. **Create `/public/robots.txt`** with AI bot user-agents
2. **Create `/public/llms.txt`** with key page URLs (markdown format)
3. **Verify access:** Next.js serves `/public/*` files automatically at root
4. **Test:** `curl https://kroam.xyz/robots.txt` and `/llms.txt`

### Integrating Mobile-First Patterns

1. **Audit existing components** for mobile-first Tailwind classes
2. **Use Suspense boundaries** on match pages for streaming dynamic content
3. **Implement useActionState** for prediction forms (if applicable)
4. **Add Sheet components** for mobile navigation/filters

### Debugging LLM Content Rendering

**Likely causes (not stack issues):**
1. **Hydration mismatch:** Server vs client content difference
2. **Missing Suspense boundaries:** Dynamic content blocking render
3. **Empty data fetching:** LLM content not retrieved from DB/API
4. **Conditional rendering bug:** Content hidden by CSS or logic

**Debugging approach:**
```tsx
// Add explicit error boundaries
<ErrorBoundary fallback={<ContentError />}>
  <Suspense fallback={<ContentLoading />}>
    <LLMContent matchId={matchId} />
  </Suspense>
</ErrorBoundary>

// Log data fetching
console.log('LLM content:', { preMatch, prediction, postMatch });
```

### PPR Integration for Match Pages

```tsx
// app/matches/[id]/page.tsx
import { Suspense } from 'react';

export default async function MatchPage({ params }) {
  // Static content (PPR shell)
  const matchMeta = await getMatchMetadata(params.id);

  return (
    <>
      {/* Prerendered static shell */}
      <MatchHeader {...matchMeta} />

      {/* Dynamic content streamed after */}
      <Suspense fallback={<Skeleton />}>
        <DynamicPredictions matchId={params.id} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <DynamicLLMContent matchId={params.id} />
      </Suspense>
    </>
  );
}
```

### Metadata Enhancement for AI Search

```typescript
// app/matches/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const match = await getMatch(params.id);

  return {
    title: `${match.homeTeam} vs ${match.awayTeam} Prediction`,
    description: `AI predictions for ${match.homeTeam} vs ${match.awayTeam}`,
    openGraph: {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description: `29 AI models predict this match`,
      type: 'article', // Better for AI search engines
    },
    // AI search engines value recency
    other: {
      'article:published_time': match.date,
      'article:modified_time': match.lastUpdated,
    },
  };
}
```

## Implementation Priority

### Phase 1: AI Search Foundation (Immediate)
1. ✅ Create `/public/robots.txt` with AI bot configuration
2. ✅ Create `/public/llms.txt` with key URLs
3. ✅ Verify existing Schema.org structured data (already implemented)

### Phase 2: Mobile-First Audit (Current Milestone)
1. ✅ Audit components for mobile-first Tailwind patterns
2. ✅ Fix duplicate content display (score shown 3x, predictions 2x)
3. ✅ Debug LLM content rendering (likely hydration/data issue)
4. ✅ Add Suspense boundaries for dynamic content

### Phase 3: Performance Optimization (Optional)
1. 🔄 Enable PPR with `cacheComponents: true`
2. 🔄 Consider React Compiler (test thoroughly first)
3. 🔄 Optimize mobile images with Next.js Image priority

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| AI Crawler Config | HIGH | robots.txt is standard; llms.txt adopted by 780+ sites |
| Mobile-First CSS | HIGH | Tailwind v4 official docs, Next.js 16 case studies |
| React 19 Hooks | HIGH | Official React docs, production-ready in 19.2.3 |
| PPR Implementation | MEDIUM | Next.js 16 feature but requires testing with your data patterns |
| LLM Content Bug | MEDIUM | Needs codebase investigation, likely not stack issue |

## Sources

### AI Search Optimization
- [Superlines - AI Search Optimization 2026](https://www.superlines.io/articles/ai-search-optimization)
- [GEO Optimization Guide: ChatGPT, Perplexity, Gemini](https://www.getpassionfruit.com/blog/generative-engine-optimization-guide-for-chatgpt-perplexity-gemini-claude-copilot)
- [How to Rank on ChatGPT, Perplexity, and AI Search Engines](https://almcorp.com/blog/how-to-rank-on-chatgpt-perplexity-ai-search-engines-complete-guide-generative-engine-optimization/)
- [ClickRank - AI Bots robots.txt Guide 2026](https://www.clickrank.ai/ai-model-index-checker-guide/)
- [llms.txt Complete Guide 2026](https://www.bigcloudy.com/blog/what-is-llms-txt/)
- [EasyFAQ - LLMs.txt Standard Guide 2026](https://easyfaq.io/academy/llms-txt-standard-guide)

### Next.js 16 & React 19
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Practical Guide to Partial Prerendering in Next.js 16](https://www.ashishgogula.in/blogs/a-practical-guide-to-partial-prerendering-in-next-js-16)
- [React v19 Official Release](https://react.dev/blog/2024/12/05/react-19)
- [React 19 New Hooks: useActionState, useOptimistic](https://www.freecodecamp.org/news/react-19-new-hooks-explained-with-examples/)
- [I Migrated to Next.js 16 and Got 218% Mobile Performance Boost](https://medium.com/@desertwebdesigns/i-migrated-a-react-app-to-next-js-16-and-got-a-218-performance-boost-on-mobile-8ae35ee2a739)
- [Next.js 16: What's New for Frontend Devs](https://blog.logrocket.com/next-js-16-whats-new/)

### Mobile-First Patterns
- [Tailwind CSS v4 Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Tailwind CSS v4 Breakpoint Override](https://bordermedia.org/blog/tailwind-css-4-breakpoint-override)
- [shadcn/ui Mobile Navigation Patterns](https://www.shadcn.io/patterns/sheet-navigation-1)
- [Master Mobile-First Web Design with Next.js](https://prateeksha.com/blog/how-program-geeks-master-mobile-first-web-design-with-next-js)

### React + LLM Integration
- [The React + AI Stack for 2026](https://www.builder.io/blog/react-ai-stack-2026)
- [llm-ui React Library for LLMs](https://llm-ui.com/)
- [Build Interactive React UIs for LLM Outputs](https://blog.logrocket.com/react-llm-ui/)
