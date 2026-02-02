# Phase 17: Design System Foundation - Research

**Researched:** 2026-02-02
**Domain:** Design Systems, CSS Design Tokens, UI Component Architecture
**Confidence:** HIGH

## Summary

Researched establishing a modern design system foundation using Tailwind CSS 4, Next.js 16, and React 19. The project already uses industry-standard tooling (CVA, Radix UI, Tailwind CSS 4) and follows modern component patterns. The primary work will be refactoring existing tokens to match user decisions (neutral grays, traditional match state colors, system fonts) and implementing new infrastructure (dark mode toggle, View Transitions API, PPR support).

The standard approach centers on Tailwind CSS 4's `@theme` directive for design tokens, CSS custom properties for runtime theming, CVA for type-safe component variants, and inline blocking scripts to prevent dark mode flash. View Transitions API has ~93% browser support and requires accessibility handling for prefers-reduced-motion users.

**Primary recommendation:** Use Tailwind CSS 4's @theme directive with semantic color tokens, implement dark mode with blocking script to prevent FOUC, enable View Transitions API with prefers-reduced-motion detection, and leverage existing CVA pattern for component variants.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x | Design tokens & utility classes | Industry standard for design systems, CSS-first configuration with @theme directive |
| class-variance-authority | ^0.7.1 | Type-safe component variants | De facto standard for variant management in React, used by shadcn/ui |
| next-themes | Latest | Dark mode management | Most popular Next.js dark mode solution, prevents FOUC out-of-box |
| CSS Custom Properties | Native | Runtime theme values | Browser-native, no build step, works with SSR/PPR |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-* | ^1.x | Unstyled accessible primitives | Already in use, provides accessibility foundation |
| tailwind-merge | ^3.4.0 | Merge Tailwind classes safely | Already in use, prevents class conflicts |
| clsx | ^2.1.1 | Conditional class names | Already in use, pairs with CVA |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-themes | Custom localStorage hook | Custom = more control but must handle FOUC, SSR, system preference detection manually |
| CVA | tailwind-variants | Similar API, tailwind-variants has tighter Tailwind integration but CVA is more widely adopted |
| CSS Custom Properties | Sass variables | Sass = build-time only, can't change at runtime (needed for dark mode) |

**Installation:**
```bash
npm install next-themes
# All other dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── styles/
│   ├── globals.css          # @theme tokens, base styles
│   └── tokens/
│       ├── colors.css       # Semantic color tokens
│       ├── typography.css   # Type scale, font stacks
│       └── spacing.css      # 4px/8px rhythm system
├── components/
│   └── ui/                  # Component primitives (already exists)
│       ├── button.tsx       # CVA variants pattern
│       └── badge.tsx        # Match state variants
├── lib/
│   ├── utils.ts            # cn() helper (already exists)
│   └── design-tokens.ts    # TypeScript token exports
└── app/
    ├── layout.tsx          # Theme provider wrapper
    └── theme-script.tsx    # Blocking dark mode script
```

### Pattern 1: Semantic Color Tokens with @theme

**What:** Define semantic tokens using Tailwind CSS 4's @theme directive in globals.css
**When to use:** All color definitions - replaces current purple gradient theme with neutral grays + semantic colors
**Example:**
```css
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* Neutral gray palette - base theme */
  --color-gray-50: oklch(0.98 0.002 264);
  --color-gray-100: oklch(0.95 0.004 264);
  --color-gray-200: oklch(0.90 0.006 264);
  --color-gray-500: oklch(0.55 0.012 264);
  --color-gray-900: oklch(0.20 0.015 264);
  --color-gray-950: oklch(0.14 0.012 264);

  /* Semantic match state colors */
  --color-win: oklch(0.69 0.17 162.5);      /* Green - traditional */
  --color-draw: oklch(0.77 0.19 70.1);      /* Amber - traditional */
  --color-loss: oklch(0.64 0.24 25.3);      /* Red - traditional */

  /* Accuracy gradient scale */
  --color-accuracy-low: oklch(0.64 0.24 25.3);     /* Red */
  --color-accuracy-mid: oklch(0.77 0.19 70.1);     /* Amber */
  --color-accuracy-high: oklch(0.69 0.17 162.5);   /* Green */
}

/* Dark mode overrides - WCAG compliant */
:root.dark {
  --color-gray-50: oklch(0.14 0.012 264);
  --color-gray-900: oklch(0.95 0.004 264);
  /* Adjust semantic colors for dark mode contrast */
  --color-win: oklch(0.72 0.17 162.5);    /* Lighter for dark bg */
  --color-loss: oklch(0.67 0.24 25.3);    /* Lighter for dark bg */
}
```

### Pattern 2: Typography Scale with System Fonts

**What:** 1.2 ratio (Minor Third) scale with system font stack, responsive sizing
**When to use:** All text elements - provides subtle hierarchy good for data + content mix
**Example:**
```css
/* Source: https://systemfontstack.com/ */
@theme {
  /* System font stack - no web fonts needed */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif,
               "Apple Color Emoji", "Segoe UI Emoji";

  /* Type scale: 1.2 ratio, 16px base on mobile */
  --text-xs: 0.694rem;    /* 11.11px - 16 ÷ 1.2^2 */
  --text-sm: 0.833rem;    /* 13.33px - 16 ÷ 1.2 */
  --text-base: 1rem;      /* 16px - base */
  --text-lg: 1.2rem;      /* 19.2px - 16 × 1.2 */
  --text-xl: 1.44rem;     /* 23.04px - 16 × 1.2^2 */
  --text-2xl: 1.728rem;   /* 27.65px - 16 × 1.2^3 */
  --text-3xl: 2.074rem;   /* 33.18px - 16 × 1.2^4 */
  --text-4xl: 2.488rem;   /* 39.81px - 16 × 1.2^5 */
}

@layer base {
  body {
    font-family: var(--font-sans);
    font-size: var(--text-base);
  }
}

/* Tabular figures for tables */
@layer utilities {
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
  .proportional-nums {
    font-variant-numeric: proportional-nums;
  }
}
```

### Pattern 3: Spacing System (4px/8px Rhythm)

**What:** 4px base grid with 8px rhythm for major spacing
**When to use:** All spacing tokens - provides granular control while maintaining visual rhythm
**Example:**
```css
/* Source: https://hakan-ertan.com/designers-ultimate-spacing-guide-from-design-tokens-to-final-design/ */
@theme {
  --spacing-0: 0;
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-12: 3rem;     /* 48px */
  --spacing-16: 4rem;     /* 64px */
  --spacing-24: 6rem;     /* 96px */
}

/* Vertical rhythm for text */
@layer base {
  p, ul, ol {
    margin-bottom: var(--spacing-4);
  }
  h1, h2, h3 {
    margin-bottom: var(--spacing-2);
    margin-top: var(--spacing-8);
  }
}
```

### Pattern 4: Dark Mode with FOUC Prevention

**What:** next-themes provider with inline blocking script to prevent flash
**When to use:** App-wide theme management with localStorage persistence
**Example:**
```tsx
// Source: https://github.com/pacocoursey/next-themes
// app/layout.tsx
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// components/theme-toggle.tsx
'use client'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle
    </button>
  )
}
```

### Pattern 5: View Transitions with Accessibility

**What:** Enable View Transitions API with prefers-reduced-motion detection
**When to use:** Page navigation transitions (150ms crossfade)
**Example:**
```ts
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
// next.config.ts
const nextConfig = {
  experimental: {
    viewTransition: true,
  },
}

// app/layout.tsx
import { ViewTransition } from 'react'

export default function Layout({ children }) {
  return (
    <ViewTransition>
      {children}
    </ViewTransition>
  )
}
```

```css
/* globals.css - Respect prefers-reduced-motion */
/* Source: https://developer.chrome.com/blog/view-transitions-misconceptions */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}

/* Default crossfade transition - 150ms */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 150ms;
}
```

### Pattern 6: CVA Component Variants for Match States

**What:** Type-safe variants using existing CVA pattern, extended for match states
**When to use:** All UI components that need match state styling
**Example:**
```tsx
// Source: https://cva.style/docs/getting-started/variants
// components/ui/match-badge.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const matchBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      outcome: {
        win: 'bg-win/10 text-win border border-win/20',
        draw: 'bg-draw/10 text-draw border border-draw/20',
        loss: 'bg-loss/10 text-loss border border-loss/20',
      },
      status: {
        live: 'bg-destructive/10 text-destructive border border-destructive/20 animate-pulse',
        upcoming: 'bg-primary/10 text-primary border border-primary/20',
        finished: 'bg-muted text-muted-foreground border border-border',
      },
    },
  }
)

export function MatchBadge({
  outcome,
  status,
  className,
  ...props
}: VariantProps<typeof matchBadgeVariants> & React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(matchBadgeVariants({ outcome, status }), className)}
      {...props}
    />
  )
}
```

### Pattern 7: OKLCH Color Space for Predictable Contrast

**What:** Use OKLCH instead of RGB/HSL for perceptually uniform colors
**When to use:** Defining all color tokens - ensures WCAG compliance is predictable
**Example:**
```css
/* Source: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl */
@theme {
  /* OKLCH: oklch(Lightness Chroma Hue) */
  /* Lightness 0-1 is perceptually uniform across hues */

  /* Light mode text colors - WCAG AAA on white */
  --color-text-primary: oklch(0.20 0.015 264);    /* L=20% = dark enough */
  --color-text-secondary: oklch(0.45 0.012 264);  /* L=45% = 4.5:1 contrast */

  /* Dark mode text colors - WCAG AAA on black */
  --color-text-primary-dark: oklch(0.95 0.004 264);  /* L=95% = light enough */
  --color-text-secondary-dark: oklch(0.70 0.008 264); /* L=70% = 4.5:1 contrast */

  /* P3 wide-gamut colors (optional - graceful fallback to sRGB) */
  --color-accent: oklch(0.70 0.25 220);  /* More vibrant on modern displays */
}
```

### Anti-Patterns to Avoid

- **Hardcoding color values in components:** Always use design tokens via Tailwind utilities or CSS variables
- **Using RGB/HSL for semantic colors:** OKLCH provides predictable lightness for WCAG compliance
- **localStorage without FOUC prevention:** Causes flash of wrong theme on page load in Next.js SSR
- **Skipping prefers-reduced-motion:** View Transitions must respect accessibility preferences
- **Custom emoji fonts:** Heavy, outdated quickly, system emoji fonts are sufficient
- **Pure black backgrounds (#000000):** Causes eye strain, use dark grays (oklch 0.10-0.15)
- **Mixing spacing units:** Stick to 4px/8px grid, avoid random rem values

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode toggle | Custom localStorage hook | next-themes | Handles SSR, system preference, FOUC prevention, localStorage sync automatically |
| Component variants | Manual className logic | CVA (class-variance-authority) | Type-safe, compound variants, better DX, already in use |
| Class name merging | String concatenation | clsx + tailwind-merge | Handles Tailwind specificity conflicts, conditional classes safely |
| WCAG contrast checking | Manual calculation | OKLCH color space | Perceptually uniform lightness makes contrast predictable across all hues |
| View Transitions fallback | Custom animation library | View Transitions API + prefers-reduced-motion | ~93% browser support, native performance, automatic fallback to instant navigation |
| Color token system | Sass variables | Tailwind @theme + CSS custom properties | Runtime changes (dark mode), SSR/PPR compatible, generates utilities automatically |

**Key insight:** Design systems involve many subtle edge cases (SSR flashing, color perception, accessibility preferences). Established solutions have solved these. Focus effort on domain-specific concerns (match states, accuracy gradients) rather than reinventing infrastructure.

## Common Pitfalls

### Pitfall 1: Dark Mode Flash of Unstyled Content (FOUC)
**What goes wrong:** On page load in Next.js, users see light theme briefly before dark mode applies
**Why it happens:** localStorage is client-side only; server doesn't know user's preference during SSR
**How to avoid:** Use next-themes library which injects blocking script in `<head>`, or implement custom blocking script
**Warning signs:** Theme "flickers" on page refresh, users report seeing wrong theme briefly
**Verification:**
```tsx
// Check that ThemeProvider is at app root with suppressHydrationWarning
<html suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
```

### Pitfall 2: Ignoring prefers-reduced-motion
**What goes wrong:** View Transitions animate for users who requested reduced motion in OS settings
**Why it happens:** Developer forgets to check media query or assumes all users want animations
**How to avoid:** Wrap view-transition styles in `@media (prefers-reduced-motion: no-preference)` or disable animations entirely for reduced motion users
**Warning signs:** Accessibility complaints, motion sickness reports from users
**Verification:**
```css
/* Verify this media query exists in globals.css */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Pitfall 3: Inconsistent WCAG Contrast in Dark Mode
**What goes wrong:** Semantic colors (win/loss/draw) have good contrast in light mode but fail WCAG in dark mode
**Why it happens:** Directly inverting colors doesn't account for human perception differences
**How to avoid:** Use OKLCH color space and adjust lightness independently for dark mode; test with contrast checker
**Warning signs:** Text hard to read on dark backgrounds, especially amber/yellow colors
**Verification:**
```bash
# Use WebAIM contrast checker for all semantic colors
# https://webaim.org/resources/contrastchecker/
# Minimum 4.5:1 for normal text (WCAG AA)
# Minimum 3:1 for large text and UI components (WCAG AA)
```

### Pitfall 4: Design Drift Between Figma and Code
**What goes wrong:** Design tokens in code diverge from Figma definitions over time
**Why it happens:** No single source of truth; designers and developers update independently
**How to avoid:** Define tokens in CSS (@theme directive), export to TypeScript for type safety, use as reference for Figma tokens
**Warning signs:** "This doesn't match the design" comments in PRs, inconsistent spacing/colors
**Verification:**
```ts
// lib/design-tokens.ts - Export tokens for TypeScript autocomplete
export const spacing = {
  1: '0.25rem',   // matches --spacing-1
  2: '0.5rem',    // matches --spacing-2
  // ...
} as const

export const colors = {
  win: 'oklch(0.69 0.17 162.5)',  // matches --color-win
  // ...
} as const
```

### Pitfall 5: Pure Black Backgrounds in Dark Mode
**What goes wrong:** Using #000000 causes eye strain, halation effect, reduced legibility
**Why it happens:** Assumption that "dark mode = pure black" for maximum contrast
**How to avoid:** Use dark grays (oklch 0.10-0.15 range) instead of pure black
**Warning signs:** User complaints about eye strain, text appearing to "vibrate" on screen
**Verification:**
```css
/* Verify background is NOT pure black */
:root.dark {
  --color-background: oklch(0.14 0.012 264);  /* NOT oklch(0 0 0) */
}
```

### Pitfall 6: Not Using Tabular Figures for Data
**What goes wrong:** Numbers in tables don't align vertically, making data hard to compare
**Why it happens:** Default proportional figures have variable widths (e.g., "1" narrower than "8")
**How to avoid:** Apply `font-variant-numeric: tabular-nums` to tables, stats, and numeric data
**Warning signs:** Numbers in columns visually misaligned, difficult to scan vertically
**Verification:**
```tsx
// Apply to table cells with numbers
<td className="tabular-nums">42.5%</td>

// Keep proportional for prose
<p className="proportional-nums">We analyzed 1,234 matches...</p>
```

### Pitfall 7: Over-Engineering Component Variants
**What goes wrong:** Too many variants create combinatorial explosion, components become unmaintainable
**Why it happens:** Adding variants for every slight visual difference instead of using composition
**How to avoid:** Limit to semantic variants (intent/size/state), use compound variants sparingly, compose multiple components for complex UIs
**Warning signs:** CVA definition with 5+ variant types, difficulty naming new variants
**Verification:**
```tsx
// Good: Limited semantic variants
const variants = {
  intent: ['default', 'destructive', 'success'],
  size: ['sm', 'md', 'lg'],
}

// Bad: Too many variants
const variants = {
  color: ['blue', 'green', 'red', 'purple', ...],
  border: ['solid', 'dashed', 'dotted', ...],
  shadow: ['none', 'sm', 'md', 'lg', 'xl', ...],
  // ... 10 more variant types
}
```

## Code Examples

Verified patterns from official sources:

### Setting Up Tailwind CSS 4 Design Tokens
```css
/* src/app/globals.css */
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* Override defaults with semantic tokens */
  --color-*: initial;  /* Remove default color palette */

  /* Neutral grays - base theme */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.20 0.015 264);
  --color-muted: oklch(0.95 0.004 264);
  --color-muted-foreground: oklch(0.45 0.012 264);

  /* Match state semantics */
  --color-win: oklch(0.69 0.17 162.5);
  --color-draw: oklch(0.77 0.19 70.1);
  --color-loss: oklch(0.64 0.24 25.3);

  /* Typography */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-base: 1rem;

  /* Spacing - 4px grid */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --spacing-8: 2rem;

  /* Border radius */
  --radius: 0.5rem;
}

/* Dark mode */
:root.dark {
  --color-background: oklch(0.14 0.012 264);
  --color-foreground: oklch(0.95 0.004 264);
  --color-muted: oklch(0.20 0.015 264);
  --color-muted-foreground: oklch(0.70 0.008 264);

  /* Adjust semantic colors for dark backgrounds */
  --color-win: oklch(0.72 0.17 162.5);    /* Lighter */
  --color-draw: oklch(0.80 0.19 70.1);    /* Lighter */
  --color-loss: oklch(0.67 0.24 25.3);    /* Lighter */
}

/* View Transitions accessibility */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 150ms;
}

@layer utilities {
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```

### Dark Mode Setup with next-themes
```tsx
// Source: https://github.com/pacocoursey/next-themes
// app/providers.tsx
'use client'
import { ThemeProvider } from 'next-themes'
import type { PropsWithChildren } from 'react'

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange  // Per user requirement: instant switch
    >
      {children}
    </ThemeProvider>
  )
}

// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// components/theme-toggle.tsx
'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <Sun className="rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

### Match State Component Variants
```tsx
// Source: https://cva.style/docs/getting-started/variants
// components/ui/match-badge.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const matchBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      outcome: {
        win: 'bg-win/10 text-win border border-win/20 dark:bg-win/20',
        draw: 'bg-draw/10 text-draw border border-draw/20 dark:bg-draw/20',
        loss: 'bg-loss/10 text-loss border border-loss/20 dark:bg-loss/20',
      },
      status: {
        live: 'bg-destructive text-white animate-pulse',
        upcoming: 'bg-primary/10 text-primary border border-primary/20',
        finished: 'bg-muted text-muted-foreground border border-border',
      },
    },
  }
)

export interface MatchBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof matchBadgeVariants> {}

export function MatchBadge({
  outcome,
  status,
  className,
  ...props
}: MatchBadgeProps) {
  return (
    <span
      className={cn(matchBadgeVariants({ outcome, status }), className)}
      {...props}
    />
  )
}
```

### Accuracy Gradient Component
```tsx
// components/accuracy-badge.tsx
import { cn } from '@/lib/utils'

interface AccuracyBadgeProps {
  percentage: number  // 0-100
  className?: string
}

export function AccuracyBadge({ percentage, className }: AccuracyBadgeProps) {
  // Determine color based on percentage thresholds
  const getColor = (pct: number) => {
    if (pct < 40) return 'text-loss'       // Red
    if (pct < 70) return 'text-draw'       // Amber
    return 'text-win'                       // Green
  }

  const getBgColor = (pct: number) => {
    if (pct < 40) return 'bg-loss/10 border-loss/20'
    if (pct < 70) return 'bg-draw/10 border-draw/20'
    return 'bg-win/10 border-win/20'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border tabular-nums',
        getColor(percentage),
        getBgColor(percentage),
        className
      )}
    >
      {percentage.toFixed(1)}%
    </span>
  )
}
```

### Next.js 16 View Transitions Configuration
```ts
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,  // Enable View Transitions API integration
  },
}

export default nextConfig
```

```tsx
// app/layout.tsx
import { ViewTransition } from 'react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ViewTransition>
          {children}
        </ViewTransition>
      </body>
    </html>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind config in JS | `@theme` directive in CSS | Tailwind v4 (2024) | Single source of truth, CSS-first, no context switching |
| RGB/HSL colors | OKLCH color space | ~2023-2024 | Perceptually uniform, predictable WCAG compliance, P3 gamut support |
| Manual dark mode script | next-themes library | ~2021 | Zero-config FOUC prevention, system preference, localStorage management |
| Framer Motion page transitions | View Transitions API | 2024-2025 | Native browser performance, no JS bundle cost, ~93% support |
| Sass/styled-components | CSS Custom Properties + Tailwind | 2023-2024 | Runtime theming, SSR/PPR compatible, better DX |
| Manual variant props | CVA (class-variance-authority) | ~2022 | Type safety, better autocomplete, less boilerplate |

**Deprecated/outdated:**
- **tailwind.config.js for theme tokens:** Tailwind v4 uses `@theme` directive in CSS instead
- **BlinkMacSystemFont in font stack:** Modern browsers support `system-ui` keyword
- **Custom dark mode script in _document.tsx:** next-themes handles this automatically
- **RGB color format:** OKLCH is now standard for design systems (better accessibility)
- **8pt-only spacing grid:** 4px base provides needed granularity for modern responsive design

## Open Questions

Things that couldn't be fully resolved:

1. **Dark mode toggle placement**
   - What we know: User marked as "Claude's discretion" - depends on Phase 22 mobile navigation structure
   - What's unclear: Final navigation component structure not yet designed
   - Recommendation: Plan token for "theme-toggle" placement, implement in Phase 22 when nav structure is finalized

2. **PPR impact on design system**
   - What we know: Next.js 16 has PPR stable, design tokens need to work with static + dynamic content
   - What's unclear: Specific PPR boundaries for this app not yet defined
   - Recommendation: CSS Custom Properties are PPR-safe (work in both static and dynamic), verify no build-time dependencies

3. **Wide-gamut P3 color support**
   - What we know: OKLCH supports P3 gamut, modern Apple devices display wider colors
   - What's unclear: Whether to define P3-specific variants or rely on OKLCH automatic gamut mapping
   - Recommendation: Start with OKLCH in sRGB range, browser automatically maps to P3 when available (graceful enhancement)

4. **Component variant coverage**
   - What we know: DSGN-04 requires "component variants for all match states"
   - What's unclear: Complete list of components needing match state variants (beyond Badge)
   - Recommendation: Start with Badge, Button, Card - audit existing components during implementation

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS 4 Theme Documentation](https://tailwindcss.com/docs/theme) - @theme directive, design tokens, CSS variables
- [Next.js 16 View Transitions Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) - Official configuration
- [MDN View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) - Browser support, accessibility
- [CVA Documentation](https://cva.style/docs) - Component variant patterns
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Dark mode library

### Secondary (MEDIUM confidence)
- [OKLCH in CSS: Why We Quit RGB and HSL](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) - Color space rationale
- [WCAG Color Contrast Accessibility Guide 2025](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025) - Contrast requirements
- [WebAIM Contrast and Color](https://webaim.org/articles/contrast/) - WCAG standards
- [System Font Stack](https://systemfontstack.com/) - Modern font stack best practices
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Design token patterns
- [Designer's Ultimate Spacing Guide](https://hakan-ertan.com/designers-ultimate-spacing-guide-from-design-tokens-to-final-design/) - 4px/8px rhythm
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) - PPR and View Transitions announcement
- [Fixing Dark Mode Flickering in Next.js](https://notanumber.in/blog/fixing-react-dark-mode-flickering) - FOUC prevention techniques

### Tertiary (LOW confidence - ecosystem/community)
- [Design Systems Pitfalls 2026](https://rydarashid.medium.com/design-systems-in-2026-predictions-pitfalls-and-power-moves-f401317f7563) - Common mistakes
- [9 Design System Traps to Avoid](https://moduscreate.com/blog/9-design-system-traps-to-avoid/) - Anti-patterns
- [Typography Scale with 1.2 Ratio](https://cieden.com/book/sub-atomic/typography/establishing-a-type-scale) - Modular scale theory
- [Class Variance Authority Enterprise Guide](https://www.thedanielmark.com/blog/enterprise-component-architecture-type-safe-design-systems-with-class-variance-authority) - CVA patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in official docs, currently in use or widely adopted
- Architecture: HIGH - Patterns from official docs (Tailwind, Next.js, CVA), aligned with existing codebase
- Pitfalls: MEDIUM - Mix of verified sources (MDN, WebAIM) and community experience (Medium, blogs)
- Color tokens: HIGH - OKLCH benefits verified in MDN and Evil Martians research
- View Transitions: MEDIUM - API is stable but Next.js integration is experimental
- Dark mode: HIGH - next-themes is proven solution, FOUC prevention well-documented

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - design system patterns are relatively stable)

**Stack versions verified:**
- Tailwind CSS: 4.x (latest stable)
- Next.js: 16.1.4 (current project version)
- React: 19.2.3 (current project version)
- CVA: 0.7.1 (current project version)
- Radix UI: 1.x (current project version)

**Browser support targets:**
- View Transitions API: ~93% (Chrome 111+, Safari 15.4+, Firefox 113+, Edge 111+)
- OKLCH color space: ~93% (Chrome 111+, Safari 15.4+, Firefox 113+)
- CSS Custom Properties: ~98% (all modern browsers)
