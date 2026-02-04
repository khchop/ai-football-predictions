'use client';

/**
 * BlogContent - Markdown renderer with typography styling
 *
 * Features:
 * - 70ch max-width for readable line length (scales with font size)
 * - Clear heading hierarchy (H1/H2/H3 with distinct sizes)
 * - Auto-generated heading IDs for anchor linking
 * - scroll-mt-20 for sticky header offset
 * - Images/code constrained to content width
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface BlogContentProps {
  content: string;
  className?: string;
}

/**
 * Generate URL-safe ID from heading text
 * Must match extract-headings.ts slugify for TOC consistency
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Track heading IDs for duplicate handling within single render
let headingIdCounts = new Map<string, number>();

function resetHeadingCounts() {
  headingIdCounts = new Map<string, number>();
}

function getUniqueHeadingId(text: string): string {
  const baseId = slugify(text);
  const count = headingIdCounts.get(baseId) || 0;
  headingIdCounts.set(baseId, count + 1);

  if (count === 0) {
    return baseId;
  }
  return `${baseId}-${count + 1}`;
}

// Custom components for React Markdown
const components = {
  h1: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    const text = children?.toString() || '';
    const id = getUniqueHeadingId(text);
    return (
      <h1
        id={id}
        className="text-3xl font-bold mb-4 mt-8 scroll-mt-20"
      >
        {children}
      </h1>
    );
  },
  h2: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    const text = children?.toString() || '';
    const id = getUniqueHeadingId(text);
    return (
      <h2
        id={id}
        className="text-2xl font-bold mb-3 mt-8 scroll-mt-20"
      >
        {children}
      </h2>
    );
  },
  h3: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    const text = children?.toString() || '';
    const id = getUniqueHeadingId(text);
    return (
      <h3
        id={id}
        className="text-xl font-semibold mb-3 mt-6 scroll-mt-20"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-foreground leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc space-y-2 mb-5 text-foreground pl-6 marker:text-primary/60">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal space-y-2 mb-5 text-foreground pl-6 marker:text-primary/60">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-foreground/90 leading-relaxed pl-1">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
      {children}
    </blockquote>
  ),
  code: ({
    inline,
    children,
  }: {
    inline?: boolean;
    children?: React.ReactNode;
  }) => {
    if (inline) {
      return (
        <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-sm">
          {children}
        </code>
      );
    }
    // Code block: constrain to content width with horizontal scroll
    return (
      <code className="block bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto max-w-full my-4">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto max-w-full my-4">
      {children}
    </pre>
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt || ''}
      className="max-w-full h-auto rounded-lg my-4"
    />
  ),
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-6 rounded-lg border border-border/40 bg-card/30">
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/60 border-b border-border/40">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border/20">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-3 text-foreground/90">{children}</td>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
};

export function BlogContent({ content, className }: BlogContentProps) {
  // Reset heading ID counts for each render
  resetHeadingCounts();

  return (
    <div
      className={cn(
        // 70ch max-width for readable line length (scales with font size)
        'max-w-[70ch] mx-auto',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
