/**
 * FAQ extraction utility for blog posts
 *
 * Extracts FAQ items from markdown content by analyzing:
 * 1. Headings ending with "?" (question format)
 * 2. Q:/A: patterns in content
 * 3. Bolded questions followed by answers
 *
 * Used by BlogFAQ component for GEO-optimized FAQ sections.
 */

import type { FAQItem } from '@/lib/seo/schemas';

export interface ExtractFAQsOptions {
  /**
   * Maximum number of FAQs to extract (default: 5)
   */
  maxFaqs?: number;
  /**
   * Include a TL;DR question "What is this article about?" (default: false)
   * When true, this becomes the FIRST FAQ for AI citation priority
   */
  includeDefaultTLDR?: boolean;
  /**
   * Excerpt/summary to use as TL;DR answer (required if includeDefaultTLDR is true)
   */
  excerpt?: string;
}

/**
 * Extract FAQ items from markdown content
 *
 * @param markdown - Raw markdown content
 * @param options - Extraction options
 * @returns Array of FAQItem objects for use with FaqSchema
 *
 * @example
 * const faqs = extractFAQs(markdown, { maxFaqs: 5, includeDefaultTLDR: true, excerpt: "..." });
 */
export function extractFAQs(
  markdown: string,
  options: ExtractFAQsOptions = {}
): FAQItem[] {
  const { maxFaqs = 5, includeDefaultTLDR = false, excerpt } = options;
  const faqs: FAQItem[] = [];

  // 1. TL;DR question first (for AI citation priority per user decision)
  if (includeDefaultTLDR && excerpt) {
    faqs.push({
      question: 'What is this article about?',
      answer: truncateAnswer(excerpt),
    });
  }

  // 2. Extract from question headings (## heading ending with ?)
  const headingFaqs = extractFromQuestionHeadings(markdown);
  faqs.push(...headingFaqs);

  // 3. Extract from Q:/A: patterns
  const qaPatternFaqs = extractFromQAPatterns(markdown);
  faqs.push(...qaPatternFaqs);

  // 4. Extract from bolded questions
  const boldedFaqs = extractFromBoldedQuestions(markdown);
  faqs.push(...boldedFaqs);

  // Deduplicate by question text (case-insensitive)
  const seen = new Set<string>();
  const uniqueFaqs = faqs.filter((faq) => {
    const key = faq.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueFaqs.slice(0, maxFaqs);
}

/**
 * Extract FAQs from headings that end with "?"
 *
 * Pattern: ## Why use AI predictions?
 * Captures question from heading and answer from content until next heading
 */
function extractFromQuestionHeadings(markdown: string): FAQItem[] {
  const faqs: FAQItem[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match H2 or H3 headings ending with ?
    const match = line.match(/^#{2,3}\s+(.+\?)\s*$/);
    if (!match) continue;

    const question = match[1].trim();

    // Collect answer lines until next heading or end
    const answerLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      // Stop at next heading
      if (/^#{1,6}\s+/.test(nextLine)) break;
      answerLines.push(nextLine);
    }

    const answer = answerLines
      .join('\n')
      .trim()
      .replace(/^[\r\n]+|[\r\n]+$/g, ''); // Trim newlines

    if (answer) {
      faqs.push({
        question,
        answer: truncateAnswer(stripMarkdown(answer)),
      });
    }
  }

  return faqs;
}

/**
 * Extract FAQs from Q:/A: patterns
 *
 * Pattern:
 * Q: What is machine learning?
 * A: Machine learning is...
 */
function extractFromQAPatterns(markdown: string): FAQItem[] {
  const faqs: FAQItem[] = [];

  // Match Q: followed by A: patterns
  const qaRegex = /Q:\s*(.+?)\s*\n+A:\s*(.+?)(?=\n+Q:|$)/gis;
  let match;

  while ((match = qaRegex.exec(markdown)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();

    if (question && answer) {
      faqs.push({
        question: ensureQuestionMark(question),
        answer: truncateAnswer(stripMarkdown(answer)),
      });
    }
  }

  return faqs;
}

/**
 * Extract FAQs from bolded questions
 *
 * Pattern: **What is the best approach?** Answer text follows...
 */
function extractFromBoldedQuestions(markdown: string): FAQItem[] {
  const faqs: FAQItem[] = [];

  // Match **question?** followed by answer text
  const boldRegex = /\*\*([^*]+\?)\*\*\s*\n*(.+?)(?=\n\n|\n\*\*|$)/gs;
  let match;

  while ((match = boldRegex.exec(markdown)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();

    if (question && answer && !answer.startsWith('**')) {
      faqs.push({
        question,
        answer: truncateAnswer(stripMarkdown(answer)),
      });
    }
  }

  return faqs;
}

/**
 * Truncate answer to max length for schema best practice
 * Keep answers concise for structured data
 */
function truncateAnswer(text: string, maxLength = 300): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength - 50) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Strip common markdown formatting for clean answer text
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up whitespace
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Ensure question ends with question mark
 */
function ensureQuestionMark(text: string): string {
  const trimmed = text.trim();
  if (trimmed.endsWith('?')) {
    return trimmed;
  }
  return trimmed + '?';
}
