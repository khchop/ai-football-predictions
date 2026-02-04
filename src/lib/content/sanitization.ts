/**
 * HTML Sanitization Utilities
 *
 * Converts HTML-polluted LLM output to clean plain text.
 * Uses html-to-text for structural conversion and he for entity decoding.
 *
 * Apply sanitization BEFORE database save, not at render time.
 */

import { convert } from 'html-to-text';
import { decode } from 'he';

/**
 * Sanitize LLM-generated content to plain text.
 * Converts HTML tags to text equivalents and decodes entities.
 *
 * @param content - Raw content that may contain HTML tags/entities
 * @returns Clean plain text with normalized whitespace
 */
export function sanitizeContent(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }

  // Step 1: Convert HTML structure to plain text
  const plainText = convert(content, {
    wordwrap: false, // Preserve original line breaks
    preserveNewlines: true,
    selectors: [
      // Block elements get line breaks
      {
        selector: 'p',
        format: 'block',
        options: { leadingLineBreaks: 2, trailingLineBreaks: 2 },
      },
      { selector: 'br', format: 'lineBreak' },
      {
        selector: 'div',
        format: 'block',
        options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
      },

      // Inline elements keep inner text only
      { selector: 'strong', format: 'inline' },
      { selector: 'em', format: 'inline' },
      { selector: 'b', format: 'inline' },
      { selector: 'i', format: 'inline' },

      // Strip everything else (tables, lists, etc.)
      { selector: '*', format: 'skip' },
    ],
  });

  // Step 2: Decode HTML entities
  const decoded = decode(plainText);

  // Step 3: Normalize whitespace (max 2 consecutive newlines, collapse multiple spaces)
  const normalized = decoded
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Validate content is HTML-free.
 * Throws if HTML tags or entities are detected.
 *
 * Use before database save for strict enforcement after sanitization.
 *
 * @param content - Content to validate
 * @throws Error if HTML tags or entities are detected
 */
export function validateNoHtml(content: string): void {
  if (!content) {
    return;
  }

  // Check for HTML opening tags (e.g., <p>, <div>, <br>, <table>)
  if (/<[a-z][\s\S]*?>/i.test(content)) {
    throw new Error('Content contains HTML tags');
  }

  // Check for common HTML entities that should have been decoded
  if (/&(?:amp|lt|gt|quot|nbsp);/i.test(content)) {
    throw new Error('Content contains HTML entities');
  }
}
