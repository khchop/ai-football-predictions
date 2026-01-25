/**
 * WebPageSchema Component
 * 
 * Renders a JSON-LD WebPage schema for SEO on dynamic pages
 * Helps Google understand page hierarchy and purpose
 * 
 * Usage:
 * <WebPageSchema 
 *   name="Page Title"
 *   description="Page description"
 *   url="https://kroam.xyz/page"
 *   breadcrumb={[{ name: "Home", url: "..." }, ...]}
 * />
 */

interface Breadcrumb {
  name: string;
  url: string;
}

interface WebPageSchemaProps {
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  breadcrumb?: Breadcrumb[];
}

export function WebPageSchema({
  name,
  description,
  url,
  datePublished,
  dateModified,
  breadcrumb,
}: WebPageSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": "kroam.xyz",
      "url": "https://kroam.xyz",
    },
  };

  if (datePublished) {
    schema.datePublished = datePublished;
  }

  if (dateModified) {
    schema.dateModified = dateModified;
  }

  if (breadcrumb && breadcrumb.length > 0) {
    schema.breadcrumb = {
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumb.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url,
      })),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
