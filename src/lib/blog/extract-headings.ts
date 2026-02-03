/**
 * Heading extraction utility for TOC generation
 *
 * Extracts H2 and H3 headings from markdown content with URL-safe IDs.
 * Used by BlogContent component and BlogTOC component to ensure consistent IDs.
 */

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Generate a URL-safe slug from heading text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Extract H2 and H3 headings from markdown content
 *
 * @param markdown - Raw markdown content
 * @returns Array of Heading objects with unique IDs
 *
 * @example
 * const headings = extractHeadings(markdownContent);
 * // [
 * //   { id: "introduction", text: "Introduction", level: 2 },
 * //   { id: "getting-started", text: "Getting Started", level: 3 },
 * //   { id: "faq", text: "FAQ", level: 2 },
 * //   { id: "faq-2", text: "FAQ", level: 2 }, // Duplicate handled
 * // ]
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const idCounts = new Map<string, number>();
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match H2: ## Heading
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      const text = h2Match[1].trim();
      const baseId = slugify(text);
      const id = getUniqueId(baseId, idCounts);

      headings.push({ id, text, level: 2 });
      continue;
    }

    // Match H3: ### Heading
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      const text = h3Match[1].trim();
      const baseId = slugify(text);
      const id = getUniqueId(baseId, idCounts);

      headings.push({ id, text, level: 3 });
    }
  }

  return headings;
}

/**
 * Get unique ID by appending suffix for duplicates
 */
function getUniqueId(baseId: string, counts: Map<string, number>): string {
  const count = counts.get(baseId) || 0;
  counts.set(baseId, count + 1);

  if (count === 0) {
    return baseId;
  }

  // Append -2, -3, etc. for duplicates
  return `${baseId}-${count + 1}`;
}
