'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

type HoverPrefetchLinkProps = ComponentProps<typeof Link>;

/**
 * Link wrapper that prefetches only on hover/touch intent, not viewport entry.
 *
 * Next.js 16 default viewport prefetching can trigger 1MB+ of requests on scroll.
 * This pattern limits prefetching to links the user demonstrates intent to visit.
 *
 * Usage: Drop-in replacement for Next.js Link component.
 *
 * @example
 * <HoverPrefetchLink href="/matches">Matches</HoverPrefetchLink>
 */
export function HoverPrefetchLink({
  children,
  onMouseEnter,
  onTouchStart,
  ...props
}: HoverPrefetchLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);

  const handleInteraction = () => {
    if (!shouldPrefetch) {
      setShouldPrefetch(true);
    }
  };

  return (
    <Link
      {...props}
      prefetch={shouldPrefetch ? undefined : false}
      onMouseEnter={(e) => {
        handleInteraction();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        handleInteraction();
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
