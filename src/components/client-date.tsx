'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/error-boundaries */
// This file intentionally uses setMounted(true) in useEffect for hydration safety
// and validates dates in try/catch before rendering JSX

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

interface ClientDateProps {
  dateString: string;
  formatStr?: string;
  relative?: boolean;
  className?: string;
}

/**
 * Client-side date formatting component to avoid hydration mismatches.
 * Dates are formatted consistently on the client side only.
 */
export function ClientDate({ 
  dateString, 
  formatStr = 'MMM d, HH:mm',
  relative = false,
  className 
}: ClientDateProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show a placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return <span className={className}>--</span>;
  }

  // Parse and validate date before rendering
  let date: Date;
  try {
    date = parseISO(dateString);
    if (isNaN(date.getTime())) {
      return <span className={className}>Invalid date</span>;
    }
  } catch {
    return <span className={className}>Invalid date</span>;
  }

  if (relative) {
    return (
      <span className={className} suppressHydrationWarning>
        {formatDistanceToNow(date, { addSuffix: true })}
      </span>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {format(date, formatStr)}
    </span>
  );
}

interface RelativeTimeProps {
  dateString: string;
  className?: string;
}

/**
 * Shows relative time (e.g., "in 2 hours", "3 days ago")
 */
export function RelativeTime({ dateString, className }: RelativeTimeProps) {
  return <ClientDate dateString={dateString} relative className={className} />;
}

interface MatchTimeProps {
  dateString: string;
  isUpcoming?: boolean;
  className?: string;
}

/**
 * Smart match time display:
 * - Upcoming: relative time ("in 2 hours")
 * - Past: formatted date ("Jan 15, 20:00")
 */
export function MatchTime({ dateString, isUpcoming, className }: MatchTimeProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>--</span>;
  }

  // Parse and validate date before rendering
  let date: Date;
  try {
    date = parseISO(dateString);
    if (isNaN(date.getTime())) {
      return <span className={className}>--</span>;
    }
  } catch {
    return <span className={className}>--</span>;
  }

  const now = new Date();
  const shouldShowRelative = isUpcoming ?? date > now;

  if (shouldShowRelative) {
    return (
      <span className={className} suppressHydrationWarning>
        {formatDistanceToNow(date, { addSuffix: true })}
      </span>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {format(date, 'MMM d, HH:mm')}
    </span>
  );
}
