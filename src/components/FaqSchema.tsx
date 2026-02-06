import { generateFAQPageSchema, type FAQItem } from '@/lib/seo/schemas';

interface FaqSchemaProps {
  faqs: FAQItem[];
}

/**
 * FAQ Schema Component
 * Injects FAQPage JSON-LD schema for rich snippets in search results
 * Used on pages with frequently asked questions
 *
 * Google recommends minimum 2 questions for FAQ rich results eligibility
 */
export function FaqSchema({ faqs }: FaqSchemaProps) {
  // Google recommends minimum 2 questions for FAQ rich results
  if (!faqs || faqs.length < 2) {
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
