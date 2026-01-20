import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';

// Format date for display
export function formatMatchDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'EEE, MMM d, yyyy');
}

// Format time for display
export function formatMatchTime(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'HH:mm');
}

// Format full datetime
export function formatMatchDateTime(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'EEE, MMM d, yyyy HH:mm');
}

// Get relative time (e.g., "in 2 hours", "3 days ago")
export function getRelativeTime(dateString: string): string {
  const date = parseISO(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

// Check if a match is upcoming (hasn't started yet)
export function isUpcoming(dateString: string): boolean {
  const date = parseISO(dateString);
  return isAfter(date, new Date());
}

// Check if kickoff is within N hours
export function isWithinHours(dateString: string, hours: number): boolean {
  const date = parseISO(dateString);
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return isAfter(date, now) && isBefore(date, future);
}

// Get date string for API calls (YYYY-MM-DD)
export function toAPIDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Get date range for fetching fixtures
export function getDateRange(hoursAhead: number = 36): { from: string; to: string } {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return {
    from: toAPIDateString(now),
    to: toAPIDateString(future),
  };
}
