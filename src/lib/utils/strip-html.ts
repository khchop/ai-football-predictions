import DOMPurify from 'isomorphic-dompurify';

/**
 * Strip all HTML tags from a string, returning plain text.
 * Handles edge cases like malformed HTML, HTML entities, and nested tags.
 * Uses isomorphic-dompurify for SSR compatibility.
 *
 * @param html - String potentially containing HTML tags
 * @returns Plain text with all HTML tags removed
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  // DOMPurify with no allowed tags = strip all HTML, keep text
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  // Normalize whitespace and trim
  return clean.replace(/\s+/g, ' ').trim();
}
