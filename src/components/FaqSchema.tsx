import { generateFAQPageSchema, type FAQItem } from '@/lib/seo/schemas';

interface FaqSchemaProps {
  faqs: FAQItem[];
}

/**
 * FAQ Schema Component
 * Injects FAQPage JSON-LD schema for rich snippets in search results
 * Used on pages with frequently asked questions
 */
export function FaqSchema({ faqs }: FaqSchemaProps) {
  if (!faqs || faqs.length === 0) {
    return null;
  }

  const schema = generateFAQPageSchema(faqs);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
