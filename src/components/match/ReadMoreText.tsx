'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ReadMoreTextProps {
  /** The text content to display */
  text: string;
  /** Number of lines to show when collapsed (default: 6 for ~150-200 words) */
  previewLines?: number;
  /** Additional CSS classes for the text container */
  className?: string;
  /** Minimum character count to trigger truncation (default: 600) */
  minCharsToTruncate?: number;
}

/**
 * ReadMoreText - Progressive disclosure for long-form content
 *
 * Uses CSS line-clamp for visual truncation and React useState for expansion.
 * Accessibility: aria-expanded, aria-label for screen reader support.
 */
export function ReadMoreText({
  text,
  previewLines = 6,
  className,
  minCharsToTruncate = 600,
}: ReadMoreTextProps) {
  const [expanded, setExpanded] = useState(false);

  // Don't truncate if text is short enough
  const shouldTruncate = text.length > minCharsToTruncate;

  if (!shouldTruncate) {
    return (
      <div className={cn('text-foreground leading-relaxed', className)}>
        {text}
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'text-foreground leading-relaxed',
          !expanded && `line-clamp-${previewLines}`,
          className
        )}
      >
        {text}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-primary hover:underline mt-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse content to preview' : 'Expand to read full content'}
        type="button"
      >
        {expanded ? 'Show Less' : 'Read More'}
      </button>
    </div>
  );
}
