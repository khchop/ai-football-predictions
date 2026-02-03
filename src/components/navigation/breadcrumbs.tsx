import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { BASE_URL } from '@/lib/seo/constants';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Visual Breadcrumbs Component
 * Renders accessible breadcrumb navigation trail
 * Uses proper HTML structure: nav > ol > li
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumbs" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.name} className="flex items-center gap-1">
              {isLast ? (
                <span
                  aria-current="page"
                  className="max-w-[200px] truncate font-medium text-foreground"
                >
                  {item.name}
                </span>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className="max-w-[150px] truncate transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * BreadcrumbsWithSchema Component
 * Combines visual breadcrumb display with JSON-LD schema
 * Use this when you need both visual and SEO breadcrumbs
 */
export function BreadcrumbsWithSchema({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Convert to absolute URLs for schema
  const schemaItems = items.map((item) => ({
    name: item.name,
    url: item.href.startsWith('http') ? item.href : `${BASE_URL}${item.href}`,
  }));

  return (
    <>
      <BreadcrumbSchema breadcrumbs={schemaItems} />
      <Breadcrumbs items={items} />
    </>
  );
}
