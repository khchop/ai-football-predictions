'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { Heading } from '@/lib/blog/extract-headings';

interface BlogTOCProps {
  headings: Heading[];
}

/**
 * Table of Contents with Intersection Observer scroll spy
 *
 * Displays as sticky sidebar on desktop, hidden on mobile.
 * Highlights the currently visible section as user scrolls.
 *
 * @example
 * const headings = extractHeadings(markdown);
 * <BlogTOC headings={headings} />
 */
export function BlogTOC({ headings }: BlogTOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Early return if no headings
    if (headings.length === 0) return;

    // Use Map for visibility tracking (not state - avoids re-render on each intersection)
    const visibilityMap = new Map<string, boolean>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap.set(entry.target.id, entry.isIntersecting);
        });

        // Find first visible heading in document order
        const firstVisible = headings.find((h) => visibilityMap.get(h.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
        }
      },
      {
        // rootMargin: trigger when heading is near the top of viewport
        // -80px accounts for sticky header, -80% means only top 20% of viewport triggers
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) {
        observerRef.current?.observe(el);
      }
    });

    // CRITICAL: Disconnect observer on unmount to prevent memory leaks
    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  // Handle click with smooth scroll
  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();

    const element = document.getElementById(id);
    if (element) {
      // Respect prefers-reduced-motion (per Phase 17 decision)
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });

      // Update URL hash without scroll jump
      history.pushState(null, '', `#${id}`);

      // Update active state immediately for better UX
      setActiveId(id);
    }
  };

  // Empty state - return null if no headings
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav
      className="hidden lg:block sticky top-24 max-h-[calc(100vh-6rem)] overflow-auto"
      aria-label="Table of contents"
    >
      <h2 className="font-semibold mb-3 text-sm text-muted-foreground">
        On this page
      </h2>
      <ul className="space-y-2 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${h.id}`}
              onClick={(e) => handleClick(e, h.id)}
              className={cn(
                'block py-1 transition-colors hover:text-foreground',
                activeId === h.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
              aria-current={activeId === h.id ? 'location' : undefined}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
