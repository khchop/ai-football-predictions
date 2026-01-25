import { generateBreadcrumbSchema } from '@/lib/seo/schemas';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Breadcrumb Schema Component
 * Injects BreadcrumbList JSON-LD schema for enhanced navigation in search results
 * Used on pages with multi-level navigation hierarchy
 */
export function BreadcrumbSchema({ breadcrumbs }: BreadcrumbSchemaProps) {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  const schema = generateBreadcrumbSchema(breadcrumbs);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
