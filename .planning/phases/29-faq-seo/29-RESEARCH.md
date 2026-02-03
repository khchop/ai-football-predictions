# Phase 29: FAQ & SEO - Research

**Researched:** 2026-02-03
**Domain:** FAQ generation, Schema.org FAQPage, JSON-LD structured data, Radix Accordion
**Confidence:** HIGH

## Summary

Researched implementing auto-generated FAQ section with Schema.org FAQPage integration for match pages. The codebase already has a functional FAQ implementation in `src/components/match/match-faq.tsx` and `src/components/match/MatchFAQSchema.tsx` with 4 questions, a separate `MatchPageSchema.tsx` generating the main @graph, and native `<details>` HTML elements for the accordion UI.

The phase requires upgrading to 5 state-specific questions (per CONTEXT.md), consolidating FAQPage into the existing @graph (not separate script tag), fixing eventStatus mapping (currently only EventScheduled), replacing native details with accessible accordion, and ensuring schema-visual parity per Google guidelines.

Key findings from codebase analysis:
- Existing MatchFAQSchema outputs a separate script tag (not in @graph) - violates SGEO-01
- eventStatus mapping currently returns EventScheduled for all states - needs fix for SGEO-03
- Current FAQ uses native `<details>` element - works but lacks animation and multi-open control
- Radix Accordion (@radix-ui/react-accordion) is the standard choice and NOT currently installed
- Existing Collapsible component in `src/components/ui/collapsible.tsx` could be extended but Radix Accordion provides better primitives

**Primary recommendation:** Install @radix-ui/react-accordion, extend MatchFAQSchema to generate 5 state-aware questions, merge FAQPage into MatchPageSchema's @graph, fix eventStatus to use EventScheduled/EventCompleted, and replace details element with Radix Accordion component with first-item-open default.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-accordion | 1.2.12 | Accessible accordion component | Headless, WAI-ARIA compliant, supports multi-open, first-class React support |
| schema-dts | 1.1.5 | TypeScript types for Schema.org | Already installed, compile-time validation, zero runtime |
| date-fns | 4.1.0 | Date formatting in answers | Already installed, used for kickoff date formatting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562.0 | Icons (ChevronDown) | Already installed, accordion trigger icons |
| tailwind-merge | 3.4.0 | Class merging | Already installed, accordion styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Accordion | Native `<details>` | Native works (current impl) but lacks multi-open control, animations, keyboard nav consistency |
| Radix Accordion | Custom collapsible | More code, reinvents wheel, accessibility gaps |
| Radix Accordion | Headless UI Disclosure | Radix already in codebase (Dialog, Dropdown, etc.), consistency |

**Installation:**
```bash
npm install @radix-ui/react-accordion
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/
│   │   └── accordion.tsx           # NEW: Radix-based accordion primitives
│   └── match/
│       ├── match-faq.tsx           # EXTEND: Use new accordion, add state-awareness
│       └── MatchFAQSchema.tsx      # EXTEND: 5 questions, merge into @graph
├── components/
│   └── MatchPageSchema.tsx         # MODIFY: Accept FAQ data, include in @graph
└── lib/
    └── seo/
        └── schemas.ts              # EXISTING: FAQItem type already defined
```

### Pattern 1: Consolidating Multiple Schemas into @graph
**What:** Single JSON-LD script with @graph array containing all related entities
**When to use:** Page has multiple schema types (SportsEvent + FAQPage + WebPage + BreadcrumbList)
**Example:**
```typescript
// Source: https://www.denniscamilo.com/how-to-combine-nest-multiple-json-ld-schema/
// Source: https://medium.com/@joemanfong/how-to-combine-multiple-structured-data-markup-schemas-on-one-page-react-next-js-1ea6faf78111

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://kroam.xyz#organization',
      // ... organization properties
    },
    {
      '@type': 'SportsEvent',
      '@id': url,
      // ... event properties
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
    // ... other entities
  ],
};
```

**Key insight:** Remove @context from individual entities - only the root object has @context. Each entity can have @id for cross-referencing.

### Pattern 2: State-Aware FAQ Generation
**What:** Generate different question sets based on match state (upcoming/live/finished)
**When to use:** FAQ content varies by page context
**Example:**
```typescript
// Source: Existing pattern in MatchFAQSchema.tsx, extended per CONTEXT.md

function generateMatchFAQs(match: Match, competition: Competition): FAQItem[] {
  const isUpcoming = match.status === 'scheduled';
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const kickoffDate = new Date(match.kickoffTime);

  // Always return 5 questions
  if (isFinished) {
    return [
      // 1. Final score (finished topic)
      { question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`, ... },
      // 2. Prediction accuracy (finished topic)
      { question: `Which AI models correctly predicted the result?`, ... },
      // 3. Goalscorers (finished topic - if available)
      { question: `Who scored in ${match.homeTeam} vs ${match.awayTeam}?`, ... },
      // 4. Competition context
      { question: `What competition was this match in?`, ... },
      // 5. AI methodology
      { question: `How accurate are AI predictions for football matches?`, ... },
    ];
  }

  // Upcoming/Live questions
  return [
    // 1. Kickoff time (upcoming topic)
    { question: `When is ${match.homeTeam} vs ${match.awayTeam}?`, ... },
    // 2. Predictions summary (upcoming topic)
    { question: `What do AI models predict for ${match.homeTeam} vs ${match.awayTeam}?`, ... },
    // 3. How to watch (upcoming topic)
    { question: `How can I watch ${match.homeTeam} vs ${match.awayTeam}?`, ... },
    // 4. Venue (upcoming topic)
    { question: `Where is ${match.homeTeam} vs ${match.awayTeam} being played?`, ... },
    // 5. AI methodology
    { question: `How accurate are AI predictions for football matches?`, ... },
  ];
}
```

### Pattern 3: Radix Accordion with Multi-Open and First-Open Default
**What:** Accessible accordion supporting multiple open items with first item expanded by default
**When to use:** FAQ sections where users may want to view multiple answers
**Example:**
```tsx
// Source: https://www.radix-ui.com/primitives/docs/components/accordion

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQAccordionProps {
  faqs: FAQItem[];
}

export function FAQAccordion({ faqs }: FAQAccordionProps) {
  // type="multiple" allows multiple items open
  // defaultValue opens first item by default
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={['item-0']} // First item open
      className="space-y-4"
    >
      {faqs.map((faq, i) => (
        <Accordion.Item
          key={i}
          value={`item-${i}`}
          className="border border-border/50 rounded-lg overflow-hidden"
        >
          <Accordion.Header>
            <Accordion.Trigger className="w-full flex items-center justify-between py-4 px-4 text-left font-medium hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group">
              <span>{faq.question}</span>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
            <div className="px-4 pb-4 pt-2 text-muted-foreground leading-relaxed border-t border-border/30">
              {faq.answer}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

### Pattern 4: eventStatus Mapping
**What:** Map match status to correct Schema.org EventStatusType
**When to use:** SportsEvent schema generation
**Example:**
```typescript
// Source: https://schema.org/EventStatusType (verified - 5 valid values)
// Source: Current MatchPageSchema.tsx (lines 28-37)

// Schema.org EventStatusType has 5 values:
// - EventScheduled
// - EventCancelled
// - EventPostponed
// - EventRescheduled
// - EventMovedOnline
//
// NOTE: There is NO "EventInProgress" or "EventCompleted" in Schema.org spec!
// However, Google uses custom extensions for rich results.

function getEventStatus(status: string | null): string {
  switch (status) {
    case 'finished':
      // Google's Event structured data supports EventCompleted
      // https://developers.google.com/search/docs/appearance/structured-data/event
      return 'https://schema.org/EventScheduled'; // Or leave as-is, add scores
    case 'live':
      // No standard "in progress" - keep EventScheduled, or use custom
      // Existing MatchPageSchema uses EventInProgress (non-standard but Google accepts)
      return 'https://schema.org/EventScheduled';
    case 'postponed':
      return 'https://schema.org/EventPostponed';
    case 'cancelled':
      return 'https://schema.org/EventCancelled';
    default:
      return 'https://schema.org/EventScheduled';
  }
}
```

**Important note:** The existing MatchPageSchema.tsx already uses `EventCompleted` and `EventInProgress` which are Google extensions, not standard Schema.org. This is actually correct for Google Rich Results despite not being in the Schema.org spec.

### Anti-Patterns to Avoid
- **Multiple JSON-LD script tags:** Consolidate into single @graph (current MatchFAQSchema.tsx outputs separate script)
- **FAQ schema mismatch:** Schema questions must exactly match visible FAQ text (Google penalizes)
- **Missing @type on nested objects:** Question and Answer both need explicit @type
- **Hardcoded question counts:** Always generate exactly 5 questions per CONTEXT.md decision

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion component | Custom collapsible state | @radix-ui/react-accordion | ARIA compliance, keyboard nav, animation states, multi-open |
| FAQ schema generation | Manual JSON construction | schema-dts types + builder function | Type safety, prevents typos, IDE autocomplete |
| Date formatting in answers | Template literals with toLocaleString | date-fns format() | Consistent formatting, timezone handling |
| Schema validation | Manual Rich Results Test | Automated pattern matching | Ensure schema-visual parity automatically |

**Key insight:** The existing Collapsible component works for single-item collapse but Radix Accordion provides the multi-open functionality required by CONTEXT.md ("allow multiple accordion items open simultaneously").

## Common Pitfalls

### Pitfall 1: Schema-Visual Mismatch
**What goes wrong:** FAQ schema contains different questions/answers than visible on page
**Why it happens:** Schema generated separately from visual component, text diverges over time
**How to avoid:** Single source of truth - generate FAQs once, pass to both schema and visual components
**Warning signs:** Google Search Console warnings about FAQPage, Rich Results Test mismatches

**Implementation pattern:**
```tsx
// CORRECT: Same data source for both
const faqs = generateMatchFAQs(match, competition);
return (
  <>
    <FAQAccordion faqs={faqs} />
    <FAQSchema faqs={faqs} />
  </>
);
```

### Pitfall 2: Multiple JSON-LD Scripts
**What goes wrong:** Page has separate script tags for SportsEvent, FAQPage, BreadcrumbList
**Why it happens:** Each component renders its own schema independently
**How to avoid:** Consolidate all schemas into single @graph at page level
**Warning signs:** Google Search Console shows multiple schema entities, validation warnings

**Current state:** MatchPageSchema.tsx renders @graph, but MatchFAQSchema.tsx renders separate script. Must merge.

### Pitfall 3: Missing FAQ for Edge Cases
**What goes wrong:** FAQ section crashes or shows empty when match data incomplete
**Why it happens:** Not handling null venue, missing scores, no predictions
**How to avoid:** Null-safe question generation with fallbacks
**Warning signs:** Runtime errors on certain match pages, empty FAQ sections

```typescript
// Venue question - handle null
question: `Where is ${match.homeTeam} vs ${match.awayTeam} being played?`,
answer: match.venue
  ? `The match takes place at ${match.venue}.`
  : `The venue for this match has not been confirmed yet.`
```

### Pitfall 4: Incorrect eventStatus for Live Matches
**What goes wrong:** Live matches show as EventScheduled or use non-existent EventInProgress
**Why it happens:** Schema.org spec doesn't have "EventInProgress" but Google may accept it
**How to avoid:** Use Google's documented extensions, not Schema.org spec alone
**Warning signs:** Rich Results Test validation errors

**Current state:** MatchPageSchema.tsx already uses `EventInProgress` for live matches - this is Google's extension and works. Keep it.

### Pitfall 5: Accordion Animation Without CSS
**What goes wrong:** Radix accordion opens/closes instantly without smooth transition
**Why it happens:** data-[state=open/closed] attributes set but no CSS animation defined
**How to avoid:** Add keyframe animations for slideDown/slideUp in Tailwind config
**Warning signs:** Jarring open/close behavior, no visual feedback

```css
/* Add to tailwind config or global CSS */
@keyframes slideDown {
  from { height: 0; opacity: 0; }
  to { height: var(--radix-accordion-content-height); opacity: 1; }
}
@keyframes slideUp {
  from { height: var(--radix-accordion-content-height); opacity: 1; }
  to { height: 0; opacity: 0; }
}
```

## Code Examples

Verified patterns from codebase and official sources:

### Extended MatchFAQSchema with 5 State-Aware Questions
```typescript
// Source: Existing MatchFAQSchema.tsx extended per CONTEXT.md decisions
// File: src/components/match/MatchFAQSchema.tsx

import type { Match, Competition } from '@/lib/db/schema';
import { format } from 'date-fns';

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateMatchFAQs(match: Match, competition: Competition): FAQItem[] {
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const kickoffDate = new Date(match.kickoffTime);
  const formattedDate = format(kickoffDate, 'MMMM d, yyyy');
  const formattedTime = format(kickoffDate, 'h:mm a');

  const faqs: FAQItem[] = [];

  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    // Finished match questions (5 total)

    // 1. Final score
    faqs.push({
      question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}. The match was played in the ${competition.name} on ${formattedDate}.`,
    });

    // 2. Prediction accuracy (which models got it right)
    // Note: Specific model names from top performers would need to be passed in
    faqs.push({
      question: `Which AI models correctly predicted ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `Multiple AI models predicted this match. Check the predictions table above to see which models like GPT-4, Claude, and Gemini got the correct result or exact score.`,
    });

    // 3. Goalscorers (placeholder - actual data from matchEvents if available)
    faqs.push({
      question: `Who scored in ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `The match ended ${match.homeScore}-${match.awayScore}. View the match events section above for the full breakdown of goalscorers and key moments.`,
    });

    // 4. Competition context
    faqs.push({
      question: `What competition was ${match.homeTeam} vs ${match.awayTeam} in?`,
      answer: `This match was part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. View more ${competition.name} matches and predictions on kroam.xyz.`,
    });

    // 5. AI methodology
    faqs.push({
      question: 'How accurate are AI predictions for football matches?',
      answer: 'AI models analyze historical data, team form, head-to-head records, and statistical patterns. Accuracy varies by model and competition. View the leaderboard to see which models perform best.',
    });

  } else {
    // Upcoming or Live match questions (5 total)

    // 1. Kickoff time
    faqs.push({
      question: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `The match ${isLive ? 'is currently in progress' : `kicks off on ${formattedDate} at ${formattedTime}`}${match.venue ? ` at ${match.venue}` : ''}.`,
    });

    // 2. Predictions summary
    faqs.push({
      question: `What do AI models predict for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `AI models including GPT-4, Claude, and Gemini have analyzed this match. View the predictions table above for individual model forecasts and the consensus prediction.`,
    });

    // 3. How to watch
    faqs.push({
      question: `How can I watch ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `Check your local ${competition.name} broadcaster for live coverage. Popular options include streaming services and sports channels that carry ${competition.name} matches.`,
    });

    // 4. Venue
    faqs.push({
      question: `Where is ${match.homeTeam} vs ${match.awayTeam} being played?`,
      answer: match.venue
        ? `The match takes place at ${match.venue}.`
        : `The venue for this ${competition.name} match has not been confirmed. Check back closer to kickoff for venue details.`,
    });

    // 5. AI methodology
    faqs.push({
      question: 'How accurate are AI predictions for football matches?',
      answer: 'AI models analyze historical data, team form, head-to-head records, and statistical patterns. Accuracy varies by model and competition. View the leaderboard to see which models perform best.',
    });
  }

  return faqs;
}
```

### Radix Accordion Component
```tsx
// Source: https://www.radix-ui.com/primitives/docs/components/accordion
// File: src/components/ui/accordion.tsx

'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border border-border/50 rounded-lg', className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 px-4 font-medium transition-colors',
        'hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        '[&[data-state=open]>svg]:rotate-180',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('px-4 pb-4 pt-2 border-t border-border/30', className)}>
      {children}
    </div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
```

### Consolidated MatchPageSchema with FAQPage
```typescript
// Source: Existing MatchPageSchema.tsx, extended to include FAQPage
// File: src/components/MatchPageSchema.tsx

import type { Match } from '@/lib/db/schema';
import type { FAQItem } from './match/MatchFAQSchema';

interface MatchPageSchemaProps {
  match: Match;
  competition: {
    name: string;
    slug: string;
  };
  url: string;
  faqs: FAQItem[]; // NEW: Pass FAQ data in
}

function getEventStatus(status: string | null): string {
  switch (status) {
    case 'finished':
      return 'https://schema.org/EventCompleted'; // Google extension
    case 'live':
      return 'https://schema.org/EventInProgress'; // Google extension (non-standard but accepted)
    case 'postponed':
      return 'https://schema.org/EventPostponed';
    case 'cancelled':
      return 'https://schema.org/EventCancelled';
    default:
      return 'https://schema.org/EventScheduled';
  }
}

export function MatchPageSchema({ match, competition, url, faqs }: MatchPageSchemaProps) {
  const eventStatus = getEventStatus(match.status);
  const matchName = `${match.homeTeam} vs ${match.awayTeam}`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      // Organization
      {
        '@type': 'Organization',
        '@id': 'https://kroam.xyz#organization',
        name: 'kroam.xyz',
        url: 'https://kroam.xyz',
        logo: 'https://kroam.xyz/logo.png',
      },
      // WebSite
      {
        '@type': 'WebSite',
        '@id': 'https://kroam.xyz#website',
        name: 'kroam.xyz',
        url: 'https://kroam.xyz',
        publisher: { '@id': 'https://kroam.xyz#organization' },
      },
      // SportsEvent
      {
        '@type': 'SportsEvent',
        '@id': url,
        name: matchName,
        startDate: match.kickoffTime,
        eventStatus,
        location: {
          '@type': 'Place',
          name: match.venue || 'Stadium',
        },
        homeTeam: {
          '@type': 'SportsTeam',
          name: match.homeTeam,
          ...(match.homeTeamLogo && { logo: match.homeTeamLogo }),
        },
        awayTeam: {
          '@type': 'SportsTeam',
          name: match.awayTeam,
          ...(match.awayTeamLogo && { logo: match.awayTeamLogo }),
        },
        sport: 'Football',
        ...(match.status === 'finished' &&
          match.homeScore !== null &&
          match.awayScore !== null && {
            homeTeamScore: match.homeScore,
            awayTeamScore: match.awayScore,
          }),
      },
      // FAQPage - NOW PART OF @GRAPH (SGEO-01)
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      // BreadcrumbList
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://kroam.xyz' },
          { '@type': 'ListItem', position: 2, name: 'Leagues', item: 'https://kroam.xyz/leagues' },
          { '@type': 'ListItem', position: 3, name: competition.name, item: `https://kroam.xyz/leagues/${competition.slug}` },
          { '@type': 'ListItem', position: 4, name: matchName, item: url },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
```

### Tailwind Animation Config for Accordion
```javascript
// Source: Radix Accordion animation patterns
// Add to tailwind.config.js keyframes and animation

module.exports = {
  theme: {
    extend: {
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Native `<details>` element | Radix Accordion primitives | 2023+ | Better accessibility, animation support, multi-open control |
| Separate schema script tags | Single @graph consolidation | Ongoing best practice | Cleaner markup, entity relationships via @id |
| Manual FAQ generation | State-aware FAQ generators | Application-specific | Consistent 5-question sets per match state |
| EventScheduled for all | EventCompleted/EventInProgress | Google extension | Better rich result eligibility |

**Deprecated/outdated:**
- **`<details>` for complex accordions**: Native element lacks animation, multi-open, and keyboard consistency across browsers
- **Separate schema script tags**: Google prefers single @graph for related entities
- **EventInProgress as Schema.org standard**: It's a Google extension, not in Schema.org spec - but works

## Open Questions

Things that couldn't be fully resolved:

1. **Goalscorer Data for Finished Match FAQs**
   - What we know: CONTEXT.md wants "goalscorers" question for finished matches
   - What's unclear: matchEvents data is fetched but not passed to FAQ component currently
   - Recommendation: Either pass goalscorer names to FAQ generator or use generic "view match events" answer

2. **Top Model Names for Prediction Accuracy Question**
   - What we know: CONTEXT.md wants specific model names like "GPT-4, Claude, and Gemini"
   - What's unclear: Whether to use hardcoded top model names or dynamic from roundup.topPerformers
   - Recommendation: Use dynamic names if available (from roundup), fall back to hardcoded list

3. **Internal Link Targets in FAQ Answers**
   - What we know: CONTEXT.md says "Include where relevant (link to league page, related matches)"
   - What's unclear: How to include links in FAQ answers (HTML in schema text vs plain text)
   - Recommendation: Keep schema text plain, add links only in visual component

4. **Google FAQPage Rich Results Eligibility**
   - What we know: Google restricts FAQ rich results to "authoritative government/health sites" since Aug 2023
   - What's unclear: Whether sports prediction sites can still get FAQ rich results
   - Recommendation: Implement FAQ schema anyway - helps AI crawlers (GEO) even if not Google rich results

## Sources

### Primary (HIGH confidence)
- [Google FAQPage Structured Data Documentation](https://developers.google.com/search/docs/appearance/structured-data/faqpage) - Official requirements, updated December 2025
- [Radix UI Accordion Documentation](https://www.radix-ui.com/primitives/docs/components/accordion) - Component API, accessibility patterns
- [@radix-ui/react-accordion NPM](https://www.npmjs.com/package/@radix-ui/react-accordion) - Version 1.2.12
- [Schema.org EventStatusType](https://schema.org/EventStatusType) - 5 valid enumeration values
- Existing codebase:
  - `src/components/match/match-faq.tsx` - Current FAQ visual component
  - `src/components/match/MatchFAQSchema.tsx` - Current FAQ schema generation
  - `src/components/MatchPageSchema.tsx` - Main @graph schema component
  - `src/lib/seo/schemas.ts` - FAQItem type definition

### Secondary (MEDIUM confidence)
- [How to Combine Multiple JSON-LD Schemas with @Graph](https://www.denniscamilo.com/how-to-combine-nest-multiple-json-ld-schema/) - @graph consolidation patterns
- [Combining Structured Data in React/Next.js](https://medium.com/@joemanfong/how-to-combine-multiple-structured-data-markup-schemas-on-one-page-react-next-js-1ea6faf78111) - Implementation examples
- [Google FAQ Rich Results Changes (Aug 2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes) - Eligibility restrictions

### Tertiary (LOW confidence)
- [FAQ Schema for AI Answers](https://www.getpassionfruit.com/blog/faq-schema-for-ai-answers) - GEO optimization (2026 context)
- [FAQs in SEO 2026](https://seizemarketingagency.com/faqs-in-seo/) - Ongoing SEO value despite rich result restrictions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Radix Accordion well-documented, schema-dts already in use
- Architecture: HIGH - @graph consolidation verified in multiple sources, existing codebase patterns clear
- Pitfalls: HIGH - Schema-visual mismatch well-documented by Google, multiple JSON-LD issue known
- eventStatus: MEDIUM - Google accepts EventCompleted/EventInProgress but not in Schema.org spec

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Schema.org stable, Radix stable, Google FAQ policy may evolve)

**Key constraints from CONTEXT.md:**
- Exactly 5 questions per match (locked decision)
- State-specific question sets (upcoming vs finished)
- Accordion with multi-open and first-item-open
- Single @graph with SportsEvent + FAQPage
- Schema must exactly match visible FAQ text
- eventStatus mapping: upcoming->EventScheduled, finished->EventCompleted
