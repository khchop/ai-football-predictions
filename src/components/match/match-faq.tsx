'use client';

import type { Match, Competition } from '@/lib/db/schema';
import { generateMatchFAQs, type FAQItem } from './MatchFAQSchema';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Re-export for page-level schema use
export { generateMatchFAQs } from './MatchFAQSchema';
export type { FAQItem } from './MatchFAQSchema';

interface MatchFAQProps {
  match: Match;
  competition: Competition;
  /** AI-generated FAQs (optional). Falls back to template-based if not provided. */
  aiFaqs?: FAQItem[] | null;
}

export function MatchFAQ({ match, competition, aiFaqs }: MatchFAQProps) {
  // Use AI-generated FAQs if available, otherwise fall back to template-based
  const faqs = aiFaqs && aiFaqs.length > 0 ? aiFaqs : generateMatchFAQs(match, competition);

  return (
    <section className="mt-16 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      <Accordion type="multiple" defaultValue={['item-0']} className="space-y-4">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-base md:text-lg text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
